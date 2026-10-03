import { emptyToUndefined } from "@vaz/schemas/env-helpers";
import { z } from "zod";

/**
 * Environment for reaching `services/api` (spec 008 R3), same shape as the other
 * `parse<Name>Env` leaves.
 *
 * - `API_SERVICE_URL` defaults to port 8001 because `services/agent` already
 *   owns 8000 (`AGENT_SERVICE_URL`, docker-compose `agent`).
 * - `API_SERVICE_KEY` is the `X-API-Key` that `services/api` validates. It is a
 *   server-only secret: it is read by Route Handlers and never sent to the
 *   browser. Optional so the rest of the app boots without the Python lane;
 *   the caller decides what an absent key means (the sample route answers 503).
 */
export const apiServiceEnvSchema = z.object({
	API_SERVICE_URL: z.url().default("http://localhost:8001"),
	API_SERVICE_KEY: z.string().min(16).optional(),
});

export type ApiServiceEnv = z.infer<typeof apiServiceEnvSchema>;

export function parseApiServiceEnv(
	env: Record<string, string | undefined> = process.env,
): ApiServiceEnv {
	return apiServiceEnvSchema.parse({
		API_SERVICE_URL: emptyToUndefined(env.API_SERVICE_URL?.trim()),
		API_SERVICE_KEY: emptyToUndefined(env.API_SERVICE_KEY),
	});
}
