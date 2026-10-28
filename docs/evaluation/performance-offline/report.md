# Performance and reliability measurement artifacts

Mode: offline; generated: 2026-10-27T17:29:39.313Z; external LLM requests: 0.
OFFLINE: all fault clocks/responses are simulated. No local service latency was measured.


## Local component distributions

| Component | Attempts | Errors | Samples | Min ms | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |

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

null

See ../performance-reliability.md for methodology, environment, stage limits, failure analysis and regression results. Service timings exclude corpus embedding/setup and warmups. Successful timing distributions exclude failed samples, which are counted separately. Nearest-rank percentiles; serial warm fictional corpus only. Overlapping stages must not be summed. No provider throughput, concurrency or AI quality conclusion is justified.
