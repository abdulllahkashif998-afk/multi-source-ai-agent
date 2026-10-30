# Live Groq benchmark — batch 02

28 October 2026. **Real provider results, separate from mocks/scripted outputs. Full 25-case benchmark remains incomplete.**

Unchanged fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. Existing model: `openai/gpt-oss-20b`. Only the five explicitly approved cases were eligible to run; no completed pilot case was rerun.

## Actual batch and cumulative results

| Measure | Batch 02 | Cumulative pilot + batch 02 |
| --- | ---: | ---: |
| Cases executed | 5 | 8 |
| Final pass | 1 | 1 |
| Final fail | 0 | 0 |
| Needs review | 4 | 7 |
| Automatic checks passed | 5 | 8 |
| Human reviewed | 0 | 0 |
| Native HTTP attempts | 16 | 29 |
| Reported token usage | 16319 | 29544 |
| Attempts with unknown usage | 0 | 0 |

Remaining original cases: **17**. Batch stop reason: none. Reported prompt/completion tokens this batch: 15222 / 1097.

Final classifications are from the existing evaluator. A canonical insufficient-evidence refusal can pass its automatic refusal contract without a human semantic review. Other successful answers/conflict responses can remain needs-review. No human identity, rubric rating or acceptance has been invented. Token totals are returned usage, not a claim of exact billable/quota counters; missing usage is unknown, not zero.

## Important semantic finding — actual human review pending

`conflict-01` returned: “When Orion’s team policies conflict, the higher minimum monthly target applies, so the team should use a target of 22 units per month. [D1] [D2]”

The expected answer is abstention or clarification. The controlled fixtures state competing targets of 15 and 22 with no effective date/precedence rule. **The answer's higher-target-wins rule is not supported by those sources.** This is an AI-assisted comparison against the original evidence, not a fabricated human review. The genuine source IDs/exact quotes passed provenance checks; those checks do not establish this claim's entailment. Formal outcome stays **needs-review**, and human-reviewed stays **0** until an actual reviewer decides. The zero automatic-failure count must not be interpreted as absence of a semantic problem.

No application change, label rewrite, extra live call or automatic retest was made to hide or repair this result. A human should specifically assess groundedness and conflict handling. The machine-readable records retain this AI-assisted finding separately from the evaluator/human fields.

## Execution and safety

Original questions/expected facts/corpora were reused unchanged. Existing Groq selection, 12-RPM pacing, model options, strict source/reference/quote checks and agent deadlines were preserved. Cases ran serially with at least 65 seconds between them, bounded by 29 native attempts and a 60,000-token planning allowance. There was no automatic HTTP/case retry. Provider 401/403/429 would stop the batch. No separate quota API probe occurred.

Only isolated fictional PostgreSQL temporary tables and real configured BGE embeddings supplied evidence. Explicit IDs, savepoints, rollback and restoration isolate the public database; no existing user data/model/authentication code changed. This is an operator fixture-scope backend evaluation, not browser session replay. All original pilot public artifacts and its private checkpoint/results/ledgers matched the pre-batch SHA-256 preservation inventory.

A preparation check found that legitimate zero-provider-call abstention lacked an explicit empty ledger. The evaluation supervisor now creates a private empty ledger before each case without overwriting existing files. This fixes evaluation accounting only; it does not change application answers or count a local abstention as an LLM-generated refusal.

## Actual cases, answers and citations

### doc-02 — document

Question: How many paid vacation days does an Orion employee get each year?
Expected: The annual paid leave allowance is 20 days.
Required source labels: ["doc:2:102"]; relevant chunks: ["102"].

Automatic: **pass**; final classification: **needs-review**; human: **not-reviewed**.
Reasons: []; remaining review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Actual case latency: 1159.9 ms; answer latency: 949.023048 ms. Native HTTP attempts: 1. Reported tokens: 990.
Safe failure: null.

**Actual returned answer:**

