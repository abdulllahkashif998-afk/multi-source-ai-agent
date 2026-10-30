# Multi-Source AI Knowledge & Data Intelligence Agent

An authenticated workspace for asking questions about PDF/DOCX documents and querying CSV datasets. Document answers use retrieved evidence; the multi-source agent can combine document policies with structured CSV calculations and return source references.

Includes the Day 10 delivery work, including generic CSV lifecycle management. Suitable for **controlled staging after the checks below**, not certified for public production. All 25 original live cases were executed, including one provider failure without a final answer. Three later deterministic operations passed authenticated browser acceptance. These are separate evidence streams; human-reviewed benchmark accuracy remains pending.

## Features

- Signup/login/logout, eight-hour server sessions, HTTP-only cookies and session-bound CSRF protection.
- PDF/DOCX upload, owner-scoped listing, SHA-256 duplicate detection, explicit replacement/versioning, deletion and deferred file cleanup.
- BGE embeddings through Ollama; PostgreSQL cosine and full-text search fused with Reciprocal Rank Fusion (RRF).
- Generic CSV upload/type inference, schema discovery, atomic replacement with identical-content rejection, deletion and validated filtering, sorting, COUNT/SUM/AVG and GROUP BY.
- Document RAG and a bounded multi-source agent using either Gemini or Groq, without automatic provider fallback. Narrow validated deterministic operations handle supported listings and policy/data comparisons without extra model calls.
- Responsive Documents, Datasets and AI Chat pages; safe text rendering, citations and in-page conversation history.
- Structured safe diagnostics, provider pacing/deadlines, Groq token/request budgets coordinated through a private same-host ledger, and reproducible fictional evaluation fixtures.

Web crawling was not part of the requirements and is not implemented; the knowledge sources are uploaded documents and CSV datasets.

## Architecture and stack

```mermaid
flowchart LR
  Browser[Next.js dashboard] --> API[Authenticated root app/api routes]
  API --> PG[(PostgreSQL + pgvector)]
  API --> Disk[Private local document storage]
  API --> Ollama[Ollama / BGE 768 dimensions]
  API --> LLM[Selected Gemini or Groq provider]
  PG --> Evidence[Owned document and CSV evidence]
  Evidence --> LLM
```

Next.js 16.4.2, React 19, TypeScript, Tailwind CSS 4/PostCSS, Node.js 22, PostgreSQL 18.6, pgvector 0.8.1, AI SDK 7 with official Google/Groq adapters, `pg`, Zod 4, `pdf-parse`, Mammoth and `csv-parse`. Versions are recorded in [package.json](package.json) and the lockfile.

## Prerequisites and local setup

1. Use Node.js **22.17 or later in the 22.x line** (verified: 22.22.3), npm, PostgreSQL 18 with pgvector, and a running Ollama service. A valid credential/access entitlement for the selected AI provider is needed for actual answers.
2. Install the locked dependencies from this repository:

   ```bash
   npm ci
   ```

3. Provision a private application database and restricted application role. Migrations 001–009 now support an empty database. Use a separate administrator connection for initial setup; never run the fresh installer against the existing application database. See [database setup and migration inventory](docs/database.md). Never replay migrations blindly against an existing database.
4. With the pgvector extension installed on the PostgreSQL server, an authorized database administrator can enable it in a new approved database using `CREATE EXTENSION IF NOT EXISTS vector;`. Confirm with read-only SQL:

   ```sql
   SELECT version();
   SELECT extversion FROM pg_extension WHERE extname = 'vector';
   SELECT format_type(atttypid, atttypmod)
   FROM pg_attribute
   WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding';
   ```

   The embedding column must be `vector(768)`. For a fresh, empty database, run `FRESH_DATABASE_URL="postgresql://MIGRATION_USER:REPLACE_LOCALLY@localhost/new_database" npm run db:setup:fresh -- --confirm-empty-database new_database`. Supply real credentials privately through your environment. The command refuses existing objects and runs 001–009 in order. Migration 007 runs outside a transaction. Existing installations require separate catalog review; do not replay the sequence.
