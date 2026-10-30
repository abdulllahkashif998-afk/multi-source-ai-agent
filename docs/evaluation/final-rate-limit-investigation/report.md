# Final general-agent rate-limit investigation

## Exact request and origin

The reported 5742.5 ms response matches request **747db5ae-f1b3-49b0-a972-34906922adc0** exactly. Its [safe saved trace](request-trace.json) shows **local TPM admission rejection**, not a Groq HTTP 429.

| Stage | Observation |
| --- | --- |
| Backend preparation | Dataset discovery and one schema inspection completed |
| Planning invocation 1 | Groq HTTP 200; reservation 3033, reported total 2130 tokens |
| Tool | Document search completed |
| Planning invocation 2 | Groq HTTP 200; reservation 3814, reported total 1790 tokens |
| Tool | Another dataset inspection completed |
| Planning invocation 3 | Rejected locally before dispatch: origin=local, reason=tpm, HTTP 429 |
| API request | HTTP 429 after 5742.5 ms |

No CSV data query or final answer generation was reached. The top-level request record's `errorType: Error` is a synthetic status-summary record emitted by `withRequest`; the correlated agent/transport records contain the real ChatError and local quota origin. This does not indicate a provider error.

The matching duration identifies the request supplied by the user. Question text is intentionally not logged, so the text-to-request association relies on that supplied observation rather than a stored prompt.

## Quota evidence and exact uncertainty

The two successful calls reserved **6847 tokens combined**, then settled to **3920 reported tokens**, releasing **2927 tokens** of unused reservations. The persisted entries contain those settled charges with pending=false. Completed requests are not left charged at their original reservation amounts.

At that point, those calls alone leave **4080 tokens** of the local 8000-token rolling budget before other pending/remote constraints. A next estimate above 4080 would be rejected even though actual completed usage is below 8000. An actual later response smaller than its reservation cannot be assumed in advance. Retained Groq remaining-token headers can impose a tighter constraint, using the same safe `tpm` reason.

**The rejected third estimate and historical header snapshot were not logged.** The exact third-call requested amount, prior header allowance and contribution of any transient concurrent unsent reservation cannot be reconstructed conclusively. Therefore this report does not claim actual billed usage already reached 8000, or that local rolling usage rather than the retained header was the sole predicate. The precise confirmed cause is the local TPM admission condition; a provider 429, daily exhaustion or accounting leak is not demonstrated.

Read-only ledger inspection at **22:07:29 PKT, 29 October 2026** showed:

| Measure | Snapshot |
| --- | ---: |
| Persisted entries / rolling-day requests | 38 |
| Pending reservations | 0 |
| Unknown-usage entries | 0 |
| Rolling-minute requests / tokens | 0 / 0 |
| Rolling-day token charge | 50006 of 200000 |
| Stored provider remaining-request cap | 962, still valid at inspection |
| Stored provider remaining-token cap | 2755, already expired at inspection |
| Lock directory / cooldown | Absent / none |

Stored expired constraints are removed lazily during the next admission transaction. The expired token cap is not an active restriction at this later snapshot. These later balances do not establish the earlier failure's exact state or provider-wide remaining quota. The provider request cap's stored expiry was 22:05:59 PKT on 30 October; the stored token cap expired at 22:06:59 PKT on 29 October. Local request/token entries age independently over rolling minute/day windows; the provider header is not a universal reset guarantee.

Current configuration was inspected without exposing credentials: **Groq / openai/gpt-oss-120b / application 12 RPM**, using the default private ledger. Unchanged user-confirmed budgets are RPM 30, RPD 1000, TPM 8000, TPD 200000.

## Reconciliation review

- Successful responses replace reservations with reported total usage, as the exact trace demonstrates.
- Known unsent cancelled work is released when cleanup succeeds.
- Sent failures, missing usage and uncertain cancellation conservatively retain the reservation; they are not safely refundable without usage evidence. Abandoned pending entries become unknown charges rather than disappearing.
- Active/waiting requests are bounded; existing fake-clock/worker tests cover concurrency, cancellation, deadlines and restart persistence.
- No stranded pending entry, unknown-usage charge or lock was present in the inspected ledger. No accounting defect was confirmed. It was neither reset nor deleted.

