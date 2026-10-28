# Day 8 final verification

Verified on 27 October 2026 (Asia/Karachi).

## Result

The application passes the completed functional verification after two confirmed application defects were fixed: an overlapping session-refresh race and a production PDF-worker packaging failure. Authentication, documents, CSV queries, grounded AI answers, citations and responsive navigation were exercised without changing existing user records or provider integrations.

Ready for a controlled staging deployment using the verified Groq configuration and supported Webpack build. This is not an unconditional public-production security or load certification. Deployment infrastructure and the limitations below still need review.

## Architecture inspected

- Next.js 16.4.2 / TypeScript, root app routes and existing Tailwind/PostCSS styling.
- HTTP-only, Secure, SameSite=Strict production session cookies; session-bound CSRF tokens and exact Origin checks. Backend identity comes from verified sessions.
- PostgreSQL 18.6 and pgvector 0.8.1. Owner/ready-status filters protect document chunks and CSV datasets before evidence reaches the model.
- Real BGE/Ollama health request returned 768 finite embedding values in 142 ms. Embeddings and retrieval configuration were unchanged.
- Hybrid semantic/full-text retrieval and RRF; document hashes, explicit versions, deletion tombstones and cleanup jobs.
- Generic CSV inference and validated parameterized query plans, read-only queries, row bounds and statement timeouts.
- Gemini and Groq through the existing AI SDK, with explicit provider selection and no automatic fallback. The selected live provider was Groq, model openai/gpt-oss-20b.
- Separate agent planning/tool calls and structured final generation, followed by the existing exact-quote/source validation.
- Request IDs, allowlisted diagnostics, bounded provider pacing/retries/deadlines, and safe frontend error mapping.

## Actual test results

| Check | Final result |
| --- | --- |
| npm test | 134 registered; 131 passed; three optional database tests skipped; zero failures |
| All PostgreSQL flags enabled | 134 passed; zero failures/skips |
| npx tsc --noEmit | Passed |
| npm run lint | Passed |
| npm run build -- --webpack | Passed, including TypeScript, page generation and tracing |
| Production PDF worker tracing | Worker included for upload and replacement routes |
| Authentication browser suite | 12 scenarios passed |
| Document-management browser suite | Nine scenarios passed |
| Dataset browser suite | 13 scenarios passed |
| Chat browser suite | 14 scenarios passed |
| Styling browser suite | 14 page/viewport checks passed |
| Real HTTPS full-stack acceptance | 12 scenarios passed with real PostgreSQL, parsing, Ollama and two live Groq questions |
| Final traced-build smoke rerun | Ten applicable scenarios passed; two live LLM scenarios explicitly skipped |

The existing browser suites total 62 scenarios/checks. Their API fixtures are intentionally fictional and mocked; they are not claimed as live backend tests. The additional full-stack suite uses actual browser forms, cookies, backend handlers, database queries, file storage and embeddings. CSV calculations and negative authorization cases also use browser-context HTTP requests. A separate final smoke run passed all ten non-live scenarios and explicitly skipped the two live LLM questions to avoid repeating provider calls. Its only RAG request had no owned documents and made no provider call.

The supported Webpack build was used in an isolated copy so the working development cache and private environment files were preserved. The previously documented Turbopack worker port-binding restriction was not retested or worked around by changing application styling in this phase.

## Coverage by feature

