# Six-case live Groq retest — before and after

**Real Groq responses, not mock output. No human semantic reviews have been submitted.**

Executed 6/6 selected cases once each. Provider: groq; model: `openai/gpt-oss-20b`. Run time: 29 October 2026, 16:42:31–16:49:40 Asia/Karachi (UTC+05:00), approximately 7 minutes 9 seconds. Raw UTC timestamps: 2026-10-29T11:42:31.845Z–2026-10-29T11:49:40.926Z.

Only the explicitly approved six original questions were selected. Original benchmark definitions and saved 25-case results remain unchanged. [Original report](../batch-03/report.md) and [remediation review](../../live-weakness-remediation.md). The current evaluator includes the documented conflict-02 supplemental-source correction.

## Actual usage and execution

- 24 actual HTTP attempts, within 54 approved; reported prompt tokens 26,464, completion tokens 1,929, total 28,393; unknown-usage attempts 1.
- 90,000-token planning ceiling; existing 12-RPM pacing; at least 65 seconds between cases. Multiple planning requests within an agent invocation are separate steps, not case retries. HTTP 429 is stopped by the existing evaluation guard before production transport can retry.
- Stop reason: none; returned responses 5.
- Automatic checks: 5 pass, 1 fail. Formal classification: 0 pass, 1 fail, 5 needs review. Human-reviewed: 0.
- Automatic pass is not semantic accuracy: it validates provenance, available numeric patterns and independent CSV result checks. A valid but unintended plan can pass those checks.

## Targeted verification — AI-assisted observations, not human ratings

| Case | Actual behavior compared with the requested check | Remaining issue |
| --- | --- | --- |
| csv-05 | No HTTP 400 this time. The plan filters region=East, but then groups by team and sums amount; answer is Alpha total 30. | **Does not meet the question.** Expected individual amounts 20 then 10. Sorting a one-row aggregate is not proof of correct descending row listing. Independent oracle confirms the unintended aggregate, not its relevance. A tool-validation error occurred and was recovered inside this invocation; no failed case was rerun. |
| conflict-01 | Changed from invented higher-target precedence to canonical abstention with no sources. | Observed unsafe precedence rule avoided. No explanation/clarification prose; semantic human review pending. |
| ambiguous-01 | Changed from assigning 15 personally to canonical abstention with no sources. | Observed unsupported personal applicability avoided; no department clarification prompt is returned by the current canonical refusal contract. |
| combined-04 | Still names only Beta, now without even stating the numeric target. The cited CSV contains Alpha=30, Beta=6 and Gamma=15. | **Completeness concern persists.** No explicit 15-unit target, Beta actual 6/shortfall 9 or remaining groups' compliance. Beta identification itself is correct; richer detail is the benchmark comparison requirement. |
| combined-05 | First planning request searched documents successfully; the second native request returned HTTP 400 with safe code tool_use_failed. No CSV query or final generation occurred. | **Execution failure.** The 120-credit excess cannot be verified. The safe code identifies a provider tool-use failure, but rejected arguments/raw failed generation were not retained; do not guess the exact invalid field. This new error does not establish the historical csv-05 error's exact cause. |
| conflict-02 | Changed from conditional comparisons to canonical abstention; did not choose a governing policy. | Safe non-selection observed, but **no two-policy explanation or conditional comparison** was delivered. The original benchmark permits abstention; the richer requested demonstration remains unverified. The evaluator allowlist correction cannot certify semantic correctness. |

These observations are made by the AI evaluator against actual saved answers and plans. They do not populate human-review fields or overwrite formal automatic classifications. In particular the automatic pass for csv-05 is not a semantic pass. There are two grounded returned answers, three abstentions and one execution error.

All three returned source records passed application citation verification: one CSV source for csv-05, and a policy plus CSV source for combined-04. Both returned CSV query results matched the independent oracle. Neither result proves the generated prose satisfies the entire question. The three abstentions contain no citations; the provider failure has no answer or citations.

First approved response headers reported request limit 1000/day with 999 remaining and token limit 8000/minute with 6147 remaining. Last response reported 976 requests and 5268 minute tokens remaining. No HTTP 429, 401, 403 or deadline failure occurred. Daily token balance remains unknown. No additional quota probe or unapproved request was made.

## Before/after measurements

| Case | Historical classification | Retest classification | Before answer time (s) | After answer time (s) | After requests | After tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| csv-05 | fail | needs-review | 10.61 | 25.72 | 6 | 6722 |
| conflict-01 | needs-review | needs-review | 10.68 | 10.68 | 3 | 3670 |
| ambiguous-01 | fail | needs-review | 10.90 | 10.71 | 3 | 3464 |
| combined-04 | needs-review | needs-review | 27.10 | 25.70 | 6 | 7989 |
| combined-05 | needs-review | fail | 25.71 | 5.58 | 2 | 922 |
| conflict-02 | fail | needs-review | 26.00 | 15.64 | 4 | 5626 |

