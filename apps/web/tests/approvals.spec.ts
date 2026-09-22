import type { Logger } from "@vaz/schemas/deps";
import type { JobStepStore } from "@vaz/worker/src/stores";
import type { ClaimOutcome } from "@/lib/approvals";
import {
	claimApprovalTargets,
	findDuplicateTarget,
	maskedArgKeys,
	normalizeApprovalRequest,
	recordApprovalDecisions,
	resolveJobTokenBudget,
} from "@/lib/approvals";

/**
 * Unit tests for `apps/web/src/lib/approvals.ts` (Task 9, C-8).
 *
 * Pins the pure-function behaviour before the route wires them in (Task 10):
 * - `normalizeApprovalRequest` — single form to 1-element set, set form passthrough, submittedAs preserved
 * - `findDuplicateTarget` — in-set duplicate detection before any DB access
 * - `maskedArgKeys` — key names only, never values (R4.7 / D4)
 * - `resolveJobTokenBudget` — reads JOB_TOKEN_BUDGET with default 200 000, coerced, positive-int
 * - `claimApprovalTargets` — consume-once + existence concealment + budget gate (D2/D3/D5)
 * - `recordApprovalDecisions` — single fail-soft audit firing point (D4, R8.1–R8.6)
 */

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STEP_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STEP_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CALLER_ID = "user-1";
const AT = new Date("2026-10-01T12:00:00.000Z");
const DEFAULT_BUDGET = 200_000;

/* -------------------------------------------------------------------------- */
/* normalizeApprovalRequest                                                    */
/* -------------------------------------------------------------------------- */

describe("normalizeApprovalRequest — single / set normalization", () => {
	test("folds a single decision into a 1-element array", () => {
		const result = normalizeApprovalRequest({
			toolCallId: STEP_A,
			decision: "approve",
		});
		expect(result.decisions).toHaveLength(1);
		expect(result.decisions[0]).toMatchObject({ toolCallId: STEP_A, decision: "approve" });
	});

	test("preserves submittedAs='single' for a single-form request", () => {
		const result = normalizeApprovalRequest({ toolCallId: STEP_A, decision: "reject" });
		expect(result.submittedAs).toBe("single");
	});

	test("preserves submittedAs='set' for a set-form request", () => {
		const result = normalizeApprovalRequest({
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
		});
		expect(result.submittedAs).toBe("set");
	});

	test("passes a set-form request through unchanged (keeps both decisions)", () => {
		const result = normalizeApprovalRequest({
			decisions: [
				{ toolCallId: STEP_A, decision: "approve" },
				{ toolCallId: STEP_B, decision: "reject" },
			],
		});
		expect(result.decisions).toHaveLength(2);
		expect(result.decisions[0]?.toolCallId).toBe(STEP_A);
		expect(result.decisions[1]?.toolCallId).toBe(STEP_B);
	});

	test("preserves args on a single-form decision", () => {
		const result = normalizeApprovalRequest({
			toolCallId: STEP_A,
			decision: "approve",
			args: { to: "alice@example.com" },
		});
		expect(result.decisions[0]?.args).toEqual({ to: "alice@example.com" });
	});

	test("preserves args on a set-form decision", () => {
		const result = normalizeApprovalRequest({
			decisions: [{ toolCallId: STEP_A, decision: "approve", args: { count: 3 } }],
		});
		expect(result.decisions[0]?.args).toEqual({ count: 3 });
	});
});

/* -------------------------------------------------------------------------- */
/* findDuplicateTarget                                                         */
/* -------------------------------------------------------------------------- */

describe("findDuplicateTarget — in-set duplicate detection (R9.3)", () => {
	test("returns null when all toolCallIds are distinct", () => {
		expect(
			findDuplicateTarget([
				{ toolCallId: STEP_A, decision: "approve" },
				{ toolCallId: STEP_B, decision: "reject" },
			]),
		).toBeNull();
	});

	test("returns a toolCallId that appears more than once", () => {
		const dup = findDuplicateTarget([
			{ toolCallId: STEP_A, decision: "approve" },
			{ toolCallId: STEP_A, decision: "reject" },
		]);
		expect(dup).toBe(STEP_A);
	});

	test("returns null for a single-element array", () => {
		expect(findDuplicateTarget([{ toolCallId: STEP_A, decision: "approve" }])).toBeNull();
	});

	test("returns null for an empty array", () => {
		expect(findDuplicateTarget([])).toBeNull();
	});
});

/* -------------------------------------------------------------------------- */
/* maskedArgKeys                                                               */
/* -------------------------------------------------------------------------- */