| Area | Evidence |
| --- | --- |
| Authentication | Real signup, duplicate account, invalid/valid login, secure-cookie attributes, logout revocation, fixture-session expiry and protected navigation; malformed/forged/missing sessions covered by automated tests |
| CSRF and ownership | Real missing-CSRF and foreign-Origin denials; two isolated accounts cannot discover/query each other's datasets or list/replace/delete each other's documents |
| Documents | Actual DOCX UI upload and PDF parsing; identical-byte 409; corrupt content 422; failed replacement retains version 1; successful replacement publishes version 2; deletion cleans retired chunks/files |
| Retrieval | Database-enabled hybrid/RRF tests cover keyword matches below cosine cutoff, deduplication, deterministic ordering and owner/status exclusion; live answers cite only owned active documents |
| CSV | Real upload/schema inference; filtering, descending sorting, COUNT=3, SUM=36, AVG=12 and grouped totals Alpha=30/Beta=6; invalid CSV/SQL plans fail safely |
| SQL safety | Hostile filter value is treated literally and returns no rows; arbitrary SQL plans and foreign datasets are rejected; parameterization/read-only/timeout assertions remain green |
| AI | Both provider integrations pass SDK-level mocked regressions, including document/CSV/combined tool workflows, structured output, citations, abstention, invalid plans and provider failures |
| XSS and errors | Browser tests render malicious answers, filenames, quotes and CSV values as text; malformed output and unknown/invented citations fail closed; safe error messages and manual retries are tested |
| Reliability | Mocked 429 recovery/exhaustion, provider-local pacing, cancellation, remaining-deadline checks, bounded loops, network/timeout errors and cleanup failures pass |
| Frontend | Navigation, loading/empty/error/success states, Enter/Shift+Enter/IME, duplicate prevention, clear confirmation, dialog focus/Escape and scrolling tables pass in Chrome |

Desktop 1440px and mobile 390px screenshots of the actual combined answer were visually inspected. No page overflow or broken source-table layout was found. No browser JavaScript errors were recorded in the successful full-stack run.

## Live AI results

Only two questions invoked a live LLM. There were seven successful Groq HTTP attempts: one for RAG and six for the multi-step Agent. The questions were spaced 65 seconds apart to protect the token quota. No live Gemini request was made.

### Document RAG

Question: “What is the minimum team sales target mentioned in fictional-policy.docx?”

- HTTP 200, success=true, grounded=true.
- Actual answer: “The minimum team sales target is 15 units. [S1]”
- Source: fictional-policy.docx, chunk index 0. Exact quote: “Fictional QA policy: minimum team sales target is 15 units.” No page number was invented.
- Request ID: 882d9013-2f5b-421d-98a9-b5c6f65382d5.
- Backend request: 1,380.3 ms; browser request/response observation: 1,886 ms. Generation including pacing/SDK work: 1,060.5 ms; citation verification: 12.9 ms.

### Combined document and CSV Agent

Question: “Using fictional-policy.docx and fictional-sales.csv, compare each team total sales with the policy minimum. Which teams are below it, and by how much?”

- HTTP 200, success=true, grounded=true.
- Actual answer: “Team Alpha's total sales of 30 units meet the policy minimum of 15 units, exceeding it by 15 units. [C1] [D1]” and “Team Beta's total sales of 6 units are below the policy minimum by 9 units. [C1] [D1]”.
- D1 cites the original policy threshold; C1 contains grouped rows Alpha=30 and Beta=6. Every returned quote is an exact substring of its evidence text.
- The other account's PrivateTeam=999 data did not appear in the result. Deleted/superseded document IDs were excluded.
- Request ID: 0a40eb0d-a8f3-4ea7-97f4-0c2d84ceb48c.
- Backend request: 25,754.1 ms; browser observation: 25,961 ms. Planning: 20,802.3 ms; final generation including pacing: 4,941.2 ms; citation verification: 1.4 ms. These measurements overlap and must not be added together.

After deleting all of account A's active documents, a real RAG request returned HTTP 200, grounded=false and sources=[] in 283 ms as observed by the browser. Correlated server logs show zero Groq HTTP attempts for that request. Account B's remaining document was not retrieved.

A CSV-only live LLM question was intentionally omitted to conserve quota; CSV-only orchestration is covered by the installed-SDK transport tests and real structured-query backend checks.

## Bugs found and fixes

### 1. Session-refresh race

The chat browser suite initially failed when switching fictional accounts during a session refresh. A deterministic test held the old account's response, changed the account and dispatched another focus event. The second event was discarded because checking was already true. Old private component state could remain until the next periodic refresh.

WorkspaceShell now coalesces overlapping events into one fresh follow-up check. After the new account is verified, the existing keyed workspace resets private page state. Session checks, expiry, logout and backend authorization remain intact. The deterministic delayed-response regression failed before the fix and passed afterwards; the complete chat/auth browser suites then passed.

### 2. Production PDF worker packaging

