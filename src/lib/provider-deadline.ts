import {AsyncLocalStorage} from 'node:async_hooks';
const deadlines=new AsyncLocalStorage<number>();
export function withProviderDeadline<T>(deadline:number,work:()=>T):T{return deadlines.run(deadline,work);}
export function providerDeadline(){return deadlines.getStore();}
