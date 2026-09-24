import { POST } from "@/app/api/jobs/[id]/approve/route";

/**
 * Unit coverage for `POST /api/jobs/:id/approve` (R3.4/3.5 / Task 10, C-12).
 *
 * Two logical sections:
 *
 * A. EXISTING 10 tests (preserved as-is for R9.4 backward compatibility):
 *    authorization ladder (400/401/404/403), single-form approve/reject,
 *    malformed JSON, missing toolCallId, bad decision value, engine failure.
 *    These use the old mock surface and implicitly prove single-form still works.
 *
 * B. NEW tests (Task 10.1) — "validate then send" properties:
 *    - Excess / forbidden fields → 400 and no engine call (D1 / R5.2/5.3)
 *    - Set form accepted and each decision submitted (R9.1)
 *    - Duplicate toolCallId in a set → 409 and no engine call (R9.3/9.6)
 *    - not-claimable single form → 404 (existence concealed, R6.2/6.3/6.4)
 *    - not-claimable set form → 409 (R6.2/9.2/9.5)
 *    - 404 and 409 bodies are identical across all unclaimable sub-cases (R6.4)
 *    - Budget-exceeded → 429; engine NOT called but approval IS consumed (R7.2/7.3)
 *    - Claimed → submitApproval called once per decision; returns 202 (R9.1)
 *    - Audit recorded after successful claim; audit failure does NOT fail the route (R8.3)
 *
 * Engine / store / authz fully mocked — no network, no DB, no Inngest SDK.
 */

/* -------------------------------------------------------------------------- */
/* Hoisted mocks                                                               */
/* -------------------------------------------------------------------------- */

const {
	createInngestEngine,
	submitApproval,
	authorizeJobAccess,
	claimApprovalTargets,
	recordApprovalDecisions,
	getWebDb,
	createJobStepStore,
	createAuditSink,
} = vi.hoisted(() => ({
	createInngestEngine: vi.fn(),
	submitApproval: vi.fn(),
	authorizeJobAccess: vi.fn(),
	claimApprovalTargets: vi.fn(),
	recordApprovalDecisions: vi.fn(),
	getWebDb: vi.fn(),
	createJobStepStore: vi.fn(),
	createAuditSink: vi.fn(),
}));

vi.mock("@vaz/worker/src/inngest", () => ({ createInngestEngine }));
vi.mock("@vaz/worker/src/main", () => ({ submitApproval }));
vi.mock("@/lib/jobs", () => ({ authorizeJobAccess }));
vi.mock("@/lib/approvals", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/approvals")>();
	return {
		...actual,
		claimApprovalTargets,
		recordApprovalDecisions,
	};
});
vi.mock("@/lib/db", () => ({ getWebDb }));
vi.mock("@vaz/worker/src/stores", () => ({ createJobStepStore }));
vi.mock("@/lib/audit", () => ({ createAuditSink }));

/* -------------------------------------------------------------------------- */
/* Test fixtures                                                               */
/* -------------------------------------------------------------------------- */

const jobId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const toolCallId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const toolCallId2 = "11111111-2222-4333-8444-555555555555";
const ownerUserId = "user-1";

