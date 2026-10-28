// Independent in-memory oracle. Never compiles SQL or calls the production query executor.
import {parse} from 'csv-parse/sync';
import {planSchema} from '../src/lib/csv-query-schema';
import {datasets} from './fixtures';
type Row=Record<string,string|number|boolean|null>;
export function oracleQuery(input:unknown):Row[]{
 const p=planSchema.parse(input),dataset=datasets.find(d=>d.id===p.datasetId);
 if(!dataset)throw Error('Unknown fixture dataset');
 const records=parse(dataset.csv,{columns:true,skip_empty_lines:true}) as Record<string,string>[];
 const names=Object.keys(records[0]);
 const types=Object.fromEntries(names.map(n=>[n,records.every(r=>/^-?\d+(\.\d+)?$/.test(r[n]))?'number':records.every(r=>['true','false'].includes(r[n]))?'boolean':'string']));
 const check=(n:string)=>{if(!names.includes(n))throw Error('Unknown fixture column');};
 let rows:Row[]=records.map(r=>Object.fromEntries(names.map(n=>[n,r[n]===''?null:types[n]==='number'?Number(r[n]):types[n]==='boolean'?r[n]==='true':r[n]])));
 for(const f of p.filters){check(f.column);if(typeof f.value!==types[f.column]||(types[f.column]==='boolean'&&!['eq','ne'].includes(f.op)))throw Error('Invalid fixture filter');
 rows=rows.filter(r=>{const a=r[f.column],b=f.value;if(a===null)return false;switch(f.op){case 'eq':return a===b;case 'ne':return a!==b;case 'gt':return a>b;case 'gte':return a>=b;case 'lt':return a<b;case 'lte':return a<=b;}});}
 const groups=[...new Set(p.groupBy)];groups.forEach(check);
 if(groups.length&&!p.aggregate)throw Error('Grouping requires aggregate');
 if(p.aggregate){const a=p.aggregate;if(groups.includes('value'))throw Error('Reserved output');
 if(a.op==='count'){if(a.column)throw Error('Count column unsupported');}else{if(!a.column)throw Error('Numeric column required');check(a.column);if(types[a.column]!=='number')throw Error('Numeric column required');}
 const buckets=new Map<string,Row[]>();for(const row of rows){const key=JSON.stringify(groups.map(g=>row[g]));buckets.set(key,[...(buckets.get(key)??[]),row]);}
 if(!groups.length&&!buckets.size)buckets.set('[]',[]);
 rows=[...buckets.values()].map(bucket=>{const values=a.column?bucket.map(r=>r[a.column!]).filter((v):v is number=>typeof v==='number'):[];const sum=values.reduce((s,v)=>s+v,0);return {...Object.fromEntries(groups.map(g=>[g,bucket[0][g]])),value:a.op==='count'?bucket.length:!values.length?null:a.op==='sum'?sum:sum/values.length};});
 }
 if(p.sort){const s=p.sort;if(p.aggregate?![...groups,'value'].includes(s.column):!names.includes(s.column))throw Error('Invalid sort');rows.sort((a,b)=>{const x=a[s.column],y=b[s.column];const cmp=x===y?0:x===null?1:y===null?-1:x<y?-1:1;return s.direction==='asc'?cmp:-cmp;});}
 return rows.slice(0,p.limit);
}
function close(a:unknown,b:unknown):boolean{
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Math.abs(a-b)<=1e-6;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>close(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&close(x[k],y[k]));}
 return a===b;
}
export function sameRows(actual:unknown[],expected:unknown[],ordered:boolean){
 if(ordered)return close(actual,expected);
 const remaining=[...expected];for(const row of actual){const i=remaining.findIndex(other=>close(row,other));if(i<0)return false;remaining.splice(i,1);}return remaining.length===0;
}

// Derived independently from fixture rows, not from answer text or the expected fact values.
export function independentCombinedFacts(caseId:string):Record<string,number>|null{
 const sales=oracleQuery({datasetId:'201',aggregate:{op:'sum',column:'amount'},groupBy:['team']});
 const total=(team:string)=>Number(sales.find(r=>r.team===team)!.value),target=15;
 switch(caseId){
 case 'combined-01':return {'Beta total':total('Beta'),'Beta shortfall':target-total('Beta')};
 case 'combined-02':return {'Alpha total':total('Alpha'),'Alpha surplus':total('Alpha')-target};
 case 'combined-03':return {'Gamma total':total('Gamma'),'difference':total('Gamma')-target};
 case 'combined-04':return {'Beta shortfall':target-total('Beta')};
 case 'combined-05':{const jon=Number(oracleQuery({datasetId:'202',filters:[{column:'employee',op:'eq',value:'Jon'}]})[0].cost);return {'Jon cost':jon,excess:jon-500};}
 case 'combined-06':{const hours=Number(oracleQuery({datasetId:'203',filters:[{column:'ticket',op:'eq',value:'INC-B'}]})[0].hours);return {'late hours':hours,delay:hours-2};}
 default:return null;
 }
}
