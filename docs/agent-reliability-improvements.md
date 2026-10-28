# Multi-Source Agent reliability improvements

Verified on 28 October 2026. No model configuration, credentials, database schema or existing records were changed. No live Groq call was made for this work.

## Confirmed cause

Failed request: `810afae8-32cc-4685-bb9f-06ff3c1a85f6`.

Question: “How many students and teachers are listed in users-import-template (1).csv?”

The agent's `generateText` planning call used `timeout: 30_000`. In the installed AI SDK this number is the **total generateText duration**, including the multi-step tool loop and paced waits. It was not a separate 30-second allowance per HTTP call. The route had a 60-second budget, but the inner planning call stopped first.

The recorded trace shows:

| Historical observation | Recorded value |
| --- | ---: |
| Completed planning model calls | 6 |
| Dataset discovery tool | 23.1 ms |
| Schema inspection tool | 2.0 ms |
| Query attempts rejected during tool validation | 4 |
| Those validation/tool attempts combined | 24.4 ms |
| Successful CSV row/aggregate queries | 0 |
| Planning timeout | 30,005.5 ms |
| Agent failure | 30,007.5 ms |
| Full request / HTTP 504 | 30,068.6 ms |
| Final generation/citation verification | Not reached |

All four query failures occurred before a data query. The exact rejected plans/compiler reasons were not retained, so this report does not claim that a particular column, COUNT option or filter caused them. The inspected schema and an independently executed valid query establish that the dataset itself was queryable.

The model-call durations include roughly five-second request spacing, consistent with the existing conservative 12-RPM policy. There is no recorded 429, Retry-After or quota denial in this trace. Groq TPM/RPM restrictions are therefore **not a confirmed cause**; the confirmed cause is the SDK's total planning deadline plus repeated invalid-plan repair rounds. Do not raise RPM to hide it.

## Actual data check

A read-only metadata check identified a ready dataset owned by user 4, ID 8, with 269 rows and a text `role_name` column. A grouped COUNT through the existing owner-scoped structured query service returned the expected **158 students and 51 teachers**. No names, emails, phone values or other personal rows were inspected or sent to a provider.

The valid plan is:

```json
{
  "datasetId":"8",
  "aggregate":{"op":"count"},
  "groupBy":["role_name"],
  "sort":{"column":"role_name","direction":"asc"},
  "limit":100
}
```

COUNT counts rows and omits aggregate.column. The actual service still validates the plan and columns, verifies owner/readiness, parameterizes SQL, starts a read-only transaction and applies its five-second SQL limit. The independent initial query took 63.8 ms including initial connection/service overhead; that one observation is not an SQL latency benchmark.

## Permanent improvements

### 1. Coordinated agent deadlines

The request/agent ceiling remains **60 seconds**. The shared budget uses the earlier of the enclosing request deadline and 60 seconds from agent entry, and combines that with caller cancellation. An exhausted deadline aborts immediately.

The SDK is now explicitly configured with `timeout: {stepMs: 30_000}`. The existing 30-second provider HTTP cap remains unchanged. Planning receives an explicit deadline with **15 seconds reserved for final generation**, so planning has at most 45 seconds in a fresh request and less if earlier request work used time. Final generation shares the same overall signal; it does not get a fresh extra 60 seconds.

This removes the accidental 30-second multi-step cutoff while retaining bounded steps and a bounded whole request. It is not an unbounded timeout increase. Per-step SDK cancellation is forwarded into backend tool execution, and the agent checks cancellation again after final generation before verifying/returning an answer.

### 2. Request-local reuse of successful tool work

Each agent session caches successful discovery, exact repeated search questions and normalized structured query plans. Concurrent identical calls share one pending operation. Repeated queries reuse the original C citation; repeated exact searches reuse their D sources rather than appending duplicates. Schema inspection uses the already discovered catalog.

Caches are private to one request/session, never global or shared between accounts. Query authorization/discovery/inspection requirements and compiler validation still run before a cached query can be used. No caller-supplied user ID is trusted. Different requests do not share catalog, row or document caches. Failed calls are not retained as successes, so genuine recovery is possible. Returned values are cloned to prevent accidental mutation of stored evidence.

Every tool attempt, including cache hits, still counts toward the existing ten-tool limit. The eight-step planner limit is unchanged. No broad semantic/fuzzy cache or cross-user content cache was introduced.

### 3. Cancellation cannot publish late evidence

Tool waiting is abort-aware even when a service is only cooperatively cancellable. A canceled operation stops being awaited, and completion checks prevent late document/CSV results from entering evidence or the cache. HTTP/Ollama calls keep receiving their abort signals.

CSV discovery/query services now accept an optional signal and check it after connection acquisition and reads, including before starting the data query after owner/schema lookup and before committing a successful read. Existing transaction/SQL validation and timeout policies remain intact. Evaluation adapters forward the same signals.

