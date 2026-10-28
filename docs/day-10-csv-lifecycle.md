# CSV dataset replacement and deletion

Implemented 28 October 2026. Generic CSV datasets now support explicit replacement and permanent deletion through authenticated APIs and the existing Datasets page. Gemini/Groq, BGE, agent orchestration and citation verification are unchanged. No database migration or existing application-data mutation was performed.

## APIs and transactions

| Operation | Request | Success |
| --- | --- | --- |
| Replace | `PUT /api/datasets/{id}`, multipart `file` | `{success:true,datasetId,importedRows,columns:[{name,type}]}` |
| Delete | `DELETE /api/datasets/{id}`, no body | `{success:true,datasetId}` |

Both require a verified session cookie, allowed Origin and session-bound CSRF header. The server derives ownership; browser user IDs are ignored. Positive bigint IDs are validated. Missing, foreign and non-ready datasets share a safe 404. Identical replacement returns 409 `IDENTICAL_DATASET` with “This dataset already contains the same data. No changes were made.” Bad IDs/files return 400; operational failures return a generic 503 without internal SQL, paths or provider details. Errors and successes use no-store. Authentication/CSRF failures retain existing 401/403 handling.

Replacement uses the existing `prepareCSV` parser: nonempty `.csv`, maximum 10 MiB, 10,000 rows, 100 unique nonempty columns, 200-character headings and consistent row shape. Existing number/boolean/text inference is preserved. Filename validation rejects paths/control characters and names above 255 characters. Invalid input is rejected before database mutation.

After validation, one transaction locks the owned ready metadata row with `FOR UPDATE`, compares parsed schema and ordered typed rows against stored JSONB, and rejects identical content before any data writes. Different content deletes existing structured rows, inserts all replacement rows and updates filename/schema/row count. The ID, owner and original creation date remain unchanged. Any error before commit rolls everything back. Cancellation is checked before publishing; active SQL remains bounded by database statement limits.

Deletion locks that same metadata row, deletes its rows and then metadata. The existing foreign key does not cascade, so row cleanup is explicit and transactional. Generic ingestion does not store CSV upload files; there is no associated file path to unlink. No schema changes were needed.

Mutations use a 5-second lock timeout and 10-second statement timeout. Concurrent replacements serialize; the last successful writer wins. With concurrent replacement/deletion, deletion removes the dataset or replacement finds it unavailable if deletion committed first. No partial schema/row combination is published.

Queries now use `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`. Schema authorization and row execution therefore see the same snapshot even if replacement commits between them. Owner filters, parameterized values, validated plans, query limits and statement timeouts remain intact. No arbitrary SQL was added.

## UI

Each listed dataset has Replace and Delete controls. Native modal dialogs provide accessible labels, descriptive confirmation text, keyboard navigation and Escape cancellation while idle. Cancel receives initial focus. Working state disables duplicate actions and closing while a request is active.

Replacement accepts a new CSV and explains that every row/column is replaced under the same ID, without version history. Deletion explicitly warns that it cannot be undone. The UI clears the selected explorer/results when a mutation begins, refreshes discovery afterward and selects the updated schema after replacement. Errors are safe and manually recoverable; uncertain network outcomes tell users to refresh before retrying.

Unmount aborts pending client work. The existing workspace remount on a verified account change discards old private selections, dialogs and responses; backend authorization remains decisive for every request. Browser requests use same-origin cookies and the existing session CSRF helper. Browsers supply Origin; JavaScript does not forge it.

Ordinary uploads still create separate datasets, even for identical contents or filenames. Identical-content detection applies only to replacement of the selected owned dataset, not to ordinary uploads or other datasets. Replacement is always explicit.

## Actual verification

