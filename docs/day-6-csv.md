# Generic CSV storage and queries

Migration `migrations/006-generic-csv.sql` was applied after its purpose was explained. It creates two new tables and an owner index. Existing document, employee and CSV tables were not changed. Apply it once per database, using your migration process; do not rerun it blindly.

Development API (user 1, production blocked until authentication exists):

- `POST /api/datasets`: multipart form with `file`, a CSV up to 10 MiB. Returns dataset ID and inferred columns.
- `GET /api/datasets`: up to 100 owned, ready datasets with column schemas and row counts.
- `POST /api/datasets/query`: JSON structured plan. Never accepts SQL or a client user ID.

Example manual procedure:

```bash
printf 'team,amount,active\nAlpha,10,true\nAlpha,20,false\nBeta,6,true\n' > /tmp/fictional.csv
curl http://localhost:3000/api/datasets -F file=@/tmp/fictional.csv
curl http://localhost:3000/api/datasets
# Replace 1 with the returned generic dataset ID:
curl http://localhost:3000/api/datasets/query -H 'Content-Type: application/json' -d '{"datasetId":"1","groupBy":["team"],"aggregate":{"op":"sum","column":"amount"},"sort":{"column":"value","direction":"desc"},"limit":10}'
```

Expect Alpha=30 and Beta=6. Try count without a column, avg on amount, and filters such as `{"column":"amount","op":"gte","value":10}`. Filters combine with AND. Supported operators: eq, ne, gt, gte, lt, lte. Boolean filters allow equality only. Values must match inferred types. Aggregated output uses `value`; group columns named value are rejected to prevent collisions. Grouping requires aggregation. Sorting uses a known column or aggregate value. Query limits are 1–100.

Invalid headers, duplicates, empty datasets, malformed rows, over 100 columns or 10,000 rows are rejected. Types are number, boolean and text; mixed types and dates remain text, leading-zero identifiers remain text, and empty cells become null. Numeric inference avoids unsafe integer magnitudes; decimal calculations use PostgreSQL numeric after JSON ingestion, but ingestion uses JavaScript numbers, so arbitrary precision is not guaranteed.

Imports use one transaction, with importing status promoted to ready only after all rows are stored. Failures roll back. Discovery and query execution exclude incomplete datasets and enforce ownership. Query transactions are read-only, have a five-second statement timeout, and parameterize column JSON keys and filter values. Imports have a ten-second statement timeout. There is no arbitrary SQL interface.

The original `/api/upload` employee CSV path remains unchanged for compatibility. Use `/api/datasets` for generic files. Legacy datasets are not automatically copied or assigned ownership. No Gemini tools, UI, or multi-source reasoning were added.

Verification: `npm test`, `npx tsc --noEmit`, `npm run lint`. 24 tests passed, including all 19 Day 5 tests. Fictional grouped sums, averages, counts and sorted rows were also verified in PostgreSQL inside a rolled-back transaction. Tests do not require external AI calls.

Changed files: the migration, `src/lib/generic-csv.ts`, `app/api/datasets/route.ts`, `app/api/datasets/query/route.ts`, `tests/generic-csv.test.ts`, and this guide.

Limitations: bounded in-memory parsing; no date inference, null filtering, pagination, OR expressions or multiple aggregates per plan. API error messages deliberately omit database details. Upload bodies are parsed by the framework before the file-size check, so deployment request-body limits should also be configured. Dataset discovery is capped at 100. Next steps: authenticated identity, pagination, explicit type overrides and broader database integration tests before model tool integration.
