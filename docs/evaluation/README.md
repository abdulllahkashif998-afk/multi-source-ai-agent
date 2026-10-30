# Day 9 Step 1 — Evaluation framework

This framework measures labelled retrieval results and deterministic answer/evidence checks. It does **not** turn keyword matches, exact quotes or mock answers into claims of semantic AI accuracy. Answerable prose and conflict handling remain marked for human review.

## Fixtures

[evaluation/fixtures.ts](../../evaluation/fixtures.ts) contains 25 versioned, fictional cases:

| Category | Cases |
| --- | ---: |
| Document-only | 6 |
| CSV-only | 6 |
| Document + CSV | 6 |
| Insufficient evidence | 4 |
| Conflicting/ambiguous evidence | 3 |

Every case defines its question, system, corpus, relevant chunk IDs, required source identities, expected answer/refusal, numeric facts/tolerances and review notes. CSV/calculation cases additionally define a structured plan and independent expected result rows. Topics include annual leave, return windows, travel approval, incident deadlines, invoice identifiers and team-total thresholds. The sales fixture totals Alpha=30, Beta=6, Gamma=15, overall=51, average=10.2. The policy minimum is 15. Boundary cases preserve strict “above 500” versus “at 500,” and “within 2 hours” versus 3 hours.

Base cases exclude the conflicting/department-specific policy documents. Conflict cases deliberately add an equally active 22-unit policy without effective dates. Ambiguous cases add North/South department targets without specifying the user's department. Foreign-owner, deleted and non-ready document decoys are also seeded in database modes and must never reach the model.

The runner emits fixtures.json alongside each report. Its exact UTF-8 bytes, including the trailing newline, are SHA-256 hashed into metadata.fixtureHash. This lets an external reader join results to the actual questions, expected facts and source labels without importing TypeScript. These are hand-authored text chunks and CSVs; this framework does not evaluate PDF/DOCX parsing or chunking, which remain covered by the application regressions.

## Modes and commands

Run commands from the project root. No dependency, migration, authentication or model-setting change is needed.

### Default: offline scripted mock

```bash
npm run evaluate
# Commit/review a labelled sample report explicitly:
npm run evaluate -- --mode mock --out docs/evaluation/mock-baseline
```

This mode makes no database, Ollama, Gemini or Groq requests. It replays authored rankings, tool choices, query rows and answer text, exercising existing agent tools, structured-plan validation, evidence formatting and citation verification. Scripted outputs intentionally come from the fixture oracle: they test the framework, not a model. Mock ranking metrics validate formula plumbing only. Mock retrieval timing is null/unmeasured, not a fabricated zero. Measured mock workflow latency is JavaScript harness time, not AI latency.

### Real retrieval, no LLM

```bash
node --env-file=.env.local --conditions=react-server --import tsx evaluation/cli.ts \
  --mode retrieval --out .evaluation-results/retrieval
# Limit a comparison to selected questions:
node --env-file=.env.local --conditions=react-server --import tsx evaluation/cli.ts \
  --mode retrieval --cases doc-01,doc-06,conflict-01 --k 3
```

Uses existing DATABASE_URL, BGE/Ollama, pgvector, full-text search and RRF. Corpus embeddings are cached once per run; question retrieval calls use the existing searchDocuments implementation. Both semantic and hybrid retrieval run independently for every selected retrieval case. CSV-only cases have no document relevance labels and are excluded/rejected in this mode. Four insufficient-evidence cases execute retrieval but have no gold chunks, so they do not contribute to macro Recall/Precision. Fifteen positively labelled queries contribute to the current baseline.

No provider configuration is read for generation and no LLM request is made. Local Ollama must be available and the current application tables must already exist.

### Live LLM: explicit opt-in only

```bash
# One RAG question, using the already configured provider/model:
ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server --import tsx evaluation/cli.ts \
  --mode live --cases doc-01 --limit 1 --out .evaluation-results/live-document
# One combined Agent question:
ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server --import tsx evaluation/cli.ts \
  --mode live --cases combined-01 --limit 1 --out .evaluation-results/live-combined
# Compare document-only Agent answering, without changing model settings:
ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server --import tsx evaluation/cli.ts \
  --mode live --cases doc-01 --document-system agent --limit 1
```

Live mode requires both the exact environment opt-in and an explicit case list. A configured API key alone never enables it. The live adapter independently enforces the opt-in too. The default live cap is **one case**; a larger batch needs an explicit --limit (maximum 25). Multiple live cases are separated by 65 seconds, in addition to unchanged application pacing/retry controls. A single Agent case can make several provider calls. The runner does not automatically retry a failed case or switch providers.

Both providers remain supported through existing configuration. The selected model/key/RPM, BGE configuration, similarity threshold and request limits are never rewritten. If the configured provider rejects access or quota, the case fails safely; it is not replaced by a mock answer. No live LLM evaluation was run while implementing this step.

Other options:

