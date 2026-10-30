# Test 19: local quota rejection after COUNT-plan correction

30 October 2026. Read-only application/ledger investigation. No live Groq calls. Exact request: `a87acc41-32d1-4f8a-9117-81396916251a`, user-supplied HTTP 429, Retry-After 56, Date 11:27:30 GMT. See [safe-trace.json](safe-trace.json).

## Confirmed sequence

1. General routing; prepared dataset discovery and two schema inspections succeeded.
2. Planning call 1 completed and selected document search. Local BGE/PG retrieval succeeded.
3. Planning call 2 completed but its queryDataset execution was rejected at tool validation: `invalid_count_column` / `Count counts rows; omit column`. No SQL ran for this rejected plan. This is an application-side semantic validation error, not provider HTTP 400/tool_use_failed.
4. Planning call 3 completed; corrected queryDataset executed successfully in about 26 ms. Diagnostics record the tool recovery.
5. Planning call 4 attempted continuation but was denied locally for TPM. Final API HTTP 429 after 15235.8 ms. Final generation, applicability gate and citation verification were not reached.

Three Groq planning invocations completed, not two. The denied fourth call did not dispatch. Callback providerAttemptCount=0 remains an instrumentation limitation; it must not override the completed planning callbacks and matching settled ledger entries.

## Token accounting

The three latest matching ledger entries correspond in timing and total to the request-linked admission diagnostic; the ledger itself has no request-ID field.

| Admission UTC | Reserved | Actual reported | Released | Pending |
|---|---:|---:|---:|---|
| 11:27:15.247 | 3222 | 1331 | 1891 | No |
| 11:27:20.283 | 4042 | 2097 | 1945 | No |
| 11:27:25.343 | 4367 | 2184 | 2183 | No |
| Total | 11631 | 5612 | 6019 | None for these entries |

The rejected next reservation was **4631**, not an admitted charge. At denial local minute charge was 5612/8000, leaving **2388**; retained provider-header remaining tokens were **2386**. The next reservation exceeded these by 2243 and 2245 respectively. Daily accounted usage was 152801/200000, so this was not daily exhaustion. Reconciliation released unused reservations; no accounting leak is demonstrated.

Actual token expiries: 11:28:15.910Z, 11:28:21.447Z and 11:28:26.147Z. Even after the first expiry local capacity would remain below 4631. The second expiry would release enough local tokens, but the tighter provider-header allowance still cannot admit the call until **11:28:26.147Z** (16:28:26.147 Pakistan time). This explains 56-second retry guidance. That reset is roughly 71 seconds after the first admission and cannot fit the existing approximately 60-second request deadline or shorter per-call waiting budget. Retry guidance does not guarantee later capacity if other work arrives.

## Comparison with Test 18

| Measurement | Test 18 | Test 19 |
|---|---:|---:|
| Completed planning calls | 2 | 3 |
| Rejected planning call | 3 | 4 |
| Reported actual tokens | 3425 | 5612 |
| Initial reservations summed sequentially | 7292 | 11631 |
| Reconciled release | 3867 | 6019 |
| Next requested reservation | 4729 | 4631 |
| Local remaining tokens | 4575 | 2388 |
| Retained provider remaining tokens | 4094 | 2386 |
| API origin / status | Local TPM / 429 | Local TPM / 429 |

Test 18's minute charges had expired long before Test 19. Test 19's own three completed calls sum exactly to its minute charge. Shared daily usage persists normally but is not the limiting budget here.

## Redundancy and general improvement

The third call was recovery from a malformed semantic plan, not a proven redundant completion check. In the observed execution, correction was necessary before a CSV result existed. Its 2184 actual tokens are a demonstrated correction cost, not a guaranteed saving estimate for a changed system. Whether the fourth call would merely confirm completion or obtain additional evidence is unknown because intended actions, rows, truncation and completion-hint values are not retained.

A confirmed schema affordance contributes to the opportunity: `csv-query-schema.ts` describes aggregate as op=count|sum|avg with optional column, while `generic-csv.ts` correctly forbids column for COUNT and requires a numeric column for SUM/AVG. Thus the advertised structural shape permits known semantically invalid combinations despite planner instructions and backend validation hints.

**Smallest justified proposed change:** tighten only the model-facing aggregate schema into distinct COUNT (no column) and SUM/AVG (required column) variants, preserving existing public CSV APIs and all backend checks. Test emitted JSON Schema/provider compatibility, invalid COUNT rejection before execution, SUM/AVG required columns, grouped counts, correction behavior, cancellation and quota accounting. Do not silently drop a supplied COUNT column: that could change a requested non-null count into a row count. Do not infer valid query semantics from a schema match.

This proposal is not implemented in this read-only investigation. Even eliminating the correction call would not prove that final generation can fit the same TPM window. History size, actual model choices and final output reservations still matter. Unconditionally skipping continuation or bypassing local limits is not justified.

As in Test 18, source names and query contents are not logged, so correct lab source selection and policy applicability cannot be reconstructed. The applicability gate was not reached. This report does not present the recovered CSV query as a grounded operational answer.

## Preservation and verification

Only this new report and safe trace were written. No source code, existing records, credentials, models, original fixtures, historical evidence or quota ledger was changed. No provider requests, new benchmark executions, commits or pushes. Documentation links and diff checks passed. No runtime fix was made, so tests were not repeated unnecessarily and no new application/live accuracy pass is claimed.
