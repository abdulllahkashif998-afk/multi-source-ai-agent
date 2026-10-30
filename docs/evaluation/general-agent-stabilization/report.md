# General agent stabilization for submission

## Confirmed causes and limits of diagnosis

The general path uses a multi-step model/tool loop followed by a separate grounded generation call. A serial CSV workflow can spend separate model invocations on discovery, inspection, querying, stopping planning and final generation. A combined workflow adds document search. Each invocation reuses the system/tool definitions and accumulated conversation, so successful calls can exhaust the next invocation's TPM admission. Existing tool-result caching saves backend work but does not remove the model round trips.

Recent safe logs in earlier investigations identify local TPM rejection during planning (`rateLimitOrigin=local`, `quotaReason=tpm`, HTTP 429). Successful provider dashboard rows do not prove subsequent invocations were admitted. No new exact request IDs were supplied for this task, so no claim is made that every reported failure has been individually correlated. No provider-429 or quota-accounting defect was confirmed by this investigation.

A read-only snapshot of the same-host Groq ledger contained 28 entries, no pending entries and no unknown charges. For its known completed entries:

| Measure | Snapshot value |
| --- | ---: |
| Sum of original reservations | 130851 tokens |
| Sum of reconciled reported total usage | 33995 tokens |
| Median original reservation | 4423.5 tokens |
| Median reported total usage | 974 tokens |

These are recorded reservations versus reported totals, not simultaneous minute usage, completion-token measurements or a new live benchmark. Entries do not identify the model, so this historical snapshot cannot all be attributed to 120b. Completed reservations are already reconciled to reported usage; the larger sum is **not** evidence that all reserved tokens remain charged. No ledger reset/removal was performed. Historical external usage and provider-wide remaining quota are unknown.

The configured model and user-confirmed budgets remain Groq `openai/gpt-oss-120b`, RPM 30, RPD 1000, TPM 8000, TPD 200000, with conservative 12-RPM pacing. Local reservation conservatism and repeated genuine input usage both contribute to admission pressure; their exact share in an individual historical rejection cannot be reconstructed without that request's complete safe measurements.

## Minimal general-path changes

No question patterns, filenames, thresholds or answers were added.

- New `src/lib/agent-planning-context.ts` prepares at most three owner-scoped dataset schemas through existing discovery/inspection functions. The model-facing catalog has an encoded array budget of 480 tokens plus its small wrapper, rather than an unbounded schema dump. Oversized schemas are marked omitted and require ordinary inspection. Additional datasets remain available through existing tools.
- Preparation is request-local. It does not cache across users, count metadata as evidence, permit uninspected queries or replace the current CSV compiler/ownership checks. It uses the existing tool/deadline budgets. Retrieval, query data and final quote choices are unchanged.
- `src/lib/knowledge-agent.ts` supplies that catalog before general planning and instructs reuse. A planner can issue a validated query directly when the needed schema is prepared, avoiding discovery/inspection model round trips. The model can still choose additional discovery, retrieval or inspection; actual call savings are not guaranteed.
- The planner's **actual provider output cap** is 1536 tokens, down from 3000. The final answer cap remains 3000. This reduces a given planning request's reservation by 1464 tokens without falsifying its estimate or raising quotas. A 1536-token planner can still truncate complex reasoning/tool output; a returned length finish reason fails explicitly as HTTP 502 / `AGENT_OUTPUT_LIMIT`, with no automatic retry or fabricated answer. The provider's model, low reasoning setting and tool configuration are unchanged.
- Existing HTTP 429 / `PROVIDER_RATE_LIMITED` handling and safe local/provider origin diagnostics are retained. Output-limit/application failures are distinct from quota errors. Citation verification, authentication, CSRF, ownership and validated read-only SQL remain enforced.

Existing deterministic paths are preserved but were not expanded. This is a bounded optimization of the general planner, not a new routing architecture or a promise that arbitrary questions fit the free-tier budget.

## General-path tests, explicitly mocked

`tests/general-agent-stabilization.test.ts` runs these six different questions sequentially through the actual SDK/provider integration and general orchestration with scripted Groq HTTP responses. Every case makes model calls; none uses a deterministic shortcut. Backend service fixtures are fictional. The tests verify orchestration and strict source validation, **not real model understanding or accuracy**.

