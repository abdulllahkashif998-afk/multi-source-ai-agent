# Shared quota-aware admission: RAG and Multi-Source Agent

## Implemented behavior

Both selected-Groq modes use the same transport and persistent same-host ledger. The change adds deadline-aware **admission waiting**, not retries of a completed question or speculative model calls.

1. An atomic ledger transaction evaluates RPM, TPM, RPD, TPD, pending reservations, actual/unknown charges, provider remaining allowances and cooldowns.
2. On a denial, it calculates a next safe time from the current snapshot: enough weighted token/request entries must expire, and binding retained provider constraints/cooldowns must expire. Numeric diagnostics record requested tokens, current minute/day charge, retained token capacity and retry delay, without prompts, keys or private contents.
3. Temporary RPM/TPM/cooldown restrictions can sleep and retry admission if the known delay fits. The ledger lock and token reservation are **not held during sleep**. Pending work may settle/refund before its conservative expiry; those waits use bounded approximately one-second rechecks, not a spin loop. Every attempt rereads/rechecks atomically, so another worker consuming capacity can move the next admission time.
4. Daily exhaustion returns immediately. Requests larger than a whole configured token budget cannot be solved by waiting and return a request-size reason. Unknown usage retains its conservative charge.
5. Pacing occurs before admission. If another caller claims dispatch spacing while a ledger transaction completes, this caller releases its known-unsent reservation before waiting again. A successful dispatch claims spacing synchronously, preserving actual-call pacing. The per-process active/waiting cap remains eight; same-host budget coordination still requires all workers to share the same private directory.
6. Cancellation exits waits and leaves no new reservation. Known-unsent cleanup gets an independent bounded cleanup signal; sent uncertain work remains conservatively charged if usage/cleanup cannot be established.

`Retry-After` and `retryAfterSeconds` are returned when calculable, alongside safe `rateLimitOrigin` and `quotaReason`. The success payload is unchanged. Daily-quota errors explain the daily reset; request-size errors ask for a simpler request. Provider HTTP 429 remains distinct from local admission; the existing maximum-one short provider recovery policy is preserved. These retry times describe current known constraints, not a guaranteed future reservation in a competing/shared account.

Example local denial payload (illustrative, not a live provider result):

```json
{
  "success": false,
  "code": "PROVIDER_RATE_LIMITED",
  "error": "The answer service is busy. Please retry shortly.",
  "rateLimitOrigin": "local",
  "quotaReason": "tpm",
  "retryAfterSeconds": 37
}
```

Safe admission counters remain in server logs; they are not returned to clients. No credentials, document text, tool arguments or session data are added to logs.

## Deadline limitation: deliberately not hidden

Current deadlines are preserved:

| Boundary | Existing/current budget |
| --- | ---: |
| Document RAG request | 45 seconds |
| Agent request | 60 seconds |
| Agent planning window | Overall deadline minus 15-second final reserve |
| SDK/transport model step | At most 30 seconds, also bounded by remaining stage/request time |
| Response headroom held before quota admission | 10 seconds |

Consequently, a model invocation generally has **less than 20 seconds available for admission waiting**, sometimes less after retrieval or earlier steps. A near-expiry quota window can now be waited out; a fresh full-minute window generally cannot. A known wait that cannot fit returns 429 promptly with guidance instead of waiting until a misleading generation timeout. Cancellation/actual execution timeouts retain their normal cancellation/504 behavior.

This is a bounded short-wait solution, **not a claim that arbitrary consecutive questions now fit a 60-second request**. The smallest coherent follow-up for full-minute admission is a coordinated deployment change: for example, 120-second outer server/request budgets, a 15-second Agent final reserve, up to 90 seconds per model step including admission, a separate 30-second network execution cap after dispatch, browser timeouts above the outer budget, and hosting/proxy limits that support that duration. That deployment-dependent change is recommended, not implemented. Raising only one timeout would be inconsistent. Even that cannot guarantee multiple quota windows or unlimited throughput.

## Token efficiency without evidence loss

- Existing request-local schema preparation, active-tool narrowing, retrieval/result deduplication and compact source catalogs remain in use. No cross-user schema/evidence cache was introduced.
- The general planner now stops after **two consecutive duplicate-only successful tool rounds**. Only exact previously successful requests count; different searches/queries and tool-error recovery retain the existing eight-step bound. Backend-cached results are unchanged, so these duplicate rounds cannot add new evidence.
- One scripted loop test performs one actual backend query and three planning invocations before final generation, rather than continuing the duplicate loop to the eight-step cap. This is a mocked call-count observation, not a measured live token saving or AI quality result.
- RAG already uses one generation pass with source metadata and quote choices. Its original text and granular quote options were kept: removing evidence or citation options without live quality verification would be an accuracy tradeoff, not a safe quota fix.
- Waiting makes **zero provider calls and reserves zero tokens while sleeping**. It does not reduce the tokens a subsequently dispatched request actually uses. No live token improvement was measured. Model selection and the existing 1536-token planning / 3000-token final caps were not changed by this task.

## Files affected by this task

