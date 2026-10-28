> Historical Day 6 investigation. Day 7 Phase 4 replaces the development-only log files and adds provider pacing/retries; see [current reliability controls](day-7-reliability.md).

# Day 6 reliability and latency investigation

The historical single-line warning did not contain a tool name or request ID. It cannot prove which attempt failed or that a specific tool retried successfully. A 200 response alone only proves that the request completed, including possible abstention.

## Reproduction and root causes

Instrumented real HTTP tests reproduced the same generic Error warning. It came from queryDataset during plan validation: `Sort must use group or value`. The model supplied an invalid aggregate sort. The validator correctly rejected it before SQL execution, but the tool returned a generic error, hiding the corrective action from the model. The reproduced failing request reached its existing 30-second planning timeout before recovery. This is evidence of a reproducible cause of the warning, not proof of the precise cause of the older uncorrelated log.

A second baseline combined request abstained despite completing. Baseline missing-information requests took 24.2 seconds and timed out at 30 seconds. Completed Gemini planning calls alone took up to about 10 seconds apiece. Retrieval/discovery were measured in milliseconds. The observed high latency is dominated by successive Gemini calls, including recovery/continued exploration, rather than PostgreSQL or citation validation.

Repeated tests also uncovered a semantic error: the agent selected individual sales rows below 15 and described them as team totals. Its recorded plan filtered amount < 15 without grouping. That incorrectly identified Alpha/10 as failing, although Alpha's actual total is 30. Exact citations correctly matched the returned rows but did not establish the total. This demonstrated the existing distinction between provenance and correct reasoning.

Google also returned HTTP 429 during repeated live testing. This is a separate provider rate/quota condition, now clearly recorded as such. No automatic retries were added.

## Small changes

- The existing sort schema now describes that aggregate sorts use `value` or a groupBy column. The validation rules and SQL service are unchanged.
- Only the recognized aggregate-sort validation failure returns a specific, safe corrective instruction. Unknown failures retain generic messages; unauthorized datasets remain inaccessible.
- Planning and answer instructions now explicitly require unfiltered grouped sums for policy thresholds on team totals, explain that row filters precede aggregation, and require abstention when filtered individual rows cannot establish totals.
- Per-request development timing records identify Gemini planning calls, planning wall time, tools and their outcomes, document retrieval, dataset discovery, CSV querying, final generation, and citation verification. Errors carry allowlisted tool names, reasons and request IDs. Records also identify a failed tool followed by a successful call to that same tool as recoveredTools.

No raw error messages, questions, arguments, data, credentials, URLs or provider bodies are logged. Tool names, reasons and error types are allowlisted. Logs are development-only: `.next/dev/logs/agent-timings.jsonl` and `agent-diagnostics.jsonl`, plus the console. Tool-validation timing records identify classification; the surrounding tool event measures the full attempt. Retrieval includes the existing embedding and pgvector search. CSV-query includes transaction setup, ownership lookup and SQL execution. Gemini-call timings exclude backend tool execution; planning wall includes it. Parallel spans can overlap and should not be added as if sequential.

Timeouts (30 seconds per generation call, 60 seconds shared request), tool budgets, ownership checks, structured query validation, read-only transactions and exact citation checks are unchanged. No data or schema was modified.

## Final repeated live results

The locally inspected fixtures contain a fictional 15-unit target and Alpha sales of 10+20, Beta sales of 6. These were read without changing them.

All times below are server-side milliseconds, rounded. HTTP includes small additional framework overhead.

| Run | Result | Total | Planning wall | Gemini planning | Retrieval | CSV query | Discovery | Final generation | Citations |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined 1 | 200, Beta failed by 9, both source types | 11,393 | 4,623 | 4,477 | 92 | 34 | 40 | 6,768 | <1 |
| Missing 1 | 200, grounded=false, no sources | 12,006 | 10,448 | 10,217 | 180 | — | 8 | 1,554 | <1 |
| Combined 2 | 200, Beta failed by 9, both source types | 19,406 | 17,966 | 17,854 | 37 | 30 | 4 | 1,439 | <1 |
| Missing 2 | 502 AGENT_FAILED, upstream 429 | 381 | 381 | failed call | — | — | — | — | — |

Combined HTTP times were 11.532 and 19.459 seconds; missing-information HTTP times were 12.056 seconds and 0.509 seconds. Both successful combined calls used aggregate sum(amount), groupBy team, filters=[], and returned Alpha=30/Beta=6. One used a valid value sort. Neither final combined call had a tool error, so no live same-tool recovery was required. Recovery is covered by a deterministic test: reject an invalid sort before querying, return corrective guidance, then accept the corrected value sort. It would be misleading to claim the old log proves that recovery sequence occurred live.

This sample demonstrates correctness for the tested fixtures, not a guaranteed speed improvement or general conflict/aggregation correctness. Rate limits and model variation remain. A grouped result can still be misinterpreted; prompt guidance is not a formal semantic proof.

## Verification and repeat procedure

38 tests pass, including new aggregate-sort rejection/correction, safe named diagnostics, and grouped result citation cases. TypeScript and ESLint pass.

```bash
npm test
npx tsc --noEmit
npm run lint
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"Using team-policy.docx and team-sales.csv, which teams failed the required target, and by how many units?"}'
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"What is the launch code of the lunar cheese factory?"}'
```

Repeat sparingly when provider quota allows. Check that only Beta fails by 9; verify both citations and the unfiltered grouped sum plan. Correlate logs using requestId. Do not treat an HTTP 429 as evidence of a database problem or raise timeouts to hide it.

Files changed: `src/lib/agent-diagnostics.ts`, `src/lib/agent-tools.ts`, `src/lib/knowledge-agent.ts`, `src/lib/generic-csv.ts` (schema description only), `tests/agent.test.ts`, and this report. Next steps: a larger measured evaluation, explicit typed aggregate/threshold provenance, and separate provider quota handling. Existing APIs and ingestion remain intact.
