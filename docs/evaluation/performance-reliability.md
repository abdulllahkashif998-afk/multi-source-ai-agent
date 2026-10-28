# Day 9 Step 4 — Performance and reliability evaluation

Verified on 27 October 2026.

## Main findings

The local benchmark completed **360 component measurements with zero failed samples**, using real PostgreSQL and Ollama on isolated fictional fixtures. Thirty observations were collected per component. The 34 controlled fault scenarios also passed. No Gemini or Groq API requests were made.

BGE embedding was the largest measured local component. Median embedding time was 41.71 ms, compared with 43.11 ms for semantic retrieval and 44.45 ms for hybrid retrieval including their own embeddings. Structured CSV calls had median times between 1.65 and 1.85 ms on this tiny fixture corpus. These figures are not production capacity or end-to-end AI answer latency.

One confirmed defect was fixed: optional callers of `generateEmbedding()` received no application deadline. The maintenance re-embedding script uses that path. The helper now applies the same existing 15-second deadline whether or not the caller supplies a signal. Models, vectors, retrieval strategy, providers and API schemas are unchanged.

## Environment and method

- Machine: Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz; 4 logical CPUs / 4 available; 14.99 GiB RAM.
- OS: linux 7.0.0-38-generic, x64; Node 22.22.3.
- PostgreSQL: 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1); pgvector 0.8.1.
- BGE: `hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0`, 768 dimensions. Model artifact digest: `84458fec40824b6a9c3df75ab7f88c36a46c6f098cf3517005ee77365e93d3df`.
- Original 25-case benchmark hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. No case definitions or source labels changed.
- Corpus: seven authorized ready document chunks, three ownership/status document decoys, three CSV datasets with 11 rows. Text, plans and expected calculations come from the unchanged fictional fixtures.
- Corpus embeddings were prepared once before timing (739.46 ms); two warmups per measured path were excluded. This is not a cold-model test.
- Thirty serial repetitions per component; six document questions rotate. Semantic/hybrid order alternates each iteration. Six structured CSV plans cover COUNT, SUM, AVG, GROUP BY, filtering and sorting. There is no sustained concurrency or stress load.
- Timers use performance.now(). Durations include instrumentation and caller-side result assertions; direct CSV measurements also include the independent fixture oracle check. The separately recorded PostgreSQL stages exclude that oracle. Measurements are caller-observed service timings, not bare database execution plans.
- Each scripted tool workflow uses real search, discovery and validated query services, then the existing citation verifier on authored answer text. Tool choices and answer text are scripted. Gemini/Groq planning, generation, token throughput and full authenticated HTTP response latency were not measured.
- Temporary tables shadow four public tables inside one rollback-only fixture transaction. IDs are explicit; public defaults, sequences, indexes, FKs and stored files are not copied or changed. Fixture service transactions use savepoints and serialized leases. Consequently these timings do not measure real COMMIT cost, production read-only enforcement, index scaling or multi-connection contention.
- Existing ownership filters are used before evidence is returned. Retrieval rejects out-of-scope IDs; CSV values are checked against the independent oracle. Real HTTP calls are restricted to the configured Ollama embed/tags endpoints. Provider traffic is blocked.
- Host CPU scheduling, other idle services and OS cache were not controlled. There is no confidence interval or claim of statistically significant semantic/hybrid speed differences.
- Evaluation-process RSS: 107.20 to 113.08 MiB. This excludes Ollama, PostgreSQL and application-server memory and is not a leak test.

Actual samples and safe stage records: [local results.json](performance-local/results.json). Compact tables and all scenario outcomes: [local generated report](performance-local/report.md). The separately executed [offline report](performance-offline/report.md) contains no real service timing samples.

## Real component latency

Milliseconds; nearest-rank percentiles. Failed samples are counted separately and excluded from successful distributions. Here every component has 30/30 successful samples.

