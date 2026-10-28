# Fictional document fixtures

These small files contain fictional QA text only. They contain no customer data, credentials, macros or external resources.

- `fictional-policy.pdf` and `fictional-policy.docx`: minimum team sales target is 15 units; exercise the real PDF/DOCX parsers.
- `fictional-policy-v2.docx`: revised wording with the same 15-unit target; different bytes allow explicit replacement/versioning tests without colliding with the active document hash.

The PDF uses a single page and Helvetica text. The DOCX files contain a minimal standard OOXML ZIP structure. Do not substitute real user documents.
