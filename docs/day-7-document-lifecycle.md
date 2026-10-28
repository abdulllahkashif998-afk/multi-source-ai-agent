> Historical lifecycle implementation notes: the later [authentication phase](day-7-authentication.md) replaced development-only user scoping with verified sessions and CSRF protection. See the [Document management UI guide](day-8-documents-ui.md) for the current list API and browser workflow.

# Day 7 Phase 2: document lifecycle

The PDF/DOCX upload path now uses transactional lifecycle storage. Parsing, 768-dimensional BGE embeddings, semantic/hybrid retrieval, Gemini, existing citations, and CSV data remain in place. Same filenames are not treated as replacement instructions.

## API

All operations are development-only, scoped internally to user 1. Production returns 503 DEVELOPMENT_ONLY before parsing or querying. Clients cannot supply a user ID or storage path.

| Method and path | Input | Result |
| --- | --- | --- |
| POST /api/upload | multipart file: PDF/DOCX | New document ID, chunk count, version 1 |
| PUT /api/documents/{id} | multipart replacement PDF/DOCX | New document ID, incremented version, replacesDocumentId, cleanupPending |
| DELETE /api/documents/{id} | Document version ID | deleted=true and cleanupPending; repeat deletion is idempotent |
| POST /api/documents/cleanup | No path or file arguments | Retry up to 100 owned retired/deleted file jobs; removed/pending counts |

The legacy CSV branch of /api/upload still invokes its existing employee CSV importer. Generic CSV APIs are untouched. Upload is now consistently blocked in production as well. PDF/DOCX uploads accept 1 byte through 10 MiB; parser rejection or empty text returns 422. ID validation covers positive PostgreSQL bigint range. Original filenames reject path separators, control characters and excessive length; actual storage names are internal UUIDs.

Duplicates return HTTP 409:

```json
{"success":false,"code":"DUPLICATE_DOCUMENT","error":"An identical active document already exists.","existingDocumentId":"123"}
```

The existing ID is returned when found by the scoped preflight check. A database uniqueness race can return the same code without the ID. Unknown/inaccessible or no-longer-active replacement IDs return 404. Lock contention returns 503 DOCUMENT_BUSY; retry after the current operation completes. Malformed multipart input returns 400. Embedding/database/storage failures return sanitized errors. No raw paths, provider messages or credentials appear in responses.

## Duplicate and publication behavior

Each lifecycle mutation takes the same transaction-scoped advisory lock for its owner. The duplicate SHA-256 lookup occurs after acquiring the lock but before parsing, embedding or writing a file. Thus concurrent requests through this backend cannot both embed identical active content. A partial unique index on (user_id,file_hash) WHERE status='ready' independently prevents duplicate active publication.

The per-user lock serializes preparation too, trading throughput for correctness in this development system. It has a five-second acquisition timeout; a concurrent request can receive DOCUMENT_BUSY rather than waiting through a slow embedding job. No extra embeddings or chunks are created by that rejected attempt. Once the first request finishes, retrying identical bytes returns 409. Same names with different bytes remain independent uploads; duplicates are based on bytes, not extracted text or filenames.

Replacement verifies the target's owner and ready status, checks the new hash, parses and chunks the file, and generates all embeddings before publication. It stages an exclusive UUID file and creates a new document record and chunks. In one transaction, it retires the old record as superseded, removes the old chunks/embeddings, enqueues its file cleanup, marks the new record ready, and records a replacement audit event. Commit is the visibility boundary. Before commit, other connections see the previous version; after commit, both search modes can see only the new ready version. Two replacements of the same old ID cannot silently overwrite each other; the later one sees a non-ready target and fails.

Errors before commit roll back database changes and leave the previous version active. A staged unpublished file is removed best-effort. A lost response to COMMIT creates an inherently ambiguous outcome: a new version might already be committed. The code never deletes a possibly published file in that case. Operators must inspect the record/audit trail before retrying. This avoids turning an uncertain network result into missing active content.

## Deletion and cleanup

Deletion locks and checks the owned document, sets status=deleted with timestamps, removes chunks/embeddings, records an audit event, and enqueues file cleanup in one transaction. File removal happens only after commit. A filesystem failure cannot restore ready status or chunks. Fresh retrieval queries exclude the tombstone immediately after commit, even if cleanup remains pending.

Cleanup uses only paths stored by the backend, verifies the canonical storage/uploads directory, accepts only direct UUID PDF/DOCX children, and unlinks without following a file symlink. Directory symlinks and paths outside that root are rejected. New document files use exclusive creation and mode 0600. Missing files count as cleaned. Failures retain the queue job and increment attempts; the retry endpoint uses SKIP LOCKED so workers do not process the same queued row simultaneously. A pending flag also checks for a job held by another cleanup worker.

Deleting a version ID does not delete a different successor ID. Replacement already removes the predecessor's content, retaining its metadata. Audit tombstones preserve filename, hash, owner, version, predecessor ID, timestamps and events; historical full content is not retained after retirement. Existing stored paths outside the permitted managed-file layout are left pending for an operator rather than deleted unsafely.

Deletion excludes new retrieval queries, not contexts already fetched by an in-flight request or already sent to Gemini. Filesystem unlink is logical removal, not guaranteed forensic erasure from SSDs, backups or snapshots.

## Additive migration

After inspecting real columns, foreign keys, statuses and duplicate groups, applied migrations/008-document-lifecycle.sql. Existing data contained no duplicate active owner/hash groups.

It adds documents.version (default 1), replaces_document_id, retired_at and deleted_at; the active-owner/hash unique index; document_events; and document_file_cleanup. No existing status, file, chunk, embedding or CSV record was changed. The default version labels existing records without making them replacements of one another. The migration is transactional and should be applied once to other databases. It takes table/index locks during creation; plan accordingly for larger deployments. If another database already contains duplicate active hashes, stop and review them rather than automatically deleting or retiring records.

