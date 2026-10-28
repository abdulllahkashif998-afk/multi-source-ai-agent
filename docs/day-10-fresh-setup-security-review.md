# Day 10 Step 3 — Fresh setup and security review

Verified on 28 October 2026. Scope: fresh installation and a targeted security review. No application behavior, AI models, citations, existing migrations 006–009 or existing database records were changed. No live provider calls, pushes or next-step work were performed.

## Issues found and changes

1. **Missing bootstrap:** only migrations 006–009 existed. Added ordered 001–005 based on the existing read-only catalog: vector extension, users, documents, 768-dimensional chunks and legacy CSV tables. Existing nullable fields, types, foreign keys and uniqueness are preserved. Later migrations add generic CSV, FTS, lifecycle and authentication.
2. **Unsafe installation ambiguity:** added `db:setup:fresh`, which requires a separate `FRESH_DATABASE_URL` and matching database-name confirmation. It refuses nonempty application schemas, reserved database names and the configured original database name when provided. An advisory lock prevents overlapping setup. It does not reset, repair or force migrations. Migration 007 executes without an enclosing transaction.
3. **Accidental upload/secret staging:** added ignore rules for local PDF/DOCX/CSV files, keys, database dumps, backups, logs and temporary outputs. Only the three reviewed fictional document fixtures are allowlisted. Existing files were not removed. `.env.example` remains included and contains placeholders only.
4. **Incomplete Git snapshot:** only 17 files are currently tracked; most implementation, tests, docs and migrations are untracked. A clone of the current commit is not the complete application. The owner must review and include intended files before distributing it. Nothing was staged, committed or pushed.
5. Expanded the example environment and corrected current README/database/deployment bootstrap instructions. Historical evaluation/research reports remain preserved.

## Actual fresh database verification

The existing application role cannot create databases or roles. Rather than changing it or using the working database, the test runner created a private PostgreSQL 18 cluster under a generated `/tmp/msai-fresh-*` directory. TCP was disabled; its Unix socket was confined to a private directory. The temporary local trust connection is only for this private test cluster, not a deployment authentication recommendation.

- Installed all nine migrations from empty; pgvector **0.8.1**.
- Verified **12 public tables**, **13 foreign keys**, embedding **vector(768)**.
- Verified FTS GIN, ready-document owner/hash uniqueness and normalized email uniqueness indexes.
- Created a separate test runtime role with table DML/sequence access; verified no superuser, CREATEDB, CREATEROLE or public-schema CREATE privileges.
- Refused a nonempty second setup attempt.
- Ran all database-enabled regressions with fictional fixtures: real PostgreSQL authentication/session operations, A/B evidence isolation, transactional lifecycle/replacement, deletion exclusion, generic CSV queries and retrieval. Provider responses/embeddings used test doubles where supplied by the existing suites.
- Stopped and removed the private cluster in the runner's cleanup block. No current-server database or role was created or dropped.

This is not a full live document/Ollama/provider installation acceptance test. Fixture tables are temporary and do not represent production scale. Installation requires the PostgreSQL-compatible pgvector package already installed on the host. The helper currently expects PostgreSQL 18 binaries under `/usr/lib/postgresql/18/bin/`.

## Security findings

