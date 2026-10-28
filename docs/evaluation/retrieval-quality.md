# Day 9 Step 2 — Retrieval quality evaluation

Verified on 27 October 2026 (Asia/Karachi).

## Main finding

On the added overlapping-content suite, semantic search ranked a relevant chunk first on all 14 answerable questions. Hybrid did so on 12 of 14. Both modes retrieved every labelled relevant chunk within the top three. Hybrid therefore preserved coverage here but made two first-position mistakes. No ranking-policy change was applied: the current RRF implementation behaves as documented, and this small corpus is not enough evidence to change the application default.

No LLM answers were generated. Mock answer checks from Step 1 are not used as AI accuracy evidence.

## What ran

- Existing benchmark: all 25 definitions remain unchanged. Its 19 document-retrieval questions were evaluated; six CSV-only questions have no document relevance labels. Fifteen of those 19 questions have positive chunk labels.
- Separate stress extension: 20 new questions and 18 new fictional documents, including near-identical invoice IDs, semantic paraphrases, overlapping policies and tenant/lifecycle canaries. Fourteen stress questions have positive labels and six have no authorized answering chunk.
- Total: 39 questions, three repetitions per mode, 234 actual searchDocuments calls. The final timed run started after build/regression jobs finished. Mode order alternated by question and repetition. Corpus embeddings were cached once before timing, and the model was warmed.
- Within each question, both modes used the same question, owner, fixture corpus and configured BGE model. Original scenarios retain their seven/eight authorized chunks; stress owner A has 21 authorized ready chunks and owner B has two. Do not compare cohort scores as if the corpora were identical.
- PostgreSQL temporary tables isolate every case. Explicit IDs, no copied public defaults/sequences, namespace checks, rollback and pool restoration keep existing data separate. No document files or permanent schemas are created.
- The HTTP guard permits only the configured Ollama embed/tags endpoints; provider HTTP calls are blocked. Gemini/Groq settings and integrations were unchanged. Zero LLM requests were made.

Environment: Node 22.22.3; PostgreSQL 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1); pgvector 0.8.1; BGE hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0 (768 dimensions); similarity cutoff 0.5.
Recorded embedding artifact digest: `84458fec40824b6a9c3df75ab7f88c36a46c6f098cf3517005ee77365e93d3df`.
Original benchmark checksum: `898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec`. It matches the Step 1 fixture catalog checksum.

Raw observations, corpus hashes, ranks, scores, labels and metadata are in [results.json](retrieval-quality-data/results.json). The [fixture catalog](retrieval-quality-data/fixtures.json) and [generated comparison](retrieval-quality-data/report.md) make this run independently inspectable.

## Actual aggregate metrics

These are macro means across positively labelled questions, with equal repetitions per question. The repeated observations are not additional independent questions.

| Cohort | Mode | Labelled questions | Recall@1 | Precision@1 | Recall@3 | Precision@3 | MRR@3 | Hit Rate@3 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| original | semantic | 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 |
| original | hybrid | 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 |
| stress | semantic | 14 | 0.9643 | 1.0000 | 1.0000 | 0.3571 | 1.0000 | 1.0000 |
| stress | hybrid | 14 | 0.8214 | 0.8571 | 1.0000 | 0.3571 | 0.9286 | 1.0000 |

Recall@1 is below 1 even when Precision@1 is 1 because some questions require two policy chunks. One correct policy in first place is relevant, but it is not all the required evidence.
Precision@3 always divides by three, including unfilled slots. Most questions have only one relevant chunk, so their maximum Precision@3 is 1/3. Low Precision@3 here is partly a consequence of these sparse labels, not proof of a broken retriever.
MRR is explicitly truncated at rank three because the existing service returns at most three results. Hit Rate@3 asks whether any relevant chunk was found; Recall@3 additionally measures completeness. Neither metric establishes answer correctness.

## Latency

Actual embedding + PostgreSQL + ranking latency, milliseconds; corpus generation and fixture seeding are excluded. Percentiles use nearest rank.