The new real-parser unit test passed, but the real production POST /api/upload rejected the same valid PDF with HTTP 422 INVALID_CONTENT. DOCX succeeded. A temporary diagnostic in the isolated build identified PDF worker loading as ERR_MODULE_NOT_FOUND: bundling had moved PDF.js away from its package-relative worker. That diagnostic was not added to application source or retained in the final build.

next.config.ts now externalizes pdf-parse using Next.js's documented serverExternalPackages option. Actual production PDF upload then passed. Trace inspection additionally showed the worker missing from deployment manifests; narrow outputFileTracingIncludes entries now include it for upload and replacement routes. Both final route traces contain the worker, so this fix covers traced deployment packaging as well as an installed-node_modules server.

The regression is tested by real PDF/DOCX fixtures, invalid-parse rollback assertions and actual production HTTP upload/replacement. The isolated fixture server refuses to start if the worker is absent from either route trace.

### Test-only synchronization correction

A later no-LLM smoke attempt reached the expected session-expiry redirect while the automation was still evaluating focus after login. It reported “execution context was destroyed.” The test now waits for the verified dashboard heading before expiring that fixture's session. No application change was made for this automation timing issue.

## Isolation, cleanup and secrets

Database-enabled Node tests shadow tables with private temporary tables, use private sequences/savepoints and roll back. The full-stack runner creates a uniquely named empty qa_day8_* schema, copies table structures/indexes/foreign keys and redirects only the isolated server's database connection search path. Test accounts are created through normal signup. Production cookies are exercised through a local HTTPS proxy with a temporary self-signed test certificate; only the test browser ignores certificate trust.

There was no application migration, reset, truncate or alteration of existing users/documents/datasets. Fixture schema removal is targeted test cleanup only. Stored fixture files live under the isolated /tmp production copy, not the project's real upload directory. The supervisor removes its own schema and fixture storage when stopped.

Public-table counts and content fingerprints were recorded read-only before testing and compared during/after testing. At baseline there were five users, nine document records, seven chunks, five generic datasets and 14 generic CSV rows, plus two legacy datasets/four employee rows. Credentials, sessions, auth-rate records, events and cleanup rows were also checked. Final counts and content fingerprints matched for all 12 public tables, no QA schemas remained, and the isolated fixture storage was removed. A literal configured-secret scan found zero matches across 21 verification logs and 54 client build artifacts. That check is evidence of no observed leakage, not a complete information-flow proof. No credentials, session tokens, raw database rows or provider secrets are included in this report.

## Files changed in this phase

Application fixes only:

- app/components/workspace-shell.tsx — queue a follow-up session check when events overlap.
- next.config.ts — externalize pdf-parse and include its worker in route deployment traces.

Verification additions/updates:

- tests/document-parsing.test.ts — real parsers and invalid-content rollback checks.
- tests/fixtures/fictional-policy.pdf, fictional-policy.docx, fictional-policy-v2.docx and README.md — fictional parser/lifecycle fixtures.
- tests/browser/ai-chat-ui.mjs — deterministic delayed-session regression and optional focused filter.
- tests/full-stack-server.mjs — opt-in isolated schema, HTTPS proxy, trace guard and cleanup supervisor.
- tests/browser/full-stack-ui.mjs — opt-in actual browser/backend/AI acceptance and no-LLM smoke mode.
- docs/day-8-final-verification.md and README.md — report and link.

Provider implementations/settings, model configuration, BGE, database migrations, authentication/SQL/citation rules and existing unrelated working-tree changes were preserved. Playwright was installed temporarily outside the application; no project dependency was added for QA.

## Repeat automated verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

With an app server running and Playwright/Chrome available, run each existing browser suite with UI_BASE_URL set to that server. PLAYWRIGHT_MODULE can point to an external installation, and CHROME_PATH can override the executable. This verification used /tmp/day8-final-browser/node_modules/playwright and /usr/bin/google-chrome.

For the actual full-stack test, first prepare a separate production copy under /tmp with dependencies, the final configuration and a successful Webpack build. Do not copy .env.local or existing storage into it. The runner requires schema-creation permission in the configured PostgreSQL database and refuses non-/tmp build directories or missing PDF worker traces. Local ports 3109 and 3448 must be free.

