# Performance and reliability measurement artifacts

Mode: local; generated: 2026-10-27T17:27:10.029Z; external LLM requests: 0.
LOCAL: real Ollama and PostgreSQL timings. Tool decisions and final answer text are scripted; no planning/generation latency was measured.


## Local component distributions

| Component | Attempts | Errors | Samples | Min ms | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| citation-verification | 30 | 0 | 30 | 0.050 | 0.067 | 0.284 | 0.294 |
| csv-csv-01 | 30 | 0 | 30 | 1.472 | 1.664 | 2.343 | 4.869 |
| csv-csv-02 | 30 | 0 | 30 | 1.350 | 1.851 | 3.316 | 5.346 |
| csv-csv-03 | 30 | 0 | 30 | 1.404 | 1.810 | 2.992 | 3.377 |
| csv-csv-04 | 30 | 0 | 30 | 1.515 | 1.802 | 4.124 | 4.843 |
| csv-csv-05 | 30 | 0 | 30 | 1.328 | 1.650 | 2.280 | 3.074 |
| csv-csv-06 | 30 | 0 | 30 | 1.423 | 1.721 | 3.637 | 4.218 |
| dataset-discovery | 30 | 0 | 30 | 0.841 | 0.986 | 2.165 | 3.306 |
| embedding | 30 | 0 | 30 | 36.197 | 41.710 | 54.581 | 62.280 |
| retrieval-hybrid | 30 | 0 | 30 | 39.482 | 44.446 | 57.638 | 63.116 |
| retrieval-semantic | 30 | 0 | 30 | 37.172 | 43.108 | 56.346 | 65.115 |
| scripted-tool-workflow | 30 | 0 | 30 | 42.824 | 45.319 | 64.418 | 65.091 |

## Simulated faults

| Scenario | Stage | Passed | Observed |
| --- | --- | --- | --- |
| gemini-429-recovery | provider | true | {"attempts":3,"simulatedStartsMs":[0,6000,11000],"recovery":true} |
| gemini-persistent-429 | provider | true | {"attempts":2,"safeStatus":429} |
| gemini-long-cooldown | provider | true | {"attempts":1,"subsequentCallRejected":true} |
| gemini-403-no-retry | provider | true | {"attempts":1,"transportStatus":403} |
| gemini-503-no-retry | provider | true | {"attempts":1,"transportStatus":503} |
| gemini-connection-no-retry | provider | true | {"attempts":1,"retried":false} |
| gemini-deadline-prevents-retry | provider | true | {"attempts":1,"simulatedElapsedMs":29000} |
| gemini-cancel-before-call | provider | true | {"attempts":0} |
| gemini-bounded-queue-cancellation | provider | true | {"pending":8,"overflowStatus":429,"cancelled":8,"attempts":1} |
| gemini-queue-wait-budget | provider | true | {"rpm":6,"requiredSpacingMs":10000,"queueWaitBudgetMs":10000,"attempts":1,"rejectedAtBudgetBoundary":true} |
| groq-429-recovery | provider | true | {"attempts":3,"simulatedStartsMs":[0,6000,11000],"recovery":true} |
| groq-persistent-429 | provider | true | {"attempts":2,"safeStatus":429} |
| groq-long-cooldown | provider | true | {"attempts":1,"subsequentCallRejected":true} |
| groq-403-no-retry | provider | true | {"attempts":1,"transportStatus":403} |
| groq-503-no-retry | provider | true | {"attempts":1,"transportStatus":503} |
| groq-connection-no-retry | provider | true | {"attempts":1,"retried":false} |
| groq-deadline-prevents-retry | provider | true | {"attempts":1,"simulatedElapsedMs":29000} |
| groq-cancel-before-call | provider | true | {"attempts":0} |
| groq-bounded-queue-cancellation | provider | true | {"pending":8,"overflowStatus":429,"cancelled":8,"attempts":1} |
| groq-queue-wait-budget | provider | true | {"rpm":6,"requiredSpacingMs":10000,"queueWaitBudgetMs":10000,"attempts":1,"rejectedAtBudgetBoundary":true} |
| gemini-confirmed-access-denial | provider | true | {"attempts":1,"safeStatus":503} |
| request-context-deadline | provider | true | {"attempts":0,"rejectedBeforeRequestDeadline":true} |
| missing-session-stops-handler | authentication | true | {"status":401,"downstreamInvoked":false} |
| ollama-unavailable-chat-error | embedding | true | {"status":503,"code":"RETRIEVAL_FAILED"} |
| postgres-unavailable-retrieval-error | database | true | {"status":503,"code":"RETRIEVAL_FAILED"} |
| retrieval-cancel-before-work | retrieval | true | {"embeddingInvoked":false} |
| embedding-timeout-propagation | embedding | true | {"status":504,"code":"CHAT_TIMEOUT","timeoutInjected":true} |
| generation-429 | generation | true | {"status":429,"code":"PROVIDER_RATE_LIMITED"} |
| generation-403 | generation | true | {"status":502,"code":"GENERATION_FAILED"} |
| generation-503 | generation | true | {"status":502,"code":"GENERATION_FAILED"} |
| generation-timeout | generation | true | {"status":504,"code":"CHAT_TIMEOUT"} |
| tool-invalid-sort-recovery | tools | true | {"backendQueries":1,"recovered":true} |
| tool-call-budget-and-cancellation | tools | true | {"budget":10,"eleventhRejected":true,"cancelled":true} |
| safe-logs-and-classification | generation | true | {"sensitiveSentinelAbsent":true,"records":112} |

## Real-timer pacing with injected provider responses

{
  "kind": "real-wall-clock-with-stub-responses",
  "provider": "groq",
  "rpm": 12,
  "requiredSpacingMs": 5000,
  "attempts": 3,
  "startsMs": [
    0.15924199999972188,
    5001.134674000001,
    10000.989356
  ],
  "gapsMs": [
    5000.975432000001,
    4999.854681999999
  ],
  "gapDistribution": {
    "n": 2,
    "min": 4999.854681999999,
    "p50": 4999.854681999999,
    "p95": 5000.975432000001,
    "max": 5000.975432000001,
    "mean": 5000.415057
  },
  "errors": [],
  "externalProviderRequests": 0
}

See ../performance-reliability.md for methodology, environment, stage limits, failure analysis and regression results. Service timings exclude corpus embedding/setup and warmups. Successful timing distributions exclude failed samples, which are counted separately. Nearest-rank percentiles; serial warm fictional corpus only. Overlapping stages must not be summed. No provider throughput, concurrency or AI quality conclusion is justified.
