import { AsyncLocalStorage } from 'node:async_hooks';
import { createProviderTransport } from './provider-transport';
export function createGroqTransport(options:Omit<Parameters<typeof createProviderTransport>[0],'provider'>) {
 return createProviderTransport({...options,provider:'groq'});
}
const shared=globalThis as typeof globalThis & {knowledgeGroqTransport?:{rpm:number;fetch:typeof fetch}};
const override=new AsyncLocalStorage<typeof fetch>();
export function withGroqTransport<T>(transport:typeof fetch,work:()=>T):T {return override.run(transport,work);}
export const groqFetch:typeof fetch=(input,init)=>{
 const injected=override.getStore();if(injected)return injected(input,init);
 const rpm=Number(process.env.GROQ_REQUESTS_PER_MINUTE??'12');
 if(!shared.knowledgeGroqTransport||shared.knowledgeGroqTransport.rpm!==rpm)shared.knowledgeGroqTransport={rpm,fetch:createGroqTransport({rpm})};
 return shared.knowledgeGroqTransport.fetch(input,init);
};
