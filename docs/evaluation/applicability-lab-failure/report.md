# Applicability Lab combined-query failure investigation

30 October 2026. No live provider calls or application/data changes.

## Two distinct requests

The development logs contain a matching two-planning-call provider failure and a separate local-quota rejection about 20 seconds later. Because logs intentionally omit question text, the user's Network request ID is still needed to conclusively associate the displayed message with a particular request. See [safe-traces.json](safe-traces.json).

| Request | Logged sequence | Final application status |
|---|---|---|
| 8bd72391-b2bc-4112-bf3f-99ebbe31f866 | General planning call 1 completed; document search succeeded; planning call 2 failed with provider HTTP 400/tool_use_failed | 502, about 6485 ms |
| 7f7a5eac-00fc-4d81-a2ac-497a756c9bca | General planning call 1 attempted; local TPM admission rejected before HTTP dispatch | 429, about 197 ms |

The first request's structured-operation check returned in 3.9 ms without an answer. Dataset discovery and two schema inspections completed before model planning. Planning call 1 completed in 1038.1 ms, followed by local BGE embedding (250.2 ms) and successful document search (about 275 ms). Planning call 2 then failed. No validated CSV query, pre-generation applicability gate, final generation or citation verification was reached.

Its safe SDK diagnostic was AI_APICallError, HTTP 400, providerCode=tool_use_failed, providerToolFailure.reason=unrecognized_envelope. That is a provider-side failure before the tool call was accepted for backend execution, not application-side CSV argument rejection. The failed_generation body is not retained, so the attempted function and exact malformed structure are unknown. There is no basis for guessing an SQL/column/exclusion bug or repairing/executing failed arguments.

The route maps this non-ChatError to AGENT_FAILED/502. The separate quota error maps to PROVIDER_RATE_LIMITED/429 with local origin, tpm reason and safe retry guidance. These codes follow the inspected API mapping; raw historic response bodies were not captured in the server log. Frontend code selects the rate-limit message only for an HTTP 429 response. The evidence therefore supports a subsequent local-quota request explaining that screen, rather than a single request turning provider HTTP 400 into 429. Exact UI association remains pending the user's request ID.

## Quota evidence

The later request's admission diagnostic records:

- Requested reservation: 3222 tokens.
- Rolling local charge: 5404; local capacity remaining: 2596 of 8000.
- Retained provider-header token allowance: 2205, an additional tighter bound.
- Daily charge: 128061, below the 200000 daily limit.
- Safe retry guidance: 41 seconds.

The persisted ledger's two latest completed entries are consistent with the provider sequence: reservation 3222 settled to reported usage 1324; reservation 4080 completed with unknown usage. Conservative accounting retains all 4080 for the unknown failed request. 1324+4080=5404 exactly matches the subsequent local diagnostic. Both entries are nonpending: this is not evidence of a pending-reservation leak. Ledger records have no request IDs, so this numerical/timing correlation is distinguished from direct request-linked usage logs.

The retained provider allowance's stored reset is 2026-10-30T11:06:42.775Z. The 41-second guidance exceeds the current per-model-call admission window (at most roughly 20 seconds, after preserving response headroom). Safe waiting therefore could not fit this later call, even though the outer Agent deadline is longer. No quota reset, artificial limit increase or accounting refund was applied. A 400 can have unknown token consumption; treating it as free would be unsafe.

The first request lacks provider-usage/groq-http logs, despite having planning callbacks and a provider exception. Its providerAttemptCount remains zero in callback records. Dashboard observations and ledger entries supplement this instrumentation gap; zero in that counter is not evidence of zero actual provider calls. No stale-worker explanation was established.

## Routing and applicability

A direct read-only parser check of the exact submitted string returns null. Existing deterministic syntax accepts a bounded set of list/short/named SLA intents; the submitted `Using ..., which ... Include their actual response times ...` form does not match. General planning is consequently expected. No extra wording handler was added.

The new fixture does explicitly provide organization and UTC incident dates for known-scope rows, plus deliberate missing-data cases. Creating that evidence did not implement a generic backend predicate evaluator for organizational/date applicability or maintenance exclusions. The current gate conservatively rejects global applicability restrictions rather than automatically matching them to CSV fields. This limitation was documented when the fixture was created.

This particular failed request never reached that gate or queried CSV rows, so it cannot establish that scope fields were correctly evaluated. Schema preparation is not proof that the model or backend established organization/period applicability. Nor was the fixture proven to be the source actually selected: the tool trace does not retain filenames or content. Do not claim an applicability success or failure from a provider planning error alone.

## Change decision and recommendations

No application fix was applied: the exact provider envelope defect is unknown, the later local quota rejection is legitimate, and the query's general routing is not itself a defect. Replacing it with a pattern-specific handler or bypassing the global guard would not solve the general problem safely.

Minimal next evidence needed is the Network request ID/status/body for the displayed error. For future provider failures, safe diagnostics could distinguish non-JSON envelopes from missing/multiple tool-call envelopes without logging contents; that would aid diagnosis, but it would not itself fix provider generation. No live reproduction was attempted.

A broader applicability evaluator remains a separately scoped capability, requiring explicit supported policy predicates, field binding, date/exclusion handling, unknown-value behavior, original evidence references and isolated SQL/BGE regressions. It is not implemented under the guise of fixing HTTP 400.

## Validation and preservation

Focused existing regression suites were run offline to check provider-400 handling, local/provider 429 distinction, deadline-aware admission and general orchestration. Result: 26 registered, 25 passed, one database-only test skipped, zero failed. No provider was contacted. Since there was no application fix, no new database/BGE acceptance success is claimed; the original trace itself shows successful local embedding/retrieval before failure. The fixture's independent arithmetic checks remain separate from application accuracy.

New files are this report and allowlisted safe traces only. Original user data, fixture files, historical reports, source code, credentials, model and quota ledger were not modified. No commits or pushes.