Already-running PostgreSQL statements are not forcibly canceled by this change. They remain bounded by existing SQL limits, finish/roll back and release their connections; subsequent statements/evidence publication are prevented after cancellation. Response cancellation and instantaneous server-side SQL cancellation are different guarantees.

### 4. A narrow, deterministic structured-count path

A straightforward, unfiltered English request for students/teachers in one explicitly named CSV can now be answered without asking an LLM to rediscover metadata and invent a query plan.

It performs normal backend-controlled discovery, unique filename matching, schema inspection and a validated grouped COUNT. It accepts exactly one suitable text role/category column, matches requested role labels conservatively, verifies integer counts and complete group coverage against dataset row_count, and declines absent/ambiguous labels or possibly truncated results.

It does not hardcode the filename, dataset ID or expected numbers. Tests run the same wording against different fictional totals. No filters, policy thresholds, dates, active-user qualifications or combined questions are silently interpreted by this shortcut. Duplicate dataset names, ambiguous columns and unsupported wording fall back to the existing general agent. Discovery's existing 100-dataset cap remains.

The answer uses actual SQL values. It selects original C-source excerpt references and runs the same reference resolver and strict final verifier. This is an honest deterministic computation, **not a fabricated Groq response**. API answer/source formats remain unchanged. The selected provider must still be configured, as before, but this path makes no provider HTTP request.

Any successful metadata/query work remains reusable if a conservative shortcut check declines and the general planner is needed. Preparation still counts toward the existing tool budget; limits are not reset to hide work.

### 5. Actionable validation feedback, with no extra provider retries

Known compiler failures now give fixed safe guidance: use inspected column names, COUNT without a column, numeric-only SUM/AVG, valid filter types, aggregation with grouping and valid aggregate sort keys. Raw SQL, values, private column names and exception bodies are not logged or returned as diagnostic detail. Planning instructions explain row counting and reuse explicitly.

Safe error codes identify these validation classes in logs and remain readable by saved evaluation reports. Model/HTTP retry behavior is unchanged: SDK maxRetries=0; only the existing transport's bounded 429 retry is allowed. HTTP 403/5xx/network errors are not automatically retried. RPM, queue bounds, provider/model settings, BGE and retrieval strategy were not modified.

## Before/after measurements

Five serial post-fix backend checks ran against the actual existing dataset, with **all HTTP blocked**. Every check returned grounded=true, 158 students, 51 teachers and C1 CSV evidence whose quotes were exact substrings of its original structured-query result. The dataset fingerprint was unchanged.

| Measure | Historical failure | Post-fix structured count |
| --- | --- | --- |
| Result | HTTP 504, no answer | Five successful backend responses |
| Provider planning/generation HTTP calls | Six completed planning calls before timeout | 0 |
| Invalid query attempts | 4 | 0 |
| Valid structured data query | 0 | One grouped COUNT per request |
| Citation verification | Not reached | Passed in all five checks |
| End-to-end observation | 30,068.6 ms, real API request | See backend timing distribution below |

Post-fix caller-observed backend times, milliseconds:

| Samples | Minimum | p50 | p95 | Maximum |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 6.693 | 7.790 | 58.239 | 58.239 |

The individual observations were 58.239, 9.288, 7.790, 6.838 and 6.693 ms. The first includes startup/JIT/initial service overhead; later requests reuse the process/pool but start fresh agent sessions. With five samples, nearest-rank p95 equals the maximum and is not a production SLA.

The historical measurement includes authenticated HTTP processing. The post-fix check used actual backend/default services with a trusted owner scope, not browser cookies, HTTPS/network or session validation. These are different scopes, so no exact speedup ratio is claimed. The measured reduction in provider calls is real for this branch; the gain comes from avoiding unnecessary model choreography, not an assertion that SQL became thousands of times faster.

Safe samples, request IDs, source-match flags and overlapping stage observations are in [count acceptance data](agent-reliability-count-acceptance.json). Primary post-fix request ID: `3066b0eb-1345-461c-8f18-c22ceb63482c`. Its structured-count stage was 47.2 ms and citation verification 3.4 ms; warmed stages were lower. Some csv-query instrumentation is nested/duplicated by wrappers; do not sum stage times or count duplicate events as independent samples.

### Simulated measurements, clearly separate

An installed-SDK regression advances a virtual clock beyond 30 seconds across several healthy planning calls, then completes final generation within the coordinated request budget. It also repeats a normalized query and verifies only one backend query occurs. A separate virtual-clock test stalls one model step past 30 seconds and verifies cancellation after one provider attempt, without retry.

These prove timeout semantics and call counts under controlled conditions. They are **not live Groq latency or answer-quality results**. Cache tests verify one backend operation for repeated requests within a session, while another session executes independently. No measured live document-only/combined before/after latency is claimed.

## Security and grounding preserved

