# Answer correctness and citation evaluation

**SCRIPTED MOCK: evaluator checks only. No real AI answer accuracy was measured.**

Fixture hash: 898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec. Generated: 2026-10-27T17:14:56.416Z.
Provider: not called; model: not called; actual Groq HTTP attempts in source run: 0.
Executed 25/25 benchmark cases; pass 4, fail 0, needs review 21; human-reviewed 0. Unselected cases are not run.

## Category summary

| Category | Executed | Pass | Fail | Needs review |
| --- | ---: | ---: | ---: | ---: |
| document | 6 | 0 | 0 | 6 |
| csv | 6 | 0 | 0 | 6 |
| combined | 6 | 0 | 0 | 6 |
| insufficient | 4 | 4 | 0 | 0 |
| ambiguous | 3 | 0 | 0 | 3 |

## Human review rubric

- **factualCorrectness:** Check every factual claim and calculation, units, signs, entities, dates and strict/inclusive boundaries against canonical evidence. Wrong claims fail; unknown entailment needs review.
- **completeness:** Check every requested part, comparison and required source. Missing a requested conclusion fails. Do not require verbatim expected wording.
- **groundedness:** Check each claim follows from authorized fixture evidence. Extra unsupported claims fail, even with genuine quotes. Missing fields are not zeros.
- **citationSupport:** Map each factual claim to its local citation markers and supporting text/CSV rows. Authentic quotes alone do not prove entailment. Missing or misleading support fails.
- **conflictHandling:** For conflict/ambiguity, require explicit recognition and clarification or abstention; never silently choose. Otherwise pass only if no applicable conflict was overlooked.

Rate every dimension pass, fail, or needs-review. Record concrete claim-to-evidence reasoning and reviewer identity. All five must pass to approve answerable prose. A deterministic failure cannot be overridden. Unknown or disputed meaning stays needs-review. Review binding uses both fixture and exact response hashes; stale annotations are ignored. No human judgments are invented by this runner.

## Errors and abstention

Confirmed failure categories (can overlap): {}.
Retrieval/tool-selection root causes require trace evidence. Missing citations alone cannot establish either. Hallucination requires semantic review; matching numbers and quotes do not exclude it. Canonical missing-evidence abstention can pass only its refusal contract. Conflict/ambiguity needs semantic review even after a canonical refusal.

## Per-case evidence and outcomes

### doc-01 — document

