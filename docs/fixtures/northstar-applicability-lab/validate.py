"""Independent artifact checks: reads CSV/key; does not import the generator.
This validates fixture arithmetic, NOT application or model behavior.
"""
import csv, json, hashlib, subprocess
from datetime import datetime, timezone
from collections import Counter, defaultdict
from pathlib import Path
p=Path(__file__).resolve().parent
key=json.loads((p/'answer-key.json').read_text())
rows=list(csv.DictReader((p/'Northstar_Applicability_Lab_Incidents.csv').open()))
assert len(rows)==25 and len({r['ticket_id'] for r in rows})==25
begin=datetime(2026,10,1,tzinfo=timezone.utc);end=datetime(2027,1,1,tzinfo=timezone.utc)
scopes={k:[] for k in ['in_scope','outside_scope','unknown']}
responses={k:[] for k in ['on_time','maintenance_excluded','unknown_maintenance']};late=defaultdict(list);resolution_late=defaultdict(list);resolution_on=[];equal=[]
for r in rows:
    incident=datetime.fromisoformat(r['incident_at'].replace('Z','+00:00')) if r['incident_at'] else None
    scope='outside_scope' if (r['organization'] and r['organization']!='Northstar Fixture Operations') or (incident and not begin<=incident<end) else 'unknown' if not r['organization'] or incident is None else 'in_scope'
    scopes[scope].append(r['ticket_id'])
    if scope!='in_scope':continue
    priority=r['severity'];response=float(r['response_hours']);resolution=float(r['resolution_hours'])
    rd={'P1':1,'P2':4,'P3':12}[priority];sd={'P1':8,'P2':24,'P3':72}[priority]
    if r['scheduled_maintenance']=='yes' and not r['maintenance_notice_hours']:responses['unknown_maintenance'].append(r['ticket_id'])
    elif r['scheduled_maintenance']=='yes' and float(r['maintenance_notice_hours'])>=48:responses['maintenance_excluded'].append(r['ticket_id'])
    elif response>rd:late[priority].append(r['ticket_id'])
    else:responses['on_time'].append(r['ticket_id'])
    if resolution>sd:resolution_late[priority].append(r['ticket_id'])
    else:resolution_on.append(r['ticket_id'])
    if response==rd and resolution==sd:equal.append(r['ticket_id'])
assert scopes==key['scope']
assert dict(late)==key['first_response']['late']
for k,v in responses.items():assert v==key['first_response'][k],k
assert sum(map(len,late.values()))==key['first_response']['confirmed_late_count']
assert dict(resolution_late)==key['resolution']['late']
assert resolution_on==key['resolution']['on_time']
assert sum(map(len,resolution_late.values()))==key['resolution']['late_count']
assert equal==key['equal_both_deadlines']
for field in ['region','severity']:assert dict(Counter(r[field] for r in rows))==key['csv_only_counts'][field]
manifest=json.loads((p/'manifest.json').read_text())
for file,expected in manifest['files'].items():assert hashlib.sha256((p/file).read_bytes()).hexdigest()==expected
text=subprocess.check_output(['pdftotext','-layout',str(p/'Northstar_Applicability_Lab_Policy.pdf'),'-']).decode()
pages=[part for part in text.split('\f') if part.strip()]
assert len(pages)==4
assert all(f'Page {n} of 4' in page for n,page in enumerate(pages,1))
assert '2026-10-01T00:00:00Z' in pages[0] and '2027-01-01T00:00:00Z' in pages[0]
assert 'P2 first-response deadline is 4 hours' in ' '.join(pages[1].split())
assert 'Maintenance NEVER exempts' in pages[2]
assert 'unknown' in pages[3]
print(json.dumps({'artifact_validation':'passed','csv_rows':len(rows),'pdf_pages':len(pages),'in_scope':len(scopes['in_scope']),'outside_scope':len(scopes['outside_scope']),'unknown_scope':len(scopes['unknown']),'confirmed_response_late':sum(map(len,late.values())),'unknown_response':len(responses['unknown_maintenance']),'resolution_late':sum(map(len,resolution_late.values())),'application_tests':'not run','live_ai_calls':0},indent=2))
