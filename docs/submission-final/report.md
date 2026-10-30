# Final submission review — 30 October 2026

## Scope and outcome

This finalization preserves the existing implementation, original benchmark, historical screenshots and database records. No live AI calls, quota resets, migrations, commits or pushes were made. The only application change in this finalization is opening document citation panels by default. It does not change evidence or verification.

The application is suitable for controlled submission with the limitations below. It is not certified for unrestricted public production. Live availability remains subject to provider and local quota admission; Test 20 is not recorded as passed.

## Latest HTTP 429 evidence

Local trace `3a93259a-3c40-4100-8961-d7ba9cc56e52` completed two native Groq HTTP 200 calls before planning call 3 was rejected locally with HTTP 429, reason `tpd`. The first two reservations were 4,191 and 4,763 tokens; reported usage was 2,244 and 2,620, respectively. Completed reservations therefore reconciled from 8,954 to 4,864 tokens, releasing 4,090. The read-only ledger snapshot contained 118 entries and zero pending reservations. No accounting leak was established.

At rejection the next reservation was 5,340 tokens, rolling minute charge 4,864, rolling daily charge 197,179, and retained provider-header allowance 2,333. Only 2,821 daily tokens remained; adding the reservation would exceed 200,000. Minute capacity was also insufficient. Safe retry guidance was approximately 628 seconds at that trace. The limiter uses rolling windows and retained provider constraints, not a midnight reset. Waiting 60 seconds does not necessarily clear daily quota or make a multi-call question fit. Successful provider calls do not guarantee that a later call can be admitted within the application deadline.

A separate trace `3c5ca9b7-0ae6-4aba-9ae3-1c457bfa3800` rejected an initial reservation locally for TPM: requested 4,191, minute charge 4,489, day charge 192,315, provider-header allowance 2,061, retry guidance 33 seconds. Neither observation proves a provider HTTP 429. No quota code change was justified. The exact latest Test 20 request ID was not supplied, so these traces must not be represented as conclusively identifying that test.

## Citation display

The actual component rendered document quotes, but its native details panel was initially collapsed. Local native Chrome checks confirmed that the quote existed and became visible on expansion. The minimal change opens document panels initially while preserving collapse, safe text rendering, original excerpts and strict server verification. This establishes the initial-visibility issue; it does not establish why any excerpt might remain blank after expansion in a particular account.

[Desktop evidence](citation-desktop.png), [mobile evidence](citation-mobile.png), and [machine-readable observations](citation-visibility.json) use fictional evidence with the actual component and project CSS. These are isolated component browser checks, not a fresh authenticated end-to-end test. The existing authenticated browser test now asserts initial visibility and collapse/expand behavior; the full Playwright suite was not rerun because its external dependency is unavailable locally.

## Validation

Final checks: standard suite **320 passed, 12 optional database skips, zero failures (332 total)**; focused subprocess/quota suite **19/19 passed**; standalone `npx tsc --noEmit` passed; `npm run lint` passed; `npx next build --webpack` passed. Final repository security scan reported zero findings across 359 scanned files and 415 history blobs. Local documentation checks found zero missing paths among 311 links; Git diff whitespace checks passed. [Machine-readable validation](validation.json) records the evidence scope. No new full authenticated browser run was made. Previously saved full database-enabled verification passed **331/331**, zero skips/failures, including row-level applicability and isolated fresh-database tests. It used fictional fixtures and removed its temporary cluster. That successful database run was not repeated for a display-only change.

The initial standard run had 318 passed, two subprocess-output failures and 12 optional database skips in the sandbox. Both affected tests passed with subprocess permissions; the final full-suite result supersedes that environment-limited run. No mocked response is represented as live Groq success.

## Acceptance and evaluation evidence

- Original 25 live benchmark cases remain unchanged: 22 automatic passes and three automatic failures; formal outcomes four pass, three fail, 18 needing review. Human semantic review remains pending. See [evaluation summary](../evaluation-summary.md).
- Subsequent retests, deterministic verification and authenticated browser acceptance remain separate historical evidence streams.
- The owner reports later live combined Tests 16–19 passed, with a retry for Test 18. This is user-reported manual verification, not a new execution by this finalization.
- The owner reports Test 20 blocked by HTTP 429 after retries. No success is claimed.
- The row-level evaluator's local PostgreSQL/BGE verification and qualified-result behavior are documented in [its report](../evaluation/row-policy-applicability/report.md). Controlled policy grammar, typed row comparisons, unknown applicability and maintenance evidence remain enforced.

