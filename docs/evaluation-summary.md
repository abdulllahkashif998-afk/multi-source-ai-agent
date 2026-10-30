# Evaluation evidence and current quality limits

This summary distinguishes evidence types. Source reports and their machine-readable artifacts remain the primary records. No new live AI, retrieval or performance run was made for the final documentation pass (29 October 2026). Current non-live checks are listed in the [delivery-readiness report](final-delivery-readiness.md).

## Current evidence timeline — 29 October 2026

| Evidence stream | Actual retained outcome | Limit |
| --- | --- | --- |
| Original 25-case live Groq benchmark | 25 executed, 24 responses/one HTTP 400; automatic 22 pass/3 fail; formal 4 pass/3 fail/18 needs-review; 95 HTTP attempts/97,440 known tokens | Original classifications remain unchanged; failed-call usage unavailable; human-reviewed 0 |
| [Six-case live Groq retest](evaluation/final-live/retest-01/report.md) | 6 executed, 5 responses/one tool_use_failed HTTP 400; automatic 5 pass/1 fail; formal 0 pass/1 fail/5 needs-review; 24 attempts/28,393 known tokens | Separate later run; one unknown-usage failure; no blanket semantic pass |
| [Offline evaluator correction](evaluation/live-weakness-remediation.md) | conflict-02's genuine supplemental CSV no longer causes an allowlist false positive | Does not rewrite historical Fail or approve its reasoning |
| [Deterministic operation verification](evaluation/structured-operations-verification/report.md) | csv-05, combined-04, combined-05 grounded with real BGE/PostgreSQL; 0 Groq requests | Backend computation and citations, not LLM inference |
| [Authenticated browser acceptance](evaluation/authenticated-operations-acceptance/report.md) | csv-05, combined-04, combined-05 **PASSED** via real UI/API; source excerpts, ownership/CSRF, desktop/mobile screenshots | Codex automation; isolated fresh database; no original-user mutation or Groq requests |
| Human semantic review | Pending; all response review slots remain unfilled | No human-reviewed accuracy percentage |

The live retest still produced an incorrect grouped total for csv-05 and an incomplete combined-04 answer; combined-05 failed before CSV execution. Subsequent deterministic operations resolve those supported forms using typed data, explicit arithmetic and complete bounded rendering. The browser passes are recorded only in their own stream, never retroactively in the original benchmark.

General Groq tool-use failures may still occur. Prompt-based reasoning guardrails are not deterministic semantic verification. Source/quote membership is not entailment. The exact historical failed_generation tool structure was not retained; diagnostics now classify only safely recognizable structure without executing rejected arguments.

## Original real benchmark execution — 28 October 2026

**All 25 original cases were executed once across the separately approved runs.** There are 24 returned structured responses and one HTTP 400 provider failure without a final answer. Automatic checks: **22 pass / 3 fail**. Formal evaluator outcomes: **4 canonical-refusal-contract passes / 3 fail / 18 needs-review**. Actual human-reviewed: **0**. These counts are not a claim of 88% answer accuracy.

Usage: **95 native HTTP attempts / 97,440 known reported tokens**, with usage unknown for the failed HTTP 400. No automatic retry or model/application/user-data change occurred. Earlier eight executions and conflict-01 artifacts were preserved. Daily token quota remained unknown; permitted response headers were recorded, and no quota/access/deadline stop occurred.

Important findings: conflict-01 invented a higher-target-wins rule; ambiguous-01 assigned 15 without a known department; combined-05 did not explicitly provide the requested 120-credit excess. csv-05 failed at provider planning. conflict-02's genuine extra CSV evidence triggered the unchanged evaluator's policy-only source whitelist; that raw Fail is retained as a scoring limitation, not called fabrication. All subjective review remains pending actual human decisions.

See [actual responses, citations, latencies and findings](evaluation/final-live/batch-03/report.md), [all-original-case cumulative results](evaluation/final-live/batch-03/cumulative-results.json) and [24 unfilled response-bound human review templates](evaluation/final-live/batch-03/all-review-template.json). Earlier counts below are dated snapshots superseded by this execution status. **Execution is complete; human-reviewed quality acceptance is not.**

## Evidence types

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Mocked SDK/browser tests | Contract, UI, tool and failure handling under controlled responses | Provider availability or real AI correctness |
| Scripted answer benchmark | Numeric/citation evaluator plumbing using authored outputs | Semantic AI accuracy, factual completeness or hallucination rate |
| Real retrieval | BGE/PostgreSQL ranking against known chunk labels | Correct final answers or real generation latency |
| Real local performance | Warm serial local component timings | Production throughput, capacity, cold starts or live planning/generation performance |
| Original live Groq + separate retests | Real provider answers, usage, errors and automatic checks for explicitly approved cases | Human semantic correctness or production reliability certification |
| Deterministic backend verification | Validated operations over real retrieved/queried evidence | Broad natural-language coverage or a new Groq accuracy score |
| Authenticated browser acceptance | Real UI/session/CSRF/ownership/answers/citations in the tested isolated environment | User manual sign-off, historical score revision or full benchmark human review |