- Full disposable-PostgreSQL suite: **220 passed, zero failures/skips**; final test portion 19.27 seconds. All nine migrations applied from empty; cluster removed afterward.
- Standard automated suite: **212 passed, zero failures, eight optional database skips**, 220 total; final run 7.16 seconds.
- Datasets browser suite: **19/19 passed**, using fictional mocked APIs against an isolated production build at desktop 1440×1000 and mobile 390×844. Includes the existing query/upload regressions plus six lifecycle cases. Screenshots inspected locally; not committed.
- Existing browser regressions: authentication **12/12** and document management **9/9** passed with mocked APIs.
- TypeScript and ESLint: passed.
- Supported `npx next build --webpack`: passed in an isolated source copy without private environment files, including `/api/datasets/[id]`.
- No live LLM/Ollama requests; browser APIs were mocked. Real database transactions were tested separately rather than claiming a full live browser-to-database acceptance run.

Targeted tests cover valid/invalid IDs and files, invalid CSV preservation, injected insertion failure after row deletion, stable identity/new schema, cross-user denial, session/CSRF protections, safe errors, authenticated API success, cancellation rollback, concurrent replacements, replacement/delete races, row cleanup, repeated deletion, query snapshot consistency and agent discovery/inspection/query exclusion after deletion. All generic CSV and existing application regressions remain included.

Before/after read-only fingerprints matched for all **12** original application tables, including documents and generic CSV records. The original database was never migrated or used for mutation fixtures. Repository secret-pattern and whitespace checks passed.

The first new database test exposed a shared test-harness `pool.query` mock, not an application defect. The guarded test now uses the actual Pool query implementation for its fixture setup/checks. A browser keyboard assertion was corrected to navigate between native dialog controls instead of expecting browser-chrome focus to count as document content. Neither issue required weakening application behavior.

## Files changed

- `src/lib/dataset-lifecycle.ts` — validation, owner lock, transactional replacement/deletion and safe errors.
- `app/api/datasets/[id]/route.ts` — authenticated PUT/DELETE.
- `src/lib/generic-csv.ts` — repeatable-read read-only query snapshot.
- `src/lib/dataset-client.ts` and `app/components/dataset-manager.tsx` — secure mutation requests and UI.
- `tests/dataset-lifecycle.test.ts`, `tests/dataset-client.test.ts`, `tests/generic-csv.test.ts`, `tests/browser/datasets-ui.mjs` — regression coverage.
- `src/scripts/test-fresh-database.ts` — opt in to guarded lifecycle database tests; preserve fictional failure diagnostics before cleanup.
- README, API/database guides, the historical Datasets UI report's current-feature pointer, this guide and the explicit Git staging manifest.

A pre-existing newline-only change to `app/api/agent/route.ts` was left untouched. No commit, push, branch change or AI configuration change was performed.

## Manual acceptance

Use newly created fictional data, not existing personal datasets:

1. Sign in and open **Datasets**. Upload a CSV with `team,amount` and rows `Alpha,10` / `Beta,20`. Run SUM(amount); expect 30. Uploading the same file again creates a second independent dataset.
2. On the first dataset choose **Replace**, then Cancel; its data should remain unchanged.
3. Replace with `region,score` and `North,9`. Confirm; expect the same dataset ID, new filename/schema, one row, and no old query results. Query SUM(score); expect 9. The old `amount` column must fail validation.
4. Try a header-only CSV or duplicate headers. Expect an error, with the last valid schema/rows still intact. Refresh before retrying a lost/uncertain response.
5. Choose **Delete**, Cancel once, then confirm. The dataset disappears; refresh and verify it remains absent. A saved query using that ID must fail. A new agent request must not discover/query it; no live provider request is needed to exercise the automated tool tests.
6. In a second fictional account, direct PUT/DELETE to the first account's dataset ID must return 404. Missing cookies return 401; missing/wrong CSRF or foreign Origin returns 403.
7. In two tabs, replace the same fictional dataset concurrently: only a complete winning CSV should be visible. Race replacement with deletion: the final dataset must be absent after successful deletion. Use a new fixture for each irreversible test.
8. Check desktop/mobile dialogs, tab navigation, Escape/Cancel, loading/errors and session expiry. Change accounts during a delayed operation: no old response should repopulate the new workspace.

Commands:

```bash
npm test
npm run test:fresh-db
npx tsc --noEmit
npm run lint
npx next build --webpack
# Against an isolated running app; install Playwright separately as documented:
PLAYWRIGHT_MODULE=/tmp/browser-tests/node_modules/playwright \
  UI_BASE_URL=http://127.0.0.1:3117 node tests/browser/datasets-ui.mjs
```