Answer time is the application invocation, including provider pacing. Case total additionally includes fixture retrieval prechecks and setup inside the runner. Initial corpus embedding preparation and 65-second inter-case pauses are outside answer time. Single before/after samples do not establish a performance improvement. Stage durations overlap and must not be added as independent costs.

## Actual questions, answers and evidence

### csv-05

Question: List the East-region sales amounts, largest first.
Expected: East amounts in descending order are 20 and 10 units.
Original required labels: ["csv:201"]; relevant chunks: [].

Before answer: No answer returned.
Before safe error: {"category": "other", "errorType": "AI_APICallError", "httpStatus": 400}

After answer: East-region sales totals, sorted largest first: Alpha – 30 [C1]
After safe error: null
Automatic classification: pass; final: needs-review; human: not-reviewed.
Automatic reasons/uncertainty: ["unregistered_valid_query_plan_requires_review", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Answer latency: 25.72 s; case latency: 25.91 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| C1 | sales.csv; dataset=201 | [{"team":"Alpha","value":30}] |

CSV plan: `{"datasetId": "201", "filters": [{"column": "region", "op": "eq", "value": "East"}], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "sort": {"column": "value", "direction": "desc"}, "limit": 100}`
CSV rows: `[{"team": "Alpha", "value": 30}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}]}].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 20713.2 |
| planning-groq | 20633.1 |
| groq-pacing | 21894.2 |
| groq-http | 3594.9 |
| postgres | 11.7 |
| csv-query | 10.3 |
| tool | 37.6 |
| final-generation | 4991.2 |
| citation-verification | 11.2 |

### conflict-01

Question: Which minimum monthly target should we use when the two active Orion policies disagree?
Expected: Abstain or request clarification; do not silently select a policy or department.
Original required labels: []; relevant chunks: ["101", "107"].

Before answer: When Orion’s team policies conflict, the higher minimum monthly target applies, so the team should use a target of 22 units per month. [D1] [D2]
Before safe error: null

After answer: I don't have enough evidence from the available documents and datasets to answer that question.
After safe error: null
Automatic classification: pass; final: needs-review; human: not-reviewed.
Automatic reasons/uncertainty: ["conflict_or_ambiguity_requires_human_judgment"].
Answer latency: 10.68 s; case latency: 10.88 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 6295.9 |
| planning-groq | 6235.9 |
| groq-pacing | 7871.1 |
| groq-http | 2651.9 |
| embedding | 126.1 |
| retrieval | 163.2 |
| postgres | 35.3 |
| tool | 35.5 |
| final-generation | 4376.1 |
| citation-verification | 2.5 |

### ambiguous-01

Question: What monthly team target applies to me? My department is not specified.
Expected: Abstain or request clarification; do not silently select a policy or department.
Original required labels: []; relevant chunks: ["108"].

Before answer: You are subject to the minimum monthly team sales target of 15 units, as defined by the Orion team policy. [D2]
Before safe error: null

After answer: I don't have enough evidence from the available documents and datasets to answer that question.
After safe error: null
Automatic classification: pass; final: needs-review; human: not-reviewed.
Automatic reasons/uncertainty: ["conflict_or_ambiguity_requires_human_judgment"].
Answer latency: 10.71 s; case latency: 11.00 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 5889.6 |
| planning-groq | 5820.2 |
| groq-pacing | 7510.4 |
| groq-http | 3015.0 |
| embedding | 154.0 |
| retrieval | 172.6 |
| postgres | 16.0 |
| tool | 25.3 |
| final-generation | 4806.7 |
| citation-verification | 3.7 |

### combined-04

Question: According to the policy, which teams fall short when all sales rows are added per team?
Expected: Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target.
Original required labels: ["doc:1:101", "csv:201"]; relevant chunks: ["101"].

Before answer: Team Beta falls short of the monthly total sales target of 15 units. [D1] [C1]
Before safe error: null

After answer: Beta team falls short of the policy’s minimum monthly total sales target. [D1] [C1]
After safe error: null
Automatic classification: pass; final: needs-review; human: not-reviewed.
Automatic reasons/uncertainty: ["unregistered_valid_query_plan_requires_review", "numeric_fact_not_reliably_extractable", "free_text_entailment_units_conditions_and_completeness_require_human_review"].
Answer latency: 25.70 s; case latency: 25.90 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| D1 | team-policy.docx; document=1; chunk=101; index=0; page=None | Orion team policy: the minimum monthly total sales target for each team is 15 units. |
| C1 | sales.csv; dataset=201 | [{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}] |

CSV plan: `{"datasetId": "201", "filters": [], "groupBy": ["team"], "aggregate": {"op": "sum", "column": "amount"}, "limit": 100}`
CSV rows: `[{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]`

Independent CSV checks: [{"sourceId": "C1", "matches": true, "expectedRows": [{"team": "Alpha", "value": 30}, {"team": "Beta", "value": 6}, {"team": "Gamma", "value": 15}]}].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 20955.0 |
| planning-groq | 20832.1 |
| groq-pacing | 21135.6 |
| groq-http | 4334.7 |
| embedding | 145.8 |
| retrieval | 160.1 |
| postgres | 19.7 |
| csv-query | 3.4 |
| tool | 76.7 |
| final-generation | 4738.0 |
| citation-verification | 4.8 |

### combined-05

Question: Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?
Expected: Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval.
Original required labels: ["doc:4:104", "csv:202"]; relevant chunks: ["104"].

Before answer: Jon’s travel expense of 620 credits exceeds the 500‑credit limit and therefore requires manager approval by the travel policy. [D1] [C1]
Before safe error: null

After answer: No answer returned.
After safe error: {"category": "other", "providerCode": "tool_use_failed", "errorType": "AI_APICallError", "httpStatus": 400}
Automatic classification: fail; final: fail; human: not-reviewed.
Automatic reasons/uncertainty: [].
Answer latency: 5.58 s; case latency: 5.79 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 5580.6 |
| planning-groq | 589.3 |
| groq-pacing | 4371.8 |
| groq-http | 1066.3 |
| embedding | 171.7 |
| retrieval | 183.9 |
| postgres | 10.6 |
| tool | 35.8 |

### conflict-02

Question: Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates?
Expected: Abstain or request clarification; do not silently select a policy or department.
Original required labels: []; relevant chunks: ["101", "107"].

Before answer: The team Alpha’s total monthly sales of 30 units exceed both the 15‑unit and 22‑unit minimum targets, so it meets both policies. [C1] [D1] [D2]<br><br>The team Gamma’s total monthly sales of 15 units meet the 15‑unit minimum target but fall short of the 22‑unit target, so it does not satisfy the higher policy. [C1] [D1] [D2]<br><br>The team Beta’s total monthly sales of 6 units fall below both the 15‑unit and 22‑unit minimum targets, so it fails to meet either policy. [C1] [D1] [D2]
Before safe error: null

After answer: I don't have enough evidence from the available documents and datasets to answer that question.
After safe error: null
Automatic classification: pass; final: needs-review; human: not-reviewed.
Automatic reasons/uncertainty: ["conflict_or_ambiguity_requires_human_judgment"].
Answer latency: 15.64 s; case latency: 15.84 s.

| Citation | Source identity | Exact supporting excerpts |
| --- | --- | --- |
| none | none | none |

Independent CSV checks: [].

| Measured stage (nested/overlapping) | Total recorded ms |
| --- | ---: |
| planning-wall | 10818.3 |
| planning-groq | 10696.6 |
| groq-pacing | 12669.3 |
| groq-http | 2734.6 |
| embedding | 203.4 |
| retrieval | 222.2 |
| postgres | 16.6 |
| tool | 97.1 |
| final-generation | 4811.8 |
| citation-verification | 4.3 |

## Isolation and limitations

Source/history fingerprint comparison: True. Public users/documents/chunks/datasets/CSV rows aggregate fingerprints unchanged: True.
- Existing fixture helper uses transaction-scoped TEMP tables with explicit IDs, including unauthorized/deleted/non-ready decoys, then rollback. No existing user records, stored files or database sequences are modified. This exercises backend operator fixture identity, not browser login/session or CSRF.
- Model and credentials were not changed. Only selected fictional fixture evidence was sent. Native request payloads and provider raw errors are not published.
- All available token usage is provider-reported. It is not proof of exact billed or quota-counted usage. Current daily token allowance is not exposed by the observed response headers.
- This is one stochastic retest per case; no failed case was retried. Human reviewers must still apply the bound review template and inspect each claim against evidence.
- Detailed raw before/after responses, source metadata, per-request usage, safe errors, stage timings and automatic judgments are in [results.json](results.json). Quota headers are in [quota-observations.json](quota-observations.json); human review slots are in [review-template.json](review-template.json).

## Post-evaluation regression checks

| Command/check | Actual result |
| --- | --- |
| `npm test` | 239 registered; 230 passed, 9 optional database skips, 0 failed |
| `npm run test:fresh-db` | 239 passed, 0 skipped, 0 failed; disposable cluster removed; zero live provider calls |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| Repository secret scan, documentation links and `git diff --check` | Passed; no secret findings |

No production build was repeated for this evaluation-only task; application code was unchanged. These regression results do not override the live failures above. No files were staged, committed or pushed.
