# Optional Ollama Qwen integration — 2 November 2026

## Result

**Protocol-compatible, but full local acceptance FAILED on this CPU setup. Not ready to replace the verified Groq workflow.** The optional adapter is explicitly selected and experimental. It was not enabled in the private application environment. No timeout increase, relaxed citation check, provider fallback or quota bypass was used to obtain a pass. No further local optimization cycle was started.

## Real local probes (not mocks)

Local Ollama 0.40.4 reports `qwen3.5:4b`, 4.2B parameters, Q4_K_M, CPU-only (`size_vram=0`). Runtime context before testing was 4,096 tokens; advertised model maximum was 262,144. Per-request local adapter context defaults to 16,384 without changing installed model files or BGE configuration.

| Probe | Actual result | Time |
|---|---|---:|
| Initial compatibility function call | Timed out before a response | 30-second request limit |
| Native JSON schema, thinking disabled | Returned `{count:3}` for fictional data | 4.826 s model-reported total |
| Native function call, thinking disabled | Valid `countItems({box:blue})`; no tool was executed | 28.717 s wall / 28.684 s model-reported |
| Warm compatibility function call | Valid function-call envelope and JSON arguments | 7.704 s wall |

These small probes verify JSON/function envelope compatibility only, not real document reasoning or answer quality. Warm caching affects timings. No comparable live Groq call was made, so these are not a fair provider speed/accuracy benchmark.

## Real application-component acceptance

[Saved results](results.json) come from `evaluation/ollama-local-acceptance.ts` using the actual local model and existing RAG/agent orchestration, with injected fictional document/CSV services. They are **not real PostgreSQL retrieval, PDF ingestion or authenticated browser tests**. No existing user records were used or modified. All four cases were attempted once, sequentially; no failed case was automatically retried.

| Case | Outcome | Wall time | Local model calls |
|---|---|---:|---:|
| Document RAG | Timeout, no answer | 30.059 s | 1 |
| CSV agent | Timeout during planning | 30.100 s | 1 |
| Combined agent | Timeout during planning | 30.015 s | 1 |
| Missing evidence | Timeout during planning | 30.016 s | 1 |

No accuracy score, correct refusal or citation success is claimed for these failed local cases. `code:23` in the JSON is the DOMException timeout code, not an application HTTP status. The application still applies its existing safe error handling. CPU prefill/inference and model context reload costs are plausible performance contributors; no profiling was done to apportion them. The runtime limitation is confirmed, not a claim that Qwen can never perform these tasks on other hardware.

## Implementation and protections

The official AI SDK compatible adapter plus a bounded native fetch bridge supports the existing structured output and function interfaces. The bridge handles tool-result replay, object arguments and schema output; native calls explicitly set `think:false`, `num_ctx` and `num_predict`. Returned arguments are never executed by the bridge: existing SDK validation, owned discovery, read-only query compilation and backend tool functions remain in charge. Schema descriptions, original quote choices, citation validation, applicability/conflict guards and refusals are unchanged.

Groq is the default provider; Gemini and Groq remain selectable. Local selection has no API key, no cloud model tag, no remote endpoint, no Groq quota ledger access and no automatic fallback. BGE settings are separate. Local transport has a two-call process-local cap, conservative context bound, one-megabyte response bound, existing deadlines and safe errors. This does not provide distributed scheduling or guarantee local availability.

## Automated validation

Focused suite: **19/19 passed** (five new local tests plus 14 existing provider tests). Full standard suite: **333 passed, zero failed, 12 optional database tests skipped (345 total)**. The Groq test responses were mocked; no live Groq regression claim is made. Existing numeric diagnostic changes and prior untracked reservation-review files were preserved.

New tests cover provider selection, local-only endpoint/model restrictions, native schema controls, document RAG citations, CSV/combined tool execution, tool-result replay, refusals, unauthorized/SQL-shaped plans, malformed native arguments, context overflow and cancellation. Mocked evidence tests establish adapter/backend contracts, not local model accuracy. No production database migrations or database-enabled fixture writes were run.

Final `npx tsc --noEmit`, `npm run lint`, `npx next build --webpack` and `git diff --check` all passed. Repository secret/security scan reported zero findings across 374 working files and 439 history blobs. This is not a dependency-vulnerability clearance: npm installation reported 16 moderate dependency audit findings; no audit fix was run. The install added three packages; attribution of audit findings to old versus new dependencies was not established. Eight local inference attempts were made across protocol and application checks; zero paid-provider calls were made.

## Files changed for this task

- `package.json`, `package-lock.json`: pinned official compatible adapter 3.0.82.
- `src/lib/ai-provider.ts`: optional local selection; unset default now Groq as requested.
- `src/lib/ollama-transport.ts`: new bounded local native bridge.
- `src/lib/provider-usage.ts`, `src/lib/reliability.ts`, `src/lib/knowledge-agent.ts`: safe local stage/usage labels.
- `tests/ai-provider.test.ts`: explicit default-provider expectation.
- `tests/ollama-provider.test.ts`: new offline tests.
- `evaluation/ollama-local-acceptance.ts`: opt-in fictional local acceptance runner.
- `.env.example`, `README.md`, `docs/project-handover.md`, `docs/ai-providers.md`, `docs/ollama-provider.md`: configuration/default/limitations.
- This report and `results.json`: separate actual evidence, no edits to historical results.

## Remaining limitations and readiness

Real local acceptance is **blocked**, despite protocol compatibility and passing mocked tests. Keep Groq selected for the existing workflow. A faster local runtime or separately reviewed execution budget would be needed before repeating controlled acceptance; neither was changed here. Do not deploy this optional provider as a verified replacement, weaken guardrails or increase quotas to hide the failures. No more tests or optimization are implied by this report.
