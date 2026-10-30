import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerToolDiagnostic} from '../src/lib/provider-tool-diagnostics';
import {safeError} from '../src/lib/reliability';

function failure(raw:unknown){return {name:'AI_APICallError',statusCode:400,responseBody:JSON.stringify({error:{code:'tool_use_failed',message:'PRIVATE_VALUE',failed_generation:typeof raw==='string'?raw:JSON.stringify(raw)}})};}
test('malformed provider envelopes expose only bounded structural classifications',()=>{
 const cases:Array<[unknown,string]>=[['PRIVATE_VALUE','non_json'],[null,'non_object'],[[],'non_object'],[{PRIVATE_VALUE:1},'missing_calls'],[{tool_calls:'PRIVATE_VALUE'},'invalid_calls_type'],[{tool_calls:[]},'empty_calls'],[{tool_calls:[{},{}]},'multiple_calls'],[{tool_calls:[null]},'invalid_call'],[{tool_calls:[{}]},'invalid_function']];
 for(const [value,shape] of cases){const result=providerToolDiagnostic(failure(value));assert.equal(result?.reason,'unrecognized_envelope');assert.equal(result?.envelopeShape,shape);assert.doesNotMatch(JSON.stringify(safeError(failure(value))),/PRIVATE_VALUE|failed_generation|responseBody/);}
 assert.equal(providerToolDiagnostic(failure({tool_calls:Array(25).fill({})}))?.callCount,10);
});
test('provider diagnostic validation never repairs invalid JSON or accepts SQL and remains nonexecuting',()=>{
 const call=(name:string,args:unknown)=>failure({tool_calls:[{function:{name,arguments:args}}]});
 assert.equal(providerToolDiagnostic(call('queryDataset','{PRIVATE_VALUE'))?.reason,'invalid_arguments_json');
 assert.equal(providerToolDiagnostic(call('queryDataset',{datasetId:'123',sql:'PRIVATE_VALUE'}))?.reason,'invalid_input_shape');
 assert.equal(providerToolDiagnostic(call('queryDataset',{datasetId:'123',evidenceComplete:true}))?.reason,'valid_input_shape');
 assert.equal(providerToolDiagnostic(call('PRIVATE_VALUE',{}))?.reason,'unknown_tool');
 assert.doesNotMatch(JSON.stringify(providerToolDiagnostic(call('queryDataset',{datasetId:'123',evidenceComplete:'PRIVATE_VALUE'}))),/PRIVATE_VALUE/);
 assert.equal(providerToolDiagnostic({statusCode:429,responseBody:failure('PRIVATE_VALUE').responseBody}),undefined);
 assert.equal(providerToolDiagnostic({statusCode:400,responseBody:'PRIVATE_VALUE'}),undefined);
});
