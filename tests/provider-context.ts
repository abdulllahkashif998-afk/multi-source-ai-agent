import { test as register } from 'node:test';
import { createGeminiTransport, withGeminiTransport } from '../src/lib/gemini-transport';
export function withMockGeminiClock<T>(work:()=>T):T {
 let now=Date.now();
 return withGeminiTransport(createGeminiTransport({rpm:12,clock:{now:()=>now,sleep:async(ms,signal)=>{signal?.throwIfAborted();now+=ms;}}}),work);
}
export const test=((...args:unknown[])=>{
 const callback=args[args.length-1];
 if(typeof callback==='function')args[args.length-1]=async(...values:unknown[])=>{
 const previous=process.env.AI_PROVIDER;process.env.AI_PROVIDER='gemini';
 try{return await withMockGeminiClock(()=>callback(...values));}finally{if(previous===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=previous;}
 };
 return (register as (...args:unknown[])=>unknown)(...args);
}) as typeof register;
