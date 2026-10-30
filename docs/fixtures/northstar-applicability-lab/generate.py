"""Build separate fictional QA artifacts using only Python's standard library.
Never connects to the application, database, or a provider.
"""
from pathlib import Path
import csv, hashlib, json, textwrap
ROOT = Path(__file__).resolve().parent
PDF = 'Northstar_Applicability_Lab_Policy.pdf'
CSV = 'Northstar_Applicability_Lab_Incidents.csv'
ORG = 'Northstar Fixture Operations'
PAGES = [
('1. Applicability and evidence', [
'Fictional QA fixture LAB-2026-v1. This is a separate test corpus, not a revision of any existing Northstar policy. No real organization, customer or person is represented.',
'This policy governs the companion dataset Northstar_Applicability_Lab_Incidents.csv only when the row satisfies BOTH conditions: organization equals Northstar Fixture Operations exactly; and incident_at is on or after 2026-10-01T00:00:00Z and before 2027-01-01T00:00:00Z.',
'The start boundary is inclusive. The end boundary is exclusive. incident_at is the UTC incident receipt timestamp. Do not use upload dates, file names, current dates or account ownership as a substitute for these fields.',
'A different known organization or a timestamp outside that interval is outside policy scope. A blank or invalid organization or incident_at means applicability is unknown. Do not infer missing values. Report unknown rows separately; do not call them compliant or noncompliant.',
'Apply scope first, then evaluate the individual response and resolution rules. All hours are elapsed wall-clock hours, not business hours. These rules have no department-specific or regional override.'
]),
('2. First response and resolution rules', [
'For in-scope incidents: P1 first-response deadline is 1 hour. P2 first-response deadline is 4 hours. P3 first-response deadline is 12 hours.',
'For in-scope incidents: P1 resolution deadline is 8 hours. P2 resolution deadline is 24 hours. P3 resolution deadline is 72 hours.',
'response_hours measures elapsed time from receipt to the first human response. resolution_hours measures elapsed time from receipt to resolution. The two measurements and deadlines are independent.',
'A measurement strictly greater than its deadline is late. A measurement exactly equal to the deadline is on time. A measurement below the deadline is on time. Excess equals actual hours minus the corresponding deadline.',
'Missing, nonnumeric or negative measurements and an unsupported severity require clarification for that metric. Never substitute resolution_hours for response_hours. Maintenance handling is defined on page 3.'
]),
('3. Maintenance exclusions and unrelated topics', [
'For an in-scope row, exclude it from FIRST-RESPONSE SLA scoring only if scheduled_maintenance is yes AND maintenance_notice_hours is a known nonnegative number at least 48. Exactly 48 hours qualifies.',
'If scheduled_maintenance is no, no maintenance exclusion applies. If it is yes but the known notice is below 48 hours, no exclusion applies and first-response scoring proceeds normally.',
'If scheduled_maintenance is yes and maintenance_notice_hours is blank or invalid, first-response exclusion eligibility is unknown. Do not infer eligibility from the incident summary. Report that row as unresolved for first response.',
'Maintenance NEVER exempts a row from the RESOLUTION deadline in this fixture. An unknown maintenance notice does not prevent resolution scoring if applicability, severity and resolution_hours are known.',
'Customer updates occur on material changes only. Audit reviews occur during business hours only. These two topic-specific restrictions do not change first-response or resolution deadlines.'
]),
('4. Reporting, references and uncertainty', [
'For each comparison include ticket_id, severity, actual hours, the applicable documented deadline, and the difference where requested. Cite the relevant PDF page and the CSV query result. Source markers and chunk IDs are assigned by the application and must never be invented.',
'Group confirmed violations by severity only after scope and metric-specific exclusions have been applied. Count tickets, not hours. The supplied CSV has unique ticket_id values; each row represents one incident.',
'Report outside-scope, unknown-applicability, maintenance-excluded and unknown-maintenance rows separately. Do not present a confirmed lower bound as a complete total when unresolved rows could change that total.',
'The fixture has one policy version and no precedence rule. If another active policy conflicts with it, do not choose the higher, newer-looking or stricter deadline. Request clarification or show explicitly conditional alternatives.',
'This policy and companion CSV explicitly establish a test relationship through organization and incident_at, not through semantic similarity. Questions about payroll, legal liability or missing incidents are unsupported. All examples are fictional.'
])]

