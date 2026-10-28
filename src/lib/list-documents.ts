import 'server-only';
import { z } from 'zod';
import pool, { timedQuery } from './db';
import { requireUserId } from './identity';
import { ChatError } from './chat-errors';

const id = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807'));
const pagination = z.object({ limit: z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(1).max(50)).default(20), before: id.optional() }).strict();
export function readDocumentPagination(url: string) {
  const params = new URL(url).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new ChatError('INVALID_PAGINATION', 'Invalid document pagination.', 400);
  const parsed = pagination.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new ChatError('INVALID_PAGINATION', 'Use a limit from 1 to 50 and a valid document cursor.', 400);
  return parsed.data;
}
export async function listDocuments(options: { limit: number; before?: string }) {
  const userId = requireUserId();
  // Validate again at the service boundary; callers cannot remove the row bound.
  const { limit, before } = readDocumentPagination(`http://internal/?limit=${options.limit}${options.before === undefined ? '' : `&before=${encodeURIComponent(options.before)}`}`);
  const client = await pool.connect();
  try {
    await timedQuery(() => client.query('BEGIN READ ONLY'));
    await timedQuery(() => client.query("SET LOCAL statement_timeout = '5s'"));
    const result = await timedQuery(() => client.query<{ id: string; filename: string; status: string; uploadedAt: Date | null; version: number }>(
      `SELECT id::text AS id,filename,status,uploaded_at AS "uploadedAt",version
       FROM documents WHERE user_id=$1 AND status NOT IN ('deleted','superseded')
       AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT $3`,
      [userId, before ?? null, limit + 1],
    ));
    await timedQuery(() => client.query('COMMIT'));
    const documents = result.rows.slice(0, limit).map(row => ({
      id: row.id, filename: row.filename, status: row.status,
      uploadedAt: row.uploadedAt ? new Date(row.uploadedAt).toISOString() : null,
      version: row.version,
      fileType: /\.pdf$/i.test(row.filename) ? 'pdf' as const : /\.docx$/i.test(row.filename) ? 'docx' as const : 'unknown' as const,
    }));
    return { documents, nextCursor: result.rows.length > limit ? documents.at(-1)!.id : null };
  } catch (error) { await timedQuery(() => client.query('ROLLBACK')); throw error; }
  finally { client.release(); }
}
