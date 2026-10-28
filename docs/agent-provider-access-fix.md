# Agent HTTP 502 investigation — Gemini project access

## Confirmed cause

The question was: “What is the minimum sales target mentioned in the team policy?”

The development server recorded request `c850f059-523b-4350-9975-d8733786166b`. Authentication and the first Gemini planning call succeeded. The searchDocuments tool completed successfully. The next Gemini planning HTTP call returned 403, which propagated as AI_APICallError. The route converted that unclassified exception to HTTP 502 AGENT_FAILED. Final generation and citation verification were never reached.

| Stage | Recorded time | Outcome |
| --- | --- | --- |
| First Gemini planning HTTP request | 7,659.2 ms | Success |
| First planning model call, including SDK overhead | 7,713.5 ms | Success |
| Ollama BGE embedding | 4,430.3 ms | Success |
| Retrieval PostgreSQL query | 22.6 ms | Success |
| Document retrieval | 4,455.3 ms | Success |
| searchDocuments tool, including overhead | 4,460.4 ms | Success |
| Second planning HTTP request | 592.5 ms | Gemini HTTP 403 |
| Entire planning workflow | 12,821.6 ms | Failed |
| Entire API request | 12,844.2 ms | HTTP 502 |

These timings overlap; they should not be added together. This was not a 30/60-second timeout, tool validation failure, Ollama failure, PostgreSQL failure, citation rejection or HTTP 429.

Two limited backend reproductions used the real agent, existing owner-1 document scope, Gemini transport and real configured services, without modifying records. Both were denied on their first planning call, before retrieval. The provider returned code 403, status PERMISSION_DENIED, with this message (provider links omitted):

> The Gemini API free tier is not available for this project. To use the Gemini API, please set up billing to upgrade to the paid tier…

A read-only Models.get check succeeded with HTTP 200 using the same configured credential. Model metadata access succeeding does not establish generation access. The generation error explicitly identifies project free-tier/billing eligibility; it is not evidence that the model identifier is wrong or the key needs replacing. Raw error bodies, API keys, URLs and project identifiers were not added to application logs.

## Small code correction

The root cause is external provider project access. No application code can enable that access. A project operator must resolve the provider restriction before a real answer can succeed. Billing and credentials were not changed.

The transport now recognizes only the confirmed structured 403 PERMISSION_DENIED error and exact free-tier-unavailable message prefix. It inspects a bounded 8 KiB copy of the error response and throws a static ChatError:

- HTTP 503
- code PROVIDER_BILLING_REQUIRED
- safe message: “The answer service is unavailable because its Gemini project requires billing. Contact the workspace operator.”

Existing HTTP diagnostics retain the actual upstream 403. Subsequent structured stage diagnostics add the allowlisted reason provider_billing_required. No raw provider text is logged or forwarded. Other 403 responses, malformed/oversized error bodies and all existing 429 pacing/retry rules keep their behavior. The recognized denial is never retried.

The browser already safely handles HTTP 503 as a service-unavailable error with manual retry. No client answer or fabricated success is introduced. Because the transport is shared, the same confirmed provider denial is classified consistently for document RAG too.

Authentication, CSRF, ownership, citation verification, model settings, BGE, SQL limits and existing database records remain unchanged. No migration was needed.

## Files changed

- src/lib/gemini-transport.ts — bounded recognition and safe classification of the confirmed provider error.
- src/lib/reliability.ts — allowlisted provider_billing_required reason.
- tests/reliability.test.ts — exact denial, no retry, safe logging, and unrelated/malformed/oversized 403 preservation.
- tests/agent.test.ts — authenticated actual route/SDK orchestration with a mocked denial on the second planning call; asserts request ID, HTTP 503, no answer and no final generation.
- tests/ai-chat-client.test.ts — safe frontend handling of the new 503 code.
- tests/browser/ai-chat-ui.mjs — include that 503 in browser error-state coverage.
- docs/agent-provider-access-fix.md — findings and verification procedure.

## Verification

- npm test: 119 registered, 116 passed, three optional database tests skipped, zero failures.
- All PostgreSQL flags enabled: 119 passed, zero failures/skips. Existing integration fixtures use temporary tables and rollback.
- TypeScript and ESLint: passed.
- All 14 Chrome chat scenarios passed against the existing development app, including the new billing-denial error case. Browser fixtures verify safe service-unavailable feedback and existing chat regressions without consuming Gemini quota. These mocked responses are not live-provider success.
- Real backend reproductions confirmed the provider denial. No successful live answer can be claimed while the project remains blocked. An authenticated real-browser success test still needs provider access restored and access to the signed-in browser.

## Complete live acceptance after access is restored

1. The project operator resolves Google's explicit project-access/billing restriction in the existing configured project. Do not paste credentials into chat, logs or screenshots. No model replacement is required by this evidence.
2. Sign in normally at the configured application origin. Open AI Chat with Multi-Source Agent selected, using the account that owns team-policy.docx.
3. Send the exact question above once. Observe POST /api/agent in browser Network and record its X-Request-ID, status and safe JSON response. Do not copy cookies or CSRF tokens.
4. Correlate that ID with the development log. Expect successful planning, searchDocuments/retrieval, final-generation, citation-verification and grounded outcome.
5. Confirm HTTP 200, success=true, grounded=true, the actual target from the policy and an exact verified document citation. Expand its quote in the UI and compare with the owned policy. Do not accept an HTTP 200 abstention as proof that this specific question was answered.
6. If Google returns 429, respect existing pacing and wait before a manual retry. Do not run repeated live tests while the access denial persists.

For quota-free regressions, run npm test, npx tsc --noEmit, npm run lint, and the browser suite with UI_BASE_URL pointing at the running app. Database-inclusive command:

```bash
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```
