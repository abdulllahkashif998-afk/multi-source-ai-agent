import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentModelToolInputs,agentToolInputs} from '../src/lib/agent-tool-inputs';
import {compileCSVQuery} from '../src/lib/generic-csv';
const columns=[{name:'region',type:'text' as const},{name:'amount',type:'number' as const}];
test('model aggregate variants reject invalid count/column combinations and preserve structured operations',()=>{
 for(const aggregate of [{op:'count'},{op:'sum',column:'amount'},{op:'avg',column:'amount'}]){
  const p=agentModelToolInputs.queryDataset.parse({datasetId:'101',aggregate,filters:[{column:'region',op:'eq',value:'East'}],groupBy:['region'],sort:{column:'value',direction:'desc'},limit:20,evidenceComplete:true});
  const {evidenceComplete,...plan}=p;assert.equal(evidenceComplete,true);assert.doesNotThrow(()=>compileCSVQuery(plan,columns));assert.deepEqual(plan.filters,[{column:'region',op:'eq',value:'East'}]);
 }
 for(const aggregate of [{op:'count',column:'amount'},{op:'count',column:''},{op:'sum'},{op:'avg'},{op:'sum',column:''},{op:'avg',column:''},{op:'delete',column:'amount'}])assert.equal(agentModelToolInputs.queryDataset.safeParse({datasetId:'101',aggregate}).success,false);
 for(const aggregate of [{op:'sum',column:'region'},{op:'avg',column:'unknown'}]){
  const p=agentModelToolInputs.queryDataset.parse({datasetId:'101',aggregate});assert.throws(()=>compileCSVQuery(p,columns));
 }
 // Public wire shape remains unchanged, while the compiler rejects invalid values.
 const emptyColumn=agentToolInputs.queryDataset.parse({datasetId:'101',aggregate:{op:'count',column:''}});assert.throws(()=>compileCSVQuery(emptyColumn,columns),/Count counts rows/);
 assert.doesNotThrow(()=>agentModelToolInputs.queryDataset.parse({datasetId:'101',filters:[{column:'region',op:'eq',value:'East'}],sort:{column:'amount',direction:'desc'}}));
});
