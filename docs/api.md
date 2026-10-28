# HTTP API reference

Contracts below are derived from root `app/api/` handlers and their service schemas. JSON examples are illustrative shapes, not live results. IDs are normally decimal strings; legacy `pg` values are not normalized everywhere. Clients should preserve IDs as strings rather than convert bigint values to JavaScript numbers.

## Authentication, CSRF and common behavior

Use same-origin requests with `credentials: 'same-origin'`. Login/signup set the HttpOnly cookie; browser JavaScript must not read or store the session token. `GET /api/auth/session` exposes the separate CSRF token. Send `X-CSRF-Token` and an exact allowed `Origin` on authenticated POST/PUT/DELETE requests. The browser supplies Origin automatically; command-line clients must supply it explicitly. Do not try to set Origin manually in browser fetch.

Signup/login also require Origin, but cannot require an existing session CSRF token. Read-only GET endpoints require a session, not a CSRF header. Requests marked Sec-Fetch-Site: cross-site are also rejected on Origin-checked operations. The backend derives identity from the session; a request user ID is never authorization. Production cookies require HTTPS and `APP_ORIGIN` equal to that origin.

All API route wrappers assign a server-generated `X-Request-ID`, except the three disabled legacy diagnostics. Most responses explicitly set Cache-Control: no-store; some CSV error/legacy branches do not. Do not cache private API results. Normal application failures use `{success:false,error:string}` with an optional `code`; **not every endpoint returns the same error schema**. Unexpected errors outside a handler's local catch can become the authentication wrapper's safe 503 AUTH_FAILED.

Common authentication errors: 401 UNAUTHENTICATED; 403 CSRF_REJECTED; 503 AUTH_NOT_CONFIGURED/AUTH_FAILED. Foreign IDs generally return generic not-found/unavailable rather than revealing another user's record. Invalid account credentials use 401 INVALID_CREDENTIALS. Error text is safe and intentionally omits raw provider/database details.

