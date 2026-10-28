# Day 7 Phase 1: hybrid document search

This extends the existing searchDocuments function. BGE embeddings, Gemini provider configuration, ingestion, CSV services, development-only restrictions and exact citation validation remain unchanged.

## Architecture

A shared scoped SQL CTE joins document_chunks to documents and requires user_id=1 and status='ready'. Both branches read exclusively from that scope. Deleted rows cannot appear; statuses other than ready are excluded. There is no new owner selector or lifecycle behavior.

- Semantic branch: existing 768-dimensional BGE query embedding and pgvector cosine distance, up to 20 candidates. Non-null embeddings are required for this branch.
- Keyword branch: PostgreSQL English full-text vectors and ts_rank_cd, up to 20 matching candidates. The query is parsed as plain text, removes English stopwords, stems terms, and combines parsed lexemes with OR to support questions containing several words. SQL values remain parameterized. Users cannot supply SQL or a raw tsquery. A matching chunk may have a missing embedding.
- Deduplication: keyed by stable chunk ID. Repeated appearances in a branch count once, using that branch's best rank.
- Fusion: equal-weight Reciprocal Rank Fusion, score = sum of 1/(60 + branch rank), with ranks starting at 1. A chunk retrieved by both branches receives both contributions. Raw cosine and full-text scores are not added because their scales differ.
- Deterministic rank-based reranking: descending RRF score; then best individual branch rank; then keyword rank; then ascending numeric bigint chunk ID. This favors agreement and, on an otherwise equal tie, keyword matches. Return the first three unique chunks. There is no cross-encoder, paid reranking model or external vector service.

The two branches execute in one SELECT statement and therefore share a statement snapshot. The existing client-side ten-second query timeout remains. Existing cancellation checks are retained around embedding and database work; a client timeout does not guarantee cancellation of a running PostgreSQL statement.

## Thresholds and output compatibility

RAG_MIN_SIMILARITY, default 0.5, remains a cosine cutoff, not a hybrid score cutoff. In hybrid mode, below-cutoff semantic candidates are excluded before final reranking. Positive keyword matches remain eligible regardless of cosine similarity. The shared evidence selector also understands this rule, so neither /api/chat nor the agent silently discards keyword evidence afterward.

Cosine similarity is preserved accurately and can be null for keyword-only chunks without embeddings. It is never replaced with an invented high similarity. Optional output metadata includes retrieval_mode, semantic_rank, keyword_rank and rrf_score. Evidence sources expose corresponding camelCase fields. Original chunk text, document ID, chunk ID, filename, chunk index and available page number are preserved. Existing source quote checks still require exact substrings of the evidence text. The existing 6,000-character evidence excerpt limit remains.

Set DOCUMENT_SEARCH_MODE=hybrid (the default) or semantic in the server environment and restart the dev server to compare modes. Semantic mode retains the previous top-three vector retrieval with a stable ID tie-break and the existing downstream cosine cutoff. Invalid modes fail explicitly. The optional mode argument is backend-only; API requests still accept only a question.

## Database change

After inspecting the schema and explaining the change, applied migrations/007-document-full-text-index.sql: one concurrent GIN expression index on to_tsvector('english', chunk_text). No document rows, embeddings, source metadata, CSV data or tables were changed. The index automatically covers existing and future chunk text without an ingestion rewrite. No generated column or backfill is required. A read-only metadata check confirmed the new index is valid.

Apply this migration once, outside a transaction, to other databases. It uses CREATE INDEX CONCURRENTLY to allow ongoing writes. If an interrupted build leaves an invalid index, inspect it with the database administrator before retrying; this migration does not automatically drop anything. Retrieval SQL can function without the index, but larger datasets would scan text more slowly. On a tiny corpus PostgreSQL may reasonably choose a sequential scan even when the index exists.

## Actual tests and comparison

- npm test: 46 passed, one optional database test skipped.
- npx tsc --noEmit: passed.
- npm run lint: passed.
- Full suite with RUN_SEARCH_DB_TESTS=1 and .env.local: all 47 passed, none skipped.

