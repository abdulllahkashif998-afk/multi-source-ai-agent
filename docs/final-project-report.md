# Final project report

Documentation consolidation dated 28 October 2026. This report summarizes existing evidence; it does not represent a new test execution, deployment approval or live-provider evaluation.

## Implemented scope

The project provides session-authenticated document and CSV management, owner-scoped BGE/pgvector hybrid retrieval, grounded Document RAG and a multi-source agent with Gemini/Groq selection. Documents support duplicate rejection, explicit replacement and deletion. Generic CSV datasets support schema discovery, validated structured calculations, atomic replacement, identical-content replacement rejection and transactional deletion. The dashboard supports authentication, documents, datasets and both AI modes.

Security controls include verified server identity, session-bound CSRF and Origin checks, ownership filters before evidence retrieval, validated/parameterized SQL, bounded execution, private document storage, source/quote verification and content-safe diagnostics. These are tested controls, not a guarantee against every security issue.

## Test-case register and evidence boundaries

The complete [final test-case register](final-test-cases.md) includes:

- All **25 original AI benchmark questions**, unchanged and grouped into six document-only, six CSV-only, six combined, four insufficient-evidence and three conflict/ambiguity cases. Each includes expected results, required source evidence, execution method and actual available outcomes.
- A separate **16-slot manual acceptance checklist**. The original numbered manual run sheet was not available; consolidated slots are explicitly labelled. The user's confirmation of CSV replacement/deletion is distinguished from Codex automation. Other manual slots are not marked passed without evidence.
- CSV replacement, identical-content rejection, deletion, ownership, security, real retrieval, failure/cancellation, pacing and performance checks, each linked to retained evidence.
- Historical failures and unresolved live retests, without fabricating post-fix success.

### Latest recorded regression results

| Check | Recorded result | Evidence type |
| --- | --- | --- |
| Standard automated suite | 214 passed; eight optional DB skips; zero failures | Codex automated, provider mocks where applicable |
| Disposable PostgreSQL suite | 222 passed; zero failures/skips | Real isolated database with fictional fixtures; AI mocked/blocked |
| Datasets browser suite | 20/20 passed | Codex automated browser, mocked APIs, desktop/mobile |
| TypeScript, ESLint, Webpack production build | Passed | Recorded CSV-identical follow-up; isolated build |
| Companion auth/document browser suites | 12/12 and 9/9 passed | Earlier CSV lifecycle implementation; mocked APIs |

See [CSV lifecycle report](day-10-csv-lifecycle.md#identical-content-replacement-follow-up). These counts are not 222 AI questions, manual passes or live accuracy results. No test was rerun for this documentation task.

### Evaluation and live evidence

- **Offline/scripted:** all 25 evaluator cases executed; automatic checks passed for all 25. Final scripted classifications: four canonical abstention passes, 21 needs-review, zero human-reviewed. This measures evaluator behavior, not AI accuracy.
- **Real retrieval:** 39 original/extension questions, 234 actual search calls, zero LLM calls. Both modes recovered all labelled relevant chunks at top three in the measured cohorts. Hybrid made two first-rank stress mistakes; no improvement claim hides those misses. See [retrieval quality](evaluation/retrieval-quality.md).
- **Live Groq:** Day 8 automated full-stack checks recorded successful fictional document-only and combined answers with exact citations. CSV-only live LLM acceptance was intentionally omitted. These historical runs predate later changes and do not establish a complete current live matrix.
- **Incomplete retests:** the final private Document RAG reference-based retest has no retained successful live result. The agent post-fix diagnostic retest stopped at its explicitly approved attempt cap before final generation. Both remain unverified live. See [RAG investigation](day-10-rag-citation-investigation.md) and [agent investigation](agent-citation-verification-investigation.md).
- **Manual:** the user confirmed working CSV replacement/deletion before the identical-content improvement. No detailed original 16-case run sheet or manual identical-content sign-off was supplied.

**Full live 25-case AI answer accuracy and human semantic/citation review remain incomplete.** No overall live accuracy percentage is claimed.

## Performance and reliability

Measured warm local component p50/p95: BGE embedding 41.710/54.581 ms, semantic retrieval 43.108/56.346 ms, hybrid retrieval 44.446/57.638 ms, CSV SUM 1.851/3.316 ms. Thirty repetitions per path; tiny fictional fixtures, not production load. Scripted tool timings exclude live model planning/generation. See [performance/reliability methodology](evaluation/performance-reliability.md).

Mocked/injected 429, 403, dependency outages, cancellation and bounded retries passed their expected assertions. Real-timer provider pacing used stub responses; process-local limits are not distributed quota certification. Existing database integrity comparisons and disposable-fixture cleanup are recorded in [fresh setup review](day-10-fresh-setup-security-review.md) and [CSV lifecycle](day-10-csv-lifecycle.md).

## Readiness and remaining work

The implemented paths have substantial automated regression coverage and limited historical live-provider evidence. This supports further controlled staging acceptance, not unconditional public-production readiness.

Remaining work: reconcile the original manual run sheet, verify identical-content replacement manually, complete authorized current live retests and the 25-case human-reviewed evaluation, and review deployment HTTPS/storage/backups/monitoring and multi-worker quota behavior. Authentication recovery/MFA and CSV version history/undo remain absent. Existing answers and acquired evidence are snapshots, not retroactively revoked by deletion.

Repository setup and review: [database](database.md), [deployment](deployment.md), [GitHub review](day-10-github-review.md). Documentation index: [README](../README.md#documentation). Historical research reports are preserved with their dates and limitations.

## Documentation validation for this update

Checked that the register contains each original benchmark ID once, preserves every question and expected answer from the saved original fixture catalog, and retains the 6/6/6/4/3 grouping. Confirmed 16 distinct manual slots, all local Markdown file links resolving within the proposed 211-file manifest, clean `git diff --check`, and no detected provider-key/private-key/personal-identifier patterns in the five changed documentation files. These checks validate documentation consistency, not new AI answers. Application code and evaluation fixtures are unchanged; no live Groq request or database operation was run.

## Delivery walkthrough and handover

Use the [final demo guide](final-demo-guide.md) for the fictional-data walkthrough and expected results, and [project handover](project-handover.md) for repository/setup/configuration and deployment responsibilities. These are instructions, not newly verified acceptance results.
