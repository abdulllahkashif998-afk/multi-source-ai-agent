# Real Groq evaluation — approved three-case pilot

28 October 2026. **Real provider results, not mocked/scripted answers. The full 25-case benchmark is NOT complete.**

Original fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. Existing model: `openai/gpt-oss-20b`. Only doc-01, csv-01 and combined-01 were approved. Other questions were not submitted.

## Actual summary

| Measure | Result |
| --- | --- |
| originalCases | 25 |
| approvedPilotCases | 3 |
| executedCases | 3 |
| notExecutedCases | 22 |
| pass | 0 |
| fail | 0 |
| needsReview | 3 |
| automaticPass | 3 |
| humanReviewed | 0 |
| providerHTTPAttempts | 13 |
| knownPromptTokens | 12515 |
| knownCompletionTokens | 710 |
| knownTotalTokens | 13225 |
| unknownUsageAttempts | 0 |
| stopReason | None |

Pass/fail/needs-review are the existing evaluator classifications. Automatic provenance/numeric checks are not a human semantic decision. No human annotation was supplied or invented. Missing provider usage is unknown, not zero; token totals sum only reported usage. HTTP attempts come from the native-fetch ledger, not SDK invocation counts.

## Method and limits

Each case used the existing answer-quality CLI and real Groq provider, with unchanged model/options and strict citation/reference verification. Existing 12-RPM pacing, request/tool deadlines and per-call output cap were preserved. The evaluation-only network guard prevents transport 429 retries, caps attempts, allows only Groq and configured local Ollama endpoints, and stops on access/quota denial. No failed case was resubmitted. A minimum 65-second pause separates cases.

Fixtures are the original deterministic documents/CSV rows with explicit fictional owner identities. Temporary PostgreSQL tables, rollback and restored pool patches prevent changes to public users, documents, rows or sequences. BGE is real. This is a backend fixture-scope evaluation, not a replay of browser authentication. Existing session/CSRF checks remain unchanged and are covered separately by regressions.

Latency is the actual observed per-case run. Answer time excludes diagnostic retrieval comparisons and fixture setup; end-to-end case time includes them. Stage timings overlap and must not be summed.

## All original cases: execution status

| ID | Question | Executed | Final evaluator status |
| --- | --- | --- | --- |
| doc-01 | What is the minimum monthly sales target for a team? | yes | needs-review |
| doc-02 | How many paid vacation days does an Orion employee get each year? | no | not run |
| doc-03 | How long after delivery can unopened equipment be sent back? | no | not run |
| doc-04 | At what travel expense amount is manager sign-off required? | no | not run |
| doc-05 | What is the acknowledgment deadline for a service incident? | no | not run |
| doc-06 | Tell me the recorded approval status of ZX-2048. | no | not run |
| csv-01 | How many sales records are in sales.csv? | yes | needs-review |
| csv-02 | Add up all amounts in sales.csv. | no | not run |
| csv-03 | What is the average amount per sales record? | no | not run |
| csv-04 | Show total sales for Alpha, Beta and Gamma, grouped by team. | no | not run |
| csv-05 | List the East-region sales amounts, largest first. | no | not run |
| csv-06 | How many employees have expenses strictly above 500 credits? | no | not run |
| combined-01 | Compare team totals with the policy minimum. How far below is Beta? | yes | needs-review |
| combined-02 | Using the team policy and sales.csv, by how much does Alpha exceed the target? | no | not run |
| combined-03 | Does Gamma meet the minimum monthly team total exactly? | no | not run |
| combined-04 | According to the policy, which teams fall short when all sales rows are added per team? | no | not run |
| combined-05 | Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded? | no | not run |
| combined-06 | Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline? | no | not run |
| missing-01 | What ocean research grants does Orion offer? | no | not run |
| missing-02 | What were team sales last year? The provided sales data has no year column. | no | not run |
| missing-03 | What is the average customer age in sales.csv? | no | not run |
| missing-04 | What is Orion’s parental leave allowance? | no | not run |
| conflict-01 | Which minimum monthly target should we use when the two active Orion policies disagree? | no | not run |
| conflict-02 | Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates? | no | not run |
| ambiguous-01 | What monthly team target applies to me? My department is not specified. | no | not run |

## Per-case actual responses and evidence

### doc-01 — document

Question: What is the minimum monthly sales target for a team?

Expected: The minimum monthly team total sales target is 15 units.
Required source labels: ["doc:1:101"]; relevant chunks: ["101"].

Automatic: **pass**; final: **needs-review**; human: **not-reviewed**.
Reasons: []; unresolved judgments: ["free_text_entailment_units_conditions_and_completeness_require_human_review"].
Case latency: 974.0 ms; answer latency: 732.397293 ms. Native HTTP attempts: 1.
Safe failure: null.

