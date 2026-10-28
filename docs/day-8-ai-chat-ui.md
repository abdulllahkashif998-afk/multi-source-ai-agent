# Day 8 Phase 4 — AI Chat

`/dashboard/chat` now uses the existing authenticated AI APIs. No backend workflow, model, database, API endpoint or dependency was added or changed.

## Modes and actual API contracts

Both modes send JSON `{ "question": "..." }`. Questions are trimmed, must contain 1–2,000 characters, and must fit the existing 16 KiB request limit. Previous messages are not sent: each question must include its own context.

| Mode | Endpoint | Evidence returned |
| --- | --- | --- |
| Multi-Source Agent (default) | POST /api/agent | `type: "document"` sources with D identifiers and `type: "csv"` sources with C identifiers |
| Document RAG | POST /api/chat | Document sources with S identifiers; these do not require a `type` field |

Successful responses contain `success`, `grounded`, `answer` and `sources`. The frontend normalizes the different source shapes after validating them. Document filenames, original zero-based chunk indexes and page numbers are shown only when provided. CSV sources include returned rows, exact cited text, quotes and `possiblyTruncated`; flat scalar rows become a scrollable evidence table. Nested evidence remains readable as original text. Truncation warnings remain visible. No file download links or missing metadata are invented.

Citation markers such as [S1], [D1] and [C1] remain in the answer. Document and CSV sources appear separately with expandable exact quotes. Client checks reject malformed/inconsistent sources, duplicate or unknown citation IDs, uncited sources and quotes absent from returned text. Existing backend citation verification remains authoritative. Neither check proves the substantive truth of a source document. `grounded=false` is presented as insufficient evidence, with no fabricated sources.

## Interaction and safety

- Ordered question/answer pairs, Enter to send, Shift+Enter for a newline, and IME composition support.
- Mode selection remains in component memory during the page session. Active work disables mode changes, clearing and duplicate sends.
- Processing, validation, empty, success and safe error states are visible and announced accessibly.
- Manual retry uses the failed question's original mode without adding another user message. There are no automatic client retries.
- HTTP 429, 401, 403, 504, provider unavailability, network interruptions and invalid responses receive safe messages. Expired sessions redirect to login. Uncertain requests explicitly may already have been processed.
- Each request obtains a fresh session-bound CSRF token from the existing authentication helper. Same-origin credentials send the HttpOnly session cookie; the browser supplies Origin. The question body contains no client user ID or authorization scope.
- Client AI deadlines are 50 seconds for documents and 65 seconds for the agent, after the existing session lookup. Backend 45/60-second request deadlines, Gemini pacing (12 RPM), bounded retries, ownership, read-only SQL and citation checks are unchanged.
- Unmounting cancels client work where possible; interrupted requests can be retried manually. Cancellation does not prove the server stopped processing.
- History and drafts are held in React memory, never local/session storage or a database. Refresh resets them. Clear requires a confirmation dialog and preserves the mode. The workspace remounts private UI after a verified account email changes; same-account session refreshes preserve state. APIs independently authorize every request.
- Answers, filenames, quotes and CSV cells use React text rendering, with no HTML injection or executable Markdown links. Tables support unusual column names safely. Long text wraps and tables scroll within their region on mobile.

## Files

- `app/components/ai-chat.tsx`: conversation, composer, modes, retries and clear confirmation.
- `app/components/chat-citations.tsx`: document quotes and CSV evidence.
- `src/lib/ai-chat-client.ts`: API integration, response validation and safe errors.
- `app/dashboard/chat/page.tsx`, `app/dashboard/page.tsx`: working chat route and dashboard entry.
- `app/components/workspace-shell.tsx`: clear private UI cache after a verified account changes.
- `app/globals.css`: matching chat layouts, states and responsive styles.
- `tests/ai-chat-client.test.ts`, `tests/browser/ai-chat-ui.mjs`: focused automated checks.
- `tests/browser/auth-ui.mjs`, `tests/browser/styles-ui.mjs`: updated chat expectations.
- `README.md` and this guide.

## Verification

The standard suite has 116 tests: 113 passed, three optional database tests skipped, no failures. With `RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1`, all 116 passed. Database fixtures use temporary tables and rollback; existing records remain unchanged. TypeScript, ESLint and the default Turbopack production build passed. The build used an isolated source copy without environment credentials so the running development cache was preserved; no Webpack fallback was needed.

Production Chrome results: 14 chat scenarios, 12 authentication scenarios, nine document scenarios, 13 dataset scenarios and 14 responsive page/viewport checks all passed. The 14 styling checks also passed against the existing development server. Desktop (1440px) and mobile (390px) chat screenshots were visually inspected, including combined citations and long-content layouts.

Chrome tests use fictional API fixtures rather than live Gemini. They verify requests, CSRF and browser Origin as well as rendered output. The existing PostgreSQL suite separately verifies server ownership and session controls. No live Gemini quota was consumed; real-provider end-to-end acceptance remains a manual check.

Run the application on its configured allowed origin, then:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
# Optional local PostgreSQL integration checks, using the existing configured database:
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
# With Playwright available locally and Chrome installed:
UI_BASE_URL=http://localhost:3000 node tests/browser/ai-chat-ui.mjs
UI_BASE_URL=http://localhost:3000 node tests/browser/auth-ui.mjs
UI_BASE_URL=http://localhost:3000 node tests/browser/documents-ui.mjs
UI_BASE_URL=http://localhost:3000 node tests/browser/datasets-ui.mjs
UI_BASE_URL=http://localhost:3000 node tests/browser/styles-ui.mjs
```

If Playwright is installed outside this repository, set `PLAYWRIGHT_MODULE` to its module directory. The browser tests create no real accounts or uploads and make no live AI requests. The default browser executable is `/usr/bin/google-chrome`; `CHROME_PATH` overrides it.

## Manual browser acceptance

1. Sign in, open AI Chat and confirm Multi-Source Agent is selected. Send a question about one of your own CSV datasets, such as “Using fictional.csv, what is the total amount for each team?” using the actual filename you uploaded. Expand CSV evidence and compare the returned rows with the dataset.
2. Select Document RAG. Ask a specific question about your own PDF/DOCX. Confirm S citations and real filename/chunk metadata; expand exact quotes. Test Enter and Shift+Enter.
3. Select Agent and ask a complete combined question using a threshold in your own document and values in your CSV. Confirm separate D and C sources and the calculation. Space out these limited live calls; respect backend pacing and manually wait if rate limited.
4. Ask for information absent from all uploaded evidence. Confirm insufficient evidence rather than invented sources. Use the mocked browser suite for repeated failures/429s to conserve quota.
5. Confirm messages remain in order, sending is disabled during processing, errors allow manual retry, and changing modes does not alter prior answers.
6. Clear the conversation: cancel first, then confirm. Refresh and verify no persistent history is claimed or restored. Log out in another tab and return: protected navigation must require login. A verified switch to another account must reset private page state.
7. At desktop and narrow mobile widths, inspect long answers, expand sources, scroll wide evidence tables, tab through controls, and verify clear-dialog focus/Escape behavior.

## Limitations and next steps

Responses are non-streaming. History is temporary and questions do not use previous turns as model context. No source-file viewer, persistent chat, multi-tab history synchronization or conversation export was added. Existing backend discovery, tool and evidence limits still apply; CSV tables display returned evidence, not every dataset row. Real Gemini/BGE/network availability remains an external dependency. Complete the limited real-provider manual acceptance with an authenticated account and owned fictional files before release.