| Component | Samples | Minimum ms | p50 ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| BGE query embedding | 30 | 36.197 | 41.710 | 54.581 | 62.280 |
| Semantic retrieval, including embedding | 30 | 37.172 | 43.108 | 56.346 | 65.115 |
| Hybrid retrieval, including embedding | 30 | 39.482 | 44.446 | 57.638 | 63.116 |
| CSV COUNT, 5 sales records | 30 | 1.472 | 1.664 | 2.343 | 4.869 |
| CSV SUM, 51 units | 30 | 1.350 | 1.851 | 3.316 | 5.346 |
| CSV AVG, 10.2 units | 30 | 1.404 | 1.810 | 2.992 | 3.377 |
| CSV grouped SUM, Alpha/Beta/Gamma | 30 | 1.515 | 1.802 | 4.124 | 4.843 |
| CSV East filter + descending sort | 30 | 1.328 | 1.650 | 2.280 | 3.074 |
| CSV filtered COUNT, cost > 500 | 30 | 1.423 | 1.721 | 3.637 | 4.218 |
| Dataset discovery | 30 | 0.841 | 0.986 | 2.165 | 3.306 |
| Scripted document + CSV tool workflow | 30 | 42.824 | 45.319 | 64.418 | 65.091 |
| Existing citation verification, scripted answer | 30 | 0.050 | 0.067 | 0.284 | 0.294 |

The tool workflow includes search, dataset discovery, local schema inspection, grouped CSV querying and citation verification. Its citation sample is nested inside the workflow, not an additional independent request. The 360 records include these nested samples; do not sum distributions to estimate end-to-end latency.

## Available application stage timings

These are actual safe telemetry events captured during the component run. Existing logs round to 0.1 ms, unlike the direct timers above. PostgreSQL events include statements such as SAVEPOINT/SET/ownership SELECT/data SELECT/RELEASE, not only business data queries.

| Stage | Samples | Minimum ms | p50 ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| postgres | 1380 | 0.100 | 0.200 | 2.100 | 4.600 |
| embedding | 120 | 35.900 | 41.200 | 54.600 | 64.000 |
| retrieval | 90 | 37.200 | 43.500 | 57.600 | 65.100 |
| csv-query | 210 | 1.100 | 1.500 | 2.900 | 5.100 |
| tool:searchDocuments | 30 | 39.300 | 40.900 | 59.300 | 61.800 |
| tool:discoverDatasets | 30 | 1.100 | 1.300 | 3.500 | 4.900 |
| tool:inspectDataset | 30 | 0.200 | 0.200 | 0.300 | 0.400 |
| tool:queryDataset | 30 | 1.400 | 1.600 | 4.400 | 4.900 |

The trace named `agent` is emitted by the scripted tool-session harness; it does not include a real model planner or generator. Stage events overlap with their parent component and each other. Authentication, ingestion, full HTTP, planning and generation latency have no measured distribution in this run. Their failure behavior is covered by controlled tests and existing regressions.

## Request spacing, bounds and deadlines

The already configured provider was **groq**, with **12 RPM**, implying 5000 ms between starts. Three sequential calls used actual application pacing timers with injected immediate responses. No external provider request occurred. The two measured start gaps were **5000.975 ms** and **4999.855 ms**. Their nearest-rank p50/min is 4999.855 ms and p95/max is 5000.975 ms. With only two intervals, these percentiles are descriptive, not an SLA.

The limiter uses millisecond Date.now(), while the observer uses a higher-resolution performance timer. A fraction below exactly 5000 ms in the observer is within that clock granularity; virtual-clock tests separately assert exact minimum spacing. The timer check validates pacing code with stub responses, not real provider availability or throughput.

Existing limits were inspected and tested, not increased:

