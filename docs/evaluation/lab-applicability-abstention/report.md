# Applicability Lab: exact early abstention

30 October 2026. **The evidence is present for qualified results; a grounded API answer is not verified.** No application scope guard was bypassed and no live provider calls were made.

## Exact trace

Request `d8ba6f69-0d22-4fb9-85c7-ae91ae04ecef` returned HTTP 200 with an abstained outcome in 561.4 ms. The [safe trace](safe-trace.json) records:

1. Generic routing; dataset discovery and two schema inspections succeeded.
2. Evidence preparation discovered a named owned policy, performed filename-scoped BGE/PG retrieval and loaded complete policy context.
3. `agent-abstention`, reason `ambiguous_rule`, before any queryDataset or model-call event.
4. No CSV query, Groq call, answer generation or citation verification.

The historical log omits source names/IDs, but the preparation algorithm selects the single explicitly named owned policy, and the supplied question names only the new lab PDF. Current read-only inspection independently verifies that exact owned file and retrieval scope. It does not invent a historical CSV query: none occurred.

## Real account evidence

Trusted operator inspection under the previously authorized user 6 identity used local PostgreSQL/BGE, with PostgreSQL default_transaction_read_only=on and all external HTTP blocked. See [readonly-verification.json](readonly-verification.json).

- Exactly one owned ready lab PDF; its stored file_hash matches the generated fixture PDF bytes.
- Three retrieved chunks belong only to that named PDF; complete policy context has 12 chunks.
- Exactly one owned ready lab CSV, 25 rows; canonicalized stored rows match the independently generated fixture rows, including inferred nulls and numeric types.
- organization and incident_at are text fields; response_hours and maintenance_notice_hours are numeric. No inference that upload dates or ownership establish policy scope was made.
- External provider attempts: zero. Existing records and source files were not modified.

The policy explicitly defines exact organization equality, an inclusive UTC start and exclusive UTC end using incident_at, and a maintenance-notice threshold. For known rows the CSV supplies those facts. Its deliberate negative cases remain: LAB-023 has null organization; LAB-024 has null incident_at; LAB-025 has yes maintenance with null notice. Their missing facts cannot be inferred.

## Confirmed cause and capability boundary

`prepareAgentEvidence` calls `ensureSLAPolicyContexts(true)` before any CSV query. The latter delegates to `policyContext`, whose applicability decision uses text restriction detection (`hasAmbiguousSLAScope`) and conflicting-threshold checks. It does not extract typed organization/date predicates, bind them to an authorized dataset or evaluate rows.

Consequently `ambiguous_rule` here means **unsupported/unverified applicability evaluation**, not that the new fixture was shown to contain conflicting deadlines or absent organization/date evidence. Schema discovery alone is not row proof. The presence of fields is neither evaluated nor treated as authorization to apply the policy.

This limitation was already documented in the [fixture instructions](../../fixtures/northstar-applicability-lab/README.md) and [evidence-first implementation report](../general-evidence-first/report.md). Moving the guard earlier saved doomed model calls but did not implement a row-level applicability evaluator. The new evidence resolves parts of the data problem, not the missing application capability.

## What can and cannot be concluded

Because the stored CSV matches the independently validated fixture, known-scope arithmetic supports **P1=2, P2=2, P3=3 confirmed late first responses**, total 7. A qualified answer must also separate 3 maintenance-excluded rows, 1 unresolved in-scope maintenance row and 2 unknown-applicability rows. It must not present 7 as a complete unconditional count for every record.

Required support is the lab PDF's page 1 scope, page 2 thresholds/equality and page 3 maintenance rules, plus actual CSV query evidence proving scope, eligibility and counts. Those are evidence requirements, not invented application [D]/[C] markers. No grounded API answer with those citations was produced or verified in this task. Independent artifact/row arithmetic is not a substitute for the application's source-reference verifier.

## Change decision

No semantic application correction was made. A column-presence exception, skipped scope guard, automatic retry or lab-specific predicate parser would not safely implement arbitrary policy applicability. Nor would merely deferring the same text guard after Groq calls help: it would still refuse while spending additional quota.

A safe general implementation requires explicit supported predicates with source references, owner-scoped field binding, UTC/date/type/boundary validation, maintenance conditions, unknown/outside-scope classification, aggregate completeness and tests preserving concurrent-dataset consistency. It must preserve unknown outcomes and generate a qualified result rather than claim applicability for every row. That is a real missing capability, not an established one-line false comparison. No fixture-specific workaround was added under the guise of a fix.

## Focused regression

Added a characterization/safety regression in `tests/agent-evidence-preparation.test.ts`: an owned policy and advertised organization/date columns do not bypass the guard; both a fully specified hypothetical row and an incomplete row remain unqueried by the current preparation gate. This test explicitly records the capability boundary and prevents unsupported column-presence shortcuts. It is not a positive applicability acceptance test.

The focused preparation suite passed: three tests, zero failed/skipped. Read-only real PostgreSQL/BGE inspection passed; source hashes and stored rows match the separate fictional fixture. No full benchmark or unchanged broad regression suite was rerun. No application code, existing data, credentials, models, quota ledger or historical evidence changed. Documentation links and diff checks passed. No commit or push.

## Final status

Root cause confirmed: early gate rejects restricted policy text before evaluating available row evidence. Correct original/lab source ownership and fixture contents are verified in the current account; historical CSV selection was never exercised. A qualified numerical answer is supported by the fictional evidence, but the existing Agent **still cannot automatically establish and cite it**. General applicability evaluation remains required; genuine missing-data refusals must remain.
