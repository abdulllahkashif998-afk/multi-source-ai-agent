# Test 17: P2 SLA abstention investigation

30 October 2026. **P2 remains blocked by scope validation; this is not a successful acceptance result.**

## Confirmed trace and reproduction

The latest matching development trace is `e2460faa-0f15-4ef6-8ba8-44e32df67224`, logger timestamp 01:00:00. It records `agent-abstention: ambiguous_rule`, a completed structured operation in 355.1 ms and an abstained agent outcome in 356.2 ms. There are no model calls. Logs omit question text, so exact association to Test 17 still requires its Network request ID.

A separate trusted-operator reproduction in the previously authorized user 6 identity used the existing production service, real PostgreSQL and local BGE. PostgreSQL `default_transaction_read_only=on` was verified and all external HTTP was blocked. Results:

| Priority | Production service outcome | Sources |
|---|---|---|
| P1 | Grounded | Document and CSV |
| P2 | Insufficient evidence | None |
| P3 | Insufficient evidence | None |

This was a backend identity-scoped reproduction, not a new authenticated browser test. No sessions, user records, source files or quota state were created or altered. Zero external provider attempts occurred.

## Exact abstention cause

The short intent parser recognizes all three questions. In `src/lib/agent-sla.ts`, `trySLAComparison` rejects the retrieved document set at its `docs.some(...hasAmbiguousSLAScope...)` check, before dataset schema inspection/filter execution. This is not a failure to parse P2 or extract its threshold.

Real filename-scoped retrieval returned:

| Priority | Ranked chunk indexes | Thresholds extracted | Scope guard |
|---|---|---|---|
| P1 | 3, 2, 1 | P1=1h, P2=4h, P3=12h from chunk 1 | Clear |
| P2 | 3, 1, 0 | Same thresholds from chunk 1 | Chunk 0 rejected |
| P3 | 1, 0, 2 | Same thresholds from chunk 1 | Chunk 0 rejected |

No unparsed first-response rule lines were found. The rejected chunk contains a declarative effective date (1 October 2026) and a statement limiting the policy to the organization's internal operations. The guard treats the words `effective` and `only` conservatively anywhere in retrieved text. Its inclusion depends on retrieval ranking, explaining the different behavior across priorities. The source selection remains owner- and filename-scoped; no foreign document caused the result.

## CSV verification

An independent, read-only query through the existing validated CSV service, scoped to user 6's uniquely named incident dataset, used severity=P2 and response_hours>4 with descending sorting. It returned NS-007, NS-018 and NS-029, each at 5 hours. This confirms the schema and data calculation, but it is **not** a grounded agent result and does not bypass the refusal or manufacture citations. The agent itself never reaches that CSV query because scope validation fails first.

## Application change decision

No application fix was applied. Blanket metadata matching is overconservative, but the retrieved organization-only clause is an actual scope restriction. The available trace does not establish that every scope restriction is irrelevant or prove source applicability. Dropping non-rule chunks or ignoring all `only`/`effective` clauses would hide genuine conditions and violate the requirement to retain conservative refusals.

A smallest *safe* follow-up needs a generic applicability representation: distinguish declarative effective dates from conditional/future policy versions, and establish organizational/department/period applicability from evidence rather than filenames or upload ownership. That distinction is not safely implemented by deleting two keywords or adding a Northstar exception. Existing ownership establishes access, not organizational policy applicability. No expanded scope engine was introduced in this investigation.

The problem is retrieval-sensitive conservative scope validation, not a generic priority-number parsing defect. A fully cited P2 answer has **not** been verified. Citation verification is not reached on the failing route.

## Regression tests

Added one parameterized regression in `tests/agent-sla-reliability.test.ts` using fictional thresholds 2.5, 4 and 9 hours. It verifies:

- P1/P2/P3 each use their own extracted policy threshold.
- Above-threshold rows are included and equal rows excluded.
- Every grounded result has both document and CSV sources.
- An additional department-only policy restriction still causes refusal before querying rows.

Focused run: 21 registered, 20 passed, one database-only test skipped, zero failures. Full disposable-PostgreSQL suite: 306 passed, zero failed/skipped; temporary cluster removed. TypeScript, ESLint and diff checks passed. Existing source evidence, earlier failed results and historical benchmarks are unchanged. No live Groq calls, commits or pushes.
