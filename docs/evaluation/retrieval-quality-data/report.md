# Real retrieval measurements

No LLM calls. These are retrieval measurements, not answer accuracy.
Metadata: {"schemaVersion":1,"kind":"real-retrieval-only","generatedAt":"2026-10-27T16:32:38.026Z","originalBenchmarkHash":"898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec","repetitions":3,"modeOrder":"alternating question/repetition","minSimilarity":0.5,"node":"22.22.3","embeddingModel":"hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0","embeddingDimensions":768,"llmRequests":0,"postgres":"18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)","pgvector":"0.8.1","embeddingDigest":"84458fec40824b6a9c3df75ab7f88c36a46c6f098cf3517005ee77365e93d3df","interrupted":false,"planned":39,"completed":39}

## Aggregate raw service metrics

| Cohort | Mode | Questions / labelled | R@1 | P@1 | R@3 | P@3 | MRR@3 | Hit@3 | p50 ms | p95 ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| original | semantic | 19 / 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 | 54.1370 | 84.2926 |
| original | hybrid | 19 / 15 | 0.9333 | 1.0000 | 1.0000 | 0.3778 | 1.0000 | 1.0000 | 58.8564 | 93.9291 |
| stress | semantic | 20 / 14 | 0.9643 | 1.0000 | 1.0000 | 0.3571 | 1.0000 | 1.0000 | 48.7222 | 72.4822 |
| stress | hybrid | 20 / 14 | 0.8214 | 0.8571 | 1.0000 | 0.3571 | 0.9286 | 1.0000 | 61.9800 | 90.9056 |

## Per-question paired comparisons

Ranked IDs are chunk IDs. Differences between repeated rankings are reported in JSON. Raw retrieval does not mean every candidate is sufficient evidence.

