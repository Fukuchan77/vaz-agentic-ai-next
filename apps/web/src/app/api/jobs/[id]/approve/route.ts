import { createConsoleLogger } from "@vaz/config/logger";
import { approvalRequestSchema } from "@vaz/schemas/workflows";
import { createInngestEngine } from "@vaz/worker/src/inngest";
import { type ApprovalSignal, type DurableEngine, submitApproval } from "@vaz/worker/src/main";
import { createJobStepStore } from "@vaz/worker/src/stores";
import {
	claimApprovalTargets,
	findDuplicateTarget,
	normalizeApprovalRequest,
	recordApprovalDecisions,
	resolveJobTokenBudget,
} from "@/lib/approvals";
import { createAuditSink } from "@/lib/audit";
import { getWebDb } from "@/lib/db";
import { authorizeJobAccess } from "@/lib/jobs";

/**
 * `POST /api/jobs/:id/approve` — validate an approval decision and, only after
 * the pending targets are atomically consumed, resume the suspended workflow
 * step(s) (C-12, D1–D5, Tasks 9/10).
 *
 * **Policy change from "fire-and-forget" to "validate then send"** (ADR-1 record):
 * The previous implementation parsed the body and called `submitApproval` in one
 * step, with no consume-once enforcement, no budget gate, and no masked audit.
 * This route now follows the sequence: authorise → parse (strict schema) →
 * normalise → dup-check → claim → audit (fail-soft) → submit, so that:
 *
 *   D1 (R5.2): extra fields (history / usage / model) are rejected by the
 *              schema before any DB access — the `approvalRequestSchema` union
 *              uses `z.strictObject` on both branches.
 *   D2 (R6.2): three unclaimable sub-cases (unknown / in-flight / consumed)
 *              produce a single `not-claimable` outcome and a single response
 *              body — the caller cannot tell them apart.
 *   D3 (R7.2): `claimApprovalTargets` reads the cumulative token spend and
 *              checks it against `JOB_TOKEN_BUDGET` inside the same DB
 *              transaction as the consume — a budget-exceeded caller gets 429
 *              and the targets remain consumed (R7.3).
 *   D4 (R8.1): edited `args` are masked to key names only in the audit record;
 *              a failing audit sink does NOT block the resume (fail-soft, R8.3).
 *   D5 (R9.3): duplicate `toolCallId` entries in a set are detected before any
 *              DB access and rejected with 409.
 *
 * The Inngest-engine `submitApproval` is called exactly once per decision in the
 * claimed set — its `id: "<jobId>:<stepId>"` ensures idempotency on engine-side
 * retries (R6.1, Task 8).
 *
 * AUTHORIZATION (R5.1): delegated to `@/lib/jobs`'s `authorizeJobAccess`,
 * shared with the stream route — 400/401/404/403 in that order.
 *
 * BACKWARD COMPATIBILITY (R9.4): the single-decision form
 * (`{ toolCallId, decision, args? }`) is still accepted — it is the first branch
 * of the `approvalRequestSchema` union. The `ApprovalPanel` UI sends this form
 * unchanged.
 */

/** Opaque response body for any unclaimable outcome (R6.3 / R9.5). */
const NOT_CLAIMABLE_BODY = { error: "Approval target not available" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: jobId } = await params;
	const authz = await authorizeJobAccess(jobId);
	if (!authz.ok) return authz.response;
	const { callerId } = authz;

	// --- parse body -----------------------------------------------------------
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
	}

	// D1: `approvalRequestSchema` uses z.strictObject on both branches;
	// any excess field (history / usage / model / …) → 400 before DB access.
	const parsed = approvalRequestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "Invalid approval request" }, { status: 400 });
	}

	// --- normalise → dup-check -----------------------------------------------
	const { decisions, submittedAs } = normalizeApprovalRequest(parsed.data);

	// D5: duplicate toolCallId in a set → 409 before any DB access (R9.3/9.6)
	if (findDuplicateTarget(decisions) !== null) {
		return Response.json({ error: "Approval target conflict" }, { status: 409 });
	}

	// --- build injected deps -------------------------------------------------
	// The consume-once gate requires the DB; if the DB is unavailable the route
	// fails with 500 (unlike the chat route which is fail-soft — a missing DB
	// must not silently allow an unguarded resume).
	const logger = createConsoleLogger();
	let store: ReturnType<typeof createJobStepStore> | undefined;
	let audit: Awaited<ReturnType<typeof createAuditSink>> | undefined;
	try {
		const db = await getWebDb();
		store = createJobStepStore(db);
		audit = await createAuditSink({ db, logger, now: () => new Date() });
	} catch (error) {
		logger.error("Failed to build approval store", {
			jobId,
			error: error instanceof Error ? error.message : String(error),
		});
		return Response.json({ error: "Service unavailable" }, { status: 500 });
	}

	// --- claim (consume-once + budget gate) -----------------------------------
	const budget = resolveJobTokenBudget();
	const outcome = await claimApprovalTargets({
		jobId,
		decisions,
		submittedAs,
		store,
		budget,
		at: new Date(),
	});

	switch (outcome.kind) {
		case "not-claimable":
			// D2: all 3 sub-cases (unknown / in-flight / consumed) → same body, same status
			return Response.json(NOT_CLAIMABLE_BODY, {
				status: submittedAs === "single" ? 404 : 409,
			});
		case "budget-exceeded":
			// D3 / R7.2: rows already consumed (R7.3); 429 signals caller to stop
			return Response.json({ error: "Token budget exceeded" }, { status: 429 });
		case "claimed":
			break;
	}

	// --- audit (fail-soft, D4 / R8.1) ----------------------------------------
	// Wrapped in try/catch at the caller level as well, though recordApprovalDecisions
	// itself is already fail-soft — belt-and-suspenders so the route never 500s here.
	try {
		await recordApprovalDecisions({
			jobId,
			callerId,
			decisions: outcome.decisions,
			audit,
			logger,
			now: () => new Date(),
		});
	} catch {
		// Audit failure must not block the resume (R8.3).
	}

	// --- submit each decision to the durable engine --------------------------
	try {
		const engine = (await createInngestEngine()) as unknown as DurableEngine;
		for (const d of outcome.decisions) {
			const signal: ApprovalSignal = {
				jobId,
				stepId: d.toolCallId,
				approved: d.decision === "approve",
				...(d.args !== undefined ? { args: d.args } : {}),
			};
			await submitApproval(engine, signal);
		}
	} catch (error) {
		console.error("Failed to submit approval", error);
		return Response.json({ error: "Failed to submit approval" }, { status: 500 });
	}

	return Response.json({ ok: true }, { status: 202 });
}
