import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGroqQuota,memoryQuotaStore,RateLimitError} from '../src/lib/groq-quota';
import {reserveBeforeDeadline} from '../src/lib/quota-admission';

// Recorded November 2 totals only: these are not reconstructed model payloads
// or live provider responses. Never open the production quota store here.
test('November 2 generation rejection reconciles usage and preserves provider allowance',async()=>{
 let now=0;const store=memoryQuotaStore(),quota=createGroqQuota(store,()=>now);
 const id=await quota.reserve(4191);
 await quota.settle(id,2702,new Headers({'x-ratelimit-remaining-tokens':'4400'}));
 now=3000;
 await assert.rejects(quota.reserve(6469),error=>{
  assert.ok(error instanceof RateLimitError);
  assert.equal(error.rateLimitOrigin,'local');assert.equal(error.quotaReason,'tpm');
  assert.equal(error.admission?.minuteTokens,2702);assert.equal(error.admission?.dayTokens,2702);
  assert.equal(error.admission?.remoteTokensRemaining,4400);assert.equal(error.retryAfterSeconds,57);
  return true;
 });
 await store.transact(s=>{assert.equal(s.entries.length,1);assert.equal(s.entries[0].charged,2702);assert.equal(s.entries[0].pending,false);});
});
test('November 2 third-planning rejection is not a daily limit or leaked reservation',async()=>{
 let now=0;const store=memoryQuotaStore(),quota=createGroqQuota(store,()=>now);
 const previous=await quota.reserve(4191);await quota.settle(previous,2702);
 now=90000;const first=await quota.reserve(3308);await quota.settle(first,1689);
 now+=5000;const second=await quota.reserve(3833);await quota.settle(second,1833,new Headers({'x-ratelimit-remaining-tokens':'3293'}));
 await assert.rejects(quota.reserve(4705),error=>{
  assert.ok(error instanceof RateLimitError);assert.equal(error.quotaReason,'tpm');
  assert.equal(error.admission?.minuteTokens,3522);assert.equal(error.admission?.dayTokens,6224);
  assert.equal(error.admission?.dailyReason,undefined);assert.equal(error.admission?.remoteTokensRemaining,3293);
  return true;
 });
 await store.transact(s=>{assert.equal(s.entries.length,3);assert.ok(s.entries.every(e=>!e.pending));});
});
test('recorded required wait cannot fit the existing transport admission budget',async()=>{
 let now=0,sleeps=0;const quota=createGroqQuota(memoryQuotaStore(),()=>now);
 const id=await quota.reserve(4191);await quota.settle(id,2702,new Headers({'x-ratelimit-remaining-tokens':'4400'}));
 now=3000;
 await assert.rejects(reserveBeforeDeadline(quota,6469,{deadline:now+20000,signal:new AbortController().signal,now:()=>now,sleep:async ms=>{sleeps++;now+=ms;}}),{quotaReason:'tpm'});
 assert.equal(sleeps,0);
 now=60001;assert.ok(await quota.reserve(6469));
});