| Scenario | Question | Observed mocked HTTP calls | Checked behavior |
| --- | --- | ---: | --- |
| Document | Explain the reimbursement guidance. | 3 | Original document citation |
| Filtering/sorting | Show individual East figures in descending amount order. | 3 | Validated filter/sort; rows 20, 10; CSV citation |
| Aggregation | What is the average amount in the ledger? | 3 | Validated AVG; independent fixture result 35/3 |
| Combined | Compare CSV values against the policy threshold and explain the differences. | 4 | Retrieval plus validated query; both citation families |
| Missing evidence | Who authorized an imaginary Neptune office? | 3 | Refusal/no sources |
| Conflict | Which of the conflicting reimbursement policies governs this ledger? | 3 | Scripted refusal/no sources |

For the scripted straightforward CSV flow, prepared metadata removes two serial tool-selection model rounds: five calls without preparation versus three observed with it. For the combined flow the analogous serial count is six versus four. These before counts follow the original serial workflow; they are not live before/after measurements. Document call count is unchanged. Model behavior may choose different tools or make redundant calls despite instructions.

Additional checks cover bounded/omitted schemas, uninspected-query denial, empty request-local catalogs, cancellation, exact reservation reduction and fail-closed planning truncation. Existing quota and general-agent regressions remain enabled. No new live provider requests or 25-case benchmark execution occurred.

## Verification results

| Check | Actual result |
| --- | --- |
| Standard automated suite | 291 registered; 280 passed, 11 database-only skipped; zero failures |
| Database-enabled suite | 291 passed; zero skipped/failures; separate disposable PostgreSQL cluster removed |
| Focused stabilization tests after nullability correction | 3 passed |
| TypeScript | Passed after production generation completed |
| ESLint | Passed |
| Webpack production build | Passed |
| Repository security scan / documentation links / whitespace | Passed |

The first build found two new TypeScript nullability errors; these were fixed with safe checks, then the focused tests/build were rerun. A concurrent standalone TypeScript run also encountered Next's generated files while the build replaced them; the final TypeScript run was performed sequentially after the build. These failed intermediate checks are not represented as passing runs. The final database suite includes the null-safe implementation. The standard full suite preceded that small guard correction; the focused suite and final database run cover it afterward.

No real-account data or source files were changed. Database-enabled regressions operate in their own temporary cluster and mocked-provider tests consume no Groq quota. Historical evidence remains unchanged. No credentials, session tokens or raw private evidence were written to this report.

## Submission assessment and remaining risks

**Suitable for submission as an implemented, tested prototype with explicit operational limitations; not established as reliably answering arbitrary live questions under this quota.**

- General live Groq acceptance of the changed planner/catalog is still required before claiming live improvement. No such approval or calls occurred. The lower planning output cap can increase truncation risk; scripted tests cannot measure its real frequency or answer quality. Do not claim otherwise.
- At 8000 TPM, growing evidence/context and several consecutive questions can still legitimately exhaust local/provider limits. Final generation still needs its own reservation. No generic unlimited-throughput claim is possible.
- Preparing a catalog adds one bounded database discovery and up to three request-local inspections even for document-only questions. This trades small backend/context overhead for fewer potential model round trips. Database unavailability can add its existing bounded connection/query latency; preparation is not a distributed cache.
- The new catalog is metadata only. All original evidence is retained for citation checking. Valid references still do not prove semantic correctness, policy applicability, completeness or human-reviewed benchmark accuracy.
- The persistent limiter coordinates same-host workers only. Other applications/hosts using the provider account are not globally coordinated. Retry after the charged rolling windows and remote cooldown/remaining constraints permit admission; never delete the ledger.
- Human semantic review and approved live general-path acceptance remain pending. Previous benchmarks, retests and browser evidence retain their original classifications.
- No commit/push was performed. Review the complete pending working tree and refresh the staging proposal before an approved GitHub delivery. Stop further architectural changes for today's submission; document these limits instead of adding more one-off handlers.