Two new numeric regressions reproduce the observed 3033→2130 and 3814→1790 settlement, hypothetical admission at 4080 versus rejection at 4081, and admission after sufficient rolling expiry. The 4081 value is an explicit **test input**, not a fabricated reconstruction of the missing third estimate. Another test distinguishes a tighter retained header constraint from locally charged usage while preserving the local-429 classification.

## Smallest justified workflow correction

The general planner still advertised dataset discovery and schema inspection even when its request-local catalog was complete and already inspected. This permits an unnecessary model inspection round trip; the trace contains an inspection after backend preparation. Since tool arguments are not logged, it cannot independently prove that both inspected IDs were identical.

`src/lib/knowledge-agent.ts` now uses the existing AI SDK `activeTools` option:

- Complete, nonempty catalog: advertise document search and validated dataset querying.
- Complete empty catalog: advertise document search only.
- Partial or unavailable catalog: retain all original discovery/inspection/query tools.

The backend tool functions, ownership checks, inspection gate, read-only SQL compiler, source evidence and citation verifier remain unchanged. The model cannot query an unauthorized dataset through this change. It does not add a resolution-SLA handler, change limits, reset quota, add retries, change models or promise fewer calls in every case.

`tests/general-agent-stabilization.test.ts` verifies the actual outbound tool lists for complete, empty and partial catalogs. New `tests/final-quota-investigation.test.ts` verifies the precise accounting boundary described above. README and this new report/evidence directory are the documentation changes. No other application behavior was altered for this investigation.

## Verification

| Check | Result |
| --- | --- |
| Initial focused accounting/quota/general tests | 23 passed, mocked providers/fake clocks |
| Final focused accounting/general tests | 6 passed, including six varied sequential general-path scenarios |
| Database-enabled regression suite | 294 passed; zero skipped/failures; separate disposable cluster removed |
| TypeScript | Passed |
| ESLint | Passed |
| Webpack build | Passed |
| Repository security scan | Passed; no findings |
| Documentation links / whitespace | Passed |

The general-path scenarios exercise document retrieval, CSV filtering/sorting, aggregation, combined reasoning, missing evidence and conflicting evidence through the SDK with scripted provider responses. They verify workflow and citation enforcement, not real Groq answer correctness. Existing quota tests cover actual/unknown usage reconciliation, local/provider 429, cancellation, pending concurrency and safe failures. Database tests use isolated fictional data; existing application data was not changed. No live Groq requests or 25-case benchmark reruns occurred.

## Submission decision and remaining limitation

**No safe general fix can guarantee arbitrary consecutive live questions today within 8000 TPM.** A question can legitimately need several input-heavy calls and a final answer reservation. Preparing schemas and removing redundant tool options reduces avoidable overhead, but does not change this capacity constraint. Further reductions in output caps or changes to context/evidence serialization require live calibration and quality verification; do not make speculative submission-day changes.

The live question `How many tickets missed their resolution SLA?` was **not** rerun. No claim is made that it now succeeds. Approved live testing would be needed to establish that, and may still encounter legitimate quota limits. Existing verified deterministic functions and prior documented general capabilities remain available.

For local TPM, retry only after enough charged entries age beyond their 60-second token windows, pending work settles, and any remote constraints/cooldowns expire. For the two known calls alone, their token-window expiry times were 22:05:13.504 and 22:05:18.110 PKT on 29 October. Those times do not include unknown historical header restrictions or subsequent requests. Daily charges expire over 24 hours. Each next request must fit its estimated reservation; 12 RPM describes API call spacing, not twelve complete questions per minute. Do not delete the ledger to retry.

Submission can proceed **as a tested prototype with the unresolved general live-throughput limitation explicitly disclosed**. It must not claim arbitrary consecutive-question reliability or public production readiness. No commit/push was performed; the complete pending working tree still needs explicit staging review. Stop further speculative redesigns for today's submission.
