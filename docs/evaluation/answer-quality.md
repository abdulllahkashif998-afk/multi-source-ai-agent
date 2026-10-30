# Day 9 Step 3 — Answer correctness and citation evaluation

Verified on 27 October 2026.

## What was actually measured

The answer evaluation tooling is implemented and regression-tested. **No live Groq or Gemini answers were generated in this step.** Groq credentials are configured, but `ALLOW_LIVE_AI_EVAL=1` is not enabled. Credentials alone are not permission to consume quota. No model configuration was changed to enable a run.

The 25 original cases, questions, expected facts, numbers and source labels are unchanged. Their SHA-256 remains `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`.

A complete offline scripted run exercised the answer evaluator and existing citation validator. Its actual outputs are recorded, but they are **framework checks, not AI accuracy results**:

| Category | Executed scripted cases | Automatic checks passed | Final pass | Fail | Needs review |
| --- | ---: | ---: | ---: | ---: | ---: |
| Document | 6 | 6 | 0 | 0 | 6 |
| CSV | 6 | 6 | 0 | 0 | 6 |
| Combined | 6 | 6 | 0 | 0 | 6 |
| Insufficient evidence | 4 | 4 | 4 | 0 | 0 |
| Conflict / ambiguity | 3 | 3 | 0 | 0 | 3 |
| Total | 25 | 25 | 4 | 0 | 21 |

The four passes mean only that scripted canonical abstentions matched the missing-evidence contract. They do not establish a real provider's abstention quality. No human semantic reviews have been completed. Factual correctness, completeness, claim-level citation support, grounding and conflict-handling accuracy for real AI answers are **unmeasured**, rather than zero or 100%.

In this scripted run, all 23 extracted numeric bindings matched their authored tolerances, and all 12 CSV evidence sources matched independently calculated rows. Expected source identities and exact quotes also passed. These deliberately authored outputs are a sanity check of the evaluator; they are not independent evidence of model quality.

## Questions, expected results and actual responses