## Verification performed

- npm test: 61 passed, two optional database tests skipped.
- npx tsc --noEmit: passed.
- npm run lint: passed.
- Both database tests enabled: all 63 passed, none skipped.

Tests cover pre-embedding duplicate detection, same-name independence, replacement success and failures, publication rollback and file removal, uncertain commit safety, deletion, production and ownership restrictions, concurrent duplicate attempts, unsafe paths, actual managed-file deletion, and queued cleanup failure/retry.

The database lifecycle integration test uses private temporary tables with an outer transaction that always rolls back. Service transaction boundaries are translated to savepoints. It verifies actual SQL publication and old/new status, audit events, failed replacement preservation, and retrieval exclusion in BOTH semantic and hybrid modes. It also verifies that the real PostgreSQL unique index rejects a duplicate active hash independently of the preflight check. The existing hybrid fixture was updated to supply the new required version column. Real document and CSV rows were untouched: the final check still showed two ready documents, four legacy employee CSV rows and six generic CSV rows; real lifecycle event and cleanup tables remained empty.

The concurrency unit test simulates lock serialization and verifies that only one request embeds. It is not a multi-connection PostgreSQL stress test. The advisory lock and unique index provide the actual database concurrency controls. Use the optional manual concurrent HTTP procedure below for a live worker check.

```bash
npm test
npx tsc --noEmit
npm run lint
RUN_SEARCH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 node --env-file=.env.local --conditions=react-server --import tsx --test --experimental-test-isolation=none tests/*.test.ts
```

## Manual HTTP procedure with new fictional data only

Create dedicated fixtures. These commands do not modify existing test documents:

```bash
python3 - <<'PY'
from zipfile import ZipFile
for version in (1, 2, 3):
    with ZipFile(f'/tmp/lifecycle-v{version}.docx', 'w') as doc:
        doc.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        doc.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        doc.writestr('word/document.xml', f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fictional lifecycle policy version {version}. The approval target is {version * 10} units.</w:t></w:r></w:p></w:body></w:document>')
PY
curl -sS http://localhost:3000/api/upload -F file=@/tmp/lifecycle-v1.docx
# Repeat: expect 409 and the same owned document ID.
curl -sS http://localhost:3000/api/upload -F file=@/tmp/lifecycle-v1.docx
```

Copy the returned DOCUMENT ID from this NEW fixture, not a CSV dataset ID or an existing document ID:

```bash
LIFECYCLE_DOC_ID=NEW_ID_FROM_FIRST_RESPONSE
curl -sS -X PUT "http://localhost:3000/api/documents/$LIFECYCLE_DOC_ID" -F file=@/tmp/lifecycle-v2.docx
# Copy the NEW successor ID from the replacement response:
LIFECYCLE_ACTIVE_ID=NEW_ID_FROM_REPLACEMENT_RESPONSE
printf 'invalid fictional DOCX' > /tmp/lifecycle-invalid.docx
curl -sS -X PUT "http://localhost:3000/api/documents/$LIFECYCLE_ACTIVE_ID" -F file=@/tmp/lifecycle-invalid.docx
# Expect 422; the successful replacement remains active.
node --env-file=.env.local --require tsx/cjs src/scripts/compare-document-search.ts 'fictional lifecycle approval target'
curl -sS -X DELETE "http://localhost:3000/api/documents/$LIFECYCLE_ACTIVE_ID"
curl -sS -X POST http://localhost:3000/api/documents/cleanup
```

Verify the old version is absent from search after replacement and the deleted new version is absent afterward. Any unrelated documents may still match shared words; inspect IDs rather than assuming an empty corpus. An inaccessible ID returns 404, and traversal-shaped IDs/filenames return errors. Do not change real document ownership to simulate an unauthorized operation; automated tests cover it.

For concurrent duplicates, use the fresh v3 fixture:

```bash
for LIFECYCLE_ATTEMPT in 1 2; do
  curl -sS http://localhost:3000/api/upload -F file=@/tmp/lifecycle-v3.docx &
done
wait
```

Expect one successful upload and one 409, or a 503 busy response followed by 409 when retried. Keep the winning new ID if you want to delete that newly created fixture afterward. No live replacement/deletion was performed against existing project documents during implementation.

## Operational limits and next steps

Cleanup retries are backend-triggered; there is no scheduled worker in this phase. A process crash after commit can leave a queued job until the endpoint is called. A crash or failed best-effort cleanup before a document row commits can leave an unpublished UUID file; add a reviewed orphan reconciliation job later. Do not blindly delete unreferenced files, since one might belong to an in-progress transaction or uncertain commit.

Multipart bodies are buffered by the framework before per-file validation; deployment request-body limits remain necessary. Document preparation has a 120-second signal and reuses the embedding timeout. Cancellation cannot forcibly interrupt synchronous parsing or a SQL statement already executing. The persistent audit stores hashes and filenames, so it is metadata retention, not erasure of all information. Private storage directory permissions must be maintained by the operator.

Next: scheduled cleanup with monitoring, orphan reconciliation, richer audit inspection, and multi-worker concurrency stress testing. Authentication and UI remain out of scope.

Files changed: app/api/upload/route.ts; src/lib/store-document.ts; src/lib/document-lifecycle.ts; src/lib/document-files.ts; src/lib/document-http.ts; app/api/documents/[id]/route.ts; app/api/documents/cleanup/route.ts; migrations/008-document-lifecycle.sql; tests/document-lifecycle.test.ts; tests/hybrid-search.test.ts (fixture metadata only); this guide.
