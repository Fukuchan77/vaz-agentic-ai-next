import { AgentApiError, streamAgentApi, takeSseFrames } from "@/lib/agent-api";

/**
 * Unit coverage for the server-side `services/api` stream client (spec 008 R3).
 * `fetch` is injected, so nothing leaves the process (hermetic-network setup
 * would throw on a real call anyway).
 */

const env = { API_SERVICE_URL: "http://api.test:8001", API_SERVICE_KEY: "k".repeat(32) };

function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }): Response {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		},
	});
	return new Response(body, init);
}

async function collect(chunks: string[]) {
	const fetchMock = vi.fn().mockResolvedValue(sseResponse(chunks));
	const events = [];
	for await (const event of streamAgentApi("hi", { env, fetch: fetchMock })) events.push(event);
	return { events, fetchMock };
}

describe("takeSseFrames", () => {
	test("keeps U+2028/U+2029 inside a payload instead of treating them as frame breaks", () => {
		const content = "a b c";
		const wire = `event: token\ndata: ${JSON.stringify({ type: "token", content })}\n\n`;
		const { payloads, rest } = takeSseFrames(wire);
		expect(payloads.map((p) => JSON.parse(p).content)).toEqual([content]);
		expect(rest).toBe("");
	});

	test("re-buffers a frame whose blank terminator has not arrived yet", () => {
		const { payloads, rest } = takeSseFrames('data: {"type":"completed"}\n');
		expect(payloads).toEqual([]);
		expect(takeSseFrames(`${rest}\n`).payloads).toEqual(['{"type":"completed"}']);
	});
});

describe("streamAgentApi", () => {
	test("posts the message with the server-side key and yields validated events across chunk splits", async () => {
		const { events, fetchMock } = await collect([
			'event: step_started\ndata: {"type":"step_started"}\n\nevent: tok',
			'en\ndata: {"type":"token","content":"Hel',
			'lo"}\r\n\r\n: heartbeat\n\nevent: completed\ndata: {"type":"completed"}\n\n',
		]);

		expect(events).toEqual([
			{ type: "step_started" },
			{ type: "token", content: "Hello" },
			{ type: "completed" },
		]);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("http://api.test:8001/v1/agent/stream");
		expect(init.headers["X-API-Key"]).toBe(env.API_SERVICE_KEY);
		expect(JSON.parse(init.body)).toEqual({ message: "hi" });
	});

	test("flushes a final frame that lacks its trailing blank line", async () => {
		const { events } = await collect(['data: {"type":"completed"}']);
		expect(events).toEqual([{ type: "completed" }]);
	});

	test("rejects an event that grew a field the contract does not allow", async () => {
		await expect(
			collect(['data: {"type":"token","content":"x","raw_prompt":"leak"}\n\n']),
		).rejects.toThrow();
	});

	test("fails with 503 before any request when the key is not configured", async () => {
		const fetchMock = vi.fn();
		const run = streamAgentApi("hi", {
			env: { API_SERVICE_URL: env.API_SERVICE_URL },
			fetch: fetchMock,
		});
		await expect(run.next()).rejects.toMatchObject({ status: 503 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("surfaces an upstream error status without its body", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ message: "secret detail", code: "X" }, { status: 403 }));
		const run = streamAgentApi("hi", { env, fetch: fetchMock });
		const error = await run.next().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AgentApiError);
		expect((error as AgentApiError).status).toBe(403);
		expect((error as Error).message).not.toContain("secret detail");
	});
});
