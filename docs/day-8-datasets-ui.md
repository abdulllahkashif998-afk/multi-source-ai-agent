# Day 8 Phase 3 — CSV dataset management

## Completed UI

`/dashboard/datasets` now provides CSV upload, owned dataset discovery, schema inspection, a structured query builder and a responsive results table. It reuses the current workspace, theme, file-panel styling, authentication/session helper and error conventions. Documents continue to work. AI Chat was subsequently implemented in [Phase 4](day-8-ai-chat-ui.md).

- Select or drop one CSV, up to 10 MiB. Empty, wrong-extension, unsafe-name and oversized files are rejected in the browser; actual CSV parsing and import validation stay on the backend.
- List filenames, actual row counts and column counts from GET /api/datasets. Selecting a dataset shows every column name and the backend-inferred Text, Number or Boolean type.
- Build row queries or COUNT/SUM/AVG aggregates. SUM and AVG offer numeric columns only. COUNT counts rows without an aggregate input column.
- Add up to 20 AND filters with schema-aware values and comparisons. Boolean filters offer only equals/not-equals. Text codes such as 001 remain text.
- Select up to five GROUP BY columns for aggregates. Sort raw rows by a source column, or aggregate output by a group column or the aggregate result. The backend's reserved aggregate name `value` cannot be grouped; the UI explains this when relevant.
- Choose 1–100 output rows. The UI warns when a raw/grouped result may have reached its limit. Ungrouped totals apply to all matching source rows, not just the first displayed rows.
- Display scalar results in a captioned, keyboard-focusable scroll region with table headers. Zero and false are displayed as values; explicit null is shown as an empty-value dash. Empty results show a message, while COUNT zero remains a result row containing 0.
- Changing query controls clears old results; selecting another dataset or refreshing clears the previous query state. Results are never presented as if they came from newly edited controls.
- Empty discovery, loading, pending import/query, safe errors, retry, success, expired sessions and the existing 100-dataset discovery cap are handled explicitly.

No sample data is seeded into the application. All rendered datasets and results come from API responses. Fictional records exist only in tests and examples.

## Backend reuse and security

No endpoints or database schema were added. No SQL/import implementation was recreated.

| Action | Existing endpoint |
| --- | --- |
| Discover owned ready datasets and schemas | GET /api/datasets |
| Import CSV | POST /api/datasets |
| Execute structured plan | POST /api/datasets/query |

The existing `planSchema` moved unchanged into `src/lib/csv-query-schema.ts`, a browser-safe module containing Zod structural validation only. `generic-csv.ts` imports and re-exports the same object, preserving existing API and agent imports. The frontend shares this schema; SQL compilation, import/type inference, ownership lookups, read-only transactions and statement timeouts remain in the original server service. The backend independently validates every submitted plan and its columns against the owned dataset's schema.

Frontend controls produce JSON plans, never SQL. They do not supply a user ID. Selected dataset IDs are not authorization: the server derives identity from the verified session and checks ownership before rows or schemas are returned. Existing limits remain: 100 discovered ready datasets, 20 filters, five group columns, 100 result rows, 10 MiB/10,000 rows/100 columns per import, read-only queries and five-second query statement timeouts.

Every POST obtains a fresh session-bound CSRF token through the existing `getBrowserSession()`. Same-origin fetch sends the existing HttpOnly cookie; the browser supplies Origin. Multipart uploads leave Content-Type/boundary selection to the browser. JSON query POSTs use application/json. No cookie token, API credential or user ID is stored in browser storage or embedded in plans.

Responses and errors are validated; raw SQL/parser/database errors are not displayed. Result cells use React text rendering and own-property checks, including for unusual header names such as `__proto__`. The query helper rejects missing fields, nested values, invalid scalars and excess returned rows rather than inventing empty cells. Plan bodies are checked against the existing 16 KiB limit before requesting credentials/data.

List/query requests use 15-second client ceilings; import uses 45 seconds. Existing server limits were not increased. Unmounting cancels client work where possible and ignores stale responses. A cancelled or lost upload response does not prove rollback: refresh discovery before uploading again. There is no automatic upload retry. Every successful CSV upload creates a separate dataset, including duplicate filenames/content; this existing behavior is explained in the upload panel.

## Files changed

New:

- `src/lib/csv-query-schema.ts`: existing shared plan schema and inferred plan type.
- `src/lib/dataset-client.ts`: safe API helpers, upload/response validation and typed form-to-plan construction.
- `app/components/dataset-manager.tsx`: upload/discovery/selection and UI states.
- `app/components/dataset-explorer.tsx`: schema display, structured controls and results table.
- `tests/dataset-client.test.ts`: ten focused frontend/contract/security regressions.
- `tests/browser/datasets-ui.mjs`: dataset browser acceptance suite.
- This guide.

Updated:

- `src/lib/generic-csv.ts`: import/re-export shared schema only; SQL, import, type inference and ownership behavior are unchanged.
- `app/dashboard/datasets/page.tsx`, `app/dashboard/page.tsx`: functional route and updated overview copy.
- `app/globals.css`: responsive dataset/query/table styles using the existing theme.
- `tests/auth.test.ts`: use actual multipart dataset API calls in private PostgreSQL fixtures; add raw/filter/sort/COUNT/SUM/AVG/grouped queries for both users, invalid imports/queries and foreign-owner rejection.
- `tests/browser/auth-ui.mjs`, `tests/browser/styles-ui.mjs`: retain previous checks, replacing obsolete Datasets-preview expectations and adding isolated discovery fixtures/new-style assertions.
- `README.md`: guide link.

