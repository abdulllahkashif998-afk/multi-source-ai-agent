# Groq token reservation diagnostics — 2 November 2026

## Outcome

Implemented the missing safe numeric measurements. **No token ceiling, estimator margin, quota, deadline or model-call workflow was reduced or changed.** Saved evidence still cannot establish a safe reduction sufficient to admit the blocked requests. No live Groq requests were made; no completion improvement is claimed. Stop condition applied after instrumentation and offline validation.

## Changes

- `src/lib/groq-quota.ts`: exposes the existing estimate as wire tokens, framing, estimated input reserve, output reservation and total. The legacy estimator returns exactly the same total. An optional observer receives a numeric pre-reservation snapshot inside the existing atomic transaction, for allowed and denied decisions. Observer exceptions do not affect admission. No extra quota transaction or disk state is added.
- `src/lib/quota-admission.ts`: forwards the observer through existing bounded admission retries without changing waits or reservation behavior.
- `src/lib/provider-transport.ts`: records the estimate and atomic available TPM; extracts only safe integers from existing response usage: prompt, completion and optional reasoning tokens. Existing total-token reconciliation remains authoritative. Missing/malformed usage stays null and retains the existing conservative charge. The response is still returned intact.
- `src/lib/provider-usage.ts` and `src/lib/reliability.ts`: correlate numeric events with request ID, logical model-call count, completed native-attempt count and allowlisted planning/generation phase. Token fields are explicitly allowlisted and nonnegative safe integers or null. No request body, prompt, model argument, source text, cookie, key, URL or provider error body is logged.
- `src/lib/groq-transport.ts`: increments the existing development singleton revision so reloaded code uses the new instrumentation. It reconnects to the same ledger; no quota reset occurs.
- `tests/provider-token-diagnostics.test.ts`: five new offline tests for formula equality, atomic capacity, observer failure safety, both model phases, actual usage components, unknown usage, denied dispatch and log privacy. The previous saved-scenario replay tests remain unchanged.

## Log interpretation

`provider-reservation` includes `wireTokens`, `framingTokens`, `estimatedInputTokens`, `outputReservation`, `totalReservedTokens`, `minuteTokens`, `dayTokens`, `localTPMRemaining`, optional `providerTPMRemaining`, `availableTPM` and `admitted`. These values describe the atomic decision **before** adding the current reservation. Available TPM is the smaller of local headroom and retained provider allowance. It is not a guarantee of admission: daily/request budgets and cooldown still apply. A provider allowance is omitted if no unexpired header is retained, rather than fabricated as zero. Rechecks may produce more than one snapshot; they are not additional model calls.

`provider-usage` adds `reportedPromptTokens`, `reportedCompletionTokens` and optional `reportedReasoningTokens`, together with the same input/output estimate and phase. Unknown usage is null. Reasoning tokens are a component of completion usage, not an extra charge. Native attempts are counted only when dispatched; denied calls produce no fabricated usage event. Existing safe local/provider 429 classification remains intact.

The input estimate is tokenized **wire JSON plus conservative framing**, not a promise of exact provider prompt tokenization. Compare it with provider-reported prompt usage only when available. The full request is still counted, including schemas and conversation history. Logging failures are swallowed and never bypass quota admission.

## Saved-scenario before/after

| Scenario | Input/framing reserve | Output reservation | Total before → after | Actual prior usage | Admission before → after |
|---|---:|---:|---:|---:|---|
| Request 1, planner | 2,655 | 1,536 | 4,191 → 4,191 | 2,702 total | allowed → allowed |
| Request 1, generator | 3,469 | 3,000 | 6,469 → 6,469 | not dispatched | local TPM 429 → same |
| Request 2, planner 1 | 1,772 | 1,536 | 3,308 → 3,308 | 1,689 total | allowed → allowed |
| Request 2, planner 2 | 2,297 | 1,536 | 3,833 → 3,833 | 1,833 total | allowed → allowed |
| Request 2, planner 3 | 3,169 | 1,536 | 4,705 → 4,705 | not dispatched | local TPM 429 → same |

These are the saved traces analyzed in [the preceding review](../november-2-reservation-review/report.md), not reconstructed original payloads. The formula-equality tests additionally compare newly constructed fictional wire requests against the pre-change formula. Call counts are unchanged: first request one native success plus denied generation; second request two native successes plus denied planning. No token savings were measured.

The 6,469 reservation exceeded retained allowance 4,400; the 4,705 reservation exceeded 3,293. Merely setting generation output to 1,536 would still leave approximately 5,005 reserved, too high. Fitting the blocked planner at unchanged input would leave approximately 124 output tokens, without evidence that complete tool calls fit. Lower caps may truncate JSON/citations; no such speculative change was made. The required 56–57 second waits still cannot fit the existing per-call admission budget.

The first request had no redundant planning confirmation. The second performed CSV querying and then document retrieval; exact question, arguments and full evidence were not retained, so redundancy or safe context removal cannot be established. Existing evidence-completion and verification safeguards remain unchanged.

## Validation

Final validation: `npm test` **328 passed, zero failed, 12 optional database skips (340 total)**; `npx tsc --noEmit` **passed**; `npm run lint` **passed**; `npx next build --webpack` **passed**; `git diff --check` **passed**. Repository security scan: **zero findings**, 368 working files and 431 history blobs scanned. All new development uses fake clocks, scripted HTTP responses and in-memory quota stores. No production ledger is opened by the new tests; its file hash and modification time were checked unchanged. Existing optional database tests remain disabled to honor the no-database-modification constraint. No historical evaluation artifact is edited, no files are staged, and no commit or push is made.

## Remaining measurements and next step

The new diagnostics can supply actual per-stage input, output and reasoning usage on a future authorized request, without exposing evidence. No such live request was authorized or executed here. Existing historical traces cannot be enriched retrospectively. Until representative current-model usage is collected, there is no supported output-cap or margin calibration, no proof that a confirmation round is redundant, and no verified improvement in live completion rate. Provider 400s, real quota exhaustion and deadline constraints remain possible. Do not interpret mocked results as live success.
