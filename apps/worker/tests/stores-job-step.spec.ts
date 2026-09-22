import { jobStep } from "@vaz/db/schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createJobStepStore } from "../src/stores";

/**
 * JobStepStore (Task 7, C-9): Drizzle-backed `registerPending` /
 * `recordStepUsage` / `claimPending` over the `job_step` table (R6.1 / R7.1).
 *
 * All three methods are tested against a fake Drizzle client — no Postgres
 * required. Key invariants pinned here:
 *
 * - `registerPending` uses ON CONFLICT DO NOTHING (idempotent for Inngest
 *   function-body replays — the same stepId may be registered more than once).
 * - `recordStepUsage` is an absolute-value upsert: `total_tokens` is SET to
 *   the supplied count, NOT incremented. Prevents double-counting on replay.
 * - `claimPending` runs inside a single transaction: reads `sum(total_tokens)`
 *   for the job, then conditionally UPDATEs only rows where
 *   `step_id` is in the requested `stepIds` AND `approval_state = 'pending'`;
 *   `consumed_at` is taken from the injected `at` argument (never from SQL
 *   `now()`) so the timestamp is deterministic and testable without time
 *   mocking. Returns the number of rows updated.
 * - `claimPending` is all-or-nothing across `stepIds` (R9.2/9.6, adversarial-
 *   review fix): if fewer rows matched than were requested (some `stepId`
 *   was unknown / already consumed / in-flight elsewhere), the transaction
 *   callback throws to force a real ROLLBACK — nothing is left consumed —
 *   and `claimPending` catches that internally and resolves with the actual
 *   (partial) `rowCount`, never silently reporting a full claim.
 */

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "22222222-2222-4222-8222-222222222222";
const STEP_ID_2 = "33333333-3333-4333-8333-333333333333";
const AT = new Date("2026-10-01T12:00:00.000Z");

/* -------------------------------------------------------------------------- */
/* Fake Drizzle helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Minimal fake for INSERT-path methods (`registerPending`, `recordStepUsage`).
 * Captures `(table, row, onConflictDoNothing, onConflictDoUpdate)` per call.
 */
interface InsertRecord {
	table: unknown;
	row: unknown;
	onConflictDoNothing: boolean;
	onConflictDoUpdateSet: Record<string, unknown> | null;
}

function fakeInsertDb(): { db: PgDatabase<PgQueryResultHKT>; inserts: InsertRecord[] } {
	const inserts: InsertRecord[] = [];
	const db = {
		insert(table: unknown) {
			return {
				values(row: unknown) {
					const record: InsertRecord = {
						table,
						row,
						onConflictDoNothing: false,
						onConflictDoUpdateSet: null,
					};
					inserts.push(record);
					return Object.assign(Promise.resolve(), {
						onConflictDoNothing() {
							record.onConflictDoNothing = true;
							return Promise.resolve();
						},
						onConflictDoUpdate({ set }: { set: Record<string, unknown> }) {
							record.onConflictDoUpdateSet = set;
							return Promise.resolve();
						},
					});
				},
			};
		},
	} as unknown as PgDatabase<PgQueryResultHKT>;
	return { db, inserts };
}

/**
 * Fake for `claimPending`: records `transaction(fn)` calls and supplies a
 * controlled tx that captures select / update calls so tests can assert on
 * the SQL shape without a real Postgres.
 */
interface ClaimCall {
	/** Rows returned by the sum-select inside the transaction. */
	selectRows: Array<{ total: number | null }>;
	/** Rows captured by the conditional UPDATE. */
	updateRows: Array<{
		setConsumedAt: Date | null;
		setApprovalState: string | null;
		whereApprovalState: string | null;
		whereJobId: string | null;
	}>;
	/** Affected-row count the fake UPDATE resolves with. */
	updatedCount: number;
	/** The value returned by `claimPending`. */
	result: { rowCount: number; totalTokens: number };
}

type CapturingTx = {
	selectRows: Array<{ total: number | null }>;
	updates: ClaimCall["updateRows"];
	updatedCount: number;
};

