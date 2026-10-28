# Testing and controlled-staging deployment

This is an operational guide for the implemented application, not public-production approval. Application behavior, migrations, credentials and data were not changed by the documentation pass.

## Verified commands and evidence

Run from the repository root with Node 22.17+ (verified 22.22.3):

```bash
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
```

The Node test script already uses react-server conditions, tsx and disabled test-file isolation for this workspace's existing tests. No live provider key is needed for the default mocked suite. Optional real-database tests:

```bash
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

These use fictional temporary tables/rollback and need the existing schema and TEMP privileges. Evaluation helpers patch the process-local pool for serialization/savepoints; run them standalone, not alongside the application in the same process. A timeout probe uses a test-only short statement limit and does not change production timeouts. Never run maintenance re-embedding/enrollment scripts as tests.

Latest completed Day 9 Step 4 evidence: 184 database-enabled passes; standard suite 178 passes/six optional skips; TypeScript/ESLint/Webpack passed. Resume verification reran seven focused checks (one optional database skip) and TypeScript/ESLint/Webpack, without repeating the benchmark. [Performance report](evaluation/performance-reliability.md) records the exact scope. [Documentation validation](documentation-validation.md) records checks made specifically for this documentation pass.

[Day 8 final verification](day-8-final-verification.md) separately records 62 mocked Chrome browser checks, 12 HTTPS full-stack checks and limited live Groq acceptance. Browser automation needs externally installed Playwright and Chrome; those dependencies are not installed by npm ci. Scripts use PLAYWRIGHT_MODULE, CHROME_PATH and UI_BASE_URL. Follow the original guide for the isolated QA server and test flags; do not point its fixture/session operations at real accounts. For full-stack smoke tests, explicitly set QA_SKIP_LIVE_AI=1 unless live calls are authorized. Browser suites were not rerun as part of documentation.

## Supported build and runtime

Webpack is the supported verified production build: `npm run build -- --webpack`. The default `npm run build` follows Next's default bundler and has a previously recorded sandbox worker-port restriction. Do not work around it by removing CSS or authorization. Avoid building over an active dev server's .next cache; use a separate checkout/copy with the same source and dependency lockfile.

`next.config.ts` externalizes pdf-parse and traces its PDF worker for `/api/upload` and `/api/documents/*`. Verify these deployment artifacts before a PDF smoke test; a JavaScript/TypeScript build alone does not prove the worker loads. The repository does not configure Next standalone output or an infrastructure deployment manifest. `npm start` runs the built Next server; place it behind the approved HTTPS reverse proxy. Do not assume uploading to an ephemeral serverless filesystem preserves private files.

## Controlled-staging prerequisites

1. **Schema provenance:** use the verified empty-database sequence 001–009 for fresh installations. Inspect existing migrations; backup/restore-test the database and review missing changes before applying them. Never reset or blindly rerun migrations. See [database guide](database.md).
2. **Private service connectivity:** reachable PostgreSQL/pgvector and Ollama with the configured BGE model; verified vector(768) shape and nonpublic service ports. Review transport security and least-privilege database roles. Keep operator/migration credentials separate.
3. **Secrets:** server-only DATABASE_URL and the selected provider key through private environment/secret management. No NEXT_PUBLIC credentials, copied .env files in public artifacts or secrets in logs. Only one provider is selected; check its account permissions and quota before live use.
4. **HTTPS/session origin:** NODE_ENV=production, explicit HTTPS APP_ORIGIN with exact host/port, no trailing slash. Confirm browser Origin reaches the backend and Secure __Host-knowledge-session is set with HttpOnly/SameSite=Strict/Path=/. No permissive CORS or CSRF bypass.
5. **Persistent private storage:** writable storage/uploads beneath a stable working directory, access permissions and encrypted backup policy. Do not expose it as a static directory. Back up file and metadata states consistently; database-only restore is insufficient for original documents.
6. **Quota ownership:** single-process pacing is not a shared quota service. Account for other workers/apps using the same provider credentials and its RPM, token and daily limits. Conservative RPM does not guarantee token/daily allowance. No sustained load test has been completed.
7. **Request limits and budgets:** align proxy body/time limits with 10 MiB uploads, 120-second upload signal, 45-second chat and 60-second agent budgets. Individual provider/model calls are bounded at 30 seconds and embeddings at 15 seconds. Do not blindly raise application timeouts to hide slow calls.
8. **Operations:** request-ID log access, safe alerting, file cleanup/reconciliation procedures, expired-session/rate-key retention policy, rollback/recovery owner and a staged release procedure. No scheduled cleanup worker or reconciliation command is supplied.
9. **Identity controls:** decide account access policy. No email verification, password recovery/change UI, MFA, administrative user management or account-deletion endpoint exists. Duplicate signup returns 409 and reveals registration status. Database operators remain privileged.
10. **Quality sign-off:** complete an explicitly authorized live sample and human semantic review before claiming answer-quality coverage. Full live 25-case evaluation is incomplete. Never market exact-quote checks as proof that all claims are true.

## Staging acceptance checklist

Use isolated fictional accounts/files; preserve other users' records. These operations create test records, so execute only in approved staging or the isolated QA fixture server:

- Signup, invalid/valid login, logout and expired session; production cookie attributes and no secret in JSON.
- Missing/foreign Origin and missing/wrong CSRF rejection before protected operations.
- User A/B list/query/citation isolation, including known foreign document IDs returning safe not-found results.
- Real PDF and DOCX parsing/upload; byte-identical 409; failed replacement retains old knowledge; successful replacement increments version and excludes predecessor.
- Delete excludes chunks immediately; cleanup failures remain queued without returning paths; retry owned jobs. Do not expect saved chat messages to be revoked.
- Generic CSV discovery/schema, COUNT/SUM/AVG/group/filter/sort; invalid columns, arbitrary SQL plans and foreign datasets rejected.
- Document RAG and combined agent with real citations, only after explicit quota authorization. Without live permission, use mocked provider regressions and no-evidence refusal tests.
- Desktop/mobile navigation, keyboard dialogs, source tables and text-only rendering; no private state after account change/session expiry.
- Safe 429/403/timeout behavior with mocks, correlation by request ID, no API key/session token/document text in errors/logs.
- PDF worker included in trace; database/file restore tested; owner-approved rollback and cleanup plan documented.

## Known operational risks

The transport allows at most eight active/waiting attempt operations and up to ten seconds of queue wait, bounded further by request deadlines. Only HTTP 429 may retry once; long Retry-After or insufficient time stops sooner. HTTP 403/5xx/network errors are not automatically retried. SDK retries are disabled. Multiple tools/model steps can make a single answer consume several paced calls; a locally rejected queue is not proof of remote quota exhaustion.

Rate state is process-local, provider-local and nondurable. Multi-worker coordination, proactive token/daily accounting and distributed fairness are absent. SQL cancellation is cooperative: CSV reads rely on statement timeout rather than a caller AbortSignal, and retrieval's client query timeout does not prove server cancellation. Local CPU scheduling and clock changes can affect measurements/pacing.

Lifecycle transactions hold an owner lock while preparing documents and calling Ollama. Concurrent writes for that owner can return DOCUMENT_BUSY. Unpublished file cleanup failure/uncertain COMMIT can leave an orphan requiring reconciliation; legacy CSV files have no management cleanup API. Cleanup batches are not a global queue-depth metric.

The application is not a certified high-availability service: there is no deployment automation, infrastructure health endpoint, production-scale load test, distributed limiter, complete retention policy or full live semantic-quality sign-off in the repository. A controlled staging release remains conditional on the prerequisites above. No Day 10 work is part of this guide.
