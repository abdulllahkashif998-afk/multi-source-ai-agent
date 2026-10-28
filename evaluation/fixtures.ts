export type Category='document'|'csv'|'combined'|'insufficient'|'ambiguous';
export type System='chat'|'agent';
export type Corpus='base'|'conflict'|'ambiguous';
export interface NumericFact {label:string;value:number;tolerance:number;pattern:string}
export interface EvalCase {
 id:string;category:Category;system:System;corpus:Corpus;question:string;
 relevantChunks:string[];expectedSources:string[];refuse:boolean;
 expectedAnswer:string;facts:NumericFact[];reviewNotes:string;
 plan?:Record<string,unknown>;expectedRows?:Record<string,unknown>[];
}
export const owner='900001',foreignOwner='900002';
export const documents=[
 {id:'1',chunkId:'101',filename:'team-policy.docx',index:0,page:null,text:'Orion team policy: the minimum monthly total sales target for each team is 15 units.'},
 {id:'2',chunkId:'102',filename:'leave-policy.pdf',index:0,page:2,text:'Orion employees receive 20 days of annual paid leave per calendar year.'},
 {id:'3',chunkId:'103',filename:'returns-policy.pdf',index:0,page:1,text:'Unopened equipment may be returned within 30 days of delivery.'},
 {id:'4',chunkId:'104',filename:'travel-policy.docx',index:0,page:null,text:'Travel expenses above 500 credits require manager approval.'},
 {id:'5',chunkId:'105',filename:'incident-policy.docx',index:0,page:null,text:'A service incident must be acknowledged within 2 hours.'},
 {id:'6',chunkId:'106',filename:'invoice-register.pdf',index:0,page:3,text:'Invoice ZX-2048 is approved for the fictional Harbor project.'},
 {id:'7',chunkId:'107',filename:'revised-team-policy.docx',index:0,page:null,text:'Orion team policy: the minimum monthly total sales target for each team is 22 units. This policy has no effective date.'},
 {id:'8',chunkId:'108',filename:'other-department-policy.docx',index:0,page:null,text:'The North department monthly team sales target is 18 units. The South department monthly team sales target is 25 units.'},
 {id:'9',chunkId:'109',filename:'office-guide.docx',index:0,page:null,text:'The fictional office has blue chairs and a library open on weekdays.'},
] as const;
export const salesCSV='team,amount,region\nAlpha,10,East\nAlpha,20,East\nBeta,6,West\nGamma,9,West\nGamma,6,West\n';
export const expensesCSV='employee,cost\nMira,450\nJon,620\nSol,500\n';
export const incidentsCSV='ticket,hours\nINC-A,1\nINC-B,3\nINC-C,2\n';
export const datasets=[{id:'201',filename:'sales.csv',csv:salesCSV},{id:'202',filename:'expenses.csv',csv:expensesCSV},{id:'203',filename:'incidents.csv',csv:incidentsCSV}] as const;
export const groupedSales=[{team:'Alpha',value:30},{team:'Beta',value:6},{team:'Gamma',value:15}];
const number=(label:string,value:number,pattern:string):NumericFact=>({label,value,tolerance:0.000001,pattern});
const doc=(n:number,key:number,question:string,answer:string,facts:NumericFact[]):EvalCase=>({id:`doc-${n.toString().padStart(2,'0')}`,category:'document',system:'chat',corpus:'base',question,relevantChunks:[String(100+key)],expectedSources:[`doc:${key}:${100+key}`],refuse:false,expectedAnswer:answer,facts,reviewNotes:'Review whether the prose states the policy correctly, including conditions, units and scope.'});
const csv=(n:number,datasetId:string,question:string,answer:string,plan:Record<string,unknown>,rows:Record<string,unknown>[],facts:NumericFact[]):EvalCase=>({id:`csv-${n.toString().padStart(2,'0')}`,category:'csv',system:'agent',corpus:'base',question,relevantChunks:[],expectedSources:[`csv:${datasetId}`],refuse:false,expectedAnswer:answer,facts,plan:{datasetId,...plan},expectedRows:rows,reviewNotes:'Review calculation meaning, filters, groups and whether the answer overstates limited evidence.'});
const combined=(n:number,docId:number,datasetId:string,question:string,answer:string,plan:Record<string,unknown>,rows:Record<string,unknown>[],facts:NumericFact[]):EvalCase=>({...csv(n,datasetId,question,answer,plan,rows,facts),id:`combined-${n.toString().padStart(2,'0')}`,category:'combined',relevantChunks:[String(100+docId)],expectedSources:[`doc:${docId}:${100+docId}`,`csv:${datasetId}`],reviewNotes:'Manually verify the comparison, boundary conditions and that both policy and actual data support the conclusion.'});
export const cases:EvalCase[]=[
 doc(1,1,'What is the minimum monthly sales target for a team?', 'The minimum monthly team total sales target is 15 units.',[number('target',15,'(?:target|minimum)[^.!?\\n]{0,70}?(-?\\d+(?:\\.\\d+)?)')]),
 doc(2,2,'How many paid vacation days does an Orion employee get each year?', 'The annual paid leave allowance is 20 days.',[number('leave allowance',20,'(?:allowance|leave|receive)[^.!?\\n]{0,50}?(-?\\d+(?:\\.\\d+)?)')]),
 doc(3,3,'How long after delivery can unopened equipment be sent back?', 'Unopened equipment may be returned within 30 days of delivery.',[number('return window',30,'(?:within|window)[^.!?\\n]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 doc(4,4,'At what travel expense amount is manager sign-off required?', 'Travel expenses above 500 credits require manager approval.',[number('approval threshold',500,'(?:above|threshold)[^.!?\\n]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 doc(5,5,'What is the acknowledgment deadline for a service incident?', 'A service incident must be acknowledged within 2 hours.',[number('acknowledgment deadline',2,'(?:within|deadline)[^.!?\\n]{0,40}?(-?\\d+(?:\\.\\d+)?)')]),
 doc(6,6,'Tell me the recorded approval status of ZX-2048.', 'Invoice ZX-2048 is approved for the Harbor project.',[]),
 csv(1,'201','How many sales records are in sales.csv?', 'The sales record count is 5.',{aggregate:{op:'count'}},[{value:5}],[number('record count',5,'(?:count|records)[^.!?\\n]{0,40}?(-?\\d+(?:\\.\\d+)?)')]),
 csv(2,'201','Add up all amounts in sales.csv.', 'The total sales amount is 51 units.',{aggregate:{op:'sum',column:'amount'}},[{value:51}],[number('total',51,'(?:total|amount)[^.!?\\n]{0,40}?(-?\\d+(?:\\.\\d+)?)')]),
 csv(3,'201','What is the average amount per sales record?', 'The average sales amount is 10.2 units.',{aggregate:{op:'avg',column:'amount'}},[{value:10.2}],[number('mean',10.2,'(?:average|mean)[^!?\\n]{0,40}?(-?\\d+(?:\\.\\d+)?)')]),
 csv(4,'201','Show total sales for Alpha, Beta and Gamma, grouped by team.', 'Alpha total is 30 units; Beta total is 6 units; Gamma total is 15 units.',{aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'}},groupedSales,[number('Alpha',30,'Alpha[^.!?\\n;]{0,40}?(-?\\d+(?:\\.\\d+)?)'),number('Beta',6,'Beta[^.!?\\n;]{0,40}?(-?\\d+(?:\\.\\d+)?)'),number('Gamma',15,'Gamma[^.!?\\n;]{0,40}?(-?\\d+(?:\\.\\d+)?)')]),
 csv(5,'201','List the East-region sales amounts, largest first.', 'East amounts in descending order are 20 and 10 units.',{filters:[{column:'region',op:'eq',value:'East'}],sort:{column:'amount',direction:'desc'}},[{team:'Alpha',amount:20,region:'East'},{team:'Alpha',amount:10,region:'East'}],[]),
 csv(6,'202','How many employees have expenses strictly above 500 credits?', 'The employee expense count above 500 credits is 1.',{filters:[{column:'cost',op:'gt',value:500}],aggregate:{op:'count'}},[{value:1}],[number('expense count',1,'count[^.!?\\n]{0,60}?is\\s+(-?\\d+(?:\\.\\d+)?)')]),
 combined(1,1,'201','Compare team totals with the policy minimum. How far below is Beta?', 'Beta total is 6 units; the target is 15 units; Beta shortfall is 9 units.',{aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'}},groupedSales,[number('Beta total',6,'Beta total[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)'),number('Beta shortfall',9,'shortfall[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 combined(2,1,'201','Using the team policy and sales.csv, by how much does Alpha exceed the target?', 'Alpha total is 30 units; the target is 15 units; Alpha surplus is 15 units.',{aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'}},groupedSales,[number('Alpha total',30,'Alpha total[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)'),number('Alpha surplus',15,'surplus[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 combined(3,1,'201','Does Gamma meet the minimum monthly team total exactly?', 'Gamma total is 15 units, exactly the target; Gamma difference is 0 units.',{aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'}},groupedSales,[number('Gamma total',15,'Gamma total[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)'),number('difference',0,'difference[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 combined(4,1,'201','According to the policy, which teams fall short when all sales rows are added per team?', 'Only Beta falls short: Beta total is 6 units and Beta shortfall is 9 units. Alpha and Gamma meet the target.',{aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'}},groupedSales,[number('Beta shortfall',9,'shortfall[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 combined(5,4,'202','Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded?', 'Only Jon needs approval: Jon cost is 620 credits; the threshold is 500 credits; Jon excess is 120 credits. Sol at exactly 500 does not require approval.',{},[{employee:'Mira',cost:450},{employee:'Jon',cost:620},{employee:'Sol',cost:500}],[number('Jon cost',620,'Jon cost[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)'),number('excess',120,'excess[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 combined(6,5,'203','Using the incident acknowledgment policy and incidents.csv, which ticket missed the deadline?', 'INC-B missed the deadline: INC-B hours is 3; the deadline is 2 hours; INC-B delay is 1 hour. INC-A and INC-C meet the deadline.',{},[{ticket:'INC-A',hours:1},{ticket:'INC-B',hours:3},{ticket:'INC-C',hours:2}],[number('late hours',3,'INC-B hours[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)'),number('delay',1,'delay[^.!?\\n;]{0,30}?(-?\\d+(?:\\.\\d+)?)')]),
 ...[
  ['missing-01','chat','What ocean research grants does Orion offer?'],
  ['missing-02','agent','What were team sales last year? The provided sales data has no year column.'],
  ['missing-03','agent','What is the average customer age in sales.csv?'],
  ['missing-04','chat','What is Orion’s parental leave allowance?'],
 ].map(([id,system,question])=>({id,system:system as System,question,category:'insufficient' as const,corpus:'base' as const,relevantChunks:[],expectedSources:[],refuse:true,expectedAnswer:'Abstain: the fixtures do not contain the requested facts.',facts:[],reviewNotes:'Check that absence is not converted into invented facts or zero values.'})),
 ...[
  ['conflict-01','conflict','Which minimum monthly target should we use when the two active Orion policies disagree?',['101','107']],
  ['conflict-02','conflict','Do the sales teams meet policy when one active policy says 15 and another says 22 with no effective dates?',['101','107']],
  ['ambiguous-01','ambiguous','What monthly team target applies to me? My department is not specified.',['108']],
 ].map(([id,corpus,question,chunks])=>({id:id as string,category:'ambiguous' as const,system:'agent' as const,corpus:corpus as Corpus,question:question as string,relevantChunks:chunks as string[],expectedSources:[],refuse:true,expectedAnswer:'Abstain or request clarification; do not silently select a policy or department.',facts:[],reviewNotes:'Manual review required: confirm conflicts/ambiguity were recognized rather than ignored.'})),
];
export function corpusDocuments(corpus:Corpus){return documents.filter(d=>d.id!=='7'&&d.id!=='8'||corpus==='conflict'&&d.id==='7'||corpus==='ambiguous'&&d.id==='8');}
export function relevantSource(c:EvalCase){return c.relevantChunks.map(id=>documents.find(d=>d.chunkId===id)!).filter(Boolean);}