Orion employees receive 20 days of annual paid leave per calendar year. [S1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact quote(s) |
| --- | --- | --- |
| S1 | leave-policy.pdf; document 2, chunk 102 | Orion employees receive 20 days of annual paid leave per calendar year. |

Diagnostic retrieval comparisons (not proof of the planner's exact search): [{"mode": "semantic", "ranked": ["102", "101", "104"], "durationMs": 56.08731500000022, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["102", "101", "103"], "durationMs": 59.25344099999984, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}].
Independent CSV checks: [].
Numeric/citation/refusal machine checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "leave allowance", "expected": 20, "tolerance": 1e-06, "observed": [20], "correct": true}], "refusalCorrect": false}`

Rubric pending actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Inspect the case evidence; quote membership does not establish every local claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 51.7 |
| postgres | ok |  | 3.3 |
| retrieval | ok |  | 55.8 |
| embedding | ok |  | 52.3 |
| postgres | ok |  | 6.1 |
| retrieval | ok |  | 59.2 |
| embedding | ok |  | 53.3 |
| postgres | ok |  | 4 |
| retrieval | ok |  | 58.1 |
| retrieval | ok |  | 58.2 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 817.5 |
| citation-verification | ok |  | 5.7 |
| final-generation | ok |  | 872.3 |
| citation-verification | ok |  | 6.3 |
| request | ok |  | 948.2 |
| answer-end-to-end | ok |  | 949.023048 |

### csv-02 — csv

Question: Add up all amounts in sales.csv.
Expected: The total sales amount is 51 units.
Required source labels: ["csv:201"]; relevant chunks: [].

Automatic: **pass**; final classification: **needs-review**; human: **not-reviewed**.
Reasons: []; remaining review uncertainties: ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Actual case latency: 20796.6 ms; answer latency: 20672.999672 ms. Native HTTP attempts: 5. Reported tokens: 4293.
Safe failure: null.

**Actual returned answer:**

The total sum of all amounts in sales.csv is 51. [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact quote(s) |
| --- | --- | --- |
| C1 | sales.csv; dataset 201 | [{"value":51}] |

Actual structured CSV plan: `{"datasetId": "201", "filters": [], "groupBy": [], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV rows: `[{"value": 51}]`

Diagnostic retrieval comparisons (not proof of the planner's exact search): [].
Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 51}]}].
Numeric/citation/refusal machine checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "total", "expected": 51, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`

Rubric pending actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Inspect the case evidence; quote membership does not establish every local claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 1 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 902.2 |
| planning-groq | ok |  | 1135.1 |
| postgres | ok |  | 20.8 |
| postgres | ok |  | 0.4 |
| postgres | ok |  | 1.6 |
| postgres | ok |  | 0.5 |
| tool | ok | discoverDatasets | 26.9 |
| groq-pacing | ok |  | 3832.1 |
| groq-http | ok |  | 563.2 |
| planning-groq | ok |  | 4401 |
| tool | ok | inspectDataset | 2.1 |
| groq-pacing | ok |  | 4415.1 |
| groq-http | ok |  | 1226.9 |
| planning-groq | ok |  | 5647.9 |
| postgres | ok |  | 2.1 |
| postgres | ok |  | 1 |
| postgres | ok |  | 1.8 |
| postgres | ok |  | 4 |
| postgres | ok |  | 0.9 |
| csv-query | ok |  | 11.8 |
| tool | ok | queryDataset | 64.6 |
| groq-pacing | ok |  | 3695.7 |
| groq-http | ok |  | 1173.2 |
| planning-groq | ok |  | 4874 |
| planning-wall | ok |  | 16203.9 |
| groq-pacing | ok |  | 3813.2 |
| groq-http | ok |  | 612.3 |
| final-generation | ok |  | 4443.8 |
| citation-verification | ok |  | 18 |
| agent | grounded |  | 20669 |
| request | ok |  | 20672 |
| answer-end-to-end | ok |  | 20672.999672 |

### combined-02 — combined

Question: Using the team policy and sales.csv, by how much does Alpha exceed the target?
Expected: Alpha total is 30 units; the target is 15 units; Alpha surplus is 15 units.
Required source labels: ["doc:1:101", "csv:201"]; relevant chunks: ["101"].

Automatic: **pass**; final classification: **needs-review**; human: **not-reviewed**.
Reasons: []; remaining review uncertainties: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Actual case latency: 27121.3 ms; answer latency: 26850.899254 ms. Native HTTP attempts: 6. Reported tokens: 7136.
Safe failure: null.

**Actual returned answer:**

Alpha’s sales of 30 units exceed the team target of 15 units by 15 units. [D1] [C1]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact quote(s) |
| --- | --- | --- |
| D1 | team-policy.docx; document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset 201 | [{"value":30}] |

Actual structured CSV plan: `{"datasetId": "201", "filters": [{"column": "team", "op": "eq", "value": "Alpha"}], "groupBy": [], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV rows: `[{"value": 30}]`

Diagnostic retrieval comparisons (not proof of the planner's exact search): [{"mode": "semantic", "ranked": ["101", "104", "103"], "durationMs": 94.52611200000001, "k": 3, "hits": 1, "relevant": 1, "returned": 3, "recall": 1, "precision": 0.3333333333333333}, {"mode": "hybrid", "ranked": ["101", "104"], "durationMs": 74.39408600000002, "k": 3, "hits": 1, "relevant": 1, "returned": 2, "recall": 1, "precision": 0.3333333333333333}].
Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 30}]}].
Numeric/citation/refusal machine checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Alpha total", "expected": 30, "tolerance": 1e-06, "observed": [], "correct": null}, {"label": "Alpha surplus", "expected": 15, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`

