# Configurable Gemini and Groq providers

Both POST /api/chat and POST /api/agent now use one server-side provider selector. There is no automatic fallback. Omitting AI_PROVIDER preserves Gemini, its exact model identifier and its existing behavior. Existing question/response formats and the AI Chat modes are unchanged: the UI chooses RAG versus Agent, while the server environment chooses the model provider.

## Configuration

Keep credentials in the existing private .env.local (or deployment secret store). Never use NEXT_PUBLIC_ variables for keys. A secret-free .env.example shows the new settings. Merge the settings into your existing configuration; do not overwrite database, authentication or Ollama settings.

Gemini:

```dotenv
AI_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-private-google-key
GEMINI_REQUESTS_PER_MINUTE=12
```

Groq:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=your-private-groq-key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_REQUESTS_PER_MINUTE=12
```

Restart the server after changing the environment. Only the selected provider's key is required. Missing keys, blank/invalid provider names, unsupported Groq models and invalid pacing settings return a safe CHAT_NOT_CONFIGURED response rather than switching providers. The existing Gemini billing denial still returns PROVIDER_BILLING_REQUIRED when Gemini is selected.

## Verified model and SDK compatibility

The official direct provider package is @ai-sdk/groq 4.0.71, compatible with the installed AI SDK 7 and Zod 4. It calls Groq directly, not an AI Gateway with implicit fallback.

The Groq default is openai/gpt-oss-20b. The verified configurable alternative is openai/gpt-oss-120b. Other model identifiers are rejected until their capabilities are reviewed. Verification is based on current official documentation and actual installed-SDK tests with mocked HTTP responses; no live Groq capability test was possible without a configured key.

- [Groq's GPT-OSS 20B model card](https://console.groq.com/docs/model/openai/gpt-oss-20b) lists tool use and JSON-schema output.
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs) lists both GPT-OSS models for strict mode. It requires required object fields and additionalProperties=false; our existing grounded answer schema, as serialized by the SDK, satisfies those requirements.
- Groq does not support tool use and structured output in the same call. The agent already plans with tools, then makes a separate tool-free structured generation call. This separation remains unchanged and is asserted in tests.
- [AI SDK Groq provider options](https://ai-sdk.dev/providers/ai-sdk-providers/groq) support structuredOutputs and strictJsonSchema. Both are explicitly enabled. Groq uses low reasoning effort and sequential tool calls to preserve discovery/inspection/query dependencies. Gemini options remain unchanged.

The same original groundedAnswerSchema validates both providers. Strict JSON structure does not guarantee a truthful answer: the existing exact-quote/citation verification still runs afterwards and rejects unknown sources, invented quotes and unsupported response shapes. Insufficient evidence still produces an abstention.

## Existing workflow preserved

Document RAG still uses BGE/Ollama, owned ready documents, PostgreSQL hybrid retrieval and S citations. The Agent still uses backend-controlled document search, dataset discovery, schema inspection and validated structured CSV plans. Its D/C citations retain the original metadata and query evidence. There is no raw SQL execution from either model. Ownership filtering happens before evidence is sent to the selected provider.

HTTP-only sessions, CSRF/Origin checks, authenticated identity, document lifecycle, dataset isolation, query limits, read-only SQL and the eight-step/ten-tool execution bounds were not changed. No migration, seed, existing record change or embedding/model change was made.

## Pacing, deadlines and errors

Pacing is per actual HTTP attempt, including retries. Gemini and Groq use independent, process-shared limiters that survive hot reloads. Default is a conservative 12 RPM for each. Gemini accepts 1–14 RPM, preserving its below-15 project policy. Groq accepts 1–29 RPM, below the documented 30 RPM free-plan rate for these two models. Lower settings can be used for a stricter account quota.

[Groq's rate-limit documentation](https://console.groq.com/docs/rate-limits) currently lists 30 RPM, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day for these models. Exact organization limits may differ. RPM pacing alone cannot guarantee token/daily quota availability, especially across multiple planning calls or large evidence contexts. Google and Groq quotas remain independent.

Both transports retain a 30-second HTTP deadline capped by the enclosing request deadline. Existing SDK planning/generation ceilings remain 30 seconds, with 45-second RAG and 60-second Agent request budgets. These are application limits, not promises about provider response time. Waiting in the pacing queue is bounded to ten seconds, with at most eight queued callers. Low RPM settings or congestion can cause an early safe 429 rather than an unbounded wait.

Only HTTP 429 can be retried, at most once. Retry-After seconds or dates are honored, with a shared cooldown for subsequent calls. A cooldown exceeding ten seconds, exhausted attempt count or insufficient deadline budget returns PROVIDER_RATE_LIMITED. SDK retries remain disabled so retry policies do not multiply. Network failures, auth errors, 5xx responses and invalid structured answers are not automatically retried or sent to another provider.

Groq stages are groq-pacing, groq-http, groq-retry and planning-groq; existing Gemini stages remain. Request IDs, safe categories and timings are logged. Keys, authorization headers, prompts, model reasoning, private evidence and raw error bodies are never logged or returned. Existing safe API error mapping and manual UI retry remain in use.

Limitations: each worker/process has its own limiter. Distributed deployments require shared quota coordination; other applications sharing an organization can also exhaust quotas. There is no proactive tokenizer-based TPM or daily-budget accounting in this phase. Provider-enforced 429 handling remains the final guard.

## Files changed

- src/lib/ai-provider.ts: server-only configuration, verified models and SDK factory.
- src/lib/provider-transport.ts: existing Gemini pacing/retry implementation extracted for provider-specific policies.
- src/lib/gemini-transport.ts: compatibility wrapper retaining Gemini policy and test injection.
- src/lib/groq-transport.ts: separate Groq limiter and test injection.
- src/lib/gemini.ts: existing RAG generation now uses the selected model; original imports/config exports remain compatible.
- src/lib/knowledge-agent.ts: same tools/orchestration, using the selected provider and matching timing stage.
- src/lib/reliability.ts: safe Groq stage allowlist.
- tests/ai-provider.test.ts: both-provider selection, Groq route/SDK/tool/output/security/failure/pacing coverage.
- tests/provider-context.ts: legacy regression fixtures explicitly select Gemini, independently of the developer's environment.
- package.json and package-lock.json: official Groq provider dependency.
- .env.example, .gitignore, README.md and this guide: secret-free configuration and documentation.

Existing unrelated working-tree changes were preserved.

## Actual tests

- Standard suite: 132 registered tests, 129 passed, three optional PostgreSQL tests skipped, zero failures.
- All database flags enabled: all 132 passed, no skips/failures. Database fixtures use temporary tables and rollback; existing records remain unchanged.
- TypeScript and ESLint passed.
- Production build: the default Turbopack build could not complete in this environment. An initial network-restricted attempt could not fetch the existing Google Fonts; retrying with network access progressed to a CSS-worker port-binding restriction (Operation not permitted). The supported `npm run build -- --webpack` production build then passed, including TypeScript and page generation. Builds used an isolated source/dependency copy with no copied private environment files, preserving the running development cache. No application change was made to work around the build restriction.
- Provider tests exercise real AI SDK serialization, tool loops and structured parsing using mocked HTTP responses. They cover Gemini defaults, explicit Groq selection, strict schema requirements, both protected routes, original S/D/C citations, combined calculations, unknown/invented citations, malformed/truncated generation, unauthorized datasets, rejected SQL plans, CSRF, missing sessions, provider errors, cancellation, pacing and bounded 429 recovery.
- GROQ_API_KEY was not configured. No live Groq document/combined request was made, and no successful live-provider result is claimed.

Run checks:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

## Manual browser acceptance

1. Configure a private GROQ_API_KEY and the explicit Groq settings above. Keep the existing database/authentication/Ollama environment intact and restart the app.
2. Sign in normally using the account that owns your fictional policy and CSV. Never send credentials or session tokens in a support report.
3. In AI Chat, choose Document RAG and ask “What is the minimum sales target mentioned in the team policy?” Verify POST /api/chat returns success=true, grounded=true, the actual target and S citations with exact source quotes.
4. Choose Multi-Source Agent and ask a complete combined question, for example “Using team-policy.docx and team-sales.csv, compare each team's total sales with the policy minimum. Which teams are below it, and by how much?” Use your actual owned filenames. Verify grouped totals, the comparison, and both D and C citations against the original files.
5. Allow pacing between requests. A response that abstains is not evidence that the requested question was successfully answered. For failures, record only the HTTP status, safe code and X-Request-ID. Do not capture cookies, CSRF tokens or Authorization headers.
6. Ask an unavailable-information question and confirm abstention. Use mocked tests for repeated quota/failure scenarios rather than exhausting the real account's limits.
7. Set AI_PROVIDER=gemini and restart to verify deliberate provider selection. Existing Google project billing restrictions can still deny Gemini calls; the application does not switch back to Groq automatically.