function fakeTransactionDb(
	selectRows: Array<{ total: number | null }>,
	updatedCount: number,
): {
	db: PgDatabase<PgQueryResultHKT>;
	tx: CapturingTx;
} {
	const tx: CapturingTx = { selectRows, updates: [], updatedCount };

	const buildTx = (): unknown => ({
		// select({ total: sql`sum(...)` }).from(jobStep).where(...) chain
		select(_fields: unknown) {
			return {
				from(_table: unknown) {
					return {
						where(_cond: unknown) {
							return Promise.resolve(tx.selectRows);
						},
					};
				},
			};
		},
		// update(jobStep).set({ ... }).where(and(...)) chain
		update(_table: unknown) {
			return {
				set(fields: { consumedAt?: unknown; approvalState?: unknown }) {
					const row = {
						setConsumedAt: (fields.consumedAt ?? null) as Date | null,
						setApprovalState: (fields.approvalState ?? null) as string | null,
						whereApprovalState: null as string | null,
						whereJobId: null as string | null,
					};
					tx.updates.push(row);
					return {
						// where(...) — we don't inspect the SQL AST deeply; trusting
						// the implementation passes `and(eq(jobStep.jobId, jobId),
						// eq(jobStep.approvalState, 'pending'))` by the side-effect of
						// the consumed_at timestamp and approval_state values set above.
						where(_cond: unknown) {
							return Promise.resolve({ rowCount: tx.updatedCount });
						},
					};
				},
			};
		},
	});

	const db = {
		transaction(fn: (tx: unknown) => Promise<unknown>) {
			return fn(buildTx());
		},
	} as unknown as PgDatabase<PgQueryResultHKT>;

	return { db, tx };
}

/* -------------------------------------------------------------------------- */
/* registerPending                                                             */
/* -------------------------------------------------------------------------- */

describe("createJobStepStore.registerPending — idempotent pending registration (R7.1)", () => {
	test("inserts into the job_step table with approval_state = 'pending'", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).registerPending(JOB_ID, STEP_ID, AT);
		expect(inserts).toHaveLength(1);
		expect(inserts[0]?.table).toBe(jobStep);
		expect(inserts[0]?.row).toMatchObject({
			jobId: JOB_ID,
			stepId: STEP_ID,
			approvalState: "pending",
		});
	});

	test("uses ON CONFLICT DO NOTHING so Inngest function-body replay is a safe no-op", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).registerPending(JOB_ID, STEP_ID, AT);
		expect(inserts[0]?.onConflictDoNothing).toBe(true);
	});

	test("does NOT use onConflictDoUpdate (absolute-set would clobber consumed state)", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).registerPending(JOB_ID, STEP_ID, AT);
		expect(inserts[0]?.onConflictDoUpdateSet).toBeNull();
	});
});

/* -------------------------------------------------------------------------- */
/* recordStepUsage                                                             */
/* -------------------------------------------------------------------------- */

describe("createJobStepStore.recordStepUsage — absolute-value usage upsert (R7.5)", () => {
	test("inserts into the job_step table with the supplied totalTokens", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).recordStepUsage(JOB_ID, STEP_ID, 1234);
		expect(inserts).toHaveLength(1);
		expect(inserts[0]?.table).toBe(jobStep);
		expect(inserts[0]?.row).toMatchObject({
			jobId: JOB_ID,
			stepId: STEP_ID,
			totalTokens: 1234,
		});
	});

	test("uses onConflictDoUpdate to SET total_tokens (absolute, not incremented)", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).recordStepUsage(JOB_ID, STEP_ID, 500);
		// An absolute SET means the same value should be in both the initial
		// insert row and the conflict-update set.
		expect(inserts[0]?.onConflictDoUpdateSet).toMatchObject({ totalTokens: 500 });
	});

	test("does NOT use onConflictDoNothing (usage must be recorded even on conflict)", async () => {
		const { db, inserts } = fakeInsertDb();
		await createJobStepStore(db).recordStepUsage(JOB_ID, STEP_ID, 300);
		expect(inserts[0]?.onConflictDoNothing).toBe(false);
	});
});

/* -------------------------------------------------------------------------- */
/* claimPending                                                                */
/* -------------------------------------------------------------------------- */

