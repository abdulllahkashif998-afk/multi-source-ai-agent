# Real Groq benchmark — remaining original cases

28 October 2026. **Actual provider/backend execution, not mock or scripted answers. Human review is separate and incomplete.**

Original fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. Existing model: `openai/gpt-oss-20b`. Exactly seventeen unexecuted original cases were authorized; no completed case was rerun.

## Actual execution and evaluation summary

| Measure | This run | All saved runs |
| --- | ---: | ---: |
| Original cases executed | 17 | 25 |
| Automatic checks passed | 14 | 22 |
| Automatic checks failed | 3 | 3 |
| Formal evaluator pass | 3 | 4 |
| Formal evaluator fail | 3 | 3 |
| Needs review | 11 | 18 |
| Actual human reviews | 0 | 0 |
| Native Groq HTTP attempts | 66 | 95 |
| Reported token usage | 67896 | 97440 |
| Attempts without usage data | 1 | 1 |

Returned structured responses across saved runs: **24**; execution failures with no final answer: **1**.

Remaining unexecuted original cases: **0**. Stop reason: **none**. This-run reported prompt/completion usage: 63631 / 4265.

All 25 original cases were actually executed across the three separately approved runs. This includes failed executions: one or more questions may have no returned answer. It completes execution coverage, not human-reviewed semantic accuracy.

Counts use native-fetch ledgers, not SDK calls. Token usage is the provider-reported total where available, not exact billable/quota counter consumption. Unknown usage is not zero. Formal passes can mean only the existing canonical-refusal contract; valid citations/numbers do not prove reasoning. No human reviewer/rating was invented.

## Quota/environment and bounded behavior

Read-only preflight verified PostgreSQL/pgvector, fixture table/TEMP privileges and a real 768-dimensional local BGE response. The owner stated quota was unknown and allowed headers on the first approved case; no extra quota probe occurred. Safe numeric quota observations are saved in [quota-observations.json](quota-observations.json). Headers expose minute tokens and daily requests, not remaining daily tokens; no daily-token availability was invented. Groq documents that cached tokens can be excluded from rate limits, so aggregate reported usage is not assumed to equal minute-quota consumption.

Existing 12-RPM pacing and application deadlines were preserved; cases ran sequentially with at least 65 seconds between them. The evaluation-only guard caps calls/estimated token planning, disables transport 429 retry, and stops on denial or exhausted reported quota. The supervisor also stops on case/harness deadlines or setup failure; failed cases are not retried. Every completed case and native attempt has a private checkpoint, with separate public artifacts here.

All evidence is the original fictional corpus, loaded in temporary PostgreSQL tables using explicit fixture identities, existing owner filters, savepoints and rollback. No existing account/row/sequence/stored file or application/model/credential setting was changed. This is a backend operator-fixture evaluation, not an authenticated browser replay. Prior results, conflict-01 notes and application source matched their preservation fingerprints.

## Preserved reasoning concern

The earlier conflict-01 answer asserted that the higher target wins, although the fixtures provide no precedence rule. That AI-assisted finding remains preserved in the cumulative record. Genuine source IDs/quotes did not validate that claim. Human review is required; the automatic-pass count must not be advertised as overall answer accuracy.

## Failures, reasoning findings and scoring limits

**Do not interpret 22 automatic passes as 22 correct answers.** Formal human-reviewed accuracy remains unmeasured. The observed findings are kept separate from evaluator labels:

| Case | Observed result / evidence | Attribution and disposition |
| --- | --- | --- |
| conflict-01 (preserved prior run) | Selected 22 using an unsupported higher-target-wins rule | AI-assisted semantic finding; original needs-review status and artifacts preserved |
| csv-05 | Two successful planning requests, then HTTP 400 during planning after schema inspection; no final answer | Confirmed execution failure, not a refusal or a calculated answer. Original Fail retained; exact remote rejection reason unavailable, no retry |
| combined-05 | Named Jon (620) and threshold 500, but did not explicitly answer the requested excess of 120 | AI-assisted completeness concern, not a wrong arithmetic claim. Formal needs-review; human not reviewed |
| conflict-02 | Compared teams under both policy values and cited real CSV rows; automatic reason irrelevant_or_unknown_source | Existing evaluator's conflict source whitelist derives only the two document labels and rejects additional C1. Independent CSV rows match and quote validity is 1. Raw Fail retained; not evidence of fabrication. Human must assess conditional answer versus expected clarification |
| ambiguous-01 | Assigned the user 15 without knowing their department; expected clarification between North 18/South 25 | Automatic Fail for wrong/missing expected source, plus AI-assisted unsupported-applicability finding. Genuine general-policy quote does not justify personalized assignment |

The ambiguity diagnostic retrieved chunk 108 first in both comparison modes. This establishes fixture evidence availability, not the exact query/evidence used by the model planner. Do not attribute the final wrong-source answer to a proven vector-ranking defect without further trace evidence. No prompt/model/evaluator/application change or unapproved retest was made to improve these outcomes.

Human annotations are still absent. A person must review all response-bound rubric dimensions before subjective semantic acceptance is counted. The existing no-overriding-deterministic-fail rule remains intact; a separately versioned future evaluation-label review must not rewrite this baseline.

## Actual answers, citations, checks and latency

### doc-03 — document

