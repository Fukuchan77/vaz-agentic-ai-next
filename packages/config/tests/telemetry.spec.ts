/**
 * Fail-soft contract for `initTelemetry` (NFR-4 / R4.3).
 *
 * `ai#registerTelemetry` and `@ai-sdk/otel#OpenTelemetry` are mocked so we can
 * (a) assert one-shot registration + single Langfuse warning, and (b) force a
 * registration error and prove it does not propagate (startup stays alive) and
 * that a later call retries. Module state (`initialized`) is reset per test via
 * `vi.resetModules()` + dynamic import.
 */

const { registerTelemetry, OpenTelemetryCtor } = vi.hoisted(() => ({
	registerTelemetry: vi.fn(),
	OpenTelemetryCtor: vi.fn(),
}));

vi.mock("ai", () => ({ registerTelemetry }));
vi.mock("@ai-sdk/otel", () => ({ OpenTelemetry: OpenTelemetryCtor }));

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

test("registers once and warns once when Langfuse is unconfigured", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const { initTelemetry } = await import("@vaz/config/telemetry");

	expect(() => initTelemetry({})).not.toThrow();
	initTelemetry({}); // idempotent: second call is a no-op

	expect(registerTelemetry).toHaveBeenCalledTimes(1);
	const langfuseWarnings = warn.mock.calls.filter((c) => String(c[0]).includes("Langfuse"));
	expect(langfuseWarnings).toHaveLength(1);

	warn.mockRestore();
});

test("does not warn about Langfuse when both credentials are present", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const { initTelemetry } = await import("@vaz/config/telemetry");

	initTelemetry({
		LANGFUSE_PUBLIC_KEY: "pk",
		LANGFUSE_SECRET_KEY: "sk",
		OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.example.test",
	});

	expect(registerTelemetry).toHaveBeenCalledTimes(1);
	expect(warn).not.toHaveBeenCalled();

	warn.mockRestore();
});

// Credentials alone do not export anything: the host exporter is keyed off
// OTEL_EXPORTER_OTLP_*, so silence here would falsely signal a working export.
test("warns once when Langfuse credentials are set but no OTLP endpoint is configured", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const { initTelemetry } = await import("@vaz/config/telemetry");

	const env = { LANGFUSE_PUBLIC_KEY: "pk", LANGFUSE_SECRET_KEY: "sk" };
	initTelemetry(env);
	initTelemetry(env);

	const endpointWarnings = warn.mock.calls.filter((c) =>
		String(c[0]).includes("OTEL_EXPORTER_OTLP_ENDPOINT"),
	);
	expect(endpointWarnings).toHaveLength(1);

	warn.mockRestore();
});

test("accepts the traces-specific OTLP endpoint as a configured exporter", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const { initTelemetry } = await import("@vaz/config/telemetry");

	initTelemetry({
		LANGFUSE_PUBLIC_KEY: "pk",
		LANGFUSE_SECRET_KEY: "sk",
		OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://otlp.example.test/v1/traces",
	});

	expect(warn).not.toHaveBeenCalled();

	warn.mockRestore();
});

test("registration failure is fail-soft (no throw) and retryable", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	registerTelemetry.mockImplementationOnce(() => {
		throw new Error("otel exporter down");
	});
	const { initTelemetry } = await import("@vaz/config/telemetry");

	// First call: registration throws internally but startup must survive.
	expect(() => initTelemetry({})).not.toThrow();
	// `initialized` stayed false, so a subsequent call actually registers.
	expect(() => initTelemetry({})).not.toThrow();

	expect(registerTelemetry).toHaveBeenCalledTimes(2);

	warn.mockRestore();
});

test("registers the OpenTelemetry integration with an enrichSpan callback (R4.2)", async () => {
	const { initTelemetry } = await import("@vaz/config/telemetry");

	initTelemetry({});

	expect(OpenTelemetryCtor).toHaveBeenCalledTimes(1);
	const options = OpenTelemetryCtor.mock.calls[0]?.[0];
	expect(options?.enrichSpan).toBeInstanceOf(Function);
});

test("buildTelemetryAttributes lifts jobId/userId/agentName onto span attributes (R4.2)", async () => {
	const { buildTelemetryAttributes } = await import("@vaz/config/telemetry");

	expect(
		buildTelemetryAttributes({ jobId: "job_1", userId: "user_1", agentName: "chat-agent" }),
	).toEqual({
		"vaz.job_id": "job_1",
		"vaz.user_id": "user_1",
		"vaz.agent_name": "chat-agent",
	});
});

test("buildTelemetryAttributes omits null/undefined/missing fields instead of stringifying them (R4.2)", async () => {
	const { buildTelemetryAttributes } = await import("@vaz/config/telemetry");

	// Sync chat path: no durable jobId, pre-auth userId.
	expect(buildTelemetryAttributes({ jobId: null, userId: undefined })).toEqual({});
	expect(buildTelemetryAttributes(undefined)).toEqual({});
});

test("enrichSpan registered on OpenTelemetry delegates to buildTelemetryAttributes (R4.2)", async () => {
	const { initTelemetry, buildTelemetryAttributes } = await import("@vaz/config/telemetry");

	initTelemetry({});

	const enrichSpan = OpenTelemetryCtor.mock.calls[0]?.[0]?.enrichSpan;
	const runtimeContext = { jobId: "job_2", userId: null, agentName: "supervisor" };
	expect(
		enrichSpan?.({
			spanType: "operation",
			operationId: "ai.streamText",
			callId: "call_1",
			runtimeContext,
		}),
	).toEqual(buildTelemetryAttributes(runtimeContext));
});
