# Bounded general evidence-first workflow improvement

30 October 2026. One focused change; no live model calls or original benchmark rerun. Earlier [Test 18](../test-18-local-quota/report.md), [Test 19](../test-19-local-quota/report.md), [Groq tool reliability](../groq-tool-reliability/report.md) and [aggregate-schema](../csv-aggregate-schema/report.md) findings are preserved.

## Confirmed starting point

General orchestration spends model calls selecting document search, selecting CSV queries, sometimes correcting plans, confirming readiness, then generating. Each continuation resends accumulated history and tool definitions. Test 18 exhausted admission before planning call 3; Test 19 had an invalid COUNT correction and exhausted admission before call 4. Those were legitimate local TPM rejections, not accounting leaks. Separate provider HTTP 400/tool_use_failed failures occur before rejected arguments can execute. The short admission window cannot wait for every fresh token window.

The aggregate union, prepared schemas, completion hint and quota waiting already existed; they were not reimplemented. This change targets repeated initial document selection and planning that continues despite a mandatory applicability blocker.

## Implemented workflow

1. Preserve existing deterministic operations and the general planner fallback.
2. Reuse the backend's existing bounded policy discovery for combined-source questions. Prepare evidence only if exactly one available owned policy filename is explicitly named with filename boundaries. Truncated/ambiguous catalogs, excluded/negated source mentions, absent sources or unavailable metadata retain the normal planner path. No filenames, question templates, thresholds or fixture values are hardcoded.
3. Retrieve that selected policy with existing owner/ready/filename-scoped BGE/pgvector search. Keep original text, chunk IDs and citation provenance in the request-local session.
4. Run the existing complete-policy SLA applicability gate before spending a model call when the combined intent explicitly applies this selected evidence to data. A known unresolved restriction returns the existing insufficient-evidence result; it does not become a verified compliance answer.
5. Offer an at-most-800-encoded-token preview array in the initial planner prompt alongside the already authorized schema catalog. Each preview uses an original substring and an explicit partial flag. Additional search tools remain available for incomplete facts, ambiguity, conflicts and multi-step questions.
6. Reuse fully supplied previews in existing evidence deduplication. **Partial or omitted previews are never marked fully supplied:** a subsequent search can still return the original full excerpt.
7. After any successful general CSV query, check existing policy applicability before another planning call. A mandatory unresolved blocker stops planning and returns refusal. Otherwise the existing completion hint, follow-up tools, confirmation and final grounded generation remain available.

This is evidence preparation and blocker gating, not a new question-answer handler. CSV-only and unnamed/other-document questions retain the general path. Document RAG remains unchanged. Production early policy discovery retains its existing ready-policy naming/catalog limitations; this optimization does not claim to prefetch every possible PDF/DOCX.

## Safety boundaries

No client identity or arbitrary SQL is introduced. Owned discovery, structured plan parsing, numeric-column validation, parameterized read-only queries, deadlines, tool/step limits, cancellation, complete-policy context, source verification and citations remain enforced. Backend evidence is retained independently of compact model previews. Missing metadata is never inferred.

No tool-use repair or automatic retry was added. HTTP 400/tool_use_failed still fails safely, with the existing structural diagnostics. Fewer required model invocations reduce exposure in eligible workflows but do not change the model's per-call failure probability. Genuine local/provider quota exhaustion remains HTTP 429; all original RPM/TPM/RPD/TPD limits and reservations are unchanged.

## Controlled before/after measurements

Fictional policy and CSV services were passed through the actual SDK/transport with a scripted provider. Baseline has no preparation catalog, so the model selects document search before SUM. Prepared mode supplies the same original document before planning, so the script directly selects the same validated SUM. Neither uses the completion hint: follow-up confirmation remains enabled, isolating the saved document-selection round.

| Controlled path | Model calls | Valid CSV queries | Summed estimated token reservations |
|---|---:|---:|---:|
| Baseline general combined | 4 | 1 | 13944 |
| Prepared general combined | 3 | 1 | 10658 |

One model call and 3286 estimated reserved tokens are avoided (23.6%). Both return the same grounded fictional comparison with verified original document and CSV references. These are sequential reservation estimates, not concurrent charge or measured live usage. Scripted provider choices demonstrate the supported workflow, not real Groq adherence.

Additional observed offline paths:

- Explicitly selected SLA policy with unresolved scope: **zero provider calls, zero CSV queries**, correct refusal.
- General unprepared policy search followed by CSV query revealing a blocker: **two provider calls**, then refusal before confirmation, even without evidenceComplete=true.
- Existing six consecutive general document/filter/sort/AVG/combined/missing/conflict scenarios retain expected behavior and citations through their ordinary fallback paths.
- Existing CSV completion and aggregate-union optimizations remain; no new CSV-only call reduction is claimed.
- Document RAG's existing single-generation flow remains; no RAG call reduction is claimed.

For complex/ambiguous questions, preparation can add local discovery/retrieval work, and previews add some initial prompt context. A model may still search again. Arbitrary valid questions retain the normal tools rather than being forced through a preparation shortcut.

## Tests

New regressions cover named-source preparation, ambiguity/truncated catalog fallback, filename boundary collisions, negated sources, metadata failure fallback, cancellation, bounded previews, original text retention, partial-preview follow-up, verified combined answers, pre-model refusal and early refusal after a CSV query. Existing malformed provider, local/provider 429, deadline, reservation reconciliation, structured aggregate/filter/group/sort, document RAG and ownership regressions remain.

Focused run before the partial-preview refinement: 45 registered, 44 passed, one database-only test skipped. Final targeted helper/general/quota run: **23 passed, zero failed/skipped**. Final complete disposable-PostgreSQL suite: **319 passed, zero failed/skipped**. TypeScript, ESLint, supported Webpack production build, repository security scan and diff checks: **passed**. The disposable cluster was removed and security scan returned no findings. These are scripted/deterministic checks, not live AI quality or human review.

Development caught a partial-preview deduplication hazard before completion; it was corrected and regression-tested. No known test failure is hidden as a successful live result.

## Exact files changed for this task

- `src/lib/agent-evidence-preparation.ts`: bounded explicitly selected source preparation.
- `src/lib/agent-tools.ts`: allow the existing applicability check for declared combined row-application intent before a CSV query exists.
- `src/lib/knowledge-agent.ts`: prepared-evidence prompt/reuse, early blocker stop and canonical refusal response.
- `tests/agent-evidence-preparation.test.ts`: preparation safety, fallback and preview regressions.
- `tests/general-agent-stabilization.test.ts`: controlled before/after comparison, early blockers and partial-preview follow-up.
- This report. Prior unrelated working-tree changes are preserved.

## Remaining limitations and next verification

General model reasoning, tool selection, scope binding and completeness are not deterministically proven. The new lab's organization/date predicate evaluation is still not implemented; correctly blocked questions remain insufficient evidence. Do not advertise those refusals as successful lab answers. Broader free-form document/CSV questions can still require multiple calls and fail quota admission. Current deadlines still cannot always wait for a fresh token window. No limits or timeouts were artificially raised.

Controlled live testing needs separate approval and should compare one eligible unscoped combined question, a complex follow-up case and a known blocked-scope refusal, logging actual call/usage totals. Do not rerun the full benchmark by default. No assertion is made that all HTTP 400/429 failures are resolved.

No existing records, source files, credentials, provider configuration, quota ledger or historical evaluation evidence were modified. No live Groq calls, commits or pushes.