Original question: How long after delivery can unopened equipment be sent back?
Expected: Unopened equipment may be returned within 30 days of delivery.
Required source labels: ["doc:3:103"]; relevant chunks: ["103"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 1171.8 ms; answer latency: 981.4934190000001 ms. Native attempts: 1; reported tokens: 862.
Safe execution error: null.

**Actual returned answer:**

Unopened equipment may be returned within 30 days of delivery. [S1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| S1 | returns-policy.pdf; document 3, chunk 103; page 1 | Unopened equipment may be returned within 30 days of delivery. |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "return window", "expected": 30, "tolerance": 1e-06, "observed": [30], "correct": true}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["103", "105", "104"], "durationMs": 54.1752869999998, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["103", "105"], "durationMs": 62.51209700000004, "k": 3, "hits": 1, "relevant": 1, "returned": 2, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 49.6 |
| postgres | ok |  | 3.6 |
| retrieval | ok |  | 53.9 |
| embedding | ok |  | 56.1 |
| postgres | ok |  | 5.7 |
| retrieval | ok |  | 62.4 |
| embedding | ok |  | 50.3 |
| postgres | ok |  | 3.6 |
| retrieval | ok |  | 54.4 |
| retrieval | ok |  | 54.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 886 |
| citation-verification | ok |  | 1.9 |
| final-generation | ok |  | 915 |
| citation-verification | ok |  | 2.3 |
| request | ok |  | 980.7 |
| answer-end-to-end | ok |  | 981.4934190000001 |

### doc-04 — document

Original question: At what travel expense amount is manager sign-off required?
Expected: Travel expenses above 500 credits require manager approval.
Required source labels: ["doc:4:104"]; relevant chunks: ["104"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 958.0 ms; answer latency: 579.3517889999998 ms. Native attempts: 1; reported tokens: 944.
Safe execution error: null.

**Actual returned answer:**

Manager sign‑off is required for travel expenses above 500 credits. [S1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| S1 | travel-policy.docx; document 4, chunk 104; page not supplied | Travel expenses above 500 credits require manager approval. |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "approval threshold", "expected": 500, "tolerance": 1e-06, "observed": [500], "correct": true}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["104", "105", "101"], "durationMs": 92.7683049999996, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["104", "105", "101"], "durationMs": 81.41529300000002, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 86.4 |
| postgres | ok |  | 4.9 |
| retrieval | ok |  | 92.3 |
| embedding | ok |  | 74.5 |
| postgres | ok |  | 6.1 |
| retrieval | ok |  | 81.4 |
| embedding | ok |  | 60.4 |
| postgres | ok |  | 3.6 |
| retrieval | ok |  | 64.7 |
| retrieval | ok |  | 64.8 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 469.1 |
| citation-verification | ok |  | 2.1 |
| final-generation | ok |  | 502.8 |
| citation-verification | ok |  | 2.4 |
| request | ok |  | 578.6 |
| answer-end-to-end | ok |  | 579.3517889999998 |

### doc-05 — document

Original question: What is the acknowledgment deadline for a service incident?
Expected: A service incident must be acknowledged within 2 hours.
Required source labels: ["doc:5:105"]; relevant chunks: ["105"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 1126.8 ms; answer latency: 922.027286 ms. Native attempts: 1; reported tokens: 930.
Safe execution error: null.

**Actual returned answer:**

The acknowledgment deadline for a service incident is 2 hours. [S1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| S1 | incident-policy.docx; document 5, chunk 105; page not supplied | A service incident must be acknowledged within 2 hours. |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "acknowledgment deadline", "expected": 2, "tolerance": 1e-06, "observed": [2], "correct": true}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["105", "103", "104"], "durationMs": 62.24220299999979, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["105", "103", "104"], "durationMs": 61.462158000000045, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 58.3 |
| postgres | ok |  | 3 |
| retrieval | ok |  | 61.9 |
| embedding | ok |  | 55.6 |
| postgres | ok |  | 5 |
| retrieval | ok |  | 61.4 |
| embedding | ok |  | 61 |
| postgres | ok |  | 3.4 |
| retrieval | ok |  | 65 |
| retrieval | ok |  | 65.2 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 798 |
| citation-verification | ok |  | 3.8 |
| final-generation | ok |  | 841.2 |
| citation-verification | ok |  | 4.6 |
| request | ok |  | 921.2 |
| answer-end-to-end | ok |  | 922.027286 |

### doc-06 — document

Original question: Tell me the recorded approval status of ZX-2048.
Expected: Invoice ZX-2048 is approved for the Harbor project.
Required source labels: ["doc:6:106"]; relevant chunks: ["106"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 1337.2 ms; answer latency: 1133.752559 ms. Native attempts: 1; reported tokens: 942.
Safe execution error: null.

**Actual returned answer:**

The recorded approval status of ZX-2048 is that it is approved. [S1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| S1 | invoice-register.pdf; document 6, chunk 106; page 3 | Invoice ZX-2048 is approved for the fictional Harbor project. |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["106", "105", "104"], "durationMs": 65.11448299999984, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["106", "104", "105"], "durationMs": 64.04871999999978, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 60.8 |
| postgres | ok |  | 3.3 |
| retrieval | ok |  | 64.8 |
| embedding | ok |  | 56.9 |
| postgres | ok |  | 6.4 |
| retrieval | ok |  | 64 |
| embedding | ok |  | 69.7 |
| postgres | ok |  | 5 |
| retrieval | ok |  | 75.5 |
| retrieval | ok |  | 75.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 994.9 |
| citation-verification | ok |  | 4.2 |
| final-generation | ok |  | 1041.8 |
| citation-verification | ok |  | 4.5 |
| request | ok |  | 1132.9 |
| answer-end-to-end | ok |  | 1133.752559 |

### csv-03 — csv

Original question: What is the average amount per sales record?
Expected: The average sales amount is 10.2 units.
Required source labels: ["csv:201"]; relevant chunks: [].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 20783.1 ms; answer latency: 20628.725631 ms. Native attempts: 5; reported tokens: 4310.
Safe execution error: null.

**Actual returned answer:**

The average amount per sales record is 10.2. [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| C1 | sales.csv; dataset 201 | [{"value":10.2}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": [], "aggregate": {"op": "avg", "column": "amount"}, "limit": 100}`
Actual CSV evidence rows: `[{"value": 10.2}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 10.2}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "mean", "expected": 10.2, "tolerance": 1e-06, "observed": [10.2], "correct": true}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 834.2 |
| planning-groq | ok |  | 1018 |
| postgres | ok |  | 1 |
| postgres | ok |  | 0.6 |
| postgres | ok |  | 2.4 |
| postgres | ok |  | 0.7 |
| tool | ok | discoverDatasets | 9.7 |
| groq-pacing | ok |  | 3925.7 |
| groq-http | ok |  | 631.3 |
| planning-groq | ok |  | 4562.5 |
| tool | ok | inspectDataset | 2.8 |
| groq-pacing | ok |  | 4349.4 |
| groq-http | ok |  | 1877.9 |
| planning-groq | ok |  | 6232.6 |
| postgres | ok |  | 0.9 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.5 |
| postgres | ok |  | 3.4 |
| postgres | ok |  | 0.8 |
| csv-query | ok |  | 9.4 |
| tool | ok | queryDataset | 60.7 |
| groq-pacing | ok |  | 3050.4 |
| groq-http | ok |  | 264.9 |
| planning-groq | ok |  | 3319.2 |
| planning-wall | ok |  | 15296.2 |
| groq-pacing | ok |  | 4719.6 |
| groq-http | ok |  | 571.1 |
| final-generation | ok |  | 5312.6 |
| citation-verification | ok |  | 12.5 |
| agent | grounded |  | 20623.9 |
| request | ok |  | 20627.5 |
| answer-end-to-end | ok |  | 20628.725631 |

### csv-04 — csv

Original question: Show total sales for Alpha, Beta and Gamma, grouped by team.
Expected: Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units.
Required source labels: ["csv:201"]; relevant chunks: [].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 20687.8 ms; answer latency: 20609.865662 ms. Native attempts: 5; reported tokens: 4546.
Safe execution error: null.

**Actual returned answer:**

The total sales grouped by team are: Alpha – 30, Beta – 6, Gamma – 15. [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| C1 | sales.csv; dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "sort": {"column": "team", "direction": "asc"}, "limit": 100}`
Actual CSV evidence rows: `[{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Alpha", "expected": 30, "tolerance": 1e-06, "observed": [30], "correct": true}, {"label": "Beta", "expected": 6, "tolerance": 1e-06, "observed": [6], "correct": true}, {"label": "Gamma", "expected": 15, "tolerance": 1e-06, "observed": [15], "correct": true}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 628.9 |
| planning-groq | ok |  | 755.3 |
| postgres | ok |  | 11.4 |
| postgres | ok |  | 0.3 |
| postgres | ok |  | 1.3 |
| postgres | ok |  | 0.3 |
| tool | ok | discoverDatasets | 15.2 |
| groq-pacing | ok |  | 4228.5 |
| groq-http | ok |  | 628.7 |
| planning-groq | ok |  | 4861.2 |
| tool | ok | inspectDataset | 1.9 |
| groq-pacing | ok |  | 4355.1 |
| groq-http | ok |  | 543.9 |
| planning-groq | ok |  | 4904.8 |
| postgres | ok |  | 0.9 |
| postgres | ok |  | 0.7 |
| postgres | ok |  | 1.4 |
| postgres | ok |  | 4 |
| postgres | ok |  | 0.8 |
| csv-query | ok |  | 9.8 |
| tool | ok | queryDataset | 62.7 |
| groq-pacing | ok |  | 4380.6 |
| groq-http | ok |  | 663.4 |
| planning-groq | ok |  | 5047.9 |
| planning-wall | ok |  | 15694.5 |
| groq-pacing | ok |  | 4321.9 |
| groq-http | ok |  | 571.2 |
| final-generation | ok |  | 4906.9 |
| citation-verification | ok |  | 3.4 |
| agent | grounded |  | 20606.9 |
| request | ok |  | 20608.9 |
| answer-end-to-end | ok |  | 20609.865662 |

### csv-05 — csv

Original question: List the East-region sales amounts, largest first.
Expected: East amounts in descending order are 20 and 10 units.
Required source labels: ["csv:201"]; relevant chunks: [].

Automatic: **fail**; formal evaluator: **fail**; human: **not-reviewed**.
Reasons: []. Review uncertainties: [].
Observed case latency: 10689.3 ms; answer latency: 10609.406578 ms. Native attempts: 3; reported tokens: 1620.
Safe execution error: {"category": "other", "errorType": "AI_APICallError", "httpStatus": 400}.

Independent CSV checks: [].
Numeric/citation/refusal checks: `null`
Diagnostic retrieval (not proof of planner tool selection): [].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1022.3 |
| planning-groq | ok |  | 1193 |
| postgres | ok |  | 14 |
| postgres | ok |  | 0.5 |
| postgres | ok |  | 2 |
| postgres | ok |  | 0.5 |
| tool | ok | discoverDatasets | 19.9 |
| groq-pacing | ok |  | 3783.3 |
| groq-http | ok |  | 966.3 |
| planning-groq | ok |  | 4753.3 |
| tool | ok | inspectDataset | 1.8 |
| groq-pacing | ok |  | 4014 |
| groq-http | error |  | 567.9 |
| planning-wall | error |  | 10602.9 |
| agent | failed |  | 10606.4 |
| planning | error |  | 0 |
| request | error |  | 10608.1 |
| answer-end-to-end | error |  | 10609.406578 |

### csv-06 — csv

Original question: How many employees have expenses strictly above 500 credits?
Expected: The employee expense count above 500 credits is 1.
Required source labels: ["csv:202"]; relevant chunks: [].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 20956.2 ms; answer latency: 20821.209013 ms. Native attempts: 5; reported tokens: 4423.
Safe execution error: null.

**Actual returned answer:**

There is one employee with expenses strictly above 500 credits. [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| C1 | expenses.csv; dataset 202 | [{"value":1}] |

Actual CSV plan: `{"datasetId": "202", "filters": [{"column": "cost", "op": "gt", "value": 500}], "groupBy": [], "aggregate": {"op": "count"}, "limit": 100}`
Actual CSV evidence rows: `[{"value": 1}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 1}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "expense count", "expected": 1, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 0.9 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 708.5 |
| planning-groq | ok |  | 863.2 |
| postgres | ok |  | 0.6 |
| postgres | ok |  | 0.4 |
| postgres | ok |  | 1.7 |
| postgres | ok |  | 0.4 |
| tool | ok | discoverDatasets | 17.7 |
| groq-pacing | ok |  | 4117.2 |
| groq-http | ok |  | 2147.1 |
| planning-groq | ok |  | 6268.1 |
| tool | ok | inspectDataset | 2 |
| groq-pacing | ok |  | 2838 |
| groq-http | ok |  | 1850.6 |
| planning-groq | ok |  | 4692.2 |
| postgres | ok |  | 0.5 |
| postgres | ok |  | 0.4 |
| postgres | ok |  | 0.7 |
| postgres | ok |  | 1.3 |
| postgres | ok |  | 0.3 |
| csv-query | ok |  | 4.1 |
| tool | ok | queryDataset | 28.9 |
| groq-pacing | ok |  | 3115.5 |
| groq-http | ok |  | 543.1 |
| planning-groq | ok |  | 3662.6 |
| planning-wall | ok |  | 15577.9 |
| groq-pacing | ok |  | 4441.1 |
| groq-http | ok |  | 764.3 |
| final-generation | ok |  | 5223.5 |
| citation-verification | ok |  | 12 |
| agent | grounded |  | 20816.1 |
| request | ok |  | 20819.9 |
| answer-end-to-end | ok |  | 20821.209013 |

### combined-03 — combined

Original question: Does Gamma meet the minimum monthly team total exactly?
Expected: Gamma total is 15 units, exactly the target; Gamma difference is 0 units.
Required source labels: ["doc:1:101", "csv:201"]; relevant chunks: ["101"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 25893.4 ms; answer latency: 25692.228989000003 ms. Native attempts: 6; reported tokens: 6938.
Safe execution error: null.

**Actual returned answer:**

Gamma’s total sales for the month equal the minimum required by policy. [C1] [D1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | team-policy.docx; document 1, chunk 101; page not supplied | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset 201 | [{"value":15}] |

Actual CSV plan: `{"datasetId": "201", "filters": [{"column": "team", "op": "eq", "value": "Gamma"}], "groupBy": [], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV evidence rows: `[{"value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 15}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Gamma total", "expected": 15, "tolerance": 1e-06, "observed": [], "correct": null}, {"label": "difference", "expected": 0, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["101", "104", "102"], "durationMs": 56.76724100000001, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["101", "104"], "durationMs": 51.032400999999936, "k": 3, "hits": 1, "relevant": 1, "returned": 2, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 52.2 |
| postgres | ok |  | 3.4 |
| retrieval | ok |  | 56.4 |
| embedding | ok |  | 44.5 |
| postgres | ok |  | 5.8 |
| retrieval | ok |  | 51 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 807.2 |
| planning-groq | ok |  | 914.2 |
| embedding | ok |  | 38.1 |
| postgres | ok |  | 3.3 |
| retrieval | ok |  | 42.1 |
| tool | ok | searchDocuments | 44.1 |
| groq-pacing | ok |  | 4038.9 |
| groq-http | ok |  | 660.8 |
| planning-groq | ok |  | 4704.5 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 1.3 |
| postgres | ok |  | 2.5 |
| postgres | ok |  | 1 |
| tool | ok | discoverDatasets | 9.3 |
| groq-pacing | ok |  | 4313.8 |
| groq-http | ok |  | 588.2 |
| planning-groq | ok |  | 4907.4 |
| tool | ok | inspectDataset | 2.5 |
| groq-pacing | ok |  | 4394.5 |
| groq-http | ok |  | 355.5 |
| planning-groq | ok |  | 4754.6 |
| postgres | ok |  | 1.3 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.8 |
| postgres | ok |  | 2.5 |
| postgres | ok |  | 0.9 |
| csv-query | ok |  | 9.3 |
| tool | ok | queryDataset | 68.6 |
| groq-pacing | ok |  | 4562.9 |
| groq-http | ok |  | 817.8 |
| planning-groq | ok |  | 5386.2 |
| planning-wall | ok |  | 20848.1 |
| groq-pacing | ok |  | 4168 |
| groq-http | ok |  | 641.9 |
| final-generation | ok |  | 4823.4 |
| citation-verification | ok |  | 14.4 |
| agent | grounded |  | 25687.8 |
| request | ok |  | 25691.4 |
| answer-end-to-end | ok |  | 25692.228989000003 |

### combined-04 — combined

Original question: According to the policy, which teams fall short when all sales rows are added per team?
Expected: Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target.
Required source labels: ["doc:1:101", "csv:201"]; relevant chunks: ["101"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 27312.4 ms; answer latency: 27100.161881 ms. Native attempts: 6; reported tokens: 7076.
Safe execution error: null.

**Actual returned answer:**

Team Beta falls short of the monthly total sales target of 15 units. [D1] [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | team-policy.docx; document 1, chunk 101; page not supplied | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV evidence rows: `[{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Beta shortfall", "expected": 9, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["101", "104", "105"], "durationMs": 75.08435199999985, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["101", "102", "104"], "durationMs": 67.48122199999989, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 70.8 |
| postgres | ok |  | 3.4 |
| retrieval | ok |  | 74.8 |
| embedding | ok |  | 59 |
| postgres | ok |  | 7.6 |
| retrieval | ok |  | 67.4 |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 664 |
| planning-groq | ok |  | 895 |
| embedding | ok |  | 51.9 |
| postgres | ok |  | 5.7 |
| retrieval | ok |  | 58.1 |
| tool | ok | searchDocuments | 61.4 |
| groq-pacing | ok |  | 4037.1 |
| groq-http | ok |  | 567.8 |
| planning-groq | ok |  | 4608.4 |
| postgres | ok |  | 1.2 |
| postgres | ok |  | 1.2 |
| postgres | ok |  | 2.7 |
| postgres | ok |  | 1.2 |
| tool | ok | discoverDatasets | 11 |
| groq-pacing | ok |  | 4402.8 |
| groq-http | ok |  | 1631.4 |
| planning-groq | ok |  | 6040.7 |
| tool | ok | inspectDataset | 2.3 |
| groq-pacing | ok |  | 3345.9 |
| groq-http | ok |  | 600.7 |
| planning-groq | ok |  | 3952.5 |
| postgres | ok |  | 1 |
| postgres | ok |  | 0.7 |
| postgres | ok |  | 1.8 |
| postgres | ok |  | 4.8 |
| postgres | ok |  | 1.3 |
| csv-query | ok |  | 11.4 |
| tool | ok | queryDataset | 69 |
| groq-pacing | ok |  | 4315.9 |
| groq-http | ok |  | 833.8 |
| planning-groq | ok |  | 5155.6 |
| planning-wall | ok |  | 20865.1 |
| groq-pacing | ok |  | 4149.6 |
| groq-http | ok |  | 2062.7 |
| final-generation | ok |  | 6224.4 |
| citation-verification | ok |  | 5.8 |
| agent | grounded |  | 27097 |
| request | ok |  | 27099.3 |
| answer-end-to-end | ok |  | 27100.161881 |

### combined-05 — combined

Original question: Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?
Expected: Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval.
Required source labels: ["doc:4:104", "csv:202"]; relevant chunks: ["104"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 25958.6 ms; answer latency: 25708.988138 ms. Native attempts: 6; reported tokens: 7297.
Safe execution error: null.

**Actual returned answer:**

Jon’s travel expense of 620 credits exceeds the 500‑credit limit and therefore requires manager approval by the travel policy. [D1] [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | travel-policy.docx; document 4, chunk 104; page not supplied | Travel expenses above 500 credits require manager approval. |
| C1 | expenses.csv; dataset 202 | [{"value":620,"employee":"Jon"}] |

Actual CSV plan: `{"datasetId": "202", "filters": [{"column": "cost", "op": "gt", "value": 500}], "groupBy": ["employee"], "aggregate": {"op": "sum", "column": "cost"}, "limit": 100}`
Actual CSV evidence rows: `[{"value": 620, "employee": "Jon"}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"employee": "Jon", "value": 620}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Jon cost", "expected": 620, "tolerance": 1e-06, "observed": [], "correct": null}, {"label": "excess", "expected": 120, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["104", "105", "101"], "durationMs": 84.43059399999993, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["104", "106", "105"], "durationMs": 83.05297300000007, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 80.7 |
| postgres | ok |  | 2.7 |
| retrieval | ok |  | 84.1 |
| embedding | ok |  | 76.2 |
| postgres | ok |  | 6.1 |
| retrieval | ok |  | 83 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 679.2 |
| planning-groq | ok |  | 895.1 |
| embedding | ok |  | 75.9 |
| postgres | ok |  | 8.4 |
| retrieval | ok |  | 85.7 |
| tool | ok | searchDocuments | 90.5 |
| groq-pacing | ok |  | 4000.1 |
| groq-http | ok |  | 584.6 |
| planning-groq | ok |  | 4592.3 |
| postgres | ok |  | 1.6 |
| postgres | ok |  | 1 |
| postgres | ok |  | 2.6 |
| postgres | ok |  | 2 |
| tool | ok | discoverDatasets | 12.9 |
| groq-pacing | ok |  | 4384.4 |
| groq-http | ok |  | 600.7 |
| planning-groq | ok |  | 4991.1 |
| tool | ok | inspectDataset | 2.7 |
| groq-pacing | ok |  | 4384.6 |
| groq-http | ok |  | 1433.9 |
| planning-groq | ok |  | 5823.5 |
| postgres | ok |  | 1 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.6 |
| postgres | ok |  | 3.8 |
| postgres | ok |  | 0.9 |
| csv-query | ok |  | 10.2 |
| tool | ok | queryDataset | 60.4 |
| groq-pacing | ok |  | 3497.6 |
| groq-http | ok |  | 834.3 |
| planning-groq | ok |  | 4337.1 |
| planning-wall | ok |  | 20868.7 |
| groq-pacing | ok |  | 4147 |
| groq-http | ok |  | 652.8 |
| final-generation | ok |  | 4825.4 |
| citation-verification | ok |  | 9.8 |
| agent | grounded |  | 25705.5 |
| request | ok |  | 25708.2 |
| answer-end-to-end | ok |  | 25708.988138 |

### combined-06 — combined

Original question: Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline?
Expected: INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline.
Required source labels: ["doc:5:105", "csv:203"]; relevant chunks: ["105"].

Automatic: **pass**; formal evaluator: **needs-review**; human: **not-reviewed**.
Reasons: []. Review uncertainties: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Observed case latency: 35915.1 ms; answer latency: 35666.580219 ms. Native attempts: 8; reported tokens: 10153.
Safe execution error: null.

**Actual returned answer:**

Ticket INC-B missed the acknowledgment deadline, as it exceeded the 2‑hour limit. [D1] [C2]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | incident-policy.docx; document 5, chunk 105; page not supplied | A service incident must be acknowledged within 2 hours. |
| C2 | incidents.csv; dataset 203 | [{"value":1,"ticket":"INC-B"}] |

Actual CSV plan: `{"datasetId": "203", "filters": [{"column": "hours", "op": "gt", "value": 2}], "groupBy": ["ticket"], "aggregate": {"op": "count"}, "limit": 100}`
Actual CSV evidence rows: `[{"value": 1, "ticket": "INC-B"}]`

Independent CSV checks: [{"sourceId": "C2", "matches": true, "expectedRows": [{"ticket": "INC-B", "value": 1}]}].
Numeric/citation/refusal checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "late hours", "expected": 3, "tolerance": 1e-06, "observed": [], "correct": null}, {"label": "delay", "expected": 1, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["105", "104", "103"], "durationMs": 77.96447899999998, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["105", "101", "104"], "durationMs": 78.83342300000004, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 73.4 |
| postgres | ok |  | 3.3 |
| retrieval | ok |  | 77.6 |
| embedding | ok |  | 71.7 |
| postgres | ok |  | 6.4 |
| retrieval | ok |  | 78.8 |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1424.3 |
| planning-groq | ok |  | 1575.9 |
| embedding | ok |  | 39.5 |
| postgres | ok |  | 3.4 |
| retrieval | ok |  | 43.6 |
| tool | ok | searchDocuments | 45.6 |
| groq-pacing | ok |  | 3378 |
| groq-http | ok |  | 789.3 |
| planning-groq | ok |  | 4170.7 |
| postgres | ok |  | 1.5 |
| postgres | ok |  | 0.9 |
| postgres | ok |  | 2 |
| postgres | ok |  | 1.1 |
| tool | ok | discoverDatasets | 10 |
| groq-pacing | ok |  | 4179.8 |
| groq-http | ok |  | 623.3 |
| planning-groq | ok |  | 4810.2 |
| tool | ok | inspectDataset | 2.6 |
| groq-pacing | ok |  | 4359.6 |
| groq-http | ok |  | 743.3 |
| planning-groq | ok |  | 5107.6 |
| tool-validation | error | queryDataset | 0 |
| tool-execution | error | queryDataset | 0 |
| tool | error | queryDataset | 4 |
| groq-pacing | ok |  | 4241.6 |
| groq-http | ok |  | 2198.6 |
| planning-groq | ok |  | 6445.1 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.4 |
| postgres | ok |  | 2.3 |
| postgres | ok |  | 1 |
| csv-query | ok |  | 8.5 |
| tool | ok | queryDataset | 49.5 |
| groq-pacing | ok |  | 2745.2 |
| groq-http | ok |  | 951.7 |
| planning-groq | ok |  | 3701.1 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.9 |
| postgres | ok |  | 2 |
| postgres | ok |  | 0.6 |
| csv-query | ok |  | 7.3 |
| tool | ok | queryDataset | 9 |
| groq-pacing | ok |  | 4031 |
| groq-http | ok |  | 1125 |
| planning-groq | ok |  | 5159.7 |
| planning-wall | ok |  | 31165.8 |
| groq-pacing | ok |  | 3862.1 |
| groq-http | ok |  | 609.6 |
| final-generation | ok |  | 4485 |
| citation-verification | ok |  | 9.5 |
| tool | recovered | queryDataset | 0 |
| agent | grounded |  | 35662.4 |
| request | ok |  | 35665.6 |
| answer-end-to-end | ok |  | 35666.580219 |

### missing-02 — insufficient

Original question: What were team sales last year? The provided sales data has no year column.
Expected: Abstain: the fixtures do not contain the requested facts.
Required source labels: []; relevant chunks: [].

Automatic: **pass**; formal evaluator: **pass**; human: **not-reviewed**.
Reasons: []. Review uncertainties: [].
Observed case latency: 15969.7 ms; answer latency: 15755.507646000002 ms. Native attempts: 4; reported tokens: 3192.
Safe execution error: null.

**Actual returned answer:**

I don't have enough evidence from the available documents and datasets to answer that question.

grounded=False. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "pass", "automatedStatus": "pass", "failures": [], "review": [], "citationPrecision": null, "sourceRecall": null, "quoteValidity": null, "numeric": [], "refusalCorrect": true}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["101", "103", "104"], "durationMs": 66.02804900000001, "k": 3, "hits": 0, "relevant": 0, "returned": 3, "recall": null, "precision": null}, {"mode": "hybrid", "ranked": ["101", "102"], "durationMs": 78.48809200000005, "k": 3, "hits": 0, "relevant": 0, "returned": 2, "recall": null, "precision": null}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 60.7 |
| postgres | ok |  | 4.4 |
| retrieval | ok |  | 65.8 |
| embedding | ok |  | 71.3 |
| postgres | ok |  | 6.4 |
| retrieval | ok |  | 78.4 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1041.8 |
| planning-groq | ok |  | 1280.4 |
| postgres | ok |  | 0.5 |
| postgres | ok |  | 0.5 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 0.5 |
| tool | ok | discoverDatasets | 5.8 |
| groq-pacing | ok |  | 3706.9 |
| groq-http | ok |  | 672.3 |
| planning-groq | ok |  | 4383.1 |
| tool | ok | inspectDataset | 3.9 |
| groq-pacing | ok |  | 4301.9 |
| groq-http | ok |  | 783.6 |
| planning-groq | ok |  | 5093.1 |
| planning-wall | ok |  | 10819 |
| groq-pacing | ok |  | 4196.3 |
| groq-http | ok |  | 716.5 |
| final-generation | ok |  | 4926.1 |
| citation-verification | ok |  | 3.5 |
| agent | abstained |  | 15751 |
| request | ok |  | 15754.6 |
| answer-end-to-end | ok |  | 15755.507646000002 |

### missing-03 — insufficient

Original question: What is the average customer age in sales.csv?
Expected: Abstain: the fixtures do not contain the requested facts.
Required source labels: []; relevant chunks: [].

Automatic: **pass**; formal evaluator: **pass**; human: **not-reviewed**.
Reasons: []. Review uncertainties: [].
Observed case latency: 16134.1 ms; answer latency: 15752.621251 ms. Native attempts: 4; reported tokens: 3165.
Safe execution error: null.

**Actual returned answer:**

I don't have enough evidence from the available documents and datasets to answer that question.

grounded=False. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "pass", "automatedStatus": "pass", "failures": [], "review": [], "citationPrecision": null, "sourceRecall": null, "quoteValidity": null, "numeric": [], "refusalCorrect": true}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["101", "105", "103"], "durationMs": 115.33127300000001, "k": 3, "hits": 0, "relevant": 0, "returned": 3, "recall": null, "precision": null}, {"mode": "hybrid", "ranked": ["101"], "durationMs": 86.35795700000017, "k": 3, "hits": 0, "relevant": 0, "returned": 1, "recall": null, "precision": null}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 103.8 |
| postgres | ok |  | 6 |
| retrieval | ok |  | 115 |
| embedding | ok |  | 79.2 |
| postgres | ok |  | 6.2 |
| retrieval | ok |  | 86.3 |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1502.6 |
| planning-groq | ok |  | 1668.5 |
| postgres | ok |  | 0.5 |
| postgres | ok |  | 0.4 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 0.4 |
| tool | ok | discoverDatasets | 4 |
| groq-pacing | ok |  | 3327.4 |
| groq-http | ok |  | 1555 |
| planning-groq | ok |  | 4886.8 |
| tool | ok | inspectDataset | 2.5 |
| groq-pacing | ok |  | 3430.2 |
| groq-http | ok |  | 495.6 |
| planning-groq | ok |  | 3931.5 |
| planning-wall | ok |  | 10531.1 |
| groq-pacing | ok |  | 4486.4 |
| groq-http | ok |  | 709.6 |
| final-generation | ok |  | 5210.3 |
| citation-verification | ok |  | 4 |
| agent | abstained |  | 15747.5 |
| request | ok |  | 15751.5 |
| answer-end-to-end | ok |  | 15752.621251 |

### missing-04 — insufficient

Original question: What is Orion’s parental leave allowance?
Expected: Abstain: the fixtures do not contain the requested facts.
Required source labels: []; relevant chunks: [].

Automatic: **pass**; formal evaluator: **pass**; human: **not-reviewed**.
Reasons: []. Review uncertainties: [].
Observed case latency: 701.0 ms; answer latency: 526.5967499999997 ms. Native attempts: 1; reported tokens: 923.
Safe execution error: null.

**Actual returned answer:**

I don't have enough information in the retrieved documents to answer that question.

grounded=False. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "pass", "automatedStatus": "pass", "failures": [], "review": [], "citationPrecision": null, "sourceRecall": null, "quoteValidity": null, "numeric": [], "refusalCorrect": true}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["102", "101", "104"], "durationMs": 49.860054999999875, "k": 3, "hits": 0, "relevant": 0, "returned": 3, "recall": null, "precision": null}, {"mode": "hybrid", "ranked": ["102", "101", "104"], "durationMs": 57.06570500000021, "k": 3, "hits": 0, "relevant": 0, "returned": 3, "recall": null, "precision": null}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 46 |
| postgres | ok |  | 2.8 |
| retrieval | ok |  | 49.6 |
| embedding | ok |  | 51.1 |
| postgres | ok |  | 5 |
| retrieval | ok |  | 57 |
| embedding | ok |  | 47.3 |
| postgres | ok |  | 4.1 |
| retrieval | ok |  | 52 |
| retrieval | ok |  | 52.2 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 436.1 |
| citation-verification | ok |  | 0.5 |
| final-generation | ok |  | 464.5 |
| citation-verification | ok |  | 0.6 |
| request | ok |  | 525.7 |
| answer-end-to-end | ok |  | 526.5967499999997 |

### conflict-02 — ambiguous

Original question: Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates?
Expected: Abstain or request clarification; do not silently select a policy or department.
Required source labels: []; relevant chunks: ["101", "107"].

Automatic: **fail**; formal evaluator: **fail**; human: **not-reviewed**.
Reasons: ["irrelevant_or_unknown_source"]. Review uncertainties: ["unregistered_valid_query_plan_requires_review", "free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"].
Observed case latency: 26255.6 ms; answer latency: 26001.126482 ms. Native attempts: 6; reported tokens: 7618.
Safe execution error: null.

**Actual returned answer:**

The team Alpha’s total monthly sales of 30 units exceed both the 15‑unit and 22‑unit minimum targets, so it meets both policies. [C1] [D1] [D2]<br><br>The team Gamma’s total monthly sales of 15 units meet the 15‑unit minimum target but fall short of the 22‑unit target, so it does not satisfy the higher policy. [C1] [D1] [D2]<br><br>The team Beta’s total monthly sales of 6 units fall below both the 15‑unit and 22‑unit minimum targets, so it fails to meet either policy. [C1] [D1] [D2]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | revised-team-policy.docx; document 7, chunk 107; page not supplied | Orion team policy: the minimum monthly total sales target for each team is 22 units. This policy has no effective date. |
| D2 | team-policy.docx; document 1, chunk 101; page not supplied | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV evidence rows: `[{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]}].
Numeric/citation/refusal checks: `{"status": "fail", "automatedStatus": "fail", "failures": ["irrelevant_or_unknown_source"], "review": ["unregistered_valid_query_plan_requires_review", "free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"], "citationPrecision": 0.6666666666666666, "sourceRecall": 1, "quoteValidity": 1, "numeric": [], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["107", "101", "105"], "durationMs": 77.866487, "k": 3, "hits": 2, "relevant": 2, "returned": 3, "recall": 1, "precision": 0.6666666666666666}, {"mode": "hybrid", "ranked": ["107", "101", "105"], "durationMs": 89.13295000000016, "k": 3, "hits": 2, "relevant": 2, "returned": 3, "recall": 1, "precision": 0.6666666666666666}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 73.2 |
| postgres | ok |  | 3.5 |
| retrieval | ok |  | 77.6 |
| embedding | ok |  | 81 |
| postgres | ok |  | 7.3 |
| retrieval | ok |  | 89 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 640.5 |
| planning-groq | ok |  | 797.3 |
| embedding | ok |  | 71.6 |
| postgres | ok |  | 9.2 |
| retrieval | ok |  | 81.4 |
| tool | ok | searchDocuments | 83.5 |
| groq-pacing | ok |  | 4116.5 |
| groq-http | ok |  | 788.6 |
| planning-groq | ok |  | 4908.6 |
| postgres | ok |  | 4.1 |
| postgres | ok |  | 1 |
| postgres | ok |  | 2.8 |
| postgres | ok |  | 1.3 |
| tool | ok | discoverDatasets | 14.4 |
| groq-pacing | ok |  | 4173.5 |
| groq-http | ok |  | 907.9 |
| planning-groq | ok |  | 5088.9 |
| tool | ok | inspectDataset | 2.7 |
| groq-pacing | ok |  | 4077.1 |
| groq-http | ok |  | 719 |
| planning-groq | ok |  | 4802.3 |
| postgres | ok |  | 1 |
| postgres | ok |  | 0.9 |
| postgres | ok |  | 1.7 |
| postgres | ok |  | 3.4 |
| postgres | ok |  | 1.1 |
| csv-query | ok |  | 10.4 |
| tool | ok | queryDataset | 69.3 |
| groq-pacing | ok |  | 4196.4 |
| groq-http | ok |  | 1646 |
| planning-groq | ok |  | 5846.7 |
| planning-wall | ok |  | 21671.1 |
| groq-pacing | ok |  | 3348.6 |
| groq-http | ok |  | 958.6 |
| final-generation | ok |  | 4313.8 |
| citation-verification | ok |  | 11.1 |
| agent | grounded |  | 25997.6 |
| request | ok |  | 26000.3 |
| answer-end-to-end | ok |  | 26001.126482 |

### ambiguous-01 — ambiguous

Original question: What monthly team target applies to me? My department is not specified.
Expected: Abstain or request clarification; do not silently select a policy or department.
Required source labels: []; relevant chunks: ["108"].

Automatic: **fail**; formal evaluator: **fail**; human: **not-reviewed**.
Reasons: ["irrelevant_or_unknown_source", "missing_required_source"]. Review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"].
Observed case latency: 11138.4 ms; answer latency: 10903.089241 ms. Native attempts: 3; reported tokens: 2957.
Safe execution error: null.

**Actual returned answer:**

You are subject to the minimum monthly team sales target of 15 units, as defined by the Orion team policy. [D2]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D2 | team-policy.docx; document 1, chunk 101; page not supplied | Orion team policy: the minimum monthly total sales target for each team is 15 units. |

Independent CSV checks: [].
Numeric/citation/refusal checks: `{"status": "fail", "automatedStatus": "fail", "failures": ["irrelevant_or_unknown_source", "missing_required_source"], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"], "citationPrecision": 0, "sourceRecall": 0, "quoteValidity": 1, "numeric": [], "refusalCorrect": false}`
Diagnostic retrieval (not proof of planner tool selection): [{"mode": "semantic", "ranked": ["108", "101", "104"], "durationMs": 69.89856000000009, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["108", "101", "104"], "durationMs": 91.87006900000006, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].

Rubric awaiting actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Missing extraction/plan registration can leave a correct answer uncertain; quote membership can also accompany unsupported prose. Neither is silently promoted to a human pass.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 64.9 |
| postgres | ok |  | 3.9 |
| retrieval | ok |  | 69.5 |
| embedding | ok |  | 82.8 |
| postgres | ok |  | 8 |
| retrieval | ok |  | 91.8 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1563.4 |
| planning-groq | ok |  | 1759.8 |
| embedding | ok |  | 56.5 |
| postgres | ok |  | 6.2 |
| retrieval | ok |  | 63.3 |
| tool | ok | searchDocuments | 65.9 |
| groq-pacing | ok |  | 3146.2 |
| groq-http | ok |  | 1762.9 |
| planning-groq | ok |  | 4913.3 |
| planning-wall | ok |  | 6799.9 |
| groq-pacing | ok |  | 3215.1 |
| groq-http | ok |  | 855.1 |
| final-generation | ok |  | 4090.4 |
| citation-verification | ok |  | 6.7 |
| agent | grounded |  | 10898.7 |
| request | ok |  | 10901.6 |
| answer-end-to-end | ok |  | 10903.089241 |

## Remaining cases

| ID | Category | Original question |
| --- | --- | --- |
| none | none | All original cases executed; human review remains incomplete |

## Limitations

These are single observations with real local/provider/pacing overhead, not production latency distributions or an SLA. Case latency includes fixture work/diagnostic retrieval; answer-only and nested stage timings overlap. No actual human reviewed answers in this run. Raw process diagnostics remain private; public outputs contain fictional evidence and safe errors only. No automatic rerun, provider/model replacement or application fix was used to improve a score.

Prior evidence: [pilot](../report.md), [batch 02](../batch-02/report.md). Approval/fixture preservation: [plan](README.md), [plan.json](plan.json). Actual unfilled review template: [review-template.json](review-template.json).

## Final preservation and regression validation

- All 25 cumulative case definitions exactly match the unchanged original fixture catalog. There are 25 unique executed IDs; no prior case was repeated. Twenty-four structured responses were returned; csv-05 has an execution error/no answer.
- All 77 prior evaluation artifact fingerprints and every current app/src source fingerprint matched the pre-run inventory. Only temporary fictional database tables were used for evidence; no existing account/document/dataset record was written by the evaluation fixture path.
- Independently checked 29 reported source references and 29 exact quoted excerpts against the controlled fixture identities/text. All 12 returned CSV evidence checks matched the independent oracle. This verifies provenance/calculation properties, not semantic entailment or source relevance; the recorded findings remain.
- All seventeen saved results were rescored with every network endpoint blocked. Automatic/final classifications matched, including the three failures; no live request was retried and native attempt count remained 66 for this run.
- Pre-run full suite: 232 registered, 224 passed/eight optional database skips, zero failures. Post-run evaluator/guard suite: 43 registered, 42 passed/one optional database skip, zero failures. TypeScript and ESLint passed. These checks are not extra live benchmark cases.
- Last recorded quota headers: daily requests 930 remaining of 1,000; minute tokens 6,724 remaining of 8,000. They are a response-time snapshot, not a current quota guarantee. Remaining daily tokens stayed unknown. The run stayed below its 113-attempt and 160,000-token planning bounds; one failed request's actual usage is unknown and was conservatively budgeted.
- No application code, model, credentials, authentication, citation verification, original fixtures or Git history was changed for this evaluation. Existing document-pagination changes were preserved. Nothing was staged, committed or pushed by this work.
