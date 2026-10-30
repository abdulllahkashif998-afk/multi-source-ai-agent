# Final authenticated browser acceptance — three deterministic operations

29 October 2026. **Passed: 3; Failed: 0; Blocked: 0 in the corrected final run.**

This used real headless Chrome, the existing production Next.js build, actual session authentication/CSRF, document and CSV upload APIs, PostgreSQL/pgvector and local BGE/Ollama. No API responses were intercepted and no model outputs were mocked. Groq HTTP was blocked server-side; no Groq call was attempted or sent.

## Environment and isolation

- Desktop viewport: 1440×1000; mobile: 390×844. Local HTTPS with a temporary self-signed certificate; only the QA browser ignored certificate trust. Production HTTP-only Secure SameSite=Strict session cookies were asserted.
- A separate disposable PostgreSQL 18 cluster was initialized with the existing nine migrations and pgvector 0.8.1. The app used a restricted runtime role. It never connected to the original application database.
- Fictional users A/B were created through the real signup screen. Original benchmark policy text was packaged as DOCX and uploaded through the Documents UI. sales.csv and expenses.csv were uploaded through the Datasets UI. B had an independently uploaded sales.csv containing only ForeignOnly=987654.
- Application code, model settings and credentials were unchanged. The existing compiled Agent route was checked for the new deterministic operation before testing. Original evaluation artifacts remain intact.
- Existing browser suites were inspected; their mocked Chat suite was not substituted for this test. The browser harness is [structured-operations-ui.mjs](../../../tests/browser/structured-operations-ui.mjs). It requires the prepared isolated fixture application and manifest; it must not target a real user environment.

## Final case results

| Case | Status | Real API | Server request time | Desktop screenshot | Mobile screenshot |
| --- | --- | --- | ---: | --- | --- |
| csv-05 | Passed | HTTP 200 | 12.6 ms | [desktop](csv-05-desktop.png) | [mobile](csv-05-mobile.png) |
| combined-04 | Passed | HTTP 200 | 106.7 ms | [desktop](combined-04-desktop.png) | [mobile](combined-04-mobile.png) |
| combined-05 | Passed | HTTP 200 | 103.3 ms | [desktop](combined-05-desktop.png) | [mobile](combined-05-mobile.png) |

Server timings come from request logs, not a repeated-load performance test. The results.json durationMs measures the browser verification interaction including disclosure clicks and screenshot capture; it is not pure API latency.

### csv-05

Question: List the East-region sales amounts, largest first.

Actual rendered answer (exactly matched the real API answer):

East-region sales amount: 20. [C1]

East-region sales amount: 10. [C1]

Request ID: `81182f48-d4b2-43c3-9782-d176a19f2f2c`.

Verified sources:

- [C1] sales.csv, dataset 4.
  Exact displayed evidence: `[{"team":"Alpha","amount":20,"region":"East"},{"team":"Alpha","amount":10,"region":"East"}]`

The validated source plan had region=East, amount DESC, groupBy=[] and no aggregate. Returned amounts were independently asserted as [20,10], and rendered in that order.

### combined-04

Question: According to the policy, which teams fall short when all sales rows are added per team?

Actual rendered answer (exactly matched the real API answer):

Alpha total is 30 units; the policy minimum is 15 units; meets the target; surplus is 15 units. [D1] [C1]

Beta total is 6 units; the policy minimum is 15 units; shortfall is 9 units. [D1] [C1]

Gamma total is 15 units; the policy minimum is 15 units; meets the target; surplus is 0 units. [D1] [C1]

Request ID: `8d1316e9-d37b-4b06-be81-7df9456d5ae7`.

Verified sources:

- [D1] team-policy.docx, document 3, chunk 3, index 0, page None.
  Exact displayed evidence: `Orion team policy: the minimum monthly total sales target for each team is 15 units.`

- [C1] sales.csv, dataset 4.
  Exact displayed evidence: `[{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}]`

All grouped totals, minimum 15, Beta shortfall 9 and Gamma equality were asserted in the rendered text. Every comparison retains both document and CSV markers. Alpha and Gamma meet the threshold; Beta is the only failing group.

### combined-05

Question: Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?

Actual rendered answer (exactly matched the real API answer):

Mira cost is 450 credits; the approval limit is 500 credits; approval is not required because the amount is at or below the limit. [D1] [C1]

Jon cost is 620 credits; the approval limit is 500 credits; approval required; excess is 120 credits. [D1] [C1]