| Cohort | Mode | Measured calls | p50 ms | p95 ms | Mean ms |
| --- | --- | ---: | ---: | ---: | ---: |
| original | semantic | 57 | 54.14 | 84.29 | 58.56 |
| original | hybrid | 57 | 58.86 | 93.93 | 63.56 |
| stress | semantic | 60 | 48.72 | 72.48 | 52.10 |
| stress | hybrid | 60 | 61.98 | 90.91 | 65.44 |

Hybrid was slower on this small warm local corpus. This includes independently recomputed query embeddings for each mode; it is not a database-only microbenchmark or a production latency SLA. No significance claim or large-index scaling conclusion is justified.

## Behaviour by question type

Stress tags overlap; these groups must not be added together. Empty-gold cases are excluded from rank means and shown separately.

| Stress tag | Labelled / empty-gold questions | Semantic P@1 | Hybrid P@1 | Semantic MRR@3 | Hybrid MRR@3 |
| --- | --- | ---: | ---: | ---: | ---: |
| exact | 4 / 0 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| paraphrase | 4 / 0 | 1.0000 | 0.7500 | 1.0000 | 0.8750 |
| identifier | 6 / 4 | 1.0000 | 0.8333 | 1.0000 | 0.9167 |
| overlap | 12 / 3 | 1.0000 | 0.8333 | 1.0000 | 0.9167 |
| irrelevant | 0 / 2 | N/A | N/A | N/A | N/A |
| ownership | 1 / 4 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

The exact-keyword positive controls passed in both modes. Identifier questions did not demonstrate a Recall@3 gain from hybrid in this run. One identifier question had worse first rank under hybrid. Three of four added paraphrases retained correct first rank under hybrid; all four did under semantic. The ownership tag contains only one positive-control relevance query, so its rank score is not a general tenant-security percentage. Permission checks are discussed below.

## Measured ranking weaknesses

### General invoice guidance outranks an exact invoice

ret-01 asks the approval status of QX-7841. Gold chunk 2001 says that exact invoice is pending review, not approved. Hybrid ranks generic invoice guidance (2004) first and 2001 second. Semantic ranks 2001 first.
The generic guide does not identify QX-7841, so it cannot establish its status. All three repetitions reproduced this ordering.

Observed ret-01 details:
- Relevant chunk 2001: cosine 0.755380, semantic rank 1, keyword rank 2, RRF 0.032522475.
- Less relevant chunk 2004: cosine 0.709950, semantic rank 2, keyword rank 1, RRF 0.032522475.

### Repair turnaround outranks the unopened return window

ret-09 asks how long unused, unopened equipment may be returned after delivery. Gold chunk 103 gives 30 days. Hybrid instead ranks repair turnaround (2010, 45 days) first, with 103 second. Semantic ranks 103 first. The repair text contains the phrase “unopened equipment return window” in a negated sentence, illustrating that bag-of-words matches do not establish applicability.

Observed ret-09 details:
- Relevant chunk 103: cosine 0.820116, semantic rank 1, keyword rank 2, RRF 0.032522475.
- Less relevant chunk 2010: cosine 0.778292, semantic rank 2, keyword rank 1, RRF 0.032522475.

Both errors are symmetric rank-1/rank-2 RRF ties. The documented tie-break first compares strongest branch rank (also tied), then favours keyword rank. That chooses the less applicable chunk in these two cases. The arithmetic is correct; this is a relevance tradeoff, not an implementation defect. No relevant chunk was missed at rank three.

### Other false positives and near misses

- ret-06: hybrid adds contractor leave policy 2009 at rank two despite cosine below 0.5. The employee allowance 102 remains first. Contractor rules cannot establish a salaried employee allowance.
- ret-12: hybrid promotes forecast guidance 2012 to rank two for a South-department target question. South policy 2014 remains first. Forecast guidance does not give the requested target.
- Nearby invoices with different statuses appear as extra candidates for identifier questions. The question is not answered correctly merely because a candidate discusses invoices.
- Original conflict cases retrieve both policies in the first two places. This is complete retrieval, not proof that a later answer will correctly handle the conflict.

## Irrelevant questions: raw candidates versus usable evidence

Semantic searchDocuments returns nearest neighbours before the downstream cosine cutoff. Hybrid already filters semantic-only candidates but intentionally keeps exact keyword matches below that cutoff. For fairness, raw and selectEvidence-eligible outputs are both stored. On the positively labelled queries the reported R/P/MRR/Hit values are unchanged after eligibility filtering in this run. Empty-gold behaviour differs:

