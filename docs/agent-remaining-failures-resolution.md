# Three remaining agent failures — targeted resolution

29 October 2026. See the unchanged [live retest](evaluation/final-live/retest-01/report.md), [raw before/after results](evaluation/final-live/retest-01/results.json), and [earlier remediation review](evaluation/live-weakness-remediation.md).

## Confirmed root causes versus unknowns

| Case | Observed trace | Confirmed defect and resolution |
| --- | --- | --- |
| csv-05 | Dataset discovery/inspection, recovered tool-validation error, then an authorized East filter with SUM(amount), GROUP BY team and sorting the aggregate value. CSV result was Alpha=30. Final answer accurately quoted that unintended aggregate. Citation verification passed. | A valid query did not preserve listing intent. The supported listing operation now constructs a raw-row filter/sort plan with no aggregate/grouping, checks returned order and retains duplicate rows. It renders each individual amount. |
| combined-04 | Policy search, discovery/inspection and grouped SUM returned Alpha=30, Beta=6, Gamma=15; policy said 15. Final answer only named Beta. Citation verification passed. | Generation omitted evidence already available; authentic references did not establish completeness. The supported operation computes every group's comparison and renders every result row with actual, threshold and shortfall/surplus, citing both operands. |
| combined-05 | Document search succeeded. The second native provider request returned HTTP 400, tool_use_failed, during planning. No CSV tool executed, no final answer was generated, and citation verification was never reached. | Provider tool-use rejection is confirmed. **The exact rejected tool name, argument structure and invalid field are not recoverable from retained artifacts.** No raw failed_generation was saved. The supported operation now performs authorized discovery, inspection and a validated row query itself, computes strict-threshold comparisons and requires complete cited output; it makes no model request. This removes that failure opportunity for the recognized operation, not every possible Groq tool-use failure. |

Do not infer that the historical combined-05 error was an invalid filter, a particular tool name, SDK incompatibility or a quota issue. Those explanations are not established by the available evidence. No live Groq calls were made for this work.

## Targeted implementation

[agent-structured-operations.ts](../src/lib/agent-structured-operations.ts) adds three deliberately narrow operation grammars, following the existing deterministic role-count approach:

1. `List the <region>-region <dataset stem> amounts, largest/smallest first.` requires a unique owned `<dataset stem>.csv`, text `region`, numeric `amount`, raw filtering and sorting. It never substitutes aggregation.
2. The supported all-sales-rows-per-team policy question requires a unique owned sales dataset with text `team` and numeric `amount`. It sums all rows by team without a threshold row filter, then compares the totals to a recognized policy rule.
3. `Apply the travel approval rule to <filename.csv>. Who needs approval and by how much is the limit exceeded?` requires text `employee`, numeric `cost`, complete rows and one recognized unqualified approval rule. Each actual is compared with the threshold; strict “above” excludes equality. Decimal differences are computed from query-result numeric representations using integer decimal scaling, avoiding binary subtraction artifacts.

Thresholds, entity names, row values and source IDs are read from current evidence, never embedded fixture answers. Tests change the policy threshold and input values to verify this. No new dependency, migration, paid model or additional LLM call was added.

Recognized operations execute through the existing session tools, retaining discovery/schema prerequisites, owner-scoped queries, `planSchema`, SQL compilation, read-only transactions, limits, cancellation and the request budget. Final answers still pass `resolveDocumentAnswer` and the existing strict citation verifier. Document and CSV references are selected from actual quote choices; arithmetic cites both its operands. Every returned comparison row is rendered, so generation cannot silently omit a requested difference or group.

`knowledge-agent.ts` runs the supported operation before general planning and records a `structured-operation` stage. Unrecognized questions retain the general agent and the existing count shortcut. A recognized operation with ambiguous datasets, conflicting/unrecognized policy rules, missing columns, invalid/null operands, unquotable evidence or truncated results returns canonical abstention rather than guessing or silently falling back to a risky interpretation.

## Malformed tool-call safety and diagnosis

- [agent-tool-inputs.ts](../src/lib/agent-tool-inputs.ts) shares the same structural schemas between planner tools, backend execution and safe diagnosis. Query ownership and SQL checks remain in the backend.
- [provider-tool-diagnostics.ts](../src/lib/provider-tool-diagnostics.ts) inspects bounded HTTP 400 tool_use_failed payloads only in memory. For a recognizable standard JSON tool envelope, it reports an allowlisted tool name and schema field paths/error codes, without values or unknown field names. Unrecognized/missing envelopes are labelled as such.
- [reliability.ts](../src/lib/reliability.ts) includes these optional safe diagnostics. It never logs raw provider messages, tool arguments or failed_generation.
- This diagnostic parser **never executes or repairs** rejected provider arguments. A valid structural shape does not establish ownership or semantic validity. General-provider failures still produce the existing safe API error; there are no additional retries or fabricated successful answers.
- Ordinary malformed tool calls delivered successfully by the SDK still go through the existing strict validation and bounded agent recovery. Tests verify that arbitrary SQL, unknown datasets, wrong filter types and malformed structures cannot reach query execution or create citations.