Rubric pending actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Inspect the case evidence; quote membership does not establish every local claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 90.5 |
| postgres | ok |  | 2.9 |
| retrieval | ok |  | 94.1 |
| embedding | ok |  | 68.2 |
| postgres | ok |  | 5.4 |
| retrieval | ok |  | 74.3 |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 670.3 |
| planning-groq | ok |  | 879.5 |
| embedding | ok |  | 47.7 |
| postgres | ok |  | 4 |
| retrieval | ok |  | 52.5 |
| tool | ok | searchDocuments | 58.3 |
| groq-pacing | ok |  | 4057.5 |
| groq-http | ok |  | 798.7 |
| planning-groq | ok |  | 4859.4 |
| postgres | ok |  | 1.7 |
| postgres | ok |  | 1 |
| postgres | ok |  | 2.4 |
| postgres | ok |  | 1.2 |
| tool | ok | discoverDatasets | 10.8 |
| groq-pacing | ok |  | 4175 |
| groq-http | ok |  | 1008.4 |
| planning-groq | ok |  | 5189.5 |
| tool | ok | inspectDataset | 2.6 |
| groq-pacing | ok |  | 3970.1 |
| groq-http | ok |  | 715.9 |
| planning-groq | ok |  | 4692.8 |
| postgres | ok |  | 1.2 |
| postgres | ok |  | 1.5 |
| postgres | ok |  | 1.9 |
| postgres | ok |  | 4.4 |
| postgres | ok |  | 1.4 |
| csv-query | ok |  | 12.8 |
| tool | ok | queryDataset | 70.6 |
| groq-pacing | ok |  | 4193.5 |
| groq-http | ok |  | 1866.9 |
| planning-groq | ok |  | 6067 |
| planning-wall | ok |  | 21900.1 |
| groq-pacing | ok |  | 3112.4 |
| groq-http | ok |  | 1782 |
| final-generation | ok |  | 4916.1 |
| citation-verification | ok |  | 27.7 |
| agent | grounded |  | 26846 |
| request | ok |  | 26850 |
| answer-end-to-end | ok |  | 26850.899254 |

