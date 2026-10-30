# General row-level policy applicability evaluation

30 October 2026. Follow-up to [the confirmed early refusal](../lab-applicability-abstention/report.md). Original fixture files, user records and historical evaluation results are preserved.

## Implementation

A bounded, deterministic evaluator now sits between complete-policy retrieval and qualified count rendering. It reuses owner-scoped document context, evidence preparation, structured CSV query compilation, repeatable-read transactions and the existing citation verifier. It does not ask an LLM to invent predicates or calculate counts.

The policy must explicitly bind a companion CSV and supply supported declarations. Column names, organization values, UTC timestamps, category labels, notice thresholds and metric deadlines are captured from that evidence. No Northstar name, field name, category value or expected answer appears in the implementation.

### Supported declarations

The controlled grammar supports these forms, with placeholders representing evidence values:

```text
This policy governs the companion dataset <filename.csv> only when the row
satisfies BOTH conditions: <organization_column> equals <organization> exactly;
and <date_column> is <on or after|after> <UTC start>
and <before|on or before> <UTC end>.

<response_column> measures elapsed time from receipt to the first human response.
<resolution_column> measures elapsed time from receipt to resolution.
<Category> first-response deadline is <number> hours.
<Category> resolution deadline is <number> hours.

Group confirmed violations by <category_column> only after scope and
metric-specific exclusions have been applied.
The supplied CSV has unique <identifier_column> values; each row represents one incident.

For an in-scope row, exclude it from FIRST-RESPONSE SLA scoring only if
<flag_column> is <yes|true> AND <notice_column> is a known nonnegative
number at least <number>.
```

Supporting text must explicitly state `Exactly <notice threshold> hours qualifies.` to establish notice units, and establish elapsed wall-clock hours, strict greater-than lateness, equality as on time, and no maintenance exemption for resolution. Contradictory start/end descriptions or notice thresholds reject the contract. Recognized explanatory clauses and explicitly separate update/audit topics do not overwrite SLA predicates. The existing scope guard is also applied to unconsumed text. Additional conditional, regional, effective-date, unsupported-unit, supersession or override language outside the supported declarations fails closed. This is not an arbitrary English policy interpretation engine.

Policy layout whitespace is normalized for extraction; citation text remains the original stored chunks. Overlapping chunks are reassembled with provenance mapping, and each operative predicate must fit available citation bounds. UTC values require a valid full `...T...Z` timestamp, optionally with milliseconds; no local timezone, current date, upload date or missing value is inferred. Text equality is case-sensitive. Policy-defined true/false flags require Boolean columns; yes/no flags require text columns. Numeric fields must be numeric. Identifiers may be unique text or safe integers.

## Row classifications

Scope is a three-valued AND of organization equality and the explicit interval:

- **Applicable:** both predicates are known true.
- **Not applicable:** at least one predicate is known false, even if another is unknown.
- **Unknown applicability:** no predicate is known false, but at least one is missing/invalid.

Applicable records then receive metric-specific outcomes: late, on time, maintenance-excluded (response only), or unknown. Missing/unsupported category, measurement, flag or required notice does not become zero or a guessed default. If no applicable records can be established, or all in-scope metric outcomes are unresolved, the count renderer refuses instead of presenting a misleading zero. Known eligible maintenance can exclude response scoring even when that measurement is missing; it never exempts resolution. Unsupported category values remain unresolved metric outcomes rather than being mapped to another priority.

Duplicate identities, missing/type-incompatible columns, inconsistent snapshot row counts, unavailable data and truncated/oversized inputs are refused. The current bound is fewer than 100 records and at most 24000 serialized input characters. A fully read snapshot must match its own dataset row_count metadata.

## Coherent queries and source evidence

`queryDatasetSnapshot` shares the existing query compiler and owner/ready checks. Metadata and rows are obtained in the same REPEATABLE READ READ ONLY transaction with the existing five-second statement timeout. Existing queryDataset returns exactly its prior row-array format and retains the original SELECT-columns path; snapshot metadata is an internal addition, not a new public API or migration.

Derived CSV evidence includes the real filename/dataset identity, original validated input plan, complete bounded input rows, their canonical SHA-256, row classifications, policy identity/contract and summary rows. It is explicitly tagged `policy_applicability_counts`; it is not represented as an AI-invented SQL result. Input rows and the derivation are available in the API evidence for auditing, while the existing UI displays summary rows/citations and does not add a provenance viewer in this task.

Policy evidence retains original IDs, chunk indexes, available page metadata and exact text. Context-only sources have no invented cosine score. Qualified statements pass through the unchanged `validateGroundedAnswer` and combined document/CSV citation checks. Each statement contains both source families and respects the three-reference limit; unsupported source-span sizes are refused.

## Agent integration and qualified output

Evidence preparation attempts the evaluator only for an explicitly selected owned policy and its uniquely requested companion dataset. Ambiguous/truncated discovery, multiple named datasets and unsupported sources retain conservative behavior. Other active policies explicitly associated with that same dataset block evaluation; no implicit precedence is selected. This currently refuses even duplicate associated policy versions rather than attempting version arbitration.

After successful evaluation, the planner is offered a small `policyCounts` action for first-response or resolution count summaries. It selects the action; it cannot submit replacement totals or an unconditional-count flag. The backend renders:

