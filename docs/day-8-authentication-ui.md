# Day 8 Phase 1 — frontend foundation and authentication

Implemented 2026-10-26. Backend routes, database data/schema, Gemini/BGE configuration, ownership rules, SQL safeguards and citations are unchanged.

## Screens and structure

- `/`: a concise landing page with sign-in, create-account and workspace links.
- `/signup`: name, email, password and password confirmation with field-level validation.
- `/login`: email/password form with loading, success, safe errors and an expired-session notice.
- `/dashboard`: workspace overview with navigation and preview cards.
- `/dashboard/documents`, `/dashboard/datasets`, `/dashboard/chat`: clearly labelled placeholders. No upload, dataset management or chat functionality was added.

The existing Geist fonts, Tailwind CSS import and global CSS provide an ivory/green visual style, dark navigation, responsive layouts, visible keyboard focus, a skip link, associated form labels, error descriptions and live status messages. No UI library or runtime dependency was added.

## Authentication flow and protection

The forms validate the same account limits as the backend: valid email, 12–128 character password and a 1–100 character signup name. Signup additionally checks password confirmation. Password whitespace is preserved; email is trimmed and normalized. Invalid fields receive focus and error descriptions. Submission buttons prevent repeated submission while pending.

`src/lib/auth-client.ts` calls only the existing same-origin auth endpoints with `credentials: same-origin` and no-store caching. The browser receives and sends the existing HTTP-only cookie. JavaScript never reads or stores the session token. No API credentials are imported into client code. Server error messages are mapped to a small set of safe user-facing messages rather than displayed raw.

After signup or login, the client fetches `/api/auth/session` and opens `/dashboard`. The workspace shell verifies the session before showing its children and checks again on navigation, tab focus/visibility and every minute while visible. A 401 clears the workspace and returns to sign-in with an expiry notice. A network or malformed-session error closes the workspace view and offers retry; it does not treat a network error as successful authentication.

Logout first fetches the current session to obtain a fresh CSRF token, then POSTs `/api/auth/logout` with `X-CSRF-Token`. The browser supplies the Origin header and cookie. The existing backend still verifies session expiry, Origin and session-bound CSRF. Already expired logout is safe to complete. A 403 or network failure shows an error rather than claiming successful logout. Successful logout broadcasts only `signed-out` to other tabs, without tokens or personal information. The UI prevents background session checks from overriding an active sign-out flow.

This is a **client-gated navigation shell**, not a replacement for backend authorization. Placeholder page content is static and contains no private data. Every protected API retains its existing server-session and owner checks. Future private server-rendered data must also use verified server identity; do not rely on hiding UI elements for data protection. An unauthenticated dashboard URL initially returns a generic loading shell, followed by the browser redirect, rather than an HTTP server redirect. JavaScript is required for the forms and session gate.

## Files changed in this phase

Updated:

- `app/page.tsx`: replace the starter screen with the landing page.
- `app/layout.tsx`: product title and description.
- `app/globals.css`: responsive frontend styling and focus states.

Added:

- `app/components/brand.tsx`, `auth-form.tsx`, `workspace-shell.tsx`, `placeholder.tsx`.
- `app/login/page.tsx`, `app/signup/page.tsx`.
- `app/dashboard/layout.tsx`, `app/dashboard/page.tsx` and placeholder pages under `documents`, `datasets`, `chat`.
- `src/lib/auth-client.ts`: browser-only auth API helpers, validation and safe messages.
- `tests/auth-client.test.ts`: five focused API-helper tests.
- `tests/browser/auth-ui.mjs`: optional Chrome/Playwright frontend acceptance checks.
- This guide.

No backend implementation or migration was changed. Existing unrelated working-tree changes were retained.

## Verification

- `npm test`: 85 registered tests; 82 passed, 3 optional database checks skipped, zero failures.
- Database-enabled complete suite: all 85 passed, zero failures/skips. Existing temporary-table fixtures and rollback preserve public records.
- TypeScript and ESLint: passed.
- Production webpack build: passed in an isolated temporary source copy, without copied environment credentials or changes to the running development cache.
- All 12 Chrome browser scenarios passed. Browser tests cover signup validation/confirmation, login, protected placeholder navigation, logout CSRF header, invalid credentials, missing/expired sessions, CSRF rejection, connection failure/retry, cross-tab logout, mobile overflow and keyboard focus. Explicit pending-state and submission/network-error assertions are included as well.
- Desktop (1440px) and mobile (390px) screenshots were visually inspected. No horizontal overflow was observed on the tested screens.

