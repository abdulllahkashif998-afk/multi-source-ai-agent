import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGroqQuota,memoryQuotaStore,RateLimitError} from '../src/lib/groq-quota';
// Reproduce safe numeric trace evidence, not private prompts or model output.
test('successful 3033/3814 reservations reconcile to 3920 actual tokens before a later TPM denial',async()=>{
 let now=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now);
 const first=await q.reserve(3033);now=900;await q.settle(first,2130);
 now=1200;const second=await q.reserve(3814);now=5500;await q.settle(second,1790);
 now=5742;await assert.rejects(q.reserve(4081),e=>e instanceof RateLimitError&&e.rateLimitOrigin==='local'&&e.quotaReason==='tpm');
 await store.transact(s=>{assert.equal(s.entries.length,2);assert.equal(s.entries.filter(e=>e.pending).length,0);assert.equal(s.entries.reduce((n,e)=>n+(e.charged??e.reserved),0),3920);});
 // This is a hypothetical third estimate, not a reconstructed provider request.
 const fits=await q.reserve(4080);await q.settle(fits,null,undefined,false);
 now=60901;const afterFirstExpiry=await q.reserve(6000);await q.settle(afterFirstExpiry,null,undefined,false);
});
test('a tighter retained provider token header can reject even while local rolling tokens fit',async()=>{
 let now=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now);
 const first=await q.reserve(3033);await q.settle(first,2130,new Headers({'x-ratelimit-remaining-tokens':'2500','x-ratelimit-reset-tokens':'1s'}));
 await assert.rejects(q.reserve(2501),{rateLimitOrigin:'local',quotaReason:'tpm'});
 await store.transact(s=>{assert.equal(s.entries.length,1);assert.equal(s.entries[0].charged,2130);});
 now=60001;assert.ok(await q.reserve(2501));
});