1. Exact organization/date qualification.
2. Metric-specific maintenance treatment.
3. Counts and deadlines for each supported category.
4. Confirmed total, unknown applicability, unresolved in-scope outcomes and outside-scope count.

When unresolved records remain, the renderer explicitly says the total is qualified, not unconditional. Even with no unknowns the result stays scoped to the declared policy. Ordinary free-text finalization cannot bypass this certificate/rendering path after an evaluation has been prepared. Unsupported requests that need another answer shape remain refused rather than accepting arbitrary compliance prose. This task does not implement free-form row listings, arbitrary additional question filters, multi-dataset policy joins or arbitrary policy DSLs.

Other unscoped RAG/CSV workflows, existing model schemas, authentication, CSRF, SQL safety, ownership and quota budgets remain. No retries, provider/model changes or quota exceptions were introduced. Provider tool-use failure and genuine quota exhaustion can still occur during action selection.

## Real existing-account verification

See [real-account-offline-verification.json](real-account-offline-verification.json). The authorized existing user 6 corpus was read using local PostgreSQL and BGE, with default_transaction_read_only=on and external HTTP blocked. One **scripted** model action selected policyCounts; there were **zero live provider attempts**.

The exact lab question returned grounded=true, passed the existing citation verifier, and included:

- P1: **2** confirmed first-response violations among 6 applicable records.
- P2: **2** among 6 applicable records.
- P3: **3** among 8 applicable records, with 1 unresolved in-scope response outcome.
- Confirmed total **7**, alongside **2 unknown-applicability records**, **1 unresolved in-scope outcome**, and **3 outside-scope records**.
- Original lab PDF citations and derived CSV evidence; every returned quote was verified against retained source text.

The source rule/qualification spans were extracted from the existing twelve stored chunks, not copied from expected answers into application logic. The snapshot and independent fixture expectations agree. Resolution regressions independently verify **14** late resolutions under the policy's distinct rules.

This is real-data/backend/citation verification with a mocked operation selector. It is **not live Groq, authenticated browser acceptance, human semantic review or a real-provider accuracy score**. The implementation is ready for a separately approved controlled live test; actual model action choice and provider behavior remain unverified.

## Tests and actual results

- Final complete suite in a fresh disposable PostgreSQL cluster: **331 passed, zero failed/skipped**; temporary cluster removed.
- Focused evaluator suite: **10 passed, one database-only test skipped, zero failed**.
- TypeScript, ESLint, supported Webpack production build, repository security scan and diff checks: passed; no secret findings. TypeScript was run sequentially after build to avoid generated-type file races.

Coverage includes the original lab's independently defined expected sets, renamed organization/date/category/ID/measurement/maintenance columns, different organization/date/label/notice values, Boolean flags and numeric IDs, inclusive/exclusive date boundaries, invalid dates, missing values, strict equality, maintenance eligibility/unknowns, unknown priorities, duplicate IDs, missing columns, incomplete snapshots, conflicting thresholds/effective dates/associated policies, coherent PostgreSQL snapshots, tenant isolation, original citations, provenance and one-action agent integration. Existing provider-400/quota/authentication/lifecycle regressions remain in the full suite.

Initial development runs failed on overly broad residual-text matching and legacy tests that intercepted the old metadata SELECT. Those failures were corrected by tightening the parser's recognized clauses and preserving the old query path. No tests were disabled; the final full suite passed. An initial parallel TypeScript/build invocation encountered disappearing generated types; the final sequential check passed.

## Exact files changed

- New `src/lib/policy-predicates.ts`: typed contract extraction and original-chunk provenance.
- New `src/lib/policy-record-evaluation.ts`: typed scope/metric classification.
- New `src/lib/policy-count-answer.ts`: qualified deterministic statements.
- `src/lib/generic-csv.ts`: internal coherent snapshot helper, unchanged public row results.
- `src/lib/agent-tools.ts`: evaluation certificate, derived evidence, protected rendering.
- `src/lib/agent-evidence-preparation.ts`: evaluate supported predicates before rejecting applicability.
- `src/lib/agent-evidence-contract.ts`: shared exact filename-boundary matching.
- `src/lib/agent-tool-inputs.ts`: strict policyCounts selector schema.
- `src/lib/knowledge-agent.ts`: snapshot service and bounded action integration.
- New `tests/policy-applicability.test.ts`: regression and isolated-database verification.
- `tests/agent-evidence-preparation.test.ts`: update the safety-test comment to describe unavailable coherent snapshots; assertions remain unchanged.
- This report and saved real-account offline verification.

## Remaining limitations

Controlled English templates, single explicitly selected policy/dataset, native hours, bounded complete snapshots and count-summary output are supported. Unknown wording, ambiguous source selection, non-UTC date formats, absent columns, unsupported units and associated competing policy versions refuse. This is an explicit predicate evaluator, not a universal natural-language policy interpreter or independent verification that uploaded organizational facts are true.

The model still selects the appropriate action/metric for the user's intent; arbitrary semantic intent correctness is not proven by backend arithmetic. Extra user filters or unsupported answer shapes must not be treated as supported count summaries. No live test has verified that selection yet. Cross-source policy and CSV reads do not share a single database transaction; each retains source identity/snapshot provenance, but policy changes after context retrieval retain existing in-flight lifecycle limitations.

There were no migrations, original user-data writes, credential/model changes, live Groq calls, historical artifact rewrites, commits or pushes.
