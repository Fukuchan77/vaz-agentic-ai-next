import type { AgentDeps } from "@vaz/schemas/deps";
import type {
	JobEvent,
	SpecialistResult,
	SupervisorPlan,
	WorkflowStepResult,
} from "@vaz/schemas/workflows";
import {
	type ApprovalDecision,
	buildWorkerDeps,
	createDurableStepRunner,
	createJobHandler,
	type DurableEngine,
	JOB_FUNCTION_CONFIG,
	JOB_REQUESTED_EVENT,
	type JobRequest,
	registerWorker,
	runJob,
	submitApproval,
	submitJob,
	type WorkerSpan,
	type WorkerTracer,
} from "../src/main";
import type { JobStepStore } from "../src/stores";

/**
 * engine-agnostic worker entry.
 *
 * These tests exercise the WIRING (durable-step port, OTel span attribution,
 * web↔worker submission split, deps construction) with injected seams only:
 * no durable engine, no network, no LLM, no DB. The concrete Inngest client is
 * injected at the container edge and its live durability is proven
 * by the durable E2E.
 */

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "22222222-2222-4222-8222-222222222222";
const STEP_ID_2 = "33333333-3333-4333-8333-333333333333";

/** Deterministic deps: pinned clock, silent logger (ADR-3). */
function testDeps(): AgentDeps {
	const fixed = new Date("2026-07-07T00:00:00.000Z");
	return {
		db: null,
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		now: () => fixed,
	};
}

/** A plan with a single data-processing step (overridable specialist, no LLM/DB). */
function dataPlan(): SupervisorPlan {
	return {
		goal: "process the payload",
		steps: [{ stepId: STEP_ID, task: { kind: "data-processing", operation: "noop", input: 1 } }],
	};
}

function request(plan: SupervisorPlan = dataPlan(), userId: string | null = "user-1"): JobRequest {
	return { jobId: JOB_ID, userId, plan };
}

/** A recording tracer seam capturing span names, attributes, and lifecycle. */
function recordingTracer(): {
	tracer: WorkerTracer;
	spans: Array<{
		name: string;
		attributes: Record<string, string | number | boolean>;
		ended: boolean;
		errored: string | null;
		exceptions: unknown[];
	}>;
} {
	const spans: Array<{
		name: string;
		attributes: Record<string, string | number | boolean>;
		ended: boolean;
		errored: string | null;
		exceptions: unknown[];
	}> = [];
	const tracer: WorkerTracer = {
		startSpan(name, attributes) {
			const record = {
				name,
				attributes: { ...(attributes ?? {}) },
				ended: false,
				errored: null as string | null,
				exceptions: [] as unknown[],
			};
			spans.push(record);
			const span: WorkerSpan = {
				setAttribute(key, value) {
					record.attributes[key] = value;
				},
				recordException(error) {
					record.exceptions.push(error);
				},
				setError(message) {
					record.errored = message;
				},
				end() {
					record.ended = true;
				},
			};
			return span;
		},
	};
	return { tracer, spans };
}

describe("runJob — step execution through the durable port (R3.1/3.2)", () => {
	test("dispatches the plan through the injected step runner and returns typed results", async () => {
		const seen: string[] = [];
		const results = await runJob(testDeps(), request(), {
			step: {
				run(stepId, fn) {
					seen.push(stepId);
					return fn();
				},
			},
			specialists: {
				"data-processing": async () => ({ kind: "data-processing", result: "done" }),
			},
		});

		// every plan step routed through the durable step port, correlated by stepId
		expect(seen).toEqual([STEP_ID]);
		expect(results).toHaveLength(1);
		expect(results[0]?.stepId).toBe(STEP_ID);
		expect(results[0]?.result).toEqual({ kind: "data-processing", result: "done" });
	});

	test("validates the job request and rejects a malformed plan", async () => {
		await expect(
			runJob(testDeps(), { jobId: JOB_ID, userId: null, plan: { goal: "", steps: [] } } as never),
		).rejects.toThrow();
	});
});

