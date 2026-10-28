# Evaluation evidence and current quality limits

This summary distinguishes evidence types. Source reports and their machine-readable artifacts remain the primary records. No new live AI, retrieval or performance run was made for the documentation pass.

## Evidence types

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Mocked SDK/browser tests | Contract, UI, tool and failure handling under controlled responses | Provider availability or real AI correctness |
| Scripted answer benchmark | Numeric/citation evaluator plumbing using authored outputs | Semantic AI accuracy, factual completeness or hallucination rate |
| Real retrieval | BGE/PostgreSQL ranking against known chunk labels | Correct final answers or real generation latency |
| Real local performance | Warm serial local component timings | Production throughput, capacity, cold starts or live planning/generation performance |
| Limited live provider acceptance | Two recorded Day 8 Groq workflows completed with evidence | Full live 25-case answer quality, CSV-only live LLM quality or human-review coverage |

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