| Case | Gold | Semantic raw / eligible | Hybrid raw / eligible | Semantic / hybrid RR@3 | Missed S / H |
| --- | --- | --- | --- | --- | --- |
| doc-01 | 101 | 101,104,103 / 101,104 | 101,104 / 101,104 | 1.0000 / 1.0000 | none / none |
| doc-02 | 102 | 102,101,104 / 102,101 | 102,101,103 / 102,101,103 | 1.0000 / 1.0000 | none / none |
| doc-03 | 103 | 103,105,104 / 103,105 | 103,105 / 103,105 | 1.0000 / 1.0000 | none / none |
| doc-04 | 104 | 104,105,101 / 104,105,101 | 104,105,101 / 104,105,101 | 1.0000 / 1.0000 | none / none |
| doc-05 | 105 | 105,103,104 / 105,103,104 | 105,103,104 / 105,103,104 | 1.0000 / 1.0000 | none / none |
| doc-06 | 106 | 106,105,104 / 106,105,104 | 106,104,105 / 106,104,105 | 1.0000 / 1.0000 | none / none |
| combined-01 | 101 | 101,104,105 / 101,104 | 101,104 / 101,104 | 1.0000 / 1.0000 | none / none |
| combined-02 | 101 | 101,104,103 / 101,104 | 101,104 / 101,104 | 1.0000 / 1.0000 | none / none |
| combined-03 | 101 | 101,104,102 / 101,104 | 101,104 / 101,104 | 1.0000 / 1.0000 | none / none |
| combined-04 | 101 | 101,104,105 / 101,104 | 101,102,104 / 101,102,104 | 1.0000 / 1.0000 | none / none |
| combined-05 | 104 | 104,105,101 / 104,105 | 104,106,105 / 104,106,105 | 1.0000 / 1.0000 | none / none |
| combined-06 | 105 | 105,104,103 / 105,104,103 | 105,101,104 / 105,101,104 | 1.0000 / 1.0000 | none / none |
| missing-01 | none | 101,102,106 / 101,102 | 101,102 / 101,102 | N/A / N/A | none / none |
| missing-02 | none | 101,103,104 / 101 | 101,102 / 101,102 | N/A / N/A | none / none |
| missing-03 | none | 101,105,103 / 101 | 101 / 101 | N/A / N/A | none / none |
| missing-04 | none | 102,101,104 / 102,101,104 | 102,101,104 / 102,101,104 | N/A / N/A | none / none |
| conflict-01 | 101,107 | 107,101,102 / 107,101,102 | 107,101,102 / 107,101,102 | 1.0000 / 1.0000 | none / none |
| conflict-02 | 101,107 | 107,101,105 / 107,101,105 | 107,101,105 / 107,101,105 | 1.0000 / 1.0000 | none / none |
| ambiguous-01 | 108 | 108,101,104 / 108,101,104 | 108,101,104 / 108,101,104 | 1.0000 / 1.0000 | none / none |
| ret-01 | 2001 | 2001,2004,2002 / 2001,2004,2002 | 2004,2001,2002 / 2004,2001,2002 | 1.0000 / 0.5000 | none / none |
| ret-02 | 2002 | 2002,2001,2003 / 2002,2001,2003 | 2002,2001,2004 / 2002,2001,2004 | 1.0000 / 1.0000 | none / none |
| ret-03 | 2003 | 2003,2001,2004 / 2003,2001,2004 | 2003,2004,2001 / 2003,2004,2001 | 1.0000 / 1.0000 | none / none |
| ret-04 | 2001 | 2001,2002,103 / 2001,2002,103 | 2001,2002,2003 / 2001,2002,2003 | 1.0000 / 1.0000 | none / none |
| ret-05 | 2005 | 2005,2006,105 / 2005,2006,105 | 2005,2006,105 / 2005,2006,105 | 1.0000 / 1.0000 | none / none |
| ret-06 | 102 | 102,104,2008 / 102,104,2008 | 102,2009,104 / 102,2009,104 | 1.0000 / 1.0000 | none / none |
| ret-07 | 105 | 105,2011,2010 / 105,2011,2010 | 105,2011,2010 / 105,2011,2010 | 1.0000 / 1.0000 | none / none |
| ret-08 | 104 | 104,2008,2007 / 104,2008,2007 | 104,2008,2007 / 104,2008,2007 | 1.0000 / 1.0000 | none / none |
| ret-09 | 103 | 103,2010,105 / 103,2010,105 | 2010,103,2008 / 2010,103,2008 | 1.0000 / 0.5000 | none / none |
| ret-10 | 2007 | 2007,104,2008 / 2007,104,2008 | 2007,2008,104 / 2007,2008,104 | 1.0000 / 1.0000 | none / none |
| ret-11 | 2008 | 2008,104,2004 / 2008,104,2004 | 2008,104,2004 / 2008,104,2004 | 1.0000 / 1.0000 | none / none |
| ret-12 | 2014 | 2014,101,2013 / 2014,101,2013 | 2014,2012,101 / 2014,2012,101 | 1.0000 / 1.0000 | none / none |
| ret-13 | 2013,2014 | 2014,2013,101 / 2014,2013,101 | 2013,2014,101 / 2013,2014,101 | 1.0000 / 1.0000 | none / none |
| ret-14 | none | 109,106,2011 / none | 106,109,2001 / 106,109,2001 | N/A / N/A | none / none |
| ret-15 | none | 104,106,2008 / 104,106,2008 | 102,104,109 / 102,104,109 | N/A / N/A | none / none |
| ret-16 | none | 101,102,2005 / 101,102,2005 | 101,102,2005 / 101,102,2005 | N/A / N/A | none / none |
| ret-17 | none | 2005,2010,103 / 2005,2010,103 | 2005,2006,2010 / 2005,2006,2010 | N/A / N/A | none / none |
| ret-18 | none | 2005,2004,103 / 2005,2004,103 | 2010,103,2005 / 2010,103,2005 | N/A / N/A | none / none |
| ret-19 | none | 101,2012,2014 / 101,2012,2014 | 101,2012,2014 / 101,2012,2014 | N/A / N/A | none / none |
| ret-20 | 2015 | 2015,191 / 2015,191 | 2015,191 / 2015,191 | 1.0000 / 1.0000 | none / none |

## Cases and labels

- **doc-01** (exact): What is the minimum monthly sales target for a team?
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **doc-02** (paraphrase): How many paid vacation days does an Orion employee get each year?
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **doc-03** (paraphrase): How long after delivery can unopened equipment be sent back?
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **doc-04** (paraphrase): At what travel expense amount is manager sign-off required?
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **doc-05** (paraphrase): What is the acknowledgment deadline for a service incident?
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **doc-06** (identifier): Tell me the recorded approval status of ZX-2048.
  Label rationale: Review whether the prose states the policy correctly, including conditions, units and scope.
- **combined-01** (paraphrase): Compare team totals with the policy minimum. How far below is Beta?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **combined-02** (paraphrase): Using the team policy and sales.csv, by how much does Alpha exceed the target?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **combined-03** (paraphrase): Does Gamma meet the minimum monthly team total exactly?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **combined-04** (paraphrase): According to the policy, which teams fall short when all sales rows are added per team?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **combined-05** (paraphrase): Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **combined-06** (paraphrase): Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline?
  Label rationale: Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.
- **missing-01** (irrelevant): What ocean research grants does Orion offer?
  Label rationale: No source answers the complete question. Nearest-neighbor candidates are not automatically hallucinated answers.
- **missing-02** (irrelevant): What were team sales last year? The provided sales data has no year column.
  Label rationale: No source answers the complete question. Nearest-neighbor candidates are not automatically hallucinated answers.
- **missing-03** (irrelevant): What is the average customer age in sales.csv?
  Label rationale: No source answers the complete question. Nearest-neighbor candidates are not automatically hallucinated answers.
- **missing-04** (irrelevant): What is Orion’s parental leave allowance?
  Label rationale: No source answers the complete question. Nearest-neighbor candidates are not automatically hallucinated answers.
