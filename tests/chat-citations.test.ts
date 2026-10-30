import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('document excerpts are visible by default in both modes and untrusted text stays escaped',async()=>{
 const script=`import {createRequire} from 'node:module';const require=createRequire(process.cwd()+'/package.json');const React=require('react');globalThis.React=React;const {renderToStaticMarkup}=require('react-dom/server');const {ChatCitations}=await import(process.cwd()+'/app/components/chat-citations.tsx');const sources=['S1','D1'].map(id=>({id,type:'document',filename:'fictional.pdf',chunkIndex:0,pageNumber:1,text:'<script>unsafe()</script>',quotes:['<script>unsafe()</script>']}));process.stdout.write(renderToStaticMarkup(React.createElement(ChatCitations,{sources})));`;
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','--eval',script],{env});
 assert.equal((stdout.match(/<details class="chat-source" open=""/g)||[]).length,2,stdout);assert.equal((stdout.match(/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/g)||[]).length,2);assert.doesNotMatch(stdout,/<script>/);assert.match(stdout,/\[S1\]/);assert.match(stdout,/\[D1\]/);
});
