# General-agent provider tool-use failure

30 October 2026. No live provider requests; no existing records changed.

## Evidence and uncertainty

The development log contains request `a2471414-0a5b-4a89-88d4-c58eb66a3df3` with exactly the reported two-call pattern. The error log timestamp is 00:47:55.067 in the development logger's time format; its timezone is not inferred here. Logs omit question text, so confirmation that this is the user's particular request still requires their request ID. See the allowlisted [safe trace](safe-trace.json).

1. Structured operations returned without an answer, then backend dataset discovery/schema preparation succeeded.
2. Planning call 1: HTTP 200, reservation 3048, actual reported tokens 1177.
3. `searchDocuments` executed successfully; BGE embedding 303.7 ms and retrieval about 317 ms.
4. Planning call 2: admission succeeded, approximately four seconds of pacing, HTTP 400 after 903 ms; reservation 3874, usage unknown.
5. SDK error `AI_APICallError`, provider code `tool_use_failed`, diagnostic `unrecognized_envelope`. Planning wall time 5993.2 ms; application HTTP 502 after 6018.6 ms.

No `queryDataset`, final generation or citation verification appears in this trace. This is a provider rejection before the proposed tool call reached backend validation, not a SQL validation error, citation failure, local quota rejection or provider 429. Unknown usage remains conservatively accounted by the existing limiter; nothing was reset.

The original failed generation was deliberately not retained in logs. `unrecognized_envelope` cannot establish the attempted function, arguments or exact malformed structure. No raw tool argument reconstruction, execution or automatic retry was added.

## Confirmed code defects and targeted changes

The existing short SLA parser anchors its intent to the end of the question. Appending an instruction to include ticket IDs and response times made that parser return null, even though the existing operation already returns both. This reproducible routing gap unnecessarily sent the request to general model planning.

`parseSLARequest` now recognizes a presentation-only Include clause listing existing output fields, parses the remaining intent through the existing parser, and uses the existing validated SLA operation. No source names, deadlines, priorities or ticket values are embedded. Fields beyond ticket IDs, response times, policy deadline and citations are not stripped. Additional filters, date/scope restrictions and unknown requested fields remain on the general path. Unique owned source discovery, policy extraction, strict comparison, ambiguity refusal and citation verification are unchanged.

The earlier completion optimization had also introduced a planner-only `evidenceComplete` field, while provider diagnostics still checked the older strict query schema. That could incorrectly diagnose a structurally valid planner call. A shared `agentModelToolInputs` schema now serves both the SDK planner and diagnostic parser. The public CSV plan and backend query validation remain unchanged; the scheduling hint is still removed before executing queries.

The completion shortcut did not terminate planning in the observed trace: failure occurred before any query result, where that shortcut cannot activate. Whether its extra schema/instructions influenced the model's failed generation is unknown. No causal claim is justified without the missing envelope or separately authorized live testing.

## Verification

Focused tests: 37 registered, 35 passed, two database-only tests skipped; zero failures. Includes Document/CSV/combined general flows, strict citations, unsupported-answer refusal, completion bounds, SLA operation ownership/scope/boundary tests and new provider-400 regression.

Full isolated PostgreSQL suite: 304 passed, zero failed/skipped. Fresh cluster used all migrations and was removed. The modified existing database SLA test exercises the exact added presentation clause against fictional owned rows. A subsequently added provider-400 regression was rerun in the focused suite: after document search, a scripted second-call 400 must cause failure with exactly two provider attempts, one search and zero CSV queries. It does not fabricate success or retry malformed calls.

The short-SLA offline test includes the supplied question wording with fictional deadlines and ticket values, checks original document and CSV citations, and blocks provider calls. Negative tests retain routing for unknown output fields and substantive qualifiers. Diagnostic tests accept the planner completion hint while retaining invalid-plan rejection.

ESLint, repository security scan and diff checks passed. Webpack production build and standalone TypeScript check also passed. These are offline/provider-scripted and isolated-database results, not live Groq success, browser acceptance or proof of semantic accuracy.

## Files changed

- `src/lib/agent-sla.ts`: presentation-only clause handling before existing intent parsing.
- `src/lib/agent-tool-inputs.ts`: shared planner schema.
- `src/lib/knowledge-agent.ts`: consume shared schema without changing completion behavior.
- `src/lib/provider-tool-diagnostics.ts`: validate against actual planner schema.
- `tests/agent-sla-reliability.test.ts`: supplied wording, negative routing and database regression.
- `tests/agent-deterministic-operations.test.ts`: diagnostic schema regression.
- `tests/general-agent-stabilization.test.ts`: second-call provider failure regression.
- This report and safe trace. Prior historical evidence is preserved.

## Limitations

General Groq tool-use failures remain possible. Unsupported or ambiguous SLA requests correctly retain general planning or abstain; the routing correction is not a broad natural-language understanding guarantee. The failed provider envelope's exact defect remains unknown. No existing account/browser request or live Groq generation was rerun. A separately approved controlled live test is needed to establish current provider behavior; the original request ID would establish exact correlation. No model, credentials, quota limits or existing user data changed. No commit or push.
