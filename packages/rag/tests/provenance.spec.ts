import { embedding } from "@vaz/db/schema";
import {
	type CorpusEmbeddingProfile,
	readCorpusEmbeddingProfile,
	singleCorpusProfile,
} from "@vaz/rag/provenance";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Corpus-wide provenance read (spec 001 10R.4). The mixing guards used to compare
 * against one sampled row (`LIMIT 1`), so an already-mixed corpus passed whenever
 * the sample matched. These tests pin the invariant form: every distinct profile
 * is read, and more than one is refused. DB-free — the Drizzle query builder is
 * replaced by a fake that records the chain it was driven through.
 */

const NOMIC: CorpusEmbeddingProfile = { provider: "ollama", model: "nomic-embed-text", dim: 768 };
const BGE: CorpusEmbeddingProfile = { provider: "ollama", model: "bge-base", dim: 768 };

describe("singleCorpusProfile", () => {
	test("an empty corpus has no profile", () => {
		expect(singleCorpusProfile([])).toBeNull();
	});

	test("a consistent corpus yields its one profile", () => {
		expect(singleCorpusProfile([NOMIC])).toEqual(NOMIC);
	});

	test("a corpus that already mixes profiles is refused, naming what it found", () => {
		expect(() => singleCorpusProfile([NOMIC, BGE])).toThrow(
			/mixes embedding profiles .*ollama\/nomic-embed-text\/768.*ollama\/bge-base\/768/,
		);
	});
});

describe("readCorpusEmbeddingProfile", () => {
	/** A fake Drizzle client for `selectDistinct(fields).from(table).limit(n)`. */
	function fakeDb(rows: CorpusEmbeddingProfile[]) {
		const calls: { fields?: Record<string, unknown>; from?: unknown; limit?: number } = {};
		const db = {
			selectDistinct(fields: Record<string, unknown>) {
				calls.fields = fields;
				return {
					from(table: unknown) {
						calls.from = table;
						return {
							async limit(n: number) {
								calls.limit = n;
								return rows;
							},
						};
					},
				};
			},
		};
		return { db: db as unknown as PgDatabase<PgQueryResultHKT>, calls };
	}

	test("reads DISTINCT (provider, model, dim) from embedding, capped at 2", async () => {
		const { db, calls } = fakeDb([NOMIC]);
		await expect(readCorpusEmbeddingProfile(db)).resolves.toEqual(NOMIC);
		expect(calls.from).toBe(embedding);
		expect(calls.fields).toEqual({
			provider: embedding.provider,
			model: embedding.model,
			dim: embedding.dim,
		});
		// Two rows are enough to tell "one profile" from "mixed".
		expect(calls.limit).toBe(2);
	});

	test("an empty corpus reads as null", async () => {
		const { db } = fakeDb([]);
		await expect(readCorpusEmbeddingProfile(db)).resolves.toBeNull();
	});

	test("a mixed corpus rejects instead of returning whichever row came first", async () => {
		const { db } = fakeDb([NOMIC, BGE]);
		await expect(readCorpusEmbeddingProfile(db)).rejects.toThrow(/mixes embedding profiles/);
	});
});