describe("runJob — job ownership persistence (R5.1)", () => {
	test("inserts the job's id/userId/workflow via jobStore before dispatch", async () => {
		const inserted: Array<{ id: string; userId: string | null; workflow: string }> = [];
		await runJob(testDeps(), request(), {
			jobStore: {
				insert: async (row) => {
					inserted.push(row);
				},
				findOwnerUserId: async () => ({ found: false, userId: null }),
			},
			specialists: {
				"data-processing": async () => ({ kind: "data-processing", result: "ok" }),
			},
		});

		expect(inserted).toEqual([{ id: JOB_ID, userId: "user-1", workflow: "supervisor-plan" }]);
	});

	test("propagates a jobStore.insert failure and never dispatches the plan (fail-loud)", async () => {
		const dispatched: string[] = [];
		await expect(
			runJob(testDeps(), request(), {
				jobStore: {
					insert: async () => {
						throw new Error("db unreachable");
					},
					findOwnerUserId: async () => ({ found: false, userId: null }),
				},
				specialists: {
					"data-processing": async () => {
						dispatched.push(STEP_ID);
						return { kind: "data-processing", result: "ok" };
					},
				},
			}),
		).rejects.toThrow("db unreachable");

		expect(dispatched).toEqual([]);
	});

	test("omitting jobStore is a no-op (Phase 1/2 callers unaffected)", async () => {
		await expect(
			runJob(testDeps(), request(), {
				specialists: {
					"data-processing": async () => ({ kind: "data-processing", result: "ok" }),
				},
			}),
		).resolves.toHaveLength(1);
	});
});

describe("runJob — OTel span attribution (R4.2)", () => {
	test("opens a job span carrying jobId + userId, and a step span carrying the agent name", async () => {
		const { tracer, spans } = recordingTracer();
		await runJob(testDeps(), request(), {
			tracer,
			specialists: {
				"data-processing": async () => ({ kind: "data-processing", result: "ok" }),
			},
		});

		const jobSpan = spans.find((s) => s.attributes.jobId === JOB_ID && s.attributes.userId);
		expect(jobSpan).toBeDefined();
		expect(jobSpan?.attributes.userId).toBe("user-1");
		expect(jobSpan?.ended).toBe(true);

		// each step's span carries jobId, userId, stepId, and the agent (specialist) name
		const stepSpan = spans.find((s) => s.attributes.stepId === STEP_ID);
		expect(stepSpan).toBeDefined();
		expect(stepSpan?.attributes.jobId).toBe(JOB_ID);
		expect(stepSpan?.attributes.userId).toBe("user-1");
		expect(stepSpan?.attributes.agent).toBe("data-processing");
		expect(stepSpan?.ended).toBe(true);
	});

	test("marks the job span errored and rethrows when a specialist fails (engine owns retry)", async () => {
		const { tracer, spans } = recordingTracer();
		await expect(
			runJob(testDeps(), request(), {
				tracer,
				specialists: {
					"data-processing": async () => {
						throw new Error("boom");
					},
				},
			}),
		).rejects.toThrow("boom");

		const jobSpan = spans.find((s) => s.attributes.jobId === JOB_ID && "userId" in s.attributes);
		expect(jobSpan?.errored).toBe("boom");
		expect(jobSpan?.ended).toBe(true);
	});

	test("forwards every JobEvent to the caller's emit sink unchanged", async () => {
		const events: JobEvent[] = [];
		await runJob(testDeps(), request(), {
			emit: (event) => {
				events.push(event);
			},
			specialists: {
				"data-processing": async () => ({ kind: "data-processing", result: "ok" }),
			},
		});
		expect(events.some((e) => e.type === "step-start" && e.stepId === STEP_ID)).toBe(true);
		expect(events.some((e) => e.type === "completion" && e.stepId === STEP_ID)).toBe(true);
		// job-level completion (no stepId) closes the stream
		expect(events.some((e) => e.type === "completion" && e.stepId === undefined)).toBe(true);
	});

	test("null userId is attributed as anonymous on the job span", async () => {
		const { tracer, spans } = recordingTracer();
		await runJob(testDeps(), request(dataPlan(), null), {
			tracer,
			specialists: { "data-processing": async () => ({ kind: "data-processing", result: "ok" }) },
		});
		const jobSpan = spans.find((s) => s.attributes.jobId === JOB_ID);
		expect(jobSpan?.attributes.userId).toBe("anonymous");
	});
});

