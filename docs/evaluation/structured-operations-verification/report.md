# Real-infrastructure deterministic operation verification

**Real PostgreSQL and local BGE retrieval; no Groq inference.**

See the [resolution report](../../agent-remaining-failures-resolution.md) for scope, safety, tests and remaining limitations. This is a new verification artifact; original live Groq reports remain unchanged.

Fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. Started: 2026-10-29T12:08:40.940Z; completed: 2026-10-29T12:08:42.624Z (UTC).
Summary: `{"executed": 3, "returnedGrounded": 3, "executionErrors": 0, "automaticPass": 3, "humanReviewed": 0, "actualGroqRequests": 0, "blockedProviderAttempts": 0, "localEmbeddingCalls": 15}`.
Preservation: `{"historicalFilesUnchanged": true, "publicDatabaseRecordsUnchanged": true}`.

The existing database adapter was used with its trusted fictional owner and rollback-only TEMP tables. External provider HTTP was blocked throughout; no model response was mocked or generated. Local embedding calls use the existing BGE model.

## csv-05

Actual answer (41.64 ms):

East-region sales amount: 20. [C1]

East-region sales amount: 10. [C1]

Sources:

- C1: sales.csv; dataset 201
  Exact evidence: `[{"team":"Alpha","amount":20,"region":"East"},{"team":"Alpha","amount":10,"region":"East"}]`

## combined-04

Actual answer (86.88 ms):

Alpha total is 30 units; the policy minimum is 15 units; meets the target; surplus is 15 units. [D1] [C1]

Beta total is 6 units; the policy minimum is 15 units; shortfall is 9 units. [D1] [C1]

Gamma total is 15 units; the policy minimum is 15 units; meets the target; surplus is 0 units. [D1] [C1]

Sources:

- D1: team-policy.docx; document 1, chunk 101, page None
  Exact evidence: `Orion team policy: the minimum monthly total sales target for each team is 15 units.`

- C1: sales.csv; dataset 201
  Exact evidence: `[{"team":"Alpha","value":30},{"team":"Beta","value":6},{"team":"Gamma","value":15}]`

## combined-05

Actual answer (101.26 ms):

Mira cost is 450 credits; the approval limit is 500 credits; approval is not required because the amount is at or below the limit. [D1] [C1]

Jon cost is 620 credits; the approval limit is 500 credits; approval required; excess is 120 credits. [D1] [C1]

Sol cost is 500 credits; the approval limit is 500 credits; approval is not required because the amount is at or below the limit. [D1] [C1]

Sources:

- D1: travel-policy.docx; document 4, chunk 104, page None
  Exact evidence: `Travel expenses above 500 credits require manager approval.`

- C1: expenses.csv; dataset 202
  Exact evidence: `[{"cost":450,"employee":"Mira"},{"cost":620,"employee":"Jon"},{"cost":500,"employee":"Sol"}]`

Automatic checks pass for all three. Answerable prose remains formally needs-review under the unchanged human-review rubric; no human ratings are invented. [Raw results, citations, plans and timings](results.json).
