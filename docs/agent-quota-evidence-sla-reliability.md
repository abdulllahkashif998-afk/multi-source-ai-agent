# Agent reliability: quota, evidence and SLA comparisons

Implemented 29 October 2026. No live Groq calls or existing user-data changes. Historical benchmark reports, human-review slots and screenshots are preserved; this is not a live answer-quality retest.

## Completed scope

| Phase | Implementation |
| --- | --- |
| Groq admission | Harmony token estimation, pending reservations, actual/unknown usage settlement; rolling RPM 30, TPM 8000, RPD 1000, TPD 200000 |
| Conservative pacing | Existing application 12 RPM default retained; exact dispatch spacing and an eight-caller cap covering admission, waiting, HTTP and settlement |
| Restarts/workers | Private file ledger with atomic replacement and exclusive-directory transactions, shared by same-host workers using the same directory/UID |
| Cross-source evidence | Recognized combined conclusions require both document and CSV citations in each statement; explicit named evidence must match filenames |
| Context | Stable deduplicated document-chunk IDs across searches; compact repeat results and source catalogs; full originals retained server-side |
| SLA operations | Policy-derived first-response thresholds, multiple priorities, validated raw-row filtering, strict/inclusive boundaries and deterministic differences |
| Safe diagnostics | Local/provider 429 origin, quota reason, logical model-call counts, HTTP-attempt counts, reported/unknown usage and coarse abstention categories |

## Quota enforcement and safety

The production `groqFetch` always attaches the quota coordinator; injectable transport factories remain usable for isolated tests. There is no public/API switch to bypass production admission. Document RAG and general Agent calls both use the same selected-provider transport. Gemini retains its existing limits/provider configuration; the shared transport accounting and cancellation fixes also apply.

Token reservations use the pinned local `gpt-tokenizer` Harmony encoding, the full wire JSON, framing allowance and requested output cap. They are conservative estimates, not Groq's exact server-side serialization or billing calculation. On response, reported total_tokens replaces the reservation; missing usage, errors and cancelled in-flight work retain conservative charges. Pending entries survive process restarts and remain charged while pending; after 90 seconds abandoned entries become unknown charged usage. A known unsent reservation can be released; if cancellation prevents ledger cleanup, it remains conservatively charged rather than being forgotten.

RPM/RPD count reserved and completed requests. TPM/TPD count reserved pending tokens and settled reported/unknown tokens. Time windows are rolling 60 seconds and 24 hours, which can be stricter than provider reset boundaries. Clock rollback cannot erase accrued usage. Provider remaining-request/token headers can reduce local allowance, never raise it; observed cooldowns persist. Cached tokens are not discounted locally, so the guard may be stricter than the provider.

Actual usage exceeding its estimate is charged in full and constrains future admission. It cannot retroactively prevent an underestimated completed request from exceeding a provider-side boundary. Missing historical consumption before initial deployment, other applications/keys, provider-side overhead, separate input/output limits or external organization usage can still cause provider 429. **Do not claim exact or global organization-wide quota enforcement.** The four budgets are enforced against this coordinator's known reservations/settlements.