5. Start Ollama using your installation's service manager (or `ollama serve` if not already running), then install the existing embedding model:

   ```bash
   ollama pull hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0
   ollama list
   ```

   Do not change the model/dimension for existing embeddings without a separately reviewed migration/re-embedding plan. Do not run the maintenance re-embedding script as setup.
6. Create a private `.env.local`. Copy [the secret-free example](.env.example) **only if it does not overwrite existing settings**, then add the database and origin settings below. Never commit this file.

   ```dotenv
   DATABASE_URL=postgresql://APP_USER:REPLACE_LOCALLY@127.0.0.1:5432/APP_DATABASE
   APP_ORIGIN=http://localhost:3000
   OLLAMA_BASE_URL=http://localhost:11434
   EMBEDDING_MODEL=hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0
   AI_PROVIDER=groq
   GROQ_API_KEY=REPLACE_LOCALLY
   GROQ_MODEL=openai/gpt-oss-20b
   GROQ_REQUESTS_PER_MINUTE=12
   DOCUMENT_SEARCH_MODE=hybrid
   RAG_MIN_SIMILARITY=0.5
   ```

   These are placeholders, not usable credentials. Percent-encode special characters in database credentials. Only the selected provider's key is required. To select Gemini, set `AI_PROVIDER=gemini`, supply `GOOGLE_GENERATIVE_AI_API_KEY` and retain `GEMINI_REQUESTS_PER_MINUTE=12`. The implemented Gemini model ID is fixed to `gemini-3.5-flash-lite`; Groq permits `openai/gpt-oss-20b` or `openai/gpt-oss-120b`. Provider access depends on the account/project; Gemini's confirmed free-tier denial is documented in [provider notes](docs/ai-providers.md). No automatic fallback occurs.
7. Start the application:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign up, then use `/dashboard/documents`, `/dashboard/datasets` and `/dashboard/chat`. A different port requires a matching `APP_ORIGIN`. Existing user records are not transferred to newly created accounts; passwordless legacy accounts require the explicit operator enrollment procedure in [the authentication guide](docs/day-7-authentication.md).

Document storage is `storage/uploads` under the process working directory, created privately as needed. Run from a consistent directory with writable persistent storage. Raw files are not publicly served. CSV management uses `/api/datasets`; the older CSV branch of `/api/upload` is a separate employee-leave importer.

## Environment reference

All application settings below are server-side. Restart after changing them; never use `NEXT_PUBLIC_` for credentials.

| Variable | Default / requirement |
| --- | --- |
| `DATABASE_URL` | Required local/deployment database connection; `pg` otherwise falls back to its own environment defaults, which should not be relied on |
| `APP_ORIGIN` | Local default `http://localhost:3000`; explicit HTTPS origin required in production, no trailing slash |
| `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `EMBEDDING_MODEL` | BGE model identifier shown above; 768 finite values required |
| `AI_PROVIDER` | `gemini`; supported values `gemini`, `groq` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Required when Gemini is selected |
| `GROQ_API_KEY` | Required when Groq is selected |
| `GROQ_MODEL` | `openai/gpt-oss-20b`; allowlisted alternative `openai/gpt-oss-120b` |
| `GEMINI_REQUESTS_PER_MINUTE` | `12`; integer 1–14 allowed |
| `GROQ_REQUESTS_PER_MINUTE` | Conservative dispatch pacing: `12`; integer 1–29 allowed; separate ledger caps use RPM 30/TPM 8000/RPD 1000/TPD 200000 |
| `GROQ_QUOTA_DIRECTORY` | Private persistent `storage/groq-quota`; same-host workers must share this directory/UID; never put it under public storage |
| `DOCUMENT_SEARCH_MODE` | `hybrid`; optional `semantic` for comparisons |
| `RAG_MIN_SIMILARITY` | `0.5`, finite range 0–1; keyword-qualified hybrid hits can bypass cosine cutoff |
| `ALLOW_LIVE_AI_EVAL` | Unset/off; exact `1` plus explicit case selection required for live evaluation |

`NODE_ENV=production` is set by the production runtime and changes cookie security. Optional database-test flags are documented below, not application settings. There is no environment-configurable storage directory or Gemini model selector in the current code.

## Tests, evaluation and production build

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
# After build, on an approved HTTPS deployment:
npm start
```

