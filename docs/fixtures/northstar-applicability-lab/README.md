# Northstar Applicability Lab — separate fictional fixture

This is **LAB-2026-v1**, a new test corpus. It does not replace or revise the original Northstar files, the original 25-case benchmark, or historical acceptance results. No files have been uploaded and no application database has been touched.

## Files

- [Four-page policy PDF](Northstar_Applicability_Lab_Policy.pdf)
- [25-row CSV](Northstar_Applicability_Lab_Incidents.csv)
- [Questions and human-readable answer key](questions-and-answer-key.md)
- [Machine-readable answer key](answer-key.json)
- [Searchable policy source](policy-source.md)
- [Artifact validation results](validation-results.json)
- [Content hashes](manifest.json)
- [Reproducible generator](generate.py) and [independent validator](validate.py)

The directory-local `.gitignore` narrowly permits these two fictional PDF/CSV artifacts; global private-upload exclusions remain intact. Nothing is staged.

All organizations, identifiers and incidents are fictional. Names deliberately differ from the original corpus. Tickets use LAB IDs rather than original incident IDs.

## Applicability is explicit

Known applicable rows contain organization `Northstar Fixture Operations` and a UTC incident_at in the half-open interval `[2026-10-01T00:00:00Z, 2027-01-01T00:00:00Z)`. The PDF explicitly links this organization/interval to the companion CSV. Ownership, filename similarity and upload date are not substitutes.

There are 20 known in-scope rows, three known outside-scope rows and two rows with unknown applicability. The incomplete rows are deliberate negative cases; never infer their missing facts. Of the in-scope rows, one also has an unknown maintenance notice. Thus this is a consistent fixture with explicit uncertainty, not a claim that every row supports an unconditional answer.

The policy defines response deadlines 1/4/12 hours and resolution deadlines 8/24/72 hours for P1/P2/P3. Equality is on time. Maintenance excludes first-response scoring only with an explicit yes flag and notice at least 48 hours; it never excludes resolution scoring. No department or regional overrides apply.

## Upload and manual testing

1. Start the existing application using its documented local setup. Do not change providers, credentials, model or quota settings for this fixture.
2. Use a **dedicated fictional test account** that owns no other policy/dataset. Create it manually only if authorized. Do not replace/delete existing files or repurpose an existing account's records. Uploading itself is a later manual action; this task performed no uploads.
3. In Documents, upload `Northstar_Applicability_Lab_Policy.pdf`; wait until ready. In Datasets, upload `Northstar_Applicability_Lab_Incidents.csv`; confirm 25 rows and the expected columns.
4. Inspect the inferred schema. organization, incident_at, severity, scheduled_maintenance and ticket_id must remain text; numeric hour columns must be numeric with blanks retained as missing. Boolean yes/no inference is acceptable only if the discovered schema and query values are used consistently; never assume the imported type. Do not silently map missing notice to zero. If importer behavior differs, record it before testing conclusions.
5. Start with CSV-only counts and document-only deadline questions. Then use the combined questions in the answer key. Name both lab files explicitly so the original corpus is not selected.
6. For every result record request ID, status, grounded flag, actual answer and real citations. Verify the references against the uploaded PDF and exact CSV query evidence. Never copy expected source markers into an actual result.
7. Record Pass/Fail/Blocked honestly. Do not convert expected values or validator output into a live pass. A refusal may be correct for unknown rows, but a refusal on a fully evidenced positive case is a current application limitation, not a fixture validation pass.
8. Repeat a selection under another authorized test account without these files to verify isolation. Do not grant that account access or move existing records.

Do not run live AI tests without approval. Default Multi-Source Agent questions can call Groq even if related questions used deterministic operations. Respect admission waits and quota errors; do not reset the ledger or repeatedly click Send. Do not automatically retry failures.

### Current application limitation

The current conservative SLA applicability gate rejects global dates/organizational restrictions without a generic mechanism to establish their relationship to CSV fields. **Adding those fields to this fixture does not implement that missing capability.** A positive combined question may therefore return insufficient evidence even though this answer key establishes what a fully capable evaluator should conclude. This task changes no application code to bypass the gate.

Maintenance exclusions and complete evidence may require multiple validated queries or statements. Existing per-statement citation limits still apply: split scope facts, eligibility and comparison into supported statements rather than dropping citations or weakening verification. The app may lack PDF page metadata; show real chunk indexes and page numbers only when actually returned.

## Local artifact checks (no providers/database)

Python 3 plus Poppler utilities (`pdfinfo`, `pdftotext`) are needed for these checks. Generation itself uses Python's standard library only.

```bash
python3 docs/fixtures/northstar-applicability-lab/validate.py
pdfinfo docs/fixtures/northstar-applicability-lab/Northstar_Applicability_Lab_Policy.pdf
pdftotext -layout docs/fixtures/northstar-applicability-lab/Northstar_Applicability_Lab_Policy.pdf -
```

To reproduce **only these new lab files**, run:

```bash
python3 docs/fixtures/northstar-applicability-lab/generate.py
python3 docs/fixtures/northstar-applicability-lab/validate.py
```

The generator overwrites only its named lab PDF, CSV, policy source and manifest in this directory. It does not connect to services. The validator independently reads CSV rows, applies scope/maintenance/deadline rules, compares against the separately authored answer key, checks hashes and verifies PDF page/text extraction. It does not import the generator or call the application.

## Verified status

Artifact checks passed: four searchable PDF pages, 25 uniquely identified CSV rows, known scope boundaries, 7 confirmed late first responses plus 1 unresolved in-scope response, and 14 late resolutions among known in-scope rows. These are fixture calculations only. Application execution, authenticated browser acceptance, live AI behavior and human semantic review are **Not Tested/Not Performed** for this new corpus.