| Boundary | Current behavior | Evidence |
| --- | --- | --- |
| Start pacing | Actual attempts, including 429 retries, share provider-local spacing | Real-timer check; simulated starts 0, 6000, 11000 ms at 12 RPM |
| Queue | Counter capped at eight active/waiting attempt operations | Eight mock waits cancel; next is rejected with safe 429 |
| Queue wait | At most 10 seconds and before request deadline minus one second; equality is rejected | Budget-boundary test; no real 10-second blocking load |
| Per-transport call | Deadline bounded by request context and 30 seconds | Last-500-ms request-context and 29-second simulated retry tests |
| 429 retries | Maximum two total HTTP attempts; long Retry-After and insufficient time stop sooner | Recovery, persistent, long-cooldown and deadline tests for both providers |
| Other failures | No automatic retry of 403, 503 or thrown connection failure; SDK maxRetries=0 | Both-provider scenarios and actual SDK mocked-route regressions |
| Chat / agent | 45-second chat signal; 60-second agent/request signal; model call timeout 30 seconds | Code inspection plus injected timeout/cancellation regressions; no live 45/60-second provider stall |
| Embedding | Existing 15-second cap now applies with or without caller signal; caller cancellation combined | Regression failed before fix, passes after |
| PostgreSQL | Five-second pool connection timeout; CSV statement_timeout five seconds; retrieval query_timeout ten seconds | Inspection, injected unavailability; real short SQL timeout/recovery probe |
| Agent/tool bounds | Eight SDK planning steps; ten backend tool calls | Existing SDK regressions; eleventh-call/cancellation scenario |

A conservative queue can reject a request before provider quota is exhausted. For example, a fresh call needing exactly 10 seconds of queue wait is rejected by the queue deadline. This is a deliberate bounded-wait policy, not proof of a provider 429. Pacing logs distinguish local queue rejection from an HTTP 429.

Rate state and queues are process-local and provider-local. They are not shared across workers, containers, deployments, separate scripts or other users of the same provider project. Multiple processes can exceed a shared provider quota even if each observes its own 12 RPM. Queues are not durable. Clock adjustments can affect Date.now()-based scheduling. These are operational limits, not findings from a multi-worker load test.

## Reliability outcomes and safe failure classification

All 34 simulated scenarios passed expected assertions. Their response bodies, clocks, connection exceptions and tool results are controlled. They do not estimate the real frequency of outages or provider quota failures. Every simulated row is labelled as such in the artifacts.

| Scenario | Stage / cause | Observed safe behavior |
| --- | --- | --- |
| Missing cookie | Authentication rejection | 401, handler not invoked, server request ID |
| Unavailable PostgreSQL | Injected database connection refusal during real retrieval function | Chat 503 RETRIEVAL_FAILED, no generation or sensitive error text |
| Unavailable Ollama | Injected embedding connection refusal | Chat 503 RETRIEVAL_FAILED, no generation or private content |
| Embedding timeout | Injected TimeoutError | Chat 504 CHAT_TIMEOUT |
| Retrieval cancellation | Aborted caller before search | No embedding request |
| One provider 429 | Controlled provider quota response | At most one retry, respects larger Retry-After, recovers |
| Persistent provider 429 | Provider restriction | Two attempts maximum, safe 429 PROVIDER_RATE_LIMITED |
| Long provider cooldown | Provider restriction | One attempt; next call rejected without HTTP |
| Generic provider 403 | Provider access restriction | No transport retry; generation maps safe failure to 502 |
| Confirmed Gemini free-tier denial | Recognized provider billing restriction | One attempt, safe 503 PROVIDER_BILLING_REQUIRED |
| Transient HTTP 503 / connection reset | Controlled provider failure | No automatic transport retry; HTTP generation failure maps to 502 |
| Generation timeout | Injected TimeoutError | Safe 504 CHAT_TIMEOUT |
| Invalid aggregate sort | Backend tool validation | Query blocked; corrected request succeeds; recovery trace emitted |
| Excess calls / cancelled session | Tool budget / cancellation | Eleventh call rejected; cancelled tools do not start |
| Arbitrary sensitive exception text | Logging and API boundaries | Private sentinel absent from saved scenario output and captured logs |

The 34 scenarios comprise ten scenarios per provider, plus 14 authentication/service/tool/generation/logging checks. Existing mocked SDK route tests additionally verify Groq 403/429/503 mapping, Gemini billing denial, agent failures, malformed generation and citation rejection. No provider body or raw error is used as a fake answer.

