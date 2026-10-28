import {test} from './test-context';
import {mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDocument} from '../src/lib/parse-document';
import {ingestDocument,DocumentError} from '../src/lib/document-lifecycle';
import pool from '../src/lib/db';
const policy='Fictional QA policy: minimum team sales target is 15 units.';
test('real PDF and DOCX parsers extract the fictional policy without mocked parsing',async()=>{
 for(const extension of ['pdf','docx']){const bytes=await readFile(new URL(`./fixtures/fictional-policy.${extension}`,import.meta.url));const text=await parseDocument(bytes,`.${extension}`);assert.ok(text.includes(policy));}
});
test('invalid PDF and DOCX content fails safely before embedding, files or publication',async()=>{
 const calls:string[]=[];let released=0;
 mock.method(pool,'connect',async()=>({query:async(sql:string)=>{calls.push(sql);return {rows:[]};},release:()=>{released++;}}));
 try{
 for(const extension of ['pdf','docx'])await assert.rejects(ingestDocument(`fictional-invalid.${extension}`,Buffer.from('fictional invalid file, not a real document'),new AbortController().signal,undefined,{parse:parseDocument,embed:async()=>assert.fail('invalid parsing must precede embedding'),save:async()=>assert.fail('invalid parsing must precede saving'),remove:async()=>assert.fail('no staged file exists')}),(error:unknown)=>error instanceof DocumentError&&error.code==='INVALID_CONTENT'&&error.status===422);
 assert.equal(released,2);assert.equal(calls.filter(sql=>sql==='ROLLBACK').length,2);assert.ok(!calls.some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
 }finally{mock.restoreAll();}
});