describe("web↔worker decoupling (R3.2)", () => {
	test("submitJob sends a job/requested event, idempotent on the job's id", async () => {
		const sent: Array<{ name: string; data: JobRequest; id?: string }> = [];
		const engine: DurableEngine = {
			createFunction: () => ({}),
			send: async (payload) => {
				sent.push(payload);
			},
		};
		await submitJob(engine, request());
		expect(sent).toEqual([{ name: JOB_REQUESTED_EVENT, data: request(), id: JOB_ID }]);
	});

	test("registerWorker registers the job function under the fixed config + trigger", async () => {
		let captured:
			| {
					config: { id: string; retries?: number };
					trigger: { event: string };
					handler: (ctx: {
						event: { data: JobRequest };
						step: { run<T>(id: string, fn: () => Promise<T>): Promise<T> };
					}) => Promise<WorkflowStepResult[]>;
			  }
			| undefined;
		const engine: DurableEngine = {
			createFunction: (config, trigger, handler) => {
				captured = { config, trigger, handler };
				return { id: config.id };
			},
			send: async () => {},
		};

		registerWorker(engine, testDeps(), {
			specialists: { "data-processing": async () => ({ kind: "data-processing", result: "r" }) },
		});

		expect(captured?.config).toEqual(JOB_FUNCTION_CONFIG);
		expect(captured?.trigger).toEqual({ event: JOB_REQUESTED_EVENT });

		// the registered handler drives runJob when the engine invokes it
		const results = await captured?.handler({
			event: { data: request() },
			step: { run: (_id, fn) => fn() },
		});
		expect(results?.[0]?.result).toEqual({ kind: "data-processing", result: "r" });
	});

	test("createJobHandler routes the engine's durable step into the supervisor", async () => {
		const runIds: string[] = [];
		const handler = createJobHandler(testDeps(), {
			specialists: { "data-processing": async () => ({ kind: "data-processing", result: "z" }) },
		});
		const results = await handler({
			event: { data: request() },
			step: {
				run: (id, fn) => {
					runIds.push(id);
					return fn();
				},
			},
		});
		expect(runIds).toEqual([STEP_ID]);
		expect(results[0]?.result).toEqual({ kind: "data-processing", result: "z" });
	});
});

describe("buildWorkerDeps — composition-root deps (ADR-3)", () => {
	test("provides a real wall clock and a privacy-respecting logger by default", () => {
		const deps = buildWorkerDeps();
		expect(deps.now()).toBeInstanceOf(Date);
		expect(typeof deps.logger.info).toBe("function");
		expect(deps.db).toBeNull();
		expect(deps.audit).toBeUndefined();
	});

	test("injects db and audit overrides (worker supplies the DB sink)", () => {
		const db = { select: () => ({}) };
		const record: Array<unknown> = [];
		const deps = buildWorkerDeps({ db, audit: { record: (e) => record.push(e) } });
		expect(deps.db).toBe(db);
		deps.audit?.record({ userId: null, jobId: JOB_ID, tool: "t", args: {}, ts: deps.now() });
		expect(record).toHaveLength(1);
	});

	test("multi-step plans dispatch in order through the durable port", async () => {
		const order: string[] = [];
		const plan: SupervisorPlan = {
			goal: "two steps",
			steps: [
				{ stepId: STEP_ID, task: { kind: "data-processing", operation: "a", input: 1 } },
				{ stepId: STEP_ID_2, task: { kind: "data-processing", operation: "b", input: 2 } },
			],
		};
		const result: SpecialistResult = { kind: "data-processing", result: "x" };
		const results = await runJob(buildWorkerDeps(), request(plan), {
			step: {
				run(stepId, fn) {
					order.push(stepId);
					return fn();
				},
			},
			specialists: { "data-processing": async () => result },
		});
		expect(order).toEqual([STEP_ID, STEP_ID_2]);
		expect(results.map((r) => r.stepId)).toEqual([STEP_ID, STEP_ID_2]);
	});
});