- Backend identity still comes from verified sessions. Session/CSRF enforcement and per-owner discovery/query filters are unchanged.
- The shortcut never accepts a client dataset/user ID; it obtains the ID from the owned ready catalog. Ambiguous filenames are not silently selected.
- SQL compilation, parameterized values, read-only transactions, five-second statement limits and row/result bounds remain in force.
- D/C source identities, reference/source binding, exact quote membership and rejection of statement-injected citation markers remain strict. No normalization, invented source, model substitution or quote repair was introduced.
- The deterministic branch uses exact SQL facts and conservative eligibility. It cannot claim zero for an absent role or infer a filter/policy. The general planner retains document and multi-source reasoning and its existing semantic limitations.
- All 12 public-table counts/content fingerprints matched before and after the database-enabled regressions. Existing documents, datasets, users and authentication records were preserved; no migrations were run.

## Tests and actual results

Thirteen focused tests cover:

- The exact failed question on fictional data with 158/51 counts and on different totals, with provider/Ollama HTTP prohibited.
- Conservative parser/fallback behavior, duplicate filenames, ambiguous columns, absent labels and truncation.
- Discovery/search/query cache reuse, normalized plans, single-flight behavior, recovery and mutation isolation.
- Caller/SDK child cancellation, non-cooperative tools and suppression of late evidence.
- Invalid COUNT plans, safe corrective guidance and inaccessible dataset rejection.
- The total/reserved/step deadlines, simulated multi-step planning beyond 30 seconds and a stalled single step.
- Authenticated API session/CSRF/owner enforcement before deterministic SQL compilation.
- The same scenario on 269 isolated fictional PostgreSQL rows with actual grouped COUNT and verified citations.

| Check | Actual result |
| --- | --- |
| Focused tests, normal run | 12 passed; one optional database skip |
| Full npm test | 208 registered; 201 passed; seven optional database skips; zero failures |
| All database flags enabled | 208 passed; zero failures/skips |
| TypeScript | Passed |
| ESLint | Passed |
| Supported isolated Webpack build | Passed |
| Actual-dataset backend count acceptance | Five passed; zero attempted/provider/Ollama HTTP calls |
| Existing data integrity | Target dataset unchanged during acceptance; all 12 public tables unchanged across regression interval |

Existing regressions cover document-only, CSV-only and combined SDK workflows, both providers, quota/403/5xx failures, cancellation, authentication, cross-user isolation, citation references and SQL protections. No live Groq request was made for this task; mocked provider completions are not presented as real AI accuracy.

## Changed files

- `src/lib/agent-budget.ts`: coordinated agent budgets and abort-aware waiting.
- `src/lib/agent-structured-count.ts`: conservative authorized deterministic category COUNT.
- `src/lib/agent-tools.ts`: request-local successful-result caching, cancellation checks and validation guidance.
- `src/lib/knowledge-agent.ts`: explicit SDK step timeout, reserved final-generation budget, signal forwarding and deterministic branch.
- `src/lib/generic-csv.ts`: optional cancellation checks for read services; SQL protections unchanged.
- `src/lib/reliability.ts`: safe cache/count stages and validation reason codes.
- `evaluation/database-adapter.ts`: forwards read-operation signals.
- `evaluation/answer-quality-cli.ts`: accepts the additional allowlisted failure codes on offline replay.
- `tests/agent-reliability-improvements.test.ts`: thirteen focused regressions.
- `docs/agent-reliability-improvements.md` and `docs/agent-reliability-count-acceptance.json`: this report and safe measurements.

## Remaining limitations and acceptance status

The exact CSV calculation is verified against real PostgreSQL data and through authenticated-route mocks, with no LLM dependency. A real authenticated browser acceptance check is still recommended to include UI/session/proxy behavior. This backend check did not replay a browser session.

General document-only, CSV-only and combined live-provider acceptance remains a separate explicitly authorized activity. No live Groq call is needed to establish this narrow deterministic count's arithmetic, but provider-assisted questions remain probabilistic and can still fail under quota, token, access or latency constraints. Exact citations do not prove semantic entailment for general model prose.

The fast path intentionally recognizes a small unambiguous English count pattern and literal filenames/role categories. Other wording and calculations retain the planner; the change is not a universal natural-language SQL parser. More schemas, case variants, missing/ambiguous labels or large group sets can legitimately fall back.

Request-local caching does not deduplicate paraphrased searches, persist across requests or coordinate workers. In-flight evidence retains the application's existing snapshot behavior; deletion does not revoke already retrieved excerpts. Provider pacing remains process-local, without proactive TPM/daily quota accounting. SQL cancellation is cooperative and existing statement limits govern physical cleanup. The 60-second ceiling and 15-second final reserve can still reject a request that spends too long planning; model/tool limits were not increased.

No production-scale load test, new provider quota certification, universal hallucination guarantee or public-production readiness claim is made. The confirmed timeout/avoidable-count failure has a tested permanent path; broader live AI acceptance still requires explicit approval.
