# Document RAG citation rejection investigation

Investigated on 28 October 2026. No resume excerpts, contact details, credentials or raw provider bodies are retained in this report. Regression tests use fictional education data.

## Root cause and request trace

The authenticated account owned a ready resume document containing five chunks. An older deleted version had no chunks. Owner-scoped hybrid retrieval returned three chunks; the second source (S2) contained both requested facts. No ownership or missing-evidence defect was found. Account, document and chunk identifiers and the original filename are omitted from this public report.

Original API failures were HTTP 502, request IDs 034d898a-0abf-4f7c-a6ca-88c1c4a9c85b and 46b046da-f70c-4a19-af4b-7d459cd19a80. Logs show successful retrieval, successful Groq HTTP and completed structured generation, then a ChatError incorrectly labelled generation. Failure durations were approximately zero because the catch passed a fresh timestamp to the logger.

The first approved reproduction established the exact rejecting condition: schema-valid, answerable output with an existing S2 source ID and no forbidden statement markers contained a quote that was not a substring of that source. The strict verifier correctly rejected it with 502. Whitespace-collapsed, Unicode-normalized and literal-newline probes also did not match; this was not simply a JSON newline-escaping issue. No quote normalization or relaxed comparison was introduced.

The next unchanged call produced separate exact quotations and passed. The failure was intermittent free-form quote transcription by the model, not a provider access restriction, timeout, structured JSON parse failure or failed retrieval. Genuine source IDs alone did not make the generated quotation valid.

## Actual live calls and limits

The user explicitly approved three Groq calls, then one additional final retest. Four actual HTTP attempts were made, using the existing openai/gpt-oss-20b configuration and transport. There was no automatic fallback or added retry.

| Call | Request ID | Actual outcome |
| --- | --- | --- |
| 1: diagnostic | d2debfd0-a007-4cde-8780-15d64750e21c | Valid structure and S2; 66-character quote not in source; strict validation rejected |
| 2: diagnostic | ecf13bf8-edc0-466f-96d6-03ba544cb78a | Separate exact quotes from S2; verification passed and both requested facts were present |
| 3: prompt-only retest | f28f1ed7-517e-45ec-8732-c36abe7a6150 | HTTP 502 UNSUPPORTED_ANSWER again; corrected logs identify citation-verification |
| 4: quote-enum experiment | 40979f5b-3f55-4f22-a047-5949dace0cb3 | Groq HTTP 400; handler returned safe 502 GENERATION_FAILED; enum experiment withdrawn |

The precise reason within the provider's HTTP 400 body was not captured; this report does not claim that Groq universally lacks enum support. That request format was not verified compatible, so it is not retained. Prompt-only guidance was also not presented as a reliable fix.

The final reference-based implementation described below was completed after the fourth call and **has not been tested against the live provider**. The earlier successful diagnostic must not be described as proof that the final version passes. No fifth call was made. Final authenticated browser acceptance remains outstanding.

Diagnostics used actual retrieval/provider functions and the shared chat handler under the verified owner identity. They did not replay a browser session/cookie. The original frontend status/request IDs came from real application logs. Session/CSRF logic was not modified or bypassed in the running app.

## Final targeted implementation

Instead of requesting a free-form quote, Document RAG generation now requests a sourceId and quoteId referring to exact excerpts supplied with the retrieved evidence. These remain ordinary string fields in a static object/array schema; there are no dynamic enums in the final provider schema.

`document-answer-schema.ts` prepares bounded, exact contiguous choices from the existing text: overlapping windows no longer than 2,000 characters, plus optional sentences/lines. It considers at most three 6,000-character source excerpts and 32 choices per source. Each choice is assigned to its actual source. No source text, internal whitespace or punctuation is normalized or reconstructed.

The model selects references. The backend resolves only an existing quoteId/sourceId pair and copies the original excerpt into the existing generated-answer structure. Unknown IDs and mismatched pairs fail with UNSUPPORTED_ANSWER. The model cannot supply replacement quotation text through this contract. The public answer/source response format remains unchanged; quoteIds are internal only.

The existing `validateGroundedAnswer` implementation is **unchanged**. It still verifies source membership, exact quote substring matching, statement marker restrictions and output shape. Backend resolution does not invent a source, fix a fabricated quotation or prove semantic entailment; it removes the need for the model to reproduce PDF whitespace and wording. Selected excerpts can still be irrelevant, and semantic grounding remains subject to the existing limitations.

`gemini.ts` uses this provider-only reference schema, supplies quote choices, resolves references and records resolution timing at citation-verification. The final existing verifier still runs in the chat handler. Agent orchestration/generation is unchanged. Both configured providers keep their original model, options, pacing, token cap, timeouts and retry count.

`chat-handler.ts` now sets citation-verification before the final check and logs elapsed time from the actual stage start. Public status/error mappings, authentication, authorization and CSRF remain intact. No database migration, document rewrite or dataset modification was performed.

## Tests and actual results

- Baseline affected suites before changes: 43 passed.
- Four new focused regressions cover exact multiline PDF quotes versus altered/composite quotes, safe citation-stage error logs, actual mocked Groq SDK reference-schema wiring, and bounded quote choices/unknown or mismatched reference rejection.
- Affected chat/provider/reliability checks: 47 passed in the affected run; the final full run includes them.
- Full standard suite: 188 registered, 182 passed, six optional database skips, zero failures.
- Full database-enabled suite: 188 passed, zero skips/failures, using isolated temporary fixtures.
- TypeScript and ESLint: passed.
- Supported Webpack build: passed for final application source in an isolated copy, with no private environment file and no disturbance of the running development cache.
- Existing provider mocks in chat, hybrid and authentication tests now select offered reference IDs. Their ownership, low-cosine retrieval and citation assertions remain; direct verifier/Agent tests retain arbitrary exact-substring behavior.
- Real-handler retest snapshots matched for documents, chunks, generic datasets and CSV rows. Read-only diagnostics made no changes to existing user data. Private temporary response capture was deleted.

## Changed files

- src/lib/document-answer-schema.ts — bounded exact excerpt references and safe resolution.
- src/lib/gemini.ts — Document RAG reference generation/resolution and timing.
- src/lib/chat-handler.ts — correct citation-stage attribution/duration.
- tests/chat.test.ts — PDF, verifier, reference and safe logging regressions; provider fixture adaptation.
- tests/ai-provider.test.ts — mocked Groq SDK integration and provider fixture adaptation.
- tests/hybrid-search.test.ts — existing mocked RAG completion follows the reference contract.
- tests/auth.test.ts — isolated authentication test's mocked RAG completion follows the reference contract; no production authentication changes.
- docs/day-10-rag-citation-investigation.md — this safe report.

## Final status and remaining verification

Root cause confirmed; reference-based mitigation implemented and automated checks/build passed. **The final live question is not yet confirmed passing.** The last live attempt tested an experimental implementation that was subsequently removed. No further quota was used beyond the four explicitly approved calls.

A future authorized test should submit the original question in the authenticated Document RAG browser flow, inspect its request ID/status and verify both facts and exact source quotes. Until that succeeds, this issue must not be reported as fully live-verified or resolved. No synthetic answer or invented citation is used as acceptance evidence.