No dependency, Gemini/BGE configuration, authentication implementation, document lifecycle or database migration changed in this phase. Existing unrelated working-tree changes were preserved.

## Actual verification

- `npm test`: 106 registered tests, 103 passed and three optional database checks skipped; zero failures.
- All database flags enabled: all 106 passed, zero failures/skips. Fictional accounts/datasets use private temporary tables and rollback; no existing records were changed.
- TypeScript and ESLint: passed.
- Default `npm run build` (Turbopack): passed in an isolated source copy with physical dependency files, no copied environment credentials and no overwrite of the running development cache.
- Dataset browser suite: 13 scenarios passed on the production build, covering upload, schema selection, filters/sorting, COUNT/SUM/AVG/GROUP BY, invalid files/plans, empty/zero-row datasets, result limits, discovery cap and missing-discovery responses, errors/retry, pending states, CSRF/expiry and desktop/mobile tables.
- Existing authentication/navigation suite: 12 scenarios passed.
- Existing document-management suite: nine scenarios passed.
- Existing responsive styling suite: 14 page/viewport checks passed. The dataset suite and styling checks also passed on the actual development server before the final missing-discovery message refinement.
- Desktop 1440px/mobile 390px screenshots were visually inspected; page overflow and result-region scrolling were checked.

Browser fixtures intercept the existing APIs with explicitly fictional metadata/data and assert submitted plans and headers. They do not call a live import/query backend or write real records. The database-enabled suite separately exercises the actual multipart/structured-query routes and PostgreSQL operations for users A and B, with rollback. Existing RAG/agent/citation, lifecycle, auth and reliability regressions remain part of the complete suite. No live Gemini or BGE requests were needed.

## Run checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build

RUN_AUTH_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

For optional browser checks, start a local app separately. Use an isolated production copy if a dev server shares the workspace's generated output. The existing runner setup uses Chrome and a temporary Playwright install outside project dependencies:

```bash
npm install --prefix /tmp/day8-browser --no-save --package-lock=false playwright
UI_BASE_URL=http://localhost:3107 \
  PLAYWRIGHT_MODULE=/tmp/day8-browser/node_modules/playwright \
  node tests/browser/datasets-ui.mjs
```

Repeat with `auth-ui.mjs`, `documents-ui.mjs` and `styles-ui.mjs` for the other suites. Override CHROME_PATH if needed. The controlled local browser runner uses no-sandbox mode; this does not change application security. Screenshots are written to `/tmp/datasets-desktop.png` and `/tmp/datasets-mobile.png`. Browser tests are separate from npm test because they require a running application and installed browser.

## Manual browser acceptance

With PostgreSQL and the app running at the configured APP_ORIGIN, sign in and open `/dashboard/datasets`. Gemini/Ollama are not required for CSV management.

1. Save a new fictional CSV locally:

   ```csv
   team,amount,active,code
   Alpha,10,true,001
   Alpha,20,false,002
   Beta,6,true,003
   ```

2. Upload it. Expect three rows and four columns, with team/code inferred as Text, amount as Number and active as Boolean. The new dataset should be selected after discovery refresh. Confirm code values keep their leading zeros when you run Rows.
3. Add an amount filter, choose “at least” and enter 10. Sort amount descending. Run query: expect amount 20 followed by 10. Verify the results clear if you edit a control, then run again.
4. Reset query before checking unfiltered aggregates. COUNT should return 3, SUM amount 36, AVG amount 12. Select SUM amount with Group by team: expect Alpha 30 and Beta 6. Sort Aggregate result descending if desired.
5. Reset and filter active equals true. Expect the Alpha/10 and Beta/6 rows. Try a filter with no matches: expect a clear empty result, not a fabricated zero total.
6. Select another owned dataset, if available: schema and query state should reset. Refresh discovery to check externally added datasets. Do not change existing ownership or records to simulate isolation; use the database-enabled test for that.
7. Try an empty/wrong-extension file and a CSV containing headers only or duplicate headers. Expect a safe error and no successful import. Re-uploading a valid file creates another dataset; it is not replacement/deduplication.
8. Test keyboard navigation and resize to around 390px. Table overflow should remain inside its labelled scroll region, while the page itself stays within the viewport.

Use the mocked browser suite for session expiry, CSRF rejection, network/server errors and the 100-dataset edge case. It preserves all real data. Manual successful uploads intentionally add new fictional records and were not performed during implementation.

## Limits and remaining work

- Discovery returns the first 100 owned ready datasets from the existing service. If a new import falls outside that cap, the UI explains it without fabricating a list entry. Paginated discovery would require a separate additive backend change.
- Results stop at 100 output rows. There is no query-result pagination, OR logic, joins, HAVING/post-aggregate filters or NULL comparison operator in the existing API. Filters always precede aggregation. Equal sort keys have the backend's existing ordering behavior.
- Header-only CSVs are rejected by the importer. The UI still handles a zero-row dataset if one is returned by discovery.
- Type inference and numeric precision follow the existing backend and JSON/JavaScript number representation. The frontend does not silently re-infer columns or round displayed totals.
- No dataset rename/delete/replace, download/export, import deduplication, automatic refresh polling, chart UI or AI Chat is introduced. Refresh explicitly to discover changes from other tabs.
- Backend error responses are deliberately generic, so the UI cannot identify an exact CSV parser line or distinguish every service failure from an import validation failure.
- A persisted-account live browser upload/query was not performed; use the fictional-file manual procedure before release. Broader browser and assistive-technology coverage remains useful.

## Later lifecycle support

Day 10 adds explicit Replace/Delete actions. This report retains its original phase scope and results; see [the current lifecycle guide](day-10-csv-lifecycle.md) for API behavior, tests and acceptance steps.
