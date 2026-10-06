import { embedding } from "@vaz/db/schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Corpus-wide embedding provenance (spec 001 10R.4, R2.2/2.3).
 *
 * Both mixing guards — ingest's `assertNoProviderMixing` and retrieve's
 * read-side `queryProvenance` check — compare against "the corpus's profile".
 * Reading that profile from one sampled row (`LIMIT 1`) made the guards only as
 * good as the sample: a corpus that was already mixed (written before the
 * model-level guard existed, or by a path that bypassed it) would pass whenever
 * the sampled row happened to match. Reading every distinct profile turns the
 * baseline into an invariant: a mixed corpus refuses both ingest and retrieval
 * until it is migrated and re-ingested.
 */

/** The `(provider, model, dim)` triple recorded alongside every vector. */
export interface CorpusEmbeddingProfile {
	provider: string;
	model: string;
	dim: number;
}

/**
 * Collapse the distinct profiles found in the corpus to its single profile:
 * `null` for an empty corpus, the one profile for a consistent corpus, and a
 * thrown error for a corpus that already mixes embedding spaces.
 */
export function singleCorpusProfile(
	distinct: readonly CorpusEmbeddingProfile[],
): CorpusEmbeddingProfile | null {
	if (distinct.length === 0) return null;
	if (distinct.length > 1) {
		const seen = distinct.map((p) => `${p.provider}/${p.model}/${p.dim}`).join(", ");
		throw new Error(
			`corpus already mixes embedding profiles (at least ${seen}); similarity search across them is ` +
				"meaningless. Migrate + full re-ingest with one embedding model before ingesting or retrieving.",
		);
	}
	return distinct[0];
}

/**
 * Read the corpus profile via `SELECT DISTINCT provider, model, dim` (backed by
 * `embedding_provenance_idx`). `LIMIT 2` is enough to tell "one" from "more than
 * one" without enumerating every profile a badly mixed corpus might hold.
 */
export async function readCorpusEmbeddingProfile(
	db: PgDatabase<PgQueryResultHKT>,
): Promise<CorpusEmbeddingProfile | null> {
	const rows = await db
		.selectDistinct({
			provider: embedding.provider,
			model: embedding.model,
			dim: embedding.dim,
		})
		.from(embedding)
		.limit(2);
	return singleCorpusProfile(rows);
}
