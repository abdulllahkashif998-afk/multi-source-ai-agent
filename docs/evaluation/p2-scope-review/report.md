# P2 policy scope relationship review

30 October 2026. Follow-up to [the original P2 abstention](../p2-sla-abstention/report.md). **A grounded P2 answer for the existing account remains unverified and is not claimed.** Earlier failures and reports are preserved.

## Exact context and relationships

Read-only inspection of all eight stored PDF chunks shows:

- Chunk 0 contains the document title, “Effective 1 October 2026”, and “This policy applies to the fictional Northstar Services internal operations only.” These precede section 1. They are global document metadata/applicability, not a limitation confined to an unrelated policy topic.
- Chunk 1 explicitly heads section 2 “First response commitments”, then states P1=1 hour, P2=4 hours and P3=12 hours, defines elapsed first-response hours, and explicitly treats equality as meeting the deadline.
- Sections 3, 4 and 5 separately describe escalation, resolution targets and customer updates. Restrictions whose explicit subject is one of those other operations do not automatically modify section 2.
- Section 6 excludes scheduled maintenance from response-SLA scoring only when an explicit maintenance flag is present. This is genuinely related to response-SLA evaluation, not disposable context.

The existing CSV schema has ticket_id, region, severity, response_hours, resolution_hours, status and scheduled_maintenance. It has no organization or incident-date field. The three P2 candidates NS-007, NS-018 and NS-029 are each at 5 hours and each explicitly has scheduled_maintenance=no. Thus their numeric comparison and maintenance status are established. Policy organizational/temporal applicability is not independently established by the CSV schema. Common ownership establishes access, not applicability. No dates, departments or policy precedence were assumed.

These findings supersede any suggestion that the extra retrieved chunk is necessarily irrelevant. Its presence explains the refusal; full context does not justify simply deleting that guard.

## Minimal general correction implemented

`hasAmbiguousSLAScope` now evaluates scope-triggering sentences separately. It ignores restrictions only when an explicit grammatical subject identifies a different operation: customer updates, resolution targets/deadlines/SLA, or audit reviews/requirements. A first-response/response-SLA or whole-policy reference in that same sentence disables the exclusion.

This is a bounded source-clause classifier, not a question handler or a general semantic parser. Unknown subjects, ambiguous pronouns, document-wide restrictions, effective dates, supersession, departmental conditions and first-response-related exceptions remain conservative. No effective-date ordering is inferred. No Northstar names, numbers or expected results appear in the implementation.

Original evidence is never stripped or rewritten. The change affects only which explicitly unrelated sentences trigger the guard; source text, chunk metadata, quote choices and citation verification remain intact. The unrelated-topic regression retains both source citations in its grounded result. Global scope remains blocking for the real P2 case.

## Real account verification

Trusted operator execution under the authorized existing user 6 identity used real PostgreSQL/pgvector and local BGE, with PostgreSQL default_transaction_read_only=on and external HTTP blocked. This is a service-level reproduction, not a new authenticated browser test.

Final results remain P1 grounded with document/CSV sources, P2 abstained, and P3 abstained. An independent validated, owner-scoped CSV query confirms the three P2 values and explicit maintenance=no flags. That independent query is not substituted for a grounded agent answer and supplies no fabricated citations. No existing records, files or quota ledger entries were changed. Zero external provider attempts occurred.

The remaining P1/P2 asymmetry comes from retrieval: P1's top-three chunks omit the global metadata chunk while P2/P3 include it. This change does not solve complete-document applicability discovery or certify the P1 answer's global applicability. A future generic approach should collect bounded document-level applicability evidence consistently across priorities rather than ignoring whichever chunks cause refusal.

## Verification

- Focused SLA suite: 22 registered, 21 passed, one database test skipped, zero failed.
- Full suite in a separate disposable PostgreSQL cluster: 307 passed, zero failed/skipped; existing application database not used for fixture writes.
- Added regressions cover explicitly unrelated topic restrictions, global organizational scope, conflicting effective dates, unclear references and mixed first-response wording. Existing P1/P2/P3 and equality/citation tests remain.
- TypeScript, ESLint, security scan and diff checks completed; no secret findings. No live Groq calls.

## Changed files

- `src/lib/agent-sla.ts`: sentence-level explicit-topic relationship check.
- `tests/agent-sla-reliability.test.ts`: scope relationship/date-conflict regressions.
- This report. No historical evidence changes, commits or pushes.

## Final status

The limited unrelated-topic defect is corrected. The existing P2 failure is **not** declared fixed: explicit organization and temporal applicability still need to be established, and full-document applicability retrieval remains incomplete. Returning the three numerical candidates as an unconditional policy-compliance answer would exceed the verified evidence. Current refusal is retained rather than weakening grounding to obtain a passing acceptance result.
