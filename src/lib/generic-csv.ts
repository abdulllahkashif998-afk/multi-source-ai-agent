import { measure } from './reliability';
import { timedQuery } from './db';
import { requireUserId } from './identity';
import { parse } from 'csv-parse/sync';
import { planSchema } from './csv-query-schema';
export { planSchema } from './csv-query-schema';
import pool from './db';

export type Column = { name: string; type: 'number' | 'boolean' | 'text' };
export function prepareCSV(content: string) {
  if (Buffer.byteLength(content) > 10 * 1024 * 1024) throw new Error('CSV too large');
  const records = parse(content, { bom: true, trim: true, skip_empty_lines: true, max_record_size: 100_000 }) as string[][];
  const headers = records.shift();
  if (!headers?.length || headers.length > 100 || headers.some(h => !h || h.length > 200) || new Set(headers).size !== headers.length) throw new Error('Invalid or duplicate headers');
  if (!records.length || records.length > 10_000 || records.some(r => r.length !== headers.length)) throw new Error('Invalid row count or shape');
  const columns: Column[] = headers.map((name, i) => {
    const values = records.map(r => r[i]).filter(v => v !== '');
    const numeric = (v: string) => /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= Number.MAX_SAFE_INTEGER;
    return { name, type: values.length && values.every(numeric) ? 'number' : values.length && values.every(v => v === 'true' || v === 'false') ? 'boolean' : 'text' };
  });
  const rows = records.map(r => Object.fromEntries(columns.map((c, i) => [c.name, r[i] === '' ? null : c.type === 'number' ? Number(r[i]) : c.type === 'boolean' ? r[i] === 'true' : r[i]])));
  return { columns, rows };
}
export async function importGenericCSV(userId: number | string, filename: string, content: string) {
  if(String(userId)!==requireUserId()) throw new Error('Owner scope mismatch');
  const { columns, rows } = prepareCSV(content);
  const client = await pool.connect();
  try {
    await timedQuery(()=>client.query('BEGIN'));
    await timedQuery(()=>client.query("SET LOCAL statement_timeout = '10s'"));
    const result = await timedQuery(()=>client.query("INSERT INTO generic_csv_datasets(user_id,filename,columns,status) VALUES($1,$2,$3,'importing') RETURNING id", [userId, filename, JSON.stringify(columns)]));
    const id = result.rows[0].id;
    await timedQuery(()=>client.query('INSERT INTO generic_csv_rows(dataset_id,row_index,data) SELECT $1, ordinality - 1, value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY', [id, JSON.stringify(rows)]));
    await timedQuery(()=>client.query("UPDATE generic_csv_datasets SET status='ready',row_count=$2 WHERE id=$1", [id, rows.length]));
    await timedQuery(()=>client.query('COMMIT'));
    return { datasetId: id, importedRows: rows.length, columns };
  } catch (e) { await timedQuery(()=>client.query('ROLLBACK')); throw e; } finally { client.release(); }
}
export function compileCSVQuery(input: unknown, columns: Column[]) {
  const plan = planSchema.parse(input);
  const values: unknown[] = [plan.datasetId];
  const param = (v: unknown) => { values.push(v); return `$${values.length}`; };
  const column = (name: string) => {
    const c = columns.find(c => c.name === name);
    if (!c) throw new Error('Unknown column');
    const expression = `(data ->> ${param(name)}::text)`;
    return { c, expression: c.type === 'number' ? `${expression}::numeric` : c.type === 'boolean' ? `${expression}::boolean` : expression };
  };
  const conditions = plan.filters.map(f => {
    const { c, expression } = column(f.column);
    if (typeof f.value !== (c.type === 'text' ? 'string' : c.type) || (c.type === 'boolean' && !['eq','ne'].includes(f.op))) throw new Error('Invalid filter type');
    const operators = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
    return `${expression} ${operators[f.op]} ${param(f.value)}`;
  });
  if (plan.aggregate && plan.groupBy.includes('value')) throw new Error('Group column conflicts with aggregate output value');
  const groups = [...new Set(plan.groupBy)].map(name => ({ name, expression: column(name).expression }));
  if (groups.length && !plan.aggregate) throw new Error('Grouping requires aggregation');
  let select = 'data';
  if (plan.aggregate) {
    const a = plan.aggregate;
    let expression = 'COUNT(*)';
    if (a.op !== 'count') {
      if (!a.column) throw new Error('Aggregate column required');
      const c = column(a.column);
      if (c.c.type !== 'number') throw new Error('Numeric column required');
      expression = `${a.op === 'sum' ? 'SUM' : 'AVG'}(${c.expression})`;
    } else if (a.column !== undefined) throw new Error('Count counts rows; omit column');
    select = `jsonb_build_object(${[...groups.flatMap(g => [`${param(g.name)}::text`,g.expression]), "'value'", expression].join(',')}) AS data`;
  }
  let order = '';
  if (plan.sort) {
    let expression: string;
    if (plan.aggregate) {
      if (plan.sort.column === 'value') expression = "(data ->> 'value')::numeric";
      else { if (!groups.some(g => g.name === plan.sort!.column)) throw new Error('Sort must use group or value'); expression = column(plan.sort.column).expression; }
    } else expression = column(plan.sort.column).expression;
    order = ` ORDER BY ${expression} ${plan.sort.direction === 'asc' ? 'ASC' : 'DESC'}`;
  }
  const text = `SELECT data FROM (SELECT ${select} FROM generic_csv_rows WHERE dataset_id=$1 ${conditions.length ? 'AND ' + conditions.join(' AND ') : ''}${groups.length ? ' GROUP BY ' + groups.map(g => g.expression).join(',') : ''}) AS result${order} LIMIT ${param(plan.limit)}`;
  // Non-aggregate sorting must refer to JSON in the outer result, as above.
  return { text, values };
}
export async function discoverDatasets(userId: number | string,signal?:AbortSignal) {
  signal?.throwIfAborted();
  if(String(userId)!==requireUserId()) throw new Error('Owner scope mismatch');
  const client = await pool.connect();
  try {
    signal?.throwIfAborted();
    await timedQuery(()=>client.query('BEGIN READ ONLY'));
    await timedQuery(()=>client.query("SET LOCAL statement_timeout = '5s'"));
    const result = await timedQuery(()=>client.query("SELECT id,filename,columns,row_count FROM generic_csv_datasets WHERE user_id=$1 AND status='ready' ORDER BY id LIMIT 100", [userId]));
    signal?.throwIfAborted();
    await timedQuery(()=>client.query('COMMIT'));
    return result.rows;
  } catch(e) { await timedQuery(()=>client.query('ROLLBACK')); throw e; } finally { client.release(); }
}
export async function queryDataset(userId: number | string, input: unknown,signal?:AbortSignal) {
 signal?.throwIfAborted();
 return measure('csv-query',async()=>(await executeDatasetQuery(userId,input,signal)).rows);
}
export async function queryDatasetSnapshot(userId:number|string,input:unknown,signal?:AbortSignal){
 signal?.throwIfAborted();return measure('csv-query',()=>executeDatasetQuery(userId,input,signal,true));
}
async function executeDatasetQuery(userId: number | string, input: unknown,signal?:AbortSignal,metadata=false) {
  if(String(userId)!==requireUserId()) throw new Error('Owner scope mismatch');
  const plan = planSchema.parse(input);
  const client = await pool.connect();
  try {
    signal?.throwIfAborted();
    await timedQuery(()=>client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
    await timedQuery(()=>client.query("SET LOCAL statement_timeout = '5s'"));
    const scoped = await timedQuery(()=>client.query<{id:string;filename:string;columns:Column[];row_count:number}>(metadata?"SELECT id::text,filename,columns,row_count FROM generic_csv_datasets WHERE id=$1 AND user_id=$2 AND status='ready'":"SELECT columns FROM generic_csv_datasets WHERE id=$1 AND user_id=$2 AND status='ready'", [plan.datasetId,userId]));
    if (!scoped.rows.length) throw new Error('Dataset unavailable');
    signal?.throwIfAborted();
    const query = compileCSVQuery(plan, scoped.rows[0].columns);
    const result = await timedQuery(()=>client.query(query));
    signal?.throwIfAborted();
    await timedQuery(()=>client.query('COMMIT'));
    return {rows:result.rows.map(r => r.data),dataset:scoped.rows[0]};
  } catch(e) { await timedQuery(()=>client.query('ROLLBACK')); throw e; } finally { client.release(); }
}
