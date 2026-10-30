# Named-policy SLA abstention: confirmed cause and correction

## Exact request and account

The user supplied request `431de335-8b73-4bab-8bd3-fd61795293a1`, HTTP 200 / success=true / grounded=false / no sources, and confirmed ownership of the Northstar files under user 6. The account was verified read-only against the corrected email; the email and session credentials are not included in this report. The previously identified user 4 is not the owner and was not used for the accepted verification.

The [saved safe trace](failed-request-trace.json) shows document retrieval, dataset discovery and schema inspection, followed by `agent-abstention: ambiguous_rule`. Structured operation took 623.9 ms; total request was 724.4 ms. No Groq stage or CSV row query occurred. The citation stage accepted the refusal; it did not reject a generated combined answer.

## Confirmed root causes

### 1. Filename filtering happened after global ranking

The SLA handler sent the named policy in the search question, but this was just embedding/keyword text, not a database filename restriction. Hybrid retrieval ranked the owner's whole corpus and returned three chunks. Read-only reproduction found:

| Global result | Chunk index | Parsed first-response rules |
| --- | ---: | ---: |
| Northstar_Service_Handbook.docx | 4 | 0 |
| Northstar_Service_Handbook.docx | 5 | 0 |
| Northstar_Operations_Policy.pdf | 3 | 0 |

The handler then filtered by the requested filename, leaving PDF chunk 3. The required deadline exists in PDF chunk **1** and parses correctly as P1=1 hour, P2=4 hours, P3=12 hours. Consequently, the rule-selection check in `src/lib/agent-sla.ts` found no P1 rule and returned `ambiguous_rule` before querying CSV rows.

This was an evidence-selection defect, not missing uploaded data or broken parsing. Chunking preserved the threshold sentence intact. The CSV was uniquely discovered as dataset 10, ready, with 36 rows and appropriate `ticket_id`, `severity` and numeric `response_hours` columns.

### 2. A separate overly broad guard became visible after correcting retrieval

After restricting retrieval to the PDF, chunks 3, 2 and 1 were selected. This found the threshold but the existing guard rejected any word `region` or `regional` anywhere in their text. The triggering text concerned recording an assigned region and sending escalations to a regional team lead. Neither changed the first-response deadline.

This second failure occurred before dataset discovery, unlike the original logged request. It was reproduced separately before changing the guard. It is not retroactively described as the original request's failing stage.

## Minimal general-purpose correction

- `src/lib/search-documents.ts`: optional exact, case-insensitive filename restriction, parameterized alongside owner/ready filters **before** semantic/keyword candidate limits and RRF. Unscoped searches retain their existing behavior. Empty, oversized, traversal/control-character scopes are rejected.
- `src/lib/agent-tools.ts`: backend-only search scope passed to services; request cache keys include the filename. A defensive result check retains only the requested filename. Public Gemini/Groq tool argument schemas are unchanged.
- `src/lib/knowledge-agent.ts`: forwards the internal scope to production retrieval.
- `src/lib/agent-sla.ts`: uses that scope for the explicitly named policy; checks region language in relation to deadline/applicability rules instead of treating metadata/escalation words as policy conditions. Exceptions, business hours, conditional applicability, unresolved rules, conflicts and unsupported formats continue to abstain.
- `tests/agent-sla-reliability.test.ts`: named-file propagation/cache separation, metadata/escalation wording, genuine regional/conditional rules and grounded citations.
- `tests/hybrid-search.test.ts`: parameterized scope in both modes, path validation, real PostgreSQL scope selection, foreign-owner and non-ready/deleted exclusion.
- README links to this report. New safe evidence is stored only in this directory; historical results remain unchanged.

No ticket IDs, policy thresholds or Northstar filenames were placed into application logic. No provider/model, authentication, session, CSRF, SQL validation, read-only execution or citation-verification rules were disabled. There is no schema migration.

## Verification with the existing real account's data

The full production `answerWithAgent` service was executed in the confirmed user 6 identity scope, using its existing uploaded PDF and CSV, real PostgreSQL/pgvector retrieval and local BGE. PostgreSQL `default_transaction_read_only=on` was verified. All external HTTP was blocked. It returned grounded=true and passed the unchanged final citation verifier:

| Ticket | Actual response | Policy deadline | Difference |
| --- | ---: | ---: | ---: |
| NS-003 | 1.5 hours | 1 hour | 0.5 hours |
| NS-014 | 1.5 hours | 1 hour | 0.5 hours |
| NS-025 | 1.5 hours | 1 hour | 0.5 hours |

Every statement cites both the policy and the validated CSV query. The plan applies `severity eq P1` and `response_hours gt 1`; equality is excluded. Both operands come from original evidence. See [actual answer and safe validation metadata](real-account-results.json). The measured service run took **1360 ms**, with **one local embedding request, zero external provider requests**. This is a single diagnostic measurement, not a latency benchmark.

Before/after hashes and row counts of users, documents, chunks, datasets and CSV rows matched. No existing records or source files were changed. The read-only inspection/reproduction did not create sessions or transfer ownership.

**Boundary:** this verifies the production backend service with the real owner's data. It does not replay the user's browser cookie or claim a new authenticated browser HTTP response. The historical request establishes the authenticated failure; a fresh UI submission remains the final browser acceptance step.

## Automated verification

| Check | Actual result |
| --- | --- |
| `npm test` | 282 registered; 271 passed, 11 database-only skipped, zero failures |
| `npm run test:fresh-db` | All 282 passed; zero skipped/failures; temporary cluster removed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed |
| Repository security scan | Passed; no findings |
| Git whitespace / report links | Passed |

All provider tests are mocked/offline. Database-enabled regressions use a separate disposable PostgreSQL cluster; the real-account check is independently labelled above. No live Groq calls or repeated 25-case evaluations were made.

## Remaining limitations and manual acceptance

1. Refresh the running app if necessary and submit the same question while logged into the confirmed owner account. Expect a grounded answer for the three tickets above, 1.5 hours actual / 1 hour deadline, with both PDF and CSV citations. This recognized operation needs no Groq request.
2. The deterministic parser and scope checks remain deliberately conservative, with bounded supported question/policy formats. This fix is not universal policy understanding or semantic verification.
3. Named-file retrieval is still top-three within that file. A much larger document or unresolved duplicate filenames can require further evidence; missing/conflicting rules must still abstain.
4. General model-driven questions remain subject to provider quota, tool-use and deadline limits. No live model quality result is claimed here.
5. No commit or push was performed. The current working tree also contains earlier task changes, which must be reviewed separately before staging.
