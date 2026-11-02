import {randomUUID} from 'node:crypto';
import {ChatError} from './chat-errors';
import {abortable} from './agent-budget';
import {logEvent,requestContext} from './reliability';
import {providerUsage} from './provider-usage';
export const OLLAMA_CHAT_MODEL='qwen3.5:4b';
export function localOllamaConfig(){
 try{
  const url=new URL(process.env.OLLAMA_LLM_BASE_URL??'http://127.0.0.1:11434');
  if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error();
  const context=Number(process.env.OLLAMA_LLM_CONTEXT_TOKENS??16384);
  if(!Number.isSafeInteger(context)||context<4096||context>32768)throw Error();
  if(process.env.OLLAMA_LLM_MODEL&&process.env.OLLAMA_LLM_MODEL!==OLLAMA_CHAT_MODEL)throw Error();
  return {baseURL:url.origin,context};
 }catch{throw new ChatError('CHAT_NOT_CONFIGURED','Configure a loopback Ollama endpoint and supported local context.',503);}
}
let active=0;
// The official compatible SDK supplies the wire contract; only local native API
// translation lives here, so think/num_ctx are explicit, not silently ignored.
export const ollamaFetch:typeof fetch=async(_input,init)=>{
 const start=performance.now();let claimed=false;
 try{
  const config=localOllamaConfig();
  if(active>=2)throw new ChatError('LOCAL_MODEL_BUSY','The local answer service is busy. Please try again.',503);
  active++;claimed=true;
  const signal=AbortSignal.any([init?.signal??new AbortController().signal,AbortSignal.timeout(30000)]);
  signal.throwIfAborted();
  if(typeof init?.body!=='string'||Buffer.byteLength(init.body)>200000)throw Error();
  const body=JSON.parse(init.body);
  if(body.model!==OLLAMA_CHAT_MODEL||body.stream||!Array.isArray(body.messages))throw Error();
  const max=body.max_tokens??body.max_completion_tokens??3000;
  if(!Number.isInteger(max)||max<1||max>3000)throw Error();
  const names=new Map<string,string>();
  const messages=body.messages.map((message:{role:string;content:unknown;tool_calls?:Array<{id:string;function:{name:string;arguments:string}}> ;tool_call_id?:string})=>{
   const calls=message.tool_calls?.map(call=>{names.set(call.id,call.function.name);return {id:call.id,type:'function',function:{name:call.function.name,arguments:JSON.parse(call.function.arguments)}};});
   return {role:message.role,content:message.content??'',...(calls?{tool_calls:calls}:{}),...(message.role==='tool'?{tool_name:names.get(message.tool_call_id??'')}: {})};
  });
  const format=body.response_format?.json_schema?.schema??(body.response_format?.type==='json_object'?'json':undefined);
  // Byte-based upper guard plus template allowance; never silently trim evidence.
  const size=Buffer.byteLength(JSON.stringify({messages,tools:body.tools,format}));
  if(size+1024+64*messages.length+max>config.context)throw new ChatError('LOCAL_CONTEXT_LIMIT','The evidence exceeds the configured local context. Please narrow the question.',413);
  const result=await abortable(()=>globalThis.fetch(config.baseURL+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal,body:JSON.stringify({model:OLLAMA_CHAT_MODEL,messages,tools:body.tools,format,stream:false,think:false,options:{num_ctx:config.context,num_predict:max,temperature:0}})}),signal);
  if(!result.ok)throw new ChatError('LOCAL_MODEL_UNAVAILABLE','The local answer model is unavailable. Check the Ollama service and installed model.',503);
  const reader=result.body?.getReader();if(!reader)throw Error();
  let text='',sizeRead=0;
  try{const decoder=new TextDecoder();while(true){const part=await abortable(()=>reader.read(),signal);if(part.done){text+=decoder.decode();break;}sizeRead+=part.value.length;if(sizeRead>1000000)throw Error();text+=decoder.decode(part.value,{stream:true});}}finally{void reader.cancel().catch(()=>{});}
  const data=JSON.parse(text);if(data.done!==true||!data.message||typeof data.message.content!=='string')throw Error();
  const toolCalls=data.message.tool_calls?.map((call:{id?:string;function:{name:string;arguments:unknown}})=>{
   if(typeof call.function?.name!=='string'||!call.function.arguments||typeof call.function.arguments!=='object'||Array.isArray(call.function.arguments))throw Error();
   return {id:call.id??randomUUID(),type:'function',function:{name:call.function.name,arguments:JSON.stringify(call.function.arguments)}};
  });
  const numeric=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0?Number(n):undefined;
  const prompt=numeric(data.prompt_eval_count),completion=numeric(data.eval_count);
  const total=prompt!==undefined&&completion!==undefined?prompt+completion:undefined;
  providerUsage('ollama',0,total??null,200,{},requestContext()?.modelPhase);
  logEvent('ollama-http',start);
  return Response.json({id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),model:OLLAMA_CHAT_MODEL,choices:[{index:0,message:{role:'assistant',content:data.message.content,...(toolCalls?.length?{tool_calls:toolCalls}:{})},finish_reason:data.done_reason==='length'?'length':data.done_reason==='stop'?toolCalls?.length?'tool_calls':'stop':'error'}],usage:{prompt_tokens:prompt,completion_tokens:completion,total_tokens:total}});
 }catch(error){
  const safe=error instanceof ChatError?error:init?.signal?.aborted?init.signal.reason:error instanceof Error&&['AbortError','TimeoutError'].includes(error.name)?new ChatError('LOCAL_MODEL_TIMEOUT','The local answer model exceeded its time limit. Please try a smaller question.',504):new ChatError('LOCAL_MODEL_UNAVAILABLE','The local answer model could not complete this request.',503);
  logEvent('ollama-http',start,'error',undefined,safe);throw safe;
 }finally{if(claimed)active--;}
};
