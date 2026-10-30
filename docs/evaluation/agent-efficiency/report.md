# General Multi-Source Agent efficiency investigation

Date: 30 October 2026. Read-only application investigation; no live Groq requests.

## Confirmed measurements

The persistent local ledger contains these admissions matching the reported Pakistan-time timestamps:

| Time (UTC+05:00) | Reserved tokens | Reported actual tokens | Pending |
|---|---:|---:|---|
| 14:54:50.680 | 2923 | 1074 | No |
| 14:54:55.737 | 3202 | 1214 | No |
| 14:55:00.775 | 4216 | 1115 | No |

Actual total is **3403**, rather than 3393: the ledger records 1214 for the middle call. Sum of initial reservations is 10341, with 6938 released by reconciliation. These are sequential reservations, not a simultaneous 10341-token charge. Reservations include possible output and conservative input estimation; they are not bills. Five-second spacing matches application 12-RPM pacing. No quota leak is demonstrated by these completed entries.

The ledger stores neither request IDs nor planning/tool stages. Request-linked server logs were not available in this session. Consequently the entries confirm timing and usage, but cannot independently prove which tools or query arguments this specific request used. No database contents were inspected or changed. A request ID and its retained `model-call`, `provider-usage` and tool logs would be needed for exact historical stage correlation.

## Code-confirmed workflow and likely sequence

`src/lib/knowledge-agent.ts` prepares owner-scoped dataset metadata using `preparePlanningCatalog`, then runs SDK multi-step planning followed by separate structured answer generation. For a straightforward grouping request the expected sequence is:

1. Planning call selects `queryDataset` with a validated COUNT/groupBy plan. Backend query execution itself makes no Groq call.
2. Planning continuation receives the query result and decides whether more tools are needed. A text-only stop ends planning; this text is not the final answer.
3. Final generation receives retained evidence and allowed quote references. Backend citation verification follows without another Groq call.

This sequence is reproduced by existing scripted general-agent tests (filtering and aggregation use three calls). It is the likely explanation for the observed three calls, **not a recovered trace of this particular question**. Failed calls, additional discovery or retries cannot be inferred solely from dashboard successes; there is no evidence of them in the three matching ledger entries.

## Necessity and safe opportunities

The first call is needed to interpret arbitrary questions into safe query plans. Schema preparation already removes model discovery/inspection calls for a complete small catalog. The third performs the existing structured, grounded answer generation. The second is a readiness decision: dispensable in hindsight for a complete single-query result, but generally needed for follow-up queries, correction of invalid plans, missing evidence, and policy-derived comparisons.

Stopping immediately after every successful query is unsafe: a successful query does not establish that every requested fact was collected. Moving all readiness decisions to final generation would require a bounded way to request further tools and avoid introducing new abstentions. Combining planning and structured answer generation would alter provider/SDK tool-output behavior and deserves separate compatibility testing. Neither is a justified small fix from this single observation.

Existing efficiencies remain in place:

- Bounded request-local schema preparation; no cross-user schema cache.
- Cached identical discovery, retrieval and validated queries within a request.
- Compact model-facing CSV evidence and references for previously seen sources; original evidence retained for verification.
- Planning output cap 1536; final output cap 3000.
- Two successful duplicate-only tool rounds stop planning; distinct work and tool-error recovery remain available.

No application change was made. No measured token-saving claim is made. The middle call's 1214 tokens indicate potential cost to investigate, not guaranteed savings: a redesigned final call could itself grow.

## Mode comparison

| Mode | Typical simple path | Cost caveat |
|---|---|---|
| Document RAG | Local BGE/PG retrieval, one generation call, local verification | No provider call if retrieval yields no usable evidence |
| General document-only Agent | Search planning, readiness planning, generation: three calls in scripted tests | More searches can add calls |
| General CSV-only Agent | Query planning, readiness planning, generation: three calls in scripted tests | Catalog omissions or multiple queries add calls |
| General combined Agent | Policy search planning, query planning, readiness planning, generation: four calls in scripted tests | Scope/conflict checks and follow-up tools can add calls |

These are observed scripted paths, not universal bounds or live accuracy results. Existing deterministic operations can use zero calls but are not evidence of general-agent efficiency. Token cost depends on schema, evidence, accumulated tool history and output, not just call count. The 8000 TPM budget is shared across calls and modes; pacing alone does not guarantee admission.

## Validation and regression requirements

Executed `node --conditions=react-server --import tsx --test --experimental-test-isolation=none tests/general-agent-stabilization.test.ts`: **5 passed, 0 failed**. Scripted SDK/provider responses only; no live AI quality claim. Tests cover six consecutive varied general questions, document/CSV citations, combined-source evidence, refusal, bounded schema catalogs, authorization-before-query inspection, output truncation, and duplicate-round control.

Before implementing a general call reduction, add tests for:

- Grouped COUNT with complete schema and correct CSV citations, alongside SUM/AVG/filter/sort and multiple distinct queries.
- A query that succeeds but provides only part of a multi-part answer; follow-up must remain possible.
- Document-first threshold extraction and subsequent validated CSV calculation, with both citations.
- Incomplete/truncated schemas or results, ambiguous policies, missing evidence and failed tool argument recovery.
- Arbitrary tool sequences, ownership isolation and unchanged strict citation verification.
- Admission waiting, cancellation, daily limits and actual-usage reconciliation after a reduced-call flow.
- Provider compatibility for any proposed combined tool/structured-answer protocol, followed by separately approved controlled live testing.

No original data, model configuration, quota ledger or historical evaluation artifacts were modified. No commit or push was performed.
