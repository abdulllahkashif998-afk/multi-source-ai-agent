# Northstar Applicability Lab Policy

## PDF page 1: 1. Applicability and evidence

Fictional QA fixture LAB-2026-v1. This is a separate test corpus, not a revision of any existing Northstar policy. No real organization, customer or person is represented.

This policy governs the companion dataset Northstar_Applicability_Lab_Incidents.csv only when the row satisfies BOTH conditions: organization equals Northstar Fixture Operations exactly; and incident_at is on or after 2026-10-01T00:00:00Z and before 2027-01-01T00:00:00Z.

The start boundary is inclusive. The end boundary is exclusive. incident_at is the UTC incident receipt timestamp. Do not use upload dates, file names, current dates or account ownership as a substitute for these fields.

A different known organization or a timestamp outside that interval is outside policy scope. A blank or invalid organization or incident_at means applicability is unknown. Do not infer missing values. Report unknown rows separately; do not call them compliant or noncompliant.

Apply scope first, then evaluate the individual response and resolution rules. All hours are elapsed wall-clock hours, not business hours. These rules have no department-specific or regional override.

## PDF page 2: 2. First response and resolution rules

For in-scope incidents: P1 first-response deadline is 1 hour. P2 first-response deadline is 4 hours. P3 first-response deadline is 12 hours.

For in-scope incidents: P1 resolution deadline is 8 hours. P2 resolution deadline is 24 hours. P3 resolution deadline is 72 hours.

response_hours measures elapsed time from receipt to the first human response. resolution_hours measures elapsed time from receipt to resolution. The two measurements and deadlines are independent.

A measurement strictly greater than its deadline is late. A measurement exactly equal to the deadline is on time. A measurement below the deadline is on time. Excess equals actual hours minus the corresponding deadline.

Missing, nonnumeric or negative measurements and an unsupported severity require clarification for that metric. Never substitute resolution_hours for response_hours. Maintenance handling is defined on page 3.

## PDF page 3: 3. Maintenance exclusions and unrelated topics

For an in-scope row, exclude it from FIRST-RESPONSE SLA scoring only if scheduled_maintenance is yes AND maintenance_notice_hours is a known nonnegative number at least 48. Exactly 48 hours qualifies.

If scheduled_maintenance is no, no maintenance exclusion applies. If it is yes but the known notice is below 48 hours, no exclusion applies and first-response scoring proceeds normally.

If scheduled_maintenance is yes and maintenance_notice_hours is blank or invalid, first-response exclusion eligibility is unknown. Do not infer eligibility from the incident summary. Report that row as unresolved for first response.

Maintenance NEVER exempts a row from the RESOLUTION deadline in this fixture. An unknown maintenance notice does not prevent resolution scoring if applicability, severity and resolution_hours are known.

Customer updates occur on material changes only. Audit reviews occur during business hours only. These two topic-specific restrictions do not change first-response or resolution deadlines.

## PDF page 4: 4. Reporting, references and uncertainty

For each comparison include ticket_id, severity, actual hours, the applicable documented deadline, and the difference where requested. Cite the relevant PDF page and the CSV query result. Source markers and chunk IDs are assigned by the application and must never be invented.

Group confirmed violations by severity only after scope and metric-specific exclusions have been applied. Count tickets, not hours. The supplied CSV has unique ticket_id values; each row represents one incident.

Report outside-scope, unknown-applicability, maintenance-excluded and unknown-maintenance rows separately. Do not present a confirmed lower bound as a complete total when unresolved rows could change that total.

The fixture has one policy version and no precedence rule. If another active policy conflicts with it, do not choose the higher, newer-looking or stricter deadline. Request clarification or show explicitly conditional alternatives.

This policy and companion CSV explicitly establish a test relationship through organization and incident_at, not through semantic similarity. Questions about payroll, legal liability or missing incidents are unsupported. All examples are fictional.
