# Consecutive SLA questions: routing and count correction

## Findings

Question 1 already matched deterministic SLA routing. Question 2, `How many tickets missed first-response SLA across all priorities?`, did not. It fell through to general multi-call planning, which reserves input/context and output tokens for each provider invocation.

Recent server requests `d98486fc-d607-4903-adc4-e5dd629a9d54` and `3365f3d9-1ae0-4eb6-98e0-4bbbdbbe2345` show local TPM rejection during planning, classified as `rateLimitOrigin=local`, `quotaReason=tpm`, HTTP 429, after approximately 6.5 and 5.7 seconds respectively. The user did not supply the request IDs for the exact two-question sequence, and private questions are not logged. Those IDs therefore demonstrate recent local rejection behavior, not definitive correlation with the supplied question pair. No provider-429 cause was confirmed.

A read-only ledger snapshot had zero pending entries, zero unknown-usage entries, no lock directory, zero currently charged/reserved minute tokens and 33078 rolling-day tokens. This later snapshot does not establish balances at an earlier rejection. No reservation leak or accounting defect was found. Limits remain RPM 30 / RPD 1000 / TPM 8000 / TPD 200000, with 12-RPM pacing, for the configured 120b provider. No limiter, reservation, retry or transport implementation changed.

The confirmed avoidable defect was unsupported routing for a straightforward operation that can be calculated with existing validated tools. It is not evidence that question 1 caused question 2 to fail. The corrected real-data sequence leaves the persistent ledger byte-for-byte unchanged.

## Focused implementation

Only `src/lib/agent-sla.ts` and `tests/agent-sla-reliability.test.ts` changed in application/tests for this follow-up. README indexes this report; this new directory contains separate evidence. Historical artifacts were not relabelled.

The count operation reuses existing unambiguous owned-policy/dataset discovery. It then:

1. Inspects the selected dataset and obtains a validated grouped count by priority. An observed priority anchors the existing focused policy retrieval; no priority or deadline is invented.
2. Extracts each applicable priority's documented first-response deadline and preserves all existing ambiguity/scope checks.
3. Executes a validated COUNT grouped by severity/priority and response time, bounded at 100 buckets. This retains exact bucket frequencies, rather than counting a limited sample of raw tickets.
4. Deterministically sums bucket counts only where response time is **strictly greater than** that priority's deadline. Equality remains on time. Known policy priorities absent from the data get zero counts; missing rules for observed priorities abstain.
5. Returns per-priority counts and their total with original document and CSV references. Every operand must fit verified excerpts and existing citation limits. Truncation, invalid buckets, unsafe numeric totals, unresolved rules or unavailable evidence abstain.

No arbitrary SQL, new model calls, changed models, new tables, reset ledger or weakened authorization/citation checks were introduced. Multiple policies/datasets still abstain. The maximum-five-priority and existing tool/request bounds remain active.

### Additional finding during verification

The first all-priority real-account attempt retrieved a cover-page chunk with effective-date language and conservatively abstained. That was a separate evidence-selection issue, not a quota error. Instead of disabling its guard, the final implementation obtains a priority from validated CSV discovery and uses it to anchor the same focused retrieval already used by the successful P1 operation. Every represented priority is still checked afterward; missing/conflicting thresholds refuse. The scope guard was not changed.

## Actual verification

### Isolated authenticated API, PostgreSQL and local BGE

A separate private PostgreSQL 18/pgvector cluster, fictional document/CSV fixtures, real BGE retrieval and the actual authenticated POST /api/agent handler were used. No API response was mocked. The fixture policy used different thresholds and data from Northstar.

Both questions returned **200 / grounded=true** immediately in sequence, followed by another successful immediate count request. The fictional expected count was **2** (P1=1, P2=1, P3=0), excluding the equality row. Both citation types passed original quote checks. Foreign-user evidence was withheld, missing session returned 401 and missing CSRF returned 403. Four embedding calls included fixture embedding and request retrievals; external AI requests were zero. No quota ledger was created in the isolated quota directory, proving zero reservations for this sequence. Only this test cluster was removed.

See [final isolated API evidence](isolated-api-results.json). [Initial isolated evidence](isolated-api-initial.json) is retained separately from the final priority-discovery adjustment.

### Existing real-account backend sequence

The confirmed owner identity was used with existing uploaded data, database-enforced read-only mode and blocked external HTTP. See [real-account results](real-account-results.json).

| Question | Verified answer | Service duration |
| --- | --- | ---: |
| Which P1 incidents exceeded the policy first-response deadline? | NS-003, NS-014, NS-025; 1.5 hours versus 1-hour deadline, 0.5-hour excess; both source types | 233 ms |
| How many tickets missed first-response SLA across all priorities? | P1=3, P2=3, P3=3; total=9; policy deadlines 1, 4 and 12 hours; both source types | 172 ms |

Two local embedding calls, zero external provider calls. Before/after hashes and counts of users/documents/chunks/datasets/rows matched; persistent quota-ledger bytes matched. These are single diagnostic timings, not performance distributions. This service execution does not replay the user's browser session cookie. A fresh real-account browser sequence is still a manual acceptance step; authenticated HTTP was independently verified with isolated fixtures.

### Automated checks

| Check | Final result |
| --- | --- |
| Standard suite | 288 registered; 277 passed, 11 database-only skipped; zero failures |
| Database-enabled suite | All 288 passed; zero skipped/failures; disposable cluster removed |
| TypeScript | Passed |
| ESLint | Passed |
| Webpack production build | Passed |
| Security scanner | Passed; no findings |
| Documentation links / Git diff whitespace | Passed |

New regressions cover immediate Q1→Q2, rapid independent counts, all-priority results, large aggregate counts, empty datasets, equality, conflicting/missing rules, malformed/truncated evidence and real SQL counts. Existing quota fake-clock/mocked-provider tests cover RPM/TPM/RPD/TPD, known/unknown reconciliation, concurrent reservations, cancellation and local/provider-429 classification. Existing ownership and citation tests remain enabled. No live Groq requests or 25-case benchmark reruns occurred.

## Remaining limits and manual acceptance

- Submit the two questions consecutively while signed into the confirmed owning account. Expect the P1 list and then total 9 / 3 per priority, each with PDF and CSV citations. Both recognized operations need no Groq calls.
- General questions outside supported deterministic grammars can still legitimately encounter local or provider quotas. This change does not enlarge limits or guarantee arbitrary model planning fits a minute's token allowance.
- Local admission becomes available only when sufficient charged token/request entries leave their rolling windows, pending work settles, and remote constraints/cooldowns expire. Daily limits use a rolling 24-hour window. Each new request must also fit its estimated reservation. Never delete/reset the ledger to retry.
- Coordination remains same-host, not global across other hosts/apps using the organization. Historical provider quota availability and exact failed-question request correlation remain unknown.
- More than 100 grouped buckets, more than five priorities, insufficient full citation excerpts or unsupported policy formats refuse conservatively. No universal semantic policy-verification claim is made.
- No existing data, credentials, security controls or historical evaluation artifacts changed. No commit or push occurred. Final browser acceptance and review of the full pending working tree remain before GitHub delivery.
