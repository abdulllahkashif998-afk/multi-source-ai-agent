# Day 7 Phase 4: reliability controls

## Findings and scope

Inspection found no shared pacing around Gemini. One agent request can produce up to eight planning calls plus a final generation call. SDK retries were disabled. Earlier live testing recorded Google 429s; even a small number of overlapping agent requests can exhaust the shared 15 RPM quota. This change does not claim to reproduce a new live provider incident: provider recovery is tested with mocked responses to preserve quota.

The old diagnostics were agent-only, development-only, and wrote synchronous files. The current structured logger writes `[reliability]` JSON records to stdout in development and production. It replaces those agent JSONL files. Existing Day 6 investigation documents remain historical evidence.

## Logs and timing

Every protected HTTP request and account endpoint receives a fresh server-generated UUID, returned as `X-Request-ID`. Client-supplied IDs are ignored. Async request context correlates nested work. Records contain stage, outcome, durationMs, an allowlisted tool name where applicable, safe error class/category and HTTP status. They never include user identifiers, request bodies, credentials, cookies, paths, document/CSV contents, SQL, query parameters, stacks or provider response bodies. SDK warnings are replaced with content-free warning events. Logging failure does not fail requests.

Measured stages include request/authentication, PostgreSQL queries (including transactions and ownership lookups), embeddings, retrieval, CSV queries, tools, planning model calls, planning wall time, final generation, and citation verification. Document parsing and file storage also have spans. Provider HTTP timing ends at response headers; SDK planning/generation timing includes response consumption. Query spans include pool acquisition for pool.query; checked-out connection acquisition is outside individual query spans. Nested/parallel spans overlap: do not sum all durations. Failed tools followed by a successful same-tool call have a `recovered` event; this indicates technical recovery, not proof of correct reasoning.

## Rate limits and deadlines

Set the server-only `GEMINI_REQUESTS_PER_MINUTE` environment variable (default **12**; integer **1–14**). All chat and agent provider calls share one process-local transport, including each planning step, generation and retry. Starts are spaced at least 60,000/RPM milliseconds apart (5 seconds at default); there is no initial burst allowance. Hot reloads retain the process limiter. No application requests or backend tools consume provider slots by themselves.

At most eight calls can wait. Each pacing wait is bounded to ten seconds and must leave at least one second in the transport/request deadline. Aborted requests never advance to the provider. Existing SDK 30-second, chat 45-second and agent 60-second timeouts remain in force. Transport attempts also have a 30-second ceiling and share their request deadline. Waiting and retries consume the existing budget.

Only HTTP **429** receives one retry, so there are at most **two provider attempts per call**. Numeric and HTTP-date Retry-After values establish a shared provider cooldown; absent/invalid values use a one-second fallback, still subject to normal pacing. Long cooldowns, full queues, insufficient remaining budget and exhausted retries fail safely with HTTP 429, `PROVIDER_RATE_LIMITED`. Cooldown is never shortened to fit a request. Other HTTP failures retain existing safe API error behavior. Network failures are not retried. The SDK's own retries remain disabled.

No schema migration, database reset, model change or security-rule change is required.

## Limits

This is a **single Node-process** limiter, not a distributed quota service. Separate workers, serverless instances, other applications and external API users can collectively exceed project quota. Production scaling requires one shared atomic limiter/cooldown (for example a Redis-backed service), or routing all provider calls through one controlled worker. Separate bundled runtimes can also have independent globals. Requests are not guaranteed FIFO; cancellation/cooldowns can reorder waiting calls. No queue survives restart. Lower rate settings and long agent workflows can exhaust existing deadlines; callers must retry later. Pacing controls requests per minute, not token/day quotas. A 429 can still occur.

Logs omit content but remain operational metadata: deployment operators must configure access, retention and rotation. No external log collector or alerting is introduced. Citations still verify provenance, not every semantic inference.

## Tests and manual checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack

# Optional existing PostgreSQL tests use rollback-isolated fixtures.
RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts

# Focused deterministic mocked provider tests; no quota consumed.
node --conditions=react-server --import tsx --test tests/reliability.test.ts

# Quota-free HTTP test: expect 401, safe JSON and a fresh X-Request-ID each time.
curl -i -X POST http://localhost:3000/api/agent \
  -H 'Content-Type: application/json' --data '{"question":"What evidence is available?"}'
```

For an optional single live authenticated test, use the signup/login procedure in `day-7-authentication.md` to obtain a protected cookie jar and CSRF token. Do not paste credentials into logs or commit cookie jars. With shell variables `COOKIE_JAR` and `CSRF_TOKEN` populated:

```bash
curl -i -X POST http://localhost:3000/api/agent \
  -b "$COOKIE_JAR" -H 'Origin: http://localhost:3000' \
  -H "X-CSRF-Token: $CSRF_TOKEN" -H 'Content-Type: application/json' \
  --data '{"question":"What does my uploaded policy say about oceans?"}'
```

Check the response request ID against server logs; compare gemini-pacing, gemini-http, planning-gemini, postgres, embedding, retrieval, tool and final-generation spans. Expect a grounded answer only when evidence supports it, otherwise abstention. Do not run repeated live quota-exhaustion tests: mocked tests cover persistent 429, successful retry, provider cooldown, insufficient deadline, concurrent starts, bounded queues, cancellation and log redaction.

## Changed files

- `src/lib/reliability.ts`: shared request context, safe classification and timing logger.
- `src/lib/gemini-transport.ts`: process-wide pacing, bounded queue, deadline-aware 429 recovery and explicit test injection.
- `src/lib/gemini.ts`, `src/lib/knowledge-agent.ts`: use the transport for all Gemini calls; sanitize SDK warnings.
- `src/lib/agent-diagnostics.ts`: reuse shared logs, correlate request IDs and report tool recovery; remove synchronous development log files.
- `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/import-csv.ts`, `src/lib/generic-csv.ts`, `src/lib/search-documents.ts`, `src/lib/document-lifecycle.ts`: time existing queries without changing SQL or authorization.
- `src/lib/embeddings.ts`, `src/lib/chat-handler.ts`, `src/lib/document-http.ts`: embedding/chat/lifecycle timing and safe failure events.
- `app/api/auth/{signup,login,logout,session}/route.ts`: request tracing for account endpoints. Protected routes inherit tracing from `authenticated()`.
- `tests/reliability.test.ts`, `tests/provider-context.ts`, `tests/test-context.ts`, `tests/auth.test.ts`, `tests/chat.test.ts`: regression coverage and deterministic virtual provider timing, with no test bypass in HTTP input.
- `README.md`, `docs/agent-reliability.md`, this guide: current controls, historical-note correction and manual procedures.

## Verification

- Standard suite: 80 tests, 77 passed, 3 optional database tests skipped, zero failures.
- PostgreSQL-enabled suite: all 80 passed, zero skips/failures. Fixtures are rollback-isolated.
- TypeScript and ESLint: passed.
- Isolated production webpack build: passed. The build used no copied environment credentials and did not modify the running development cache.
- Live production HTTP smoke checks for anonymous `/api/agent` and `/api/chat`: both returned 401 with `UNAUTHENTICATED`, safe messages, no-store caching and different server-generated request IDs.
- No live Gemini requests were used. Authenticated evidence isolation and SDK integration were exercised by existing provider-mocked regression tests; this is not a claim of a live authenticated Gemini acceptance test.