Sources for implementation semantics: [Groq rate-limit documentation](https://console.groq.com/docs/rate-limits) describes organization-level limits, cached-token treatment and response headers; [tokenizer project](https://github.com/niieani/gpt-tokenizer) supports gpt-oss/Harmony, consistent with [OpenAI's tokenizer source](https://github.com/openai/gpt-oss/blob/main/gpt_oss/tokenizer.py). The numeric limits above are the project's supplied limits; no live quota probe was made.

### Deployment and persistence

`GROQ_QUOTA_DIRECTORY` defaults to `storage/groq-quota`. The optional setting is server-side; blank uses the default. Provision private writable storage owned by the runtime UID, mode 0700, and preserve it across restarts. The ledger contains only timestamps, counts, opaque reservation IDs and cooldowns, never API keys, users, questions, source text or tool values. Default storage is already Git-ignored.

Same-host workers must use the same directory and runtime UID. Separate hosts/ephemeral filesystems and unrelated applications are not coordinated. Application start pacing remains process-local; the ledger provides the shared four-budget admission boundary. No distributed filesystem, serverless persistence, high-availability or power-loss/fsync durability claim is made. No per-user fairness policy was added.

State writes use private temporary files and atomic rename. Corrupt state, nonprivate/symlink/public paths, lost initialized state or uncertain locks fail closed with a safe 503. An initialization marker detects a missing ledger file; deleting the entire directory can still reset local history, so operators must never discard/move/reset it merely to bypass a quota.

A crash during the short ledger transaction may strand its lock. The implementation intentionally does not steal an uncertain lock. Recovery requires stopping all associated workers, confirming no active owner, preserving the ledger and reviewing removal of only the stranded lock before restart. If all quota history is lost, reconcile account usage or wait conservatively for the relevant windows; do not assume a fresh full daily allowance. Initial rollout also cannot reconstruct already-consumed organization quota.

No database migration or user-record write is required.

## Evidence contract

The backend identifies explicit two-file usage and conservative policy/data comparison forms. Each answer statement in those recognized combined operations must cite both an eligible document source and a CSV result. When explicit filenames are supplied, filename boundaries must match actual cited evidence; a substring of another filename is insufficient. Missing support produces canonical grounded=false abstention and a safe reason, not an invented threshold or successful unsupported answer.

Valid source/quote verification still runs first. Unknown IDs, incorrect quote pairing and changed quotes remain rejected. Document-only and CSV-only request forms retain their respective citation behavior. For combined answers the generation instructions ask the model to consolidate rule and actuals into statements with both operands.

This is a conservative source-family contract, not a universal intent classifier or semantic proof. Classification can abstain on some otherwise useful formulations. An arbitrary false claim with authentic but irrelevant document/CSV quotes is not thereby proven true; typed deterministic operations additionally validate their operands and comparisons. General prompt-based reasoning remains nondeterministic.

## Context reduction

Request-local identical-query caching remains. Different searches returning the same document/chunk/text/metadata reuse one stable D source ID; changed text/metadata remains separate. Model-facing repeated results reference the earlier source ID instead of retransmitting evidence. CSV tool results send rows once; the server retains serialized text/plan for citation verification. Final prompts send source metadata plus exact quote choices, rather than duplicate raw evidence and quotes. RAG likewise keeps full evidence server-side while sending a compact catalog and quote choices.

No shared answer/evidence cache was introduced across requests or users. Ownership, document lifecycle filters and original citation metadata remain in the existing services. Compacting context reduces repetition; it does not guarantee every general workflow fits the 8000-TPM budget.

## Generic SLA operation and supported boundaries

Examples of supported forms, using arbitrary owned filenames and evidence-derived values:

- `Using service-rules.pdf and events.csv, list all P2 tickets whose response_hours is greater than the P2 first-response deadline of 1 hour. Include ticket IDs, actual hours, and citations from both files.` The deadline number in the question is **not authoritative**; the document supplies the actual threshold.
- `Using service-rules.pdf and events.csv, list late tickets against the first-response SLA. Include ticket IDs, actual hours, and citations from both files.` This discovers stored priorities and applies each recognized rule separately.

The operation supports P-number priority labels, `severity`/`priority`, `ticket_id`/`ticket`/`id`, and numeric `response_hours`, `first_response_hours`, `response_minutes` or `first_response_minutes`. Ambiguous aliases are rejected. Supported policy clauses explicitly bind a priority, first-response deadline and hours/minutes; resolution deadlines are not substituted. Cross-unit conversion, ambiguous/scoped policy conditions, unrecognized tables/prose and conflicting thresholds abstain. Extra filters/dates/lookup requests are not silently discarded by the grammar.

All reads go through existing discovery, schema inspection, owner validation and compiled parameterized read-only SQL. At most five priorities are compared within the existing tool budget. Each priority gets its own validated row filter; no SUM/GROUP BY replaces a requested ticket list. Equality is excluded for strict greater-than and included only for an explicitly inclusive request. Native matching units are preserved; differences use decimal arithmetic. Rows and threshold references are both cited. No matching rows can produce a supported negative result with both policy and empty-query evidence.

Results exceeding eight rendered entities, limits/truncation, missing identity/metric values or insufficient exact quote coverage abstain rather than claim a complete list. Regional-lead joins, priority names outside the supported grammar and arbitrary policy semantics remain general-agent work; no claim that NS-007 regional-lead reasoning is fixed is made.

## HTTP handling and diagnostics

Local queue/admission/cooldown failures are distinguished from actual provider 429 in safe server logs. Exhausted response headers prevent a pointless retry. Otherwise the existing maximum-one, deadline-aware 429 recovery is retained, honoring cooldown before reserving the next attempt. HTTP 400/403/5xx are not automatically retried. Rejected tool payloads remain diagnostic-only and are never executed or repaired by bypassing validation.

`model-call` counts logical SDK invocation starts, including ones denied locally. `provider-usage` separately counts dispatched HTTP attempts, including retries, and aggregates reported/unknown token usage under the request ID. A model-call count is not a claim that every invocation reached Groq. Logs omit all raw messages, request bodies, keys and source contents. Coarse abstention categories distinguish missing retrieved document/dataset evidence, ambiguity, unsupported schema, truncation, unquotable evidence, missing cross-source support and model abstention; they do not certify why an arbitrary model refused.

Two implementation regressions were caught during verification and corrected: asynchronous dispatch initially weakened exact start spacing under fake clocks, and a synchronously rejected dispatch after abort needed an immediate rejection observer. Existing spacing and stalled-step tests now remain part of the final checks. No failure was hidden by weakening citations or returning a fake answer.

## Changed implementation files

- New `src/lib/groq-quota.ts`, `groq-quota-store.ts`: token estimation, budget reservations/settlement and private shared-host state.
- Updated `src/lib/provider-transport.ts`, `groq-transport.ts`: production wiring, bounded admission/active accounting, usage settlement and safe cooldown handling.
- New `src/lib/provider-usage.ts`: safe counts and abstention categories; updated `reliability.ts` preserves safe quota origin/reason fields.
- New `src/lib/agent-evidence-contract.ts`, `agent-model-context.ts`, `agent-sla.ts`: source-family enforcement, compact context and deterministic SLA comparisons.
- Updated `src/lib/agent-tools.ts`, `knowledge-agent.ts`, `gemini.ts`, `agent-structured-operations.ts`: integrate guards, stable evidence IDs, counts and canonical abstention without changing API response schemas or model selection.
- New `tests/groq-quota.test.ts`, `tests/agent-sla-reliability.test.ts`; updated repeated-search expectation in `tests/agent-citation-diagnostics.test.ts` for stable deduplicated IDs.
- Pinned `gpt-tokenizer` in package/lockfile; documented the optional private ledger path in `.env.example` and current setup/deployment guides. Actual `.env.local` and credentials were not changed.

## Actual validation

Verified on 2026-10-29:

| Check | Actual result |
| --- | --- |
| `npm test` | 277 registered; 266 passed, 11 database-only tests skipped, zero failures |
| `npm run test:fresh-db` | All 277 passed, zero skipped; temporary cluster removed; nonempty rerun refused |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build -- --webpack` | Passed |
| `npm run security:check` | Passed: 280 files and 320 history blobs scanned, no findings |
| `git diff --check` | Passed |
| Documentation links | Five updated guides checked; no missing local link targets |
| Historical evidence | All 41 baseline files unchanged |
| Git safety | Empty staging area; `.env.local` is not tracked |

The standard suite and disposable-database suite each completed with exit code zero. The security scanner required subprocess permissions to read Git metadata; its permitted rerun completed successfully. All provider tests use stubs/fake clocks. The generic SLA database integration uses original rollback-only fictional TEMP fixtures with changed local schema/data and cross-user checks. The full database runner creates/removes its own private cluster, not existing application records. No live Groq or Northstar acceptance run was made.

## Remaining verification

Real Groq response quality and the actual uploaded Northstar policy's compatibility are unverified. Approved authenticated acceptance should cover the generic SLA question with the real document extraction/schema, both source citations, multiple priorities and equality, while checking that recognized operations issue zero Groq calls. Any general-agent/provider acceptance requires separate explicit approval and account-quota review.

The previous 25-case benchmark, later retest failures, blank human annotations and earlier screenshots remain historical evidence, not relabelled results. These improvements do not establish a new human-reviewed accuracy score or unconditional production readiness. No commit or push was performed.

## Subsequent SLA failure correction

The original Northstar acceptance gap led to a separately traced local TPM rejection that was incorrectly returned as HTTP 502. See the [follow-up diagnosis and acceptance report](evaluation/sla-application-fix/report.md) for the bounded question/policy parsing and error-normalization fixes, all 280 database tests passing, and real authenticated browser acceptance with fictional evidence. The first fixture abstention is preserved separately from its passing retest. No live Groq retest or existing-user data acceptance is claimed.