**Actual generated answer:**

The minimum monthly total sales target for each team is 15 units. [S1]

grounded=True

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| S1 | team-policy.docx; document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |

Independent CSV checks: [].
Machine score (numeric/citation/refusal checks): `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "target", "expected": 15, "tolerance": 1e-06, "observed": [15], "correct": true}], "refusalCorrect": false}`

Human rubric pending: factual correctness, completeness, groundedness, citation support and conflict handling. A genuine quote/expected number is supporting evidence for review, not proof of every claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 57.8 |
| postgres | ok |  | 3.8 |
| retrieval | ok |  | 62.4 |
| embedding | ok |  | 53.6 |
| postgres | ok |  | 6.1 |
| retrieval | ok |  | 60.6 |
| embedding | ok |  | 49.8 |
| postgres | ok |  | 3.8 |
| retrieval | ok |  | 54.1 |
| retrieval | ok |  | 54.3 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 608.7 |
| citation-verification | ok |  | 3.9 |
| final-generation | ok |  | 657.5 |
| citation-verification | ok |  | 5.4 |
| request | ok |  | 731.3 |
| answer-end-to-end | ok |  | 732.397293 |

### csv-01 — csv

Question: How many sales records are in sales.csv?

Expected: The sales record count is 5.
Required source labels: ["csv:201"]; relevant chunks: [].

Automatic: **pass**; final: **needs-review**; human: **not-reviewed**.
Reasons: []; unresolved judgments: ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Case latency: 26552.9 ms; answer latency: 26459.580068 ms. Native HTTP attempts: 6.
Safe failure: null.

**Actual generated answer:**

There are 5 sales records in sales.csv. [C1]

