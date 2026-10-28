# AI evaluation report

**SCRIPTED MOCK — these are framework checks, NOT real AI or retrieval quality results.**

Mode: mock; fixture hash: 898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec; K=3.
Provider/model: not called / not called.
Questions, expected answers and source labels: [fixture catalog](fixtures.json).
Generated: 2026-10-27T15:55:29.440Z. Setup: 0.0 ms. Interrupted: false.

## Counts

Planned: 25; executed: 25; not run: 0.
Pass: 4; fail: 0; needs review: 21; automatic checks passed: 25.
Failure rate: 0; timeout rate: 0.

## Category breakdown

| Category | Executed | Pass | Fail | Needs review |
| --- | ---: | ---: | ---: | ---: |
| document | 6 | 0 | 0 | 6 |
| csv | 6 | 0 | 0 | 6 |
| combined | 6 | 0 | 0 | 6 |
| insufficient | 4 | 4 | 0 | 0 |
| ambiguous | 3 | 0 | 0 | 3 |

## Retrieval

| Mode | Recall@K macro | Precision@K macro | Eligible queries |
| --- | ---: | ---: | ---: |
| semantic | 1 | 0.3777777777777778 | 15 |
| hybrid | 1 | 0.3777777777777778 | 15 |

## Deterministic answer checks

Numeric bindings: 23 checked, 23 correct, 0 incorrect, 0 unscored. Accuracy on extracted bindings only: 1.
Canonical refusal contract: 7 of 7; rate 1.

## Latency

Nearest-rank percentiles, milliseconds. Missing observations are N/A, not zero.

All case work includes fixture setup and retrieval diagnostics. Answer workflow excludes them. Stage observations overlap and may include multiple calls per case.

| Scope / stage | Samples | Min | P50 | P95 | Max | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All case work | 25 | 0.09 | 3.88 | 14.31 | 29.74 | 4.76 |
| Answer workflow | 25 | 0.03 | 2.46 | 11.01 | 12.67 | 2.74 |
| answer-end-to-end | 25 | 0.03 | 2.46 | 11.01 | 12.67 | 2.74 |

## Per-case results and analysis

| Case | Status | Automatic checks | Recall semantic / hybrid | Reasons / review |
| --- | --- | --- | --- | --- |
| doc-01 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| doc-02 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| doc-03 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| doc-04 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| doc-05 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| doc-06 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-01 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-02 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-03 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-04 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-05 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| csv-06 | needs-review | pass | N/A | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-01 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-02 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-03 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-04 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-05 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| combined-06 | needs-review | pass | semantic: 1; hybrid: 1 | free_text_entailment_units_conditions_and_completeness_require_human_review |
| missing-01 | pass | pass | semantic: N/A; hybrid: N/A |  |
| missing-02 | pass | pass | semantic: N/A; hybrid: N/A |  |
| missing-03 | pass | pass | semantic: N/A; hybrid: N/A |  |
| missing-04 | pass | pass | semantic: N/A; hybrid: N/A |  |
| conflict-01 | needs-review | pass | semantic: 1; hybrid: 1 | conflict_or_ambiguity_requires_human_judgment |
| conflict-02 | needs-review | pass | semantic: 1; hybrid: 1 | conflict_or_ambiguity_requires_human_judgment |
| ambiguous-01 | needs-review | pass | semantic: 1; hybrid: 1 | conflict_or_ambiguity_requires_human_judgment |

## Failed-case analysis

No executed case failed. Needs-review cases remain unresolved; this does not establish semantic accuracy.

## Answers for manual review

- doc-01: The minimum monthly team total sales target is 15 units. &#91;S1]
- doc-02: The annual paid leave allowance is 20 days. &#91;S1]
- doc-03: Unopened equipment may be returned within 30 days of delivery. &#91;S1]
- doc-04: Travel expenses above 500 credits require manager approval. &#91;S1]
- doc-05: A service incident must be acknowledged within 2 hours. &#91;S1]
- doc-06: Invoice ZX-2048 is approved for the Harbor project. &#91;S1]
- csv-01: The sales record count is 5. &#91;C1]
- csv-02: The total sales amount is 51 units. &#91;C1]
- csv-03: The average sales amount is 10.2 units. &#91;C1]
- csv-04: Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units. &#91;C1]
- csv-05: East amounts in descending order are 20 and 10 units. &#91;C1]
- csv-06: The employee expense count above 500 credits is 1. &#91;C1]
- combined-01: Beta total is 6 units; the target is 15 units; Beta shortfall is 9 units. &#91;D1] &#91;C1]
- combined-02: Alpha total is 30 units; the target is 15 units; Alpha surplus is 15 units. &#91;D1] &#91;C1]
- combined-03: Gamma total is 15 units, exactly the target; Gamma difference is 0 units. &#91;D1] &#91;C1]
- combined-04: Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target. &#91;D1] &#91;C1]
- combined-05: Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval. &#91;D1] &#91;C1]
- combined-06: INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline. &#91;D1] &#91;C1]
- missing-01: I don't have enough information in the retrieved documents to answer that question.
- missing-02: I don't have enough evidence from the available documents and datasets to answer that question.
- missing-03: I don't have enough evidence from the available documents and datasets to answer that question.
- missing-04: I don't have enough information in the retrieved documents to answer that question.
- conflict-01: I don't have enough evidence from the available documents and datasets to answer that question.
- conflict-02: I don't have enough evidence from the available documents and datasets to answer that question.
- ambiguous-01: I don't have enough evidence from the available documents and datasets to answer that question.

## Definitions and limitations

- Recall@K = unique relevant chunks in the first K ranked slots / all labelled relevant chunks. Precision@K uses K as denominator, including unfilled slots. Duplicate IDs cannot inflate hits. Queries with no labelled relevant chunks are excluded from both macro averages. CSV-only cases have no document-retrieval labels.
- Citation precision = unique cited source identities that are expected / unique cited identities. Source recall = expected identities cited / expected identities. Quote validity checks exact membership against the canonical fictional document or serialized CSV evidence, not just the answer text.
- Known structured query plans have an independent fixed expected row set. Other valid plans require review. Query shape validation alone does not prove row truth.
- Numbers are extracted using labelled, case-specific patterns and compared with declared absolute tolerances. A missing or unfamiliar phrasing needs review; a detected incorrect value fails. These patterns do NOT establish semantic entailment, units, negation, conditions or completeness.
- All answerable free-text cases need human semantic review even if automatic checks pass. Ambiguity/conflict handling also needs review, including sourced explanations/clarification; grounded=true alone does not establish whether a policy was silently chosen. Canonical backend abstentions can pass the refusal contract on explicit missing-evidence cases.
- Failure rate includes execution errors and failed deterministic checks; timeout rate counts safely classified timeout errors. Both divide by executed cases. Not-run cases are never counted as passed.
- Stage timings overlap and must not be summed. Database fixture setup and cached corpus embedding time are separate from answer-only latency.
- Mock mode scripts rankings, tool choices and outputs from authored fixtures; it measures no real model quality. Retrieval mode uses real BGE/PostgreSQL. Live mode is probabilistic and opt-in, with no automatic provider fallback or runner retries.
- This operator-only runner uses a trusted fixture identity, not browser authentication. Application session/authorization regression tests remain separate. Temporary-table/savepoint isolation does not benchmark production transaction concurrency, index performance or ingestion/parsing.
- Small fictional corpus results do not establish production-wide quality. See README for execution, privacy, sampling and live-quota guidance.
