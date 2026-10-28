import { test as register } from './provider-context';
import { runWithIdentity } from '../src/lib/identity';
// Legacy regression fixtures explicitly execute as a trusted server-side test user.
// This never bypasses HTTP session/CSRF verification in authenticated().
export const test=((...args:unknown[])=>{
 const callback=args[args.length-1];
 if(typeof callback==='function')args[args.length-1]=(...values:unknown[])=>runWithIdentity('1',()=>callback(...values));
 return (register as (...args:unknown[])=>unknown)(...args);
}) as typeof register;
export const testToken='a'.repeat(64);
export const testCsrf='b'.repeat(64);
export const sessionHeaders={'Cookie':`knowledge-session=${testToken}`,'Origin':'http://localhost:3000','X-CSRF-Token':testCsrf};
export const sessionRow={user_id:'1',csrf_token:testCsrf,name:'Fictional',email:'fixture@example.test'};