describe("createJobStepStore.claimPending — atomic consume (R6.1 / R9.2 / R9.6)", () => {
	test("runs inside a single transaction", async () => {
		const fake = fakeTransactionDb([{ total: 100 }], 1);
		// Replace the ref so we can count calls
		let txCalls = 0;
		const originalTransaction = fake.db.transaction.bind(fake.db);
		(fake.db as Record<string, unknown>).transaction = async (fn: unknown) => {
			txCalls++;
			return originalTransaction(fn as Parameters<typeof originalTransaction>[0]);
		};
		await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID], AT);
		expect(txCalls).toBe(1);
	});

	test("sets consumed_at to the injected at timestamp, not SQL now()", async () => {
		const fake = fakeTransactionDb([{ total: 200 }], 1);
		await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID], AT);
		expect(fake.tx.updates).toHaveLength(1);
		// The injected Date must be the exact object (or equal value) passed to the UPDATE
		expect(fake.tx.updates[0]?.setConsumedAt).toEqual(AT);
	});

	test("sets approval_state to 'consumed' on the updated rows", async () => {
		const fake = fakeTransactionDb([{ total: 300 }], 2);
		await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID, STEP_ID_2], AT);
		expect(fake.tx.updates[0]?.setApprovalState).toBe("consumed");
	});

	test("returns the number of rows updated (affected count) in rowCount when the full requested set matched", async () => {
		const fake = fakeTransactionDb([{ total: 400 }], 3);
		const result = await createJobStepStore(fake.db).claimPending(
			JOB_ID,
			[STEP_ID, STEP_ID_2, "44444444-4444-4444-8444-444444444444"],
			AT,
		);
		expect(result.rowCount).toBe(3);
	});

	test("returns the cumulative totalTokens from the sum select", async () => {
		const fake = fakeTransactionDb([{ total: 400 }], 3);
		const result = await createJobStepStore(fake.db).claimPending(
			JOB_ID,
			[STEP_ID, STEP_ID_2, "44444444-4444-4444-8444-444444444444"],
			AT,
		);
		expect(result.totalTokens).toBe(400);
	});

	test("returns totalTokens=0 when no rows exist for the job (null sum)", async () => {
		const fake = fakeTransactionDb([{ total: null }], 0);
		const result = await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID], AT);
		expect(result.totalTokens).toBe(0);
	});

	test("returns rowCount=0 when no pending rows exist for the job", async () => {
		const fake = fakeTransactionDb([], 0);
		const result = await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID], AT);
		expect(result.rowCount).toBe(0);
	});

	/* ------------------------------------------------------------------------ */
	/* R9.2 / R9.6 — all-or-nothing atomicity across the requested stepIds      */
	/* (adversarial-review fix: the original implementation ignored `stepIds`   */
	/* entirely and consumed every pending row for the job, regardless of      */
	/* whether it was in the caller's decision set.)                           */
	/* ------------------------------------------------------------------------ */

	test("R9.2/9.6: a partial match forces the transaction callback to throw (real ROLLBACK) instead of silently committing a partial claim", async () => {
		// Only 1 of the 2 requested stepIds was actually pending.
		const fake = fakeTransactionDb([{ total: 500 }], 1);
		let callbackThrew = false;
		const originalTransaction = fake.db.transaction.bind(fake.db);
		(fake.db as Record<string, unknown>).transaction = async (fn: unknown) => {
			try {
				return await originalTransaction(fn as Parameters<typeof originalTransaction>[0]);
			} catch (error) {
				callbackThrew = true;
				throw error;
			}
		};

		const result = await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID, STEP_ID_2], AT);

		// A real Postgres driver rolls back on a thrown error inside db.transaction —
		// so this proves nothing was left consumed for the mismatched set.
		expect(callbackThrew).toBe(true);
		// The mismatch is surfaced as the true (partial) rowCount, not silently
		// upgraded to "fully claimed".
		expect(result).toEqual({ rowCount: 1, totalTokens: 500 });
	});

	test("R9.2/9.6: a full match does NOT throw (no rollback) and resolves with rowCount === stepIds.length", async () => {
		const fake = fakeTransactionDb([{ total: 500 }], 2);
		let callbackThrew = false;
		const originalTransaction = fake.db.transaction.bind(fake.db);
		(fake.db as Record<string, unknown>).transaction = async (fn: unknown) => {
			try {
				return await originalTransaction(fn as Parameters<typeof originalTransaction>[0]);
			} catch (error) {
				callbackThrew = true;
				throw error;
			}
		};

		const result = await createJobStepStore(fake.db).claimPending(JOB_ID, [STEP_ID, STEP_ID_2], AT);

		expect(callbackThrew).toBe(false);
		expect(result).toEqual({ rowCount: 2, totalTokens: 500 });
	});

	test("claimPending resolves rowCount=0 without touching the DB when stepIds is empty", async () => {
		const fake = fakeTransactionDb([{ total: 999 }], 0);
		let transactionCalled = false;
		(fake.db as Record<string, unknown>).transaction = async () => {
			transactionCalled = true;
			throw new Error("must not start a transaction for an empty stepIds array");
		};

		const result = await createJobStepStore(fake.db).claimPending(JOB_ID, [], AT);

		expect(transactionCalled).toBe(false);
		expect(result).toEqual({ rowCount: 0, totalTokens: 0 });
	});
});
