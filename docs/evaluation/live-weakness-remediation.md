# Live evaluation weakness review — 29 October 2026

This is a targeted follow-up to the unchanged [25-case live benchmark](final-live/batch-03/report.md). No live provider requests were made during this work. Original questions, expected results, historical reports and blank human-review templates remain unchanged. Regression responses are scripted, not evidence of improved live AI accuracy.

## Findings before changes

| Case | Saved evidence and confirmed issue | Change and remaining uncertainty |
| --- | --- | --- |
| csv-05 | Discovery and schema inspection succeeded; the next planning request returned HTTP 400, without a final answer. The historical artifacts retained status/type only, not the rejection code or rejected arguments. | No speculative query/schema/SDK fix. The exact authored filter/sort plan succeeds through the installed SDK with scripted tool calls and against isolated PostgreSQL. Safe diagnostics now allow a small set of known provider error codes. Exact historical rejection cause remains unknown. |
| conflict-01 | Both policies were cited, but the answer said the higher target must apply. Neither policy establishes that rule. | Planning and generation explicitly prohibit treating magnitude, retrieval order or a revised-looking filename as precedence. Require evidence of applicability and precedence, otherwise abstain. This mitigates a model instruction-following failure; citation identity alone cannot validate reasoning. |
| ambiguous-01 | The answer assigned the general 15-unit policy personally despite unspecified department and department-specific alternatives. | Planning asks for scope-specific alternatives; final instructions prohibit assuming personal applicability from a general policy. Missing required scope must lead to the existing canonical abstention. |
| combined-04 | Answer named Beta and the 15-unit threshold but omitted Beta's actual 6, the 9-unit shortfall, and the other teams' compliance. | Generation now explicitly requests actuals, threshold, differences and remaining groups' status. The literal question asks which teams fall short; the missing numeric detail is principally a benchmark completeness issue, not a wrong identification of Beta. Human semantic judgment remains separate. |
| combined-05 | Answer correctly identified Jon and 620 versus 500 but omitted the explicitly requested difference, 120. | Planning collects operands for every requested part; generation explicitly requests numeric excess with units and strict/inclusive boundary handling. No hardcoded benchmark answers or new retrieval shortcut. |
| conflict-02 | Genuine sales CSV and both policies supported conditional comparisons, but the evaluator allowed only document identities, rejecting the CSV. | Evaluator permits sales.csv (201) as supplemental evidence for this case, while requiring both policy chunks. CSV provenance, validated plan, independent row oracle, marker checks and human semantic review stay in place. The agent is separately instructed to say the operative policy is unresolved when giving conditional comparisons. |

The generation prompts already prohibited unsupported claims and ambiguous selection. The observed model violated that general contract; its internal reason is not observable. These changes make the particular failure modes explicit without claiming a deterministic semantic verifier or a guaranteed live fix. Prompt-only assessment can still fail.

## Changes

- [knowledge-agent.ts](../../src/lib/knowledge-agent.ts): scope/precedence rules in planning; explicit completeness, arithmetic operands, equality boundaries and conditional-policy rules in final generation. Existing tool limits, provider selection, budgets, ownership and reference-based final citation verification remain in use.
- [reliability.ts](../../src/lib/reliability.ts): for HTTP 400, parse a bounded response body only to extract recognized error code/type values. Raw messages, failed generations, arguments and unknown strings are discarded. No retry behavior changes. Older diagnostics without this optional field remain compatible.
- [metrics.ts](../../evaluation/metrics.ts): distinguish mandatory source recall from allowed supplemental citations for conflict-02. The original fixture definitions and refusal labels are not rewritten. This is an evaluator annotation, not a runtime authorization change.
- [live-evaluation-improvements.test.ts](../../tests/live-evaluation-improvements.test.ts): installed-SDK scripted workflows, exact CSV filter/sort, HTTP 400/no retry, safe errors, evaluator provenance/required-source/independent-oracle checks, and isolated PostgreSQL ownership verification.

There are no migrations, model/configuration changes, authentication changes or changes to stored application data. Existing unrelated working-tree changes were preserved.

## Offline recheck, not another live run

[Machine-readable recheck](live-weakness-recheck.json) applies the updated evaluator to the six unchanged saved responses. It makes no network requests and does not rerun generation or replace historical results.

- conflict-02 changes from automatic failure to automatic pass / **needs review**: the valid CSV no longer causes an allowlist false positive. This does not approve its conflict explanation or establish semantic correctness.
- csv-05 remains an execution failure.
- ambiguous-01 remains an automatic failure.
- conflict-01, combined-04 and combined-05 remain needs review; genuine quotes and incomplete numeric extraction do not certify correctness.
- No human annotations were created. Historic aggregate scores are retained as originally reported.

## Verification

Tests use fictional evidence. Scripted provider responses exercise the real SDK path but do not exercise Groq inference.

| Check | Actual result |
| --- | --- |
| `npm test` | 239 tests: 230 passed, 9 optional database tests skipped, 0 failed |
| `npm run test:fresh-db` | 239 passed, 0 skipped, 0 failed; all database flags enabled |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed; compilation, TypeScript, static generation and build traces completed |
| `npm run security:check` | 243 files scanned, 280 history blobs checked, no findings |
| Documentation links and `git diff --check` | Passed |
| Live Groq requests | 0 |

Seven new registered tests cover the targeted paths; several iterate over multiple cases. The disposable database runner applies migrations to a separate local cluster, uses a restricted runtime role, runs authentication/CSRF/owner isolation/lifecycle/query regressions, verifies fixture cleanup, and removes that cluster. It never targets the existing application database. No existing user records were written.

The sandbox initially prevented subprocess/socket-based checks; the isolated database tests, Webpack build and repository scan completed outside that restriction. A diagnostic field initially needed a backwards-compatible optional TypeScript shape; that was corrected and the final TypeScript/build checks passed. The production build emitted existing safe 503 logs while prerendering diagnostic endpoints, but completed successfully; a build is not a live service acceptance test.

The original 25-case fixture hash remains `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. Historical cumulative-results SHA-256 is `54b5b4885bfa46e810fcea78e9ceb213153d9a52946694839d69b2c53bc3db65`. All 24 original human-review templates still have blank reviewers. No files were staged, committed or pushed.

## Live retest still required

Separate explicit approval is required before any Groq requests. Retest exactly **csv-05, conflict-01, ambiguous-01, combined-04, combined-05 and conflict-02**, using the original questions and isolated fixtures. Do not automatically rerun the other 19 cases or retry failed live requests.

Acceptance checks:

1. csv-05: authorized East rows in descending amount order, 20 then 10, with real CSV citation. If HTTP 400 recurs, retain only the allowlisted code and stage; do not infer its reason from the scripted tool_use_failed test.
2. conflict-01: no higher-target precedence rule; abstain unless actual evidence establishes precedence.
3. ambiguous-01: do not assign a personal target without department context. Current public response contract supports canonical abstention, not a custom uncited clarification message.
4. combined-04: Beta=6, threshold=15, shortfall=9; Alpha and Gamma meet the target, supported by policy and grouped totals.
5. combined-05: Jon=620, threshold=500, excess=120; strict above excludes Sol at exactly 500. Require evidence for every boundary claim actually made.
6. conflict-02: distinguish both thresholds, compare totals correctly, explicitly leave policy authority unresolved and cite both policies plus the CSV. Updated automatic pass still requires semantic review.

A complete live fix cannot be claimed yet. In particular csv-05 has improved diagnosis and local regression coverage, not a confirmed provider-side remedy.
