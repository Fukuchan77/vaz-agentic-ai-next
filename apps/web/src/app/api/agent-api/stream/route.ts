import { createConsoleLogger } from "@vaz/config/logger";
import type { ApiStreamEvent } from "@vaz/schemas/api-service";
import { z } from "zod";
import { AgentApiError, streamAgentApi } from "@/lib/agent-api";
import { auth } from "@/lib/auth";

/**
 * `POST /api/agent-api/stream` — sample bridge from `apps/web` to `services/api`'s
 * `POST /v1/agent/stream` (spec 008 R3). The browser never talks to the Python
 * lane directly: this route holds `API_SERVICE_KEY` server-side, validates every
 * upstream event against `@vaz/schemas/api-service`, and re-emits it as the same
 * `event: <type>` / `data: <json>` SSE frame.
 *
 * Three deliberate restrictions:
 *
 * - **Authenticated sessions only (401 otherwise).** Unlike `/api/chat`, the
 *   upstream call spends LLM budget under one shared service key; an anonymous
 *   relay would be an open billing proxy.
 * - **No `session_id` is accepted or forwarded.** `services/api` binds sessions to
 *   the principal derived from its API key, and every web user shares that one
 *   key — forwarding a browser-supplied `session_id` would let one signed-in user
 *   read or extend another's conversation (`services/api/app/security/principal.py`
 *   documents the same single-key caveat). Per-user continuity needs a per-user
 *   principal on the Python side first.
 * - **Strict body** (`{ message }` only): extra fields are a 400, matching the
 *   repo's strict-request-object rule.
 */

const requestSchema = z.strictObject({
	message: z.string().min(1).max(32_000),
});

const encoder = new TextEncoder();

function frame(event: ApiStreamEvent): Uint8Array {
	return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
	}
	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}

	const logger = createConsoleLogger();
	const events = streamAgentApi(parsed.data.message, { signal: req.signal });

	// Pull the first event before committing to a 200, so an unconfigured key or an
	// upstream 4xx/5xx surfaces as a JSON error status instead of a broken stream.
	let first: IteratorResult<ApiStreamEvent>;
	try {
		first = await events.next();
	} catch (error) {
		const status = error instanceof AgentApiError && error.status === 503 ? 503 : 502;
		logger.error("Failed to start services/api stream", {
			error: error instanceof Error ? error.message : String(error),
		});
		return Response.json({ error: "Agent API unavailable" }, { status });
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (!first.done) controller.enqueue(frame(first.value));
		},
		async pull(controller) {
			try {
				const next = await events.next();
				if (next.done) {
					controller.close();
					return;
				}
				controller.enqueue(frame(next.value));
			} catch (error) {
				// Mid-stream failure: end with the contract's own terminal `error` event
				// (generic text only — never the upstream detail), then close.
				logger.error("services/api stream failed mid-flight", {
					error: error instanceof Error ? error.message : String(error),
				});
				controller.enqueue(
					frame({ type: "error", message: "Agent stream failed" } satisfies ApiStreamEvent),
				);
				controller.close();
			}
		},
		async cancel() {
			await events.return(undefined);
		},
	});

	return new Response(first.done ? null : stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"X-Accel-Buffering": "no",
		},
	});
}
