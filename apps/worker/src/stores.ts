import { auditLog, job, jobEvent, jobStep } from "@vaz/db/schema";
import type { AuditEntry } from "@vaz/schemas/deps";
import type { JobEvent } from "@vaz/schemas/workflows";
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { AuditLogStore } from "./audit";
import type { JobEventStore } from "./events";

/**
 * `apps/worker` Postgres-backed persistence stores (R3.6 / R5.5).
 *
 * Concrete Drizzle implementations of the injected ports defined in `events.ts`
 * ({@link JobEventStore}) and `audit.ts` ({@link AuditLogStore}), writing into
 * the Phase-3 tables (`job_event` / `audit_log`). Like `@vaz/rag`'s
 * `createDrizzle*Store`, `db` is any PostgreSQL Drizzle client
 * (`PgDatabase<PgQueryResultHKT>`, driver-agnostic) — the concrete `pg` pool +
 * `drizzle(...)` instance is created and injected at the container edge (Task
 * 13.9). The row mappers are pure and exported for direct testing; errors
 * propagate to the sink layer, which owns fail-soft (events) vs fail-loud (audit).
 */

/** Row written to `job_event`: base fields become columns; the rest is jsonb. */
export interface JobEventRow {
	jobId: string;
	type: JobEvent["type"];
	ts: Date;
	payload: Record<string, unknown>;
}

/**
 * Map a {@link JobEvent} to its `job_event` row. `jobId` / `type` are columns and
 * the ISO `ts` becomes a `Date` (timestamptz); every remaining discriminant
 * field (stepId / kind / result / toolName / delta / message …) is carried in
 * the jsonb `payload`, so the full union round-trips.
 */
export function toJobEventRow(event: JobEvent): JobEventRow {
	const { jobId, ts, type, ...payload } = event;
	return { jobId, type, ts: new Date(ts), payload };
}

/** Row written to `audit_log` (mirrors {@link AuditEntry} 1:1). */
export interface AuditLogRow {
	jobId: string | null;
	userId: string | null;
	tool: string;
	args: unknown;
	ts: Date;
}

/** Map an {@link AuditEntry} to its `audit_log` row (args persisted here, R5.5). */
export function toAuditLogRow(entry: AuditEntry): AuditLogRow {
	return {
		jobId: entry.jobId,
		userId: entry.userId,
		tool: entry.tool,
		args: entry.args,
		ts: entry.ts,
	};
}

/** Drizzle-backed {@link JobEventStore}: appends one `job_event` row per event (R3.6). */
export function createJobEventStore(db: PgDatabase<PgQueryResultHKT>): JobEventStore {
	return {
		async append(event) {
			await db.insert(jobEvent).values(toJobEventRow(event));
		},
	};
}

/** Drizzle-backed {@link AuditLogStore}: inserts one `audit_log` row per tool exec (R5.5). */
export function createAuditLogStore(db: PgDatabase<PgQueryResultHKT>): AuditLogStore {
	return {
		async insert(entry) {
			await db.insert(auditLog).values(toAuditLogRow(entry));
		},
	};
}

/** A job row to persist at run start. `status` defaults to `"running"`. */
export interface JobInsert {
	id: string;
	userId: string | null;
	workflow: string;
}

/**
 * Job ownership persistence + lookup (R5.1). `job.userId` has
 * existed but was never written to, so `apps/web`'s approve/stream
 * routes had no way to verify a caller owns the job they are acting on. `insert`
 * is called once at {@link runJob}'s start (`apps/worker/src/main.ts`);
 * `findOwnerUserId` is the read side those routes call.
 */
/**
 * Ownership lookup result. `found: false` means no `job` row exists yet for
 * this id (unknown id, or the race window before `runJob`'s insert has run) —
 * callers MUST NOT treat this the same as "found, no owner" (an intentionally
 * accepted anonymous submission): the former is not itself an authorization
 * boundary, the latter is a real "not found" (adversarial-review fix for the
 * approve/stream routes' null-owner TOCTOU gap).
 */
export interface JobOwnerLookup {
	found: boolean;
	userId: string | null;
}

export interface JobStore {
	insert(row: JobInsert): Promise<void>;
	findOwnerUserId(jobId: string): Promise<JobOwnerLookup>;
}

/* -------------------------------------------------------------------------- */
/* JobStepStore — pending set + observed usage (D5 / C-9, Task 7)             */
/* -------------------------------------------------------------------------- */