## Original requirement coverage

The original assignment document is not separately identifiable in the repository. This review maps the requirements supplied in this project conversation to implemented deliverables; it is not a claim of independent rubric approval.

| Requirement | Implementation and evidence |
|---|---|
| PDF/DOCX ingestion and lifecycle | Existing parsing, BGE chunks, owner-scoped upload/list, duplicate hash, explicit version replacement, deletion and cleanup; [API](../api.md), [database](../database.md) |
| Generic CSV intelligence | Upload/inference/discovery, validated filtering/sorting/COUNT/SUM/AVG/GROUP BY, atomic replace/delete and identical-content refusal; [API](../api.md), [test cases](../final-test-cases.md) |
| Retrieval and grounded answering | BGE/pgvector + FTS/RRF, Document RAG, bounded multi-source tools, original source metadata and strict references; [architecture](../architecture.md) |
| Authentication and isolation | Server sessions, HTTP-only cookies, CSRF and owner checks before evidence; [security/setup review](../day-10-fresh-setup-security-review.md) |
| Frontend | Auth, protected dashboard, document/dataset management, two chat modes and safe citation rendering; [test cases](../final-test-cases.md) |
| Evaluation | All 25 original live cases executed and preserved; retrieval/performance reports, retests and review templates; [evaluation summary](../evaluation-summary.md). Independent human semantic review is incomplete. |
| Reproducible setup and handover | Ordered migrations, environment example, local instructions, demo guide and handover; [README](../../README.md), [handover](../project-handover.md) |
| Reliability/security | Deadlines, cancellation, bounded tool execution, safe logs, same-host quota ledger and security checks; [deployment](../deployment.md) |

Web crawling is not implemented and was not a requirement. No optional feature was added to close this review.

## Remaining limitations and delivery risks

**Blocking live-demonstration risk:** available token budgets may prevent further general-agent questions. Do not bypass admission or promise Test 20 success. Wait for genuine budget recovery or submit with this disclosed limitation.

**Repository delivery prerequisite:** required source, tests and documentation remain uncommitted, including untracked files. Review the complete pending-file manifest, select explicit files, rescan the staged snapshot, and obtain approval before committing or pushing. No files are staged by this task.

**Noncritical to controlled submission, material to broader use:** general model tool-use HTTP 400 failures remain possible; prompt guardrails are not deterministic semantic verification; human-reviewed benchmark accuracy is pending; quota coordination is same-host only; unknown usage is charged conservatively. The controlled row-policy evaluator supports bounded snapshots (99 rows, 24,000 serialized characters), five groups, native-hour thresholds and qualified count summaries, not arbitrary policy interpretation or multi-policy arbitration. Unsupported or ambiguous conditions must still refuse. An authenticated retest of citation presentation remains useful; no live AI call was authorized here.

## Files and Git review

[Pending Git changes](pending-git-changes.txt) lists the whole inherited working tree, not just this finalization. This finalization changes `app/components/chat-citations.tsx`, its new SSR regression, the existing browser assertion, and current delivery documentation/evidence. Earlier backend reliability/applicability changes remain preserved. Branch is `main`; origin is the configured project GitHub repository. The staged index is empty. No commit, push, database write or environment/model change occurred.

### Exact files changed or created during this finalization

- `app/components/chat-citations.tsx`
- `tests/chat-citations.test.ts` (new)
- `tests/browser/ai-chat-ui.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/evaluation-summary.md`
- `docs/final-project-report.md`
- `docs/final-test-cases.md`
- `docs/project-handover.md`
- `docs/documentation-validation.md`
- `docs/submission-final/report.md` (new)
- `docs/submission-final/validation.json` (new)
- `docs/submission-final/documentation-check.json` (new)
- `docs/submission-final/citation-visibility.json` (new)
- `docs/submission-final/citation-desktop.png` (new)
- `docs/submission-final/citation-mobile.png` (new)
- `docs/submission-final/pending-git-changes.txt` (new)

Runtime uploads, local environment files, quota ledger, dependencies and build outputs remain ignored. The security scan did not identify credentials; this is not proof that every historical artifact has received independent privacy review. Review the explicit manifest and staged diff before an approved commit. No blanket staging command was executed.