## Original 25-case framework

[Day 9 Step 1 framework](evaluation/README.md) defines six document, six CSV, six combined, four insufficient-evidence and three conflict/ambiguity cases. All use deterministic fictional data. Original case definitions/source labels remain unchanged across later steps. Fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`.

The runner supports document RAG and agent workflows, records latency/stages and safe failures, and isolates database fixtures using temporary tables, explicit IDs and rollback. Default mock runs consume no quota. Other modes must be chosen explicitly; live mode requires ALLOW_LIVE_AI_EVAL=1 and explicit cases. Do not invoke operator fixture helpers inside the application server.

## Real retrieval comparison

[Step 2 report](evaluation/retrieval-quality.md): 39 questions, two modes, three repetitions = **234 actual retrieval calls**, zero LLM calls. Nineteen original questions have document-retrieval labels; six CSV-only questions do not. A separate 20-question stress extension tests identifiers, paraphrases, overlapping content, irrelevant questions and ownership/status boundaries without changing the original benchmark. Compare modes within each cohort because their corpora differ.

| Cohort / mode | Positive questions | Recall@1 | Precision@1 | Recall@3 | Precision@3 | MRR@3 | Hit Rate@3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original semantic | 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 |
| Original hybrid | 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 |
| Stress semantic | 14 | 0.9643 | 1.0000 | 1.0000 | 0.3571 | 1.0000 | 1.0000 |
| Stress hybrid | 14 | 0.8214 | 0.8571 | 1.0000 | 0.3571 | 0.9286 | 1.0000 |

| Cohort / mode | p50 ms | p95 ms |
| --- | ---: | ---: |
| Original semantic | 54.14 | 84.29 |
| Original hybrid | 58.86 | 93.93 |
| Stress semantic | 48.72 | 72.48 |
| Stress hybrid | 61.98 | 90.91 |

Recall measures all labelled evidence recovered; Precision@K divides by K even for unfilled slots. MRR is truncated at three. Empty-gold questions are excluded from rank macro means and reviewed separately. Sparse labels limit Precision@3. Repetitions are not independent new questions.

Hybrid made two first-position mistakes on overlapping/identifier stress questions due to equal-RRF tie-breaking; relevant chunks remained at rank two. Keyword matching also admitted irrelevant “fictional” matches below cosine cutoff. Ownership/status and metadata checks passed; rankings were stable. No production ranking change was made from this small sample.

## Answer correctness and citation evaluation

[Step 3 report](evaluation/answer-quality.md): the **scripted** 25-case run passed all automatic checks, with four refusal-contract passes and 21 needs-review outcomes. Its 23 extracted numeric bindings and 12 independent CSV result checks matched. These outputs are authored from the oracle; they are not AI quality scores.

The evaluator checks source identity, corpus membership, markers, exact quotes, independent CSV results and numeric tolerances. Human review rates factual correctness, completeness, grounding, citation support and conflict handling. A genuine quote can support a false or incomplete statement, so quote presence never establishes semantic correctness. Review annotations bind to the exact fixture and response hashes.

**Full live 25-case answer accuracy and human semantic review remain incomplete.** No real answer correctness/groundedness percentage is available. Day 9 Steps 1–4 made zero live LLM calls. Groq live evaluation is opt-in, capped to small batches with existing pacing; saved-result review consumes no quota. Failure/timeout/provider errors must not be replaced with scripted answers.

## Real local performance and reliability

[Step 4 report](evaluation/performance-reliability.md): **360 real component observations**, 30 per path, two excluded warmups, zero failed measured samples. Environment: Intel i5-7200U, four logical CPUs, approximately 15 GiB RAM, Node 22.22.3, PostgreSQL 18.6/pgvector 0.8.1 and existing BGE 768-dimensional Ollama model. Seven authorized document chunks and three CSV datasets/11 rows; no approximate production scaling claim.

| Component | p50 ms | p95 ms |
| --- | ---: | ---: |
| BGE query embedding | 41.710 | 54.581 |
| Semantic retrieval including embedding | 43.108 | 56.346 |
| Hybrid retrieval including embedding | 44.446 | 57.638 |
| CSV COUNT | 1.664 | 2.343 |
| CSV SUM | 1.851 | 3.316 |
| CSV AVG | 1.810 | 2.992 |
| CSV grouped SUM | 1.802 | 4.124 |
| CSV filter/sort | 1.650 | 2.280 |
| CSV filtered COUNT | 1.721 | 3.637 |
| Scripted backend tool workflow | 45.319 | 64.418 |
| Existing citation verification on scripted output | 0.067 | 0.284 |

Min/max, raw samples and stage timings are in the source report. Service timings include instrumentation and validation overhead. Temporary transactions use savepoints and omit real COMMIT/index costs. Some citation samples are nested in workflow samples; stages overlap and must not be added.

Thirty-four simulated operational fault scenarios passed. A separate real SQL timeout/recovery probe passed. Three stub provider calls using actual timers started roughly five seconds apart at 12 RPM (two observed intervals: 5000.975 and 4999.855 ms; clock granularity explains the fractional difference). These are not real provider response timings. Planning and generation latency were not measured in this benchmark.

One confirmed defect was fixed: optional embedding callers now get the existing 15-second deadline rather than no application signal. No model, dimensions or retrieval strategy changed. Remaining risks include process-local quota state, cooperative SQL cancellation, small warm fixtures, missing production workload measurements and untested provider outages outside mocks.

## Historical live and browser evidence

[Day 8 final verification](day-8-final-verification.md) recorded 62 mocked browser scenarios/checks, 12 actual HTTPS full-stack acceptance scenarios and a later ten-scenario no-LLM smoke rerun. Only **two questions** invoked live Groq (seven provider HTTP attempts total): one document RAG and one combined policy/CSV answer. No live Gemini call or CSV-only live LLM question was run there.

Recorded backend request times were 1,380.3 ms for that RAG question and 25,754.1 ms for that agent question. These single observations are historical acceptance evidence, not p50/p95 distributions and not directly comparable with local scripted tool timings. The report preserves actual answers/citations and account-isolation checks. Later Day 9 scripted results do not supersede or expand those two live observations.

## Execution and interpretation

```bash
# Offline: mock framework/answers; simulated reliability faults
npm run evaluate
npm run evaluate:answers
npm run evaluate:performance