describe("maskedArgKeys — key names only, never values (R4.7 / D4, R8.1)", () => {
	test("returns key names from an args object", () => {
		const keys = maskedArgKeys({ to: "secret@example.com", subject: "hi" });
		expect(keys).toEqual(expect.arrayContaining(["to", "subject"]));
		expect(keys).toHaveLength(2);
	});

	test("returns an empty array for undefined args", () => {
		expect(maskedArgKeys(undefined)).toEqual([]);
	});

	test("returns an empty array for null args", () => {
		expect(maskedArgKeys(null)).toEqual([]);
	});

	test("returns an empty array for a non-object (string) arg", () => {
		expect(maskedArgKeys("some-string")).toEqual([]);
	});

	test("returns an empty array for an empty object", () => {
		expect(maskedArgKeys({})).toEqual([]);
	});

	test("never contains the VALUE of any key", () => {
		const keys = maskedArgKeys({ secret: "do-not-log-this" });
		expect(keys).not.toContain("do-not-log-this");
	});
});

/* -------------------------------------------------------------------------- */
/* resolveJobTokenBudget                                                       */
/* -------------------------------------------------------------------------- */

describe("resolveJobTokenBudget — reads JOB_TOKEN_BUDGET from env (R7.4)", () => {
	test("returns the default 200 000 when JOB_TOKEN_BUDGET is not set", () => {
		expect(resolveJobTokenBudget({})).toBe(DEFAULT_BUDGET);
	});

	test("coerces a string value to number", () => {
		expect(resolveJobTokenBudget({ JOB_TOKEN_BUDGET: "50000" })).toBe(50_000);
	});

	test("returns the parsed value when JOB_TOKEN_BUDGET is a valid positive integer", () => {
		expect(resolveJobTokenBudget({ JOB_TOKEN_BUDGET: "1" })).toBe(1);
	});

	test("throws (or falls back to default) when JOB_TOKEN_BUDGET is zero", () => {
		// parseAiEnv rejects non-positive values; we expect an error or the default
		expect(() => resolveJobTokenBudget({ JOB_TOKEN_BUDGET: "0" })).toThrow();
	});

	test("throws when JOB_TOKEN_BUDGET is negative", () => {
		expect(() => resolveJobTokenBudget({ JOB_TOKEN_BUDGET: "-1" })).toThrow();
	});
});

/* -------------------------------------------------------------------------- */
/* claimApprovalTargets                                                        */
/* -------------------------------------------------------------------------- */

