# Final project report

Final documentation consolidation: **29 October 2026**. Implemented scope and evidence are separated below. Original benchmark artifacts, screenshots and human-review templates are retained unchanged. This report does not approve a public deployment or rewrite live results.

## Implemented application

The application is a Next.js 16.4.2/TypeScript authenticated workspace for uploaded PDF/DOCX knowledge and structured CSV analysis. It uses PostgreSQL 18/pgvector 0.8.1, BGE 768-dimensional embeddings through Ollama, cosine/English full-text hybrid retrieval with RRF, and AI SDK 7 with selectable Groq or Gemini. No automatic provider fallback is implemented. **Web crawling was not a requirement and is not implemented.**

Completed features:

- Signup/login/logout; salted scrypt passwords; eight-hour server sessions; HTTP-only cookies; production Secure/SameSite=Strict cookies; session-bound CSRF and Origin checks.
- Owner-scoped PDF/DOCX upload/listing, byte-hash duplicate rejection, explicit atomic publication of replacements/version metadata, deletion/retrieval exclusion and deferred file cleanup. Document pages show ten items per page by default.
- Generic CSV upload, inferred schemas, discovery, parameterized structured filtering/sorting/COUNT/SUM/AVG/GROUP BY, transactional replacement with identical-content rejection, deletion and ownership checks.
- Document RAG and bounded multi-source planning/tool use. Source IDs and exact quote references are verified server-side; original metadata is retained where available.
- Narrow deterministic operations for row listings, supported team-policy comparisons, travel-approval comparisons and existing role counts. They use authorized backend tools and evidence-derived arithmetic, then the same citation verifier. Unsupported wording uses general planning; recognized but unsafe/ambiguous operations abstain. No fictional numeric answers are embedded in application logic.
- Responsive authentication, document, dataset and two-mode Chat screens; safe text rendering, in-page history and accessible source disclosures.
- Safe request/stage diagnostics, process-local provider pacing, bounded deadlines/cancellation and validated read-only SQL. Rejected provider tool payloads are never automatically executed or repaired; bounded structural diagnostics omit argument values.
- Fresh-only migrations 001–009, isolated tests/evaluation fixtures and technical/setup documentation.

Details: [architecture](architecture.md), [API](api.md), [database](database.md), [CSV lifecycle](day-10-csv-lifecycle.md), [targeted operation resolution](agent-remaining-failures-resolution.md).

## Evidence timeline — do not combine these as an accuracy score

| Evidence/run | Actual outcome | Interpretation |
| --- | --- | --- |
| Original live Groq benchmark, 28 October | 25/25 original cases executed once; 24 responses and one provider HTTP 400; automatic 22 pass/3 fail; formal 4 pass/3 fail/18 needs-review | Four passes are canonical-refusal contracts. Human-reviewed: 0. No semantic accuracy percentage established. |
| Six-case live Groq retest, 29 October | All six executed once; 5 responses/1 tool_use_failed HTTP 400; automatic 5 pass/1 fail; formal 0 pass/1 fail/5 needs-review | Two abstentions improved; wrong CSV aggregation and incomplete team comparison persisted; conflict-02 abstained without conditional explanation. |
| Deterministic backend verification | 3/3 grounded outputs with real BGE/PostgreSQL; 15 local embedding calls; 0 provider requests | Backend computation/provenance verified, not Groq inference or human annotation. |
| Authenticated browser acceptance | csv-05, combined-04 and combined-05 **PASSED**; real UI, signup/session/CSRF, uploads, API, BGE/PostgreSQL, source panels and ownership boundaries | Codex browser automation, not a user-reported manual run; 0 Groq requests; six desktop/mobile screenshots. |
| Human semantic review | Still pending; no reviewer decisions submitted | Do not invent ratings or convert valid quotes/automation into human approval. |

### Original live 25-case benchmark — preserved history