grounded=True

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| C1 | sales.csv; dataset 201 | [{"value":5}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": [], "aggregate": {"op": "count"}, "limit": 100}`
Actual CSV rows: `[{"value": 5}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"value": 5}]}].
Machine score (numeric/citation/refusal checks): `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "record count", "expected": 5, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`

Human rubric pending: factual correctness, completeness, groundedness, citation support and conflict handling. A genuine quote/expected number is supporting evidence for review, not proof of every claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| structured-count | ok |  | 0.7 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 525.2 |
| planning-groq | ok |  | 738.5 |
| postgres | ok |  | 29.1 |
| postgres | ok |  | 0.7 |
| postgres | ok |  | 2.4 |
| postgres | ok |  | 0.5 |
| tool | ok | discoverDatasets | 39.2 |
| groq-pacing | ok |  | 4212.9 |
| groq-http | ok |  | 703.4 |
| planning-groq | ok |  | 4924.4 |
| tool | error | queryDataset | 2.1 |
| groq-pacing | ok |  | 4275.1 |
| groq-http | ok |  | 470.6 |
| planning-groq | ok |  | 4751.9 |
| tool | ok | inspectDataset | 2.2 |
| groq-pacing | ok |  | 4512.7 |
| groq-http | ok |  | 871.3 |
| planning-groq | ok |  | 5389.2 |
| postgres | ok |  | 1.3 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 2.7 |
| postgres | ok |  | 3.1 |
| postgres | ok |  | 0.9 |
| csv-query | ok |  | 10.7 |
| tool | ok | queryDataset | 66.1 |
| groq-pacing | ok |  | 4049.8 |
| groq-http | ok |  | 576 |
| planning-groq | ok |  | 4630.9 |
| planning-wall | ok |  | 20610.7 |
| groq-pacing | ok |  | 4406.7 |
| groq-http | ok |  | 1408.8 |
| final-generation | ok |  | 5830.3 |
| citation-verification | ok |  | 11.8 |
| tool | recovered | queryDataset | 0 |
| agent | grounded |  | 26454.9 |
| request | ok |  | 26458.1 |
| answer-end-to-end | ok |  | 26459.580068 |

### combined-01 — combined

Question: Compare team totals with the policy minimum. How far below is Beta?

Expected: Beta total is 6 units; the target is 15 units; Beta shortfall is 9 units.
Required source labels: ["doc:1:101", "csv:201"]; relevant chunks: ["101"].

Automatic: **pass**; final: **needs-review**; human: **not-reviewed**.
Reasons: []; unresolved judgments: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Case latency: 26238.4 ms; answer latency: 26031.059674999997 ms. Native HTTP attempts: 6.
Safe failure: null.

**Actual generated answer:**

Beta’s monthly sales total 6 units, which is 9 units below the team minimum of 15 units set by Orion team policy. [D1] [C1]

grounded=True

| Citation | Identity | Exact supporting quote(s) |
| --- | --- | --- |
| D1 | team-policy.docx; document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |

Actual CSV plan: `{"datasetId": "201", "filters": [], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
Actual CSV rows: `[{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]}].
Machine score (numeric/citation/refusal checks): `{"status": "needs-review", "automatedStatus": "pass", "failures": [], "review": ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"], "citationPrecision": 1, "sourceRecall": 1, "quoteValidity": 1, "numeric": [{"label": "Beta total", "expected": 6, "tolerance": 1e-06, "observed": [], "correct": null}, {"label": "Beta shortfall", "expected": 9, "tolerance": 1e-06, "observed": [], "correct": null}], "refusalCorrect": false}`

Human rubric pending: factual correctness, completeness, groundedness, citation support and conflict handling. A genuine quote/expected number is supporting evidence for review, not proof of every claim.

| Stage | Outcome | Tool | Duration ms |
| --- | --- | --- | ---: |
| embedding | ok |  | 50.9 |
| postgres | ok |  | 3 |
| retrieval | ok |  | 54.5 |
| embedding | ok |  | 51.7 |
| postgres | ok |  | 5.2 |
| retrieval | ok |  | 57.5 |
| structured-count | ok |  | 0.6 |
| groq-pacing | ok |  | 0 |
| groq-http | ok |  | 1122 |
| planning-groq | ok |  | 1373.5 |
| embedding | ok |  | 41.9 |
| postgres | ok |  | 4.8 |
| retrieval | ok |  | 47.8 |
| tool | ok | searchDocuments | 50.6 |
| groq-pacing | ok |  | 3568.4 |
| groq-http | ok |  | 920.9 |
| planning-groq | ok |  | 4493.8 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 0.9 |
| postgres | ok |  | 2.1 |
| postgres | ok |  | 0.9 |
| tool | ok | discoverDatasets | 8.9 |
| groq-pacing | ok |  | 4054.1 |
| groq-http | ok |  | 1962.1 |
| planning-groq | ok |  | 6021.2 |
| tool | ok | inspectDataset | 2.2 |
| groq-pacing | ok |  | 3023.7 |
| groq-http | ok |  | 751.8 |
| planning-groq | ok |  | 3780.4 |
| postgres | ok |  | 1.1 |
| postgres | ok |  | 0.8 |
| postgres | ok |  | 1.8 |
| postgres | ok |  | 3.1 |
| postgres | ok |  | 0.9 |
| csv-query | ok |  | 9.7 |
| tool | ok | queryDataset | 63.9 |
| groq-pacing | ok |  | 4170.5 |
| groq-http | ok |  | 1893.1 |
| planning-groq | ok |  | 6069.3 |
| planning-wall | ok |  | 21927.5 |
| groq-pacing | ok |  | 3086.8 |
| groq-http | ok |  | 981.5 |
| final-generation | ok |  | 4084.5 |
| citation-verification | ok |  | 13.5 |
| agent | grounded |  | 26027.4 |
| request | ok |  | 26030.3 |
| answer-end-to-end | ok |  | 26031.059674999997 |

## Remaining gaps and next action

- Only the approved three-case pilot was eligible to run. The remaining 22 original questions, including missing-information/irrelevant and conflicting/ambiguous evidence, are not live-evaluated by this pilot. Their original questions/expectations remain unchanged in results.json.
- Human semantic review is incomplete. Fill the response-bound review template with actual reviewer decisions and evidence notes; do not promote AI-assisted comments to human sign-off.
- No overall 25-case accuracy, conflict-handling accuracy, production performance or universal hallucination claim is made.
- Additional provider requests require new explicit approval. Do not rerun this pilot or any failed request automatically.

Related evidence: [preparation and guard checks](README.md), [full original benchmark and rubric](../answer-quality.md), [real retrieval](../retrieval-quality.md), [test register](../../final-test-cases.md).

## Post-run non-destructive validation

Saved-result replay for all three cases reproduced their automatic/final classifications without generating new answers or sending provider requests. Focused answer-quality/evaluation/guard regression run: **35 passed, one optional database skip, zero failures**. Preparation standard suite: **216 passed/eight optional database skips**, with TypeScript and ESLint passed. These tests use controlled responses where appropriate and are not additional live benchmark executions.

The existing evaluator retained `numeric_fact_not_reliably_extractable` for CSV/combined phrasing and `unregistered_valid_query_plan_requires_review` for the combined plan variant. Independent CSV calculations matched; no wrong number/invalid citation was automatically confirmed. These are measurement/semantic-review uncertainties, not proof of hallucination or an application defect. No evaluation label, expected fact, model option or citation check was changed to force a pass.
