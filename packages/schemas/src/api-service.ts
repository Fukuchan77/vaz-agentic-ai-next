import type { components } from "@vaz/schemas/generated/api-service";
import { z } from "zod";

/**
 * Thin hand-written Zod for `services/api`'s HTTP boundary (spec 008 R3), the
 * same pattern as `agent-service.ts` for `services/agent`. Pydantic in
 * `services/api` is the sole source of truth; these schemas exist only for
 * runtime validation on the TS side. `satisfies z.ZodType<...>` pins each one
 * to the openapi-typescript output at compile time, and
 * `tests/api-service-contract-drift.spec.ts` closes the loop back to the
 * committed snapshots.
 */

// `z.strictObject` mirrors `ChatRequest.model_config = ConfigDict(extra="forbid")`
// (services/api/app/models/agent.py): no `message_history`/`model` field exists to
// smuggle history through, and an unknown field is a 422 upstream — reject it here
// first so the proxy never forwards one.
export const apiChatRequestSchema = z.strictObject({
	message: z.string().min(1).max(32_000),
	session_id: z.string().nullish(),
}) satisfies z.ZodType<components["schemas"]["ChatRequest"]>;

export type ApiChatRequest = z.infer<typeof apiChatRequestSchema>;

/**
 * The 5-event SSE union of `POST /v1/agent/stream`
 * (`services/api/app/patterns/sse.py`). That route answers `text/event-stream`,
 * so the union is absent from the OpenAPI document; the drift test compares it
 * against `generated/api-service.sse-events.schema.json` instead. Every member is
 * strict, mirroring the Pydantic `extra="forbid"` base, so an event that grows a
 * field fails validation here rather than leaking through a proxy.
 */
export const apiStepStartedEventSchema = z.strictObject({ type: z.literal("step_started") });
export const apiToolCalledEventSchema = z.strictObject({
	type: z.literal("tool_called"),
	name: z.string(),
	args_summary: z.string(),
});
export const apiTokenEventSchema = z.strictObject({
	type: z.literal("token"),
	content: z.string(),
});
export const apiCompletedEventSchema = z.strictObject({ type: z.literal("completed") });
export const apiErrorEventSchema = z.strictObject({
	type: z.literal("error"),
	message: z.string(),
});

export const apiStreamEventSchema = z.discriminatedUnion("type", [
	apiStepStartedEventSchema,
	apiToolCalledEventSchema,
	apiTokenEventSchema,
	apiCompletedEventSchema,
	apiErrorEventSchema,
]);

export type ApiStreamEvent = z.infer<typeof apiStreamEventSchema>;
