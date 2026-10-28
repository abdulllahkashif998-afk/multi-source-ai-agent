# Final demonstration guide

Prepared 28 October 2026. This is a walkthrough to execute in an approved local/staging demo environment, **not a record that these steps were newly run or passed**. Actual evidence and unverified items are in [final test cases](final-test-cases.md). Use only newly created fictional accounts/files; leave existing application data alone. No AI request was made when writing this guide.

## 1. Start the application

Run from the repository root. Complete [handover setup](project-handover.md#local-setup-and-database-initialization) first if this is a fresh installation. For an existing working installation, keep its environment and database unchanged; do not replay migrations.

Check that PostgreSQL and Ollama are running using your installation's service manager. If Ollama is not already running, start `ollama serve` in a separate terminal. Confirm the existing BGE model is installed:

```bash
ollama list
npm run dev
```

Open `http://localhost:3000`. The private `.env.local` must have the matching `APP_ORIGIN`, database connection and selected provider credentials. A different port requires a matching origin. Never show that file, cookies or tokens during a screen share.

For an already approved production staging environment, use the supported build/runtime instead:

```bash
npm run build -- --webpack
npm start
```

Production requires the configured HTTPS reverse proxy and exact HTTPS `APP_ORIGIN`; do not weaken Secure cookies to demonstrate production over plain HTTP. Avoid building into the `.next` directory of a running development server; use a separate checkout/copy. See [deployment](deployment.md).

## 2. Prepare fictional files

Use one terminal for these commands so the generated directory variable stays available. They are optional preparation instructions, not commands executed by this documentation task.

```bash
DEMO_FIXTURE_DIR=$(mktemp -d /tmp/knowledge-demo.XXXXXX)
cp tests/fixtures/fictional-policy.pdf "$DEMO_FIXTURE_DIR/"
cp tests/fixtures/fictional-policy.docx "$DEMO_FIXTURE_DIR/"
cp tests/fixtures/fictional-policy-v2.docx "$DEMO_FIXTURE_DIR/"
cat > "$DEMO_FIXTURE_DIR/fictional-sales.csv" <<'CSV'
team,amount,active
Alpha,10,true
Alpha,20,false
Beta,6,true
CSV
cat > "$DEMO_FIXTURE_DIR/fictional-sales-revised.csv" <<'CSV'
team,amount,active
Alpha,12,true
Alpha,18,false
Beta,15,true
CSV
cp "$DEMO_FIXTURE_DIR/fictional-sales.csv" "$DEMO_FIXTURE_DIR/fictional-sales-renamed.csv"
cat > "$DEMO_FIXTURE_DIR/invalid-headers.csv" <<'CSV'
team,team
Alpha,10
CSV
```

Choose these files in the browser's file picker. All three policy fixtures describe a minimum team sales target of **15 units**; v2 has different bytes so explicit document replacement is possible without changing that fact. These are not the entire 25-case evaluation corpus. Do not substitute real personal documents.

## 3. Login and dashboard

1. Sign up with a new fictional demo account A, a unique `example.test` email and a locally chosen password of at least 12 characters. Keep its credentials private. Existing demo accounts may be used only if explicitly designated for this run.
2. Expected: the dashboard opens; Documents, Datasets and AI Chat navigation works. An empty account should not show another account's sources.
3. Sign out and sign back in once. Expected: protected navigation requires a session after logout. If a session expires, sign in again rather than changing cookies or CSRF settings.
4. Keep account B in a separate browser profile/incognito context for the isolation step; do not mix accounts by editing client user IDs.

## 4. PDF/DOCX upload

1. In **Documents**, upload `fictional-policy.pdf`, then `fictional-policy.docx`. Wait for successful processing and refresh if necessary. Expected: both are ready under A; filename, file type and version metadata are visible. BGE/Ollama must be reachable.
2. Upload the same DOCX again. Expected: HTTP 409 and a clear identical-active-document message, with no second active copy/chunks for that byte-identical file.
3. Keep the ready policy documents until after all AI and isolation questions below. Do not delete or replace unrelated documents.

PDF and DOCX have different bytes even when their text is similar. Document duplicate detection uses bytes/SHA-256, unlike CSV replacement's parsed-data equality. No original-file download/preview API should be claimed.

## 5. CSV upload, schema and structured queries

Upload `fictional-sales.csv` using **Datasets**. Select it and inspect schema. Expected: three rows, `team` Text, `amount` Number and `active` Boolean. This is the generic dataset route; do not use the legacy employee-leave CSV branch of document upload.

Use the query builder. Reset queries between independent examples so filters/groups do not carry over.

| Action | Controls | Expected fictional result |
| --- | --- | --- |
| Filter and sort | Rows; filter amount ≥ 10; sort amount descending | Alpha 20 then Alpha 10; Beta 6 excluded |
| Boolean filter | Rows; active equals true | Alpha 10 and Beta 6 (order unspecified without sorting) |
| COUNT | COUNT; no filters/groups | 3 |
| SUM | SUM; numeric column amount; no filters/groups | 36 |
| AVG | AVG; numeric column amount; no filters/groups | 12 |
| GROUP BY | SUM(amount); group by team; sort aggregate result descending | Alpha 30, Beta 6 |

Expected totals cover all filtered source rows; the row-display limit is not a substitute for aggregation. Invalid plans must show a safe error. Uploading `invalid-headers.csv` should fail without creating a discoverable dataset. Header-only/empty CSV files are also invalid.

## 6. AI questions and citations

Select **AI Chat**. Multi-Source Agent is the default; Document RAG is a separate mode. Questions are independent: previous chat messages are not model context, so name the source and ask a complete question each time. Keep the original CSV unchanged through this section.

Every Send may make real provider calls. Run one request at a time; allow provider pacing and leave a conservative pause between questions (65 seconds was used for historical multi-step live checks). RPM spacing does not guarantee sufficient token/daily quota. Never repeatedly click Retry on a 429, timeout or uncertain failure. The table states **expected results**, not promises that probabilistic generation or the provider will succeed.

| Mode | Question | Expected evidence and result |
| --- | --- | --- |
| Document RAG | What is the minimum team sales target mentioned in fictional-policy.docx? | 15 units, grounded answer and an owned policy document citation |
| Multi-Source Agent — document | According to fictional-policy.pdf, what minimum sales target must a team meet? | 15 units using document evidence; no invented CSV values |
| Multi-Source Agent — CSV | Using fictional-sales.csv, what is the total amount for each team? | Alpha 30 and Beta 6 using owned CSV discovery/schema/query evidence |
| Multi-Source Agent — combined | Using fictional-policy.docx and fictional-sales.csv, compare each team total with the policy minimum. Which teams are below it, and by how much? | Threshold 15; Alpha 30 meets it, surplus 15; Beta 6 is short by 9. Both policy and CSV sources support the comparison |
| Multi-Source Agent — insufficient evidence | What is the approved company budget for a Mars office in 2040? | No invented budget. Expected grounded=false/no supporting sources and an insufficient-evidence message |

Check the answer against the source panels, not just fluent wording:

- Preserve displayed source markers: Document RAG uses S labels; agent evidence uses D/C labels. Exact numbering can vary; do not require a guessed source number.
- Policy citations must resolve to an uploaded owned active policy and original supporting text. Show chunk index only as returned; page numbers may be absent and must not be invented.
- CSV evidence should show the actual grouped rows/plan and filenames. Check the threshold and subtraction independently.
- If evidence is insufficient, a refusal is correct; if the model invents a number, record a failed demonstration rather than calling it a success.
- For errors, record the safe code/status/request ID from the response and investigate the correlated logs. Do not display provider bodies, personal excerpts or credentials. A 403 provider denial, rate limit or failed citation check is not a successful answer.

Historical Day 8 live fictional RAG/combined answers are documented in [verification](day-8-final-verification.md#live-ai-results). They do not certify this fresh demo or the full 25-case benchmark. Current live-provider retest/human-review gaps remain in [the final report](final-project-report.md).

## 7. User data isolation

1. Create/login as fictional B in a separate browser context, leaving A signed in separately.
2. Expected: B's lists do not contain A's policies or `fictional-sales.csv`.
3. In B's Document RAG mode, ask the same policy question while B has no documents. Expected: no owned evidence, grounded=false/no A sources. Do not assume the policy is global knowledge merely because its filename is known.
4. A direct dataset query or document/dataset mutation using A's ID from B must fail safely. For an API demonstration, use B's legitimate session/CSRF/Origin; a missing CSRF rejection alone does not prove ownership isolation. Obtain IDs only from A's own responses; never guess real users' IDs or share cookies.
5. Return to A's browser for lifecycle actions. No ownership transfer is performed. See [auth acceptance](day-7-authentication.md) and [test register](final-test-cases.md).

The UI resets private page state after a verified account change; every backend request independently enforces ownership. Do not interpret an existing answer already displayed in A's tab as a new B retrieval.

## 8. CSV replacement, identical data and deletion

Run after the original-data AI demonstrations. Use A's original demo dataset only.

1. Choose **Replace**, select `fictional-sales-renamed.csv`, and confirm. Expected: HTTP 409 `IDENTICAL_DATASET`; “This dataset already contains the same data. No changes were made.” Filename alone is ignored; existing ID, filename and rows stay intact. Parser-equivalent quoting/CRLF/decimal formatting also compares equal.
2. Choose Cancel or select a different file. Replace using `fictional-sales-revised.csv`. Expected: same ID/owner, new filename/rows and fresh schema selection; stale query results cleared. SUM becomes 45, AVG 15, COUNT 3; grouped totals Alpha 30/Beta 15. Both teams now meet the 15-unit target. Do not compare this state to the earlier Beta-shortfall answer as if it used the new rows.
3. Try replacing with `invalid-headers.csv`. Expected: safe validation error; revised data remains intact. Refresh and verify SUM=45.
4. Choose **Delete**, Cancel once, then confirm. Expected: dataset and its rows removed from discovery/querying; a saved query to that ID becomes unavailable. A second deletion returns a safe 404. The deleted dataset must not appear in a new agent discovery.

Ordinary POST uploads still create independent datasets, even when files match. The identical-data check applies to **explicit replacement of the selected owned dataset**, not all uploads. Replacement has no version history or undo. A lost response near commit is uncertain: refresh before retrying. For concurrency and snapshot semantics, see [CSV lifecycle](day-10-csv-lifecycle.md).

## 9. Document replacement/deletion and finish

1. In A's Documents list choose Replace for the original DOCX. First select its identical original: expect 409 with no new version. Then choose `fictional-policy-v2.docx`: expect version 2 active; previous version excluded from new retrieval. The target remains 15 units.
2. Delete only A's demo documents, confirming each action. Expected: active knowledge disappears; chunks/files are cleaned or private cleanup remains pending without exposing a path. Do not delete a newly replaced document by relying on an old ID; select its current row.
3. To verify document absence, ensure all demo policy copies (including the PDF) are removed before asking about them. Already rendered messages or in-flight evidence are snapshots and are not retroactively revoked.
4. Sign out. Remove only this run's fictional fixtures if using an approved cleanup process; there is no account-deletion UI. Do not reset the database or remove another run's resources.
5. Record the build/environment, actions, expected/actual results, safe request IDs and any failures in a separate acceptance record. Update [manual statuses](final-test-cases.md#1-sixteen-manual-acceptance-slots) only after actual verification.

## Demonstration limits

This guide does not certify provider availability, full live AI accuracy, human claim-level citation support or production capacity. Session expiry, cleanup failures, concurrent mutations and repeated outages are better demonstrated with existing isolated automated tests than by disrupting a shared working installation. No frontend redesign, provider/model change or security bypass is part of this demo.