| Cohort | Mode | Empty-gold questions | Raw nonempty | Eligible nonempty |
| --- | --- | ---: | ---: | ---: |
| original | semantic | 4 | 4 | 4 |
| original | hybrid | 4 | 4 | 4 |
| stress | semantic | 6 | 6 | 5 |
| stress | hybrid | 6 | 6 | 6 |

ret-14 asks for the capital of the fictional country Lumoria. Semantic returns three unrelated neighbours with cosine below 0.5, so none becomes eligible evidence. Hybrid keeps three keyword-only candidates (106, 109, 2001), also below 0.5. Their only meaningful shared query word is the generic fixture descriptor “fictional”; none contains a country or capital fact. The OR-style full-text branch admits them by design.
This is measured candidate noise, not evidence that an LLM hallucinated: no model answer was requested. Similarly, unrelated results on a hidden-canary query do not mean protected content leaked. Downstream abstention still needs its own answer evaluation.

## Ownership and lifecycle boundaries

All 234 retrieval calls had zero scope violations and zero metadata violations. Ready-owner filters remained active in both semantic and keyword branches.
- Owner A never retrieved the owner-B canary 2015. The same question as owner B retrieved 2015 first in both modes (ret-20).
- Deleted 2016, processing 2017 and superseded 2018 were never returned. The baseline foreign/deleted/processing clones were also correctly scoped.
- Original document IDs, chunk IDs, filenames, chunk indexes, available pages and source text matched the fixture manifest. No citation formatter or provider implementation was changed.

## Per-case errors and comparisons

The full ranked lists and source scores are in JSON. Below, FP means a returned chunk outside the strict gold set; some may be related background, not answering evidence. Results show the first repetition because all three rankings were identical. No query missed any labelled relevant chunk at rank three.

