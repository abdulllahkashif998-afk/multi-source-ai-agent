# Day 8 Phase 2 — document upload and management

## Completed features

The Documents preview is now a functional management screen at `/dashboard/documents`. It reuses the existing workspace layout and visual style. Datasets and AI Chat remain previews.

- Owned document list with filename, status, upload date/time, version and PDF/DOCX type.
- Cursor pagination with 20 rows per UI page, Previous/Next, manual refresh and empty/loading/retry states. The count is for the current page, not an invented total.
- Single PDF/DOCX selection or drag-and-drop; 1 byte through 10 MiB. Unsupported, empty, oversized and unsafe filenames are rejected before upload; the backend independently validates the actual file.
- Actual multipart-byte upload progress followed by indeterminate server processing. Processing percentages are not invented.
- Upload through the existing endpoint; the list refreshes after successful publication. Identical content displays a clear 409 duplicate message.
- Explicit replacement dialog explaining the new version and preservation of the prior version until successful publication. Only ready documents offer replacement. The new ID/version is shown after success; a failed replacement does not remove the previous row.
- Confirmation before deletion, cancel/Escape support, keyboard focus, disabled duplicate actions while processing and accessible status/error notices.
- Pending cleanup is reported as a message. Retired content remains excluded from active knowledge; no storage path or hash appears in the UI.
- Responsive rows, wrapping long filenames, mobile controls and viewport-bounded modal dialogs.

The frontend never seeds fake documents. Browser fixtures are confined to test runners. An empty response displays an empty state.

## Additive API; no schema migration

Inspection confirmed there was no list endpoint. Existing columns already provide all required metadata, so no migration, backfill, record update or index change was required.

New endpoint:

```text
GET /api/documents?limit=20&before=<nextCursor>
```

- Requires the existing verified session; owner identity comes only from `requireUserId()` inside the authenticated wrapper. No frontend user ID is accepted.
- `limit` defaults to 20 and is bounded to 1–50. `before` is an optional positive PostgreSQL bigint ID. Unknown or repeated parameters and invalid cursors return 400.
- Reads in a `BEGIN READ ONLY` transaction with a five-second statement timeout.
- Filters `user_id` before returning metadata and excludes `deleted` and `superseded` records. Non-ready retained records can be shown for management; retrieval still independently requires ready status.
- Uses parameterized values, descending ID order and at most limit+1 rows to determine the next page. No unrestricted SQL or unbounded count is introduced.
- Explicitly returns only id, filename, status, uploadedAt, version and inferred fileType. It never selects or returns storage paths, content, embeddings, hashes or owner IDs.
- Responses are no-store. Missing sessions return 401; database failures return a safe 503 message. Existing request-ID/logging wrappers remain in place.

Example shape (fictional values):

```json
{"success":true,"documents":[{"id":"42","filename":"Fictional policy.pdf","status":"ready","uploadedAt":"2026-01-01T10:00:00.000Z","version":1,"fileType":"pdf"}],"nextCursor":null}
```

`nextCursor` is passed back as `before`. Deleted/superseded audit records remain in the database and are not part of this list. The upload date belongs to that version. Concurrent changes can alter page contents; this is live pagination, not a database snapshot.

## Existing mutation APIs and security

No mutation backend was rebuilt:

| Action | Existing endpoint |
| --- | --- |
| Upload | POST /api/upload |
| Replace | PUT /api/documents/{id} |
| Delete | DELETE /api/documents/{id} |

The client reuses `getBrowserSession()` immediately before each mutation to obtain a fresh session-bound CSRF token. XHR sends that token in `X-CSRF-Token`, lets the browser supply the multipart boundary and sends cookies through the existing same-origin session. The browser supplies the Origin header; the UI does not attempt to spoof it. The public origin must match the backend's existing APP_ORIGIN configuration.

Session cookies remain HttpOnly. No user ID, storage path, API key or session token is sent in upload form data or stored in browser storage. Backend owner, CSRF, file-path, duplicate-lock, transaction and citation controls are unchanged. A missing/expired session redirects to sign-in. Other server errors are mapped to safe messages, ignoring raw provider/database/file error content.