Question: What is the minimum monthly sales target for a team?
Expected: The minimum monthly team total sales target is 15 units.
Required labels: ["doc:1:101"]; relevant chunks: ["101"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The minimum monthly team total sales target is 15 units. [S1]
grounded=true; response hash=cd854c19ab037a6ffda72aad75b587916bbfa5922012b2a86c12046fd3f5ebbb.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | team-policy.docx, document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |

### doc-02 — document

Question: How many paid vacation days does an Orion employee get each year?
Expected: The annual paid leave allowance is 20 days.
Required labels: ["doc:2:102"]; relevant chunks: ["102"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The annual paid leave allowance is 20 days. [S1]
grounded=true; response hash=67631c95a4ff61bca06eb45b9359243947920fe2a974e4fc1f245840a73dfc34.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | leave-policy.pdf, document 2, chunk 102 | Orion employees receive 20 days of annual paid leave per calendar year. |

### doc-03 — document

Question: How long after delivery can unopened equipment be sent back?
Expected: Unopened equipment may be returned within 30 days of delivery.
Required labels: ["doc:3:103"]; relevant chunks: ["103"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Unopened equipment may be returned within 30 days of delivery. [S1]
grounded=true; response hash=dd4b2b46c93f7a63981d0990cf6c89443311f4fffdd1609961d399104991ecf3.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | returns-policy.pdf, document 3, chunk 103 | Unopened equipment may be returned within 30 days of delivery. |

### doc-04 — document

Question: At what travel expense amount is manager sign-off required?
Expected: Travel expenses above 500 credits require manager approval.
Required labels: ["doc:4:104"]; relevant chunks: ["104"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Travel expenses above 500 credits require manager approval. [S1]
grounded=true; response hash=56135b91aa4157227c09a1b174b9a385a70fce297853418a3febad460ad5ca78.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | travel-policy.docx, document 4, chunk 104 | Travel expenses above 500 credits require manager approval. |

### doc-05 — document

Question: What is the acknowledgment deadline for a service incident?
Expected: A service incident must be acknowledged within 2 hours.
Required labels: ["doc:5:105"]; relevant chunks: ["105"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): A service incident must be acknowledged within 2 hours. [S1]
grounded=true; response hash=1dbee36f29bdfbb8a766fd8f082b82aa8f7908a6006328b2849bda7b09d2c1bf.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | incident-policy.docx, document 5, chunk 105 | A service incident must be acknowledged within 2 hours. |

### doc-06 — document

Question: Tell me the recorded approval status of ZX-2048.
Expected: Invoice ZX-2048 is approved for the Harbor project.
Required labels: ["doc:6:106"]; relevant chunks: ["106"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Invoice ZX-2048 is approved for the Harbor project. [S1]
grounded=true; response hash=0f5e2596b45a4c5da71e54e3a7c8b44885fa57875bf4dbe6715bb7fb3bf96672.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| S1 | invoice-register.pdf, document 6, chunk 106 | Invoice ZX-2048 is approved for the fictional Harbor project. |

### csv-01 — csv

Question: How many sales records are in sales.csv?
Expected: The sales record count is 5.
Required labels: ["csv:201"]; relevant chunks: [].
Expected calculation rows: [{"value":5}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The sales record count is 5. [C1]
grounded=true; response hash=7d72949ee59ffa978ef433dfe01aaf88c21ada47ec86df8c281d0c2482b2f145.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | sales.csv, dataset 201 | [{"value":5}] |
Independent CSV check C1: matches; computed rows: [{"value":5}].

### csv-02 — csv

Question: Add up all amounts in sales.csv.
Expected: The total sales amount is 51 units.
Required labels: ["csv:201"]; relevant chunks: [].
Expected calculation rows: [{"value":51}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The total sales amount is 51 units. [C1]
grounded=true; response hash=0dc7a4b6359b965e1996ba1f6823dcfeeae955015fb2da979fa77f3b31c77d95.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | sales.csv, dataset 201 | [{"value":51}] |
Independent CSV check C1: matches; computed rows: [{"value":51}].

### csv-03 — csv

Question: What is the average amount per sales record?
Expected: The average sales amount is 10.2 units.
Required labels: ["csv:201"]; relevant chunks: [].
Expected calculation rows: [{"value":10.2}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The average sales amount is 10.2 units. [C1]
grounded=true; response hash=c4eba85beef0f34a8f2504d3ea4071ab7cb2cc71a5dbc6b7fb143493458e58a2.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | sales.csv, dataset 201 | [{"value":10.2}] |
Independent CSV check C1: matches; computed rows: [{"value":10.2}].

### csv-04 — csv

Question: Show total sales for Alpha, Beta and Gamma, grouped by team.
Expected: Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units.
Required labels: ["csv:201"]; relevant chunks: [].
Expected calculation rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units. [C1]
grounded=true; response hash=59d804ad0f19323817dabf67e1689a25b48a3827576aaca89a338b5395c32009.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].

### csv-05 — csv

Question: List the East-region sales amounts, largest first.
Expected: East amounts in descending order are 20 and 10 units.
Required labels: ["csv:201"]; relevant chunks: [].
Expected calculation rows: [{"team":"Alpha","amount":20,"region":"East"},{"team":"Alpha","amount":10,"region":"East"}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): East amounts in descending order are 20 and 10 units. [C1]
grounded=true; response hash=d7fc9eaed109dc2fc7e608c1bd2264cb1938318a8ac7170009b092cfe1cdfc7a.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","amount":20,"region":"East"},{"team":"Alpha","amount":10,"region":"East"}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","amount":20,"region":"East"},{"team":"Alpha","amount":10,"region":"East"}].

### csv-06 — csv

Question: How many employees have expenses strictly above 500 credits?
Expected: The employee expense count above 500 credits is 1.
Required labels: ["csv:202"]; relevant chunks: [].
Expected calculation rows: [{"value":1}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): The employee expense count above 500 credits is 1. [C1]
grounded=true; response hash=b74c40ac93e04e7a901bb93d672cacec0cca7e0c5ea65fceaa9cde9b28dfd6a8.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| C1 | expenses.csv, dataset 202 | [{"value":1}] |
Independent CSV check C1: matches; computed rows: [{"value":1}].

### combined-01 — combined

Question: Compare team totals with the policy minimum. How far below is Beta?
Expected: Beta total is 6 units; the target is 15 units; Beta shortfall is 9 units.
Required labels: ["doc:1:101","csv:201"]; relevant chunks: ["101"].
Expected calculation rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Beta total is 6 units; the target is 15 units; Beta shortfall is 9 units. [D1] [C1]
grounded=true; response hash=b23dfc7456f047f71b456f551121a2f8e1ed2856768647b343bafa0d2ad50088.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | team-policy.docx, document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].

### combined-02 — combined

Question: Using the team policy and sales.csv, by how much does Alpha exceed the target?
Expected: Alpha total is 30 units; the target is 15 units; Alpha surplus is 15 units.
Required labels: ["doc:1:101","csv:201"]; relevant chunks: ["101"].
Expected calculation rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Alpha total is 30 units; the target is 15 units; Alpha surplus is 15 units. [D1] [C1]
grounded=true; response hash=a4e822b0f09525f2ea0f9df8eee1ec71f0f50793d62c443b167bedd1ff4fe5ee.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | team-policy.docx, document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].

### combined-03 — combined

Question: Does Gamma meet the minimum monthly team total exactly?
Expected: Gamma total is 15 units, exactly the target; Gamma difference is 0 units.
Required labels: ["doc:1:101","csv:201"]; relevant chunks: ["101"].
Expected calculation rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Gamma total is 15 units, exactly the target; Gamma difference is 0 units. [D1] [C1]
grounded=true; response hash=4d64410f890c6e2d10550133521a78ec3d5034649171ce732c5c7fbed41046fb.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | team-policy.docx, document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].

### combined-04 — combined

Question: According to the policy, which teams fall short when all sales rows are added per team?
Expected: Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target.
Required labels: ["doc:1:101","csv:201"]; relevant chunks: ["101"].
Expected calculation rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target. [D1] [C1]
grounded=true; response hash=c46fbbec2734691d9c2748dacf8c8798e6100b30f87c2c9a73a4ae76fd76bd49.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | team-policy.docx, document 1, chunk 101 | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv, dataset 201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |
Independent CSV check C1: matches; computed rows: [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}].

### combined-05 — combined

Question: Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?
Expected: Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval.
Required labels: ["doc:4:104","csv:202"]; relevant chunks: ["104"].
Expected calculation rows: [{"employee":"Mira","cost":450},{"employee":"Jon","cost":620},{"employee":"Sol","cost":500}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval. [D1] [C1]
grounded=true; response hash=6c357c1f9c0f169dba2e10c8f12ff9b4ac2c6ff97dce7aa97a9ee59b600739c5.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | travel-policy.docx, document 4, chunk 104 | Travel expenses above 500 credits require manager approval. |
| C1 | expenses.csv, dataset 202 | [{"employee":"Mira","cost":450},{"employee":"Jon","cost":620},{"employee":"Sol","cost":500}] |
Independent CSV check C1: matches; computed rows: [{"employee":"Mira","cost":450},{"employee":"Jon","cost":620},{"employee":"Sol","cost":500}].

### combined-06 — combined

Question: Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline?
Expected: INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline.
Required labels: ["doc:5:105","csv:203"]; relevant chunks: ["105"].
Expected calculation rows: [{"ticket":"INC-A","hours":1},{"ticket":"INC-B","hours":3},{"ticket":"INC-C","hours":2}].
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: free_text_entailment_units_conditions_and_completeness_require_human_review
Error categories: none; uncertain causes: none.
Actual response (scripted=true): INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline. [D1] [C1]
grounded=true; response hash=008cd0ed082156564b61e01653642eedd4fd8576024388d33762b5174e56e641.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| D1 | incident-policy.docx, document 5, chunk 105 | A service incident must be acknowledged within 2 hours. |
| C1 | incidents.csv, dataset 203 | [{"ticket":"INC-A","hours":1},{"ticket":"INC-B","hours":3},{"ticket":"INC-C","hours":2}] |
Independent CSV check C1: matches; computed rows: [{"ticket":"INC-A","hours":1},{"ticket":"INC-B","hours":3},{"ticket":"INC-C","hours":2}].

### missing-01 — insufficient

Question: What ocean research grants does Orion offer?
Expected: Abstain: the fixtures do not contain the requested facts.
Required labels: []; relevant chunks: [].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **pass**. Human: not-reviewed.
Reasons: Canonical missing-evidence refusal contract passed.
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough information in the retrieved documents to answer that question.
grounded=false; response hash=1c3f4b072fa4ee7ebaf15acdc5b655004467a02cb9f70f20801d6eee600bfc97.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### missing-02 — insufficient

Question: What were team sales last year? The provided sales data has no year column.
Expected: Abstain: the fixtures do not contain the requested facts.
Required labels: []; relevant chunks: [].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **pass**. Human: not-reviewed.
Reasons: Canonical missing-evidence refusal contract passed.
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough evidence from the available documents and datasets to answer that question.
grounded=false; response hash=59a16735bfbe4e68d886e590940b68788b417c8036698c61caea7b7be5d26d69.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### missing-03 — insufficient

Question: What is the average customer age in sales.csv?
Expected: Abstain: the fixtures do not contain the requested facts.
Required labels: []; relevant chunks: [].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **pass**. Human: not-reviewed.
Reasons: Canonical missing-evidence refusal contract passed.
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough evidence from the available documents and datasets to answer that question.
grounded=false; response hash=59a16735bfbe4e68d886e590940b68788b417c8036698c61caea7b7be5d26d69.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### missing-04 — insufficient

Question: What is Orion’s parental leave allowance?
Expected: Abstain: the fixtures do not contain the requested facts.
Required labels: []; relevant chunks: [].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **pass**. Human: not-reviewed.
Reasons: Canonical missing-evidence refusal contract passed.
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough information in the retrieved documents to answer that question.
grounded=false; response hash=1c3f4b072fa4ee7ebaf15acdc5b655004467a02cb9f70f20801d6eee600bfc97.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### conflict-01 — ambiguous

Question: Which minimum monthly target should we use when the two active Orion policies disagree?
Expected: Abstain or request clarification; do not silently select a policy or department.
Required labels: []; relevant chunks: ["101","107"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: conflict_or_ambiguity_requires_human_judgment
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough evidence from the available documents and datasets to answer that question.
grounded=false; response hash=59a16735bfbe4e68d886e590940b68788b417c8036698c61caea7b7be5d26d69.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### conflict-02 — ambiguous

Question: Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates?
Expected: Abstain or request clarification; do not silently select a policy or department.
Required labels: []; relevant chunks: ["101","107"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: conflict_or_ambiguity_requires_human_judgment
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough evidence from the available documents and datasets to answer that question.
grounded=false; response hash=59a16735bfbe4e68d886e590940b68788b417c8036698c61caea7b7be5d26d69.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

### ambiguous-01 — ambiguous

Question: What monthly team target applies to me? My department is not specified.
Expected: Abstain or request clarification; do not silently select a policy or department.
Required labels: []; relevant chunks: ["108"].
Expected calculation rows: null.
Automatic: **pass**. Final classification: **needs-review**. Human: not-reviewed.
Reasons: conflict_or_ambiguity_requires_human_judgment
Error categories: none; uncertain causes: none.
Actual response (scripted=true): I don't have enough evidence from the available documents and datasets to answer that question.
grounded=false; response hash=59a16735bfbe4e68d886e590940b68788b417c8036698c61caea7b7be5d26d69.

| Citation | Source identity | Reported supporting quotes |
| --- | --- | --- |
| none | none | none |

## Limitations

- Source identity/quote membership verifies provenance, not claim entailment. Document, numeric and CSV checks are independently visible in results.json. Semantic accuracy is deliberately unreported without completed human review.
- CSV oracle independently parses fictional rows and performs filters, aggregates, groups and sorting. It shares structural plan validation only; it never executes SQL. Unsorted row order is ignored, while sorted order, duplicates, nulls and numeric tolerance are checked. Original authored expected rows are also asserted before execution.
- Numeric extraction remains case-specific and incomplete. Missing extraction needs review; exact quotes can accompany false prose. Wrong units, negation, omitted conditions, unsupported extrapolation and incorrectly resolved conflicts require the rubric.
- Current backend returns source-level quotes rather than a machine-verifiable claim proof. Human reviewers must inspect local citation markers against claims and canonical fixtures.
- All data are fictional. Operator fixture identity is not a browser/session test. Existing isolation/security regressions cover application boundaries separately.
- Live mode is opt-in, one case by default, maximum three per invocation, 65 seconds between cases, at most 12 actual Groq HTTP attempts per run including existing retries. Existing provider pacing/timeouts remain unchanged. No runner retries or provider fallback. Multiple processes do not share this evaluation budget.
- Results remain probabilistic and small-sample. Error counts are framework diagnostics in mock mode, never model failure rates. Saved-result review makes no provider calls and does not repeat original stage measurements.