/**
 * Port for the `job_step` table: atomic pending-set management and observed
 * token-usage recording (R6.1 / R7.1 / R7.5, D5). Three responsibilities:
 *
 * - {@link registerPending}: mark a step as needing approval before it runs.
 *   Idempotent (`ON CONFLICT DO NOTHING`) — Inngest replays the function body
 *   on retries and on resume, so the same `stepId` may be registered twice.
 *
 * - {@link recordStepUsage}: write the observed `totalTokens` for a completed
 *   step as an absolute value (not an increment). Idempotent via upsert — a
 *   replay of the same step always overwrites, never double-counts.
 *
 * - {@link claimPending}: single-transaction consume-once gate. Reads
 *   `sum(total_tokens)` for the job then UPDATE-WHERE-pending sets
 *   `approval_state = 'consumed'` and `consumed_at = at`. Returns the number
 *   of rows updated (0 means no pending steps existed — already claimed or
 *   never registered). `consumed` → `pending` is intentionally absent: the
 *   API has no method to reverse a claim.
 */
export interface JobStepStore {
	/**
	 * Register `stepId` as approval-pending for `jobId`. Idempotent: a second
	 * call for the same `(jobId, stepId)` is a safe no-op (`ON CONFLICT DO
	 * NOTHING`), so Inngest function-body replays never violate the composite PK.
	 */
	registerPending(jobId: string, stepId: string, at: Date): Promise<void>;

	/**
	 * Upsert the observed `totalTokens` for `(jobId, stepId)` as an absolute
	 * value. On conflict (the row already exists from `registerPending`), SET
	 * `total_tokens` to the supplied count — never increment. A replay of the
	 * same specialist run therefore writes the same count, not double.
	 */
	recordStepUsage(jobId: string, stepId: string, totalTokens: number): Promise<void>;

	/**
	 * Atomically consume all pending steps for `jobId` in one transaction:
	 *   1. Read `sum(total_tokens)` for the job (exposed to callers as the
	 *      budget-gate signal — see Task 9).
	 *   2. UPDATE rows WHERE `approval_state = 'pending'` → `'consumed'`,
	 *      setting `consumed_at = at` (injected, NOT SQL `now()`).
	 *   3. Return the number of rows updated (0 = nothing was pending).
	 *
	 * `consumed` → `pending` reversal is not provided: once claimed, a step
	 * is permanently consumed (D5 atomicity constraint).
	 */
	claimPending(jobId: string, at: Date): Promise<number>;
}

/** Drizzle-backed {@link JobStepStore} over the `job_step` table. */
export function createJobStepStore(db: PgDatabase<PgQueryResultHKT>): JobStepStore {
	return {
		async registerPending(jobId, stepId, at) {
			await db
				.insert(jobStep)
				.values({ jobId, stepId, approvalState: "pending", createdAt: at })
				.onConflictDoNothing();
		},

		async recordStepUsage(jobId, stepId, totalTokens) {
			await db
				.insert(jobStep)
				.values({ jobId, stepId, totalTokens })
				.onConflictDoUpdate({
					target: [jobStep.jobId, jobStep.stepId],
					set: { totalTokens },
				});
		},

		async claimPending(jobId, at) {
			return db.transaction(async (tx) => {
				// Step 1: read the cumulative token spend for this job. The result is
				// available to the caller as a budget-gate signal (Task 9 / D3).
				await tx
					.select({ total: sql<number>`sum(${jobStep.totalTokens})` })
					.from(jobStep)
					.where(eq(jobStep.jobId, jobId));

				// Step 2: conditionally UPDATE only the pending rows. `consumed_at` is
				// the injected `at` — never SQL `now()` — so the timestamp is
				// deterministic and testable without mocking the clock.
				const result = await tx
					.update(jobStep)
					.set({ approvalState: "consumed", consumedAt: at })
					.where(and(eq(jobStep.jobId, jobId), eq(jobStep.approvalState, "pending")));

				// Drizzle's pg driver sets `rowCount` on the raw result; fall back to
				// 0 when the adapter returns a plain object without it.
				return (result as { rowCount?: number }).rowCount ?? 0;
			});
		},
	};
}

/** Drizzle-backed {@link JobStore} over the `job` table. */
export function createJobStore(db: PgDatabase<PgQueryResultHKT>): JobStore {
	return {
		async insert({ id, userId, workflow }) {
			// Idempotent: `runJob` is the Inngest function body, so this re-runs on
			// every retry (retries: 3) and on resume after an approval
			// `waitForEvent`. A plain insert would hit `job.id`'s PK on the second
			// run and fail-loud — permanently breaking retries and the HITL resume
			// flow. `onConflictDoNothing` makes the replayed insert a safe no-op;
			// a genuine failure (e.g. the DB is down) still throws.
			await db
				.insert(job)
				.values({ id, userId, workflow, status: "running" })
				// Target the id PK explicitly: only a replayed same-job insert is a
				// no-op; a future unique constraint's conflict is NOT silently swallowed.
				.onConflictDoNothing({ target: job.id });
		},
		async findOwnerUserId(jobId) {
			const rows = await db
				.select({ userId: job.userId })
				.from(job)
				.where(eq(job.id, jobId))
				.limit(1);
			if (rows.length === 0) {
				return { found: false, userId: null };
			}
			return { found: true, userId: rows[0].userId };
		},
	};
}