`test:fresh-db` requires local PostgreSQL 18 binaries and pgvector. The lifecycle integration test refuses non-disposable database names before inserting fixtures. It creates and cleans only its fictional accounts/data.

## Limitations

There is no CSV version history, undo, optimistic revision check or cross-dataset/upload duplicate detection. Discovery remains capped at 100 datasets. Existing chat messages/citations and already acquired in-flight query/agent evidence are snapshots; deletion does not erase already displayed answers or cancel evidence that was acquired earlier. New discovery and uncached queries after deletion cannot access it. A lost response near commit is uncertain; refresh rather than blindly retry. Session revalidation/account-change detection follows the existing workspace focus/visibility/periodic checks.

## Identical-content replacement follow-up

Comparison uses exact PostgreSQL JSONB equality of the parsed column array and ordered row array, after acquiring the existing owner-scoped row lock. It does not trust client hashes, store new hash columns or rewrite existing datasets. This works with datasets imported before the feature existed. A concurrent second replacement with the same data sees the first committed result and returns 409; failed comparisons/operations roll back and release the lock.

Semantics:

- Filename alone is ignored: uploading the same data with a new filename returns 409 and preserves the existing filename, ID, schema, rows, count, owner and creation date.
- CSV BOM, quotes, line endings, blank lines and trimming follow the existing parser. Parsed numeric equivalents such as 10 and 10.0 compare equal. Boolean/null/text types and column names are significant.
- Row order (including duplicate rows), column order, inferred types and text values remain significant. No case folding, fuzzy matching or Unicode normalization is applied.
- Comparison reads the selected dataset's bounded rows; it is linear in dataset size and remains subject to the existing statement/lock timeouts. There is no global deduplication scan or additional LLM call.

The frontend maps only the recognized 409/code to a fixed friendly message, makes no automatic retry and keeps the dialog available for a different file or Cancel. Existing mutation handling clears old query results and refreshes discovery. Deletion and different-content replacement retain their previous behavior.

Focused coverage adds safe API 409/no-write assertions, frontend message/no-retry checks, real PostgreSQL unchanged-record comparisons for byte-identical and parser-equivalent inputs, a foreign-owner identical-content denial, and two simultaneous same-content replacements (one successful update, one identical rejection). Existing tests cover different content, changed row/column order, validation rollback, injected database failure, uploads, deletion and agent exclusion.

Manual follow-up:

1. Upload a new fictional CSV: `team,amount` with `Alpha,10` and `Beta,20`.
2. Choose Replace and submit that CSV again, including under another filename. Expect the friendly same-data message and no metadata/row changes after refresh.
3. Try the same values with quoted fields, CRLF lines or amounts 10.0 and 20.00: expect the same message.
4. Change an amount or add a row: expect normal successful replacement under the same ID, with old query results cleared.
5. In two tabs submit the same changed CSV: one updates; the other reports identical content (unless a lock timeout intervenes). A different account must still receive 404.
6. Delete the fictional fixture afterward and verify it disappears. Ordinary duplicate POST uploads continue creating independent datasets.

Follow-up actual results:

| Check | Result |
| --- | --- |
| `npm test` | 214 passed, 8 optional database skips, 0 failed (222 total) |
| `npm run test:fresh-db` | 222 passed, 0 skipped/failed; disposable cluster removed |
| Datasets browser suite | 20/20 passed, fictional mocked APIs against isolated production build, desktop and mobile |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npx next build --webpack` | Passed; built application source matches final changed files |
| Repository security / `git diff --check` | Passed, zero detected secret patterns / whitespace issues |

No production data, migrations, models, authentication or citation rules changed. No live AI calls, commits or pushes were made. This follow-up changed only `src/lib/dataset-lifecycle.ts`, `src/lib/dataset-client.ts`, `tests/dataset-lifecycle.test.ts`, `tests/dataset-client.test.ts`, `tests/browser/datasets-ui.mjs`, this guide and `docs/api.md`. Earlier workspace changes were preserved.