Mutations have a 130-second client ceiling to accommodate the existing 120-second backend document preparation limit plus response overhead; backend limits were not increased. Session/list fetches remain short and bounded. Network/time-out failures advise refreshing before retrying because a lost response can follow a committed change. There is no automatic mutation retry. Navigation cleanup aborts outstanding client work; it does not guarantee rollback of already committed server work.

## Files changed

New:

- `app/api/documents/route.ts`: authorized metadata list API.
- `src/lib/list-documents.ts`: pagination validation and read-only, owner-scoped query.
- `src/lib/document-client.ts`: file/response validation, safe messages, listing and CSRF-aware mutation/progress helpers.
- `app/components/document-manager.tsx`: list, upload panel, replacement/deletion dialogs and UI states.
- `postcss.config.mjs`: documented Tailwind v4 CSS processing.
- `tests/document-list.test.ts`, `tests/document-client.test.ts`, `tests/browser/documents-ui.mjs`.
- This guide.

Updated:

- `app/dashboard/documents/page.tsx`: mount the document manager.
- `app/dashboard/page.tsx`: link text and overview copy now describe available document management.
- `app/globals.css`: document-specific styles using the existing theme.
- `tests/auth.test.ts`: anonymous list protection and actual PostgreSQL A/B list isolation assertions.
- `tests/browser/auth-ui.mjs`, `tests/browser/styles-ui.mjs`: retain all previous scenarios while replacing obsolete Documents-placeholder assertions with current UI expectations; add isolated list fixtures.
- `docs/day-7-document-lifecycle.md`: clarify that historical development-only instructions were superseded by authentication.
- `README.md`: link to this guide.
- `next.config.ts`, `package.json`, `package-lock.json`: replace the custom CSS-loader rule with the matching `@tailwindcss/postcss` 4.3.3 build plugin.
- `docs/frontend-styling-fix.md`: note that the current CSS pipeline supersedes the earlier cache recovery.

Existing ingestion, lifecycle mutation handlers, embeddings/retrieval, Gemini configuration, CSV services and AI agent code were not changed. The only added dependency is the matching Tailwind PostCSS build plugin; model/authentication dependencies were not changed. Existing unrelated working-tree changes were retained.

## Development CSS follow-up

Actual-server browser checks reproduced the earlier stale-style issue: the new upload panel computed as display:block even though its source declared flex. The existing custom Turbopack Tailwind loader had again emitted an older version of the custom stylesheet. Production styling passed, which is why actual development verification was retained.

A controlled isolated comparison using Next.js's locally documented Tailwind PostCSS configuration passed all 14 styling checks. Two successive temporary stylesheet edits were reflected correctly in served CSS. The project now uses `postcss.config.mjs` with `@tailwindcss/postcss` pinned to the installed Tailwind 4.3.3 version, and removes only the custom `*.css` Turbopack loader rule. The existing loader package was retained as an unused dependency to avoid unrelated dependency cleanup. Stylesheet design and application security configuration remain unchanged. Actual-server styling checks then passed with the new pipeline. Temporary probe selectors were confined to the isolated copy and were not shipped.

## Actual verification

- `npm test`: 96 tests; 93 passed, 3 optional database tests skipped; zero failures.
- All database flags enabled: all 96 passed, zero skips/failures. Existing fixture tables are private temporary copies with rollback; public data was preserved.
- TypeScript and ESLint: passed.
- Default production `npm run build` (Turbopack): passed in an isolated source copy with physical dependency files and no copied environment credentials. The running development cache was not replaced by a production build.
- New document browser suite: all 9 scenarios passed on both the actual development server and the finalized production build. These cover pagination, metadata, empty/loading/error/success states, file rejection, upload progress, duplicates, replacement failure/success, confirmation/Escape, deletion with cleanup pending, CSRF rejection, expiry, long filenames and desktop/mobile dialogs.
- Existing auth/navigation browser suite: all 12 scenarios passed.
- Existing styling browser checks: all 14 desktop/mobile page cases passed on both the actual development server and the finalized production build.
- Desktop 1440px/mobile 390px screenshots were inspected. No horizontal overflow occurred with long filenames.

