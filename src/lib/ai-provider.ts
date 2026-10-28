import 'server-only';
import {createGoogle} from '@ai-sdk/google';
import {createGroq, type GroqLanguageModelChatOptions} from '@ai-sdk/groq';
import {geminiFetch} from './gemini-transport';
import {groqFetch} from './groq-transport';
import {ChatError} from './chat-errors';
import {logEvent} from './reliability';
// Provider warnings may contain arbitrary response text.
globalThis.AI_SDK_LOG_WARNINGS=()=>logEvent('sdk-warning',performance.now(),'error');
export const GEMINI_MODEL='gemini-3.5-flash-lite';
// Verified against Groq's model cards and structured-output support table.
export const GROQ_MODELS=['openai/gpt-oss-20b','openai/gpt-oss-120b'] as const;
export function getChatConfig(){
 const provider=process.env.AI_PROVIDER??'gemini';
 if(provider!=='gemini'&&provider!=='groq')throw new ChatError('CHAT_NOT_CONFIGURED','Select a supported server AI provider.',503);
 const apiKey=(provider==='gemini'?process.env.GOOGLE_GENERATIVE_AI_API_KEY:process.env.GROQ_API_KEY)?.trim();
 const model=provider==='gemini'?GEMINI_MODEL:process.env.GROQ_MODEL??GROQ_MODELS[0];
 if(!apiKey||(provider==='groq'&&!GROQ_MODELS.includes(model as typeof GROQ_MODELS[number])))throw new ChatError('CHAT_NOT_CONFIGURED','The selected answer provider is not configured on the server.',503);
 const rpm=Number(provider==='gemini'?process.env.GEMINI_REQUESTS_PER_MINUTE??'12':process.env.GROQ_REQUESTS_PER_MINUTE??'12');
 if(!Number.isInteger(rpm)||rpm<1||rpm>=(provider==='gemini'?15:30))throw new ChatError('CHAT_NOT_CONFIGURED','Invalid server rate-limit configuration.',503);
 const minSimilarity=Number(process.env.RAG_MIN_SIMILARITY??'0.5');
 if(!Number.isFinite(minSimilarity)||minSimilarity<0||minSimilarity>1||process.env.RAG_MIN_SIMILARITY?.trim()==='')throw new ChatError('CHAT_NOT_CONFIGURED','Chat is not configured on the server.',503);
 return {provider,apiKey,model,minSimilarity};
}
export function selectedLanguageModel(config=getChatConfig()){
 const model=config.provider==='gemini'?createGoogle({apiKey:config.apiKey,fetch:geminiFetch})(config.model):createGroq({apiKey:config.apiKey,fetch:groqFetch})(config.model);
 const providerOptions=config.provider==='groq'?{groq:{structuredOutputs:true,strictJsonSchema:true,parallelToolCalls:false,reasoningEffort:'low'} satisfies GroqLanguageModelChatOptions}:undefined;
 return {model,providerOptions};
}