- --retrieval semantic|hybrid selects retrieval used by the answering workflow; diagnostic metrics still compare both modes. Default hybrid.
- --k is 1–3 because the current public retrieval service returns at most three chunks.
- --document-system chat|agent chooses the workflow for document-category cases. Other cases retain their authored workflow.
- --limit explicitly caps selected cases. Case IDs and flags are validated; duplicates and unknown IDs are rejected.
- --out must be under .evaluation-results/ or docs/evaluation/. It cannot point at document storage or arbitrary project folders.

## Isolation and privacy

Database/live modes run in a **standalone serial operator process**, not a production route. They use the existing trusted runWithIdentity scope with a dedicated fictional identity. They do not forge sessions or disable API authentication; browser/session authorization is a separate regression suite.

Each case opens a dedicated PostgreSQL transaction and creates four private temporary tables that shadow documents, chunks, datasets and CSV rows. The temporary namespace is checked before seeding. Fixtures supply IDs explicitly; public defaults, identities, foreign keys and sequences are not copied. Existing user rows and files are never read as evidence, overwritten or deleted. No stored document files or permanent schemas are created. Every case rolls back and releases the connection, including on failure.

This reuses the existing tests' pool-binding/savepoint approach. Pool methods are restored in finally; only this standalone process is affected. Fixture service transactions use savepoints inside the outer fixture transaction, with connection leases serialized for parallel tool operations. Consequently this harness is **not** a test of production read-only transaction enforcement, indexes or concurrency. Existing SQL/security regressions cover those separately. Do not import this operator tooling into a running application server or parallelize cases in the same process.

Failures keep completed retrieval and stage measurements, then the runner continues. SIGINT/SIGTERM aborts current work, marks remaining cases not run and saves partial reports after cleanup. A hard process kill cannot guarantee a final report, though PostgreSQL rolls back a disconnected transaction. Setup failures yield a report with no executed cases and a safe error classification, never a success score.

Only allowlisted application diagnostics are captured: request IDs, stages, tool names, outcomes and durations. No prompts, model reasoning, raw provider errors, session tokens, SQL values or keys are logged. Report answers/quotes belong to the fictional fixtures only. Known configured secrets are redacted before report writing, and unknown response metadata is discarded. Machine reports use restricted file permissions. Do not replace the fixture corpus with private user content and publish the outputs.

## Metrics and judgments

- Recall@K: unique relevant chunks within the first K ranked slots divided by all relevant chunks.
- Precision@K: the same unique hits divided by K, even when fewer than K results are returned. Duplicate IDs cannot inflate hits. With one relevant chunk and K=3, maximum precision is 1/3.
- Queries with zero labelled relevant chunks have null Recall/Precision and are excluded from macro means. They still have execution/timing records. CSV cases have no document retrieval metric.
- Citation precision: unique cited expected source identities / unique cited identities. Source recall: expected identities cited / all expected identities. S/D/C namespaces, document/chunk IDs, filenames, available chunk/page metadata, markers and exact quotes are checked against canonical fixtures. Combined answers require both document and CSV references.
- CSV provenance includes dataset identity, serialized row evidence, validated plans and fixed expected rows for registered equivalent plans. Other valid plans are flagged for review rather than treated as independently proven.
- Numeric facts ignore citation markers and use labelled extraction rules and explicit absolute tolerance (currently 0.000001). Wrong detected numbers fail. Unrecognized wording is unscored/needs review. The numericFacts summary reports checked/correct/incorrect/unscored bindings and accuracy only on extracted bindings. These rules do not establish negation, units, conditions or full semantic equivalence.
- A canonical existing backend abstention, grounded=false and no sources can pass the refusal contract for an explicitly missing-evidence case. Noncanonical refusal text needs review; answering an explicit missing-evidence case fails. A sourced conflict explanation or clarification can remain needs-review after provenance checks rather than being automatically rejected for grounded=true. The refusalContract aggregate counts that structural contract only. Conflict/ambiguity remains under human review even after abstention.
- **All answerable free-text results need semantic review**, even when every deterministic check passes. There is no LLM-as-judge, keyword-only “accuracy,” or fabricated overall semantic accuracy percentage.
- Failure rate includes execution errors and failed checks / executed cases. executionErrorRate counts execution errors only. Timeout rate counts classified timeouts / executed cases. Not-run cases are never passed. Report statuses are pass, fail or needs-review for executed cases, with a separate not-run count.
- End-to-end case latency includes fixture setup and retrieval diagnostics. answerLatencyMs measures only the actual answering workflow, excluding those diagnostics/setup. Cached corpus setup is reported separately. Available embedding, PostgreSQL, retrieval, tool, planning, generation, pacing and citation-verification timings are retained per case; overlapping stages must not be summed. Percentiles use nearest rank. Missing observations are null, not zero.

## Generated artifacts and observed samples

Each output contains fixtures.json, results.json and report.md. JSON includes scope, corpus hash, selection, per-case metrics, safe errors, available stages and summary distributions. Markdown includes category counts, separate retrieval metrics, failure/review reasons, latency definitions and actual answer text for manual review.

- [Scripted mock report](mock-baseline/report.md): 25 executed; automatic checks passed on all 25; four refusal-contract passes, zero failures, 21 needs-review. This is **not real AI quality**.
- [Real retrieval report](retrieval-baseline/report.md): 19 queries ran; 15 have positive relevance labels. At K=3, observed macro Recall was 1.0 and Precision was 0.3778 for both semantic and hybrid. No improvement between modes was demonstrated on this tiny/easy corpus. Four empty-gold cases are excluded from the macro averages. No answers or live LLM accuracy were measured.

