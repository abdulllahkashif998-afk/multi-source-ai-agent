import {cases,documents,type EvalCase,owner,foreignOwner} from './fixtures';
export interface RetrievalDocument {id:string;chunkId:string;filename:string;index:number;page:number|null;text:string;userId?:string;status?:'ready'|'deleted'|'processing'|'superseded'}
export const baselineDecoys:RetrievalDocument[]=[{...documents[0],id:'91',chunkId:'191',userId:foreignOwner,status:'ready'},{...documents[0],id:'92',chunkId:'192',userId:owner,status:'deleted'},{...documents[0],id:'93',chunkId:'193',userId:owner,status:'processing'}];
// Additions only: the original 25 benchmark definitions are unchanged.
export const retrievalDocuments:RetrievalDocument[]=[
 {id:'1001',chunkId:'2001',filename:'invoice-qx7841.pdf',index:0,page:1,text:'Invoice QX-7841 for the fictional Cedar project is pending finance review. It is not approved.'},
 {id:'1002',chunkId:'2002',filename:'invoice-qx7842.pdf',index:0,page:1,text:'Invoice QX-7842 for the fictional Cedar project is approved for payment.'},
 {id:'1003',chunkId:'2003',filename:'invoice-qx7843.pdf',index:0,page:1,text:'Invoice QX-7843 for the fictional Cedar project is rejected because the purchase order is missing.'},
 {id:'1004',chunkId:'2004',filename:'invoice-register-guide.docx',index:0,page:null,text:'The finance invoice register records whether each invoice is approved, pending review or rejected. Ask finance for invoice approval status.'},
 {id:'1005',chunkId:'2005',filename:'restore-runbook.docx',index:0,page:null,text:'Runbook CRON-Z7P9 requires restoring a snapshot and verifying its checksum before resuming the nightly archive task.'},
 {id:'1006',chunkId:'2006',filename:'archive-guide.docx',index:0,page:null,text:'The nightly archive task saves snapshots, checks job status, records checksums and reports failures to operations.'},
 {id:'1007',chunkId:'2007',filename:'travel-advance-policy.docx',index:0,page:null,text:'Travel cash advances above 300 credits require finance approval before booking.'},
 {id:'1008',chunkId:'2008',filename:'equipment-approval-policy.docx',index:0,page:null,text:'Equipment purchases above 500 credits require manager approval. Travel expenses follow the separate travel policy.'},
 {id:'1009',chunkId:'2009',filename:'contractor-time-off.docx',index:0,page:null,text:'Independent contractors have no paid annual leave allowance under the Orion employee policy.'},
 {id:'1010',chunkId:'2010',filename:'repair-policy.pdf',index:0,page:2,text:'Opened equipment sent for repair is normally returned to the customer within 45 days. This is not the unopened equipment return window.'},
 {id:'1011',chunkId:'2011',filename:'service-resolution-policy.docx',index:0,page:null,text:'A service incident must be resolved within 24 hours. The acknowledgment deadline is a separate requirement.'},
 {id:'1012',chunkId:'2012',filename:'sales-forecast-guide.docx',index:0,page:null,text:'Sales forecasts are planning estimates, not minimum monthly team sales targets. Forecasts do not determine team compliance.'},
 {id:'1013',chunkId:'2013',filename:'north-policy.docx',index:0,page:null,text:'The North department monthly team sales target is 18 units.'},
 {id:'1014',chunkId:'2014',filename:'south-policy.docx',index:0,page:null,text:'The South department monthly team sales target is 25 units.'},
 {id:'1015',chunkId:'2015',filename:'tenant-secret.docx',index:0,page:null,text:'The fictional ZETA-TENANT-77 recovery password rotation period is 11 days.',userId:foreignOwner},
 {id:'1016',chunkId:'2016',filename:'retired-plan.docx',index:0,page:null,text:'The fictional ARCHIVE-DROP-44 retention period is 99 days.',status:'deleted'},
 {id:'1017',chunkId:'2017',filename:'draft-plan.docx',index:0,page:null,text:'DRAFT-UNPUBLISHED-9 permits a fictional 81 day return window.',status:'processing'},
 {id:'1018',chunkId:'2018',filename:'superseded-plan.docx',index:0,page:null,text:'LEGACY-TARGET-66 sets the fictional team target to 66 units.',status:'superseded'},
];
export interface RetrievalCase {id:string;cohort:'original'|'stress';fixture:EvalCase;tags:string[];userId:string;labelNotes:string}
function added(id:string,question:string,gold:string[],tags:string[],notes:string,userId=owner):RetrievalCase{return {id,cohort:'stress',fixture:{id,category:gold.length?'document':'insufficient',system:'chat',corpus:'base',question,relevantChunks:gold,expectedSources:[],refuse:!gold.length,expectedAnswer:'Retrieval-only labelled question; no answer generation.',facts:[],reviewNotes:notes},tags,userId,labelNotes:notes};}
export const retrievalCases:RetrievalCase[]=[
 ...cases.filter(c=>c.category!=='csv').map(c=>({id:c.id,cohort:'original' as const,fixture:c,userId:owner,tags:c.category==='insufficient'?['irrelevant']:c.category==='ambiguous'?['overlap','label-review']:c.id==='doc-06'?['identifier']:c.id==='doc-01'?['exact']:['paraphrase'],labelNotes:c.id==='ambiguous-01'?'Original gold is only chunk 108. General Orion policy 101 may also be useful context; retain original label and flag for review.':c.category==='insufficient'?'No source answers the complete question. Nearest-neighbor candidates are not automatically hallucinated answers.':c.reviewNotes})),
 added('ret-01','What is the approval status of invoice QX-7841?',['2001'],['identifier','overlap'],'Only the exact invoice is relevant; generic invoice guidance and adjacent identifiers cannot establish its status.'),
 added('ret-02','Is QX-7842 approved for payment?',['2002'],['identifier','overlap'],'Adjacent QX identifiers have different statuses and are hard negatives.'),
 added('ret-03','Why was invoice QX-7843 rejected?',['2003'],['identifier','overlap'],'Only this invoice states the missing-purchase-order reason.'),
 added('ret-04','QX-7841',['2001'],['identifier','exact'],'Identifier-only query, without generic finance/approval words.'),
 added('ret-05','What must happen before resuming the archive task in CRON-Z7P9?',['2005'],['identifier','overlap'],'The runbook, not the generic archive guide, gives the prerequisites.'),
 added('ret-06','How much paid time away from work can a salaried employee take each year?',['102'],['paraphrase','overlap'],'Employee leave allowance, not contractor policy, answers the amount.'),
 added('ret-07','How soon should staff confirm they have seen a service outage?',['105'],['paraphrase','overlap'],'Acknowledgment differs from resolution time.'),
 added('ret-08','When do business trip costs need a supervisor to sign off?',['104'],['paraphrase','overlap'],'Expenses use the 500-credit manager rule, not the cash-advance rule.'),
 added('ret-09','How long do I have to send back unused, unopened equipment after it arrives?',['103'],['paraphrase','overlap'],'Return window differs from repair turnaround.'),
 added('ret-10','What limit applies to travel cash advances before booking?',['2007'],['exact','overlap'],'Finance approval for advances above 300 differs from expense approval.'),
 added('ret-11','Which amount triggers manager approval for equipment purchases?',['2008'],['exact','overlap'],'Equipment purchases differ from travel expenses even though both use 500.'),
 added('ret-12','What is the monthly team sales target for the South department?',['2014'],['exact','overlap'],'South-specific 25 units; general Orion and North policy are hard negatives.'),
 added('ret-13','Compare the North and South department monthly team targets.',['2013','2014'],['overlap'],'Both department policies are required; finding only one gives partial recall.'),
 added('ret-14','What is the capital city of the fictional country Lumoria?',[],['irrelevant'],'No fixture contains a country or capital.'),
 added('ret-15','Does the office provide paid lunar tourism and ocean exploration grants?',[],['irrelevant','overlap'],'Office/paid vocabulary overlaps but no source supports these benefits.'),
 added('ret-16','What is the ZETA-TENANT-77 rotation period?',[],['ownership','identifier'],'Only another owner has this canary; no authorized relevant chunk.'),
 added('ret-17','What is the ARCHIVE-DROP-44 retention period?',[],['ownership','identifier'],'Deleted document must remain excluded.'),
 added('ret-18','What return window does DRAFT-UNPUBLISHED-9 permit?',[],['ownership','identifier','overlap'],'Processing document must remain excluded despite exact keyword match.'),
 added('ret-19','What is the LEGACY-TARGET-66 team target?',[],['ownership','identifier','overlap'],'Superseded document must remain excluded.'),
 added('ret-20','What is the ZETA-TENANT-77 rotation period?',['2015'],['ownership','identifier'],'Positive control: the authorized owner must be able to retrieve the foreign canary.',foreignOwner),
];