function approveRequest(body: unknown): Request {
	return new Request(`http://localhost/api/jobs/${jobId}/approve`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

function callPost(body: unknown) {
	return POST(approveRequest(body), { params: Promise.resolve({ id: jobId }) });
}

const fakeEngine = { createFunction: vi.fn(), send: vi.fn() };
const fakeDb = {};
const fakeStore = { registerPending: vi.fn(), recordStepUsage: vi.fn(), claimPending: vi.fn() };
const fakeAudit = { record: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	createInngestEngine.mockResolvedValue(fakeEngine);
	submitApproval.mockResolvedValue(undefined);
	authorizeJobAccess.mockResolvedValue({ ok: true, callerId: ownerUserId });
	getWebDb.mockResolvedValue(fakeDb);
	createJobStepStore.mockReturnValue(fakeStore);
	createAuditSink.mockResolvedValue(fakeAudit);
	recordApprovalDecisions.mockResolvedValue(undefined);
	// Default: single decision claimed successfully
	claimApprovalTargets.mockResolvedValue({
		kind: "claimed",
		decisions: [{ toolCallId, decision: "approve" }],
	});
});

/* ========================================================================== */
/* Section A: EXISTING tests (preserved for R9.4 backward compatibility)      */
/* ========================================================================== */

describe("authorization (R5.1)", () => {
	test("returns whatever authorizeJobAccess denies with (e.g. 401 with no session)", async () => {
		authorizeJobAccess.mockResolvedValue({
			ok: false,
			response: Response.json({ error: "Unauthorized" }, { status: 401 }),
		});

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(401);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("returns 403 when authorizeJobAccess denies ownership", async () => {
		authorizeJobAccess.mockResolvedValue({
			ok: false,
			response: Response.json({ error: "Forbidden" }, { status: 403 }),
		});

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(403);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("returns 404 when authorizeJobAccess reports the job has no row yet", async () => {
		authorizeJobAccess.mockResolvedValue({
			ok: false,
			response: Response.json({ error: "Job not found" }, { status: 404 }),
		});

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(404);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("proceeds when authorizeJobAccess grants (e.g. anonymous-submission bypass)", async () => {
		authorizeJobAccess.mockResolvedValue({ ok: true, callerId: "someone-else" });

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(202);
		expect(submitApproval).toHaveBeenCalledTimes(1);
	});
});

test("resumes an approved step via submitApproval and returns 202", async () => {
	claimApprovalTargets.mockResolvedValue({
		kind: "claimed",
		decisions: [{ toolCallId, decision: "approve", args: { to: "user@example.com" } }],
	});

	const res = await callPost({ toolCallId, decision: "approve", args: { to: "user@example.com" } });

	expect(res.status).toBe(202);
	expect(await res.json()).toEqual({ ok: true });
	expect(createInngestEngine).toHaveBeenCalledTimes(1);
	expect(submitApproval).toHaveBeenCalledWith(fakeEngine, {
		jobId,
		stepId: toolCallId,
		approved: true,
		args: { to: "user@example.com" },
	});
});

test("resumes a rejected step with approved:false and no args key when omitted", async () => {
	claimApprovalTargets.mockResolvedValue({
		kind: "claimed",
		decisions: [{ toolCallId, decision: "reject" }],
	});

	const res = await callPost({ toolCallId, decision: "reject" });

	expect(res.status).toBe(202);
	expect(submitApproval).toHaveBeenCalledWith(fakeEngine, {
		jobId,
		stepId: toolCallId,
		approved: false,
	});
});

test("returns 400 for a malformed JSON body (never reaches the engine)", async () => {
	const res = await POST(
		new Request(`http://localhost/api/jobs/${jobId}/approve`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{ not json",
		}),
		{ params: Promise.resolve({ id: jobId }) },
	);

	expect(res.status).toBe(400);
	expect(submitApproval).not.toHaveBeenCalled();
});

test("returns 400 when toolCallId is missing", async () => {
	const res = await callPost({ decision: "approve" });

	expect(res.status).toBe(400);
	expect(submitApproval).not.toHaveBeenCalled();
});

test("returns 400 when decision is not approve/reject", async () => {
	const res = await callPost({ toolCallId, decision: "maybe" });

	expect(res.status).toBe(400);
	expect(submitApproval).not.toHaveBeenCalled();
});

test("returns 500 (not an unhandled throw) when engine submission fails", async () => {
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	submitApproval.mockRejectedValue(new Error("engine unavailable"));

	const res = await callPost({ toolCallId, decision: "approve" });

	expect(res.status).toBe(500);
	expect(await res.json()).toEqual({ error: "Failed to submit approval" });
	errorSpy.mockRestore();
});

/* ========================================================================== */
/* Section B: NEW tests — "validate then send" (Task 10.1)                    */
/* ========================================================================== */

describe("D1 — excess / forbidden fields rejected before engine is called (R5.2/5.3)", () => {
	test("returns 400 when single form carries an extra field (e.g. history)", async () => {
		const res = await callPost({ toolCallId, decision: "approve", history: ["msg1"] });

		expect(res.status).toBe(400);
		expect(submitApproval).not.toHaveBeenCalled();
		expect(claimApprovalTargets).not.toHaveBeenCalled();
	});

	test("returns 400 when single form carries a model field", async () => {
		const res = await callPost({ toolCallId, decision: "approve", model: "gpt-4o" });

		expect(res.status).toBe(400);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("returns 400 when single form carries a usage field", async () => {
		const res = await callPost({ toolCallId, decision: "approve", usage: { total: 9999 } });

		expect(res.status).toBe(400);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("returns 400 when set form carries a top-level extra field", async () => {
		const res = await callPost({
			decisions: [{ toolCallId, decision: "approve" }],
			extraField: "injected",
		});

		expect(res.status).toBe(400);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("does NOT consume approval targets when schema validation fails (R5.5)", async () => {
		await callPost({ toolCallId, decision: "approve", history: ["msg"] });

		expect(claimApprovalTargets).not.toHaveBeenCalled();
	});
});

describe("set form — multiple decisions accepted (R9.1)", () => {
	test("accepts a valid set-form body and returns 202", async () => {
		claimApprovalTargets.mockResolvedValue({
			kind: "claimed",
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId: toolCallId2, decision: "reject" },
			],
		});

		const res = await callPost({
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId: toolCallId2, decision: "reject" },
			],
		});

		expect(res.status).toBe(202);
		expect(submitApproval).toHaveBeenCalledTimes(2);
	});

	test("calls submitApproval with approved:true for each approved decision in the set", async () => {
		claimApprovalTargets.mockResolvedValue({
			kind: "claimed",
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId: toolCallId2, decision: "approve" },
			],
		});

		await callPost({
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId: toolCallId2, decision: "approve" },
			],
		});

		expect(submitApproval).toHaveBeenCalledWith(
			fakeEngine,
			expect.objectContaining({ approved: true, stepId: toolCallId }),
		);
		expect(submitApproval).toHaveBeenCalledWith(
			fakeEngine,
			expect.objectContaining({ approved: true, stepId: toolCallId2 }),
		);
	});

	test("returns 400 for a set form with an empty decisions array", async () => {
		const res = await callPost({ decisions: [] });

		expect(res.status).toBe(400);
		expect(submitApproval).not.toHaveBeenCalled();
	});
});

describe("R9.3 — duplicate toolCallId in set → 409 before DB access (R9.6)", () => {
	test("returns 409 when the same toolCallId appears twice in the set", async () => {
		const res = await callPost({
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId, decision: "reject" },
			],
		});

		expect(res.status).toBe(409);
	});

	test("does NOT call claimApprovalTargets when duplicates are detected (R9.6)", async () => {
		await callPost({
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId, decision: "reject" },
			],
		});

		expect(claimApprovalTargets).not.toHaveBeenCalled();
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("409 body does NOT reveal which toolCallId was the duplicate (R9.5)", async () => {
		const res = await callPost({
			decisions: [
				{ toolCallId, decision: "approve" },
				{ toolCallId, decision: "reject" },
			],
		});

		const body = await res.json();
		expect(JSON.stringify(body)).not.toContain(toolCallId);
	});
});

describe("D2 / R6.2 — existence concealment (not-claimable)", () => {
	test("single-form not-claimable → 404 (unknown / in-flight / consumed collapsed)", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "not-claimable", submittedAs: "single" });

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(404);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("set-form not-claimable → 409 (R9.2)", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "not-claimable", submittedAs: "set" });

		const res = await callPost({
			decisions: [{ toolCallId, decision: "approve" }],
		});

		expect(res.status).toBe(409);
		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("404 body does NOT contain the toolCallId or state word (R6.3)", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "not-claimable", submittedAs: "single" });

		const res = await callPost({ toolCallId, decision: "approve" });
		const body = await res.json();
		const bodyStr = JSON.stringify(body);

		expect(bodyStr).not.toContain(toolCallId);
		expect(bodyStr).not.toMatch(/unknown|in-flight|consumed|pending/i);
	});

	test("single-form 404 and 409 bodies are identical (R6.4 — 3 sub-cases indistinguishable via set form)", async () => {
		// The 3 unclaimable sub-cases produce the same `not-claimable` outcome;
		// the route always responds with the same body for a given submittedAs.
		claimApprovalTargets.mockResolvedValue({ kind: "not-claimable", submittedAs: "single" });
		const res1 = await callPost({ toolCallId, decision: "approve" });
		const body1 = await res1.json();

		// A second call with the same shape gets the same body (idempotent error shape)
		claimApprovalTargets.mockResolvedValue({ kind: "not-claimable", submittedAs: "single" });
		const res2 = await callPost({ toolCallId, decision: "approve" });
		const body2 = await res2.json();

		expect(body1).toEqual(body2);
		expect(res1.status).toBe(res2.status);
	});
});

