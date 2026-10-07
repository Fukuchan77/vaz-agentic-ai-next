-- spec 001 10R.3 / 10R.4: turn two RAG invariants from application-side
-- samples into database-backed guarantees.
--
-- 10R.3: one `document` row per `source`. Idempotent re-ingest used to rely on
-- delete-then-insert inside one transaction, which two concurrent ingests of the
-- same source could both pass, leaving duplicate documents. A database that
-- already holds such duplicates keeps the most recently ingested copy (the one a
-- re-ingest would have left) and drops the older ones; their chunks and
-- embeddings go with them through the existing ON DELETE CASCADE.
DELETE FROM "document" AS older
	USING "document" AS newer
	WHERE older."source" = newer."source"
		AND (older."ingested_at", older."id") < (newer."ingested_at", newer."id");
CREATE UNIQUE INDEX "document_source_uq" ON "document" ("source");
-- 10R.4: the mixing guards now read every distinct (provider, model, dim) in
-- the corpus rather than one sampled row; this index keeps that read off the
-- heap, where each row carries a 768-dim vector.
CREATE INDEX "embedding_provenance_idx" ON "embedding" ("provider","model","dim");
