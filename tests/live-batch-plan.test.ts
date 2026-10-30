import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextLiveBatch,BATCH_TWO_IDS} from '../evaluation/live-batch-plan';
import {fixtureHash} from '../evaluation/answer-quality';
import {cases} from '../evaluation/fixtures';
test('next live batch selects five original unexecuted cases and bounds calls without pilot repeats',()=>{
 const batch=nextLiveBatch(['doc-01','csv-01','combined-01'],fixtureHash);
 assert.deepEqual(batch.selected.map(c=>c.id),[...BATCH_TWO_IDS]);assert.equal(batch.selected.length,5);assert.equal(batch.maxAttempts,29);assert.equal(batch.tokenAllowance,60000);
 for(const c of batch.selected)assert.equal(c,cases.find(original=>original.id===c.id));
});
test('next live batch refuses repeated cases and changed benchmark identity',()=>{
 assert.throws(()=>nextLiveBatch(['doc-01','doc-02'],fixtureHash),/already executed/);
 assert.throws(()=>nextLiveBatch([], 'changed'),/hash differs/);
 assert.throws(()=>nextLiveBatch(['unknown'],fixtureHash),/inventory/);
});

test('remaining batch contains exactly the original seventeen and excludes all eight executed cases',async()=>{
 const {remainingLiveBatch}=await import('../evaluation/live-batch-plan');const completed=['doc-01','csv-01','combined-01',...BATCH_TWO_IDS];const batch=remainingLiveBatch(completed,fixtureHash);
 assert.equal(batch.selected.length,17);assert.equal(batch.maxAttempts,113);assert.equal(batch.tokenAllowance,160000);assert.ok(batch.selected.every(c=>!completed.includes(c.id as typeof completed[number])));
 assert.deepEqual(batch.selected,cases.filter(c=>!completed.includes(c.id as typeof completed[number])));
 assert.throws(()=>remainingLiveBatch(completed.slice(1),fixtureHash));assert.throws(()=>remainingLiveBatch(completed,'wrong'));
});
test('deadline/cancellation/setup failures stop the supervisor while semantic failures remain recorded',async()=>{
 const {evaluationStopReason}=await import('../evaluation/live-batch-plan');
 assert.equal(evaluationStopReason({executed:true,error:{category:'timeout'}}),'case_deadline_reached');assert.equal(evaluationStopReason({executed:true,error:{httpStatus:504}}),'case_deadline_reached');assert.equal(evaluationStopReason({executed:true,error:{errorType:'TimeoutError'}}),'case_deadline_reached');assert.equal(evaluationStopReason({executed:false}),'case_setup_failed');assert.equal(evaluationStopReason({executed:true,error:{category:'cancelled'}}),'case_cancelled');assert.equal(evaluationStopReason({executed:true,error:{category:'validation'}}),null);
});
