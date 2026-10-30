# Live benchmark batch 02 — completed

Prepared 28 October 2026. **The user explicitly approved this batch, and all five cases executed once.** Actual answers/citations/timings and the conflict finding are in [report.md](report.md), [results.json](results.json) and [cumulative-results.json](cumulative-results.json). The original 25 questions are unchanged. Three completed pilot cases are excluded: doc-01, csv-01 and combined-01.

## Approved original cases

| Original ID | Unchanged question | Expected result |
| --- | --- | --- |
| doc-02 | How many paid vacation days does an Orion employee get each year? | 20 days of annual paid leave; leave-policy.pdf chunk 102 |
| csv-02 | Add up all amounts in sales.csv. | 51 units; owned dataset 201 with SUM(amount) evidence |
| combined-02 | Using the team policy and sales.csv, by how much does Alpha exceed the target? | Alpha total 30; target 15; surplus 15; both policy and CSV evidence |
| missing-01 | What ocean research grants does Orion offer? | Abstain; fictional evidence does not contain these facts |
| conflict-01 | Which minimum monthly target should we use when the two active Orion policies disagree? | Abstain or clarify; do not silently choose between active targets 15 and 22 |

[plan.json](plan.json) preserves the original full case definitions, fixture hash, proposed bounds and SHA-256 fingerprints of existing pilot artifacts. These fixture sets passed the prior 25-case isolated PostgreSQL/BGE preflight; no duplicate benchmark or embedding run was necessary during this preparation.

## Approval and limits

- Existing provider/model: Groq / openai/gpt-oss-20b; no model, credential or application configuration changes.
- Maximum native HTTP attempts: **29**: two RAG cases at one attempt each, three agent cases at up to eight planning calls plus one generation call each. No failed request or case is automatically retried.
- Planning estimate: **15,000–35,000 total prompt/completion tokens**, informed by pilot results (841 document; 5,350 CSV; 7,034 combined). Different questions, conflict handling and model choices can change usage. This is not measured consumption or a guaranteed quota charge.
- Conservative token planning allowance: **60,000**. Existing guard uses returned usage and a request-byte/output-cap estimate, not an exact tokenizer/billing guarantee.
- Existing 12-RPM pacing and application deadlines; minimum 65 seconds between cases. Stop the batch on 401/403/429 or exhausted approval budget. Do not lengthen agent deadlines or issue extra quota probes.
- [Groq published limits](https://console.groq.com/docs/rate-limits), checked during preparation: free-plan 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD for this model. Exact organization/remaining limits and other applications' usage are unknown. Prior pilot's 13,225 reported tokens are historical usage, not proof of current available allowance. RPM pacing alone does not guarantee token quota availability.

Only local configuration was inspected; no authenticated Groq quota/API call occurred. Provider response restrictions stop execution rather than trigger retries. If a token/minute constraint cannot be accommodated within the unchanged application deadline, record the failure and do not retry it automatically.

## Preservation and execution

Evaluation-only supervisor supports the explicit `batch-02` scope and checks the saved fixture hash/completed-case inventory before starting. It refuses any selected already-executed case. Existing pilot manifests/results are not rewritten. New private output goes under `.evaluation-results/final-live/batch-02`; new public reports belong in this directory. Existing-manifest refusal prevents accidental repeated execution/overwrite.

The intended post-approval invocation is `node --conditions=react-server --import tsx evaluation/final-live-run.ts batch-02 --approved`; **do not run it until the owner explicitly approves these cases and bounds**. A preparation plan or command example is not approval.

Fixtures remain temporary PostgreSQL tables with explicit fictional identities, rollback and existing owner checks. No existing user, document, dataset or sequence is modified. Application/session/CSRF/model/citation code is unchanged. Operator fixture scope is not an authenticated browser replay.

For each attempted case retain its actual answer, source identities/quotes, independent CSV check, latency/stage observations, numeric usage and safe failure classification. Report human review separately; do not fill in a human identity or semantic rating without an actual decision. Unexecuted cases stay not run.

If all five execute, cumulative benchmark coverage becomes **8/25**, with **17 remaining**; it does not become a complete benchmark. The preparation started at 3/25. Actual cumulative coverage is now **8/25**, with **17 remaining**. No additional case/retest is authorized by the unused budget.


## Actual outcome

Batch 02: five executed; 16 native HTTP attempts; 16,319 reported tokens (15,222 prompt, 1,097 completion); no unknown usage or provider failures/retries. Automatic checks passed for five. Formal evaluator outcomes: **1 pass (canonical missing-information contract), 0 fail, 4 needs-review; human-reviewed 0**. The conflict answer asserts an unsupported higher-target-wins rule; that AI-assisted semantic finding is separate from formal/human labels and must not be hidden by the automatic-pass count.

Cumulative: eight original cases executed, 17 not run, 29 HTTP attempts and 29,544 reported tokens; 1 pass/0 fail/7 needs-review; zero human reviews. The pilot preservation fingerprints all match. The original full-run plan is not blanket approval for another batch.
