import { authenticated } from '@/src/lib/auth';
import { createChatHandler } from "@/src/lib/chat-handler";
import { generateEvidenceAnswer, getChatConfig } from "@/src/lib/gemini";
import { searchDocuments } from "@/src/lib/search-documents";

const handler = createChatHandler({
  getConfig: getChatConfig,
  search: searchDocuments,
  generate: generateEvidenceAnswer,
});

export const POST=authenticated(handler);
