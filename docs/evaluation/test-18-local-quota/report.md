# Test 18: exact local TPM rejection

30 October 2026. Read-only runtime investigation; only this report and its [allowlisted trace](safe-trace.json) were added. No live provider requests.

## Exact request sequence

Request ID: `031d19e4-d3bd-46f6-b57c-30ed79938e74`. User supplied HTTP 429 and Retry-After: 56.

| Logger timestamp | Stage | Result |
|---|---|---|
| 01:46:18.323–18.334 | Structured-operation check and prepared catalog | No deterministic answer; dataset discovery and two schema inspections succeeded |
| 01:46:18.339–19.426 | Planning call 1 | Completed successfully |
| 01:46:20.132 | searchDocuments | Succeeded in 700.9 ms, including local embedding and PostgreSQL retrieval |
| 01:46:20.143–24.471 | Planning call 2 | Completed successfully |
| 01:46:24.516 | queryDataset | Succeeded in 37.3 ms |
| 01:46:24.529 | Planning call 3 | Attempted |
| 01:46:28.511 | Planning failure | Local TPM admission rejected; HTTP 429, retry guidance 56 seconds |
| 01:46:28.522 | API response | HTTP 429, total 10223.4 ms |

The error explicitly records rateLimitOrigin=local and quotaReason=tpm. No provider 429 or tool_use_failed appears in this request. The third invocation did not dispatch to Groq. The two successful dashboard rows are consistent with the completed first and second planning callbacks. General planning ran; final generation and citation verification were never reached.

## Actual versus reserved usage

The persisted ledger's two matching time-window entries show:

| Admission UTC | Initial reservation | Reported actual | Reconciled release | Pending |
|---|---:|---:|---:|---|
| 11:18:57.926 | 3227 | 1332 | 1895 | No |
| 11:19:03.004 | 4065 | 2093 | 1972 | No |
| Total | 7292 | 3425 | 3867 | None for these entries |

The ledger has no request IDs, so attribution is based on matching timing, two successful admissions, and the exact sum 3425 also recorded in the request-linked rejection diagnostic. Its callback providerAttemptCount stays zero because detailed provider-usage instrumentation was not emitted for these requests; that is a telemetry gap, not proof of zero HTTP calls.

At rejection:

- Local minute charge: **3425** of 8000; available **4575**.
- Retained provider-header remaining allowance: **4094**, tighter than local capacity.
- Requested next reservation: **4729**, exceeding local capacity by 154 and header allowance by 635.
- Daily accounted tokens: **136893**, below 200000. This rejection is not TPD exhaustion.
- The denied 4729-token reservation was not added to the ledger.

A reservation covers conservative encoded input/framing plus permitted output, not an estimate of output alone. With the current 1536 planning-output cap, 3193 of the 4729 reservation represents the estimated input/framing allowance. Actual prompt/output split is not retained here. Initial reservations are sequential, not a simultaneously charged 7292-token balance. Both completed calls were reconciled to actual totals; there is no evidence of a reservation leak or a full-budget reservation unrelated to the request size.

## Why Retry-After was 56 seconds

Known actual-token expiry times are 11:19:58.945Z and 11:20:03.976Z. The retained provider token allowance expires at **11:20:03.976Z** (16:20:03.976 Pakistan time). Local capacity could become adequate after the first token expiry, but the tighter 4094 allowance still cannot admit 4729 until its own expiry. The 56-second guidance is consistent with that later reset.

That interval cannot fit the bounded admission wait (roughly at most 20 seconds per call after response headroom), and the reset is roughly 66 seconds after the first call's admission—also beyond this request's approximately 60-second overall deadline. Waiting correctly cannot make this request succeed under unchanged deadlines. Retry-After is earliest retry guidance, not a guarantee: other requests or provider constraints can consume capacity before a fresh attempt.

## Planning necessity and evidence gaps

Call 1 selected document search, call 2 selected a validated CSV query, and call 3 attempted continuation after the query. Thus the first two calls performed different useful tool-selection stages, not repeated discovery.

Whether call 3 was unnecessary is **unknown**. The trace omits its intended action, prior tool arguments/results, whether the planner declared evidenceComplete, empty/truncated result state, and whether every requested fact was collected. A successful query does not prove sufficient evidence or correct filtering. The current completion hint can skip a confirmation only when explicitly declared and backend guards pass; this trace cannot establish why that condition was not met.

The pre-generation complete-policy applicability gate runs after planning terminates. This request failed before that point, so applicability was **not established**. Discovery/schema inspection and successful retrieval/querying do not substitute for that gate. The current implementation does not generically bind organization/date predicates to CSV fields; that limitation remains separate from this quota failure.

The logs deliberately omit filenames, dataset IDs and source text. Two schemas were prepared, document search succeeded, and an owned validated query executed, but correct selection of the new lab PDF/CSV cannot be proven from this trace. No historic source mapping or argument values were invented.

## Confirmed conclusions and recommendations

- Confirmed cause: legitimate local TPM/header-constrained admission rejection during planning call 3.
- No quota-accounting defect, provider 429, provider tool failure or citation failure is demonstrated.
- Confirmed limitations: multi-call planning grows context; historical tool/source/completion diagnostics are insufficient for semantic reconstruction; applicability checking occurs after planning and may be preceded by work that ultimately cannot support an operational answer.
- Potential general improvement: evaluate known applicability blockers once sufficient policy/data evidence is collected and before another planning invocation. This must distinguish reporting rule text from applying rules and preserve unresolved-evidence refusals. It is not proven from this trace that an earlier check would have resolved the exact selected sources.
- Do not unconditionally skip continuation, shrink reservations below safe estimates, reset quota, infer source selection or add a wording-specific handler.

No runtime change or new tests were needed for this read-only investigation. Existing relevant tests had passed in the preceding review (312 disposable-database tests); those results were not rerun or presented as a new live acceptance pass. No source code, user data, model settings, quota ledger or historical reports were changed. Documentation links and diff checks passed. No commit or push.
