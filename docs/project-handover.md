# Project handover

Prepared 28 October 2026 from the repository and retained reports. Documentation-only handover: no application tests, provider requests, database mutations, configuration changes, commits or pushes were performed for this document.

## Overview and stack

Multi-Source AI Knowledge & Data Intelligence Agent is an authenticated workspace for PDF/DOCX knowledge and structured CSV analysis. It provides document RAG, validated CSV calculations and a bounded multi-source agent with source references.

| Layer | Implemented technology |
| --- | --- |
| Application | Next.js 16.4.2, root `app/`, TypeScript, React 19 |
| Styling | Tailwind CSS 4 through PostCSS; existing dashboard components |
| Database | PostgreSQL 18; locally verified 18.6; pgvector 0.8.1; `pg` driver |
| Retrieval | BGE 768-dimensional embeddings through Ollama; cosine + English full-text search; RRF |
| LLM | Vercel AI SDK 7; configurable official Groq/Google adapters; no automatic provider fallback |
| Parsing | PDF.js/pdf-parse, Mammoth for DOCX, csv-parse for CSV |
| Identity | Custom server sessions, scrypt passwords, HTTP-only cookies, CSRF/Origin checks |
| Evaluation | Fictional fixtures, deterministic assertions, real local retrieval and opt-in live evaluation |

Document files use private `storage/uploads` under the process working directory. Generic CSV data/schema are stored in PostgreSQL JSONB tables, not publicly downloadable files. Backend ownership filters protect evidence before provider access. See [architecture](architecture.md), [API](api.md) and [database](database.md).

## Repository and branch

