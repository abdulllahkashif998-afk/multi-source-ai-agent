# Agent citation-verification investigation

Investigated on 28 October 2026. Request ID: `3abb438d-1ed0-4ca9-891e-0a01714736e0`.

## Historical trace and confirmed reproduction

The saved server trace confirms that the agent completed planning, document search and structured final generation, then threw a ChatError with HTTP 502 during `session.finalize()` / citation-verification. This was not a provider quota/access denial, SQL failure, retrieval error, tool-budget error or timeout in the captured trace.

| Recorded stage | Duration |
| --- | ---: |
| Planning wall time | 5,793.4 ms |
| Document-search tool | 324.5 ms |
| Final generation, including pacing | 5,118.7 ms |
| Citation verification before failure | 0.7 ms |
| Agent total | 10,919.6 ms |
| Full request | 10,933.7 ms |

The three Groq HTTP stages all succeeded. Two pacing waits totalled 8,209 ms. Nested stage times overlap; do not sum all rows. Only document search appears in this request's tool trace; no CSV query/discovery is recorded.

**The exact failed citation rule cannot be recovered from these logs.** The historical trace contains neither the model's statements/citations, the retrieved evidence snapshot nor a rule-specific reason. The available repository artifacts contain no saved response for this request ID. Reconstructing a new retrieval result would not establish what the model cited in this historical run. No private payload was dumped to compensate for that missing evidence.

A later explicitly approved reproduction of the supplied skills question confirmed the actual rejection mechanism. Its request ID is `2fb0a6b9-4884-4b44-ac3b-39b4605dcac0`; it used three real Groq HTTP attempts, existing model/pacing and resume-only evidence guards. It failed in 10,706.7 ms with **citation_quote_not_in_source**, HTTP 502.

The structured output was valid; cited D1/D3 sources existed, and statements contained no forbidden citation markers. Direct in-memory comparison showed:

| Generated citation | Source | Exact membership | Whitespace-collapsed membership |
| --- | --- | --- | --- |
| First, 119 characters | D1 / chunk 67 | false — first rejecting rule | true |
| Second, 54 characters | D1 / chunk 67 | true | true |
| Third, 39 characters | D1 / chunk 67 | false | false |
| Fourth statement, 43 characters | D3 / chunk 68 | true | true |
| Fourth statement, 81 characters | D3 / chunk 68 | false | true |

Thus Groq reconstructed some quoted text rather than copying it verbatim. It was not a source-ID mapping failure. Some differences involved whitespace, but at least one was not explained by whitespace alone. Normalization would both relax the rule and fail to address all observed mismatches; it was not introduced. Raw statements/quotes were compared only in memory and not saved in the report or logs.

The historical generated payload is still unavailable, so its exact literal quote cannot be recovered. The same-question/account reproduction confirms the citation failure mechanism rather than retroactively recovering that payload. The approved resume document/chunk fingerprints matched before and after this live reproduction.

## Current account and local evidence check

The supplied account was confirmed as user 4 with a read-only lookup. A local PostgreSQL/Ollama retrieval used the exact supplied mobile-project skills question. External provider HTTP was blocked. It returned only ready document 44 owned by user 4:

| Current rank | Chunk ID | Chunk index | New local session source ID | Similarity |
| --- | --- | --- | --- | ---: |
| 1 | 67 | 1 | D1 | 0.655874 |
| 2 | 68 | 2 | D2 | 0.552908 |
| 3 | 66 | 0 | D3 | 0.573718 |

The first two chunks contain project/skills evidence and original line breaks. These D IDs belong to a new local session, **not a recovered historical session**. The historical planner's search text, source snapshot and generated citations were not logged. Therefore this check verifies current ownership and mapping, but cannot establish which historical quote/source pair failed or certify that the historical planner retrieved sufficient evidence.

## Source mapping reviewed

`createAgentSession` stores document evidence under backend-assigned D1, D2, ... IDs. Repeated searches append new IDs. CSV results receive independent C1, C2, ... IDs; discovery/schema responses are not supporting evidence. CSV source text is the exact serialized result JSON, with the validated plan, actual rows and truncation flag retained.