| Case | Gold | Semantic top 3 | Hybrid top 3 | FP semantic / hybrid | Review |
| --- | --- | --- | --- | --- | --- |
| doc-01 | 101 | 101,104,103 | 101,104 | 104,103 / 104 | no first-rank error |
| doc-02 | 102 | 102,101,104 | 102,101,103 | 101,104 / 101,103 | no first-rank error |
| doc-03 | 103 | 103,105,104 | 103,105 | 105,104 / 105 | no first-rank error |
| doc-04 | 104 | 104,105,101 | 104,105,101 | 105,101 / 105,101 | no first-rank error |
| doc-05 | 105 | 105,103,104 | 105,103,104 | 103,104 / 103,104 | no first-rank error |
| doc-06 | 106 | 106,105,104 | 106,104,105 | 105,104 / 104,105 | no first-rank error |
| combined-01 | 101 | 101,104,105 | 101,104 | 104,105 / 104 | no first-rank error |
| combined-02 | 101 | 101,104,103 | 101,104 | 104,103 / 104 | no first-rank error |
| combined-03 | 101 | 101,104,102 | 101,104 | 104,102 / 104 | no first-rank error |
| combined-04 | 101 | 101,104,105 | 101,102,104 | 104,105 / 102,104 | no first-rank error |
| combined-05 | 104 | 104,105,101 | 104,106,105 | 105,101 / 106,105 | no first-rank error |
| combined-06 | 105 | 105,104,103 | 105,101,104 | 104,103 / 101,104 | no first-rank error |
| missing-01 | none | 101,102,106 | 101,102 | 101,102,106 / 101,102 | empty gold; relevance means N/A |
| missing-02 | none | 101,103,104 | 101,102 | 101,103,104 / 101,102 | empty gold; relevance means N/A |
| missing-03 | none | 101,105,103 | 101 | 101,105,103 / 101 | empty gold; relevance means N/A |
| missing-04 | none | 102,101,104 | 102,101,104 | 102,101,104 / 102,101,104 | empty gold; relevance means N/A |
| conflict-01 | 101,107 | 107,101,102 | 107,101,102 | 102 / 102 | multiple required chunks |
| conflict-02 | 101,107 | 107,101,105 | 107,101,105 | 105 / 105 | multiple required chunks |
| ambiguous-01 | 108 | 108,101,104 | 108,101,104 | 101,104 / 101,104 | label review |
| ret-01 | 2001 | 2001,2004,2002 | 2004,2001,2002 | 2004,2002 / 2004,2002 | hybrid wrong first rank |
| ret-02 | 2002 | 2002,2001,2003 | 2002,2001,2004 | 2001,2003 / 2001,2004 | no first-rank error |
| ret-03 | 2003 | 2003,2001,2004 | 2003,2004,2001 | 2001,2004 / 2004,2001 | no first-rank error |
| ret-04 | 2001 | 2001,2002,103 | 2001,2002,2003 | 2002,103 / 2002,2003 | no first-rank error |
| ret-05 | 2005 | 2005,2006,105 | 2005,2006,105 | 2006,105 / 2006,105 | no first-rank error |
| ret-06 | 102 | 102,104,2008 | 102,2009,104 | 104,2008 / 2009,104 | no first-rank error |
| ret-07 | 105 | 105,2011,2010 | 105,2011,2010 | 2011,2010 / 2011,2010 | no first-rank error |
| ret-08 | 104 | 104,2008,2007 | 104,2008,2007 | 2008,2007 / 2008,2007 | no first-rank error |
| ret-09 | 103 | 103,2010,105 | 2010,103,2008 | 2010,105 / 2010,2008 | hybrid wrong first rank |
| ret-10 | 2007 | 2007,104,2008 | 2007,2008,104 | 104,2008 / 2008,104 | no first-rank error |
| ret-11 | 2008 | 2008,104,2004 | 2008,104,2004 | 104,2004 / 104,2004 | no first-rank error |
| ret-12 | 2014 | 2014,101,2013 | 2014,2012,101 | 101,2013 / 2012,101 | no first-rank error |
| ret-13 | 2013,2014 | 2014,2013,101 | 2013,2014,101 | 101 / 101 | multiple required chunks |
| ret-14 | none | 109,106,2011 | 106,109,2001 | 109,106,2011 / 106,109,2001 | empty gold; relevance means N/A |
| ret-15 | none | 104,106,2008 | 102,104,109 | 104,106,2008 / 102,104,109 | empty gold; relevance means N/A |
| ret-16 | none | 101,102,2005 | 101,102,2005 | 101,102,2005 / 101,102,2005 | empty gold; relevance means N/A |
| ret-17 | none | 2005,2010,103 | 2005,2006,2010 | 2005,2010,103 / 2005,2006,2010 | empty gold; relevance means N/A |
| ret-18 | none | 2005,2004,103 | 2010,103,2005 | 2005,2004,103 / 2010,103,2005 | empty gold; relevance means N/A |
| ret-19 | none | 101,2012,2014 | 101,2012,2014 | 101,2012,2014 / 101,2012,2014 | empty gold; relevance means N/A |
| ret-20 | 2015 | 2015,191 | 2015,191 | 191 / 191 | no first-rank error |

## Label review

Labels were authored before measuring the added suite; they were not edited to favour either mode. The original 25 questions/definitions were retained and are tested against the committed Step 1 catalog.
The original ambiguous-01 gold is chunk 108. General Orion policy 101 may also be useful context, so its exclusion is debatable as a background-relevance label. The original label remains unchanged and this case is flagged for review. A later two-level rubric could distinguish answer-bearing evidence from useful background. This ambiguity did not create the original-cohort mode difference: the modes have equal aggregate labelled metrics.
The invoice, employee/contractor, return/repair and department labels are intentionally strict: a shared topic or number is insufficient when it does not establish the fact requested. Empty-gold queries mean no fixture answers the complete question, not that no source contains related vocabulary.

## Evidence-backed recommendations

