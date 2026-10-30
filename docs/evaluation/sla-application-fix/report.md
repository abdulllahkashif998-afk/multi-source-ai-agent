# SLA application failure: diagnosis and local verification

## Confirmed request trace

Request `41443f4d-3833-4ddc-9d14-1655b8bd23b7` returned **502 / AGENT_FAILED** (browser evidence supplied by the user). The same ID exists in the local development log. An allowlisted [saved trace](failed-request-trace.json) preserves the relevant stages without source contents. Its server timeline shows:

| Stage | Observed result |
| --- | --- |
| Deterministic operation / count routing | Completed in 0.1 ms / 0 ms; no shortcut selected |
| Groq planning call 1 | Successful; 749 ms including transport |
| Local BGE embedding | Successful; 88.8 ms |
| Document retrieval | Successful; 110.9 ms |
| Groq planning call 2 | Successful; 4991.3 ms including pacing |
| Dataset discovery | Successful; 36.1 ms |
| Planning call 3 admission | Rejected locally: quotaReason=tpm, rateLimitOrigin=local, internal HTTP 429 |
| Agent invocation | Failed with the same internal 429 |
| Final HTTP response | 502 after 6105.9 ms |

The third call was rejected before dispatch. Final generation and citation verification were not reached. Successful provider calls therefore did not imply a successful application answer. No provider 400, provider 429, timeout, Ollama failure, SQL failure or citation rejection appears in this request's failed stage. The server did not log private prompts or the ledger balance at that instant, so an exact historical token balance cannot be reconstructed.

## Root causes and targeted changes

1. **Unsupported question grammar.** The deterministic SLA path accepted `Using ... list ...`, but not the user's `Which P1 tickets missed ... according to ...` structure. It returned null and used the multi-call planner, which subsequently exhausted local TPM admission. The parser now recognizes that bounded question structure for arbitrary PDF/DOCX and CSV filenames and P-number priorities. It still rejects extra filters, unrelated metrics and unsupported instructions. Missing units are inferred only from the inspected numeric response-hours/minutes column and must match the document rule.
2. **Quota error identity mismatch.** The route relies on `error instanceof ChatError`. Its observed 502 despite an internal named ChatError/429 demonstrates that this identity check failed. Groq's process-global cached transport survives development module reloads and retains older constructors. A focused regression reproduces an old-constructor error through the SDK and authenticated route. At the current Groq boundary, only an allowlisted rate-limit code, status, origin and reason are recreated as a current RateLimitError. Raw messages are discarded. The regression returns **429 / PROVIDER_RATE_LIMITED**, with a request ID, rather than a generic 502. The persistent ledger, pacing and budgets remain unchanged. A development-server restart clears older cached transport/context closures; do not delete the quota ledger.
3. **Observed policy format was unsupported.** Read-only inspection found compound commitments such as `P1 tickets require first response within ...; P2 within ...; P3 within ...`. The parser now handles this exact generic syntax. Later priorities inherit only the expressly named first-response metric. Resolution targets are not used. Original sentence text is retained for strict quote verification. Conditions and ambiguous rules continue to abstain.
4. **Evidence contract coverage.** Added `missed` to the existing combined-comparison classifier so this formulation also requires both document and CSV citations per conclusion.

No fixture values or filenames were added to application logic. The exact supplied filenames appear only in regression inputs. No AI settings, authentication, ownership checks, SQL validation, citation verification or request deadlines were relaxed.

## Configuration verified without provider calls

The current local environment selects **Groq / openai/gpt-oss-120b**, with application pacing **12 RPM**. This differs from the earlier audit's named 20b model; it was not changed. Both are allowed by the existing integration. Actual current 120b provider quota/compatibility was not tested over the network. Local admission budgets remain unchanged.

## Files changed for this follow-up

- `src/lib/agent-sla.ts`: bounded missed-SLA grammar and compound deadline parsing.
- `src/lib/groq-transport.ts`: safe normalization of quota errors across cached module generations.
- `src/lib/agent-evidence-contract.ts`: enforce mixed-source support for missed-SLA comparisons.
- `tests/agent-sla-reliability.test.ts`: exact question structure, generic values, equality exclusion, original quote support, compound policies, unsupported condition rejection and real SQL coverage.
- `tests/groq-quota.test.ts`: retained-constructor error through SDK/authenticated API returns safe 429.
- This new evidence directory: report, fictional API/browser results, desktop/mobile screenshots. Earlier evaluation artifacts are preserved.

## Actual local verification