Configured origin: [multi-source-ai-agent](https://github.com/abdulllahkashif998-afk/multi-source-ai-agent.git). Main/current branch: `main`, observed from local Git configuration on 28 October 2026.

This records the configured remote, not a verification of remote visibility, permissions or whether every current local file has been pushed. No remote was contacted or altered for this handover. Review `git status --short`, `git branch --show-current` and `git remote -v` locally before a release. Do not display credential-bearing remotes; the observed origin uses a credential-free HTTPS URL. The earlier [GitHub review](day-10-github-review.md) is a historical snapshot from before a remote was configured.

The explicit proposed path list is [github-staging-files.txt](github-staging-files.txt). Review changes before staging; do not use it as approval to commit or push. License, repository visibility, CI and release policy remain owner decisions. `private: true` in package.json concerns npm publishing, not GitHub privacy.

## Local setup and database initialization

### Prerequisites

- Node.js 22.17+ in the verified 22.x line (22.22.3 used in reports), npm and Git.
- PostgreSQL 18 server/client tools and a compatible pgvector package installed on the server. No particular operating-system package-manager command is assumed.
- Ollama with the existing BGE model; private database and Ollama connectivity.
- Provider credentials/access for live answers, supplied privately; no live key is needed for the default mocked tests.
- Writable persistent private document storage. Optional browser automation needs Playwright installed separately and Chrome; `npm ci` does not install those tools.

Install the locked application dependencies from the repository root:

```bash
npm ci
```

Do not copy another project's code/settings, run destructive database commands or force dependency upgrades as setup.

### New empty database only

For an existing working installation, inspect its catalog/migration state and retain its data. **Never replay the fresh sequence against it.** Have the database administrator provision a separate empty database, for example `new_database`, owned by a migration administrator. Keep runtime credentials separate from that administrator.

Supply `FRESH_DATABASE_URL` privately in the operator's process environment, pointing to that new database; its database name must match the confirmation exactly. Then run:

```bash
npm run db:setup:fresh -- --confirm-empty-database new_database
```

The command reads `FRESH_DATABASE_URL`; it does not fall back to the application URL and does not automatically load `.env.local` as Next.js does. It refuses nonempty application schemas, reserved targets and the configured original database name when supplied. It applies:

| Migration | Purpose |
| --- | --- |
| 001 | Enable already installed pgvector |
| 002–005 | Users, base documents/chunks and legacy CSV tables |
| 006 | Generic CSV datasets/rows |
| 007 | Concurrent full-text GIN index |
| 008 | Document lifecycle, ready owner/hash uniqueness and cleanup metadata |
| 009 | Authentication credentials, sessions, normalized email uniqueness and throttles |

Do not wrap the entire sequence in one transaction: 007 uses `CREATE INDEX CONCURRENTLY`. The installer is fresh-only, not an incremental migration manager; no automatic partial-install reset or migration ledger is supplied. Consult [database safety](database.md#fresh-setup-and-migration-safety) for failed/partial setup and upgrade review.

Afterward, the administrator grants a separate runtime role CONNECT/TEMP on the database, USAGE on public, table SELECT/INSERT/UPDATE/DELETE and sequence USAGE/SELECT. It must not be superuser, CREATEDB, CREATEROLE or schema owner/creator. Protect service ports and review TLS/backup policies. Configure `DATABASE_URL` with this restricted role, not the migration credential.

Read-only checks in the new database:

```sql
SELECT version();
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT format_type(atttypid, atttypmod)
FROM pg_attribute
WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding';
```

Expected embedding shape: `vector(768)`. Fresh setup verification recorded 12 public tables, 13 foreign keys and required indexes. Use [the disposable runner](day-10-fresh-setup-security-review.md) for independent verification, not a reset of an existing installation.

### Ollama/BGE and private environment

Use the installation's service manager or `ollama serve` if no Ollama service is already running. Install/confirm the unchanged model:

```bash
ollama pull hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0
ollama list
```

Preserve 768 dimensions and existing model configuration. Maintenance re-embedding is not a setup step.

Create a private `.env.local` from [`.env.example`](../.env.example) only when it does not overwrite an existing file. Replace placeholders locally and restrict file access. Never commit it, put credentials into `NEXT_PUBLIC_` variables or include real secrets in handover screenshots. Next.js loads the file for development/build/runtime; standalone Node scripts need explicit environment loading when documented.

| Variable name | Purpose / existing default |
| --- | --- |
| `DATABASE_URL` | Required explicit runtime PostgreSQL URL; percent-encode credential special characters |
| `APP_ORIGIN` | Exact allowed origin; local default http://localhost:3000; explicit HTTPS origin required in production |
| `OLLAMA_BASE_URL` | Existing local default http://localhost:11434 |
| `EMBEDDING_MODEL` | Existing BGE identifier above; 768 dimensions |
| `AI_PROVIDER` | `gemini` or `groq`; Gemini is the unset default |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Private key required only when Gemini is selected |
| `GROQ_API_KEY` | Private key required only when Groq is selected |
| `GROQ_MODEL` | Existing default `openai/gpt-oss-20b`; allowlisted `openai/gpt-oss-120b` alternative |
| `GEMINI_REQUESTS_PER_MINUTE` | Existing default 12; code accepts 1–14 |
| `GROQ_REQUESTS_PER_MINUTE` | Existing default 12; code accepts 1–29; account/token/day limits still apply |
| `DOCUMENT_SEARCH_MODE` | Existing default hybrid; semantic comparison mode available |
| `RAG_MIN_SIMILARITY` | Existing default 0.5; qualifying hybrid keyword hits are not discarded by cosine alone |
| `ALLOW_LIVE_AI_EVAL` | Off by default; exact 1 plus explicit opt-in/case selection needed for live evaluation |
| `FRESH_DATABASE_URL` | Operator-only empty-database setup target; not a runtime credential |
| `NODE_ENV` | Managed by Next.js commands; production enables Secure session-cookie behavior |

The Gemini implementation uses `gemini-3.5-flash-lite`; there is no Gemini model environment selector. Only the selected provider key is required. Keep the installation's existing selection/model/pacing; do not change them merely to run this guide. Provider access is project-specific; a recorded Gemini free-tier 403 is an access restriction, not a reason for hidden fallback. Details: [provider integration](ai-providers.md).

## Startup and checks

Local development:

```bash
npm run dev
```

Open `http://localhost:3000`; create a new account or log in to the correct existing account. Legacy passwordless accounts need the explicit [operator enrollment procedure](day-7-authentication.md), not reassignment of their data. A different host/port must agree with APP_ORIGIN.

Non-live regression and build commands:

```bash
npm test
npm run test:fresh-db
npx tsc --noEmit
npm run lint
npm run build -- --webpack
npm run security:check
```

`test:fresh-db` starts/removes only its own private PostgreSQL cluster under /tmp, disables TCP, applies migrations and runs database-enabled tests with fictional fixtures. It needs PostgreSQL 18 binaries at `/usr/lib/postgresql/18/bin/` and installed pgvector. The new CSV lifecycle integration test specifically refuses non-disposable database names. Do not manually enable its flag against the existing database.

The default Node suite is mocked where appropriate and does not opt into live providers. Optional database flags and the existing-schema temporary-table suite are described in [deployment checks](deployment.md). Optional browser variables are `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `UI_BASE_URL`; browser full-stack fixture controls are documented in [Day 8 verification](day-8-final-verification.md). Use `QA_SKIP_LIVE_AI=1` for that full-stack smoke unless live requests are explicitly intended and authorized. Do not point fixture/session operations at real accounts.

Offline evaluation commands, with no live-provider requests by default:

```bash
npm run evaluate
npm run evaluate:answers
npm run evaluate:performance
```

Real retrieval evaluation needs isolated PostgreSQL/Ollama and explicit options; see [evaluation instructions](evaluation/README.md) and [retrieval report](evaluation/retrieval-quality.md). Live-provider evaluation is separately opt-in, quota-consuming and incomplete; setting a credential alone is not approval. No live command is required for handover.

For an approved staging production runtime, build with Webpack and then run `npm start` behind the configured HTTPS proxy. Keep private environment settings, persistent storage and source working directory consistent. Use a separate build checkout/copy if development is active. No standalone deployment image or infrastructure manifest is supplied.

## Documentation index

| Document | Use |
| --- | --- |
| [README](../README.md) | Entry point, local setup, configuration and full documentation index |
| [Final demo guide](final-demo-guide.md) | Fictional files, UI walkthrough, expected calculations and citations |
| [Final project report](final-project-report.md) | Consolidated implemented scope, evidence and readiness |
| [Final test cases](final-test-cases.md) | All 25 original questions; separate manual slots and test evidence |
| [Architecture](architecture.md) | Components, data flow and trust boundaries |
| [API](api.md) | Actual requests/responses, authentication/CSRF and errors |
| [Database](database.md) | Tables, migration sequence, ownership and lifecycle |
| [CSV lifecycle](day-10-csv-lifecycle.md) | Replacement, identical-content rejection, deletion and concurrency |
| [Fresh setup/security](day-10-fresh-setup-security-review.md) | Disposable installation evidence and security limits |
| [Git review](day-10-github-review.md) | Historical snapshot review and staging guidance |
| [Deployment](deployment.md) | Supported build, storage/proxy and operational prerequisites |
| [Evaluation summary](evaluation-summary.md) | Distinguishes mocks, real retrieval, local timings and live results |
| [Evaluation framework](evaluation/README.md) | Fixtures, reproducible runners and opt-in behavior |
| [Answer quality](evaluation/answer-quality.md) | Human rubric and incomplete live correctness review |
| [Performance/reliability](evaluation/performance-reliability.md) | Measured timings versus injected failure tests |

Historical day reports retain their original dates/results. Use current API/code and later follow-ups where those reports describe older development-only restrictions or unavailable features.

## Deployment-readiness status

Suitable for further **controlled staging acceptance**, not certified for public production. Latest recorded CSV-identical follow-up: 222/222 disposable-database tests, standard suite 214 passed/eight optional skips, 20/20 mocked Datasets browser cases, TypeScript/ESLint/Webpack passed. These are retained results, not fresh handover test runs or live accuracy percentages.

Day 8 recorded two successful live fictional Groq workflows. Later private-question post-fix live acceptance remains unresolved. **Full live 25-case AI accuracy and human semantic/citation review are incomplete.** See the final report/test register before presenting an overall quality claim.

Before release, assign owners for HTTPS/exact Origin, private PostgreSQL/Ollama network access, persistent file storage, database-and-file backups/restore tests, safe logs/alerts, cleanup/reconciliation, session/rate-record retention and rollback. Verify PDF worker deployment tracing as described in deployment documentation. Infrastructure and remote repository security were not inspected through a live deployment in this task.

## Known limitations and future improvements

- Authentication lacks email verification, recovery/change UI, MFA and administrative account lifecycle controls. Duplicate signup can reveal registration status.
- CSV discovery is capped at 100 datasets without pagination. CSV replacement has no history/undo or optimistic revision check; last successful different-content writer wins. Ordinary uploads allow duplicates; only replacement compares parsed schema/ordered rows for identical content.
- Document cleanup can remain pending; scheduled reconciliation is not supplied. Local files require persistent private storage and coordinated backups.
- Source/quote membership checks preserve provenance but do not prove every claim follows logically from the evidence. Complete the human review rubric and current live tests before claiming answer accuracy.
- Provider pacing is process-local, not shared across workers. RPM controls do not enforce all token/daily quotas. Cold starts, sustained load and production capacity remain unmeasured.
- Chat history stays in the page session; questions do not include previous-turn context. No persistent chat history, conversation export or document-download API exists.
- Newly ingested chunks may lack page metadata. Citations must not invent page numbers. Previously displayed/in-flight evidence cannot be retroactively revoked by deletion.
- Fresh setup has no incremental migration ledger or automatic recovery from partial setup; operators must review existing installations rather than replaying bootstrap scripts.

Prioritize documented acceptance gaps and operational controls before optional product expansion. No future feature is represented as implemented by this handover.

## Validation of this delivery

Checked all local Markdown file targets across the 213-file proposed manifest (280 links) and section anchors in the changed guides; no missing files/anchors were found. Checked documented npm commands against package.json and fixture command inputs against repository paths. Independently calculated the demo CSV totals: original COUNT 3/SUM 36/AVG 12, revised COUNT 3/SUM 45/AVG 15, with the grouped totals stated in the demo guide. `git diff --check` and the existing repository security scan passed with zero detected secret patterns. The remote/branch summary comes from local Git configuration only.

Startup, database initialization, builds, application tests and live AI were **not executed in this documentation task**. The earlier reported results remain dated evidence. Provider entitlement, live endpoint availability, deployment infrastructure and a completed manual/live acceptance run remain handover gaps.
