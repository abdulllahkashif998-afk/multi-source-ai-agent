# Gemini tool selection and multi-source reasoning

New endpoint: `POST /api/agent`, JSON `{"question":"..."}`. Existing `/api/chat` remains the Day 5 document-only API. No migration, ingestion change, or data update is needed.

## Workflow

1. Reuse the existing bounded question reader and server-only Gemini configuration (`gemini-3.5-flash-lite`, direct Vercel AI SDK Google provider). Production remains blocked; backend identity stays development user 1.
2. Gemini requests only four declared tools: searchDocuments, discoverDatasets, inspectDataset, queryDataset. The backend validates inputs and executes the functions; no SQL tool exists.
3. Document search reuses BGE/pgvector and the configured similarity cutoff. CSV use requires discovery followed by inspection of an owned dataset. Each query then rechecks ownership and ready status inside the existing read-only query service, with its validated plan, parameterized values, 100-row maximum and five-second SQL statement timeout.
4. For combined questions, Gemini is instructed to retrieve the document threshold, inspect the CSV schema, then use the threshold in the structured plan. Tool results retain the executed plan and actual rows for review.
5. A separate structured generation call sees only collected evidence. The existing Day 5 answer schema, exact quote validation, and server-built citation markers verify the final output. Document citations use D IDs with filename, chunk ID/index and stored page number. CSV citations use C IDs with dataset ID, filename, executed plan, returned rows, and exact JSON quotes. Discovery metadata cannot be cited as factual query evidence.

Model planning is limited to eight steps, with a hard backend maximum of ten tool executions, followed by one final generation call. Each generation call has a 30-second timeout; the request shares a 60-second cancellation signal. Provider retries are disabled. Unknown tools, invalid plans and unauthorized datasets do not execute SQL. Tool failures return generic model-visible errors so the model can correct its request within the remaining budget. Cancellation and exhausted execution budgets stop work. Provider failures return sanitized 502 errors; request timeouts return 504. Input/configuration errors retain the existing ChatError status. Responses use no-store.

## Automated results

Actual results: all 32 tests passed; TypeScript and ESLint passed; `npm run build -- --webpack` passed and includes the dynamic `/api/agent` route. The build logged the existing `/api/test-search` prerender fetch-cancellation diagnostic without failing. The Webpack option uses the previously established fallback for this environment’s Turbopack worker restrictions.

Repeat with `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build -- --webpack`.

Tests include document-only, CSV-only and combined workflows; exact citation verification; discovery/inspection ordering; foreign datasets; unknown tools and columns; SQL injection-shaped plans; unsupported citations; absent evidence; cancellation; tool budgets. A real AI SDK loop is exercised against mocked Google HTTP transport for all three source combinations. Existing Day 5 provider failure tests and Day 6 ownership/read-only tests remain included. Mocked transport verifies SDK behavior without sending private documents or requiring a paid API call.

## Live end-to-end manual procedure

These commands add only fictional test data. Start PostgreSQL, Ollama and `npm run dev` with the existing server-side Google key. Selected document excerpts and CSV results are sent to Google by the agent.

```bash
printf 'team,amount\nAlpha,10\nBeta,30\n' > /tmp/agent-fictional.csv
curl -sS http://localhost:3000/api/datasets -F file=@/tmp/agent-fictional.csv
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' \
  -d '{"question":"In agent-fictional.csv, what is the sum of amount?"}'
```

Expect 40, a CSV citation, and a sum plan. For a document-only check, use the existing non-sensitive nature sample:

```bash
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' \
  -d '{"question":"What does test-policy.docx say about oceans?"}'
```

Expect original document quotes and D citations. For a combined test, create a minimal fictional DOCX using Python's standard library:

```bash
python3 - <<'PY'
from zipfile import ZipFile
with ZipFile('/tmp/agent-policy.docx', 'w') as doc:
    doc.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    doc.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    doc.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fictional spending policy: review any amount greater than 20.</w:t></w:r></w:p></w:body></w:document>')
PY
curl -sS http://localhost:3000/api/upload -F file=@/tmp/agent-policy.docx
curl -sS http://localhost:3000/api/agent -H 'Content-Type: application/json' \
  -d '{"question":"Using agent-policy.docx and agent-fictional.csv, which teams require spending review?"}'
```

Expect Beta/30, a query with amount > 20, and both D and C references. Verify the returned query plan, threshold, rows, and quoted policy. If retrieval misses the policy, expect abstention instead of an invented threshold. Ask about an absent policy or an inaccessible dataset and expect abstention. A fictional contradictory policy should prompt abstention rather than a silent choice. Test invalid keys only with local disposable configuration and restore it afterward; expect a sanitized provider failure.

Live model runs were not performed for this change; the commands above document end-to-end acceptance tests. Automated tests do not establish real-model routing accuracy.

## Limitations and remaining work

Exact quote validation verifies provenance, not logical entailment. Tool choice, conflict detection, threshold interpretation, units, and whether both tools are needed remain model decisions constrained by instructions; they are not formally proven by the server. Unsupported references fail closed, but a real quote can still be misinterpreted. Evaluate these behaviors on representative and adversarial questions before production. Wrong source choices with insufficient evidence should abstain; a routing mistake is not automatically repaired by a deterministic classifier.

CSV results at the plan limit are marked possiblyTruncated. Results over 24,000 serialized characters are not exposed as evidence; the agent must request a smaller query or aggregate. Discovery is capped at 100 datasets; type, precision, and filtering limitations from Day 6 remain. Empty filtered rows alone do not establish a count; use aggregate count. Database statements already started can finish after request cancellation within their existing timeout. Existing development test endpoints still need production review.

Next steps: authenticated scoping, live model acceptance tests, grounding/conflict evaluation, richer typed threshold provenance and unit validation, and pagination. No frontend or multi-user deployment is included.

Files changed: `app/api/agent/route.ts`, `src/lib/knowledge-agent.ts`, `src/lib/agent-tools.ts`, `tests/agent.test.ts`, this guide. `src/lib/chat-handler.ts` now exports its existing question reader; `src/lib/generic-csv.ts` exports its existing plan schema. Existing behavior is unchanged.