## Endpoint inventory

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account and session |
| POST | `/api/auth/login` | Create/rotate session |
| GET | `/api/auth/session` | Current user and CSRF token |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/documents` | Owner-scoped cursor list |
| POST | `/api/upload` | PDF/DOCX ingestion; separate legacy CSV branch |
| PUT | `/api/documents/{id}` | Explicit document replacement |
| DELETE | `/api/documents/{id}` | Delete document knowledge; attempt file cleanup |
| POST | `/api/documents/cleanup` | Retry current user's queued file cleanup |
| GET | `/api/datasets` | Discover ready generic datasets and schemas |
| POST | `/api/datasets` | Generic CSV upload |
| PUT / DELETE | `/api/datasets/{id}` | Replace / delete an owned ready generic dataset |
| POST | `/api/datasets/query` | Validated structured query |
| POST | `/api/chat` | Document RAG |
| POST | `/api/agent` | Document/CSV/multi-source agent |
| GET | `/api/db-test`, `/api/test-csv`, `/api/test-search` | Disabled diagnostics; 404, `{success:false,error:"Not found."}` |

There is no document download/detail GET, individual dataset-schema route, persistent conversation API, arbitrary SQL endpoint or health endpoint. Schema inspection is provided by the dataset list and the internal agent tool.

## Accounts

Signup JSON: `{name,email,password}`. Name is trimmed/nonempty, max 100; email is valid/max 254 and normalized to lowercase; password is 12–128 characters. Signup requires name. Login JSON: `{email,password}`; name is accepted but unused. Unknown JSON fields are rejected, request bodies are capped at 8,192 bytes and Content-Type must be application/json.

Signup returns HTTP 201; login HTTP 200:

```json
{"success":true,"userId":"123","csrfToken":"SESSION_BOUND_64_HEX_CHARACTERS"}
```

The placeholder above is descriptive, not a valid token. Set-Cookie carries the session. Duplicate account: 409 ACCOUNT_EXISTS. Input: 400 INVALID_INPUT; concurrency/hash saturation: 429 AUTH_BUSY; database-backed login/signup throttle: 429 RATE_LIMITED. Limits are 100 global and 10 per email-derived key per 15-minute window; this is not a distributed edge abuse-prevention system.

Session success: `{success:true,userId,name,email,csrfToken}`. Logout success: `{success:true}`, with an expired cookie. Sessions expire after eight hours and are not automatically extended by reads. Logout requires session, Origin and CSRF.

## Documents

### List

`GET /api/documents?limit=20&before=123`. Limit defaults to 20, range 1–50; `before` is an optional positive signed-bigint-compatible ID. Duplicate query parameters, unknown parameters and invalid cursors return 400 INVALID_PAGINATION. Results sort by descending ID and exclude deleted/superseded records; processing or other non-retired statuses may appear.

```json
{
  "success": true,
  "documents": [{"id":"123","filename":"policy.docx","status":"ready","uploadedAt":"2026-01-01T00:00:00.000Z","version":1,"fileType":"docx"}],
  "nextCursor": null
}
```

`uploadedAt` can be null; fileType is pdf/docx/unknown. Use nextCursor as before for the next page; null means no more rows. Paths and hashes are not returned. Service failure: 503 DOCUMENT_LIST_FAILED.

### Upload and replace

Use multipart/form-data with a `file` part; let the browser set the multipart boundary. PDF/DOCX limit: 1 byte–10 MiB. Filenames must be at most 255 characters with no separators/control characters. Parsing and embeddings finish synchronously before success; there is no background status-polling endpoint. Upload/replacement signals have a 120-second cap, with existing per-embedding/database limits inside it.

`POST /api/upload` success: `{success:true,message:"Document processed and stored successfully",documentId,totalChunks,version}`. A same-name different-content upload is a separate document. Identical active bytes within the owner return HTTP 409 DUPLICATE_DOCUMENT, optionally `existingDocumentId`.

`PUT /api/documents/{id}` also accepts multipart `file`. It creates a new record with version previous+1 and returns `{success:true,documentId,totalChunks,version,replacesDocumentId,cleanupPending}`. The predecessor becomes superseded only after successful publication. `replacesDocumentId` is present on a successful replacement; an undefined predecessor field on a normal upload is omitted from JSON.

Errors: 400 INVALID_ID/INVALID_FILE/INVALID_REQUEST; 404 DOCUMENT_NOT_FOUND for inaccessible/non-ready replacement target; 409 DUPLICATE_DOCUMENT; 422 INVALID_CONTENT/EMPTY_DOCUMENT; 503 DOCUMENT_BUSY; 504 DOCUMENT_TIMEOUT; 500 DOCUMENT_FAILED for other failures. An identical file cannot be used to create a redundant replacement version.

### Delete and cleanup

DELETE success: `{success:true,documentId,deleted:true,cleanupPending}`. Owner checks apply even for repeat deletion; a known owned tombstone can be deleted again safely. Chunks are removed and retrieval is excluded before any unlink attempt. `cleanupPending:true` means file cleanup remains queued, not that deleted content remains searchable.

POST cleanup has no required body and returns `{success:true,removed,pending}`. Each attempt considers up to 100 owned queued jobs. `pending` counts failed jobs in that batch, not the entire queue depth. No storage path is accepted or returned. There is no scheduler in this route; operators/users must invoke retries as appropriate.

### Legacy CSV compatibility

POST `/api/upload` additionally recognizes `.csv` and invokes the older employee-leave importer requiring `name` and nonnegative safe-integer `leaves` values. It returns `{success:true,message:"CSV imported successfully",datasetId,importedRows}`. It is **not** the generic dataset path or agent dataset discovery source. Use `/api/datasets` for current CSV management. The legacy branch can retain a UUID CSV file; it has no cleanup management API.

## Generic CSV datasets

POST `/api/datasets`: multipart `file`, nonempty `.csv`, at most 10 MiB. Parser constraints: 1–100 unique nonempty header names (max 200 characters each), 1–10,000 data rows, consistent shape, maximum record size 100,000. Inferred types are number/boolean/text; empty cells become null. Numeric inference requires finite, safe-magnitude decimal values; only literal true/false infer boolean. Header-only/empty files are rejected rather than stored as empty datasets.

Success HTTP 200: `{success:true,datasetId,importedRows,columns:[{name,type}]}`. Import transaction publishes ready only after all rows succeed. Bad file/import returns HTTP 400 with safe error text, without a guaranteed code field.

GET success: `{success:true,datasets:[{id,filename,columns,row_count}]}`. Only owned ready datasets, ascending ID, maximum 100. It does not provide a cursor or report hidden additional datasets.

### Replacement and deletion

Both endpoints require the verified session cookie, allowed Origin and session-bound `X-CSRF-Token`; user IDs from the browser never authorize access. IDs must be positive PostgreSQL bigint strings.

- `PUT /api/datasets/{id}`: multipart `file`, using the upload parser/limits above; filename at most 255 characters with no path separators/control characters. Success HTTP 200: `{success:true,datasetId,importedRows,columns:[{name,type}]}`. The dataset ID, owner and original creation date remain unchanged. Schema, filename, row count and rows are replaced in one transaction. Invalid CSV or a database failure preserves the original. No version history is retained.
- `DELETE /api/datasets/{id}`: no body. Success HTTP 200: `{success:true,datasetId}`. Deletes structured rows and metadata in one transaction. A second delete returns 404.
- Both return safe `{success:false,code,error}` errors: 400 `INVALID_DATASET`/`INVALID_FILE`; 404 `DATASET_UNAVAILABLE` for missing, foreign or non-ready records; 409 `IDENTICAL_DATASET` for the same parsed schema and ordered typed rows on replacement (filename ignored, no data writes); 503 `DATASET_MUTATION_FAILED` for operational failures, including lock waits/timeouts. Session/CSRF errors remain 401/403 from the authentication wrapper. Responses use no-store.

Mutations lock the same dataset row, with 5-second lock and 10-second statement limits. Concurrent valid replacements serialize; the last successful replacement wins. Concurrent deletion leaves no discoverable/queryable dataset after commit. Queries use one repeatable-read read-only snapshot, so an already-started query can finish with its earlier authorized evidence. Previously displayed answers are not retroactively withdrawn. Do not automatically retry a mutation after a lost response: refresh discovery first.

Each ordinary POST upload still creates a separate dataset, including identical files. Replacement is explicit; for ordinary POST uploads, same filenames and identical CSV contents do not trigger updates or duplicate detection. See [manual acceptance](day-10-csv-lifecycle.md).

### Structured query

POST `/api/datasets/query`, Content-Type application/json, JSON plan body capped at 16,384 bytes. The endpoint parses JSON but does not independently enforce that Content-Type. Unknown plan fields are rejected.

```json
{
  "datasetId":"201",
  "filters":[{"column":"region","op":"eq","value":"East"}],
  "aggregate":{"op":"sum","column":"amount"},
  "groupBy":["team"],
  "sort":{"column":"value","direction":"desc"},
  "limit":100
}
```

This is a fictional example: IDs/columns must exist for the logged-in user. No `userId` or SQL is accepted. Limits and semantics:

| Field | Rules |
| --- | --- |
| datasetId | Required positive decimal string, up to 19 digits; inaccessible/out-of-range database values fail safely |
| filters | Default []; max 20; AND semantics; ops eq/ne/gt/gte/lt/lte; string/number/boolean value must match inferred type; boolean only eq/ne |
| aggregate | Optional; op count/sum/avg; sum/avg need a numeric column; count omits column and counts rows |
| groupBy | Default []; max five entries; requires aggregation; cannot conflict with output name value |
| sort | Optional column + asc/desc; with aggregate, only group columns or value; otherwise an original column |
| limit | Integer 1–100, default 100 |

Filters run before grouping/aggregation. Numeric aggregates use output key `value`; grouped rows also contain group fields. Nonaggregate rows contain original columns. Without sort, row order is not a public guarantee. SUM/AVG on no matching rows can be null; COUNT is zero. There is no HAVING expression or pagination cursor.

Success: `{success:true,rows:[...]}`. An inaccessible dataset or invalid plan/service error is intentionally collapsed to HTTP 404 `{success:false,error:"Invalid plan or unavailable dataset."}`. Oversize plan returns 413 `{success:false,error:"Plan too large."}`. Values/column keys are parameterized by the backend; queries use owned ready datasets, read-only transactions, five-second statement limits and row bounds.

## AI answers

Both APIs accept strict `{question:string}` JSON, trimmed length 1–2,000 characters and at most 16 KiB body; no history, user IDs or document IDs are accepted. Content-Type must be application/json. Multi-Source Agent is the frontend default, but the selected provider is server-wide configuration for both APIs.

### Document RAG: POST /api/chat

Success shape:

```json
{
  "success":true,
  "grounded":true,
  "answer":"The minimum target is 15 units. [S1]",
  "sources":[{
    "id":"S1","documentId":"1","chunkId":"101","filename":"policy.docx",
    "chunkIndex":0,"pageNumber":null,"similarity":0.9,
    "text":"The minimum target is 15 units.","quotes":["The minimum target is 15 units."]
  }]
}
```

Optional metadata: retrievalMode, keywordRank, semanticRank, rrfScore. Similarity can be null for some keyword evidence. Current new ingestion generally has no page metadata; do not invent pages.

Insufficient evidence is HTTP 200 with `success:true, grounded:false, sources:[]` and answer `I don't have enough information in the retrieved documents to answer that question.` No-evidence retrieval skips generation; a provider configuration is still required because configuration is validated first.