Browser API responses use fictional data. Upload-progress verification forwards one request to a temporary local fictional HTTP endpoint that receives multipart bytes and delays its response; this preserves native XHR upload events. A plain Playwright fulfilled response cannot separately exercise the real upload-completion/processing interval. The fixture writes no files or database records. Other browser operations are intercepted. Database tests separately exercise real PostgreSQL session/list/ownership/lifecycle SQL with rollback-isolated fixtures. No real document was uploaded, replaced or deleted during implementation. No Gemini call was used.

## Reproduce checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build

RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

For browser checks, start a local production server separately (prefer an isolated source copy when a dev server shares `.next`). The optional Playwright runner can be installed outside the project as described in the Day 8 auth guide:

```bash
npm install --prefix /tmp/day8-browser --no-save --package-lock=false playwright
UI_BASE_URL=http://localhost:3105 \
  PLAYWRIGHT_MODULE=/tmp/day8-browser/node_modules/playwright \
  node tests/browser/documents-ui.mjs
# Repeat with tests/browser/auth-ui.mjs and tests/browser/styles-ui.mjs.
```

These runners use the existing Chrome executable (override CHROME_PATH when needed), fictional API data and no-sandbox mode only for the controlled local test environment. They are separate from npm test because they require a running browser and app. The upload-progress fixture binds an ephemeral localhost port. Screenshots are written to `/tmp/documents-desktop.png` and `/tmp/documents-mobile.png`.

## Manual browser acceptance

Use a new fictional PDF/DOCX for this procedure, rather than an existing project document.

1. Run the existing database/Ollama services and `npm run dev`. Sign in at the configured origin, normally `http://localhost:3000`, then open Documents. Confirm only your documents appear, with metadata and pagination where applicable.
2. Choose an unsupported or empty file: expect a clear error and no upload. Choose a valid PDF/DOCX under 10 MiB, or drop it onto the panel. Click Upload document. Observe uploading/processing, then the ready row and success message.
3. Upload identical bytes again: expect a duplicate message and no extra row.
4. On that new fixture row, choose Replace. Read the version explanation, then cancel or press Escape. Confirm no change. Repeat with a different valid fictional PDF/DOCX; after success confirm the new filename/version is listed and the old version is absent.
5. Try a malformed replacement with a valid extension. Expect a processing error and preservation of the current active version. Use Refresh list to verify the current state.
6. Delete only that fixture. Cancel once to confirm nothing changes; then confirm deletion. Verify the row disappears. If cleanup is pending, the UI should explain it without revealing a path.
7. Use keyboard-only navigation through file fields, pagination and dialogs. Resize to approximately 390px. Check wrapping, visible focus and dialog scrolling.
8. Use the mocked browser suite for CSRF rejection, expired sessions and storage-cleanup failures; do not weaken backend checks or edit existing records to simulate them. The suite also covers list errors and retry.

## Remaining limits and next steps

- Real local PDF/DOCX parsing + Ollama ingestion through a persisted browser account was not repeated; the existing lifecycle/ingestion pipeline is reused and regression-tested. Perform the manual fictional-file acceptance with local services before release.
- File upload byte progress is measurable; server processing remains indeterminate because existing APIs return one final result and do not stream job progress.
- Failed/processing records do not auto-poll. Mutations refresh the first page automatically; use Refresh list for changes from another tab or external operations.
- Pagination is bounded and does not compute a full total or expose historical/deleted versions. Large collections may justify a separately reviewed owner/ID index after query measurements.
- No download, preview rendering, audit-history UI, bulk operations, cleanup scheduler or dataset/chat management is introduced. Pending cleanup remains governed by the existing backend queue and operator retry endpoint.
- Browser coverage is Chrome desktop/mobile. Additional browsers and assistive-technology checks remain useful.

## Page-size follow-up

The Documents UI and default list API now use 10 documents per page. With 13 visible documents, page 1 contains 10 and Next opens the remaining three. Previous returns to the first ten. The API still permits an explicit limit from 1 to 50; this does not change the UI page size. Earlier 20-item examples above record the initial phase behavior.