Sol cost is 500 credits; the approval limit is 500 credits; approval is not required because the amount is at or below the limit. [D1] [C1]

Request ID: `95d9aa2d-62ae-46e9-807c-0d674ca65b32`.

Verified sources:

- [D1] travel-policy.docx, document 4, chunk 4, index 0, page None.
  Exact displayed evidence: `Travel expenses above 500 credits require manager approval.`

- [C1] expenses.csv, dataset 5.
  Exact displayed evidence: `[{"cost":450,"employee":"Mira"},{"cost":620,"employee":"Jon"},{"cost":500,"employee":"Sol"}]`

Rendered assertions checked Jon actual 620, limit 500 and excess 120, and explicitly checked that Sol at 500 does not require approval. Policy uses strict above, not at-or-above.

## Citation and access checks

- **Passed:** Real signup and secure production sessions.
- **Passed:** Anonymous and missing-CSRF writes rejected before execution.
- **Passed:** Discovery and structured-query ownership isolation.
- **Passed:** Foreign user cannot receive policy or CSV citations from owner A.

- Source IDs were asserted to belong to A’s actual uploads. Exact quotes were checked as substrings of the returned evidence and were opened and checked visibly in the browser disclosures. Server trace records citation-verification=ok for all three cases.
- B could not query A’s dataset IDs; A could not query B’s dataset ID (404). B had no document listing entries and its two combined questions abstained with no sources. B’s CSV-only question returned its own 987654 and no A dataset citations. A never received ForeignOnly content.
- Anonymous Agent POST returned 401; authenticated POST without CSRF returned 403. The real UI supplied the session-bound CSRF token and same-origin request. No user ID was supplied with the question.
- No page errors were recorded. Every case passed a mobile page-width/no-horizontal-overflow assertion. Six screenshots were saved; representative desktop/mobile screenshots were visually inspected.

## Preserved initial harness failure

The initial attempt received the correct real csv-05 response but its test selector clicked an already-open CSV panel closed, then timed out on the hidden nested evidence disclosure. This was a harness defect, not an application failure. Its original [results](harness-attempt-01/results.json) and [screenshot](harness-attempt-01/failure.png) are preserved: csv-05 was recorded Failed and the two unexecuted cases Blocked in that initial attempt.

The harness was corrected to open only closed panels. Fresh fictional accounts were used for the complete second run; all three passed. No application code was changed and no failure was concealed by a fake response.

## Provider network and cleanup evidence

Audit: `{"actualGroqRequests": 0, "blockedExternalAttempts": 0, "localOllamaCallsAcrossBothHarnessAttempts": 8, "providerResponsesMocked": false, "apiResponsesIntercepted": false}`.
Cleanup: `{"temporaryClusterAndBuildRemoved": true, "originalDatabaseAccessed": false, "testAccountsAndUploads": "removed with disposable cluster and build directory", "serverSupervisor": "stopped"}`.

All test accounts, fixture records, uploaded files, cluster data, copied production output and temporary TLS material were removed with the disposable environment. The original database was never accessed. No real user data was modified.

Evidence: [raw browser results](results.json), [safe request/stage trace](server-trace.json), [network audit](network-audit.json), [cleanup confirmation](cleanup.json). No cookies, passwords or session/CSRF tokens are included. Screenshots contain fictional account information only.

## Affected regression results

`node --conditions=react-server --import tsx --test --experimental-test-isolation=none tests/agent-deterministic-operations.test.ts tests/live-evaluation-improvements.test.ts tests/ai-chat-client.test.ts tests/auth.test.ts`

**35 tests: 32 passed, 3 optional database tests skipped, 0 failed.** ESLint, documentation-link validation, evidence-hash validation and the repository secret scan also passed (no findings). The database-backed/browser path was verified here against the disposable actual application database. The prior full database-enabled suite remains 249/249; it was not rerun or relabelled as this task’s test execution.

## Documentation readiness and remaining limits

Final documentation can now mark **these three authenticated browser acceptance scenarios Passed**, citing this evidence. This is Codex-executed browser automation, not a user-reported manual run, a human semantic annotation, or a new live Groq accuracy score. Historical benchmark results and human-review templates must stay unchanged.

The remaining historical Groq tool_use_failed argument structure is still unavailable. General agent wording outside the deterministic grammars was not exercised with Groq. This narrow acceptance does not establish production readiness or validate the whole 25-case benchmark. Only Chrome desktop/mobile viewports were tested; no Safari/Firefox or physical-device claim is made.

No application changes, credentials changes, commits or pushes were made.