### Agent: POST /api/agent

Success also has success/grounded/answer/sources, but the source union differs:

- Document source: RAG document fields, `type:"document"`, IDs such as D1.
- CSV source: `{id:"C1",type:"csv",datasetId,filename,plan,rows,text,possiblyTruncated,quotes}`. Text is exact serialized query-result rows, not the uploaded CSV. The returned plan contains validated/defaulted fields. possiblyTruncated flags rows.length equal to the requested limit; it does not prove that additional rows exist.

A combined answer can cite both `[D1]` and `[C1]`. Discovery/schema alone is not returned as supporting evidence. grounded=false uses empty sources and answer `I don't have enough evidence from the available documents and datasets to answer that question.` There is no streaming response or persistent backend conversation.

### AI errors

| Status | Typical code / meaning |
| --- | --- |
| 400 / 413 / 415 | INVALID_QUESTION, INVALID_JSON, REQUEST_TOO_LARGE, INVALID_CONTENT_TYPE |
| 429 | PROVIDER_RATE_LIMITED; can be local pacing or provider quota |
| 503 | CHAT_NOT_CONFIGURED; PROVIDER_BILLING_REQUIRED for recognized Gemini restriction |
| 503 | RETRIEVAL_FAILED on document RAG retrieval/service failure |
| 502 | GENERATION_FAILED or UNSUPPORTED_ANSWER for RAG; AGENT_FAILED for unclassified agent failures |
| 504 | CHAT_TIMEOUT or AGENT_TIMEOUT, including cancellation |

Authentication 401/403 checks run before these workflows. Generic provider access errors need not be returned as HTTP 403; for example, provider 403 can map to safe generation/agent 502. Inspect request-ID/stage diagnostics instead of treating it as a user login failure. Citation verification remains enabled; an unverifiable answer is never replaced with a fake success. Retry manually after reviewing the error, rather than automatically repeating an uncertain request.
