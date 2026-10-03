import { readFile } from "node:fs/promises";
import { apiChatRequestSchema, apiStreamEventSchema } from "@vaz/schemas/api-service";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import { z } from "zod";

/**
 * Contract-drift test for `services/api` (spec 008 R3), the counterpart of
 * `contract-drift.spec.ts` for `services/agent`. Three legs:
 *
 * 1. OpenAPI snapshot <-> generated TS types (byte-match on regeneration).
 * 2. OpenAPI snapshot <-> thin Zod request schema (keys, required set, bounds).
 * 3. SSE-event JSON Schema snapshot <-> the Zod event union (discriminators,
 *    per-event keys and required sets). The stream route answers
 *    `text/event-stream`, so legs 1–2 cannot see these shapes at all.
 */

const GENERATED_DIR = new URL("../src/generated/", import.meta.url);
const OPENAPI_PATH = new URL("api-service.openapi.snapshot.json", GENERATED_DIR);
const TYPES_PATH = new URL("api-service.ts", GENERATED_DIR);
const SSE_SCHEMA_PATH = new URL("api-service.sse-events.schema.json", GENERATED_DIR);

const REGENERATE_HINT =
	"Drift detected: run `mise run openapi:gen` to regenerate packages/schemas/src/generated/" +
	"api-service.* from services/api, then update packages/schemas/src/api-service.ts if the " +
	"boundary itself changed.";

interface JsonSchemaLike {
	type?: string | string[];
	$ref?: string;
	const?: unknown;
	required?: string[];
	properties?: Record<string, JsonSchemaLike>;
	minLength?: number;
	maxLength?: number;
	oneOf?: JsonSchemaLike[];
	anyOf?: JsonSchemaLike[];
	$defs?: Record<string, JsonSchemaLike>;
}

interface ObjectShape {
	required: string[];
	properties: Record<string, { types: string[]; minLength?: number; maxLength?: number }>;
}

/**
 * Pydantic spells an optional-nullable field `anyOf: [{type: string}, {type: null}]`;
 * Zod's `toJSONSchema` spells the same thing `type: ["string", "null"]`. Normalize
 * both to a sorted list of type names so only a real type change shows up as drift.
 */
function typesOf(schema: JsonSchemaLike): string[] {
	if (Array.isArray(schema.type)) return [...schema.type].sort();
	if (schema.type !== undefined) return [schema.type];
	return (schema.anyOf ?? schema.oneOf ?? []).flatMap(typesOf).sort();
}

function objectShape(schema: JsonSchemaLike): ObjectShape {
	return {
		required: [...(schema.required ?? [])].sort(),
		properties: Object.fromEntries(
			Object.entries(schema.properties ?? {}).map(([key, value]) => [
				key,
				{
					types: typesOf(value),
					...(value.minLength !== undefined && { minLength: value.minLength }),
					...(value.maxLength !== undefined && { maxLength: value.maxLength }),
				},
			]),
		),
	};
}

/** Event shapes keyed by their `type` discriminator, ignoring the `type` key itself. */
function eventShapes(members: JsonSchemaLike[]): Record<string, ObjectShape> {
	return Object.fromEntries(
		members.map((member) => {
			const discriminator = member.properties?.type?.const;
			if (typeof discriminator !== "string") {
				throw new Error(
					`SSE event member without a string \`type\` const: ${JSON.stringify(member)}`,
				);
			}
			const { type: _type, ...rest } = member.properties ?? {};
			const shape = objectShape({
				properties: rest,
				required: (member.required ?? []).filter((key) => key !== "type"),
			});
			return [discriminator, shape];
		}),
	);
}

describe("api-service contract drift (services/api snapshots <-> generated types <-> thin Zod)", () => {
	test("leg 1: regenerating TS types from the OpenAPI snapshot byte-matches the committed file", async () => {
		const snapshot = JSON.parse(await readFile(OPENAPI_PATH, "utf8"));
		const regenerated = `${COMMENT_HEADER}${astToString(await openapiTS(snapshot, { silent: true }))}`;
		expect(regenerated, REGENERATE_HINT).toBe(await readFile(TYPES_PATH, "utf8"));
	});

	test("leg 2: the Zod ChatRequest matches the snapshot's keys, required set, and bounds", async () => {
		const snapshot = JSON.parse(await readFile(OPENAPI_PATH, "utf8")) as {
			components: { schemas: Record<string, JsonSchemaLike> };
		};
		const fromSnapshot = objectShape(snapshot.components.schemas.ChatRequest);
		const fromZod = objectShape(z.toJSONSchema(apiChatRequestSchema) as JsonSchemaLike);
		expect(fromZod, REGENERATE_HINT).toEqual(fromSnapshot);
	});

	test("leg 3: the Zod SSE union matches the snapshot event-for-event", async () => {
		const snapshot = JSON.parse(await readFile(SSE_SCHEMA_PATH, "utf8")) as JsonSchemaLike;
		const pydanticMembers = Object.values(snapshot.$defs ?? {});
		const zodSchema = z.toJSONSchema(apiStreamEventSchema) as JsonSchemaLike;
		const zodMembers = zodSchema.oneOf ?? zodSchema.anyOf ?? [];

		// Non-vacuous: an empty side would make the equality below trivially true.
		expect(pydanticMembers.length).toBe(5);
		expect(eventShapes(zodMembers), REGENERATE_HINT).toEqual(eventShapes(pydanticMembers));
	});
});
