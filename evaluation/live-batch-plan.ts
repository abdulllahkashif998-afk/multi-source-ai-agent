import {cases} from './fixtures';
import {fixtureHash} from './answer-quality';
export const BATCH_TWO_IDS=['doc-02','csv-02','combined-02','missing-01','conflict-01'] as const;
export function nextLiveBatch(completed:readonly string[],savedFixtureHash:string){
 if(savedFixtureHash!==fixtureHash)throw Error('Saved benchmark hash differs');
 if(new Set(completed).size!==completed.length||completed.some(id=>!cases.some(c=>c.id===id)))throw Error('Invalid completed-case inventory');
 if(BATCH_TWO_IDS.some(id=>completed.includes(id)))throw Error('Batch refuses already executed cases');
 const selected=BATCH_TWO_IDS.map(id=>cases.find(c=>c.id===id)!);
 return {selected,maxAttempts:selected.reduce((n,c)=>n+(c.system==='chat'?1:9),0),tokenAllowance:60000};
}

export function remainingLiveBatch(completed:readonly string[],savedFixtureHash:string){
 if(savedFixtureHash!==fixtureHash)throw Error('Saved benchmark hash differs');
 if(completed.length!==8||new Set(completed).size!==8||completed.some(id=>!cases.some(c=>c.id===id)))throw Error('Expected eight unique completed cases');
 const expectedCompleted=['doc-01','csv-01','combined-01',...BATCH_TWO_IDS];
 if(expectedCompleted.some(id=>!completed.includes(id)))throw Error('Completed inventory differs from saved approved runs');
 const selected=cases.filter(c=>!completed.includes(c.id));
 if(selected.length!==17)throw Error('Expected seventeen unexecuted cases');
 return {selected,maxAttempts:selected.reduce((n,c)=>n+(c.system==='chat'?1:9),0),tokenAllowance:160000};
}
export function evaluationStopReason(result:{executed:boolean;error?:{category?:string;errorType?:string;httpStatus?:number}|null}){
 if(!result.executed)return 'case_setup_failed';
 if(result.error?.category==='timeout'||result.error?.errorType==='TimeoutError'||[408,504].includes(result.error?.httpStatus??0))return 'case_deadline_reached';
 if(result.error?.category==='cancelled'||result.error?.errorType==='AbortError')return 'case_cancelled';
 return null;
}