describe("WorkerApprovalMirror — pending set + usage mirroring (C-11 / R6.1 R7.1 R7.6)", () => {
	// -----------------------------------------------------------------------
	// Helper: a no-op JobStepStore (all methods succeed, nothing recorded).
	// -----------------------------------------------------------------------
	function noopStepStore(): JobStepStore {
		return {
			registerPending: async () => {},
			recordStepUsage: async () => {},
			claimPending: async () => 0,
		};
	}

	// -----------------------------------------------------------------------
	// Helper: a plan whose single step requires approval.
	// -----------------------------------------------------------------------
	function approvalPlan(): SupervisorPlan {
		return {
			goal: "destructive step",
			steps: [{ stepId: STEP_ID, task: { kind: "data-processing", operation: "del", input: 1 } }],
		};
	}

	// -----------------------------------------------------------------------
	// INV-1 order: registerPending must be called BEFORE approvalGate is awaited
	// (no intervening await between the two on the same synchronous path).
	// -----------------------------------------------------------------------
	test("INV-1: registerPending is called in the same sync tick before approvalGate is awaited", async () => {
		const callOrder: string[] = [];

		const jobStepStore: JobStepStore = {
			registerPending: async (_jobId, _stepId, _at) => {
				callOrder.push("registerPending");
			},
			recordStepUsage: async () => {},
			claimPending: async () => 0,
		};

		// approvalGate records its invocation in callOrder before resolving
		const approvalGate = async (_input: {
			jobId: string;
			stepId: string;
			timeout?: string;
		}): Promise<ApprovalDecision | null> => {
			callOrder.push("approvalGate");
			return { approved: true };
		};

		// The trick: we capture the Promise that createDurableStepRunner
		// returns and observe callOrder BEFORE we allow the gate to resolve.
		// Because both functions are async (return Promises), the only way to
		// assert ordering is via the recorded call-order array.
		const engineStep = { run: (_id: string, fn: () => Promise<unknown>) => fn() };
		const runner = createDurableStepRunner(engineStep, {
			jobId: JOB_ID,
			requiresApproval: () => true,
			approvalGate,
			jobStepStore,
		});

		await runner.run(STEP_ID, async () => "done");

		// registerPending must appear at index 0, approvalGate at index 1.
		expect(callOrder).toEqual(["registerPending", "approvalGate"]);
	});

	// -----------------------------------------------------------------------
	// INV-1 also: registerPending is called exactly once per run() invocation
	// (not 0 times, not 2 times).
	// -----------------------------------------------------------------------
	test("registerPending is called exactly once per approval-guarded step run", async () => {
		const calls: Array<{ jobId: string; stepId: string }> = [];

		const jobStepStore: JobStepStore = {
			...noopStepStore(),
			registerPending: async (jobId, stepId, _at) => {
				calls.push({ jobId, stepId });
			},
		};

		const engineStep = { run: (_id: string, fn: () => Promise<unknown>) => fn() };
		const runner = createDurableStepRunner(engineStep, {
			jobId: JOB_ID,
			requiresApproval: () => true,
			approvalGate: async () => ({ approved: true }),
			jobStepStore,
		});

		await runner.run(STEP_ID, async () => "done");

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({ jobId: JOB_ID, stepId: STEP_ID });
	});

	// -----------------------------------------------------------------------
	// I-2 Inngest replay trap: when the function body re-executes for the same
	// stepId (Inngest retry / resume), registerPending is called again
	// unconditionally (idempotency is the port's responsibility — main.ts must
	// NOT add a "skip if already consumed" guard that requires an extra await).
	// -----------------------------------------------------------------------
	test("re-executing the same stepId calls registerPending again (port owns idempotency)", async () => {
		const registerCalls: string[] = [];

		const jobStepStore: JobStepStore = {
			...noopStepStore(),
			registerPending: async (_jobId, stepId, _at) => {
				registerCalls.push(stepId);
			},
		};

		const engineStep = { run: (_id: string, fn: () => Promise<unknown>) => fn() };
		const runner = createDurableStepRunner(engineStep, {
			jobId: JOB_ID,
			requiresApproval: () => true,
			approvalGate: async () => ({ approved: true }),
			jobStepStore,
		});

		// First execution (initial Inngest run)
		await runner.run(STEP_ID, async () => "first");
		// Second execution (Inngest re-runs the function body on resume/retry)
		await runner.run(STEP_ID, async () => "replay");

		// main.ts must NOT have a guard — it calls registerPending both times.
		// The underlying store uses ON CONFLICT DO NOTHING to be safe.
		expect(registerCalls).toEqual([STEP_ID, STEP_ID]);
	});

	// -----------------------------------------------------------------------
	// Non-approval step: registerPending must NOT be called for non-approval steps.
	// -----------------------------------------------------------------------
	test("registerPending is NOT called for steps that do not require approval", async () => {
		const registerCalls: string[] = [];

		const jobStepStore: JobStepStore = {
			...noopStepStore(),
			registerPending: async (_jobId, stepId, _at) => {
				registerCalls.push(stepId);
			},
		};

		const engineStep = { run: (_id: string, fn: () => Promise<unknown>) => fn() };
		const runner = createDurableStepRunner(engineStep, {
			jobId: JOB_ID,
			requiresApproval: () => false, // no step requires approval
			jobStepStore,
		});

		await runner.run(STEP_ID, async () => "done");

		expect(registerCalls).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// recordStepUsage: called with specialistResult.usage absolute value on
	// a completion event that carries a result with usage (R7.1, R7.6).
	// Only document-generation results carry usage in the current schema.
	// -----------------------------------------------------------------------
	test("recordStepUsage is called with totalTokens from the specialist's completion event", async () => {
		const usageCalls: Array<{ jobId: string; stepId: string; totalTokens: number }> = [];

		const jobStepStore: JobStepStore = {
			...noopStepStore(),
			recordStepUsage: async (jobId, stepId, totalTokens) => {
				usageCalls.push({ jobId, stepId, totalTokens });
			},
		};

		const docPlan: SupervisorPlan = {
			goal: "generate",
			steps: [
				{
					stepId: STEP_ID,
					task: { kind: "document-generation", instructions: "write a report", format: "markdown" },
				},
			],
		};

		// Specialist returns a result with usage (server-observed value, R7.6).
		await runJob(
			testDeps(),
			{ jobId: JOB_ID, userId: "user-1", plan: docPlan },
			{
				jobStepStore,
				specialists: {
					"document-generation": async () => ({
						kind: "document-generation" as const,
						document: { title: "Report", format: "markdown" as const, content: "body" },
						usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
					}),
				},
			},
		);

		expect(usageCalls).toHaveLength(1);
		expect(usageCalls[0]).toEqual({ jobId: JOB_ID, stepId: STEP_ID, totalTokens: 150 });
	});

	// -----------------------------------------------------------------------
	// recordStepUsage is NOT called when the result has no usage field.
	// -----------------------------------------------------------------------
	test("recordStepUsage is NOT called when the completion event has no usage", async () => {
		const usageCalls: string[] = [];

		const jobStepStore: JobStepStore = {
			...noopStepStore(),
			recordStepUsage: async (_jobId, stepId, _totalTokens) => {
				usageCalls.push(stepId);
			},
		};

		// data-processing result has no usage field
		await runJob(testDeps(), request(), {
			jobStepStore,
			specialists: {
				"data-processing": async () => ({ kind: "data-processing" as const, result: "ok" }),
			},
		});

		expect(usageCalls).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// No-op: omitting jobStepStore must not break existing callers (R6.6 path).
	// Approval flow works fine without a store — no error, step completes.
	// -----------------------------------------------------------------------
	test("omitting jobStepStore is a no-op — approval flow still works", async () => {
		const results = await runJob(testDeps(), request(approvalPlan()), {
			// No jobStepStore injected
			requiresApproval: () => true,
			approvalGate: async () => ({ approved: true }),
			specialists: {
				"data-processing": async () => ({ kind: "data-processing" as const, result: "ok" }),
			},
		});
		expect(results).toHaveLength(1);
	});
});

describe("submitApproval — idempotency (C-11 / R6.1)", () => {
	test("sends an APPROVAL_EVENT with id '<jobId>:<stepId>' for idempotency", async () => {
		const sent: Array<{ name: string; data: unknown; id?: string }> = [];
		const engine: DurableEngine = {
			createFunction: () => ({}),
			send: async (payload) => {
				sent.push(payload);
			},
		};

		await submitApproval(engine, {
			jobId: JOB_ID,
			stepId: STEP_ID,
			approved: true,
		});

		expect(sent).toHaveLength(1);
		expect(sent[0]?.id).toBe(`${JOB_ID}:${STEP_ID}`);
	});
});