1. Test an alternative RRF tie-break on a held-out labelled set. A semantic-rank preference in equal-fusion/equal-strongest-rank ties directly targets ret-01 and ret-09, but these observations do not prove it will improve other queries. Do not change the default based on these two examples alone.
2. Test identifier-aware and low-information-term handling in the keyword branch. The exact-invoice failure and Lumoria/“fictional” false positives justify this investigation. Preserve valid exact keyword matches with low cosine; a blanket semantic cutoff on keyword hits would violate that requirement.
3. Keep overlap/negation/boundary cases in regression evaluation and expand them with independently reviewed labels. Contractor leave, repair turnaround and forecast guidance show that topic overlap is not applicability.
4. Keep semantic and hybrid configurable. The original easy corpus showed no difference; the stress corpus showed a hybrid top-1 loss and no Recall@3 gain. These data do not justify declaring either mode universally superior or replacing BGE/PostgreSQL.
5. Evaluate answer-level abstention separately before drawing conclusions from empty-gold candidate noise. This step intentionally makes no answer-accuracy or hallucination claim.

No production retrieval improvement was applied. No genuine implementation defect was confirmed.

## Limitations

- Small hand-authored fictional corpus, one chunk per document, with a limited number of policies and identifiers. Corpus size and gold-set choices affect precision.
- Three warm repetitions establish local rank stability, not statistical independence, cold-start performance, concurrency behaviour or a production latency SLA. The pilot and final run had identical rankings, but hardware/background work can change timing.
- Temporary fixture tables use exact small-corpus scans rather than production approximate-vector/index behaviour. Ingestion, chunk boundaries, parsing and large-dataset performance were not evaluated here.
- English full-text search, the configured quantized BGE artifact, the existing 0.5 cutoff and current RRF settings were tested. No model, index, prompt or threshold tuning was performed.
- MRR is truncated at three. Empty-gold queries do not contribute to positive-query macro scores; their candidate counts are reported separately.
- No LLM calls, answer generation, answer correctness or live citation reasoning was evaluated. Existing tests cover those contracts separately.

## Changed files and tests

- evaluation/retrieval-fixtures.ts: separate labelled retrieval additions; original 25-case definitions unchanged.
- evaluation/retrieval-metrics.ts: R@1/R@3, P@1/P@3, truncated reciprocal rank, hit rate, empty-gold and latency aggregates.
- evaluation/retrieval-quality.ts: paired real runner, scope/metadata checks, Ollama-only HTTP guard, runtime/corpus metadata and generated data/report bundles.
- evaluation/isolation.ts: optional extra fixture documents with duplicate-ID checks, preserving previous callers.
- tests/retrieval-quality.test.ts: nine metric, reproducibility, guard and permission tests.
- package.json: evaluate:retrieval command; no dependency changes.
- docs/evaluation/retrieval-quality.md and retrieval-quality-data/: findings and measured artifacts. Documentation links updated.

Actual final verification:

| Check | Result |
| --- | --- |
| Standard npm test | 164 registered; 159 passed; five optional database skips; zero failures |
| All database flags enabled | All 164 passed; zero failures/skips |
| TypeScript | Passed |
| ESLint | Passed |
| Supported production Webpack build | Passed |
| Repeated paired retrieval | 39 questions, 234 calls; zero execution/scope/metadata errors |
| Ranking stability | Identical across repetitions; pilot/final rank lists also agree |

Existing public-table content fingerprints were checked before and after evaluation to verify no user records changed. Application authentication, SQL protections, citations, AI providers and BGE configuration were preserved. No migrations or permanent fixture records were created.

## Repeat the evaluation

```bash
node --env-file=.env.local --conditions=react-server --import tsx \
  evaluation/retrieval-quality.ts --repetitions 3

# If DATABASE_URL/Ollama settings are already exported:
npm run evaluate:retrieval -- --repetitions 3

# Optional isolated cohort:
node --env-file=.env.local --conditions=react-server --import tsx \
  evaluation/retrieval-quality.ts --suite stress --repetitions 3 \
  --out .evaluation-results/retrieval-stress

npm test
npx tsc --noEmit
npm run lint
npm run build -- --webpack
RUN_AUTH_DB_TESTS=1 RUN_LIFECYCLE_DB_TESTS=1 RUN_SEARCH_DB_TESTS=1 RUN_EVAL_DB_TESTS=1 \
  node --env-file=.env.local --conditions=react-server --import tsx \
  --test --experimental-test-isolation=none tests/*.test.ts
```

The runner is standalone operator tooling. Do not import it into the application server or run cases concurrently in the same process. PostgreSQL/Ollama must be reachable; no Gemini/Groq credential is needed.
