# Complete Day 7 verification

Review date: 2026-10-23. No application behavior, model settings, database schema or security controls changed during this review. No migration ran. Existing working-tree changes were retained.

## Actual results

| Check | Result |
| --- | --- |
| `npm test` | 80 registered tests: 77 passed, 3 optional database tests skipped, zero failures |
| Database-enabled complete suite | All 80 passed; zero failures or skips |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed in an isolated source snapshot, without copied environment credentials |
| Production HTTP smoke checks | `/api/chat` and `/api/agent`: 401 UNAUTHENTICATED, no-store, distinct server-generated request IDs; supplied client ID ignored |
| Real-clock provider transport check | Two fictional provider calls started 5,004 ms apart at 12 RPM; cancellation prevented the next provider call |
| Live Gemini usage during review | Zero requests |

The build used a temporary directory and left the running development cache alone. The temporary production server used for HTTP smoke checks was stopped afterward.

## Features reviewed and exercised

- **Hybrid retrieval:** owner and ready-status restrictions cover both semantic and full-text branches. RRF sums `1/(60+rank)` for eligible branches, deduplicates chunks, and uses deterministic tie breakers. Weak semantic-only matches are filtered, while keyword matches remain eligible. PostgreSQL tests exercised exact identifiers, owner/status exclusion, semantic comparison, and preserved citation metadata. Semantic/paraphrase fixtures use controlled vectors; live BGE model quality was not re-benchmarked.
- **Document lifecycle:** SHA-256 owner-scoped duplicate detection, owner advisory locks and the active-hash unique index protect publication. Replacement prepares before publication, preserves the old version on failure and retires it atomically on success. Deletion removes chunks and excludes the document from retrieval; cleanup failures retain retryable jobs. Unit and database tests cover these paths, denied foreign-owner operations and simulated concurrency. Concurrency tests do not constitute a multi-process load test.
- **Authentication:** salted scrypt, hashed session tokens, eight-hour expiry, logout, secure production cookies, origin checks and session-bound CSRF are preserved. The verified request identity supplies ownership; there is no hardcoded development-user fallback in protected execution.
- **Documents, CSV and combined answers:** existing SDK tests cover all three workflows, invalid tool plans, source selection, bounded execution, missing evidence and unsupported answers. New coverage in the authenticated database test verifies CSV-only and combined agent workflows against real PostgreSQL data for two fictional users.
- **Citations:** original source metadata and exact quote membership are retained. Foreign evidence, fabricated source IDs and altered quotes are rejected. Combined test answers cite both the policy and the aggregate result. Exact citation verification proves provenance; it does not independently prove every model inference.
- **Diagnostics:** request IDs, allowlisted fields, safe error classes, stage/tool timing and redaction tests passed. Production HTTP checks confirm correlation headers on rejected requests.
- **Gemini reliability:** mocked tests cover 429 recovery, two-attempt exhaustion, provider cooldown, insufficient deadline, bounded queue, concurrent starts and cancellation. The separate real-clock test confirmed five-second spacing without contacting Google. Existing deadlines and SDK retry disabling remain unchanged.

## Authenticated fictional-data integration

The database test runs real account/session SQL and actual authenticated route-handler calls using Request/Response objects. It creates temporary copies of the tables, translates service transactions to savepoints, and rolls back the outer transaction. Fixture records never enter the public tables. It does not create persistent accounts or call a deployed network service for authenticated requests.

For each fictional user A and B, the test now runs:

1. Document chat and document agent: only that user's document is returned and cited.
2. CSV agent: discovers the user's dataset, inspects its schema and executes a grouped sum against real CSV rows. A sees Alpha/10; B sees Beta/10.
3. Combined agent: retrieves the document's threshold of 7, queries the user's grouped total of 10 and returns an above-threshold answer with both document and CSV citations.

Assertions check successful responses, generated request IDs, source counts, dataset/document ownership, exact CSV results and quote membership. Every mocked Gemini request is checked for absence of the other user's document text and team data. Signup/login/logout, duplicate accounts, expiry, retained passwordless accounts and unauthorized lifecycle/CSV operations are also exercised.

Google responses, embedding vectors, document parsing and file storage in these database fixtures are mocked. Actual PostgreSQL queries, structured-plan compilation, session verification, identity scoping, backend tool orchestration and citation validation run. This is integration evidence, not a fresh live Gemini or PDF/DOCX/Ollama end-to-end acceptance test.

## Changes made during review

- `tests/auth.test.ts`: expanded the existing database test with CSV-only and combined authenticated agent cases, both-user ownership checks, exact aggregation/citation assertions and request-ID checks. Fictional policy text now contains an explicit threshold. Corrected the test-only query adapter to accept pg query-config objects as well as SQL strings; the expanded tests exposed that adapter gap, not an application regression.
- `tests/provider-context.ts`: extracted the existing virtual Gemini-clock wrapper for reuse per HTTP-handler request, so separate requests do not inherit accumulated virtual time from earlier requests.
- `docs/day-7-verification.md`: this report.

No application files were changed. Total registered test count remains 80 because the additional scenarios extend an existing parameterized integration test.

## Remaining limits and readiness

No application regression was confirmed in the exercised paths. Day 7 is ready for continued development and controlled single-process use. This is not blanket production certification.

- Pacing is process-local. Multiple workers/instances or other users of the same Google project need a shared quota limiter. Token/day quotas remain separate.
- Five-second pacing and longer tool workflows can exhaust existing deadlines. Requests may safely return rate-limit/timeout errors; deadlines were not increased.
- Fresh live Google/Ollama calls and full binary parsing/upload acceptance were intentionally not exercised. Provider availability and free-tier quotas can still affect live behavior.
- Grounded citations establish source membership, not complete semantic truth. Broader conflicting-policy and adversarial reasoning evaluations remain useful.
- Hybrid retrieval currently depends on successful embedding generation; there is no keyword-only fallback when Ollama fails. Top-three evidence limits can omit relevant information.
- Production operations still need HTTPS configuration, distributed abuse/quota protection, log access/retention, backups, cleanup scheduling and account recovery/verification policies. Earlier phase documentation contains historical test totals; this report records the current verification run.

## Reproduce

```bash
npm test
npx tsc --noEmit
npm run lint

RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts

# Production build; use an isolated source copy if a dev server shares .next.
npm run build -- --webpack

# Optional: run only the authenticated fictional-data integration scenario.
RUN_AUTH_DB_TESTS=1 node --env-file=.env.local --conditions=react-server \
  --import tsx --test --experimental-test-isolation=none \
  --test-name-pattern='PostgreSQL signup/login/logout' tests/auth.test.ts
```

These tests mock the provider and preserve public records. See `day-7-authentication.md` for optional manual authenticated network requests and `day-7-reliability.md` for pacing configuration. Do not repeatedly issue live agent requests to test quota exhaustion.
