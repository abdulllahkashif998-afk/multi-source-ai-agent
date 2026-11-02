import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encode} from 'gpt-tokenizer/encoding/o200k_harmony';
import {estimateGroqTokens,estimateGroqTokenBudget,createGroqQuota,memoryQuotaStore,type QuotaObservation} from '../src/lib/groq-quota';
import {createGroqTransport} from '../src/lib/groq-transport';
import {withRequest} from '../src/lib/reliability';
import {modelInvocation,tokenReservation} from '../src/lib/provider-usage';
const body=(output=1536)=>JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:'PRIVATE_PROMPT_DO_NOT_LOG'}],max_completion_tokens:output});

test('diagnostic decomposition exactly preserves the previous full-wire reservation formula',()=>{
 for(const output of [256,1536,3000]){
  const wire=body(output),budget=estimateGroqTokenBudget(wire);
  const old=encode(wire,{disallowedSpecial:new Set()}).length+256+32+output;
  assert.equal(estimateGroqTokens(wire),old);assert.equal(budget.totalReservedTokens,old);
  assert.equal(budget.estimatedInputTokens,budget.wireTokens+budget.framingTokens);
  assert.equal(budget.outputReservation,output);
 }
 assert.throws(()=>estimateGroqTokenBudget('PRIVATE_INVALID_JSON'));
});
test('atomic snapshots report capacity without changing admission or letting observation failures break it',async()=>{
 const q=createGroqQuota(memoryQuotaStore(),()=>0),seen:QuotaObservation[]=[];
 const first=await q.reserve(4191,undefined,s=>seen.push(s));
 await q.settle(first,2702,new Headers({'x-ratelimit-remaining-tokens':'4400'}));
 await assert.rejects(q.reserve(6469,undefined,s=>seen.push(s)),{quotaReason:'tpm'});
 assert.equal(seen[0].availableTPM,8000);assert.equal(seen[0].admitted,true);
 assert.deepEqual(seen[1],{admitted:false,minuteTokens:2702,dayTokens:2702,localTPMRemaining:5298,providerTPMRemaining:4400,availableTPM:4400});
 assert.ok(await q.reserve(1,undefined,()=>{throw Error('PRIVATE_LOGGING_FAILURE');}));
});
test('transport logs only safe numeric usage components and the current model phase',async()=>{
 const logs:string[]=[],original=console.info;console.info=(...parts)=>logs.push(parts.join(' '));
 let now=0,calls=0;
 const q=createGroqQuota(memoryQuotaStore(),()=>now);
 const transport=createGroqTransport({rpm:12,quota:q,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>{
  calls++;return Response.json({usage:{total_tokens:100,prompt_tokens:40,completion_tokens:60,completion_tokens_details:{reasoning_tokens:20}},private:'PRIVATE_RESPONSE_DO_NOT_LOG'},{headers:{'x-ratelimit-remaining-tokens':'7000'}});
 }});
 try{
  await withRequest(new Request('http://localhost/private'),async()=>{
   for(const phase of ['planning','generation'] as const){modelInvocation('groq',phase);await transport('https://provider.invalid',{method:'POST',body:body(phase==='planning'?1536:3000)});}
   tokenReservation({estimatedInputTokens:NaN,reportedPromptTokens:-1,availableTPM:3,...{secret:'PRIVATE_EXTRA_FIELD'}},true,'PRIVATE_PHASE');
   return Response.json({ok:true});
  });
 }finally{console.info=original;}
 const events=logs.map(l=>JSON.parse(l.slice('[reliability] '.length))),usage=events.filter(e=>e.stage==='provider-usage'),admission=events.filter(e=>e.stage==='provider-reservation');
 assert.equal(calls,2);assert.deepEqual(usage.map(e=>e.phase),['planning','generation']);
 assert.deepEqual(usage.map(e=>e.outputReservation),[1536,3000]);
 for(const e of usage){assert.equal(e.reportedPromptTokens,40);assert.equal(e.reportedCompletionTokens,60);assert.equal(e.reportedReasoningTokens,20);assert.equal(e.reportedTokens,100);assert.equal(e.reservedTokens,e.estimatedInputTokens+e.outputReservation);}
 assert.equal(admission[0].availableTPM,8000);assert.equal(admission[1].availableTPM,7000);assert.equal(admission[2].phase,undefined);assert.equal(admission[2].estimatedInputTokens,undefined);
 assert.doesNotMatch(logs.join('\n'),/PRIVATE_|provider\.invalid/);
});
test('missing or malformed usage remains unknown and keeps the full charge',async()=>{
 const store=memoryQuotaStore(),q=createGroqQuota(store,()=>0),logs:string[]=[],original=console.info;console.info=(...args)=>logs.push(args.join(' '));
 const transport=createGroqTransport({rpm:12,quota:q,clock:{now:()=>0,sleep:async()=>{}},fetch:async()=>Response.json({usage:{prompt_tokens:'PRIVATE_INVALID_NUMBER',completion_tokens:-1}})});
 try{await transport('https://provider.invalid',{method:'POST',body:body()});}finally{console.info=original;}
 await store.transact(s=>{assert.equal(s.entries[0].charged,null);assert.equal(s.entries[0].pending,false);});
 const e=logs.map(l=>JSON.parse(l.slice('[reliability] '.length))).find(e=>e.stage==='provider-usage');
 assert.equal(e.reportedTokens,null);assert.equal(e.reportedPromptTokens,null);assert.equal(e.reportedCompletionTokens,null);
 assert.doesNotMatch(logs.join('\n'),/PRIVATE_/);
});
test('locally blocked calls emit numeric reservation diagnostics without dispatch or usage fabrication',async()=>{
 const q=createGroqQuota(memoryQuotaStore(),()=>0),first=await q.reserve(4191);
 await q.settle(first,2702,new Headers({'x-ratelimit-remaining-tokens':'4400'}));
 const wire=JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:'private '.repeat(2000)}],max_completion_tokens:3000});
 const logs:string[]=[],original=console.info;console.info=(...args)=>logs.push(args.join(' '));let http=0;
 const transport=createGroqTransport({rpm:12,quota:q,clock:{now:()=>0,sleep:async()=>assert.fail('wait cannot fit deadline')},fetch:async()=>{http++;throw Error('must not dispatch');}});
 try{await withRequest(new Request('http://localhost'),async()=>{modelInvocation('groq','generation');await assert.rejects(transport('https://provider.invalid',{method:'POST',body:wire}),{quotaReason:'tpm'});return Response.json({ok:true});});}finally{console.info=original;}
 assert.equal(http,0);const events=logs.map(l=>JSON.parse(l.slice('[reliability] '.length))),event=events.find(e=>e.stage==='provider-reservation');
 assert.equal(event.admitted,false);assert.equal(event.availableTPM,4400);assert.equal(event.phase,'generation');assert.equal(event.modelCallCount,1);assert.equal(event.providerAttemptCount,0);
 assert.equal(event.totalReservedTokens,estimateGroqTokens(wire));assert.ok(!events.some(e=>e.stage==='provider-usage'));
 assert.doesNotMatch(logs.join('\n'),/private |provider\.invalid/);
});