### missing-01 — insufficient

Question: What ocean research grants does Orion offer?
Expected: Abstain: the fixtures do not contain the requested facts.
Required source labels: []; relevant chunks: [].

Automatic: **pass**; final classification: **pass**; human: **not-reviewed**.
Reasons: []; remaining review uncertainties: [].
Actual case latency: 1212.3 ms; answer latency: 1042.2696960000003 ms. Native HTTP attempts: 1. Reported tokens: 829.
Safe failure: null.

**Actual returned answer:**

I don't have enough information in the retrieved documents to answer that question.

grounded=False. Real Groq calls occurred for this case.

| Citation | Identity | Exact quote(s) |
| --- | --- | --- |
| none | none | none |

Diagnostic retrieval comparisons (not proof of the planner's exact search): [{"mode": "semantic", "ranked": ["101", "102", "106"], "durationMs": 42.798812, "k": 3, "hits": 0, "relevant": 0, "returned": 3, "recall": null, "precision": null}, {"mode": "hybrid", "ranked": ["101", "102"], "durationMs": 46.616759999999886, "k": 3, "hits": 0, "relevant": 0, "returned": 2, "recall": null, "precision": null}].
Independent CSV checks: [].
Numeric/citation/refusal machine checks: `{"status": "pass", "automatedStatus": "pass", "failures": [], "review": [], "citationPrecision": null, "sourceRecall": null, "quoteValidity": null, "numeric": [], "refusalCorrect": true}`

Rubric pending actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Inspect the case evidence; quote membership does not establish every local claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 38.3 |
| postgres | ok |  | 3.4 |
| retrieval | ok |  | 42.5 |
| embedding | ok |  | 40.2 |
| postgres | ok |  | 5.5 |
| retrieval | ok |  | 46.6 |
| embedding | ok |  | 36.8 |
| postgres | ok |  | 3.5 |
| retrieval | ok |  | 40.9 |
| retrieval | ok |  | 41.1 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 921.6 |
| citation-verification | ok |  | 3.1 |
| final-generation | ok |  | 984.2 |
| citation-verification | ok |  | 3.3 |
| request | ok |  | 1041 |
| answer-end-to-end | ok |  | 1042.2696960000003 |

### conflict-01 — ambiguous

Question: Which minimum monthly target should we use when the two active Orion policies disagree?
Expected: Abstain or request clarification; do not silently select a policy or department.
Required source labels: []; relevant chunks: ["101", "107"].

Automatic: **pass**; final classification: **needs-review**; human: **not-reviewed**.
Reasons: []; remaining review uncertainties: ["free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"].
Actual case latency: 10928.9 ms; answer latency: 10681.291329 ms. Native HTTP attempts: 3. Reported tokens: 3071.
Safe failure: null.

**Actual returned answer:**

When Orion’s team policies conflict, the higher minimum monthly target applies, so the team should use a target of 22 units per month. [D1] [D2]

grounded=True. Real Groq calls occurred for this case.

| Citation | Identity | Exact quote(s) |
| --- | --- | --- |
| D1 | revised-team-policy.docx; document 7, chunk 107 | Orion team policy: the minimum monthly total sales target for each team is 22 units. This policy has no effective date. |
| D2 | team-policy.docx; document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |

Diagnostic retrieval comparisons (not proof of the planner's exact search): [{"mode": "semantic", "ranked": ["107", "101", "102"], "durationMs": 78.30003499999975, "k": 3, "hits": 2, "relevant": 2, "returned": 3, "recall": 1, "precision": 0.6666666666666666}, {"mode": "hybrid", "ranked": ["107", "101", "102"], "durationMs": 66.73175300000003, "k": 3, "hits": 2, "relevant": 2, "returned": 3, "recall": 1, "precision": 0.6666666666666666}].
Independent CSV checks: [].
Numeric/citation/refusal machine checks: `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review", "sourced_conflict_explanation_or_clarification_requires_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [], "refusalCorrect": false}`

Rubric pending actual human decision: factual correctness, completeness, groundedness, citation support and conflict handling. Inspect the case evidence; quote membership does not establish every local claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 72.9 |
| postgres | ok |  | 4.3 |
| retrieval | ok |  | 77.9 |
| embedding | ok |  | 58.7 |
| postgres | ok |  | 7.1 |
| retrieval | ok |  | 66.6 |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 907.5 |
| planning-groq | ok |  | 1070.2 |
| embedding | ok |  | 31.3 |
| postgres | ok |  | 4.1 |
| retrieval | ok |  | 36 |
| tool | ok | searchDocuments | 38 |
| groq-pacing | ok |  | 3889.2 |
| groq-http | ok |  | 1527.8 |
| planning-groq | ok |  | 5422.7 |
| planning-wall | ok |  | 6560.3 |
| groq-pacing | ok |  | 3454 |
| groq-http | ok |  | 629 |
| final-generation | ok |  | 4099.9 |
| citation-verification | ok |  | 13.7 |
| agent | grounded |  | 10676.3 |
| request | ok |  | 10680.4 |
| answer-end-to-end | ok |  | 10681.291329 |

## Remaining original cases

| ID | Category | Unchanged question |
| --- | --- | --- |
| doc-03 | document | How long after delivery can unopened equipment be sent back? |
| doc-04 | document | At what travel expense amount is manager sign-off required? |
| doc-05 | document | What is the acknowledgment deadline for a service incident? |
| doc-06 | document | Tell me the recorded approval status of ZX-2048. |
| csv-03 | csv | What is the average amount per sales record? |
| csv-04 | csv | Show total sales for Alpha, Beta and Gamma, grouped by team. |
| csv-05 | csv | List the East-region sales amounts, largest first. |
| csv-06 | csv | How many employees have expenses strictly above 500 credits? |
| combined-03 | combined | Does Gamma meet the minimum monthly team total exactly? |
| combined-04 | combined | According to the policy, which teams fall short when all sales rows are added per team? |
| combined-05 | combined | Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded? |
| combined-06 | combined | Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline? |
| missing-02 | insufficient | What were team sales last year? The provided sales data has no year column. |
| missing-03 | insufficient | What is the average customer age in sales.csv? |
| missing-04 | insufficient | What is Orion’s parental leave allowance? |
| conflict-02 | ambiguous | Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates? |
| ambiguous-01 | ambiguous | What monthly team target applies to me? My department is not specified. |

## Limits and review

Case timings are observed once, include local/provider/pacing overhead, and are not percentile or production-capacity estimates. Diagnostic retrieval and setup are included in case latency but excluded from answer-only latency; stage durations overlap. Human review remains separate from automatic outcomes. Additional cases/retests require new explicit approval, and no full-benchmark accuracy claim is made.

Original pilot: [report](../report.md). Approval/preparation: [batch plan](README.md). All-original-case cumulative record: [cumulative-results.json](cumulative-results.json). Blank actual-response review template: [review-template.json](review-template.json).

## Non-destructive validation after the batch

- Standard regression suite: **227 total; 219 passed, eight optional database skips, zero failures**. New regressions verify original-case selection/no pilot repeats, fixture-hash rejection, zero-request ledger initialization and refusal to overwrite an existing ledger.
- TypeScript, ESLint and `git diff --check` passed.
- All five saved results were replayed through the existing evaluator with every network endpoint blocked; automatic/final classifications matched. Native HTTP attempt count remained 16.
- All 25 cumulative benchmark definitions exactly match the original fixture catalog. Eight distinct IDs are executed; 17 are not run. All pilot preservation SHA-256 fingerprints match.
- Local documentation links resolve. Application files under app/ and src/ were not modified; no Git files were staged, committed or pushed.
