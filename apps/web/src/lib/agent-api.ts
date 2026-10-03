import { type ApiStreamEvent, apiStreamEventSchema } from "@vaz/schemas/api-service";
import { parseApiServiceEnv } from "@vaz/schemas/api-service-env";

/**
 * Server-side client for `services/api`'s `POST /v1/agent/stream` (spec 008 R3).
 *
 * Yields the 5 typed SSE events (`@vaz/schemas/api-service`), validated one by
 * one, so a caller never sees a frame the contract does not allow. The frame
 * splitter mirrors `services/api/app/patterns/sse.py`'s `parse_sse_events`: it
 * breaks only on the SSE line terminators `\r\n` / `\r` / `\n`, never on the
 * wider Unicode set (`U+2028`/`U+2029`) that Pydantic leaves unescaped inside
 * JSON payloads.
 *
 * Server-only: it reads `API_SERVICE_KEY` and sends it as `X-API-Key`.
 */

export class AgentApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "AgentApiError";
		this.status = status;
	}
}

export interface StreamAgentApiOptions {
	env?: Record<string, string | undefined>;
	fetch?: typeof fetch;
	signal?: AbortSignal;
}

const LINE_TERMINATOR = /\r\n|\r|\n/;
const DATA_PREFIX = "data:";

/** Split complete SSE frames off `buffer`; returns the data payloads and the unconsumed tail. */
export function takeSseFrames(buffer: string): { payloads: string[]; rest: string } {
	const payloads: string[] = [];
	const lines = buffer.split(LINE_TERMINATOR);
	// The last element is an incomplete line (or "" after a trailing terminator); keep it.
	const rest = lines.pop() ?? "";
	let data: string[] = [];
	let consumedUpTo = 0;
	for (const [index, line] of lines.entries()) {
		if (line.startsWith(DATA_PREFIX)) {
			data.push(line.slice(DATA_PREFIX.length).replace(/^ /, ""));
		} else if (line === "") {
			if (data.length > 0) payloads.push(data.join("\n"));
			data = [];
			consumedUpTo = index + 1;
		}
		// `event:` lines and `:` heartbeat comments carry nothing the JSON `type` lacks.
	}
	// Re-buffer any lines of a frame whose blank terminator has not arrived yet.
	const pending = lines.slice(consumedUpTo);
	return { payloads, rest: pending.length > 0 ? `${pending.join("\n")}\n${rest}` : rest };
}

export async function* streamAgentApi(
	message: string,
	options: StreamAgentApiOptions = {},
): AsyncGenerator<ApiStreamEvent> {
	const { API_SERVICE_URL, API_SERVICE_KEY } = parseApiServiceEnv(options.env);
	if (!API_SERVICE_KEY) {
		throw new AgentApiError("API_SERVICE_KEY is not configured", 503);
	}

	const doFetch = options.fetch ?? fetch;
	const response = await doFetch(new URL("/v1/agent/stream", API_SERVICE_URL), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
			"X-API-Key": API_SERVICE_KEY,
		},
		// Stateless on purpose: see the route's note on why no session_id is forwarded.
		body: JSON.stringify({ message }),
		signal: options.signal,
	});
	if (!response.ok || !response.body) {
		// The upstream flat envelope (`{message, code}`) is not forwarded verbatim:
		// only the status crosses the boundary.
		throw new AgentApiError(`services/api answered ${response.status}`, response.status);
	}

	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			const { payloads, rest } = takeSseFrames(buffer + value);
			buffer = rest;
			for (const payload of payloads) {
				yield apiStreamEventSchema.parse(JSON.parse(payload));
			}
		}
		const { payloads } = takeSseFrames(`${buffer}\n\n`);
		for (const payload of payloads) {
			yield apiStreamEventSchema.parse(JSON.parse(payload));
		}
	} finally {
		reader.releaseLock();
	}
}
