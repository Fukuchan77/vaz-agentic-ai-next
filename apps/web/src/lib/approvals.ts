import type { AuditSink, Logger } from "@vaz/schemas/deps";
import { parseAiEnv } from "@vaz/schemas/env";
import type { ApprovalDecision, ApprovalRequest } from "@vaz/schemas/workflows";
import type { JobStepStore } from "@vaz/worker/src/stores";

/**
 * Approval decision logic for `POST /api/jobs/:id/approve` (Task 9, C-8).
 *
 * Six pure-function utilities that implement the defence-in-depth properties
 * required by spec §7.3:
 *
 *   D2 — consume-once + existence concealment (`claimApprovalTargets`)
 *   D3 — cross-boundary usage budget (`resolveJobTokenBudget`, `claimApprovalTargets`)
 *   D4 — masked audit + single fail-soft boundary (`recordApprovalDecisions`)
 *   D5 — pending-set atomicity (`claimApprovalTargets` via `JobStepStore.claimPending`)
 *
 * This module is a pure-function layer:
 * - no HTTP framework types (kept testable and framework-agnostic)
 * - no `new Date()` calls (clock injected via `now`)
 * - no direct DB access (Drizzle port injected via `store`)
 *
 * The route in `apps/web/src/app/api/jobs/[id]/approve/route.ts` (Task 10)
 * wires these together with the request lifecycle.
 *
 * ADR-3: deps-closure pattern. All external concerns are injected so every
 * unit here is testable without network, DB, or clock mocking.
 *
 * R4.7 privacy: `maskedArgKeys` ensures args values never enter logger output.
 * R8.5: the existing tool-execution audit path (`@vaz/agents`'s audit-hook) is
 * unchanged; fail-soft applies ONLY to the approval-decision boundary here.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Internal normalised form shared between all pure helpers.
 * `submittedAs` preserves the original request shape for response routing
 * (single → 404/202, set → 409/202 — Task 10 produces the HTTP responses).
 */
export interface NormalizedApprovalRequest {
	decisions: ApprovalDecision[];
	submittedAs: "single" | "set";
}

/**
 * Discriminated union from `claimApprovalTargets`.
 *
 * Existence concealment (D2, R6.2, R6.4): the three unclaimable sub-cases
 * (unknown / in-flight / consumed) are intentionally collapsed into a
 * single `not-claimable` variant. The caller MUST NOT distinguish them —
 * mapping them to different HTTP responses would reveal job state to callers
 * who are not the job owner.
 */
export type ClaimOutcome =
	| { kind: "claimed"; decisions: ApprovalDecision[] }
	| { kind: "not-claimable"; submittedAs: "single" | "set" }
	| { kind: "budget-exceeded" };

/* -------------------------------------------------------------------------- */
/* normalizeApprovalRequest                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fold an `ApprovalRequest` (single or set form) into the uniform internal
 * shape used by all subsequent pure helpers.
 *
 * - Single form `{ toolCallId, decision, args? }` → 1-element decisions array,
 *   `submittedAs: "single"`.
 * - Set form `{ decisions: [...] }` → decisions array unchanged,
 *   `submittedAs: "set"`.
 */
export function normalizeApprovalRequest(body: ApprovalRequest): NormalizedApprovalRequest {
	if ("decisions" in body) {
		return { decisions: body.decisions, submittedAs: "set" };
	}
	return {
		decisions: [{ toolCallId: body.toolCallId, decision: body.decision, args: body.args }],
		submittedAs: "single",
	};
}

/* -------------------------------------------------------------------------- */
/* findDuplicateTarget                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Detect a duplicate `toolCallId` within a decision set (R9.3, D5).
 *
 * Called before any DB access so a malformed set is rejected cheaply,
 * without consuming any pending rows in the DB.
 *
 * Returns the first duplicated `toolCallId`, or `null` if all are distinct.
 */
export function findDuplicateTarget(decisions: ApprovalDecision[]): string | null {
	const seen = new Set<string>();
	for (const d of decisions) {
		if (seen.has(d.toolCallId)) return d.toolCallId;
		seen.add(d.toolCallId);
	}
	return null;
}

/* -------------------------------------------------------------------------- */
/* maskedArgKeys                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Return the **key names** of an `args` object, never the values (R4.7 / D4).
 *
 * Used in `recordApprovalDecisions` to produce audit records that contain
 * which fields were edited, but not what they were edited to.  This satisfies
 * R8.1 (key names only) and prevents the privacy contract (R4.7) from being
 * violated by audit log entries.
 */
export function maskedArgKeys(args: unknown): string[] {
	if (args === null || args === undefined || typeof args !== "object" || Array.isArray(args)) {
		return [];
	}
	return Object.keys(args as Record<string, unknown>);
}

/* -------------------------------------------------------------------------- */
/* resolveJobTokenBudget                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Read `JOB_TOKEN_BUDGET` from `env`, returning the parsed positive integer
 * (default 200 000 when unset).  Delegates to `parseAiEnv` so the coerce /
 * positive-int / default logic lives in one place (R7.4, C-10).
 *
 * Throws when the env value is invalid (zero, negative, non-numeric).
 */