The supported Webpack build avoids the previously recorded Turbopack sandbox worker-port limitation. It includes PDF worker tracing. Building in a separate copy preserves an active development server's `.next` cache. `npm run build` alone uses the default Next.js bundler; its environmental limitation is not a reason to change styling or security settings.

Optional database tests use isolated temporary fixtures; they need the existing schema and a role allowed to create temporary tables:

```bash
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

Default evaluation commands consume no external AI quota:

```bash
npm run evaluate
npm run evaluate:answers
npm run evaluate:performance
```

Real retrieval/local performance modes require PostgreSQL and Ollama; see [evaluation summary](docs/evaluation-summary.md). Live-provider evaluation is opt-in only. Do not import evaluation pool-patching helpers into the application server.

Latest implementation verification: **249/249 database-enabled tests**, standard suite **239 passed/10 optional database skips**, TypeScript/ESLint/Webpack passed. Final real authenticated browser acceptance passed **csv-05, combined-04 and combined-05**, with verified document/CSV citations, ownership/CSRF checks and desktop/mobile screenshots; zero Groq calls. See [final delivery checks](docs/final-delivery-readiness.md) for tests actually rerun in this documentation pass.

| Evidence | Preserved outcome |
| --- | --- |
| Original 25 live Groq cases | Automatic 22 pass/3 fail; formal 4 pass/3 fail/18 needs-review; 95 requests, 97,440 known tokens plus one unknown-usage failure |
| Subsequent six-case live Groq retest | Automatic 5 pass/1 fail; formal 0 pass/1 fail/5 needs-review; 24 requests, 28,393 known tokens plus one unknown-usage failure |
| Deterministic PostgreSQL/BGE verification | Three supported operations verified; no Groq inference |
| Authenticated browser acceptance | Three cases Passed, separate from original benchmark classifications |
| Human semantic review | Pending; zero submitted reviewer decisions |

Historical application validation (Day 9 Step 4): **184/184 database-enabled tests passed**, standard suite **178 passed/six optional skips**, TypeScript/ESLint/Webpack passed. Day 8 additionally recorded 62 mocked browser checks and limited real HTTPS acceptance with two live Groq questions. These historical results are distinct from this documentation pass and are not a full live accuracy benchmark.

## Documentation

| Guide | Contents |
| --- | --- |
| [Shared quota-aware admission](docs/evaluation/quota-aware-admission/report.md) | Bounded waiting/retry guidance for both modes, verified tests and current deadline limitations |
| [Final rate-limit investigation](docs/evaluation/final-rate-limit-investigation/report.md) | Exact 5742.5ms trace, reconciled token evidence, bounded tool-list correction and unresolved live limits |
| [General agent submission stabilization](docs/evaluation/general-agent-stabilization/report.md) | Bounded request-local schemas, planner reservation reduction, mocked general-path checks and submission limits |
| [Consecutive SLA questions and counts](docs/evaluation/sla-count-reliability/report.md) | Zero-Groq all-priority counts, equality handling, isolated API and real-data sequence verification |
| [Short SLA question reliability](docs/evaluation/short-sla-reliability/report.md) | Conservative policy/dataset discovery, zero-Groq real-data verification and quota diagnosis |
| [Real-account SLA abstention correction](docs/evaluation/sla-abstention-fix/report.md) | Named-file retrieval, contextual scope checks and verified real-data answer without Groq |
| [SLA failure diagnosis and local acceptance](docs/evaluation/sla-application-fix/report.md) | Confirmed local TPM/502 defect, targeted fixes, 280-test verification and fictional browser evidence |
| [Quota, evidence and SLA reliability](docs/agent-quota-evidence-sla-reliability.md) | Shared-host budget guards, combined citations, typed SLA operations and current limits |
| [Final delivery readiness](docs/final-delivery-readiness.md) | Current checks, all pending Git paths, security/exclusions and remaining approval/replay gaps |
| [Authenticated browser acceptance](docs/evaluation/authenticated-operations-acceptance/report.md) | Three Passed cases, actual answers, citation/ownership checks and six screenshots |
| [Deterministic operation resolution](docs/agent-remaining-failures-resolution.md) | Typed filtering/sorting/arithmetic, safety boundaries and remaining provider uncertainty |
| [Six-case live Groq retest](docs/evaluation/final-live/retest-01/report.md) | Separate real-provider outcomes before deterministic resolution; original results retained |
| [Final demo guide](docs/final-demo-guide.md) | Fictional-data walkthrough, expected results and citation checks |
| [Project handover](docs/project-handover.md) | Repository, setup, configuration, testing and deployment limits |
| [Final project report](docs/final-project-report.md) | Consolidated implementation, verified evidence and readiness limits |
| [All 25 real benchmark executions](docs/evaluation/final-live/batch-03/report.md) | Actual responses/failures, 95 requests, scoring caveats and pending human review |
| [Live Groq batch 02](docs/evaluation/final-live/batch-02/report.md) | Five new cases; cumulative 8/25, actual usage and conflict-review finding |
| [Real Groq pilot](docs/evaluation/final-live/report.md) | Three approved original cases, actual responses/citations/usage and pending human review |
| [Final test cases](docs/final-test-cases.md) | All 25 original benchmark questions, 16 separate manual slots and functional/security/reliability evidence |
| [Architecture](docs/architecture.md) | Components, four data flows, retrieval, agent and security boundaries |
| [API](docs/api.md) | Actual endpoint contracts, sessions/CSRF, errors and pagination |
| [Database](docs/database.md) | Tables, relationships, migration inventory and lifecycle |
| [Evaluation summary](docs/evaluation-summary.md) | Measured metrics, evidence types and incomplete answer review |
| [Testing and deployment](docs/deployment.md) | Reproducible checks and controlled-staging prerequisites |
| [Documentation validation](docs/documentation-validation.md) | Scope, checks, consistency decisions and remaining gaps |
| [Day 8 final verification](docs/day-8-final-verification.md) | Historical browser/full-stack evidence and acceptance checklist |
| [Day 9 evaluation framework](docs/evaluation/README.md) | Fixtures, runner options, privacy and opt-in usage |

Earlier day/phase reports remain research history. When their development-only authentication or feature descriptions differ, use these current guides and source code; historical test counts remain dated observations.

## Known limitations

Fresh bootstrap is verified on PostgreSQL 18 with pgvector installed; it is not an incremental migration manager. Authentication lacks email verification, account recovery/change UI and MFA. CSV discovery is capped at 100 datasets without pagination. Owned generic datasets support atomic replacement and deletion; replacement has no version history. New document ingestion does not extract chunk-level page numbers. There is no persistent chat history or download API. Citation verification proves source/quote membership, not logical entailment. General Groq tool-use failures may still occur. Prompt-based reasoning guardrails are not deterministic semantic verification. The narrow deterministic operation grammars can abstain on unsupported schemas/rules, ambiguity, truncated output or more than eight result entities.

Dispatch pacing is process-local; Groq request/token budgets are now reserved and reconciled in a private ledger shared by same-host workers using the same directory. It is not global organization-wide coordination and cannot account for unrelated applications, unknown pre-rollout usage or unshared hosts. Local file persistence, cleanup/orphan handling, backups, HTTPS/proxy settings and privileged operator access require deployment review. Warm tiny-corpus tests do not establish production capacity. Live execution coverage is complete; full human-reviewed AI correctness and semantic review remain incomplete. Day 10 fresh-database verification is documented in [the setup/security report](docs/day-10-fresh-setup-security-review.md); repository preparation is documented in [the GitHub review](docs/day-10-github-review.md).

CSV replacement/deletion APIs, browser actions and acceptance steps: [Dataset lifecycle](docs/day-10-csv-lifecycle.md).

## Final submission status — 30 October 2026

See the [final submission review](docs/submission-final/report.md) for current validation, quota evidence, requirement coverage and delivery risks. Document citation excerpts now open by default. Qualified row-policy counts preserve unknown applicability instead of asserting complete totals. Later Tests 16–19 are user-reported passes (18 retried); Test 20 remains blocked by rate limiting. These do not overwrite original benchmark outcomes.
