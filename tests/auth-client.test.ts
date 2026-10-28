import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { accountSchema, AuthUiError, getBrowserSession, logoutAccount, submitAccount } from '../src/lib/auth-client';
afterEach(() => mock.restoreAll());
const session = {success:true,name:'Fictional User',email:'fictional@example.test',csrfToken:'c'.repeat(64)};
test('frontend validates account details and preserves password whitespace', () => {
  assert.equal(accountSchema.safeParse({email:'bad',password:'short'}).success,false);
  const parsed=accountSchema.parse({name:'  Fictional  ',email:'Fictional@example.test',password:'  fictional password  '});
  assert.equal(parsed.name,'Fictional');assert.equal(parsed.email,'fictional@example.test');assert.equal(parsed.password,'  fictional password  ');
});
test('frontend login/signup use same-origin cookies and obtain a fresh session without reading tokens',async()=>{
  for(const mode of ['login','signup'] as const){
    const calls:Array<{url:string;init?:RequestInit}>=[];
    mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{calls.push({url,init});return Response.json(url==='/api/auth/session'?session:{success:true,userId:'999',csrfToken:session.csrfToken});});
    const result=await submitAccount(mode,{email:'fictional@example.test',password:'Fictional password!',...(mode==='signup'?{name:'Fictional'}:{})});
    assert.equal(calls[0].url,`/api/auth/${mode}`);assert.equal(calls[1].url,'/api/auth/session');
    assert.ok(calls.every(call=>call.init?.credentials==='same-origin'&&call.init.cache==='no-store'));
    assert.equal(calls[0].init?.method,'POST');assert.equal(result.csrfToken,session.csrfToken);assert.ok(!('userId' in result));
    mock.restoreAll();
  }
});
test('frontend logout refreshes the CSRF token and sends it to the existing logout endpoint',async()=>{
  const calls:Array<{url:string;init?:RequestInit}>=[];
  mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{calls.push({url,init});return Response.json(url==='/api/auth/session'?session:{success:true});});
  await logoutAccount();assert.equal(calls[1].url,'/api/auth/logout');assert.equal(calls[1].init?.method,'POST');assert.equal(new Headers(calls[1].init?.headers).get('X-CSRF-Token'),session.csrfToken);
});
test('frontend distinguishes invalid credentials, missing sessions, CSRF failures and network errors safely',async()=>{
  for(const [status,code] of [[401,'INVALID_CREDENTIALS'],[401,'UNAUTHENTICATED'],[403,'CSRF_REJECTED'],[503,'PRIVATE_SECRET']] as const){
    mock.method(globalThis,'fetch',async()=>Response.json({success:false,code,error:'private provider content'},{status}));
    await assert.rejects(getBrowserSession(),(error:unknown)=>error instanceof AuthUiError&&!error.message.includes('private')&&!error.message.includes('PRIVATE')&&error.code===(code==='PRIVATE_SECRET'?'REQUEST_FAILED':code));
    mock.restoreAll();
  }
  mock.method(globalThis,'fetch',async()=>{throw new Error('secret network details');});await assert.rejects(getBrowserSession(),{code:'CONNECTION_FAILED'});
});
test('frontend fails closed for malformed sessions and tolerates already expired logout',async()=>{
  mock.method(globalThis,'fetch',async()=>Response.json({...session,csrfToken:'invalid'}));await assert.rejects(getBrowserSession(),{code:'INVALID_RESPONSE'});mock.restoreAll();
  let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({success:false,code:'UNAUTHENTICATED'},{status:401});});await logoutAccount();assert.equal(calls,1);
});