export function resolveJobTokenBudget(
	env: Record<string, string | undefined> = process.env,
): number {
	return parseAiEnv(env).JOB_TOKEN_BUDGET;
}

/* -------------------------------------------------------------------------- */
/* claimApprovalTargets                                                        */
/* -------------------------------------------------------------------------- */

/** Options for {@link claimApprovalTargets}. */
export interface ClaimApprovalTargetsOptions {
	jobId: string;
	decisions: ApprovalDecision[];
	submittedAs: "single" | "set";
	store: JobStepStore;
	budget: number;
	at: Date;
}

/**
 * Atomically consume the pending approval targets for `jobId` and return the
 * outcome (D2 / D3 / D5).
 *
 * A single `store.claimPending` call, given the requested `stepIds`
 * (`decisions.map(d => d.toolCallId)`), performs all three of:
 *   1. the cumulative-token read (budget gate — D3, R7.1–R7.3),
 *   2. the conditional, all-or-nothing UPDATE from `pending` → `consumed`
 *      across the whole requested set (consume-once + pending-set atomicity
 *      — D2/D5, R6.1/9.2/9.6), and
 *   3. the mismatch check ("did every requested stepId match a pending row").
 *
 * Decision tree:
 *   - `rowCount !== decisions.length` → `not-claimable` (existence concealed
 *     — R6.2/6.4; covers "zero pending" AND "some but not all pending" alike,
 *     so a caller can never learn *which* target in a mixed set was invalid).
 *   - `totalTokens >= budget` → `budget-exceeded`; rows remain consumed (R7.3).
 *   - Otherwise → `claimed`.
 *
 * IMPORTANT: the rows are ALWAYS consumed when the full set matched, even
 * when the budget is exceeded. This prevents a caller from circumventing the
 * budget by resending the same approval after a 429 response.
 *
 * The `rowCount !== decisions.length` comparison (rather than `rowCount ===
 * 0`) is deliberate defense-in-depth: `store.claimPending` itself already
 * rolls back to a partial `rowCount` on any mismatch (never silently reports
 * a full claim), but this pure function does not assume that guarantee holds
 * — it re-derives "fully claimed" from first principles.
 */
export async function claimApprovalTargets(
	options: ClaimApprovalTargetsOptions,
): Promise<ClaimOutcome> {
	const { jobId, decisions, submittedAs, store, budget, at } = options;

	const stepIds = decisions.map((d) => d.toolCallId);
	const { rowCount, totalTokens } = await store.claimPending(jobId, stepIds, at);

	if (rowCount !== decisions.length) {
		return { kind: "not-claimable", submittedAs };
	}

	if (totalTokens >= budget) {
		// Rows already consumed (committed inside claimPending's transaction).
		// Do NOT reverse the consume — the spec requires the rows stay consumed
		// so a retry cannot bypass the budget gate (R7.3, D3).
		return { kind: "budget-exceeded" };
	}

	return { kind: "claimed", decisions };
}

/* -------------------------------------------------------------------------- */
/* recordApprovalDecisions                                                     */
/* -------------------------------------------------------------------------- */

/** Options for {@link recordApprovalDecisions}. */
export interface RecordApprovalDecisionsOptions {
	jobId: string;
	callerId: string;
	decisions: ApprovalDecision[];
	audit: AuditSink | undefined;
	logger: Logger;
	now: () => Date;
}

/**
 * Single fail-soft audit firing point for the approval path (D4, R8.1–R8.6).
 *
 * Records one `AuditEntry` per decision with:
 *   - `tool: "approval:decision"`
 *   - `args: { stepId, decision, editedArgKeys }` — key names only, never values (R8.1)
 *   - `userId: callerId` and `jobId` for traceability (R8.6)
 *
 * Fail-soft behaviour (R8.3): if the audit sink throws, the error is
 * swallowed after logging correlation fields only (jobId / stepId /
 * error.message — never raw args values, R8.4).  The caller proceeds as if
 * the audit succeeded.
 *
 * R8.5 reminder: the existing tool-execution audit path (fired from
 * `@vaz/agents`'s audit-hook at `packages/agents/src/audit-hook.ts`) is
 * UNCHANGED and remains fail-loud.  Fail-soft applies only to this boundary.
 *
 * No-op when `audit` is undefined (Phase 1 compatibility).
 */
export async function recordApprovalDecisions(
	options: RecordApprovalDecisionsOptions,
): Promise<void> {
	const { jobId, callerId, decisions, audit, logger, now } = options;
	if (!audit) return;

	for (const d of decisions) {
		try {
			await audit.record({
				userId: callerId,
				jobId,
				tool: "approval:decision",
				args: {
					stepId: d.toolCallId,
					decision: d.decision,
					editedArgKeys: maskedArgKeys(d.args),
				},
				ts: now(),
			});
		} catch (error) {
			// Fail-soft: log correlation only (never raw args values — R4.7/R8.4),
			// then continue so the approval resume is not blocked by an audit failure.
			logger.error("Failed to record approval decision to audit log", {
				jobId,
				stepId: d.toolCallId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
