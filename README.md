# Multi-Source AI Knowledge & Data Intelligence Agent

An authenticated workspace for asking questions about PDF/DOCX documents and querying CSV datasets. Document answers use retrieved evidence; the multi-source agent can combine document policies with structured CSV calculations and return source references.

Implemented through Day 9 Step 5. Suitable for **controlled staging after the checks below**, not certified for public production. The full live 25-case answer benchmark and human semantic review remain incomplete.

## Features

- Signup/login/logout, eight-hour server sessions, HTTP-only cookies and session-bound CSRF protection.
- PDF/DOCX upload, owner-scoped listing, SHA-256 duplicate detection, explicit replacement/versioning, deletion and deferred file cleanup.
- BGE embeddings through Ollama; PostgreSQL cosine and full-text search fused with Reciprocal Rank Fusion (RRF).
- Generic CSV upload/type inference, schema discovery and validated filtering, sorting, COUNT/SUM/AVG and GROUP BY.
- Document RAG and a bounded multi-source agent using either Gemini or Groq, without automatic provider fallback.
- Responsive Documents, Datasets and AI Chat pages; safe text rendering, citations and in-page conversation history.
- Structured safe diagnostics, provider pacing/deadlines and reproducible fictional evaluation fixtures.

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
| `GROQ_REQUESTS_PER_MINUTE` | `12`; integer 1–29 allowed; account/token/daily quotas can be lower |
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

Historical application validation (Day 9 Step 4): **184/184 database-enabled tests passed**, standard suite **178 passed/six optional skips**, TypeScript/ESLint/Webpack passed. Day 8 additionally recorded 62 mocked browser checks and limited real HTTPS acceptance with two live Groq questions. These historical results are distinct from this documentation pass and are not a full live accuracy benchmark.

## Documentation

| Guide | Contents |
| --- | --- |
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

Fresh bootstrap is verified on PostgreSQL 18 with pgvector installed; it is not an incremental migration manager. Authentication lacks email verification, account recovery/change UI and MFA. CSV discovery is capped at 100 datasets without pagination. Owned generic datasets support atomic replacement and deletion; replacement has no version history. New document ingestion does not extract chunk-level page numbers. There is no persistent chat history or download API. Citation verification proves source/quote membership, not logical entailment.

Provider pacing is process-local, not a distributed quota coordinator; token/daily budgets are not proactively counted. Local file persistence, cleanup/orphan handling, backups, HTTPS/proxy settings and privileged operator access require deployment review. Warm tiny-corpus tests do not establish production capacity. Full live 25-case AI correctness and human semantic review remain incomplete. Day 10 fresh-database verification is documented in [the setup/security report](docs/day-10-fresh-setup-security-review.md); repository preparation is documented in [the GitHub review](docs/day-10-github-review.md).

CSV replacement/deletion APIs, browser actions and acceptance steps: [Dataset lifecycle](docs/day-10-csv-lifecycle.md).
