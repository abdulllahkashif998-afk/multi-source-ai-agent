import path from 'node:path';
import {cases,type System} from './fixtures';
export function parseOptions(args:string[],environment:Record<string,string|undefined>=process.env){
 const allowed=new Set(['--mode','--cases','--limit','--out','--k','--retrieval','--document-system']);const values=new Map<string,string>();
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];if(!allowed.has(flag)||!value||value.startsWith('--')||values.has(flag))throw Error('Invalid evaluation arguments');values.set(flag,value);}
 const mode=values.get('--mode')??'mock';if(!['mock','retrieval','live'].includes(mode))throw Error('Invalid evaluation mode');
 if(mode==='live'&&(environment.ALLOW_LIVE_AI_EVAL!=='1'||!values.has('--cases')))throw Error('Live evaluation requires ALLOW_LIVE_AI_EVAL=1 and explicit --cases');
 const names=values.has('--cases')?values.get('--cases')!.split(','):cases.filter(c=>mode!=='retrieval'||c.category!=='csv').map(c=>c.id);if(new Set(names).size!==names.length||names.some(id=>!cases.some(c=>c.id===id)))throw Error('Invalid evaluation case selection');
 if(mode==='retrieval'&&names.some(id=>cases.find(c=>c.id===id)?.category==='csv'))throw Error('CSV-only cases have no document retrieval labels');
 const limit=Number(values.get('--limit')??(mode==='live'?1:names.length)),k=Number(values.get('--k')??3),retrieval=values.get('--retrieval')??'hybrid',system=values.get('--document-system')??'chat';
 if(!Number.isInteger(limit)||limit<1||limit>cases.length||!Number.isInteger(k)||k<1||k>3||!['semantic','hybrid'].includes(retrieval)||!['chat','agent'].includes(system))throw Error('Invalid evaluation bounds');
 const directory=path.resolve(values.get('--out')??`.evaluation-results/${mode}`);const roots=[path.resolve('.evaluation-results'),path.resolve('docs/evaluation')];if(!roots.some(root=>directory===root||directory.startsWith(root+path.sep)))throw Error('Evaluation output must be under .evaluation-results or docs/evaluation');
 return {mode:mode as 'mock'|'retrieval'|'live',selected:names.slice(0,limit).map(id=>{const c=cases.find(c=>c.id===id)!;return {...c,system:c.category==='document'?system as System:c.system};}),k,retrieval:retrieval as 'semantic'|'hybrid',directory};
}
