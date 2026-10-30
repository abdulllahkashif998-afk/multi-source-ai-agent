# Final live evaluation — preparation and approval

Prepared 28 October 2026. **The user approved only a three-case pilot; that pilot is now complete.** Real results are in [report.md](report.md), [results.json](results.json) and [the unfilled human review template](review-template.json). The full 25-case run remains unapproved and incomplete. No mock/scripted answer is presented as live output.

The unchanged original benchmark contains 25 cases: six document, six CSV, six combined, four insufficient-evidence and three conflict/ambiguity. Fixture hash: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`.

## Completed preflight

[preflight.json](preflight.json) records successful verification of all 25 fictional fixture sets. Existing BGE embeddings were generated locally; required labelled chunks exist in each scoped corpus; the independent oracle and real PostgreSQL structured queries agree with declared calculations. Dataset discovery returns only the three fictional datasets. Fixture tables are temporary, IDs explicit and changes rolled back; no existing user account, sequence, stored document or CSV record is updated. Groq calls: **zero**.

Existing configured provider/model: Groq / `openai/gpt-oss-20b`; existing pacing: 12 RPM. Configuration values and credentials are not changed. The live runner uses trusted operator fixture identity, not an authenticated browser replay; application session/CSRF/ownership protections remain unchanged and separately regression-tested.

## Original full-run proposal (not approved)

- Execute each original case once, serially; no failed-case retry.
- Upper bound **161 actual HTTP attempts**: eight RAG cases × one call, seventeen agent cases × up to eight planning calls plus one generation call.
- Rough planning estimate **150,000–500,000 aggregate tokens**, not measured usage. Per-model-call output remains capped at the existing 3,000 tokens. Actual provider usage is recorded where returned; missing usage is unknown, not zero.
- Evaluation guard checks a 500,000-token planning allowance between calls using actual totals where available and a conservative request-byte/output-cap estimate otherwise. This is not a provider tokenizer or exact billing guarantee.
- Keep existing application/model pacing and deadlines. Wait at least 65 seconds between cases. Existing provider quotas can still interrupt an agent case.
- Stop the batch on provider 401/403/429, operator cancellation or exhausted approval budget; remaining cases are not executed or marked complete.
- Alternative pilot: doc-01, csv-01 and combined-01, at most 19 calls and an 80,000-token planning allowance; estimate 20,000–80,000 tokens. A pilot is not the full benchmark.

Groq's [published rate-limit table](https://console.groq.com/docs/rate-limits) lists 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD for this model's free plan as checked during preparation. Actual organization limits and remaining quota may differ. The full run may need more than one quota window. No quota entitlement or price is inferred from the credential's presence.

The evaluation-only network guard throws on the first HTTP 429 so the existing transport's optional retry cannot issue another request. It allows only the configured Ollama embed/tags endpoints and Groq chat completions, records numeric usage/status/timing only, and leaves production transport/model settings untouched. Cases run in separate child processes through the existing answer-quality CLI, one case per invocation. Checkpoints under `.evaluation-results/final-live` prevent overwriting or automatic resubmission.

## Reporting and human review

After approved execution, retain each actual answer, safe failure, stage timings, citations, independent CSV checks and source/quote verification separately from the original offline reports. Record all 25 definitions, with unexecuted cases explicitly not run if execution stops early. Raw process diagnostics stay in ignored private output; only sanitized fictional results are published here.

Use the existing five-dimension rubric: factual correctness, completeness, groundedness, citation support and conflict handling. Automatic checks/AI-assisted notes do not become human decisions. Human-review templates remain unfinished until an actual person supplies ratings and claim-to-evidence notes bound to fixture/answer hashes. Answerable cases can therefore remain needs-review even after a technically successful response.

See [original answer-quality report](../answer-quality.md), [retrieval report](../retrieval-quality.md) and [test register](../../final-test-cases.md). No complete-live-benchmark claim is made at preparation time.

## Preparation regression results

- Standard suite: 224 registered; 216 passed, eight optional database skips, zero failures.
- New evaluation-only guard checks passed: one 429 native attempt even through the production retry-capable transport, stop-after-denial, exact attempt limit, token-estimate bound, endpoint allowlist and numeric-only usage capture.
- TypeScript and ESLint passed; whitespace check passed.
- Existing repository security scan passed with zero detected secret patterns.
- These are preparation checks, not live benchmark outcomes or human reviews. At preparation time all 25 cases were unexecuted. The subsequent approved pilot below supersedes that execution status only for its three cases.


## Approved pilot: actual outcome

Only doc-01, csv-01 and combined-01 were authorized, capped at 19 HTTP attempts and an 80,000-token planning allowance. All three executed once. Actual native HTTP attempts: **13** (1, 6, 6); reported tokens: **13,225** (12,515 prompt, 710 completion), with no unknown-usage attempts, provider failure, transport retry or quota/access denial. At least 65 seconds separated cases. No remaining-case or failed-case retry was run.

Automatic checks: **3 passed**. Final evaluator classifications: **0 pass, 0 fail, 3 needs-review; human-reviewed 0**. These are three executions of the unchanged 25 original cases, not a complete benchmark. The other 22 include all insufficient-evidence and conflict/ambiguity cases and need separate live authorization.

There is no confirmed application defect from this pilot. Correct numbers, existing sources and exact quotes support further semantic review but do not replace it. Response-bound blank human-review templates are supplied; no subjective review was attributed to a person. The 161-call/full-run proposal above is retained as history, not approval to execute it.