def pdf_bytes():
    # Plain Type-1 PDF text preserves searchable original words and page boundaries.
    objects = [b'', b'']
    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    page_ids=[]
    def escape(s): return s.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
    for n,(heading,paragraphs) in enumerate(PAGES,1):
        lines=[f'Northstar Applicability Lab | Fictional Policy | Page {n} of 4', '', heading, '']
        for paragraph in paragraphs:
            lines += textwrap.wrap(paragraph, 90, break_long_words=False, break_on_hyphens=False) + ['']
        assert len(lines)<51
        commands=['BT /F1 11 Tf 14 TL 46 792 Td']
        commands += [f'({escape(line)}) Tj T*' for line in lines]
        commands += ['ET']
        stream='\n'.join(commands).encode('ascii')
        stream_id=len(objects)+1
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
        page_id=len(objects)+1;page_ids.append(page_id)
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
    objects[0]=b'<< /Type /Catalog /Pages 2 0 R >>'
    objects[1]=f'<< /Type /Pages /Count 4 /Kids [{" ".join(str(i)+" 0 R" for i in page_ids)}] >>'.encode()
    result=bytearray(b'%PDF-1.4\n');offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(result));result+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
    start=len(result);result+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    for off in offsets[1:]:result+=f'{off:010d} 00000 n \n'.encode()
    result+=f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()
    return bytes(result)

rows=[]
for severity,rd,sd in [('P1',1,8),('P2',4,24),('P3',12,72)]:
    samples=[(rd/2,sd/2,'no',0,'Routine incident'),(rd,sd,'no',0,'Exact deadline boundary'),(rd*1.5,sd+2,'no',0,'Late response and resolution'),(rd*2,sd+4,'yes',48,'Planned maintenance with sufficient notice'),(rd+0.5,sd+1,'yes',24,'Maintenance announced too late'),(rd*0.75,sd+1,'no',0,'Timely response but late resolution')]
    for response,resolution,flag,notice,summary in samples:
        i=len(rows)+1
        rows.append(dict(ticket_id=f'LAB-{i:03}',organization=ORG,incident_at=f'2026-10-{i+1:02}T09:00:00Z',region=['North','South','East','West'][(i-1)%4],severity=severity,response_hours=response,resolution_hours=resolution,scheduled_maintenance=flag,maintenance_notice_hours=notice,status='closed',summary=summary))
def extra(**changes):
    row=dict(rows[0]);row.update(ticket_id=f'LAB-{len(rows)+1:03}',summary='Applicability or uncertainty boundary');row.update(changes);rows.append(row)
extra(organization='Harbor Fictional Operations',response_hours=9,resolution_hours=99)
extra(severity='P2',incident_at='2026-09-30T23:59:59Z',response_hours=8,resolution_hours=48)
extra(severity='P3',incident_at='2026-10-01T00:00:00Z',response_hours=13,resolution_hours=73)
extra(incident_at='2027-01-01T00:00:00Z',response_hours=9,resolution_hours=99)
extra(organization='',response_hours=9,resolution_hours=99)
extra(severity='P2',incident_at='',response_hours=8,resolution_hours=48)
extra(severity='P3',response_hours=20,resolution_hours=100,scheduled_maintenance='yes',maintenance_notice_hours='')
(ROOT/PDF).write_bytes(pdf_bytes())
with (ROOT/CSV).open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
(ROOT/'policy-source.md').write_text('# Northstar Applicability Lab Policy\n\n'+'\n\n'.join(f'## PDF page {n}: {heading}\n\n'+'\n\n'.join(paragraphs) for n,(heading,paragraphs) in enumerate(PAGES,1))+'\n')
manifest={'fixture':'LAB-2026-v1','fictional':True,'csv_rows':len(rows),'pdf_pages':len(PAGES),'files':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in [PDF,CSV,'policy-source.md']}}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'created':list(manifest['files']),'rows':len(rows),'pages':len(PAGES)}))
if __name__ != '__main__': raise RuntimeError('Run as a standalone fixture generator')