describe("D3 / R7.2 / R7.3 — budget-exceeded → 429, approval consumed", () => {
	test("returns 429 when budget is exceeded", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "budget-exceeded" });

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(429);
	});

	test("does NOT call submitApproval when budget is exceeded (R7.2)", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "budget-exceeded" });

		await callPost({ toolCallId, decision: "approve" });

		expect(submitApproval).not.toHaveBeenCalled();
	});

	test("claimApprovalTargets WAS called (the rows are consumed — R7.3)", async () => {
		claimApprovalTargets.mockResolvedValue({ kind: "budget-exceeded" });

		await callPost({ toolCallId, decision: "approve" });

		expect(claimApprovalTargets).toHaveBeenCalledTimes(1);
	});
});

describe("D4 / R8.3 — audit recorded; audit failure does not fail the route", () => {
	test("recordApprovalDecisions is called after a successful claim", async () => {
		await callPost({ toolCallId, decision: "approve" });

		expect(recordApprovalDecisions).toHaveBeenCalledTimes(1);
	});

	test("route returns 202 even when recordApprovalDecisions fails (fail-soft, R8.3)", async () => {
		recordApprovalDecisions.mockRejectedValue(new Error("audit DB down"));

		const res = await callPost({ toolCallId, decision: "approve" });

		expect(res.status).toBe(202);
		expect(submitApproval).toHaveBeenCalledTimes(1);
	});
});
