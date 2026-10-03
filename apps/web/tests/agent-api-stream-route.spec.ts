import type { ApiStreamEvent } from "@vaz/schemas/api-service";
import { POST } from "@/app/api/agent-api/stream/route";
import { AgentApiError } from "@/lib/agent-api";

/**
 * Unit coverage for `POST /api/agent-api/stream` (spec 008 R3), the sample
 * bridge to `services/api`. The client (`@/lib/agent-api`) and Auth.js are
 * mocked, so this exercises only the route's HTTP concerns: auth gate, strict
 * body, error mapping, and SSE re-framing.
 */

const { authMock, streamAgentApiMock } = vi.hoisted(() => ({
	authMock: vi.fn(),
	streamAgentApiMock: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/agent-api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/agent-api")>()),
	streamAgentApi: streamAgentApiMock,
}));

function post(body: unknown): Promise<Response> {
	return POST(
		new Request("http://localhost/api/agent-api/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

async function* events(...items: ApiStreamEvent[]): AsyncGenerator<ApiStreamEvent> {
	yield* items;
}

beforeEach(() => {
	authMock.mockReset().mockResolvedValue({ user: { id: "user-1" } });
	streamAgentApiMock.mockReset();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

test("401 without an authenticated session, before touching services/api", async () => {
	authMock.mockResolvedValue(null);
	const response = await post({ message: "hi" });
	expect(response.status).toBe(401);
	expect(streamAgentApiMock).not.toHaveBeenCalled();
});

test.each([
	["a browser-supplied session_id", { message: "hi", session_id: "someone-elses" }],
	["an injected message history", { message: "hi", message_history: [] }],
	["an empty message", { message: "" }],
])("400 for %s", async (_label, body) => {
	const response = await post(body);
	expect(response.status).toBe(400);
	expect(streamAgentApiMock).not.toHaveBeenCalled();
});

test("relays validated events as SSE frames", async () => {
	streamAgentApiMock.mockReturnValue(
		events({ type: "step_started" }, { type: "token", content: "Hi" }, { type: "completed" }),
	);

	const response = await post({ message: "hello" });

	expect(response.status).toBe(200);
	expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	expect(streamAgentApiMock).toHaveBeenCalledWith("hello", expect.anything());
	expect(await response.text()).toBe(
		'event: step_started\ndata: {"type":"step_started"}\n\n' +
			'event: token\ndata: {"type":"token","content":"Hi"}\n\n' +
			'event: completed\ndata: {"type":"completed"}\n\n',
	);
});

test.each([
	[503, 503],
	[403, 502],
])(
	"upstream failure before the first event (status %i) maps to %i JSON",
	async (upstream, expected) => {
		streamAgentApiMock.mockImplementation(async function* () {
			yield* [];
			throw new AgentApiError("boom", upstream);
		});

		const response = await post({ message: "hi" });

		expect(response.status).toBe(expected);
		expect(await response.json()).toEqual({ error: "Agent API unavailable" });
	},
);

test("a mid-stream failure ends with the contract's generic terminal error event", async () => {
	streamAgentApiMock.mockImplementation(async function* () {
		yield { type: "step_started" } satisfies ApiStreamEvent;
		throw new Error("upstream detail that must not leak");
	});

	const text = await (await post({ message: "hi" })).text();

	expect(text).toContain('data: {"type":"error","message":"Agent stream failed"}');
	expect(text).not.toContain("upstream detail");
});