- **conflict-01** (overlap, label-review): Which minimum monthly target should we use when the two active Orion policies disagree?
  Label rationale: Manual review required: confirm conflicts/ambiguity were recognized rather than ignored.
- **conflict-02** (overlap, label-review): Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates?
  Label rationale: Manual review required: confirm conflicts/ambiguity were recognized rather than ignored.
- **ambiguous-01** (overlap, label-review): What monthly team target applies to me? My department is not specified.
  Label rationale: Original gold is only chunk 108. General Orion policy 101 may also be useful context; retain original label and flag for review.
- **ret-01** (identifier, overlap): What is the approval status of invoice QX-7841?
  Label rationale: Only the exact invoice is relevant; generic invoice guidance and adjacent identifiers cannot establish its status.
- **ret-02** (identifier, overlap): Is QX-7842 approved for payment?
  Label rationale: Adjacent QX identifiers have different statuses and are hard negatives.
- **ret-03** (identifier, overlap): Why was invoice QX-7843 rejected?
  Label rationale: Only this invoice states the missing-purchase-order reason.
- **ret-04** (identifier, exact): QX-7841
  Label rationale: Identifier-only query, without generic finance/approval words.
- **ret-05** (identifier, overlap): What must happen before resuming the archive task in CRON-Z7P9?
  Label rationale: The runbook, not the generic archive guide, gives the prerequisites.
- **ret-06** (paraphrase, overlap): How much paid time away from work can a salaried employee take each year?
  Label rationale: Employee leave allowance, not contractor policy, answers the amount.
- **ret-07** (paraphrase, overlap): How soon should staff confirm they have seen a service outage?
  Label rationale: Acknowledgment differs from resolution time.
- **ret-08** (paraphrase, overlap): When do business trip costs need a supervisor to sign off?
  Label rationale: Expenses use the 500-credit manager rule, not the cash-advance rule.
- **ret-09** (paraphrase, overlap): How long do I have to send back unused, unopened equipment after it arrives?
  Label rationale: Return window differs from repair turnaround.
- **ret-10** (exact, overlap): What limit applies to travel cash advances before booking?
  Label rationale: Finance approval for advances above 300 differs from expense approval.
- **ret-11** (exact, overlap): Which amount triggers manager approval for equipment purchases?
  Label rationale: Equipment purchases differ from travel expenses even though both use 500.
- **ret-12** (exact, overlap): What is the monthly team sales target for the South department?
  Label rationale: South-specific 25 units; general Orion and North policy are hard negatives.
- **ret-13** (overlap): Compare the North and South department monthly team targets.
  Label rationale: Both department policies are required; finding only one gives partial recall.
- **ret-14** (irrelevant): What is the capital city of the fictional country Lumoria?
  Label rationale: No fixture contains a country or capital.
- **ret-15** (irrelevant, overlap): Does the office provide paid lunar tourism and ocean exploration grants?
  Label rationale: Office/paid vocabulary overlaps but no source supports these benefits.
- **ret-16** (ownership, identifier): What is the ZETA-TENANT-77 rotation period?
  Label rationale: Only another owner has this canary; no authorized relevant chunk.
- **ret-17** (ownership, identifier): What is the ARCHIVE-DROP-44 retention period?
  Label rationale: Deleted document must remain excluded.
- **ret-18** (ownership, identifier, overlap): What return window does DRAFT-UNPUBLISHED-9 permit?
  Label rationale: Processing document must remain excluded despite exact keyword match.
- **ret-19** (ownership, identifier, overlap): What is the LEGACY-TARGET-66 team target?
  Label rationale: Superseded document must remain excluded.
- **ret-20** (ownership, identifier): What is the ZETA-TENANT-77 rotation period?
  Label rationale: Positive control: the authorized owner must be able to retrieve the foreign canary.

## Definitions

R@K and P@K use unique relevant hits, with K as the precision denominator. Empty-gold queries are excluded from labelled means and reported separately. MRR is truncated at 3 because the service exposes at most three results; zero when no gold chunk appears. Hit@3 needs one relevant chunk, not all relevant chunks. Each question has the same number of repetitions, so macro means over observations weight questions equally. Failed retrieval calls count as empty results for labelled metrics and are also reported as errors. Setup failures have no observations and are disclosed separately.
Latency includes actual BGE embedding, PostgreSQL and ranking work, excluding fixture setup/corpus embeddings. Orders alternate between repetitions and questions. Percentiles use nearest rank; repeated warm measurements are not independent production load samples. Raw outputs and downstream selectEvidence-eligible outputs are both stored; semantic raw results are not threshold-filtered by searchDocuments, whereas hybrid already applies its branch eligibility rules.
The original and stress cohorts have different corpora, so compare modes within a cohort, not one cohort against the other. All fixture text is fictional. No source text from existing public records is used.