A separate **real PostgreSQL test** used SELECT pg_sleep(0.1) with a test-only 20 ms statement_timeout inside a fixture savepoint. It observed SQLSTATE 57014, rolled back the failed operation, successfully queried the fixture again and restored the pool. The production timeout settings were not changed. This is one actual timeout/recovery probe, not a latency distribution.

Operational classification must retain stage context. A provider 403 is not a failed application login. A 429 may be local pacing or a remote quota response. An embedding failure can surface publicly as RETRIEVAL_FAILED; stage logs identify the lower layer. Generic errors can remain other/Unknown, especially nested network causes; do not infer a specific database/provider cause from that label alone. Environment permission failures are separate from application/provider restrictions.

## Confirmed defect and minimal fix

Before the fix, `generateEmbedding(text)` used `signal: undefined` whenever the optional caller signal was absent. Its documented 15-second application deadline existed only for callers that supplied a signal. The maintenance re-embedding script calls the optional path. A controlled fetch probe captured the missing signal, and the regression failed with “optional callers must not wait indefinitely.” This establishes an application deadline gap; it does not claim an observed live 15-second outage.

The fallback now uses AbortSignal.timeout(15_000). The caller-supplied path still combines caller cancellation with exactly the same 15-second deadline. Regression coverage checks that value, caller cancellation, malformed vectors and safe failure handling. No model, embeddings, dimensions, chunk contents, provider configuration, citations or authorization settings were changed. The maintenance script was inspected but was not executed, so no stored embeddings were rewritten.

No other application behavior was changed. In particular, transient 5xx errors remain non-retried, and neither queue bounds nor request deadlines were loosened.

## Bottlenecks and evidence-based recommendations

1. **Embedding dominates this local fixture path.** Profile real representative question/document sizes and cold-start behavior before optimizing PostgreSQL or changing deployment resources. This run provides no evidence that the tiny CSV queries require database architecture changes.
2. **Pacing can dominate multi-call answers.** Five seconds between starts is orders of magnitude above the measured local retrieval time. Multiple planner/generator calls can add waits, but their real frequency and full answer latency are unmeasured. Use an authorized small provider trace before proposing agent changes. Do not raise RPM from these local numbers.
3. **Maintain bounded failure handling.** Keep the newly completed embedding deadline and existing 429 limits. Local transient 503/connection failures are not retried automatically. If a later real trace justifies retries, evaluate budget/idempotency first rather than adding them here.
4. **Deployment ownership of quota is necessary.** Until a shared limiter is measured/implemented in a separate task, account for all worker processes and other project clients. This evaluation does not make multi-worker quota coordination safe.
5. **Cancellation is cooperative.** HTTP/Ollama calls use AbortSignal, but CSV query APIs do not accept a caller signal and rely on SQL timeouts. Retrieval checks cancellation before/after database work; query_timeout is a pg client timeout, not proof of server-side cancellation. Work may continue until the database limit. Do not claim instant cancellation from these tests.
6. **Expand measurement before capacity decisions.** Representative row counts, document counts/indexes, real transaction commits, full authenticated HTTP and isolated end-to-end provider traces remain necessary. No cache, new database, model replacement or retrieval-strategy change is supported by this small run.

## Actual regression results

| Check | Actual result |
| --- | --- |
| Focused performance/reliability tests | Seven non-database checks passed; one additional database check passed when enabled |
| npm test | 184 registered; 178 passed; six optional database skips; zero failures |
| All database flags enabled | 184 passed; zero failures/skips |
| TypeScript | Passed |
| ESLint | Passed |
| Supported Webpack production build | Passed in isolated copy, development cache preserved |
| Real local component run | 360 samples; zero failed |
| Controlled fault matrix | 34/34 passed; virtual/provider-response simulations |
| Real timer pacing | Three stub calls, two intervals, no error or external request |
| Existing public data | All 12 public-table counts/content fingerprints matched across the original benchmark/test interval; see resumed verification below |
| External AI usage | Zero Groq and zero Gemini requests |