describe("claimApprovalTargets — consume-once, existence concealment, budget gate (D2/D3/D5)", () => {
	/** Build a minimal JobStepStore fake with controllable outcomes. */
	function makeStore(opts: {
		claimResult?: { rowCount: number; totalTokens: number };
	}): JobStepStore {
		return {
			registerPending: vi.fn(),
			recordStepUsage: vi.fn(),
			claimPending: vi.fn().mockResolvedValue(opts.claimResult ?? { rowCount: 1, totalTokens: 0 }),
		};
	}

	test("returns claimed outcome when pending rows are consumed and budget not exceeded", async () => {
		const store = makeStore({ claimResult: { rowCount: 1, totalTokens: 500 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("claimed");
	});

	test("calls claimPending with the jobId and at timestamp", async () => {
		const store = makeStore({ claimResult: { rowCount: 1, totalTokens: 0 } });
		await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(store.claimPending).toHaveBeenCalledWith(JOB_ID, AT);
	});

	test("returns not-claimable when rowCount is 0 (unknown/in-flight/consumed — 3 cases indistinguishable)", async () => {
		const store = makeStore({ claimResult: { rowCount: 0, totalTokens: 0 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("not-claimable");
	});

	test("not-claimable carries the same submittedAs for single form", async () => {
		const store = makeStore({ claimResult: { rowCount: 0, totalTokens: 0 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("not-claimable");
		expect((outcome as Extract<ClaimOutcome, { kind: "not-claimable" }>).submittedAs).toBe(
			"single",
		);
	});

	test("not-claimable carries the same submittedAs for set form", async () => {
		const store = makeStore({ claimResult: { rowCount: 0, totalTokens: 0 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [
				{ toolCallId: STEP_A, decision: "approve" },
				{ toolCallId: STEP_B, decision: "reject" },
			],
			submittedAs: "set",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("not-claimable");
		expect((outcome as Extract<ClaimOutcome, { kind: "not-claimable" }>).submittedAs).toBe("set");
	});

	test("returns budget-exceeded when totalTokens >= budget (rows are consumed)", async () => {
		const store = makeStore({ claimResult: { rowCount: 2, totalTokens: DEFAULT_BUDGET } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [
				{ toolCallId: STEP_A, decision: "approve" },
				{ toolCallId: STEP_B, decision: "approve" },
			],
			submittedAs: "set",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("budget-exceeded");
	});

	test("budget-exceeded still commits the claim (consumed_at set, rows not reversed)", async () => {
		// The spec: when budget is exceeded, the rows are consumed (not rolled back).
		// We verify claimPending was called and the outcome is budget-exceeded, not not-claimable.
		const store = makeStore({ claimResult: { rowCount: 1, totalTokens: DEFAULT_BUDGET + 1 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(store.claimPending).toHaveBeenCalled();
		expect(outcome.kind).toBe("budget-exceeded");
	});

	test("budget not exceeded when totalTokens is just below the limit", async () => {
		const store = makeStore({ claimResult: { rowCount: 1, totalTokens: DEFAULT_BUDGET - 1 } });
		const outcome = await claimApprovalTargets({
			jobId: JOB_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			submittedAs: "single",
			store,
			budget: DEFAULT_BUDGET,
			at: AT,
		});
		expect(outcome.kind).toBe("claimed");
	});
});

/* -------------------------------------------------------------------------- */
/* recordApprovalDecisions                                                     */
/* -------------------------------------------------------------------------- */

describe("recordApprovalDecisions — single fail-soft audit firing point (D4, R8.1–R8.6)", () => {
	const mockAudit = { record: vi.fn() };
	const mockLogger: Logger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("records with tool='approval:decision'", async () => {
		mockAudit.record.mockResolvedValue(undefined);
		await recordApprovalDecisions({
			jobId: JOB_ID,
			callerId: CALLER_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve", args: { to: "x@example.com" } }],
			audit: mockAudit,
			logger: mockLogger,
			now: () => AT,
		});
		expect(mockAudit.record).toHaveBeenCalledWith(
			expect.objectContaining({ tool: "approval:decision" }),
		);
	});

	test("records args as masked key names only — never values (R4.7, R8.1)", async () => {
		mockAudit.record.mockResolvedValue(undefined);
		await recordApprovalDecisions({
			jobId: JOB_ID,
			callerId: CALLER_ID,
			decisions: [
				{ toolCallId: STEP_A, decision: "approve", args: { recipient: "alice@example.com" } },
			],
			audit: mockAudit,
			logger: mockLogger,
			now: () => AT,
		});
		const entry = mockAudit.record.mock.calls[0]?.[0];
		// args in audit entry must be the masked structure, never the raw value
		expect(JSON.stringify(entry?.args)).not.toContain("alice@example.com");
		expect(JSON.stringify(entry?.args)).toContain("editedArgKeys");
	});

	test("includes callerId as userId and jobId in the audit entry (R8.6)", async () => {
		mockAudit.record.mockResolvedValue(undefined);
		await recordApprovalDecisions({
			jobId: JOB_ID,
			callerId: CALLER_ID,
			decisions: [{ toolCallId: STEP_A, decision: "approve" }],
			audit: mockAudit,
			logger: mockLogger,
			now: () => AT,
		});
		expect(mockAudit.record).toHaveBeenCalledWith(
			expect.objectContaining({ userId: CALLER_ID, jobId: JOB_ID }),
		);
	});

	test("does NOT throw and returns successfully when audit sink fails (fail-soft, R8.3)", async () => {
		mockAudit.record.mockRejectedValue(new Error("DB is down"));
		await expect(
			recordApprovalDecisions({
				jobId: JOB_ID,
				callerId: CALLER_ID,
				decisions: [{ toolCallId: STEP_A, decision: "approve" }],
				audit: mockAudit,
				logger: mockLogger,
				now: () => AT,
			}),
		).resolves.not.toThrow();
	});

	test("logs error with correlation only (no raw args) when audit sink fails (R4.7, R8.4)", async () => {
		mockAudit.record.mockRejectedValue(new Error("store failure"));
		const decisions = [
			{ toolCallId: STEP_A, decision: "approve" as const, args: { secret: "sssh" } },
		];
		await recordApprovalDecisions({
			jobId: JOB_ID,
			callerId: CALLER_ID,
			decisions,
			audit: mockAudit,
			logger: mockLogger,
			now: () => AT,
		});
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
		const [, fields] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls[0];
		// correlation fields must be present
		expect(fields).toMatchObject({ jobId: JOB_ID, stepId: STEP_A });
		// raw args values must NOT appear in the log fields
		expect(JSON.stringify(fields)).not.toContain("sssh");
	});

	test("is a no-op when audit is undefined (no throw)", async () => {
		await expect(
			recordApprovalDecisions({
				jobId: JOB_ID,
				callerId: CALLER_ID,
				decisions: [{ toolCallId: STEP_A, decision: "approve" }],
				audit: undefined,
				logger: mockLogger,
				now: () => AT,
			}),
		).resolves.not.toThrow();
	});
});
