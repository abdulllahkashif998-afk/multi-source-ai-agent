-- Additive expression index; run once outside a transaction.
-- CONCURRENTLY permits ongoing document writes while PostgreSQL builds the index.
CREATE INDEX CONCURRENTLY document_chunks_fts_english_idx
ON document_chunks USING gin (to_tsvector('english', chunk_text));