Existing suites include ownership isolation, authentication/CSRF, document lifecycle, hybrid retrieval, structured SQL safety, citations, evaluation cleanup, frontend client behavior, providers and agent regression tests. Browser UI suites were not rerun for this backend/operator-only change.

## Changed files and repeat commands

- `src/lib/embeddings.ts`: one-line fallback applying the existing deadline to optional callers.
- `evaluation/performance-reliability.ts`: bounded serial local/offline runner, environment metadata, distributions, real-timer pacing and machine-readable artifacts.
- `evaluation/reliability-scenarios.ts`: safe deterministic operational fault matrix using existing handlers/transport/tools.
- `tests/performance-reliability.test.ts`: eight focused tests, including the confirmed defect and real optional database timeout/recovery.
- `package.json`: evaluate:performance script, no dependency changes.
- This report, performance-local/, performance-offline/ and README links: actual measurements and method. No migrations.

```bash
# Default: offline fault checks, no service/provider requests
npm run evaluate:performance

# Actual serial local timings; Ollama/PostgreSQL required, live LLM endpoints blocked
node --env-file=.env.local --conditions=react-server --import tsx \
  evaluation/performance-reliability.ts --mode local --samples 30 \
  --out .evaluation-results/performance-local

npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

The runner accepts 10–50 serial samples and writes only under an evaluation subdirectory. Run it as a standalone process, never import its fixture pool patching into the application server. Do not run concurrent benchmark processes or use private production data. Offline mode makes no network calls and has zero real component samples.

## Remaining limitations and operational assessment

The measured local retrieval/CSV/tool components completed reliably on a tiny warm fictional corpus, and controlled failure paths passed. This does not establish production uptime, throughput, provider access, user-perceived AI latency or real model answer quality. Provider timings are absent; simulated durations are not mixed into service latency percentiles. The corpus and script do not exercise ingestion/PDF parsing, production index growth, network outages, true database service restart, queue fairness, sustained load, multi-worker coordination or long-running memory behavior.

Only two real pacing gaps and one real SQL timeout were observed. Min/max and p95 from 30 warm samples are useful for local comparison but have limited statistical strength. Existing safe logging can classify broad errors without their nested causes; investigate the recorded stage rather than exposing raw errors. These limits and the process-local quota state remain the main deployment risks. No architecture change is justified by the current evidence.

## Resumed verification and final status

The continuation reused the completed 360-sample benchmark and the completed 184/184 database-enabled regression run. Neither was repeated unnecessarily. Current benchmark, test and package files were compared byte-for-byte against the successful isolated build inputs.

The focused performance suite was rerun: seven passed and its one optional database test skipped; that database test had already passed in the full database-enabled run. The regression covering the optional embedding caller passed again, confirming an AbortSignal and the existing 15,000 ms deadline. Caller-cancellation coverage also passed. TypeScript, ESLint and the supported isolated Webpack production build were rerun successfully. No new application changes were needed during continuation.

Data integrity was checked again using read-only queries. The original evaluation interval had matching fingerprints for all 12 public tables. By the start of continuation, two additional CSV datasets containing 270 rows had appeared. Excluding those two newest datasets, the original five datasets and all 14 original CSV rows still matched their original fingerprints exactly. User accounts, credentials, documents, chunks, lifecycle events/cleanup and legacy CSV tables also matched the original snapshot.

Session and authentication-rate-limit contents differed across the pause, although their counts were unchanged. Their origin was not attributed, and no attempt was made to restore or alter them. Therefore this report does not claim that every session/rate-limit record remained unchanged throughout the pause. A second snapshot confirmed **all 12 public tables were unchanged during the resumed verification itself**. The two added datasets and their rows were preserved.

**Final status:** Day 9 Step 4 is complete. Local performance measurements, controlled reliability tests, the minimal embedding deadline fix and all requested checks are documented. Provider planning/generation latency and production load capacity remain unmeasured. No Step 5 work was started.
