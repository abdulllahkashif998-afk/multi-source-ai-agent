# General planning completion optimization

30 October 2026. No live Groq requests.

## Change

The general planner's `queryDataset` tool now accepts an optional `evidenceComplete` scheduling hint. The planner is instructed to set it only when the query is the final evidence operation needed for every part of the question. The backend strips this hint before passing the unchanged structured query plan through existing schema, ownership and SQL validation.

Planning stops after this tool step only when all these checks pass:

- The model explicitly declared completion.
- Exactly one query tool call and successful tool result occurred in the step, with no SDK tool error.
- The validated query returned non-empty rows and is not possibly truncated.
- For questions recognized by the existing combined-evidence contract, document evidence has already been retrieved.

Final structured answer generation, source-reference resolution, evidence-contract enforcement and citation verification are unchanged. No hints are accepted through the public CSV query API. Search alone, empty/error/truncated results, discovery and schema inspection cannot trigger this shortcut. Existing planning bounds and duplicate handling remain.

This is not deterministic semantic completeness verification. It moves the model's readiness judgment into its query selection call and guards that judgment with backend result checks. The generator still must refuse when the selected evidence does not support the question. A mistaken premature declaration could cause a refusal where further tools would have helped. No claim is made that prompt instructions prove applicability, conflict resolution or answer completeness. Controlled live verification remains necessary before claiming unchanged real-world accuracy.

## Why extra planning remains

Exploratory queries, multiple requested calculations, dependent queries, policy ambiguity, additional dataset discovery, errors and truncated results may need another model/tool round. The hint defaults to absent and never forces termination in those cases. Complex questions can retrieve documents first and declare their final query complete later. No question patterns, filenames, dataset values or thresholds were added.

Document RAG is unchanged: it already has local retrieval followed by one generation call. General document-only Agent searches retain the normal planning loop because successful retrieval alone cannot establish sufficient evidence. CSV and combined questions can benefit when the final query can be selected from established schemas and evidence.

## Controlled measurements

Same fictional CSV task and scripted provider responses through the actual SDK/transport; baseline omits the completion hint and optimized case supplies it. Token figures are sums of estimator reservations for serialized HTTP bodies, not simultaneous charges, measured provider usage or live AI quality.

| Path | Model HTTP calls | Sum of estimated reservations |
|---|---:|---:|
| CSV baseline | 3 | 10257 |
| CSV declared complete | 2 | 7110 |
| Complex/no completion declaration | 3 | 10257 |
| Combined search then final query | 3 | 10322 |

CSV reduction: one call and 3147 estimated reserved tokens (30.7%). The earlier scripted combined baseline used four calls; the optimized combined scenario uses three. Final answer citation checks still execute. Production adoption and actual token savings depend on model behavior and evidence size. The tool schema and instructions add some prompt overhead to calls that do not use the hint.

## Tests

`tests/general-agent-stabilization.test.ts`: six tests passed. Existing six consecutive general scenarios retain their original call counts when the model does not declare completion. New parameterized cases cover baseline versus complete queries, complex continuation, empty results, result-limit truncation, invalid numeric aggregation, generator refusal despite a completion declaration, combined citations and removal of the hint before SQL execution.

Full suite in a newly initialized isolated PostgreSQL cluster: 304 passed, zero failed/skipped. All nine migrations applied, required tables/indexes/foreign keys verified, populated-database setup refused, temporary cluster removed. Existing application records were not used or modified. The final additional refusal subcase was also rerun in the focused suite.

TypeScript, ESLint, Webpack production build and repository security results are recorded in the final task response. Security scan found no findings. Initial sandboxed build/database/security subprocess checks could not complete; reruns with subprocess permissions were used. No provider requests, quota resets, model changes, historical report changes, commits or pushes.

## Files changed for this task

- `src/lib/knowledge-agent.ts`: planner-only completion hint, result guards and stop condition.
- `tests/general-agent-stabilization.test.ts`: bounded orchestration and reservation regressions.
- This new report. Prior working-tree changes predate this task and are preserved.
