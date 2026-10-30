# Lab questions and expected answers

All results below are **expected fixture answers**, not generated model answers. Application/browser/live-provider status for every question is **Not Tested**. Independent artifact arithmetic is verified separately in [validation-results.json](validation-results.json). This is a separate test set, not a replacement for any original benchmark question.

For combined questions, use this prefix (and the question text in the table):

> Using Northstar_Applicability_Lab_Policy.pdf and Northstar_Applicability_Lab_Incidents.csv,

For CSV-only questions, explicitly name only the lab CSV. For document-only questions, explicitly name only the lab PDF. All comparisons below refer to known in-scope rows; unknown applicability and maintenance eligibility must be reported rather than guessed.

## Citation requirements

PDF page 1 supports organization, interval and unknown-scope rules. Page 2 supports metric deadlines, strict comparison and equality. Page 3 supports maintenance eligibility and metric separation. Page 4 supports counting and uncertainty reporting. CSV citations must refer to actual structured query results containing the required values, scope fields and eligibility evidence—not dataset discovery alone.

Application source IDs/chunk indexes are assigned after ingestion. **Do not invent [D1]/[C1], document IDs, chunk IDs or page metadata.** A response can use multiple statements to respect citation-count limits while establishing all operands and applicability. Expected PDF pages here identify original source locations, not a guarantee that ingestion exposes page numbers.

## Questions

| Test ID | Mode and question | Expected answer | Required evidence |
|---|---|---|---|
| LAB-Q01 | Combined: Which rows are definitely in scope, outside scope, or unresolved? | In scope: LAB-001–018, LAB-021, LAB-025 (20). Outside: LAB-019, LAB-020, LAB-022 (3). Unknown: LAB-023, LAB-024 (2). | PDF p1; CSV organization and incident_at for all 25 rows. |
| LAB-Q02 | Document: What are the first-response and resolution deadlines for each priority? | Response P1/P2/P3 = 1/4/12 hours; resolution = 8/24/72 hours. | PDF p2; no CSV citation needed. |
| LAB-Q03 | Combined: Which P1 incidents definitely missed first response? Include actual hours, deadline and excess. | LAB-003 and LAB-005: each 1.5 hours, limit 1, excess 0.5. LAB-004 is maintenance-excluded. Out-of-scope/unknown rows are not violations. | PDF pp1–3; CSV IDs, organization, incident_at, severity, response_hours, maintenance flag/notice. |
| LAB-Q04 | Combined: Which P2 tickets definitely exceeded first response? Include ticket IDs and response times. | LAB-009: 6 hours vs 4, excess 2. LAB-011: 4.5 vs 4, excess 0.5. LAB-008 equals 4 and is on time. LAB-010 is excluded. | PDF pp1–3; corresponding CSV rows with scope and maintenance evidence. |
| LAB-Q05 | Combined: Which P3 incidents are confirmed late for first response, and which remain unresolved? | Late: LAB-015 at 18 (excess 6), LAB-017 at 12.5 (excess 0.5), LAB-021 at 13 (excess 1), all vs 12. LAB-025 has unknown maintenance notice: response classification unresolved. | PDF pp1–3; CSV P3 rows including LAB-025's missing notice. |
| LAB-Q06 | Combined: How many first-response violations are confirmed per priority? Is that a complete total? | P1=2, P2=2, P3=3; confirmed total 7. Not a complete unconditional total: LAB-025 is unresolved in scope and LAB-023/024 have unknown applicability. Among known in-scope rows: 9 on time, 3 excluded, 1 unresolved, 7 late. | PDF pp1–4; grouped CSV evidence separating scope and eligibility states. |
| LAB-Q07 | Combined: How many known in-scope incidents missed resolution, grouped by priority? | P1=4, P2=4, P3=6; total 14. Maintenance does not exempt resolution. Unknown-scope rows excluded from this stated known-scope count. | PDF pp1–3; CSV resolution metrics grouped after scope filtering. |
| LAB-Q08 | Combined: Which incidents land exactly on both deadlines? Are they late? | LAB-002: 1/8 hours, LAB-008: 4/24, LAB-014: 12/72; all on time for both metrics. | PDF pp1–2; CSV scope, severity, response_hours and resolution_hours. |
| LAB-Q09 | Combined: Which maintenance incidents are excluded from first-response scoring? | LAB-004, LAB-010, LAB-016: yes flag and exactly 48 hours' notice. Each remains late for resolution. | PDF pp1–3; CSV scope, flag, notice and resolution values. |
| LAB-Q10 | Combined: Which maintenance incidents had too little notice and still missed first response? | LAB-005, LAB-011, LAB-017: notice 24 hours; each exceeds its own response deadline by 0.5 hours. | PDF pp1–3; CSV notice and response operands. |
| LAB-Q11 | Combined: How do the effective-period boundaries affect LAB-020, LAB-021 and LAB-022? | LAB-020 is before start and outside. LAB-021 is exactly at inclusive start, in scope, and late for response/resolution (13/73 vs 12/72). LAB-022 is exactly at exclusive end and outside. | PDF pp1–2; exact CSV UTC timestamps and metrics. |
| LAB-Q12 | Combined: Can LAB-019, LAB-023 and LAB-024 be marked policy violations? | LAB-019 has a different organization: outside scope. LAB-023 lacks organization and LAB-024 lacks incident_at: applicability unresolved. Do not mark those rows compliant or noncompliant. | PDF p1; CSV missing/mismatched scope values. |
| LAB-Q13 | Combined: Which known in-scope nonmaintenance incidents had an on-time response but late resolution? | LAB-006: 0.75/9 vs 1/8; LAB-012: 3/25 vs 4/24; LAB-018: 9/73 vs 12/72. Each resolution exceeds its deadline by 1 hour. | PDF pp1–3; CSV scope, flag and both metric values. |
| LAB-Q14 | CSV-only: Count all imported rows by region, without applying policy scope. | North=12, South=5, East=4, West=4; total 25. These are raw dataset counts, not compliance counts. | CSV grouped COUNT evidence; PDF not needed. |
| LAB-Q15 | CSV-only: How many records are there for each severity, including all rows? | P1=9, P2=8, P3=8; total 25. | CSV grouped COUNT by severity; PDF not needed. |
| LAB-Q16 | Combined: Can you give a complete, definite first-response violation total for every row? | Refuse an unconditional exact total. Give the qualified known total 7 only with unresolved LAB-025 and unknown applicability LAB-023/024 clearly separated. Request missing evidence; do not treat missing notice as zero. | PDF pp1,3,4; CSV scope and missing notice fields. |
| LAB-Q17 | Combined: What compensation is owed to customers for these incidents? | Insufficient evidence. No compensation/payment rule exists in this corpus; do not derive one from SLA times. | PDF p4 plus absence of a supporting compensation source; no fabricated source citation. |

