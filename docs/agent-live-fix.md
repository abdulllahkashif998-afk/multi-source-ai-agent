# Live AGENT_FAILED investigation

Both supplied questions reproduced HTTP 502 AGENT_FAILED against the actual local Next.js server.

Safe stage instrumentation then identified:

```json
{"stage":"question-validation","errorType":"TypeError","nonFunction":"readQuestion"}
```

The running route could not call its imported request reader. This happened before configuration, Gemini planning, tool execution, final generation, or citation verification. No provider quota or SQL error caused these two failures. The source already exported readQuestion, and directly invoking the current backend with the existing key and real Gemini succeeded. Restarting the existing Next.js development server on port 3000 resolved both HTTP requests without changing model, tool schemas, query logic, thresholds, or citations. This establishes stale development module state as the immediate cause. The underlying framework mechanism that retained the stale export was not established; no claim of a specific Next.js bug is made.

The minimal operational fix was a graceful development-server restart. New code adds diagnostics and route-wiring regression tests rather than altering working AI behavior. If it recurs, inspect the stage log and restart `npm run dev` after stopping the previous instance gracefully. Avoid running builds against an active development output directory during investigation.

## Actual live acceptance results

The dataset and document were inspected locally first: the document contains only generic nature paragraphs, and fictional.csv contains three fictional rows: Alpha/10, Alpha/20, Beta/6. No data was changed.

Document question: HTTP 200, success=true, grounded=true. The answer discussed ocean coverage, whales/fish, coral reefs, wave erosion, and protecting the planet. Sources D1/D2 point to test-policy.docx chunks 1/2 with exact original quotes.

CSV question: HTTP 200. Returned answer:

```json
{
  "success": true,
  "grounded": true,
  "answer": "The total amount for the Alpha team is 30. [C1]\n\nThe total amount for the Beta team is 6. [C1]"
}
```

Its C1 source identifies dataset 2, fictional.csv, groupBy=[team], aggregate=sum(amount), and actual result rows `[{"team":"Alpha","value":30},{"team":"Beta","value":6}]`, with exact JSON quotes. This is a shortened response; the live response also includes the executed plan, source text, rows and quotes.

Missing-information question: HTTP 200:

```json
{"success":true,"grounded":false,"answer":"I don't have enough evidence from the available documents and datasets to answer that question.","sources":[]}
```

## Repeat live tests

With the development server, PostgreSQL, Ollama and existing private server-side Google key configured:

```bash
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"What does test-policy.docx say about oceans?"}'
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"Using fictional.csv, what is the total amount for each team?"}'
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' -d '{"question":"What is the launch code of the lunar cheese factory?"}'
```

## Diagnostics and regression coverage

Development failures now log an allowlisted error category, stage, HTTP status if available, and recognized missing-function identifiers. Stages include question-validation, agent-invocation, configuration, planning, tool-execution, final-generation, and citation-verification. Logs go to the server console and, if available, `.next/dev/logs/agent-diagnostics.jsonl`. Production logging is disabled. Raw error messages, stacks, URLs, provider bodies, credentials, questions, tool arguments and document contents are excluded.

Actual automated results: `npm test` passed all 35 tests, `npx tsc --noEmit` passed, and `npm run lint` passed.

New tests exercise invalid and valid requests through the actual route, verify the shared reader import, retain production restrictions, and check diagnostic redaction. Ordinary unit tests cannot reproduce a long-lived Next.js cache state; live HTTP verification remains necessary for that class of failure.

Changed files: `src/lib/agent-diagnostics.ts`, `src/lib/knowledge-agent.ts`, `src/lib/agent-tools.ts`, `app/api/agent/route.ts`, `tests/agent.test.ts`, and this report. No schema or ingestion changes.

Remaining limitations: development user 1 remains required. Existing semantic-grounding and model-routing limitations remain. This fix does not establish why the old development process retained stale exports, or eliminate all possible framework cache problems.