The [complete per-case record](answer-quality-mock/report.md#per-case-evidence-and-outcomes) includes all 25 questions, expected answers, original source labels, expected calculation rows, actual **scripted** responses, returned citation IDs and quotes, independent CSV calculations, classifications and reasons.

The [machine-readable results](answer-quality-mock/results.json) preserve parsed answers, complete document/CSV source metadata, actual CSV plans/results, numeric checks, citation identity/quote checks and judgment reasons. [Review templates](answer-quality-mock/review-template.json) bind each review to the exact response. Blank reviewer/notes fields intentionally prevent an unfinished template from counting as a completed review.

There are no failed benchmark outputs in the scripted run. Twenty-one unresolved cases must not be counted as successes. In particular:

- Six document answers need review of scope, units and conditions, such as unopened equipment, annual leave and manager approval strictly above the threshold.
- Six CSV answers need review that the selected plan answers the question, rather than merely calculating its own result correctly.
- Six combined answers need review of both policy evidence and CSV facts. Beta's total is 6 and shortfall 9 against 15; Alpha's surplus is 15; Gamma meets the threshold exactly. Jon alone exceeds 500, by 120; Sol at 500 does not. INC-B takes 3 hours against a 2-hour deadline, a delay of 1.
- Two conflicting-policy cases must not silently choose between active targets of 15 and 22. The department case must not choose North's 18 or South's 25 without clarification. A generic canonical refusal is safe but still needs review for useful conflict handling.

## How validation works

The runner reuses existing `runEvaluation`, the original fixture catalog, application RAG/agent adapters and production citation verification. It does not change retrieval, orchestration, SQL execution, authorization or provider settings.

Automatic checks distinguish three different questions:

1. **Provenance:** Does each cited identity exist in the applicable fictional corpus? Do filename, chunk/page metadata and quoted text match? Are markers defined, used and in the correct document/CSV namespace? Are required document and CSV sources present?
2. **Calculation truth:** Do CSV rows follow from the returned structured plan? A separate in-memory oracle parses the fictional CSV independently and computes filters, COUNT/SUM/AVG, GROUP BY, sorting and limits. It does not call the production SQL compiler/executor. It checks sorted order, duplicate rows, null aggregate results and numeric tolerance. It also verifies the original expected rows and independently derived combined calculations before any provider work.
3. **Claim support:** Does each cited source actually support the local claim, including conditions, units, negation and completeness? Automatic provenance checks cannot establish this. The answer remains needs-review until the rubric is completed.

Numbers retain the original case-specific extraction patterns and absolute tolerances. Missing extraction is uncertainty, not automatically a wrong answer. Detecting a wrong extracted number fails. Correctly computed rows from the wrong filter can still be irrelevant; that requires plan-to-question review. Additional document sources outside a case's active corpus are rejected, even if they appear elsewhere in the global fixture catalog.

## Human review rubric

Review every factual statement against canonical fixtures and the returned citations. Record claim-to-source reasoning in notes, including comparisons and strict/inclusive boundaries. Do not approve an answer merely because it contains a correct number or genuine quote.

| Dimension | Pass | Fail | Needs review |
| --- | --- | --- | --- |
| Factual correctness | All claims, arithmetic, entities, signs and units are correct | A claim or calculation is wrong | Meaning cannot be established confidently |
| Completeness | Every requested part is answered | A requested conclusion or condition is omitted | Scope of the request is unclear |
| Groundedness | Every factual claim follows from authorized evidence | Any claim adds unsupported information | Entailment is disputed or uncertain |
| Citation support | Local markers point to evidence that supports the claim | Missing, fabricated, irrelevant or misleading support | Authenticity passes but claim support remains unclear |
| Conflict handling | Applicable disagreements/ambiguity are recognized and handled safely | A conflicting policy or department is silently selected | Available evidence does not resolve the interpretation |

Each dimension must be `pass`, `fail` or `needs-review`. All five must pass to approve answerable prose. A deterministic failure cannot be overridden by an approving annotation. Reviews require reviewer identity, meaningful notes, fixture hash and response hash. Stale hashes are ignored and reported as stale; they never approve changed answers. Unit-test annotations are synthetic and are not included as human approvals in the published results.

## Failure and uncertainty categories

| Category | Evidence needed |
| --- | --- |
| Retrieval failure | Actual retrieval trace misses required evidence; diagnostic search alone is only a candidate explanation for agent behavior |
| Tool-selection failure | Invalid plan or reviewed trace shows wrong/missing tools; a missing citation by itself is insufficient |
| Calculation error | Extracted value disagrees with the declared expected fact, or independent CSV result check fails |
| Hallucination | Semantic review confirms an unsupported claim; quote membership cannot exclude this |
| Citation issue | Undefined/unused markers, wrong identity/metadata/quotes, missing source or reviewed unsupported citation |
| Abstention error | Answering an explicitly unsupported question or refusing an answerable one; noncanonical wording may require review |
| Provider failure | Safe provider HTTP/error classification confirms rate limit, permission denial or provider call failure |

Unknown execution failures stay `execution_failure` rather than being blamed on the provider. Missing required sources are flagged for trace review; they do not automatically establish a retrieval defect. Confirmed categories and suspected causes are stored separately. Timeouts and available partial observations remain visible in the underlying run results. Provider error bodies and secrets are not reported.

Negative regression tests deliberately inject wrong numbers, made-up citations, altered quotes, out-of-corpus policies, forged CSV rows for unregistered plans, lost combined citations, stale annotations and a mocked Groq 429. These evaluator tests pass by detecting the injected failure; they are not failed live benchmark cases.

## Run offline and review saved results

```bash
npm run evaluate:answers -- --out .evaluation-results/answer-offline
```

Default mode blocks all HTTP and uses no database, embeddings or provider quota. Its output includes `results.json`, `report.md` and `review-template.json`.

To review a saved run without generating another answer:

1. Copy its review template to a separate file.
2. Fill reviewer, notes and all five ratings after checking the claims and evidence.
3. Re-score the saved answers with those annotations:

```bash
npm run evaluate:answers -- \
  --input .evaluation-results/answer-offline/results.json \
  --reviews .evaluation-results/answer-offline/completed-reviews.json \
  --out .evaluation-results/answer-reviewed
```

Saved-result review makes zero network requests, recomputes automatic checks and refuses changed benchmark hashes. It preserves source-run provider/model/HTTP-attempt metadata. It does not recreate original timings or missing traces. Reviewing mock answers still produces a mock report, never a live score.

## Optional live Groq evaluation

**These commands were not executed in this step.** They are explicit operator opt-in examples. Keep the already selected Groq model and existing pacing/retry/deadline configuration.

```bash
# One document RAG case:
ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server \
  --import tsx evaluation/answer-quality-cli.ts \
  --mode live --cases doc-01 --limit 1 \
  --out .evaluation-results/answer-live-document

# Separate small batches cover all original categories; run serially:
ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server \
  --import tsx evaluation/answer-quality-cli.ts \
  --mode live --cases csv-02,combined-01 --limit 2 \
  --out .evaluation-results/answer-live-csv-combined

ALLOW_LIVE_AI_EVAL=1 node --env-file=.env.local --conditions=react-server \
  --import tsx evaluation/answer-quality-cli.ts \
  --mode live --cases missing-01,conflict-01 --limit 2 \
  --out .evaluation-results/answer-live-refusal-conflict
```

Live mode requires existing `AI_PROVIDER=groq`, a valid configured model/key, exact opt-in and explicit case IDs. One case is the default; at most three are permitted per invocation. Cases are separated by 65 seconds. A network guard allows only configured Ollama embedding/tag endpoints and Groq's chat-completions endpoint. It caps **actual HTTP attempts, including transport retries, at 12 per invocation**. The existing provider transport still enforces its configured RPM, deadlines and bounded retries. There is no runner retry, provider fallback or quota-setting change.

Agent cases can make multiple provider calls. A case budget can therefore be exhausted before three cases finish; this is reported as a failure, never replaced by scripted output. Separate processes do not share the evaluation budget; run serially and check the provider quota. No live claim can be made for unselected or failed-setup cases. To cover all 25, explicitly select small batches with separate output directories, then complete semantic reviews. This step deliberately does not produce a live aggregate from unexecuted cases.

Live fixtures reuse the existing temporary-table isolation: dedicated fictional owner, explicit IDs, scoped service identity, serialized leases, savepoints, rollback and restoration on failures. They neither create accounts nor read public user documents as evidence. Browser/session authentication is covered separately by application regressions.

## Changed files

- `evaluation/answer-oracle.ts`: independent CSV and combined-calculation checks.
- `evaluation/answer-quality.ts`: stronger corpus checks, review rubric/binding, judgments, failure categories and counts.
- `evaluation/answer-quality-cli.ts`: offline/live/saved-review modes, guarded network budget, safe artifacts and review templates.
- `tests/answer-quality.test.ts`: 12 focused evaluator, guard and reporting regression tests.
- `package.json`: `evaluate:answers` command; no dependency changes.
- `docs/evaluation/answer-quality.md`, `answer-quality-mock/`, documentation links: report and actual scripted artifacts.

The original 25-case definitions, application code, models, authentication, SQL protections and citation verification are unchanged. No migrations were needed.

## Actual verification results

| Check | Result |
| --- | --- |
| Focused answer-quality tests | 12 passed |
| `npm test` | 176 registered; 171 passed; five optional database skips; zero failures |
| All database flags enabled | 176 passed; zero skips/failures |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| Supported production build, `npm run build -- --webpack` | Passed in isolated build directory; development cache preserved |
| Public data integrity | Before/after counts and content fingerprints matched for all 12 checked tables |
| Actual provider usage | Groq zero requests; Gemini zero requests |

The first sandboxed build could not create a process stream and failed while reading TypeScript configuration. The same supported build completed with the required process permissions. This was an environment restriction, not an application fix. No new browser tests were needed for operator-only evaluation files; existing frontend/backend unit regressions were included.

Repeat regressions:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

## Limitations and priorities

No confirmed application defect was found, so no retrieval or agent behavior was changed. The earlier [retrieval evaluation](retrieval-quality.md) found two hybrid first-position ranking weaknesses, but neither demonstrates an answer error without a real answer and supporting trace.

The first priority is an explicitly authorized small live sample followed by claim-level human review. Then run the remaining original cases in bounded batches and inspect failures before proposing retrieval or orchestration changes. Do not convert the scripted checks into an AI accuracy percentage.

These fictional short chunks do not measure ingestion quality, production index scaling, browser UX or broad domain correctness. Structural citation precision measures expected source identity, not semantic support. Numeric extraction cannot settle alternative wording, negation or units. Human ratings remain subjective; disagreements should stay needs-review or receive a second review. Mock execution timings are harness timings, not provider latency. Live results are stochastic and unavailable until executed.


## Later real Groq pilot — 28 October 2026

The original Step 3 scripted results above remain historical. A separately approved live pilot has now executed **doc-01, csv-01 and combined-01**, unchanged: 13 HTTP attempts, 13,225 reported tokens, three automatic passes, zero evaluator failures and three needs-review classifications. Human-reviewed: zero. The other 22 cases are not live-executed by this pilot. Full 25-case live accuracy and human semantic review remain incomplete.

See [actual answers/citations/timings](final-live/report.md), [machine-readable observations](final-live/results.json) and [unfilled review template](final-live/review-template.json). No automatic retry, provider/model change or production user-data mutation was made. The existing isolation uses trusted fictional operator identity, not browser/session replay.


## Later approved batch 02 — cumulative eight cases

[Batch 02](final-live/batch-02/report.md) executed doc-02, csv-02, combined-02, missing-01 and conflict-01 without repeating the pilot. Usage was 16 HTTP attempts/16,319 reported tokens. Cumulative coverage is **8/25** with **17 remaining**; formal classifications 1 pass (canonical missing-information contract), 0 fail, 7 needs-review; human-reviewed zero. Five automatic checks passed in this batch, but the conflict response asserted an unsupported higher-target-wins rule. That AI-assisted semantic finding is prominently retained for actual human review, rather than hidden by automatic provenance success. See [all-original-case cumulative evidence](final-live/batch-02/cumulative-results.json). No full live accuracy or human-review completion is claimed.


## Latest real benchmark execution — 28 October 2026

**All 25 original cases were executed once across the separately approved runs.** There are 24 returned structured responses and one HTTP 400 provider failure without a final answer. Automatic checks: **22 pass / 3 fail**. Formal evaluator outcomes: **4 canonical-refusal-contract passes / 3 fail / 18 needs-review**. Actual human-reviewed: **0**. These counts are not a claim of 88% answer accuracy.

Usage: **95 native HTTP attempts / 97,440 known reported tokens**, with usage unknown for the failed HTTP 400. No automatic retry or model/application/user-data change occurred. Earlier eight executions and conflict-01 artifacts were preserved. Daily token quota remained unknown; permitted response headers were recorded, and no quota/access/deadline stop occurred.

Important findings: conflict-01 invented a higher-target-wins rule; ambiguous-01 assigned 15 without a known department; combined-05 did not explicitly provide the requested 120-credit excess. csv-05 failed at provider planning. conflict-02's genuine extra CSV evidence triggered the unchanged evaluator's policy-only source whitelist; that raw Fail is retained as a scoring limitation, not called fabrication. All subjective review remains pending actual human decisions.

See [actual responses, citations, latencies and findings](final-live/batch-03/report.md), [all-original-case cumulative results](final-live/batch-03/cumulative-results.json) and [24 unfilled response-bound human review templates](final-live/batch-03/all-review-template.json). Earlier counts below are dated snapshots superseded by this execution status. **Execution is complete; human-reviewed quality acceptance is not.**
