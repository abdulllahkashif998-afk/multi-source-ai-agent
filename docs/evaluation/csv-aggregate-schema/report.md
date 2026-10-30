# Model-facing CSV aggregate schema alignment

30 October 2026. Targeted follow-up to [Test 19](../test-19-local-quota/report.md). No live Groq calls.

## Confirmed contract gap and change

The former model-facing aggregate object advertised op=count|sum|avg and an optional column for all operations. Backend compilation correctly rejected COUNT with a nonempty column and SUM/AVG without a numeric column. Test 19 therefore spent an additional model round correcting an invalid COUNT plan.

The planner schema now overrides only aggregate with a strict discriminated union:

- COUNT: `{op:"count"}`. No column or other extra properties.
- SUM: `{op:"sum",column:"<inspected numeric column>"}`.
- AVG: `{op:"avg",column:"<inspected numeric column>"}`.

The model schema requires nonempty column strings for SUM/AVG. Column existence and numeric type are dataset/owner-specific and remain authoritative backend checks; a generic static schema cannot prove them. There is no hardcoded dataset, question, column name or value.

The public query-plan schema and its request format are unchanged. Backend COUNT validation was tightened from a truthiness test to an explicit undefined check, so even column="" is rejected instead of silently treated as omitted. SUM/AVG checks were not weakened. No invalid COUNT column is automatically dropped or rewritten, which could change non-null-count intent into row-count semantics.

Filtering, grouping, sorting, limits, optional aggregate, evidenceComplete scheduling metadata, session-derived ownership, query compilation, read-only SQL, parameterized values, citations and provider quotas remain intact.

## SDK/model-tool compatibility checks

The installed AI SDK/Groq integration emits a nested anyOf with three object branches for aggregate. The regression inspects the actual mocked HTTP body: COUNT's branch has no column property and forbids extra properties; SUM/AVG branches require column. The root tool remains an ordinary strict object; no new provider options or parallel behavior were introduced.

The SDK validates these inputs before tool execution, and provider error diagnostics share the same model-facing schema. No strict-tool-output guarantee is assumed. Real Groq acceptance and generation choices have not been live-tested; mocked HTTP serialization is not evidence of provider-side reliability or schema adherence. Existing model/tool failure tests remain in the suite.

## Controlled correction-round comparison

The actual agent/SDK/transport was run twice with fictional services and a deliberately schema-aware scripted provider. One run temporarily restores the exact legacy advertised aggregate contract inside the sequential test; restoration is guaranteed with finally. That script reproduces COUNT with a column when the advertised schema permits it, then corrects it after the backend error. The aligned run emits a valid COUNT from the first selection. Neither run declares early evidence completion, isolating this change from the earlier planning-completion optimization.

| Controlled path | Model HTTP calls | Valid backend queries | Summed estimated token reservations |
|---|---:|---:|---:|
| Legacy schema, correction needed | 4 | 1 | 13563 |
| Aligned schema, valid first selection | 3 | 1 | 10444 |

Both return a grounded fictional count with original CSV evidence references. One correction call is avoided; summed reservations decrease by 3119 (about 23%). These are sequential estimator reservations, not simultaneous charge or actual live token usage. The script's choices are intentionally deterministic: this demonstrates that the alignment can eliminate this correction path, not that a real model will always follow the union or that a full question will fit TPM. An invalid model response still fails validation; no repair/retry bypass is introduced.

## Tests and actual validation

- Focused schema/general-agent/provider-diagnostic suites: **13 passed, zero failed/skipped**.
- Complete suite in a freshly initialized disposable PostgreSQL cluster: **314 passed, zero failed/skipped**. The existing application database was not used for fixture writes; the temporary cluster was removed.
- TypeScript, ESLint, supported Webpack production build, repository security scan and diff checks: **passed**; security scan found no findings.

New checks include valid COUNT/SUM/AVG, COUNT with normal/empty columns, missing/empty SUM/AVG columns, unknown operations, unknown/nonnumeric dataset columns, filtering/grouping/result sorting preservation, no-aggregate plans, and the actual SDK anyOf wire structure. Existing database query, authentication, ownership, citation, malformed-tool, timeout and quota regressions remain.

## Changed files

- `src/lib/agent-tool-inputs.ts`: strict operation-dependent planner aggregate union.
- `src/lib/generic-csv.ts`: reject a supplied empty COUNT column at the existing compiler boundary.
- `tests/csv-model-schema.test.ts`: schema/backend semantic regressions.
- `tests/general-agent-stabilization.test.ts`: SDK/provider wire inspection and legacy-versus-aligned controlled comparison.
- This report. Earlier evaluation evidence is preserved.

## Remaining limitations

Union validity does not prove correct query intent, selected dataset, aggregation scope, complete answers or correct arithmetic reasoning. Backend numeric-column validation remains necessary. Real models can still generate schema-invalid calls or provider tool_use_failed; actual error frequency and token savings remain unverified. Output schemas are slightly larger, and quota/deadline constraints remain unchanged. Applicability evaluation limitations from the Northstar Lab are separate and not changed here.

No application data, fixtures, credentials, models or quota ledgers were changed. No live model calls, automatic recovery, commits or pushes.
