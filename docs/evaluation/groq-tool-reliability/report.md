# General Groq tool-calling reliability review

30 October 2026. No live model calls. The initial inspection was read-only; the implemented change is limited to safe diagnostics and regression tests.

## Confirmed incident

Request `d0e7cc2d-79ea-4ba3-b09a-cb237da7d399` failed on planning invocation 2 after dataset discovery/schema preparation and successful document search. Provider HTTP 400/tool_use_failed caused application HTTP 502/AGENT_FAILED. No CSV execution, applicability evaluation, generation or citation verification followed. Its original failed_generation is unavailable. See the preserved [exact request investigation](../applicability-lab-failure/exact-request-follow-up.md). A separate later local TPM rejection is not conflated with this provider error.

## Model and SDK compatibility

Official [Groq tool-use documentation](https://console.groq.com/docs/tool-use/overview) lists openai/gpt-oss-120b as supporting local tool calling and not parallel tool use. The application already sets parallelToolCalls=false and uses the supported AI SDK Groq adapter. No provider/model configuration was changed.

Groq documents HTTP 400 for failed tool generation in its [local-tool guide](https://console.groq.com/docs/tool-use/local-tool-calling). Its [structured-output documentation](https://console.groq.com/docs/structured-outputs) distinguishes response JSON schemas from tool use. The application separates these phases. Inspection of installed adapter source and mocked wire requests confirms:

- Planning uses function tools and has no response_format.
- Final generation uses response_format=json_schema and has no function tools.
- strictJsonSchema controls final response formatting; it does not automatically set function.strict on planner tools.
- Planner tool schemas are strict Zod objects with optional/defaulted query fields. Backend parsing and query compilation remain necessary; provider-side schema constraints are not a semantic correctness guarantee.
- The adapter serializes assistant tool-call arguments as JSON strings, preserves tool-call IDs, emits matching tool response IDs and retains assistant reasoning. No history-conversion defect was demonstrated.

The review relies on primary provider documentation and installed SDK source, not forum reports. Support does not guarantee every generated call is valid.

## Request and execution boundaries

`knowledge-agent.ts` supplies backend-prepared owner-scoped schemas, bounded active tools, planner instructions and request-local tool results. The SDK validates accepted tool-call inputs before the registered execute callback. The callback delegates to `createAgentSession`, which validates again, requires discovered/inspected owned datasets, compiles the restricted plan, and runs the existing read-only parameterized CSV service. Unknown columns, unsupported plans and unauthorized data cannot become arbitrary SQL. Invalid model calls can produce safe tool errors for bounded planning recovery; a provider-level HTTP rejection occurs earlier and is not an accepted tool result.

Planning is bounded by eight steps, ten tool operations, output limits, deadlines and duplicate-only progress control. maxRetries=0 applies to SDK calls. Existing transport handling for temporary provider 429 remains separate; HTTP 400 is not automatically retried. The planner-only completion hint is stripped before SQL validation. Final answers remain subject to original-evidence references, citation validation and applicability gates.

## History and schema cost: evidence versus hypotheses

Confirmed structural complexity includes nested filter/group/aggregate/sort schemas and a long planner instruction set covering actual safety and correctness constraints. Each continuation carries the accumulated tool conversation. Existing efficiencies already include bounded schema preparation, request-local query/search caching, compact CSV model views and deduplication of repeated source payloads. Full applicability context is checked in the backend rather than added to model prompts.

These costs can increase tokens, but there is **no measurement proving they caused this particular malformed output**. The retained failed trace contains neither its envelope nor prompt snapshot. Optional fields, model sensitivity to prompt size, the scheduling hint and reasoning settings are possible influences, not confirmed causes. Removing grounding instructions, prior reasoning or tool results could itself damage arbitrary-question support. No such changes were made. Turning on strict tool schemas without testing the supported schema subset is not justified by the separate strict final-output setting.

## Smallest supported improvement

The confirmed diagnostic defect was information loss: unrecognized_envelope previously merged non-JSON output, missing/non-array tool_calls, multiple calls, empty calls and malformed call/function objects. The same compatibility reason is preserved, with a new static envelopeShape label and, for call lists, callCount capped at 10. Invalid scheduling-hint values now use an allowlisted evidenceComplete field path.

Only structural classifications are exposed in server diagnostics. No tool names outside the known allowlist, raw argument values, snippets, private contents, failed_generation, error messages or provider bodies are logged or returned. Diagnostics never repair or execute payloads and cannot trigger a retry. This improves future evidence collection; it does **not** repair the historical failure or establish reduced live error rates.

## Recovery options evaluated

| Option | Decision |
|---|---|
| Fail closed, return safe error, manual retry after quota permits | Retained. No fabricated answer or execution of rejected calls. |
| Reconstruct/repair a tool call from failed_generation | Rejected: structure, intent and validity are uncertain; bypasses the accepted SDK execution boundary. |
| Replay the whole user question automatically | Not added: repeats evidence/model work and can amplify quota failures. |
| One bounded fresh planning attempt using only validated history | Potential future option, not implemented. Must share request deadlines, count against total model/step limits, pass normal atomic quota admission, retain conservative failed-call usage and discard malformed output entirely. Tests must prove one-attempt maximum, cancellation and refusal safety. Historical evidence does not establish it would help here. |
| Generate an answer immediately after planning fails | Rejected: evidence may be incomplete; this incident had no CSV evidence. |
| Replace tool use with structured plan generation | Deferred: broader protocol change requiring provider compatibility and accuracy evaluation. |
| Change model or provider | Not part of this task. |

A provider 400 may have unknown token usage. Conservative accounting is retained; any future recovery must not treat that call as free. Automatic recovery can legitimately be denied by TPM/deadline constraints.

## Validation

Focused suites: 21 registered, 20 passed, one database-only test skipped, zero failed. New malformed-response tests cover non-JSON/non-object, missing/invalid/empty/multiple calls, invalid function objects, invalid arguments JSON, unsupported SQL fields, safe output redaction, bounded counts and accepted completion-hint shape.

A new SDK wire-contract regression checks model ID, disabled parallel calls, planner tools without JSON response formatting, strict object schemas, preserved reasoning/tool IDs, JSON tool results, final structured output without tools and a verified CSV citation. The existing scripted second-planning-call 400 regression still proves zero rejected-tool executions and zero answer generation. Existing varied document/CSV/combined/refusal regressions remain.

The complete suite ran in a separate disposable PostgreSQL cluster: 312 passed, zero failed/skipped; the cluster was removed. Existing application data was not used for fixture writes. TypeScript, ESLint, diff checks and the repository security scan passed; no secret findings. Tests are mocked/scripted protocol and deterministic backend verification, not live Groq quality results. No production build was needed for this diagnostic-only change; prior build evidence is not represented as rerun.

## Files changed and limitations

- `src/lib/provider-tool-diagnostics.ts`: bounded structural failure classification.
- `tests/provider-tool-reliability.test.ts`: malformed-envelope and safety regressions.
- `tests/general-agent-stabilization.test.ts`: SDK wire-contract regression.
- This report.

General Groq malformed tool calls may still occur. Historical cause beyond provider tool-generation failure remains unknown. Schema-valid calls can still select incorrect tools, calculations or evidence; backend validation and citations are necessary but not proof of complete semantic correctness. No live compatibility/accuracy claim, automatic retry, model change, quota bypass, user-data mutation, historical artifact rewrite, commit or push.
