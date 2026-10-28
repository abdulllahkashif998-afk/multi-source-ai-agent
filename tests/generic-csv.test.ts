import { runWithIdentity } from '../src/lib/identity';
import { test } from './test-context';
import assert from 'node:assert/strict';
import { prepareCSV, compileCSVQuery } from '../src/lib/generic-csv';
test('fictional schemas infer numbers, booleans, nulls, and preserve identifiers', () => {
 const result = prepareCSV('product,price,active,code\nWidget,12.5,true,001\nGadget,,false,002');
 assert.deepEqual(result.columns.map(c=>c.type), ['text','number','boolean','text']);
 assert.equal(result.rows[1].price,null);
});
test('invalid and empty inputs fail', () => {
 for(const csv of ['', 'a,b', 'a,a\n1,2', ',b\n1,2', 'a,b\n1']) assert.throws(()=>prepareCSV(csv));
});
test('query plans parameterize hostile column names and filter values', () => {
 const columns=prepareCSV('name,amount\nFictional,12').columns;
 const query=compileCSVQuery({datasetId:'1',filters:[{column:'name',op:'eq',value:"x'; DROP TABLE users; --"}],aggregate:{op:'sum',column:'amount'}},columns);
 assert.ok(!query.text.includes('DROP'));
 assert.ok(query.values.includes("x'; DROP TABLE users; --"));
});
test('reject unknown columns, SQL plans, bad aggregate types and excessive limits', () => {
 const columns=prepareCSV('name,amount\nFictional,12').columns;
 for(const plan of [{datasetId:'1',sql:'SELECT 1'}, {datasetId:'1',limit:101}, {datasetId:'1',aggregate:{op:'sum',column:'name'}}, {datasetId:'1',sort:{column:'secret',direction:'asc'}}, {datasetId:'1',filters:[{column:'amount',op:'eq',value:'12'}]}]) assert.throws(()=>compileCSVQuery(plan,columns));
});
test('denies foreign or incomplete datasets before querying rows and rolls back read-only work', async () => {
 const { mock } = await import('node:test');
 const { default: pool } = await import('../src/lib/db');
 const { queryDataset } = await import('../src/lib/generic-csv');
 const calls: string[] = [];
 let released = false;
 mock.method(pool, 'connect', async () => ({
   query: async (sql: string, values?: unknown[]) => {
     calls.push(sql);
     if (sql.startsWith('SELECT columns')) {
       assert.deepEqual(values, ['7', 2]);
       assert.match(sql, /user_id=\$2/);
       assert.match(sql, /status='ready'/);
     }
     return { rows: [] };
   },
   release: () => { released = true; },
 }));
 try {
   await assert.rejects(runWithIdentity('2',()=>queryDataset(2, { datasetId: '7' })), /unavailable/);
   assert.equal(calls[0], 'BEGIN READ ONLY');
   assert.ok(calls.some(s => s.includes('statement_timeout')));
   assert.ok(!calls.some(s => s.includes('FROM generic_csv_rows')));
   assert.equal(calls.at(-1), 'ROLLBACK');
   assert.equal(released, true);
 } finally { mock.restoreAll(); }
});