| Check | Actual result |
| --- | --- |
| Standard suite | 280 registered; 269 passed, 11 database-only skipped, zero failures |
| Fresh database suite | 280 passed, zero skipped/failures |
| Focused SLA suite | 12 passed, one database-only skipped |
| TypeScript | Passed |
| ESLint | Passed |
| Webpack production build | Passed |
| Repository security scanner | No findings |

The initial sandboxed standard run could not execute its two-worker subprocess test. The permitted full rerun passed. Disposable integration fixture setup initially needed explicit timestamps because TEMP tables intentionally omit public defaults; the corrected isolated run passed. These setup failures are not reported as application successes.

### Authenticated route with real PostgreSQL and BGE

A separate temporary PostgreSQL 18/pgvector cluster ran the real authenticated route and hybrid retrieval with local BGE, fictional documents and rows. External HTTP was blocked. Three local embedding calls occurred, zero external attempts and zero Groq calls. The owner received **HTTP 200, grounded=true** in 243 ms, with verified D1/C1 evidence. A foreign user received grounded=false/no sources; missing session and CSRF returned 401/403. See [API evidence](api-results.json).

Fictional expected and returned answer:

> Ticket F-1 (P1): actual first-response time is 3 hours; the documented deadline is 2.5 hours; difference is 0.5 hours. [D1] [C1]

The ticket exactly at 2.5 hours and a P2 ticket were excluded. Values deliberately differ from the real policy. The cluster was removed. The existing application database was never used by this integration; the earlier configuration/policy-format inspection was read-only.

### Real authenticated browser

A separate production application copy, HTTPS, a fresh isolated database, actual signup/session/CSRF, actual PDF/CSV upload, actual ingestion/BGE, and the exact question text were exercised without response interception or provider mocks. The filenames matched the question but all uploaded contents were fictional. The configured provider was protected by a server-side external-network blocker.

The first run returned a valid abstention, not Request failed: the fixture introduction said `only`, triggering the unchanged conservative policy-scope guard. This failed expectation is preserved in [first browser result](browser-results.json). Removing that unrelated word from the fictional introduction produced the [passing retest](browser-results-retest.json). The guard was not weakened. This demonstrates a remaining over-conservative abstention risk.

The retest returned **200 / grounded=true**, request `b9d843f7-d860-4d0b-808c-f6abb41cce7b`, server duration 162.8 ms. The browser operation plus checks/screenshots took 670 ms. Rendered text matched the API answer above. Both document and CSV source regions were displayed; all returned quotes were checked against original source text. Desktop and 390px mobile screenshots: [desktop](desktop-retest.png), [mobile](mobile-retest.png). No horizontal overflow occurred. The server network audit recorded four local Ollama requests across the two browser runs and no external requests. Temporary server, database, files and accounts were removed.

## Limits and remaining acceptance

- The original live failure was traced from its exact request ID; no new live Groq reproduction was made. The stale-error behavior was reproduced offline, and the corrected exact question flow passed with fictional evidence in a real browser.
- The existing user's actual uploaded policy/dataset and current browser account were not retested end-to-end. Parser format compatibility was inspected read-only, not accepted as proof of a complete answer. Conservative scope guards, retrieval omissions, truncation or unsupported policy layouts can still abstain.
- Live Groq is unnecessary for the recognized deterministic operation. General-agent live acceptance and real provider compatibility remain unverified and require explicit approval before calls.
- The fix does not increase quota budgets or guarantee arbitrary multi-step planner requests fit TPM/deadlines. Cached development transports can retain old diagnostic contexts until restart.
- Citation provenance is necessary evidence, not universal semantic entailment or human-reviewed AI accuracy.
- No historical evaluation was rerun or relabelled. No existing user records, credentials or model configuration were changed. No commit or push was performed.

## Delivery continuation check

The interrupted task was resumed on 2026-10-29. Implementation files, final test logs, API results, both browser attempts and screenshots were present; no completed expensive test or live evaluation was repeated. Saved final TypeScript/ESLint/build/security results were inspected. All 41 baseline historical evidence files remained byte-for-byte unchanged. The private temporary browser server and database had already been cleaned up.

README now indexes this report, and the earlier reliability report links to it. Current branch is `main`. At this check, Git had 29 modified tracked paths and 30 untracked entries (directories count as entries), including pre-existing work from earlier tasks; the staging area was empty. Nothing was committed or pushed. The earlier staging manifest is a dated proposal and must be refreshed/reviewed for the complete current working tree before an approved commit.

Ready for final documentation and explicit staging review, subject to the remaining acceptance and operational limits above. This is not an unconditional public-production-readiness or live-model-success claim.