| Area | Review result / limitation |
| --- | --- |
| Authentication | Salted scrypt hashes; bounded concurrent hashing; generic invalid-login response; input limits; database-backed login throttles. Duplicate signup returns 409 and can reveal registration. Email verification, recovery and MFA remain absent. |
| Sessions | Random 32-byte session tokens; only SHA-256 token hashes stored; eight-hour expiry and server-side logout. Production cookie uses `__Host-`, Secure, HttpOnly, SameSite=Strict and Path=/. Development deliberately uses a non-Secure local cookie. |
| CSRF | Exact allowed Origin and cross-site checks; session-bound CSRF token required on authenticated writes; signup/login also check Origin. Production needs a correct HTTPS APP_ORIGIN and trusted proxy configuration. |
| Ownership | Identity comes from verified server sessions. Both retrieval branches filter owner and ready state before evidence reaches the model. Document lifecycle and generic CSV services enforce ownership; inaccessible private resources use safe errors. Existing source-isolation regressions passed. |
| SQL | Structured plans and allowlists, parameterized values/JSON keys, read-only query transactions, row limits and statement timeouts. No arbitrary model SQL interface. Isolation is enforced in application SQL, not PostgreSQL RLS. |
| Files | Backend-controlled private UUID storage and cleanup paths, restrictive permissions, path/symlink checks. Clients cannot choose storage paths. Cleanup failures retain retrieval exclusion. |
| Secrets | Read-only pattern scan: 202 intended working files and 203 reachable Git-history blobs; zero detected credential patterns. Checks cover recognizable Google/Groq keys, private-key headers and credentialed PostgreSQL URLs. No values are printed. This is not proof against every secret format, binary asset or inaccessible history. |
| Operations | Separate schema-owner/runtime credentials are recommended and exercised by the temporary test. Production TLS, network isolation, backups/restore, log access/retention, monitoring, account controls and shared multi-worker limits remain operator responsibilities. |

No confirmed authentication, authorization or SQL-control regression was found. No security check was weakened. Existing process-local provider pacing is not a distributed quota manager. Expired session/rate-limit record pruning and account lifecycle operations remain operational gaps.

## Commands and actual results

| Check | Result |
| --- | --- |
| `npm run test:fresh-db` | **211 passed, 0 failed, 0 skipped**; final run 17.02 seconds for tests, excluding cluster setup |
| `npm test` | **204 passed, 0 failed, 7 optional database tests skipped**; 211 total, 7.24 seconds |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npx next build --webpack` | Passed in an isolated source copy without application credentials; all 24 pages generated |
| `npm run security:check` | Passed; zero pattern findings; reports untracked-source limitation separately |
| Changed-document local file links | Passed |
| Original database comparison | Before/after counts and row digests identical across all **12** public application tables |

The build emitted safe 503 diagnostics while prerendering with no application environment. It completed successfully; this does not verify runtime service connectivity. No Next.js defect was confirmed.

## Manual installation checklist

1. Install supported Node, PostgreSQL 18 and pgvector; follow [README](../README.md) and [database reference](database.md).
2. Provision a **new empty database**, distinct from any existing application database, using administrator credentials supplied privately.
3. Set `FRESH_DATABASE_URL` privately; run `npm run db:setup:fresh -- --confirm-empty-database new_database`, matching the actual lower-case URL database name. Never set it to the existing application database.
4. Create a separate restricted runtime role and grants described in the database reference. Use its URL as `DATABASE_URL` in a private environment file based on `.env.example`.
5. Configure APP_ORIGIN, provider credentials and local Ollama/BGE according to the existing guides; do not change model dimensions for existing embeddings.
6. Run tests, TypeScript, lint and `npx next build --webpack`. Optionally run `npm run test:fresh-db` for a disposable isolated database check.
7. In controlled staging, verify signup/login/logout, two-user document/CSV isolation, CSRF rejection and fictional upload/query flows. Live AI checks require separate explicit authorization where personal content could leave the server.
8. Review intended untracked files before creating a release. Confirm backups, HTTPS, private database/Ollama connectivity and monitoring before deployment.

## Changed files for this step

- `migrations/001-vector-extension.sql` through `005-legacy-csv.sql`.
- `src/scripts/setup-fresh-db.ts`, `test-fresh-database.ts`, `check-repository-security.ts`.
- `tests/fresh-setup.test.ts` (three focused guard/order/scanner tests).
- `package.json`, `.gitignore`, `.env.example`.
- `README.md`, `docs/database.md`, `docs/deployment.md`, this report.

The workspace already contained extensive changes from earlier steps; they were preserved. Fresh bootstrap is verified, but this is **not public-production approval**. No incremental migration ledger or automated partial-install recovery is provided; existing installations require catalog review and individually approved missing migrations.
