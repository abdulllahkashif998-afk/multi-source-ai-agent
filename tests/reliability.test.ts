import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiTransport } from '../src/lib/gemini-transport';
import { logEvent, withRequest } from '../src/lib/reliability';
function fixture(responses:Response[]) {
 let now=0;const starts:number[]=[];
 const transport=createGeminiTransport({rpm:12,clock:{now:()=>now,sleep:async(ms,signal)=>{signal?.throwIfAborted();now+=ms;}},fetch:async()=>{starts.push(now);return responses.shift()!;}});
 return {transport,starts};
}
test('actual provider attempts are paced; one mocked 429 can recover',async()=>{
 const f=fixture([new Response('',{status:429,headers:{'retry-after':'6'}}),Response.json({ok:true}),Response.json({ok:true})]);
 assert.equal((await f.transport('https://provider.invalid')).status,200);
 await f.transport('https://provider.invalid');assert.deepEqual(f.starts,[0,6000,11000]);
});
test('persistent 429 has only two attempts and exposes a safe error',async()=>{
 const f=fixture([new Response('private provider body',{status:429}),new Response('secret',{status:429})]);
 await assert.rejects(f.transport('https://provider.invalid'),{code:'PROVIDER_RATE_LIMITED',status:429});assert.equal(f.starts.length,2);
});
test('long provider cooldown fails immediately and blocks subsequent calls',async()=>{
 const f=fixture([new Response('secret',{status:429,headers:{'retry-after':'120'}})]);
 await assert.rejects(f.transport('https://provider.invalid'),{status:429});
 await assert.rejects(f.transport('https://provider.invalid'),{status:429});assert.equal(f.starts.length,1);
});
test('aborted requests never call the provider; invalid quota configuration is rejected',async()=>{
 const f=fixture([]);await assert.rejects(f.transport('https://provider.invalid',{signal:AbortSignal.abort()}));assert.equal(f.starts.length,0);
 for(const rpm of [0,15,NaN,1.5])assert.throws(()=>createGeminiTransport({rpm}),{status:503});
});
test('request IDs are server generated and logging discards sensitive arbitrary fields',async()=>{
 const lines:string[]=[];const original=console.info;console.info=(...args)=>{lines.push(args.join(' '));};
 try{
 const response=await withRequest(new Request('http://localhost/private-secret',{headers:{'X-Request-ID':'secret-token'}}),async()=>{
 logEvent('secret-stage',performance.now(),'secret-outcome','secret-tool',{name:'secret-name',message:'secret-password',stack:'secret-stack',responseBody:'secret-document'});
 return Response.json({ok:true});});
 assert.match(response.headers.get('X-Request-ID')!,/^[0-9a-f-]{36}$/);
 assert.ok(!lines.join('').includes('secret'));assert.equal(JSON.parse(lines[0].slice('[reliability] '.length)).errorType,'Unknown');
 }finally{console.info=original;}
});
test('429 retry is refused when the remaining deadline cannot fit another attempt',async()=>{
 let now=0,calls=0;
 const transport=createGeminiTransport({rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async()=>{calls++;now=29_000;return new Response('',{status:429});}});
 await assert.rejects(transport('https://provider.invalid'),{status:429});assert.equal(calls,1);
});
test('non-429 failures are returned without retry and do not expose their body in logs',async()=>{
 const f=fixture([new Response('private-body',{status:503})]);assert.equal((await f.transport('https://provider.invalid')).status,503);assert.equal(f.starts.length,1);
});
test('concurrent calls share actual start spacing',async()=>{
 const f=fixture(Array.from({length:2},()=>Response.json({ok:true})));
 await Promise.all(Array.from({length:2},()=>f.transport('https://provider.invalid')));
 assert.equal(f.starts.length,2);for(let i=1;i<f.starts.length;i++)assert.ok(f.starts[i]-f.starts[i-1]>=5000);
});
test('provider waits honor cancellation and the bounded queue rejects excess requests',async()=>{
 let calls=0;
 const transport=createGeminiTransport({rpm:12,clock:{now:()=>0,sleep:async(_ms,signal)=>new Promise<void>((_resolve,reject)=>{signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});})},fetch:async()=>{calls++;return Response.json({ok:true});}});
 await transport('https://provider.invalid');
 const controller=new AbortController();
 const waiting=Array.from({length:8},()=>transport('https://provider.invalid',{signal:controller.signal}));
 await assert.rejects(transport('https://provider.invalid'),{status:429});
 controller.abort();const results=await Promise.allSettled(waiting);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(calls,1);
});
test('confirmed Gemini billing denial is actionable, safe and never retried',async()=>{
 const secret='fictional-private-project-and-key';
 const lines:string[]=[];const original=console.info;console.info=(...args)=>{lines.push(args.join(' '));};
 try{
 const f=fixture([Response.json({error:{code:403,status:'PERMISSION_DENIED',message:`The Gemini API free tier is not available for this project. ${secret}`}},{status:403})]);
 await assert.rejects(f.transport('https://provider.invalid'),(error:unknown)=>{
 const e=error as {code:string;status:number;message:string};assert.equal(e.code,'PROVIDER_BILLING_REQUIRED');assert.equal(e.status,503);assert.ok(!e.message.includes(secret));logEvent('planning',performance.now(),'error',undefined,error);return true;
 });
 assert.equal(f.starts.length,1);assert.ok(!lines.join('').includes(secret));
 assert.ok(lines.some(line=>line.includes('"httpStatus":403')));assert.ok(lines.some(line=>line.includes('"reason":"provider_billing_required"')));
 }finally{console.info=original;}
});
test('unrelated, malformed and oversized 403 responses keep existing behavior',async()=>{
 for(const body of [JSON.stringify({error:{code:403,status:'PERMISSION_DENIED',message:'Other access restriction'}}),'not JSON',JSON.stringify({error:{code:403,status:'PERMISSION_DENIED',message:'The Gemini API free tier is not available for this project.'},padding:'x'.repeat(9000)})]){
 const f=fixture([new Response(body,{status:403})]);const response=await f.transport('https://provider.invalid');assert.equal(response.status,403);assert.equal(await response.text(),body);assert.equal(f.starts.length,1);
 }
});