Browser tests intercept auth requests with fictional responses. They do not create users or call Gemini, Ollama or PostgreSQL. Existing database-enabled tests separately exercise real account/session SQL and authenticated backend isolation with fictional rollback-isolated data. A real persisted-account browser signup/login was not performed; use the manual steps below for local acceptance. No Gemini quota was consumed.

## Run checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack

RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

The optional browser runner uses Playwright and Chrome. During implementation Playwright was installed in `/tmp` only; project dependencies and the lockfile were not changed by this phase. To reproduce with an existing Chrome installation:

```bash
npm install --prefix /tmp/day8-browser --no-save --package-lock=false playwright
# Start the app separately; use the URL of your local dev or isolated production server.
UI_BASE_URL=http://localhost:3000 \
  PLAYWRIGHT_MODULE=/tmp/day8-browser/node_modules/playwright \
  CHROME_PATH=/usr/bin/google-chrome node tests/browser/auth-ui.mjs
```

The runner defaults to localhost:3103 and uses headless Chrome's no-sandbox flag for this controlled local test environment. Use it only against your trusted local app; this does not alter application security settings. Mock routes mean it does not require a live auth database. Screenshots are written under `/tmp/day8-*.png`. It is separate from `npm test` because it requires a running application and browser installation.

## Manual browser steps

1. Start the existing local services and `npm run dev`. Browse to `http://localhost:3000`. Ensure the server's existing `APP_ORIGIN` matches that exact origin (scheme, host and port). Production requires HTTPS and the matching origin; do not weaken this check to accommodate a mismatched URL.
2. Open `/dashboard` in a private/incognito window. Expect a short session-check screen, then sign-in. Preview navigation must not remain visible without a valid session.
3. Open `/signup`. Submit blank/invalid fields and mismatched passwords; check focus and clear error text. Create an account with a unique fictional email, name and a 12–128 character password. This manual step intentionally creates a real account; automated tests do not.
4. Expect the workspace overview. Visit Documents, Datasets and AI Chat; verify their placeholder labels and active navigation. No upload/query/chat controls should exist yet.
5. Sign out. Expect the sign-in screen. Use the Back button and a direct dashboard URL; the session gate must send you back to sign-in.
6. Enter a wrong password. Expect a generic incorrect-credentials message. Sign in correctly; verify the workspace opens. Inspect requests without sharing cookies/passwords: fetches should use the same origin; the session cookie must be HttpOnly and logout must send the CSRF header. Never paste session cookies into documentation or logs.
7. Open the workspace in a second tab and sign out in one tab. Both tabs should return to sign-in. For session expiry and CSRF rejection, use the mocked browser suite rather than editing real session records or disabling server checks.
8. Use keyboard-only navigation: labels, submit buttons, error focus, the skip link and workspace links should be reachable with visible focus. Resize to approximately 390px; forms and navigation should fit without horizontal scrolling.
9. Temporarily block `/api/auth/session` in browser developer tools and reload the workspace. Expect a connection error with retry, not a signed-in screen. Unblock and retry. Do not block or alter server authorization logic.

## Limits and next phase

The UI session check can lag expiry by up to one minute while idle, with immediate rechecks on focus/navigation; backend checks always enforce expiry on requests. Cross-tab notifications require BroadcastChannel; focus/navigation polling remains a fallback when unavailable. Frontend requests have a 15-second timeout. A signup that succeeds before a subsequent session fetch fails may require signing in rather than resubmitting signup.

There is no password recovery, email verification, authentication settings UI, document upload UI, dataset UI or chat UI. Those remain separate phases. Responsive and keyboard checks were performed in Chrome; additional browsers and a full assistive-technology audit remain useful. Before adding private frontend data, keep its fetches behind existing server authorization and handle 401 responses with the same expiry flow.