Finalization builds temporary evidence entries for CSV sources using the same C ID and exact result text, then calls the shared verifier against documents plus CSV entries. Returned source metadata maps back by those same IDs. Source namespaces avoid document/CSV collisions. No source-ID remapping defect was found in inspected code or fictional regression tests. The actual historical generated citations cannot be compared to historical evidence because neither was retained.

Production ownership/filtering remains in the existing backend services before evidence enters the session. No ownership, tool, SQL, model, provider or credential settings were changed. The account/evidence check used read-only PostgreSQL queries and local Ollama. That local-only check made no provider request. The separately approved live reproduction is described above; no existing records, credentials or model settings were changed.

## Confirmed defect fixed: missing safe rejection diagnostics

The verifier now raises a ChatError-compatible `CitationVerificationError` with one finite, content-free reason:

| Log reason | Exact rejected condition |
| --- | --- |
| citation_invalid_shape | Existing generated-answer schema fails |
| citation_empty_statements | answerable=true with zero statements |
| citation_marker_in_statement | Generated statement text contains bracketed markers |
| citation_unknown_source | A cited source ID does not exist in the supplied evidence |
| citation_quote_not_in_source | The selected source exists but its original text does not contain the quote verbatim |
| citation_unknown_quote_reference | Reference ID does not exist among offered excerpts |
| citation_reference_source_mismatch | Existing reference is paired with the wrong source |

The shared safe logger and agent trace retain these allowlisted reasons. They do not record claim text, quote text, source IDs, filenames, prompts, credentials or arbitrary provider errors. Unrecognized/spoofed reason fields are ignored. Saved evaluation reports can replay these new allowed diagnostic codes without making provider calls.

All acceptance/rejection checks remain unchanged. The prior combined unknown-source/quote check was split only to identify which condition failed. Public status 502, code UNSUPPORTED_ANSWER, safe message, exact substring verification, refusal behavior and marker restrictions are preserved. The subtype retains the existing ChatError name and instanceof compatibility. API error bodies do not expose the new server-only detail.

The next controlled failure can therefore identify its actual rule by request ID. This does not retroactively assign a reason to the historical request.

## Targeted agent fix after the confirmed reproduction

The earlier Document RAG approach is applicable to the now-confirmed quote-transcription failure, but its source-count/text truncation is not reused blindly. A new `agentQuoteChoices` adapter covers every collected document and CSV source using exact overlapping spans up to the existing 2,000-character quote limit. It does not truncate the agent to three documents or drop CSV text after 6,000 characters. Existing ten-tool-call, document excerpt and CSV-result limits remain unchanged.

Final agent generation now requests sourceId/quoteId selections using the shared static reference schema (ordinary strings; no dynamic enums). The backend resolves only known pairs into their exact original excerpts, then passes that result to the unchanged strict finalization policy. Unknown source/reference IDs and mismatched pairs fail closed. IDs remain D for documents and C for CSV; plans, rows, metadata, truncation flags and original evidence remain intact. A refusal still yields no cited claims.

Two additional safe reason codes identify unknown quote references and reference/source mismatches. The existing source/quote verifier still checks literal substring membership and rejects embedded statement markers. No quote is reformatted or repaired, no unsupported answer is fabricated, and no extra model call/retry is added. Planning/tool definitions, owner filters, SQL protections, selected model/provider settings and credentials are unchanged.

The bounded span list adds input size; exact quotes still do not prove semantic entailment. Original source text and CSV evidence are retained, and mocked tests cover late document sources and CSV text beyond 22,000 characters. A separately approved post-fix retest was attempted; its local three-HTTP-attempt guard prevented final generation, as detailed below.

## Verification

Six focused tests use fictional tool evidence and mocked Groq responses:

1. Every final verifier rule yields the correct safe diagnostic while keeping status/strict behavior.
2. CSV synthetic-source mapping preserves exact JSON, result rows and combined D/C source metadata; altered JSON formatting and cross-source quotes fail.
3. Repeated document searches keep stable backend IDs without colliding with CSV IDs.
4. Request-linked logging never emits private sentinels or spoofed reason fields.
5. The installed Groq SDK agent workflow completes mocked planning/retrieval/generation, then reports exact rules for unknown sources/references, source-pair mismatches, embedded markers and empty answers. All live HTTP is blocked in this test.
6. Reference choices retain sources after the third document and CSV values beyond 22,000 characters, with only original contiguous text and no loss of namespace/source binding.

An additional evaluation regression confirms that saved failures retain the new safe reason on offline replay.

| Check | Actual result |
| --- | --- |
| Six focused agent tests | Six passed |
| Affected agent/chat/provider/reliability suites | 68 passed |
| Full npm test | 195 registered; 189 passed; six optional database skips; zero failures |
| Full database-enabled regression suite | 195 passed; no failures/skips |
| TypeScript | Passed |
| ESLint | Passed |
| Supported isolated Webpack production build | Passed |
| Live Groq calls | Six explicitly approved attempts: three to reproduce, three planning calls in the post-fix retest |
| Database data/model/credential changes | None |

The final implementation passes automated SDK and database regressions. Post-fix final generation/citation verification remains unverified live because the explicit diagnostic attempt cap stopped that retest before generation. The historical failed payload was unavailable; the new reproduction was compared privately against actual authorized evidence.

## Changed files

- `src/lib/agent-answer-schema.ts`: all-source document/CSV excerpt choices.
- `src/lib/knowledge-agent.ts`: reference-based final generation/resolution with unchanged planning.
- `src/lib/document-answer-schema.ts`: shared reference resolution with safe rejection reasons.
- `src/lib/chat-errors.ts`: content-free citation error subtype and runtime-allowlisted reasons.
- `src/lib/rag-answer.ts`: identifies existing rejection rules without relaxing them.
- `src/lib/reliability.ts`: safe structured reason logging.
- `src/lib/agent-diagnostics.ts`: preserves the same safe reason in agent traces.
- `evaluation/answer-quality-cli.ts`: permits the new finite reasons when replaying saved failures.
- `tests/agent-citation-diagnostics.test.ts`: six focused tests.
- `tests/agent.test.ts`, `tests/ai-provider.test.ts`, `tests/auth.test.ts`: scripted provider completions follow the internal reference contract; existing isolation/citation assertions remain.
- `tests/answer-quality.test.ts`: offline diagnostic replay regression.
- `docs/agent-citation-verification-investigation.md`: this report.

## Post-fix live retest and final status

After the completed fix passed automated tests/build, the user explicitly approved one final same-question retest capped at three actual HTTP attempts. Request ID: `5b087de8-b072-448b-bab1-b15fd94470f1`.

That run made three successful **planning** HTTP calls and two owner-scoped document searches, collecting D1–D6 from the same approved ready resume. The model needed one more call for final generation. The private diagnostic guard rejected that fourth transport invocation **before native fetch**, respecting the approved three-attempt limit. The backend diagnostic response was 502 after 15,034.3 ms due to the local test guard. No final-generation HTTP request reached Groq and no generated reference/citation result was available. A transport-stage error log for the blocked invocation is not evidence of a remote provider rejection.

This is a test-budget/environment limit, not a demonstrated post-fix citation failure or a production three-call limit. Application planning/tool/request budgets were not changed to force this test through. The approved document/chunk fingerprints still matched; no database records were modified. No further live call was made.

**Final assessment:** same-question/account reproduction confirmed `citation_quote_not_in_source` and justified the source-bound excerpt-reference fix. All 195 database-enabled regressions, TypeScript, ESLint and the supported build passed. **Live post-fix success is not claimed**, because final generation was never reached within the approved retest budget. A future separately authorized request or authenticated browser acceptance check is still needed for that claim. The historical literal quotation remains unavailable; the new reproduction establishes the failure mechanism without inventing it.