- `src/lib/groq-quota.ts`: retry-time calculation, safe numeric admission details and accurate daily/request-size messages. Ledger schema and provider limits remain unchanged.
- New `src/lib/quota-admission.ts`: bounded cancellable wait/recheck loop.
- `src/lib/provider-transport.ts`: shared waiting, pacing/admission race handling and independent known-unsent cleanup.
- `src/lib/groq-transport.ts`: retain safe retry guidance and invalidate older cached transport implementation when the waiting revision loads. Restart/drain all workers before controlled acceptance to avoid mixed versions; preserve the ledger directory.
- New `src/lib/provider-deadline.ts`; `src/lib/agent-budget.ts`: explicit per-phase deadline propagation.
- `src/lib/knowledge-agent.ts`: planning/final deadline scopes and duplicate-only progress bound.
- `src/lib/agent-tools.ts`: exports existing canonical serialization for duplicate request identification; no authorization/schema changes.
- New `src/lib/rate-limit-guidance.ts`; `src/lib/chat-handler.ts`; `app/api/agent/route.ts`: additive safe retry fields/headers for both APIs.
- `src/lib/reliability.ts`: allowlisted admission stage/counters.
- New `tests/quota-admission.test.ts`; extended `tests/general-agent-stabilization.test.ts`: waiting, both-mode behavior and no-progress regressions.
- README/deployment notes and this new report/evidence directory.

No migration, data transfer, model/provider change, question handler, authentication change or citation-verification relaxation was introduced.

## Verification and actual results

| Check | Actual result |
| --- | --- |
| Standard `npm test` | 303 registered; 292 passed, 11 database-only skipped; zero failures |
| Full `npm run test:fresh-db` | All 303 passed; zero skipped/failures; disposable PostgreSQL cluster removed |
| Focused admission/API tests | 8 passed |
| General/clock/fault focused regressions | 46 passed, two database-only skipped |
| TypeScript | Passed |
| ESLint | Passed |
| `npm run build -- --webpack` | Passed |
| Repository security check / documentation links / whitespace | Passed |

Initial regressions exposed an asynchronous-dispatch change in no-quota test transports, mismatched fake-clock deadline domains and an overly broad duplicate-stop condition that counted SDK tool errors. These were corrected; final successful-tool-only stopping preserves error recovery. The verified full database suite covers the final implementation and clarified quota messages. The standard suite preceded the message-only clarification; final database/focused checks cover it afterward.

### RAG tests

Three sequential fictional PDF/DOCX questions used the real SDK and quota-aware transport with scripted provider replies. A seeded minute limit expired during a one-second virtual wait; no reservation was held while sleeping. Each response retained verified S citations. Missing evidence refused without generation. Both RAG and Agent error paths return local/provider origins and Retry-After without raw admission details.

### General Multi-Source tests

Existing and extended scripted SDK cases exercise document retrieval, CSV filtering/sorting/average, combined calculations, missing evidence, conflict refusal, schema completeness, malformed calls and duplicate loops. No deterministic question handler substitutes for the general planner tests. These are orchestration/citation checks, not real semantic-review scores.

### Real isolated PostgreSQL and local BGE

A new private PostgreSQL 18/pgvector cluster ran the actual authenticated route handlers in-process, using real local BGE and fictional stored chunks/CSV rows. Provider replies and quota/pacing time were scripted; no external model request was sent. This was not a browser or live Groq run.

| Route scenario | HTTP/result | Scripted model calls |
| --- | --- | ---: |
| Document RAG commitments | 200 / grounded, document citation | 1 |
| Agent record count | 200 / count=3, CSV citation | 3 |
| Agent filter/sort | 200 / response times 3 then 2.5, CSV citation | 3 |
| Agent SUM | 200 / sum=12.5, CSV citation | 3 |
| Agent combined comparison | 200 / original policy+CSV operands and differences, both sources | 4 |
| Agent missing evidence | 200 / grounded=false, no sources | 3 |

See [isolated results](isolated-results.json). Seventeen scripted model HTTP responses and four local embedding requests were used; actual live-provider calls and blocked external attempts were zero. The 81000 ms recorded wait is **virtual combined pacing/admission time across the run**, not real latency or one request's wait. Missing-session and CSRF checks returned 401/403. The original application database was not accessed by this integration, and its private cluster was removed. Existing full-suite ownership, lifecycle, SQL safety, cancellation and citation regressions remain enabled.

### Quota boundaries covered

Exact rolling token/request expiry; retained header allowance plus cooldown; immediate daily limits; request deadline refusal; cancellation; pending-settlement polling; concurrent atomic rechecks and refunds; correct known/unknown settlement; local versus provider 429; both API retry metadata; multi-worker file reservations and corrupt-state fail-closed behavior.

## Controlled live testing and remaining risks

Both modes are ready for **controlled, explicitly approved live testing of bounded short waits**, not an unrestricted-load or unlimited-questions claim. No live Groq call was made, no 25-case benchmark was repeated, and no historical evidence was relabelled.

Before testing, restart/drain workers onto the new transport revision, preserve the private persistent ledger, and verify each same-host worker shares that directory. Admission fairness is not guaranteed; contenders recheck and can lose a slot. The waiting cap is per process, while budget state is shared only across workers on the same host/path. Separate hosts/other apps can consume provider quota outside this coordination.

The current overall/step/browser deadlines still prevent waiting a fresh full minute and then reliably completing a general multi-call answer. Larger evidence/requests and daily exhaustion still produce accurate 429 responses. Unknown usage remains conservatively charged. A crashed lock still requires the existing fail-closed operator procedure; no automatic quota reset or unsafe lock stealing was added.

Original account records, credentials and historical results were preserved. No commit or push was performed. General live model correctness and human semantic review remain separate, unverified acceptance work.
