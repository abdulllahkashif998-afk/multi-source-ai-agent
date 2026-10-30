import {rateLimitGuidance} from '@/src/lib/rate-limit-guidance';
import { authenticated } from '@/src/lib/auth';
import { diagnoseAgent } from '@/src/lib/agent-diagnostics';
import { readQuestion } from '@/src/lib/chat-handler';
import { ChatError } from '@/src/lib/chat-errors';
import { answerWithAgent } from '@/src/lib/knowledge-agent';
async function handlePOST(request: Request) {
 const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
 let stage = 'question-validation';
 try {
   const question = await readQuestion(request);
   stage = 'agent-invocation';
   const result = await answerWithAgent(question, signal);
   signal.throwIfAborted();
   return Response.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
 } catch (error) {
   diagnoseAgent(stage, error);
   const timedOut = signal.aborted || (error instanceof Error && ['AbortError','TimeoutError'].includes(error.name));
   const status = timedOut ? 504 : error instanceof ChatError ? error.status : 502;
   const retry=rateLimitGuidance(error);
   return Response.json({ success: false, code: timedOut ? 'AGENT_TIMEOUT' : error instanceof ChatError ? error.code : 'AGENT_FAILED', error: timedOut ? 'Agent request timed out.' : error instanceof ChatError ? error.message : 'Agent could not complete a grounded answer. Please try again.',...retry.body }, { status, headers: { 'Cache-Control': 'no-store',...retry.headers } });
 }
}

export const POST=authenticated(handlePOST);