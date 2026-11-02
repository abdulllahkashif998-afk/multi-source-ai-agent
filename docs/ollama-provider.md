# Optional local Ollama provider — experimental, acceptance blocked

**Do not treat this as a verified working replacement on the tested CPU.** Four real local application-component cases timed out. The tool/JSON protocol probes passed; end-to-end acceptance remains blocked. Select explicitly; Groq remains the default when `AI_PROVIDER` is unset. Existing Groq model selection, pacing, quota ledger, retries and deadlines are unchanged. Explicit Gemini remains available. Local requests never use the Groq limiter and never fall back to a paid provider.

## Setup

The existing Ollama service must have `qwen3.5:4b` installed. Do not change the separate BGE embedding model or its endpoint configuration. Set these **server-side** variables in your existing private environment file, preserving its other values:

```dotenv
AI_PROVIDER=ollama
OLLAMA_LLM_MODEL=qwen3.5:4b
OLLAMA_LLM_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_CONTEXT_TOKENS=16384
```

Restart the application after changing environment variables. To return to the current hosted workflow, set `AI_PROVIDER=groq` and retain the existing `GROQ_API_KEY`/`GROQ_MODEL` configuration. No fallback or environment file modification is performed by the integration. No Ollama API key is used. Only a loopback URL without credentials, query, fragment or extra path is accepted; the model is fixed to the local tag, not a cloud name.

## Interface

The pinned official `@ai-sdk/openai-compatible` adapter supplies AI SDK v4 model interfaces to the existing AI SDK 7 orchestration. A small fetch bridge translates its non-streaming chat messages, function calls/results and JSON schema into native Ollama `/api/chat`. Native controls are explicit: `think:false`, `num_ctx` from the server configuration, `num_predict` from the existing stage output ceiling and temperature zero. Native results are translated back into SDK completions. Returned tool arguments still go through the existing strict schemas, dataset discovery/ownership and read-only SQL compiler. No model SQL or malformed tool call is executed.

Both `/api/chat` and `/api/agent` use the selected provider. Original quote references, policy applicability, conflicts/refusals and final citation verification are unchanged. Thinking text is neither used as evidence nor logged. Logs contain safe timing/classification and numeric usage only.

## Bounds and failures

Context defaults to 16,384 tokens and accepts 4,096–32,768. A conservative byte-based input guard plus template/message allowance and output budget rejects oversized contexts rather than trimming evidence. This is a protective bound, not calibrated Qwen tokenization. It can reject inputs that would otherwise fit. The running context is set per request; it does not rewrite the installed model or BGE settings.

The bridge caps two active calls per process, bounds response size to 1 MB and respects cancellation and existing 30-second call/60-second agent deadlines. No automatic retries are added. Busy, unavailable model, context overflow and timeouts produce safe errors. These bounds do not provide distributed scheduling or eliminate contention between local embeddings and generation. CPU inference can be too slow for these existing deadlines. Do not extend them blindly or treat protocol compatibility as successful application acceptance.

## Verification

[Actual local results and offline regression evidence](evaluation/ollama-local/report.md) distinguish real local model calls from mocked SDK/backend tests. The local acceptance runner uses injected fictional document/CSV evidence, not database fixtures or authenticated browser testing:

```bash
RUN_LOCAL_OLLAMA_ACCEPTANCE=1 node --conditions=react-server --import tsx evaluation/ollama-local-acceptance.ts
```

It explicitly selects Ollama, blocks non-loopback/non-chat networking, runs four cases sequentially without retries and saves to `/tmp/ollama-local-acceptance.json`. It never reads or writes application database records. Use only with local inference resources available; it may occupy the CPU for several bounded calls. Failed runs are not evidence of correct answers. Full real PDF/CSV upload, PostgreSQL retrieval and authenticated browser acceptance remain separate checks.

## References

[Official AI SDK compatible adapter](https://ai-sdk.dev/providers/openai-compatible-providers), [Ollama native chat API](https://docs.ollama.com/api/chat), [Ollama compatibility API](https://docs.ollama.com/api/openai-compatibility). Local inspection confirmed Ollama 0.40.4 and model capabilities completion, vision, tools and thinking; this does not imply that every question is reliable.