The PostgreSQL integration test uses connection-local temporary tables inside a transaction that always rolls back, leaving real records unchanged. It verifies a low-cosine exact identifier, semantic paraphrase selection with controlled embeddings, owner exclusion, processing/deleted-status exclusion, and citation metadata. Unit tests cover duplicate branches, empty results, deterministic ordering, keyword evidence with null embeddings, and chat/agent compatibility. Google transport is mocked in automated tests. Paraphrase scores are controlled fixtures; they do not establish real-model recall on a broad corpus.

Actual BGE/PostgreSQL comparison for "What does the document say about oceans?":

| Mode | Chunk order | Observation |
| --- | --- | --- |
| Semantic | 2, 3, 1 | Ordered by cosine: approximately 0.666, 0.621, 0.524 |
| Hybrid | 2, 1, 3 | Chunks 2 and 1 matched both branches; keyword agreement moved chunk 1 ahead of 3 |

A second real BGE comparison, "What is the minimum sales target?", returned team-policy.docx chunk 4 in both modes (cosine approximately 0.744); hybrid recorded rank 1 in both branches.

In the controlled PostgreSQL identifier fixture, semantic-only evidence returned the paraphrase chunk and dropped the orthogonal identifier chunk. Hybrid ranked the exact ZX-2048 chunk first and retained its page metadata despite cosine 0. Both branches excluded unauthorized and non-ready fixtures.

The single local oceans comparison took 673 ms semantic and 65 ms hybrid. These are not comparable benchmark timings: the first request warmed Ollama and filesystem/database caches. No latency improvement claim is made. Live Gemini generations were not required for this retrieval comparison; route/agent compatibility is covered by the existing suite and new keyword-evidence regression tests.

## Manual commands

Compare retrieval without any Google calls:

```bash
node --env-file=.env.local --require tsx/cjs src/scripts/compare-document-search.ts 'What does the document say about oceans?'
node --env-file=.env.local --require tsx/cjs src/scripts/compare-document-search.ts 'minimum sales target'
```

Run database-inclusive tests (requires the existing local PostgreSQL connection):

```bash
RUN_SEARCH_DB_TESTS=1 node --env-file=.env.local --conditions=react-server --import tsx --test --experimental-test-isolation=none tests/*.test.ts
```

For an end-to-end manual check, set DOCUMENT_SEARCH_MODE=hybrid in your server environment, start npm run dev, and use non-sensitive sample documents appropriate to send to Google:

```bash
curl -sS http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"question":"What does test-policy.docx say about oceans?"}'
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"Using team-policy.docx and team-sales.csv, which teams failed the target and by how many units?"}'
```

Repeat with DOCUMENT_SEARCH_MODE=semantic after restarting the server. Inspect filenames, chunk IDs, ranks, actual excerpts and exact quotes. For identifier testing, upload a fictional document containing a rare identifier through the existing upload flow, then compare both modes with that identifier. The automated private-table fixture already covers this without adding real records.

## Limits and next steps

English stemming and tokenization are not byte-exact substring matching; punctuation-heavy identifiers can split into component tokens. OR keyword search improves recall but may introduce weak matches. RRF scores express rank agreement, not confidence. Finite candidate pools can miss evidence, and returning only three chunks limits broad questions. A valid keyword match does not establish that the chunk answers the whole question; final grounding/abstention instructions and citation checks still apply. Quote provenance does not prove logical entailment.

Hybrid mode still needs the existing query embedding service; this phase does not add an Ollama-outage fallback. Large-corpus performance and retrieval quality need evaluation. The index adds storage and write overhead. No learned reranker, query rewrite model, authentication or document lifecycle changes were introduced.

Files changed: src/lib/search-documents.ts, src/lib/hybrid-ranking.ts, src/lib/rag-answer.ts, migrations/007-document-full-text-index.sql, tests/hybrid-search.test.ts, tests/chat.test.ts (hybrid transport fixture), src/scripts/compare-document-search.ts, and this guide. Next: measure relevance on representative paraphrases, identifiers and negative questions before tuning candidate budgets, RRF weights or keyword matching rules.