# Real retrieval / local components, no LLM
node --env-file=.env.local --conditions=react-server --import tsx \
  evaluation/retrieval-quality.ts --repetitions 3
node --env-file=.env.local --conditions=react-server --import tsx \
  evaluation/performance-reliability.ts --mode local --samples 30
```

Use the [answer report's live opt-in commands](evaluation/answer-quality.md#optional-live-groq-evaluation) only after explicit authorization and quota review. Record selected cases, provider/model, raw safe results and human judgments. Do not compute a live success rate from unexecuted cases. More representative data, independent labels, human review and controlled-staging HTTP/provider traces are needed before making quality or capacity claims.

## Later approved live pilot — 28 October 2026

[Real Groq pilot](evaluation/final-live/report.md) executed only doc-01, csv-01 and combined-01 from the unchanged 25-case benchmark. All three passed automatic checks; final classifications remain **0 pass, 0 fail, 3 needs-review**, with zero actual human reviews. Usage: **13 HTTP attempts and 13,225 reported tokens**, no automatic retries/provider failures. Native request counts, actual answers/citations, numeric/oracle checks and timings are in [results.json](evaluation/final-live/results.json).

This supplied real CSV-only COUNT evidence at the pilot cutoff. Later batches completed the original 25 executions; human semantic review remains pending. Earlier Step 3 mock outcomes and Day 8 live results above remain separate dated runs. Further live execution needs new explicit approval.


## Live batch 02 follow-up

[Batch 02](evaluation/final-live/batch-02/report.md) adds five unchanged original cases: doc-02, csv-02, combined-02, missing-01 and conflict-01. Actual batch usage: 16 HTTP attempts/16,319 reported tokens. At the batch-02 cutoff, cumulative original cases executed were **8/25**, with 17 then remaining; usage **29 attempts/29,544 tokens**. Formal outcomes: 1 canonical-refusal-contract pass, 0 fail, 7 needs-review; human-reviewed zero.

The conflict answer selected 22 using a precedence rule not present in the two policies. Provenance checks passed, but this does not establish semantic correctness. The AI-assisted concern and actual answer are retained for human judgment. No pilot case was rerun, no automatic retry was made and no full-benchmark completion is claimed.

## Submission update — 30 October 2026

[Final submission review](submission-final/report.md) records the latest local quota traces and validation. The owner reports subsequent live Tests 16–19 passed, with a retry for 18; Test 20 remains blocked by 429. These are user-reported acceptance outcomes, separate from original 25-case results, later Groq retests, deterministic tests and authenticated browser evidence. Human semantic review remains pending. No benchmark or live provider call was repeated in this finalization.
