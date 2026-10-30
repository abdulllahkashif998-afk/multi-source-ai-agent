import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardedLiveFetch,type LiveLedger} from '../evaluation/live-request-guard';
const endpoint='https://api.groq.com/openai/v1/chat/completions',init={method:'POST',body:JSON.stringify({messages:[{role:'user',content:'fictional'}]})};
test('evaluation 429 is not retried by the production transport; quota denial stops subsequent calls',async()=>{
 const {createGroqTransport}=await import('../src/lib/groq-transport');let calls=0;
 const ledger:LiveLedger={attempts:[],stopReason:null};
 const guarded=guardedLiveFetch({fetch:async()=>{calls++;return Response.json({error:{message:'private sentinel'}},{status:429});},ollamaOrigin:'http://localhost:11434',maxAttempts:9,tokenAllowance:50000,ledger,save:async()=>{}});
 const transport=createGroqTransport({rpm:12,fetch:guarded});
 await assert.rejects(transport(endpoint,init),{code:'PROVIDER_RATE_LIMITED'});assert.equal(calls,1);assert.equal(ledger.stopReason,'provider_http_429');assert.ok(!JSON.stringify(ledger).includes('private sentinel'));
 await assert.rejects(guarded(endpoint,init));assert.equal(calls,1);
});
test('evaluation captures only numeric usage and enforces HTTP/token/endpoint bounds',async()=>{
 const ledger:LiveLedger={attempts:[],stopReason:null};let calls=0;
 const fetch=guardedLiveFetch({fetch:async()=>{calls++;return Response.json({usage:{prompt_tokens:30,completion_tokens:10,total_tokens:40},choices:[{text:'fictional private sentinel'}]});},ollamaOrigin:'http://localhost:11434',maxAttempts:1,tokenAllowance:50000,ledger,save:async()=>{}});
 await fetch(endpoint,init);assert.equal(ledger.attempts[0].totalTokens,40);assert.ok(!JSON.stringify(ledger).includes('sentinel'));await assert.rejects(fetch(endpoint,init));assert.equal(calls,1);
 await assert.rejects(fetch('https://unapproved.invalid',init));assert.equal(calls,1);
 const zero:LiveLedger={attempts:[],stopReason:null};await assert.rejects(guardedLiveFetch({fetch:async()=>assert.fail('budget must precede HTTP'),ollamaOrigin:'http://localhost:11434',maxAttempts:1,tokenAllowance:1,ledger:zero,save:async()=>{}})(endpoint,init));assert.equal(zero.attempts.length,0);
});

test('zero-provider-call abstention has a readable empty ledger and existing evidence cannot be overwritten',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {initializeLiveLedger}=await import('../evaluation/live-request-guard');
 const directory=await mkdtemp('/tmp/live-empty-ledger-'),filename=directory+'/http.json';
 try{await initializeLiveLedger(filename);const first=await readFile(filename,'utf8');assert.deepEqual(JSON.parse(first),{attempts:[],stopReason:null});await assert.rejects(initializeLiveLedger(filename),{code:'EEXIST'});assert.equal(await readFile(filename,'utf8'),first);}finally{await rm(directory,{recursive:true,force:true});}
});

test('evaluation retains only permitted numeric quota headers without inferring daily tokens',async()=>{
 const ledger:LiveLedger={attempts:[],stopReason:null};const fetch=guardedLiveFetch({fetch:async()=>Response.json({usage:{total_tokens:10}},{headers:{'x-ratelimit-limit-requests':'1000','x-ratelimit-remaining-requests':'970','x-ratelimit-limit-tokens':'8000','x-ratelimit-remaining-tokens':'7000','x-private-sentinel':'never save'}}),ollamaOrigin:'http://localhost:11434',maxAttempts:1,tokenAllowance:50000,ledger,save:async()=>{}});
 await fetch(endpoint,init);assert.deepEqual(ledger.attempts[0].quota,{requestsPerDay:1000,remainingRequestsToday:970,tokensPerMinute:8000,remainingTokensThisMinute:7000});assert.ok(!JSON.stringify(ledger).includes('sentinel'));assert.ok(!JSON.stringify(ledger).includes('remainingDailyTokens'));
});

test('exhausted reported request quota stops further native HTTP without retry',async()=>{
 const ledger:LiveLedger={attempts:[],stopReason:null};let calls=0;
 const fetch=guardedLiveFetch({fetch:async()=>{calls++;return Response.json({usage:{total_tokens:10}},{headers:{'x-ratelimit-remaining-requests':'0'}});},ollamaOrigin:'http://localhost:11434',maxAttempts:3,tokenAllowance:50000,ledger,save:async()=>{}});
 await fetch(endpoint,init);assert.equal(ledger.stopReason,'provider_daily_request_quota_exhausted');await assert.rejects(fetch(endpoint,init));assert.equal(calls,1);
});
