import {withProviderDeadline} from './provider-deadline';
import {rateLimitGuidance} from './rate-limit-guidance';
import { measure, logEvent } from './reliability';
import { z } from "zod";
import { ChatError } from "./chat-errors";
import type { DocumentSearchResult } from "./search-documents";
import { insufficientEvidence, selectEvidence, validateGroundedAnswer, type EvidenceSource } from "./rag-answer";

const MAX_BODY_BYTES = 16 * 1024;
const questionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
}).strict();

interface ChatDependencies {
  getConfig: () => { minSimilarity: number };
  search: (question: string, signal: AbortSignal) => Promise<DocumentSearchResult[]>;
  generate: (question: string, evidence: EvidenceSource[], signal: AbortSignal) => Promise<unknown>;
}

export async function readQuestion(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ChatError("INVALID_CONTENT_TYPE", "Send an application/json request.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError("INVALID_QUESTION", "Provide a question of 1 to 2000 characters.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ChatError("REQUEST_TOO_LARGE", "Request body must not exceed 16 KiB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ChatError("INVALID_JSON", "Send a valid JSON body.", 400);
  }
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ChatError("INVALID_QUESTION", "Provide only a question of 1 to 2000 characters.", 400);
  }
  return parsed.data.question;
}

export function createChatHandler(dependencies: ChatDependencies) {
  return async function POST(request: Request) {
    const deadline=Date.now()+45_000;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
    let stage: "request" | "retrieval" | "generation" | "citation-verification" = "request";
    let stageStarted=performance.now();
    try {
      const question = await readQuestion(request);
      const { minSimilarity } = dependencies.getConfig();
      stage = "retrieval";
      stageStarted=performance.now();
      const results = await measure('retrieval',()=>dependencies.search(question, signal));
      signal.throwIfAborted();
      const evidence = selectEvidence(results, minSimilarity);
      if (evidence.length === 0) {
        return Response.json({ success: true, ...insufficientEvidence() }, { headers: { "Cache-Control": "no-store" } });
      }
      stage = "generation";
      stageStarted=performance.now();
      const generated = await measure('final-generation',()=>withProviderDeadline(deadline,()=>dependencies.generate(question, evidence, signal)));
      signal.throwIfAborted();
      stage = "citation-verification";
      stageStarted=performance.now();
      const answer = validateGroundedAnswer(generated, evidence);
      logEvent('citation-verification',stageStarted);
      return Response.json({ success: true, ...answer }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      logEvent(stage,stageStarted,'error',undefined,error);
      let failure: ChatError;
      if (signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
        failure = new ChatError("CHAT_TIMEOUT", "The request timed out or was cancelled. Please try again.", 504);
      } else if (error instanceof ChatError) {
        failure = error;
      } else if (stage === "retrieval") {
        failure = new ChatError("RETRIEVAL_FAILED", "Document retrieval is temporarily unavailable. Please try again.", 503);
      } else if (stage === "generation" || stage === "citation-verification") {
        failure = new ChatError("GENERATION_FAILED", "The answer service is temporarily unavailable. Please try again.", 502);
      } else {
        failure = new ChatError("INVALID_REQUEST", "Could not read the request.", 400);
      }
      // Do not log or return provider errors, keys, prompts, or document text.
      const retry=rateLimitGuidance(failure);
      return Response.json({ success: false, code: failure.code, error: failure.message,...retry.body }, {
        status: failure.status,
        headers: { "Cache-Control": "no-store",...retry.headers },
      });
    }
  };
}
