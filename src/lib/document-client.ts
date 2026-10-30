import { z } from 'zod';
import { AuthUiError, getBrowserSession } from './auth-client';
const idSchema = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807'));
export const documentSchema = z.object({ id: idSchema, filename: z.string(), status: z.string(), uploadedAt: z.iso.datetime().nullable(), version: z.number().int().positive(), fileType: z.enum(['pdf','docx','unknown']) });
export type DocumentItem = z.infer<typeof documentSchema>;
const pageSchema = z.object({ success: z.literal(true), documents: z.array(documentSchema).max(50), nextCursor: idSchema.nullable() });
const mutationSchema = z.object({ success: z.literal(true), documentId: idSchema, version: z.number().int().positive().optional(), cleanupPending: z.boolean().optional() });
const messages: Record<string, string> = {
  DUPLICATE_DOCUMENT: 'An identical active document already exists. No duplicate was added.',
  INVALID_FILE: 'Choose a PDF or DOCX file between 1 byte and 10 MiB.',
  INVALID_CONTENT: 'This file could not be read. Choose a valid PDF or DOCX document.',
  EMPTY_DOCUMENT: 'This document has no readable text.',
  DOCUMENT_NOT_FOUND: 'This document is no longer available. Refresh the list.',
  DOCUMENT_BUSY: 'Another document operation is running. Wait a moment, then try again.',
  CSRF_REJECTED: 'This request could not be verified. Refresh the page and try again.',
  DOCUMENT_TIMEOUT: 'Processing timed out. Refresh the list to check the result before trying again.',
  CONNECTION_FAILED: 'The connection was interrupted. Refresh the list to check the result before trying again.',
  DOCUMENT_LIST_FAILED: 'Documents could not be loaded. Please try again.',
  DOCUMENT_FAILED: 'The document operation failed. Refresh the list to check the current version.',
};
export class DocumentUiError extends Error {
  constructor(public code: string) { super(messages[code] ?? 'The document request could not be completed. Please try again.'); }
}
export function validateDocumentFile(file: File) {
  if (!file || !/\.(pdf|docx)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024 || file.name.length > 255 || /[\\/\x00-\x1f]/.test(file.name)) throw new DocumentUiError('INVALID_FILE');
  return file;
}
function failure(status: number, body: unknown): never {
  if (status === 401) throw new AuthUiError('UNAUTHENTICATED');
  const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : '';
  throw new DocumentUiError(status === 409 ? 'DUPLICATE_DOCUMENT' : Object.hasOwn(messages,code) ? code : status === 403 ? 'CSRF_REJECTED' : 'DOCUMENT_FAILED');
}
export async function fetchDocuments(before?: string, signal?: AbortSignal) {
  if (before) idSchema.parse(before);
  let response: Response;
  try { response = await fetch(`/api/documents?limit=10${before ? `&before=${encodeURIComponent(before)}` : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }); }
  catch { throw new DocumentUiError('DOCUMENT_LIST_FAILED'); }
  let body;
  try { body = await response.json(); } catch { throw new DocumentUiError('DOCUMENT_LIST_FAILED'); }
  if (!response.ok) failure(response.status,body);
  const parsed = pageSchema.safeParse(body); if (!parsed.success) throw new DocumentUiError('DOCUMENT_LIST_FAILED');
  return parsed.data;
}
export type DocumentProgress = { phase: 'session' | 'uploading' | 'processing' | 'deleting'; percent?: number };
// XHR exposes real upload-byte progress. It never invents a processing percentage.
export async function mutateDocument(action: 'upload' | 'replace' | 'delete', options: { file?: File; id?: string; signal?: AbortSignal; onProgress?: (progress: DocumentProgress) => void }) {
  if (action !== 'upload') idSchema.parse(options.id);
  if (action !== 'delete') validateDocumentFile(options.file!);
  options.onProgress?.({phase:'session'});
  const session = await getBrowserSession();
  options.signal?.throwIfAborted();
  const path = action === 'upload' ? '/api/upload' : `/api/documents/${options.id}`;
  return new Promise<z.infer<typeof mutationSchema>>((resolve,reject) => {
    const xhr = new XMLHttpRequest();
    const finish = (error?: unknown, result?: z.infer<typeof mutationSchema>) => {
      options.signal?.removeEventListener('abort',abort);
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => xhr.abort();
    xhr.open(action === 'upload' ? 'POST' : action === 'replace' ? 'PUT' : 'DELETE',path);
    xhr.withCredentials = true; xhr.timeout = 130_000;
    xhr.setRequestHeader('X-CSRF-Token',session.csrfToken);
    xhr.onload = () => {
      try {
        let body; try { body = JSON.parse(xhr.responseText); } catch { throw new DocumentUiError('DOCUMENT_FAILED'); }
        if (xhr.status < 200 || xhr.status >= 300) failure(xhr.status,body);
        const parsed = mutationSchema.safeParse(body); if (!parsed.success || (action !== 'delete' && parsed.data.version === undefined)) throw new DocumentUiError('DOCUMENT_FAILED');
        finish(undefined,parsed.data);
      } catch (error) { finish(error); }
    };
    xhr.onerror = () => finish(new DocumentUiError('CONNECTION_FAILED'));
    xhr.ontimeout = () => finish(new DocumentUiError('DOCUMENT_TIMEOUT'));
    xhr.onabort = () => finish(new DocumentUiError('CONNECTION_FAILED'));
    options.signal?.addEventListener('abort',abort,{once:true});
    if (action === 'delete') { options.onProgress?.({phase:'deleting'}); xhr.send(); }
    else {
      xhr.upload.onprogress = event => options.onProgress?.({phase:'uploading',percent:event.lengthComputable ? Math.round(event.loaded/event.total*100) : undefined});
      xhr.upload.onload = () => options.onProgress?.({phase:'processing'});
      options.onProgress?.({phase:'uploading'});
      const form = new FormData(); form.set('file',options.file!); xhr.send(form);
    }
  });
}
