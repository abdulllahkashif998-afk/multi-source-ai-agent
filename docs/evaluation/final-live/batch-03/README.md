# Remaining seventeen live cases — executed

Prepared 28 October 2026. **The user explicitly approved this run, and all seventeen cases were executed once.** [Actual report](report.md), [new-run results](results.json), [all 25 cumulative results](cumulative-results.json), [quota observations](quota-observations.json) and [all-response human review template](all-review-template.json) are saved separately from previous runs. Eight previous executions and the conflict-01 finding are preserved.

## Exact original cases

| ID | Original question | Expected answer |
| --- | --- | --- |
| doc-03 | How long after delivery can unopened equipment be sent back? | Unopened equipment may be returned within 30 days of delivery. |
| doc-04 | At what travel expense amount is manager sign-off required? | Travel expenses above 500 credits require manager approval. |
| doc-05 | What is the acknowledgment deadline for a service incident? | A service incident must be acknowledged within 2 hours. |
| doc-06 | Tell me the recorded approval status of ZX-2048. | Invoice ZX-2048 is approved for the Harbor project. |
| csv-03 | What is the average amount per sales record? | The average sales amount is 10.2 units. |
| csv-04 | Show total sales for Alpha, Beta and Gamma, grouped by team. | Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units. |
| csv-05 | List the East-region sales amounts, largest first. | East amounts in descending order are 20 and 10 units. |
| csv-06 | How many employees have expenses strictly above 500 credits? | The employee expense count above 500 credits is 1. |
| combined-03 | Does Gamma meet the minimum monthly team total exactly? | Gamma total is 15 units, exactly the target; Gamma difference is 0 units. |
| combined-04 | According to the policy, which teams fall short when all sales rows are added per team? | Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target. |
| combined-05 | Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded? | Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval. |
| combined-06 | Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline? | INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline. |
| missing-02 | What were team sales last year? The provided sales data has no year column. | Abstain: the fixtures do not contain the requested facts. |
| missing-03 | What is the average customer age in sales.csv? | Abstain: the fixtures do not contain the requested facts. |
| missing-04 | What is Orion’s parental leave allowance? | Abstain: the fixtures do not contain the requested facts. |
| conflict-02 | Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates? | Abstain or request clarification; do not silently select a policy or department. |
| ambiguous-01 | What monthly team target applies to me? My department is not specified. | Abstain or request clarification; do not silently select a policy or department. |

## Environment and quota

[Read-only preflight](preflight.json) verified PostgreSQL 18.6, pgvector 0.8.1, required fixture tables/TEMP privilege and a real local BGE response with 768 dimensions. Existing Groq configuration remains openai/gpt-oss-20b at 12 RPM. The original fixture hash matches; no benchmark or application settings changed. No Groq request was used for preflight.

The user confirmed that available account quota is unknown and authorized using headers from the first approved case, not a separate quota probe. Groq publishes free-plan limits of 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD for this model, but actual organization limits can differ. See [official limits](https://console.groq.com/docs/rate-limits). Numeric response headers expose RPD/remaining requests and TPM/remaining minute tokens; they do not establish remaining daily tokens. Prior reported benchmark usage of 29,544 tokens is not proof of current daily quota availability. No exact remaining daily allowance is claimed.

## Approved bounds

- Exactly 17 selected IDs above, each once. Exclude all eight completed IDs, including conflict-01.
- Maximum **113 native HTTP attempts**: five RAG cases at one each and twelve agent cases at up to eight planning plus one generation call each.
- Estimated reported usage **50,000–150,000 tokens**, based on previous small runs; proposed conservative planning allowance **160,000 tokens**. Existing guard uses returned usage and conservative request-byte/output-cap estimates, not a provider tokenizer/billing guarantee.
- Preserve the existing model, credential, 12-RPM pacing and all application deadlines. Minimum 65 seconds between cases; serial execution. Expected duration roughly 20–35 minutes if quota and deadlines permit.
- No automatic retry. Stop on quota/access denial, exhausted approval budget, reported exhausted request/minute-token quota, case timeout/cancellation, setup failure or harness deadline. Save completed/attempted observations; leave unexecuted cases explicitly not run.
- Record permitted numeric rate-limit headers on the first and subsequent approved requests. No extra account API request or dashboard access occurs. Organization-wide use by other processes remains unknown.

## Preservation and reporting

[plan.json](plan.json) binds the exact unchanged questions/expected facts, excludes eight completed cases, and fingerprints 77 existing public/private evaluation artifacts plus the current application source tree. Prior outputs and conflict-01 are not overwritten. New private checkpoint/results go under `.evaluation-results/final-live/batch-03`, with separate per-case files and HTTP ledgers. A pre-existing run checkpoint prevents accidental repeated execution.

Evaluation-only runner scope: `remaining-17`. Intended post-approval command: `node --conditions=react-server --import tsx evaluation/final-live-run.ts remaining-17 --approved`. Do not execute before the owner explicitly approves these bounds. The command example/plan itself is not approval.

Publish actual answers, citations, independent CSV/calculation checks, latencies, safe errors, unsupported-claim findings and cumulative coverage in this directory after execution. Automatic provenance success is not semantic correctness. Human review remains unreviewed until an actual person supplies response-bound decisions. Preserve the unsupported conflict-01 precedence finding separately from formal evaluator outcomes.

At preparation time coverage was 8/25. It is now 25/25 executed, zero unexecuted; formal outcomes 4 canonical-refusal passes/3 fails/18 needs-review, with zero human reviews. Application/fixture question definitions, credentials, existing user records and Git history are unchanged by preparation.


## Actual completion summary

This run: **17 executed; 66 HTTP attempts; 67,896 reported tokens** (63,631 prompt, 4,265 completion), with one failed HTTP 400 request lacking usage data. Formal outcomes: 3 canonical-refusal passes/3 fails/11 needs-review. No automatic retries, quota/access denial or deadline stop occurred. All seventeen have checkpoints; failed cases were not repeated.

Cumulative across the three approved runs: **25/25 original cases executed**, 24 returned structured responses, one provider failure with no final answer; **95 HTTP attempts / 97,440 known reported tokens**, plus unknown usage for that one failed request. Automatic checks: 22 pass/3 fail. Formal evaluator: 4 pass/3 fail/18 needs-review. Human-reviewed: zero.

Execution coverage is complete, not semantic quality sign-off. Preserve the conflict-01 unsupported precedence rule; ambiguous-01 assigned 15 despite unknown department, combined-05 omitted the requested 120 excess, csv-05 failed during provider planning, and conflict-02's raw citation failure has an expected-source whitelist limitation. All findings, caveats and actual source evidence are in the report; no labels were rewritten to force a pass.
