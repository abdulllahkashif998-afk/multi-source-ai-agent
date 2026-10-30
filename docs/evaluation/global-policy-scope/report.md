# Consistent global policy scope enforcement

30 October 2026. No live Groq calls. This report follows, and does not replace, the [P2 scope review](../p2-scope-review/report.md).

## Confirmed defect

Deterministic SLA comparisons previously checked applicability only in the ranked retrieval results. P1's top-three chunks omitted the policy header; P2/P3 included it. Consequently identical global restrictions caused priority-dependent behavior. The user confirmed that organization and incident-date applicability cannot be established from the CSV. A numerical comparison must not be presented as a verified operational compliance conclusion.

## Implementation

New `src/lib/policy-context.ts` loads the complete original chunks of a single active owned document by filename, independently of embeddings and ranking. The SQL is parameterized and filters user identity from the server scope and status=ready. It checks that exactly one active owned document has the name, orders chunks deterministically, uses a five-second query timeout, and bounds input at 100 chunks/256000 characters. Missing, duplicate, oversized or unavailable context fails closed. No schema or record changes are needed.

The agent session caches this context check only within the current request. Context document IDs must agree with the document version used for ranked evidence; mismatches refuse rather than mix versions. Complete original text is scanned for global scope restrictions and conflicting first-response thresholds, including rules outside the retrieved top-K chunks. Effective dates are not ordered or assumed applicable. Date-only and conflicting-date restrictions continue to cause abstention without incident-period evidence.

The complete context is used for backend applicability checks, not appended to the paid model's prompt or substituted for retrieved source quotes. Existing evidence text, source IDs, document IDs, chunk metadata, quote selection and citation verification are unchanged. The internal `completePolicy` search option is backend-only; it is not a model/client argument. Injected test/service implementations must honor its complete-context contract or throw.

Both execution paths enforce this check:

1. Deterministic SLA comparisons: retrieve the rule as before, then check the complete owned policy before comparing CSV rows.
2. General Agent: after planning and before generation, first-response/SLA document+CSV workflows check the complete context, even if the planner declared evidence complete. Unresolved applicability returns insufficient evidence without another provider call.

Reporting a documented rule without applying it to CSV rows remains permitted; Document RAG is unchanged. For uncertain operational applicability this change chooses abstention, not an unconditional numerical compliance statement or an invented conditional permission.

## Real existing-account verification

The authorized user 6 service was exercised using real local BGE and PostgreSQL. PostgreSQL default_transaction_read_only=on was verified and external HTTP was blocked. Final results:

| Query priority | Grounded | Returned sources | Groq calls |
|---|---|---|---:|
| P1 | No | None | 0 |
| P2 | No | None | 0 |
| P3 | No | None | 0 |

The independently verified P2 numerical candidates remain 5 hours against a stated 4-hour rule, but the agent does not return them as operationally established violations. The CSV still lacks organization/incident-date fields, and user clarification explicitly left those facts unverified. No uploaded records, users, files, credentials or quota ledger entries were changed. This was trusted server-identity verification, not a newly created browser login session.

## Regression and validation results

- Focused SLA/general-Agent suites: 31 registered, 30 passed, one database-only test skipped, zero failed.
- Full suite in a fresh disposable PostgreSQL cluster: **309 passed, zero failed/skipped**. All migrations applied; cluster removed.
- TypeScript and ESLint passed.
- Supported Webpack production build passed. A later document-version comparison guard was checked by final TypeScript and database tests.
- Repository security scan: no findings. Diff whitespace checks passed; Git index remains empty.

Regressions cover complete context hidden from ranked retrieval, P1/P2/P3 and named/unnamed question forms, past/future/conflicting effective dates without assumed incident dates, hidden conflicting rule values, unavailable context, actual owner filtering in PostgreSQL, strict equality boundaries, unscoped policies with document/CSV citations, and the general planner completion hint followed by a blocked applicability check. Scripted provider tests are orchestration checks, not live AI accuracy measurements.

## Files changed for this task

- `src/lib/policy-context.ts`: complete owner-scoped context loader.
- `src/lib/agent-tools.ts`: request-local applicability context, bounds, source-version checks and conflict detection.
- `src/lib/agent-sla.ts`: mandatory applicability gate before deterministic comparisons.
- `src/lib/knowledge-agent.ts`: production context-loader dispatch and pre-generation gate for general SLA workflows.
- `tests/agent-sla-reliability.test.ts`: priority-independent/global-context, date/conflict and ownership regressions.
- `tests/general-agent-stabilization.test.ts`: general-path applicability guard regression.
- This report. Pre-existing working-tree changes and historical evaluation evidence remain intact.

## Limitations

This is conservative rule-based applicability checking, not a legal interpretation engine or complete semantic entailment verifier. Explicit dates/organizational restrictions remain unresolved even if they might be satisfiable with additional evidence; no automatic date/department inference was introduced. Sentence-level separate-topic recognition remains bounded; unknown relationships can still refuse. Oversized policies refuse. Other policy documents with different filenames are not automatically enumerated to establish precedence for every arbitrary question. Existing multi-policy discovery ambiguity checks remain.

General Agent enforcement depends on collecting policy evidence and recognizing first-response/SLA content; this is not a universal policy-governance guarantee for every possible natural-language domain. No extra Groq calls or sustained load testing were performed. Request-long document lifecycle snapshot isolation is not implemented; a context/version mismatch fails closed at the check, while mutations after the check retain the application's existing concurrency limitations.

Both numerical calculations and valid original citations remain available for demonstrably unscoped fixtures. For the existing scoped policy, **consistent P1/P2/P3 abstention is now the verified correct behavior**. No live AI success or legal/organizational applicability is claimed. No commit or push.
