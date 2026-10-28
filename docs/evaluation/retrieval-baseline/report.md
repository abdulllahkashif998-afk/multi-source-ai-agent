# AI evaluation report

**REAL RETRIEVAL ONLY — no LLM answer accuracy was measured.**

Mode: retrieval; fixture hash: 898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec; K=3.
Provider/model: not called / not called.
Questions, expected answers and source labels: [fixture catalog](fixtures.json).
Generated: 2026-10-27T15:53:30.162Z. Setup: 1904.2 ms. Interrupted: false.

## Counts

Planned: 19; executed: 19; not run: 0.
Pass: 0; fail: 0; needs review: 19; automatic checks passed: 0.
Failure rate: 0; timeout rate: 0.

## Category breakdown

| Category | Executed | Pass | Fail | Needs review |
| --- | ---: | ---: | ---: | ---: |
| document | 6 | 0 | 0 | 6 |
| csv | 0 | 0 | 0 | 0 |
| combined | 6 | 0 | 0 | 6 |
| insufficient | 4 | 0 | 0 | 4 |
| ambiguous | 3 | 0 | 0 | 3 |

## Retrieval

| Mode | Recall@K macro | Precision@K macro | Eligible queries |
| --- | ---: | ---: | ---: |
| semantic | 1 | 0.3777777777777778 | 15 |
| hybrid | 1 | 0.3777777777777778 | 15 |

## Deterministic answer checks

Numeric bindings: 0 checked, 0 correct, 0 incorrect, 0 unscored. Accuracy on extracted bindings only: N/A.
Canonical refusal contract: 0 of 7; rate 0.

## Latency

Nearest-rank percentiles, milliseconds. Missing observations are N/A, not zero.

All case work includes fixture setup and retrieval diagnostics. Answer workflow excludes them. Stage observations overlap and may include multiple calls per case.

| Scope / stage | Samples | Min | P50 | P95 | Max | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All case work | 19 | 179.81 | 272.17 | 641.50 | 641.50 | 321.31 |
| Answer workflow | 0 | N/A | N/A | N/A | N/A | N/A |
| embedding | 38 | 58.00 | 89.50 | 254.20 | 287.80 | 114.02 |
| postgres | 38 | 2.20 | 5.80 | 15.90 | 25.90 | 6.67 |
| retrieval | 38 | 61.20 | 98.80 | 261.40 | 292.60 | 121.23 |

## Per-case results and analysis

| Case | Status | Automatic checks | Recall semantic / hybrid | Reasons / review |
| --- | --- | --- | --- | --- |
| doc-01 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| doc-02 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| doc-03 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| doc-04 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| doc-05 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| doc-06 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-01 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-02 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-03 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-04 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-05 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| combined-06 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| missing-01 | needs-review | N/A | semantic: N/A; hybrid: N/A | answer_not_evaluated |
| missing-02 | needs-review | N/A | semantic: N/A; hybrid: N/A | answer_not_evaluated |
| missing-03 | needs-review | N/A | semantic: N/A; hybrid: N/A | answer_not_evaluated |
| missing-04 | needs-review | N/A | semantic: N/A; hybrid: N/A | answer_not_evaluated |
| conflict-01 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| conflict-02 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |
| ambiguous-01 | needs-review | N/A | semantic: 1; hybrid: 1 | answer_not_evaluated |

## Failed-case analysis

No executed case failed. Needs-review cases remain unresolved; this does not establish semantic accuracy.

## Answers for manual review


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
