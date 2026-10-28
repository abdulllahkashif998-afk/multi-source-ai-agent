# Day 7 Phase 3: authentication and authorization

## Choice and scope

Selected opaque PostgreSQL sessions and Node.js scrypt for this password-only backend. Auth.js provides a valuable provider/OAuth ecosystem, but its [credentials provider](https://authjs.dev/getting-started/authentication/credentials) still requires application-owned password persistence and controls. A small session table integrates with the existing bigint users table, permits immediate server-side logout, and avoids changing existing owner IDs or adding an OAuth provider. Future OAuth/passkey requirements should prompt reassessment rather than expanding this custom module indefinitely.

Password hashing follows the [OWASP scrypt recommendation](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): N=131072, r=8, p=1, random 128-bit salts, 64-byte derived keys. Passwords are 12–128 characters. Verification uses timingSafeEqual; unknown/passwordless accounts receive the same-cost dummy check and the same invalid-credentials message. Plaintext passwords are never stored or logged.

Sessions follow [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): random 256-bit tokens, only SHA-256 token hashes persisted, absolute eight-hour expiry checked in PostgreSQL, and server-side logout revocation. Password hashing is intentionally slow; random session token verification can safely use a fast hash.

## Setup and endpoints

Set APP_ORIGIN to the exact public origin, without a trailing slash. Development defaults to http://localhost:3000. Use that origin consistently; 127.0.0.1 and localhost are different origins and cookie hosts.

```dotenv
# Local development:
APP_ORIGIN=http://localhost:3000
# Production example, with NODE_ENV=production:
# APP_ORIGIN=https://knowledge.example.com
```

Production requires an explicit HTTPS APP_ORIGIN. Do not derive this setting from untrusted forwarding/Host headers. Deploy behind HTTPS with a correctly configured trusted reverse proxy.

| Endpoint | Request | Result |
| --- | --- | --- |
| POST /api/auth/signup | JSON name, email, password; Origin required | Creates a new user and session; 201 |
| POST /api/auth/login | JSON email, password; Origin required | Verifies credentials, rotates the browser's existing session; 200 |
| GET /api/auth/session | Session cookie | Own userId/name/email plus CSRF token; 200 |
| POST /api/auth/logout | Cookie, Origin, X-CSRF-Token | Revokes current session and clears cookie; 200 |

Signup/login JSON is bounded to 8 KiB and rejects unknown fields. Emails are normalized to lowercase. Signup of an existing normalized email returns 409 ACCOUNT_EXISTS, including passwordless retained accounts; it cannot claim them. Login uses a generic 401 INVALID_CREDENTIALS response. Session failures return 401 UNAUTHENTICATED; origin/CSRF failures return 403 CSRF_REJECTED. Missing server configuration returns 503. Responses have Cache-Control: no-store. No raw passwords, session tokens, provider bodies or database errors are logged.

Production uses __Host-knowledge-session with Secure, HttpOnly, SameSite=Strict, Path=/ and no Domain. Development uses knowledge-session and permits HTTP for local testing only. Never expose the development server as a production service. Session identifiers are accepted exclusively from the cookie, not URLs, body fields or client user-ID headers. Duplicate or malformed session cookies are rejected.

For every authenticated POST/PUT/DELETE, including chat and agent calls, send Origin matching APP_ORIGIN and X-CSRF-Token matching the current session. The token is returned by signup/login or the same-origin session GET. SameSite is defense in depth; token verification and origin checks are also required. Signup/login are protected against login CSRF by exact Origin checking and JSON-only requests. There is no permissive CORS policy. See [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Auth attempts are persisted and limited to 10 per normalized email and 100 globally per 15-minute window. At most two password hashes run concurrently per process. This bounds expensive hashing and guessing; global throttling can also affect legitimate users during abuse, so production still needs edge-level controls and monitoring.

## Ownership flow

An authenticated route verifies the database session and enters a request-local AsyncLocalStorage scope containing the server-derived bigint user ID as a string. No default identity exists. Backend functions fail without this scope. Owner parameters retained by CSV helpers must match it; they do not confer authority on their own.

- Upload and lifecycle services use the verified owner for inserts, hash duplicate checks, version operations, deletion and cleanup. Advisory locks remain owner-scoped, using a hash of the bigint owner string rather than an int32 conversion.
- Both semantic and keyword branches scope ready documents before returning original chunks or citations. Chat and agent handlers verify the session before question processing, retrieval or Gemini calls.
- Agent discovery returns only owned ready datasets. Schema inspection requires discovery first, and structured queries recheck the authenticated owner inside the existing read-only transaction.
- Generic CSV uploads/discovery/querying remain parameterized and bounded. New legacy employee CSV uploads now set csv_datasets.uploaded_by to the verified owner. Existing null legacy owners are left null and are not exposed through a new reader.
- File cleanup joins queued jobs to the current owner's retired/deleted documents. Clients still cannot supply arbitrary file paths. Existing path and UUID checks remain.
- Old db-test, test-csv and test-search development diagnostics now return 404. They exposed database details/shared fixtures or bypassed the authenticated product flow. Use product APIs and the explicit operator retrieval comparison command instead.

Other users' document IDs return 404 for replacement/deletion. Inaccessible datasets return a generic 404 response; their schemas/rows are not sent to Gemini. Documents absent from a user's corpus yield no evidence rather than revealing that another user owns them. As before, exact quote verification establishes provenance rather than logical entailment.

getChatConfig no longer blocks production merely because NODE_ENV=production; authenticated route guards now provide that protection. The Gemini model, key name, generation settings, BGE model, hybrid ranking, SQL validation, lifecycle transactions and citation checks were not changed.

## Additive migration and retained account

Applied migrations/009-authentication.sql after inspecting users, ownership columns and constraints and checking case-normalization conflicts. It adds a unique lower(email) index, auth_credentials, auth_sessions with owner/expiry indexes, and auth_rate_limits. It does not change existing user rows, passwords, document owners, dataset owners or content. No existing password is invented. Apply once to other databases; review any case-insensitive email conflicts rather than merging users automatically.

Existing user 1 remains passwordless until a trusted database operator explicitly enrolls it. There is no public enrollment/reset endpoint for existing accounts. To retain it as an archive, do nothing. To use its existing records, verify its exact ID/email in the database, then use the CLI below. It adds credentials to that same ID and refuses to overwrite existing credentials. It does not transfer any document or CSV ownership.

Run in Bash so read -s hides the password; do not place a real password in command arguments or shell history:

```bash
read -r -s -p 'New password for verified existing account: ' AUTH_ENROLL_PASSWORD
printf '\n'
printf '%s' "$AUTH_ENROLL_PASSWORD" | node --conditions=react-server --env-file=.env.local --require tsx/cjs src/scripts/enroll-existing-account.ts 1 VERIFIED_EXISTING_EMAIL
unset AUTH_ENROLL_PASSWORD
```

Replace VERIFIED_EXISTING_EMAIL with the existing account's exact email. Enrollment was not executed automatically. The CLI is a trusted offline operator action requiring database credentials, not an API that accepts a user ID from a client.

The retrieval comparison script now also requires an explicit operator owner ID:

```bash
node --env-file=.env.local --require tsx/cjs src/scripts/compare-document-search.ts 'minimum sales target' VERIFIED_OWNER_ID
```

## Manual signup/login/isolation commands

Use new fictional accounts and avoid printing or sharing cookie jars. The following helper reads passwords interactively and sends them through stdin, not process arguments:

```bash
umask 077
AUTH_BASE=http://localhost:3000
AUTH_ORIGIN=http://localhost:3000
# First register A. Use a fresh email if this fictional account already exists.
read -r -s -p 'A password (12–128 characters): ' AUTH_PASSWORD
printf '\n'
AUTH_A_RESPONSE=$(printf '%s' "$AUTH_PASSWORD" | node -e '
 let password="";process.stdin.on("data",c=>password+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({name:"Fictional A",email:"user-a@example.test",password})));
' | curl -sS -c /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H 'Content-Type: application/json' --data-binary @- "$AUTH_BASE/api/auth/signup")
unset AUTH_PASSWORD
AUTH_A_CSRF=$(printf '%s' "$AUTH_A_RESPONSE" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).csrfToken||""))')

# Register B separately.
read -r -s -p 'B password (12–128 characters): ' AUTH_PASSWORD
printf '\n'
AUTH_B_RESPONSE=$(printf '%s' "$AUTH_PASSWORD" | node -e '
 let password="";process.stdin.on("data",c=>password+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({name:"Fictional B",email:"user-b@example.test",password})));
' | curl -sS -c /tmp/knowledge-b.cookies -H "Origin: $AUTH_ORIGIN" -H 'Content-Type: application/json' --data-binary @- "$AUTH_BASE/api/auth/signup")
unset AUTH_PASSWORD
AUTH_B_CSRF=$(printf '%s' "$AUTH_B_RESPONSE" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).csrfToken||""))')

# Login A again: credentials rotate the current browser session and CSRF token.
read -r -s -p 'A password again: ' AUTH_PASSWORD
printf '\n'
AUTH_A_RESPONSE=$(printf '%s' "$AUTH_PASSWORD" | node -e '
 let password="";process.stdin.on("data",c=>password+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({email:"user-a@example.test",password})));
' | curl -sS -b /tmp/knowledge-a.cookies -c /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H 'Content-Type: application/json' --data-binary @- "$AUTH_BASE/api/auth/login")
unset AUTH_PASSWORD
AUTH_A_CSRF=$(printf '%s' "$AUTH_A_RESPONSE" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).csrfToken||""))')

curl -sS -b /tmp/knowledge-a.cookies "$AUTH_BASE/api/auth/session"
curl -sS "$AUTH_BASE/api/datasets"  # expect 401 without a cookie
printf 'team,amount\nAlpha,10\n' > /tmp/knowledge-private-a.csv
curl -sS -b /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_A_CSRF" -F file=@/tmp/knowledge-private-a.csv "$AUTH_BASE/api/datasets"
# Copy this NEW dataset ID for the isolation request below.
AUTH_A_DATASET_ID=NEW_DATASET_ID_FROM_A
curl -sS -b /tmp/knowledge-b.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_B_CSRF" -H 'Content-Type: application/json' -d "{\"datasetId\":\"$AUTH_A_DATASET_ID\"}" "$AUTH_BASE/api/datasets/query"
# Expect 404; B discovery must also omit A's dataset.

curl -sS -b /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_A_CSRF" -F file=@/tmp/NEW_FICTIONAL_DOCUMENT.docx "$AUTH_BASE/api/upload"
# For this NEW document ID, repeat PUT/DELETE with B's cookie/CSRF: expect 404.
# Use the Day 7 lifecycle guide to generate fictional DOCX files, not real private data.

curl -sS -b /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_A_CSRF" -H 'Content-Type: application/json' -d '{"question":"What does my fictional document say?"}' "$AUTH_BASE/api/chat"
curl -sS -b /tmp/knowledge-b.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_B_CSRF" -H 'Content-Type: application/json' -d '{"question":"What does that fictional document say?"}' "$AUTH_BASE/api/agent"
# A sees only A evidence; B must never receive A text or citations.

curl -sS -b /tmp/knowledge-a.cookies -H "Origin: $AUTH_ORIGIN" -H "X-CSRF-Token: $AUTH_A_CSRF" -X POST "$AUTH_BASE/api/auth/logout"
curl -sS -b /tmp/knowledge-a.cookies "$AUTH_BASE/api/auth/session" # expect 401 for the revoked cookie
```

For CSRF checks, omit X-CSRF-Token or send Origin: https://attacker.example on an otherwise valid authenticated POST; expect 403 before tools run. Use the other session's CSRF token to verify binding. Automated tests cover expiry without changing real sessions. Do not edit another user's records to simulate isolation.

## Verification and remaining work

The regression fixtures now enter an explicit trusted test identity for backend-only tests, while HTTP tests supply verified-session database fixtures and CSRF headers. This does not introduce a runtime bypass. The new auth suite also tests anonymous requests with no such scope.

Database-inclusive tests create private temporary copies of all required tables, replace service transactions with savepoints, and roll back the outer transaction. They test actual signup/login/logout/expiry SQL, case-insensitive duplicates, retained passwordless accounts, user A/B document uploads, replacement/deletion denial, cleanup denial, dataset discovery/query denial, and both chat and agent source isolation through mocked Gemini transport. They assert that the other user's original text never reaches the provider. Existing hybrid and lifecycle tests still run.

```bash
npm test
npx tsc --noEmit
npm run lint
RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 node --env-file=.env.local --conditions=react-server --import tsx --test --experimental-test-isolation=none tests/*.test.ts
```

Current results: npm test passed 68 tests with three optional database tests skipped. With all database tests enabled, all 71 passed. TypeScript and ESLint passed. The production Webpack build passed against an isolated source snapshot in /tmp with no copied .env file, preserving the active development server's cache. No live external Gemini call was needed for authentication/isolation testing. A final real-database check showed the existing one user, zero credentials/sessions, four document records, six generic CSV rows and four legacy employee rows intact; the existing account was not enrolled by the tests.

Production deployment still needs operational review: HTTPS/proxy configuration, edge rate limits, monitoring, backups, and retention/cleanup of expired sessions and rate-limit keys. There is no email verification, password recovery/change UI, MFA/passkeys, idle timeout, account deletion or administrative account-management endpoint in this phase. Signup 409 responses reveal email registration status; login does not. XSS or a compromised device can still act as the user despite HttpOnly cookies. Database write access can compromise identities, so database credentials and operator tooling remain privileged.

In-flight requests verified before logout can finish; logout prevents subsequent requests. Likewise, evidence already sent to Gemini cannot be recalled by deleting a session or document. Request-scoped isolation prevents cross-user context reuse; it is not PostgreSQL row-level security. All access must continue through guarded server services. Global auth throttling trades availability for abuse resistance and should be tuned with production measurements.

## Changed files

New: src/lib/auth.ts, src/lib/identity.ts; four app/api/auth route files; migrations/009-authentication.sql; src/scripts/enroll-existing-account.ts; tests/auth.test.ts; tests/test-context.ts; this guide.

Updated routes: app/api/upload/route.ts; app/api/documents/[id]/route.ts; app/api/documents/cleanup/route.ts; app/api/datasets/route.ts; app/api/datasets/query/route.ts; app/api/chat/route.ts; app/api/agent/route.ts.

Updated services: src/lib/document-lifecycle.ts, document-http.ts, search-documents.ts, generic-csv.ts, import-csv.ts, gemini.ts (removed obsolete development-only guard), knowledge-agent.ts; src/scripts/compare-document-search.ts; tests/agent.test.ts, tests/chat.test.ts, tests/document-lifecycle.test.ts, tests/generic-csv.test.ts and tests/hybrid-search.test.ts regression fixtures; README.md. Disabled legacy diagnostics in app/api/db-test, test-csv, and test-search. Model settings and citation verification were not changed.