```bash
# Terminal 1, from the real project root; use your isolated build directory:
QA_BUILD_DIRECTORY=/tmp/your-isolated-production-copy \
  node --env-file=.env.local tests/full-stack-server.mjs
# Terminal 2, from the real project root; opt in deliberately to two live questions:
RUN_FULL_STACK_UI=1 PLAYWRIGHT_MODULE=/path/to/playwright \
  node --env-file=.env.local tests/browser/full-stack-ui.mjs
# To repeat backend/UI acceptance without those live LLM questions:
RUN_FULL_STACK_UI=1 QA_SKIP_LIVE_AI=1 PLAYWRIGHT_MODULE=/path/to/playwright \
  node --env-file=.env.local tests/browser/full-stack-ui.mjs
# Stop Terminal 1 with Ctrl+C to remove only its fixture schema and storage.
```

The full-stack browser test verifies the fixture proxy marker before creating accounts. Never point it at a real user environment or manually expire real sessions. It does not run unless RUN_FULL_STACK_UI=1. Its local result artifact contains fictional answers/request IDs, not cookies or passwords.

## Remaining limitations and deployment assessment

- Chrome desktop/mobile were tested; Firefox, Safari, physical devices and a full screen-reader/WCAG audit were not.
- This is functional/security regression verification, not a penetration test, load test or long-running availability test. Concurrent duplicate behavior is covered by existing unit/database checks rather than a sustained live-upload load test.
- Live AI used one Groq model and two questions. Broader answer-quality evaluation, contradictory-policy cases and large corpora still need a maintained evaluation set. Exact quotes establish provenance, not formal proof that every possible model inference is correct.
- Gemini remains intact and mocked regression tests pass. Its previously observed Google-project access restriction was not retested with live requests.
- Provider pacing is process-local; multi-worker deployments need shared quota coordination. Token/day quotas and other clients can still cause 429 responses. Request deadlines and bounded retries remain unchanged.
- Authentication remains the current basic account/session implementation. Production HTTPS, allowed Origin, secrets management, account recovery/MFA/email-verification requirements and edge request limits need deployment review.
- Durable upload storage, a cleanup-retry schedule, database backups and reachable PostgreSQL/Ollama services are operational prerequisites. Do not ship without the included PDF worker and required runtime/native dependencies.
- Scanned/image-only PDFs have no OCR in this phase. Chat is non-streaming, page-memory-only and answers each question independently. Existing dataset discovery/query/context limits still apply.

Assessment: the tested single-process application is suitable for controlled staging acceptance with the supported build and verified Groq configuration. Public production readiness remains conditional on those infrastructure/security requirements; no unconditional reliability or security guarantee is implied.

## Manual acceptance checklist

- [ ] Use two new fictional accounts in a disposable test environment; verify signup, duplicate/invalid login, logout, expiry and protected navigation.
- [ ] Upload real fictional PDF and DOCX files. Check ready status, duplicate 409, failed replacement retention, version 2 publication, deletion and retrieval exclusion.
- [ ] Upload fictional CSV data; inspect types; run filters/sorting, COUNT/SUM/AVG/GROUP BY; verify hostile filter strings remain literal and foreign IDs are unavailable.
- [ ] Ask one document question and one complete combined policy/CSV question. Compare actual figures and exact S/D/C quotes with owned fixtures; record safe request IDs only.
- [ ] Test missing evidence. Confirm grounded=false/no sources; never accept a fabricated answer as a pass.
- [ ] Use mocked suites for repeated 429, timeout/network, malformed-output and cleanup-failure cases; avoid exhausting live provider quota.
- [ ] At desktop/mobile widths, navigate all sections and use keyboard controls, dialogs, long answers and scrollable tables. Confirm no HTML from evidence executes.
- [ ] Review deployment HTTPS/Origin, trace/native dependencies, storage persistence, cleanup scheduling, backups and multi-worker quota behavior.
- [ ] Remove only disposable fixtures and confirm existing data/integrity checks remain unchanged.

## Current consolidated documentation

This remains the dated Day 8 verification record. See the [final project report](final-project-report.md) and [final test-case register](final-test-cases.md) for later CSV lifecycle checks, all 25 original evaluation questions, separate manual acceptance slots and unresolved live/human-review gaps. Historical browser automation is not reclassified as manual testing.
