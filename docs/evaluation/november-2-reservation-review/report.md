# November 2 reservation review

## Decision

**Stop condition applied: no application optimization implemented.** The saved evidence supports correct conservative admission, not a demonstrated accounting defect or a safe output/context reduction large enough to solve these failures. No provider requests, database changes, production ledger transactions, quota resets, model changes, timeout increases, commits or pushes were made. Historical evaluation files remain unchanged.

Only a new offline regression test, this report and its measurements file were added. No functionality changed. The success criterion of a justified reservation reduction was **not met**; no improvement or live success is claimed.

## Recorded measurements

These are saved November 2 trace values, not new provider executions. The two IDs match the three dashboard token totals; association with the user's Test 20/21 labels still requires the browser IDs.

| Request / stage | Encoded input + framing reserve | Output ceiling | Total reservation | Actual total usage | Admission |
|---|---:|---:|---:|---:|---|
| `2ae6242a…` planning 1 | 2,655 | 1,536 | 4,191 | 2,702 | Allowed |
| `2ae6242a…` generation 2 | 3,469 | 3,000 | 6,469 | Not sent | Local TPM 429 |
| `0f673738…` planning 1 | 1,772 | 1,536 | 3,308 | 1,689 | Allowed |
| `0f673738…` planning 2 | 2,297 | 1,536 | 3,833 | 1,833 | Allowed |
| `0f673738…` planning 3 | 3,169 | 1,536 | 4,705 | Not sent | Local TPM 429 |

Input/framing reserve is the logged reservation minus the configured output ceiling. It includes tokenized wire JSON, 256 fixed framing tokens and 32 per message. It is **not actual provider prompt usage**. Wire payloads and separate prompt/completion usage were not retained for these calls. Therefore the differences cannot be assigned solely to unused output or inaccurate input estimation.

Completed calls released 1,489, 1,619 and 2,000 tokens respectively: 5,108 in total. No pending reservations remain. Daily accounted usage was only 6,224 tokens in the later trace, so this incident was not daily quota exhaustion.

At the first block, local remaining TPM was 5,298 but retained provider allowance was 4,400; the next reservation was 6,469. At the second, local capacity was 4,478 and retained allowance 3,293; the next reservation was 4,705. Both are local admission failures before HTTP dispatch, not Groq HTTP 429s.

## Why no ceiling or estimator change was justified

The generator's 3,000 ceiling is larger than the planner's 1,536, but its actual output was never generated. Simply adopting 1,536 would still reserve approximately 5,005, above the first provider allowance. Holding the input estimate fixed, fitting would require an output ceiling of approximately 931. For the blocked third planning call, fitting the 3,293 allowance would leave only approximately 124 output tokens. These are arithmetic illustrations, not proposed settings; changing the numeric wire field can slightly change tokenization too.

There is no recorded current-model output distribution or exact affected prompt to establish that those caps preserve complete answers/tool calls. A lower cap can cause incomplete JSON, reasoning or citations; existing finish-reason and citation checks would correctly fail rather than invent an answer. It would not establish reliable completion.

The estimator serializes the full request including tools and reserves maximum output plus framing. This is conservative by design. Groq's exact server formatting is not represented by saved trace totals; removing safety margins would be speculative. Existing model-facing context already reuses schemas, suppresses repeated source bodies and retains original verification evidence. No duplicated exact payload was saved that can be safely removed and measured for these incidents.

## Call sequence and deadlines

First request: prepared evidence/schema work → one successful planner → final generator denied. There was no extra planning confirmation to eliminate.

Second request: planner 1 → validated CSV query → planner 2 → document retrieval → planner 3 denied. The last search may have been needed for policy support. Logs do not contain the exact question, arguments, full tool results or planner text, so declaring the third call redundant would be unsupported. The existing completion hint applies to a final validated CSV query, not arbitrary searches or unresolved policy applicability.

The retries required 57/56 seconds. Transport caps each call at 30 seconds and leaves 10 seconds for HTTP execution, so admission has at most about 20 seconds. Overall agent deadline is 60 seconds. Waiting cannot fit those token windows. This is a deadline/budget compatibility limitation, not an accounting leak. Waiting before a new question does not guarantee that all calls of that question fit one window.

## Offline replay and before/after

`tests/reservation-replay.test.ts` uses isolated in-memory quota stores and a fake clock. It verifies both recorded rejections, actual-usage reconciliation, zero leaked reservations, no daily-limit classification, refusal when the 57-second wait cannot fit 20 seconds, and admission after a genuine token-window expiry. It never opens the persistent production ledger or calls a provider.

All three focused replay tests passed. Before and after values, call counts and admission outcomes are **unchanged**, because no application fix was justified. Request 1 has one completed HTTP call and two logical calls including the denied generator; request 2 has two completed HTTP calls and three logical calls including denied planning. The replay is not a model-response replay: exact request/response bodies were unavailable. It cannot verify generated answer completeness, truncation or citation behavior for the calls that never ran. Existing regression checks remain responsible for citation, malformed-output and finish-reason behavior.

[Machine-readable measurements](measurements.json). Final validation: `npm test` **323 passed, zero failed, 12 skipped (335 total)**; `npx tsc --noEmit` **passed**; `npm run lint` **passed**; `npx next build --webpack` **passed**; `git diff --check` **passed**. The new three tests are included in the standard suite. Existing mock-provider tests passed, but no new model output was generated and no live accuracy claim follows. The persistent ledger hash and modification time remained unchanged. Database-enabled tests were not enabled because this task forbids database modifications.

## Smallest safe next step

Do not lower ceilings, remove framing, ignore provider headers or bypass admission based on these totals. No live retest of unchanged code is needed merely to reproduce a known rejection. If separately authorized, one bounded diagnostic retest could capture **numeric-only** stage input/output usage, request-size components and finish reasons, with explicit request/token caps. Do not log prompts, credentials or private evidence. That would provide the missing evidence for a future ceiling/context decision; it is not approval for further work or a promise of success. Deadline alignment would be a separately reviewed change, not an arbitrary increase in this task.