## Row-level expected classifications

Scope is evaluated before either metric. `unknown notice` affects response only.

| Ticket | Scope | First response | Resolution |
|---|---|---|---|
| LAB-001 | In | On time | On time |
| LAB-002 | In | On time (equal) | On time (equal) |
| LAB-003 | In | Late | Late |
| LAB-004 | In | Maintenance excluded | Late |
| LAB-005 | In | Late | Late |
| LAB-006 | In | On time | Late |
| LAB-007 | In | On time | On time |
| LAB-008 | In | On time (equal) | On time (equal) |
| LAB-009 | In | Late | Late |
| LAB-010 | In | Maintenance excluded | Late |
| LAB-011 | In | Late | Late |
| LAB-012 | In | On time | Late |
| LAB-013 | In | On time | On time |
| LAB-014 | In | On time (equal) | On time (equal) |
| LAB-015 | In | Late | Late |
| LAB-016 | In | Maintenance excluded | Late |
| LAB-017 | In | Late | Late |
| LAB-018 | In | On time | Late |
| LAB-019 | Outside (organization) | Not applicable | Not applicable |
| LAB-020 | Outside (before start) | Not applicable | Not applicable |
| LAB-021 | In (exact start) | Late | Late |
| LAB-022 | Outside (exact end) | Not applicable | Not applicable |
| LAB-023 | Unknown organization | Unresolved applicability | Unresolved applicability |
| LAB-024 | Unknown date | Unresolved applicability | Unresolved applicability |
| LAB-025 | In | Unresolved maintenance eligibility | Late |