All original questions, expected facts and failure classifications are documented unchanged in [the 25-case register](final-test-cases.md#5-original-25-case-benchmark--actual-execution-and-separate-judgments). Categories: six document-only, six CSV-only, six combined, four insufficient-evidence and three conflict/ambiguity cases. The original fixture hash is `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`.

Original usage: **95 actual HTTP attempts / 97,440 known reported tokens**, plus unavailable usage for one failed request. See [original cumulative results](evaluation/final-live/batch-03/cumulative-results.json), [detailed original report](evaluation/final-live/batch-03/report.md), earlier [pilot](evaluation/final-live/report.md) and [batch 02](evaluation/final-live/batch-02/report.md).

Preserved findings:

- csv-05: HTTP 400 during planning, without a final answer.
- conflict-01: invented a higher-target-wins rule absent from the cited policies.
- ambiguous-01: assigned a personal target without department context.
- combined-04/combined-05: genuine citations accompanied incomplete comparisons; the requested 120-credit excess was omitted.
- conflict-02: the original evaluator rejected genuine additional CSV evidence because its allowlist contained only policy documents. Its original Fail remains. A separate offline evaluator correction permits relevant supplemental sales evidence without approving semantics or changing the benchmark definitions.

The [24 response-bound original review slots](evaluation/final-live/batch-03/all-review-template.json) remain unfilled. A provider failure has no returned answer to review. General human-reviewed benchmark accuracy is pending despite complete execution coverage.

### Subsequent live retest — a separate run

The [six-case report](evaluation/final-live/retest-01/report.md) and [before/after JSON](evaluation/final-live/retest-01/results.json) preserve actual answers and errors. Usage: **24 HTTP attempts / 28,393 known reported tokens**, plus one unknown-usage failed request. No case retries or quota/deadline stops occurred.

csv-05 returned a grouped total 30 rather than individual 20,10. combined-04 still only identified Beta. combined-05 failed during its second planning request after document search with `tool_use_failed`. conflict-01 and ambiguous-01 abstained; conflict-02 also abstained without explaining both policies. Automatic pass did not certify correct intent or completeness.

The historical malformed tool-call structure was not retained; the exact rejected tool/field remains unknown. Later diagnostic tests use synthetic malformed payloads and must not be presented as recovered historical evidence.

### Deterministic verification — real infrastructure, no Groq inference

The [operation resolution](agent-remaining-failures-resolution.md) and [verification results](evaluation/structured-operations-verification/results.json) show all three supported operations passing with real retrieval/SQL, authorized fixture identity and blocked provider HTTP. Thresholds, entities and actuals come from evidence; exact decimal differences and complete row rendering replace these operations' unnecessary model planning/generation.

Single measured answer samples: csv-05 41.64 ms, combined-04 86.88 ms, combined-05 101.26 ms. These warm, tiny-fixture, no-LLM observations are not a general latency distribution or Groq speed/accuracy claim. Existing user/document/CSV fingerprints and historical evidence hashes were unchanged.

### Final authenticated browser acceptance — PASSED

| Case | Browser status | Actual verified output |
| --- | --- | --- |
| csv-05 | **PASSED** | Individual East amounts 20,10 descending; no aggregate/grouping; C1 citation |
| combined-04 | **PASSED** | Alpha 30, Beta 6, Gamma 15; minimum 15; Beta alone short by 9; D1/C1 citations |
| combined-05 | **PASSED** | Jon 620, approval limit 500, excess 120 credits; Sol at 500 excluded; D1/C1 citations |

[Browser report and screenshots](evaluation/authenticated-operations-acceptance/report.md), [rendered/API responses](evaluation/authenticated-operations-acceptance/results.json), [safe server traces](evaluation/authenticated-operations-acceptance/server-trace.json), [network audit](evaluation/authenticated-operations-acceptance/network-audit.json) and [cleanup](evaluation/authenticated-operations-acceptance/cleanup.json) are retained.

This was the current production build in headless Chrome at desktop/mobile viewports, a separate fresh PostgreSQL cluster, real signup/cookies/CSRF, UI uploads and actual API calls. Ownership checks rejected cross-user queries and excluded foreign citations. Exact source excerpts were expanded and checked visibly. All three server citation-verification stages succeeded; no page errors or page-width overflow were recorded. Original database access: none; fixture environment removed; actual/attempted Groq calls: zero.

An initial harness selector closed an already-open CSV disclosure and timed out; its Failed/Blocked records and screenshot remain separately preserved. Only the test selector was corrected before the complete passing run. These browser passes do **not** retroactively relabel the original Groq benchmark.

## Regression, retrieval and reliability evidence

Latest implementation-wide recorded checks: **249/249 database-enabled tests**, standard **239 passed/10 optional database skips**, TypeScript/ESLint/Webpack passed. Final browser follow-up affected suite: **32 passed/3 optional database skips**. These are backend/contract tests, with providers mocked or blocked where applicable, not 249 AI questions or human decisions. Current delivery-pass commands/results are recorded separately in [delivery readiness](final-delivery-readiness.md).

Real retrieval evaluation used 39 questions and 234 search calls, zero LLM calls. Both modes recovered all labelled relevant chunks at top three in their measured cohorts; hybrid had two first-rank stress mistakes. Local component benchmark p50/p95: BGE embedding 41.710/54.581 ms; semantic retrieval 43.108/56.346 ms; hybrid 44.446/57.638 ms; CSV SUM 1.851/3.316 ms. Tiny warm fixtures and serial tests do not establish production capacity. See [evaluation summary](evaluation-summary.md) for full definitions, injected failures and limitations.

## Remaining limits and delivery assessment

- **General Groq tool-use failures may still occur.** Deterministic operations cover narrow grammar/schema/rule forms, not every question. The exact old malformed request cannot be reconstructed.
- **Prompt-based reasoning guardrails are not deterministic semantic verification.** Source/quote identity proves provenance, not entailment, relevance or complete reasoning. Supported deterministic operations additionally validate their own typed operands and complete bounded output.
- **Human-reviewed benchmark accuracy remains pending.** No overall accuracy percentage, production-quality certification or human approval is claimed. Two earlier private-question retest gaps remain separately documented; these fictional tests do not close them.
- Authentication recovery/MFA/email verification, cross-host distributed pacing/quota coordination, durable storage/backups/restore, cleanup/reconciliation scheduling, retention and deployment monitoring require operational work. CSV discovery is capped at 100; CSV versions/undo and persistent chat history are absent.
- The specialized authenticated-operation harness needs prepared fresh-DB/HTTPS fixture supervision, DOCX inputs and optional Playwright/Chrome. That run's supervisor/preparation was temporary rather than a committed turnkey runner; screenshots/results are complete, but standalone replay preparation remains a repository reproducibility gap.

The snapshot supports **controlled staging and owner-reviewed Git delivery**, not unconditional public production. Remote visibility/access, licensing/CI policy and final commit/push approval remain owner responsibilities. [Final delivery readiness](final-delivery-readiness.md) records all pending Git paths, validation, exclusions and blockers. Setup: [README](../README.md), [database](database.md), [handover](project-handover.md), [deployment](deployment.md).

## Submission finalization — 30 October 2026

See [the final review](submission-final/report.md) for exact checks, requirement coverage and pending Git files. Row-level policy applicability supports qualified counts without assuming missing organization/date or maintenance evidence. Document citation panels now open initially; excerpts and verification are unchanged. Later combined Tests 16–19 were reported passed by the owner (18 required retry), while Test 20 remains blocked by quota. No original evaluation result is changed. Live availability and human semantic review remain limitations; this is controlled-submission readiness, not public production certification.