## Files changed in this task

- New: `src/lib/agent-structured-operations.ts`, `src/lib/agent-tool-inputs.ts`, `src/lib/provider-tool-diagnostics.ts`.
- Updated: `src/lib/knowledge-agent.ts`, `src/lib/agent-tools.ts`, `src/lib/reliability.ts`.
- New regression suite: [agent-deterministic-operations.test.ts](../tests/agent-deterministic-operations.test.ts).
- Updated `tests/live-evaluation-improvements.test.ts` so its scripted SDK checks use an explicitly unsupported extended question and continue exercising the general agent path; the new suite separately verifies the original questions' deterministic path.
- New documentation/results: this report and [infrastructure verification](evaluation/structured-operations-verification/report.md); `docs/evaluation/README.md` links to both.

Earlier unrelated working-tree changes were preserved. The original 25-case definitions, live results, review templates and existing user data were not edited. No files were staged, committed or pushed.

## Actual verification

| Check | Result |
| --- | --- |
| Focused operation + earlier remediation suites | 17 registered: 15 passed, 2 optional database skips, 0 failed |
| `npm test` | 249 registered: 239 passed, 10 optional database skips, 0 failed |
| `npm run test:fresh-db` | 249 passed, 0 skipped, 0 failed; disposable cluster removed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed |
| Repository security scan and documentation links | Passed; no secret findings |

The database suite initially exposed a test-fixture type mismatch: PostgreSQL returned the test's numeric similarity as a string, whereas real retrieval returns a floating-point number. The test was corrected to select float8; the final database suite passed. No retrieval threshold was weakened.

A separate real-infrastructure run used existing BGE/Ollama and PostgreSQL with the original three fictional fixtures. All external provider HTTP was explicitly blocked. All three answers were grounded and passed automatic checks; actual Groq requests and blocked provider attempts were both zero. There were 15 local embedding calls. Historical-file hashes and public users/documents/chunks/datasets/rows fingerprints matched before/after. The fixture helper used TEMP tables, explicit IDs and rollback; it did not modify existing records or sequences.

| Case | Previous live answer time | Deterministic real-infrastructure answer time | Actual result |
| --- | ---: | ---: | --- |
| csv-05 | 25.72 s | 41.64 ms | 20 then 10, CSV citation |
| combined-04 | 25.70 s | 86.88 ms | Alpha 30, Beta 6, Gamma 15; minimum 15; Beta shortfall 9; both source types |
| combined-05 | 5.58 s, failed | 101.26 ms | Jon 620, limit 500, excess 120; Sol at equality excluded; both source types |

These are single samples with different execution paths, warm local embeddings and no networked LLM inference in the new path. They are **not** a Groq quality score, p95 claim or broad performance benchmark. Corpus embedding setup and prechecks are outside answer timing. Actual responses, plans, source metadata, stage timings and independent CSV checks are preserved in the new [results file](evaluation/structured-operations-verification/results.json). Human semantic reviews remain unsubmitted.

## Limitations and final acceptance

- The exact historical malformed Groq tool structure is still unknown. Future structural diagnostics are tested with synthetic failures, not presented as recovered historical evidence.
- These grammars are intentionally limited. Additional wording, dates, filters, different column names or policy expressions require the general agent or conservative abstention; this is not a universal natural-language query compiler.
- Policy parsing accepts one complete recognized rule, not arbitrary document prose or inferred precedence. Retrieval scope/top-K limitations remain unchanged.
- Complete deterministic rendering currently supports up to eight returned rows/entities, matching the existing eight-statement answer cap. Longer, empty, truncated or unquotable results abstain; no partial list is presented as complete. Expense rows also must match dataset row_count and have unique employee labels.
- Session/CSRF enforcement is unchanged and covered by the regression suite. The infrastructure verification uses trusted fixture identity and is not a browser login/CSRF acceptance test.
- Final authenticated browser/API acceptance remains appropriate for **csv-05, combined-04 and combined-05** with isolated fictional data. The exact supported questions now require zero Groq calls. Any proposed test of unsupported wording that reaches Groq still needs separate explicit approval.
- This work does not rewrite historical scores or claim successful live Groq inference. General agent reasoning/tool-generation risks outside the deterministic operations remain.