These are small-corpus observations, not evidence of production-wide quality. Inputs are deterministic; real embeddings/provider responses, warm caches, network conditions and latency can vary between runs. Pin Ollama model artifacts, dependencies and host conditions for controlled comparisons.

## Tests and verification

The evaluation suite tests formulas/denominators, duplicates, empty labels/results, percentiles, numeric tolerances, provenance/metadata spoofing, CSV row checks, refusal/ambiguity judgments, provider failures, timeouts, partial results, default offline execution, explicit live guards, safe output paths, redaction and cleanup. The optional PostgreSQL test also forces a failure after parallel fixture queries and checks pool restoration/public-record preservation.

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

Current results: 155 registered tests; standard run 151 passed/four optional database skips; database-enabled run all 155 passed. TypeScript, ESLint and the supported production Webpack build passed. Existing Chrome browser regressions also passed all 62 checks (12 authentication, nine documents, 13 datasets, 14 chat and 14 responsive-style checks), using mocked API fixtures and no live AI calls. Read-only before/after fingerprints matched for all 12 original public tables. No application/provider/authentication/retrieval implementation was changed for this framework. See the committed sample JSON for measured timings rather than treating scripted mock latency as model performance.

## Files added or changed

- evaluation/fixtures.ts — fictional corpus, 25 questions and explicit ground truth.
- evaluation/metrics.ts — retrieval, numeric, citation/provenance and refusal checks.
- evaluation/runner.ts — per-case execution, partial failure handling and aggregate metrics.
- evaluation/mock-adapter.ts — explicitly scripted, network-free harness adapter.
- evaluation/isolation.ts — temporary-table fixture scope and guaranteed rollback/pool restoration.
- evaluation/database-adapter.ts — existing BGE/retrieval/RAG/Agent services with safe timing capture and live guard.
- evaluation/options.ts, evaluation/cli.ts — strict CLI selection, output bounds, cancellation and reproducibility metadata.
- evaluation/report.ts — JSON/Markdown output, redaction and metric definitions.
- tests/evaluation.test.ts — 21 focused framework tests, including the optional database isolation test.
- docs/evaluation/mock-baseline/ and retrieval-baseline/ — generated, clearly labelled sample fixture/result/report bundles.
- package.json — evaluate command only; no dependency changes.
- .gitignore and README.md — local-output exclusion and documentation link.

The framework deliberately adds no API route, UI, provider fallback, new judge model, model tuning or automatic semantic-accuracy claim. Human review is the remaining step for answer meaning; a future quality study should add larger independently labelled corpora and reviewed answers before defining deployment gates.

## Day 9 Step 2

[Real retrieval quality comparison](retrieval-quality.md) adds rank-1/rank-3 metrics, MRR@3, Hit Rate@3, latency and a separate 20-question overlap/identifier/permission suite. It leaves the original 25-case benchmark unchanged. Run with `node --env-file=.env.local --conditions=react-server --import tsx evaluation/retrieval-quality.ts --repetitions 3`; no LLM calls are permitted.

## Day 9 Step 3 — Answer quality

See [answer correctness and citation evaluation](answer-quality.md) for independent CSV checks, the semantic review rubric, actual offline outcomes and opt-in Groq commands. `npm run evaluate:answers` is offline by default. Saved-result review consumes no quota. Scripted results never establish real AI accuracy.

## Day 9 Step 4 — Performance and reliability

See [performance and reliability evaluation](performance-reliability.md) for actual serial PostgreSQL/Ollama/tool timings, simulated fault results, the confirmed optional-embedding deadline fix and remaining operational risks. `npm run evaluate:performance` defaults to offline checks; `--mode local` measures isolated fictional fixtures without live LLM calls.

## Follow-up to the completed live benchmark

See [live weakness review](live-weakness-remediation.md) for targeted agent instructions, the separate conflict-02 evaluator correction, offline rechecks and the six cases still requiring approved live retests. Historical live reports remain unchanged.

## Deterministic resolution of the three remaining operation failures

See the [resolution and regression report](../agent-remaining-failures-resolution.md) and [real PostgreSQL/BGE verification with Groq HTTP blocked](structured-operations-verification/report.md). These are separate from historical live Groq scores; they do not claim new Groq inference accuracy or completed human review.

## Final authenticated browser acceptance

The [three-operation browser acceptance report](authenticated-operations-acceptance/report.md) records real signup/session/CSRF, UI uploads, rendered answers, citations, ownership checks and desktop/mobile screenshots. All three final cases passed with Groq HTTP blocked. This is browser automation evidence, separate from historical live-provider scores and pending human semantic review.

## Final documentation and repository delivery

[Final delivery readiness](../final-delivery-readiness.md) reconciles all evidence streams, preserves original case outcomes and reviewer status, and records current non-live checks, the full pending Git inventory and remaining approval/replay gaps. No live benchmark rerun is part of that documentation pass.
