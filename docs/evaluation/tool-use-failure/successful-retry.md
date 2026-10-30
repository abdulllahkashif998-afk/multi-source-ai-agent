# Test 16 successful retry follow-up

30 October 2026. Read-only application investigation; no live provider requests initiated.

The original [failure report](report.md) and [failed trace](safe-trace.json) are preserved. This later success does not retroactively change the failed result.

## Trace comparison

| Evidence | Earlier failure | Later success |
|---|---|---|
| Request ID | a2471414-0a5b-4a89-88d4-c58eb66a3df3 | 25248cfd-3d47-463a-a2c2-f4ada44ad59d |
| Logger timestamp | 00:47:49–00:47:55 | 00:50:58 |
| Execution path | General planning, then document search, then planning | Structured operation: document retrieval and CSV query |
| Groq calls in trace | Two: HTTP 200 then HTTP 400 tool_use_failed | Zero model-call/provider-usage/groq-http events |
| CSV query | Not reached | Successful, about 15 ms |
| Citation verification | Not reached | Successful, 1.6 ms |
| Agent outcome | Failed | Grounded |
| Total request duration | 6018.6 ms | 199.9 ms |

The complete successful request trace is available in [successful-retry-safe-trace.json](successful-retry-safe-trace.json). Local embedding took 100.8 ms and retrieval about 122 ms. A structured-operation result exits before model selection/planning execution calls in the orchestration; this trace is consistent with the existing deterministic SLA operation and zero Groq requests, rather than an answer cached across requests.

The user reports seeing NS-003, NS-014 and NS-025, each at 1.5 hours against a 1-hour deadline, with PDF [D3] and CSV [C1] citations. These response contents are **user-reported manual verification**. Logs verify the grounded outcome and citation-check success, but deliberately do not retain answer text, source contents or question text. The successful request ID is the later matching trace, not independently confirmed by the user's Network panel.

## Why the routes differed

The confirmed parser defect documented in the preceding report rejected the supplied question's presentation-only Include clause. The implemented correction accepts that clause when it requests fields the existing operation already supplies. The earlier trace shows immediate structured-operation return followed by model planning; the later trace shows successful structured execution. This matches the before/after routing behavior established by regression tests.

However, logs do not contain a build revision, source hash or original question. Therefore they cannot conclusively prove whether the earlier request used pre-fix code, a stale development worker, or subtly different question text. No random routing or worker-staleness defect has been demonstrated. Stale code is a possible explanation, not a confirmed cause. The precise malformed provider envelope also remains unavailable.

## Consistency check

A read-only parser check repeated the exact supplied question 25 times under current code: **25 recognized, all identical structured intents**. No provider or database access was made by this check. Existing offline supplied-wording regression and isolated PostgreSQL regression already passed in the previous task; expensive suites were not repeated for this evidence-only follow-up.

Current routing is deterministic for identical text and code. Actual execution still depends on the current user's unique owned sources, readiness, schema, policy applicability and ambiguity checks; these protections can correctly yield refusal. This result is not a guarantee for arbitrary SLA paraphrases or a claim that general Groq tool-use failures are resolved.

No application changes, existing-data changes, quota-ledger resets, live Groq calls, commits or pushes were made in this follow-up. New files are this report and the safe successful trace.
