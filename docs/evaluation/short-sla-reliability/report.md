# Short SLA question reliability

## Confirmed findings

The question `Which P1 incidents exceeded the policy first-response deadline?` did not match the existing filename-based SLA grammars and entered general multi-call planning. Recent server traces include local TPM rejections, including `577b2fed-65e8-43fb-8917-249d9aa9fb62` and `c9cec2c6-7f9b-4da7-8442-0121452492f5`, with `rateLimitOrigin=local`, `quotaReason=tpm`, HTTP 429. No request ID was supplied for the short question, and private question text is intentionally absent from logs. These traces therefore establish recent local rejection behavior, not a definitive question-to-request correlation. Successful Groq dashboard rows do not show whether a later planning invocation was denied before dispatch.

A read-only snapshot of the default same-host ledger showed 23 entries, zero pending entries, zero unknown-usage entries, no lock directory, no active remote-token constraint and zero locally charged/reserved tokens in the current minute. The rolling-day known charge was 28052 tokens. This later snapshot cannot reconstruct balances at a previous rejection or prove available organization-wide quota. No stale-lock, stranded-reservation or unknown-usage cause was demonstrated. No ledger entry was reset, deleted or altered by this investigation.

The configured model remains `openai/gpt-oss-120b`. The unchanged local budgets match the user-confirmed limits: RPM 30, RPD 1000, TPM 8000, TPD 200000, with 12-RPM application pacing. Exact provider quota availability was not checked with live calls. Token reservations include full request/context, conservative framing and output allowance. Repeated planning can legitimately exceed TPM even when each dispatched call succeeds and later actual output is small. No accounting defect was confirmed here, so accounting, retry, timeout and transport code were left unchanged.

## Targeted correction

The existing deterministic SLA operation now recognizes the supplied short question and the bounded `Which P1 tickets missed the policy first-response SLA?` variation. It reuses the existing document threshold extraction, validated CSV filters, boundary handling and strict reference-based citation verification.

For questions without explicit filenames:

1. Discover up to 50 owned document-list entries through the existing ownership-checked read-only service. Truncated discovery abstains. Consider ready files with a separate `policy`/`policies` word in the filename; require exactly one candidate.
2. Discover owned datasets. More than 20 candidates abstains. Stored schema metadata identifies candidates with exactly one text severity/priority, one ticket ID and one numeric response-hours/minutes column. Require exactly one compatible dataset.
3. Search within the selected named document before ranking. The selected dataset is still inspected through the existing tool gate before any row query.
4. Extract the supported policy rule, reject scope/threshold ambiguity, and run the existing owner-checked structured filter and comparison. Both document and CSV citations are required.

Policy naming is a conservative discovery convention, not semantic proof of precedence or applicability. A differently named policy will not be guessed. Multiple policy files, duplicate compatible datasets, truncation, missing rules or genuine conditions abstain. This intentionally favors clarification over silently selecting a governing policy. No Northstar names, values or IDs appear in application logic. No paid calls, new SQL execution mechanism or public model tool was introduced.

Discovery is bounded by existing request cancellation and tool-call limits. Dataset candidate metadata does not count as query evidence or authorize querying by itself. The selected dataset still passes normal discovery/inspection/SQL checks. No user ID comes from the question/browser.

## Files changed for this follow-up

- `src/lib/agent-sla.ts`: bounded short grammar and unambiguous policy/dataset selection before the existing comparison.
- `src/lib/agent-tools.ts`: optional backend-only policy metadata discovery, bounded/cancellable, and lookup of already ownership-scoped dataset metadata. Existing model tool input schemas are unchanged.
- `src/lib/knowledge-agent.ts`: production policy discovery reuses `listDocuments()` and ready-status filtering.
- `tests/agent-sla-reliability.test.ts`: short/long variations, source citations, missing/ambiguous/truncated discovery, cancellation, real SQL and foreign-owner isolation.
- README and this new evidence directory. Existing evaluation artifacts are not edited or relabelled.

## Real local verification

The full production agent service was executed under the previously confirmed owner identity, using the existing uploaded files, real PostgreSQL/pgvector and local BGE. PostgreSQL enforced read-only mode. All external HTTP was blocked. The short question returned grounded=true and the same three qualifying tickets: NS-003, NS-014 and NS-025; each 1.5 hours actual against a 1-hour deadline, difference 0.5 hours. Each statement cites both sources and passes the unchanged final verifier.

See [actual answer and safe verification metadata](real-account-results.json). The run took **231 ms**, used **one local embedding call and zero external provider calls**. Before/after hashes and row counts matched for users, documents, chunks, datasets and rows. This is one service diagnostic, not a benchmark distribution. It does not replay a browser session cookie or establish a new authenticated browser HTTP result. The user's confirmation that the longer question passes in their browser is user-reported acceptance, separate from this service verification.

## Automated checks

| Command/check | Actual result |
| --- | --- |
| `npm test` | 285 registered; 274 passed, 11 database-only skipped; zero failures |
| `npm run test:fresh-db` | All 285 passed; zero skipped/failures; disposable cluster removed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed |
| Repository security scan | Passed; no findings |
| Documentation links / `git diff --check` | Passed |

Existing fake-clock and mocked-provider quota regressions cover local versus provider 429, TPM/TPD admission, actual/unknown usage reconciliation, multi-worker reservations, concurrent pending admission, cancellation and safe error normalization. The full suite includes prior long SLA, ownership, citation and boundary regressions. No live AI output was substituted for these mocks; no 25-case evaluation was rerun.

## Remaining limits and delivery

- A new authenticated browser submission of the short question remains a manual acceptance step. The real-data backend service check passed; no live Groq retest was needed.
- General wording outside the supported grammars still uses the model planner, which can legitimately encounter local or provider quotas. Limits were not raised and legitimate quota restrictions are not bypassed.
- For local TPM, admission becomes possible when enough completed entries age out of the rolling 60-second token window and remote constraints/cooldowns expire. Pending work remains charged; unknown usage retains its reservation. Daily usage ages out over 24 hours. A later request must fit its own estimated reservation as well. Do not delete the ledger to retry.
- Same-host coordination does not cover separate hosts, other applications sharing the Groq organization or unobserved provider usage. A restart preserves the persistent ledger.
- Conservative filename/schema discovery can abstain on safely answerable but ambiguous or differently labelled corpora. It does not implement general source linking, cross-dataset joins or universal policy understanding.
- No existing user data, credentials, models, historical results or security protections were changed. No commit or push was made. Final browser acceptance and review of the complete pre-existing Git working tree/staging inventory remain before delivery.
