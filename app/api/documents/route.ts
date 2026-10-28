import { authenticated } from '@/src/lib/auth';
import { ChatError } from '@/src/lib/chat-errors';
import { listDocuments, readDocumentPagination } from '@/src/lib/list-documents';
export const GET = authenticated(async (request: Request) => {
  try {
    return Response.json({ success: true, ...await listDocuments(readDocumentPagination(request.url)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ success: false, code: error instanceof ChatError ? error.code : 'DOCUMENT_LIST_FAILED', error: error instanceof ChatError ? error.message : 'Documents could not be loaded. Please try again.' }, { status: error instanceof ChatError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
  }
});
