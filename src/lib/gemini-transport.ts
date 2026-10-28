import { AsyncLocalStorage } from 'node:async_hooks';
import { createProviderTransport } from './provider-transport';

// Compatibility wrapper: Gemini policy and injection API remain unchanged.
export function createGeminiTransport(options:Omit<Parameters<typeof createProviderTransport>[0],'provider'>) {
 return createProviderTransport({...options,provider:'gemini'});
}
// Shared across hot reloads in a single Node process. Multi-worker deployments need a shared limiter.
const shared=globalThis as typeof globalThis & {knowledgeGeminiTransport?:{rpm:number;fetch:typeof fetch}};
const override=new AsyncLocalStorage<typeof fetch>();
// Explicit dependency injection for deterministic tests; HTTP clients cannot select it.
export function withGeminiTransport<T>(transport:typeof fetch,work:()=>T):T {return override.run(transport,work);}
export const geminiFetch:typeof fetch=(input,init)=>{
 const injected=override.getStore();if(injected)return injected(input,init);
 const rpm=Number(process.env.GEMINI_REQUESTS_PER_MINUTE??'12');
 if(!shared.knowledgeGeminiTransport||shared.knowledgeGeminiTransport.rpm!==rpm)shared.knowledgeGeminiTransport={rpm,fetch:createGeminiTransport({rpm})};
 return shared.knowledgeGeminiTransport.fetch(input,init);
};
