import {agentModelToolInputs} from './agent-tool-inputs';
// Inspect only standard JSON tool envelopes. Never execute, repair, print or
// return provider-generated arguments/messages/failed_generation to the client.
export function providerToolDiagnostic(error:unknown){
 const e=error as {statusCode?:number;responseBody?:unknown};
 if(e?.statusCode!==400||typeof e.responseBody!=='string'||e.responseBody.length>8192)return undefined;
 try{
  const body=JSON.parse(e.responseBody);
  if(body?.error?.code!=='tool_use_failed')return undefined;
  const raw=body.error.failed_generation;
  if(typeof raw!=='string'||raw.length>6000)return {reason:'unavailable_envelope'};
  let envelope;try{envelope=JSON.parse(raw);}catch{return {reason:'unrecognized_envelope',envelopeShape:'non_json'};}
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))return {reason:'unrecognized_envelope',envelopeShape:'non_object'};
  if(!Object.hasOwn(envelope,'tool_calls'))return {reason:'unrecognized_envelope',envelopeShape:'missing_calls'};
  const calls=envelope.tool_calls;
  if(!Array.isArray(calls))return {reason:'unrecognized_envelope',envelopeShape:'invalid_calls_type'};
  if(calls.length!==1)return {reason:'unrecognized_envelope',envelopeShape:calls.length?'multiple_calls':'empty_calls',callCount:Math.min(calls.length,10)};
  const call=calls[0];
  if(!call||typeof call!=='object'||Array.isArray(call))return {reason:'unrecognized_envelope',envelopeShape:'invalid_call'};
  const fn=call.function;
  if(!fn||typeof fn!=='object'||Array.isArray(fn))return {reason:'unrecognized_envelope',envelopeShape:'invalid_function'};
  const name=fn.name;
  if(typeof name!=='string'||!Object.hasOwn(agentModelToolInputs,name))return {reason:'unknown_tool'};
  const tool=name as keyof typeof agentModelToolInputs;
  let args=fn.arguments;
  if(typeof args==='string'){try{args=JSON.parse(args);}catch{return {tool,reason:'invalid_arguments_json'};}}
  const parsed=agentModelToolInputs[tool].safeParse(args);
  if(parsed.success)return {tool,reason:'valid_input_shape'};
  const fields=new Set(['datasetId','filters','column','op','value','groupBy','aggregate','sort','direction','limit','question','evidenceComplete']);
  return {tool,reason:'invalid_input_shape',violations:parsed.error.issues.slice(0,5).map(issue=>({field:issue.path.map(part=>typeof part==='number'?'item':fields.has(String(part))?String(part):'field').join('.')||'root',code:issue.code}))};
 }catch{return undefined;}
}
