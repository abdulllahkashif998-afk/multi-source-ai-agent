import assert from "node:assert/strict";
import { afterEach, mock} from 'node:test';
import { test, sessionHeaders, sessionRow } from './test-context';
import { POST } from "../app/api/chat/route";
import { createChatHandler } from "../src/lib/chat-handler";
import { ChatError } from "../src/lib/chat-errors";
import pool from "../src/lib/db";
import { GEMINI_MODEL, getChatConfig } from "../src/lib/gemini";
import { INSUFFICIENT_EVIDENCE, selectEvidence, validateGroundedAnswer } from "../src/lib/rag-answer";
import type { DocumentSearchResult } from "../src/lib/search-documents";

const row: DocumentSearchResult = {
  document_id: "9007199254740993",
  chunk_id: "22",
  filename: "policy.docx",
  chunk_index: 0,
  page_number: null,
  chunk_text: "Employees receive 20 days of annual leave. Approval is required.",
  similarity: 0.83,
};
const generated = {
  answerable: true,
  statements: [{
    text: "Employees receive 20 days of annual leave.",
    citations: [{ sourceId: "S1", quote: "Employees receive 20 days of annual leave." }],
  }],
};
const originalEnv = { ...process.env };
afterEach(() => {
  mock.restoreAll();
  for (const key of ["NODE_ENV", "GOOGLE_GENERATIVE_AI_API_KEY", "RAG_MIN_SIMILARITY"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function request(body: unknown = { question: "How much annual leave is available?" }) {
  return new Request("http://localhost/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", ...sessionHeaders }, body: JSON.stringify(body),
  });
}

function handler(overrides: Partial<Parameters<typeof createChatHandler>[0]> = {}) {
  return createChatHandler({
    getConfig: () => ({ minSimilarity: 0.5 }),
    search: async () => [row],
    generate: async () => generated,
    ...overrides,
  });
}

test("validates question shapes before calling any dependency", async () => {
  for (const body of [null, [], {}, { question: null }, { question: 3 }, { question: "   " },
    { question: "x".repeat(2001) }, { question: "Hello", userId: 2 }, { messages: [] }]) {
    const response = await handler({ getConfig: () => { assert.fail("dependencies must not run"); } })(request(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_QUESTION");
  }
});

test("rejects malformed JSON, wrong content type, and missing body", async () => {
  const cases = [
    { init: { body: "{" }, status: 400 },
    { init: { body: "{}", headers: { "Content-Type": "text/plain" } }, status: 415 },
    { init: {}, status: 400 },
  ];
  for (const item of cases) {
    const req = new Request("http://localhost/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, ...item.init,
    });
    assert.equal((await handler()(req)).status, item.status);
  }
});

test("enforces the byte limit even without a content-length header", async () => {
  const response = await handler()(request({ question: "x".repeat(17_000) }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "REQUEST_TOO_LARGE");
});

test("trims valid questions and accepts the 2000 character boundary", async () => {
  const seen: string[] = [];
  const post = handler({ search: async (q) => { seen.push(q); return []; } });
  assert.equal((await post(request({ question: "  policy?  " }))).status, 200);
  assert.equal((await post(request({ question: "x".repeat(2000) }))).status, 200);
  assert.deepEqual(seen, ["policy?", "x".repeat(2000)]);
});

test("returns abstention without calling Gemini for empty or weak retrieval", async () => {
  for (const rows of [[], [{ ...row, similarity: 0.49 }], [{ ...row, chunk_text: " " }], [{ ...row, similarity: NaN }]]) {
    const response = await handler({ search: async () => rows, generate: async () => assert.fail("Gemini must not run") })(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, grounded: false, answer: INSUFFICIENT_EVIDENCE, sources: [] });
  }
});

test("abstains when retrieved evidence does not answer the question", async () => {
  const response = await handler({ generate: async () => ({ answerable: false, statements: [] }) })(request());
  assert.equal((await response.json()).grounded, false);
});

test("builds citations from original database metadata and exact quotes", async () => {
  const response = await handler()(request());
  const result = await response.json();
  assert.equal(result.answer, "Employees receive 20 days of annual leave. [S1]");
  assert.equal(result.grounded, true);
  assert.deepEqual(result.sources, [{ ...selectEvidence([row], 0.5)[0], quotes: [generated.statements[0].citations[0].quote] }]);
  assert.equal(result.sources[0].documentId, "9007199254740993");
  assert.equal(result.sources[0].pageNumber, null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("rejects fabricated sources, altered quotes, empty answers and uncited claims", async () => {
  const invalid = [
    { ...generated, statements: [] },
    { ...generated, statements: [{ text: "A claim.", citations: [] }] },
    { ...generated, statements: [{ text: "A claim.", citations: [{ sourceId: "S9", quote: "Approval is required." }] }] },
    { ...generated, statements: [{ text: "A claim.", citations: [{ sourceId: "S1", quote: "Employees receive 99 days" }] }] },
    { ...generated, statements: [{ text: "A claim. [S99]", citations: generated.statements[0].citations }] },
    "not JSON",
  ];
  for (const output of invalid) {
    const response = await handler({ generate: async () => output })(request());
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "UNSUPPORTED_ANSWER");
  }
});

test("deduplicates cited sources and excludes unused retrieved chunks", () => {
  const evidence = selectEvidence([row, { ...row, chunk_id: "23", page_number: 4 }], 0.5);
  const answer = validateGroundedAnswer({ ...generated, statements: [...generated.statements, ...generated.statements] }, evidence);
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.sources[0].quotes.length, 1);
  assert.equal(evidence[1].pageNumber, 4);
});

test("assigns accurate citations to statements spanning multiple documents", () => {
  const evidence = selectEvidence([row, {
    ...row, document_id: "8", chunk_id: "23", filename: "approval.pdf",
    page_number: 4, chunk_index: 2, chunk_text: "A manager must approve leave requests.",
  }], 0.5);
  const result = validateGroundedAnswer({ answerable: true, statements: [{
    text: "Employees receive 20 days of leave, subject to manager approval.",
    citations: [generated.statements[0].citations[0], { sourceId: "S2", quote: "A manager must approve leave requests." }],
  }] }, evidence);
  assert.equal(result.answer.endsWith("[S1] [S2]"), true);
  assert.deepEqual(result.sources.map(s => [s.id, s.documentId, s.filename, s.pageNumber]), [
    ["S1", row.document_id, "policy.docx", null], ["S2", "8", "approval.pdf", 4],
  ]);
});

test("filters similarity at the configured boundary and bounds context", () => {
  const evidence = selectEvidence([{ ...row, similarity: 0.5, chunk_text: "a".repeat(7000) }], 0.5);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].text.length, 6000);
  assert.equal(selectEvidence([row], 0.9).length, 0);
});

test("sanitizes retrieval, provider, and timeout failures", async () => {
  const secret = "private-key-and-database-details";
  for (const [overrides, status, code] of [
    [{ search: async () => { throw new Error(secret); } }, 503, "RETRIEVAL_FAILED"],
    [{ generate: async () => { throw new Error(secret); } }, 502, "GENERATION_FAILED"],
    [{ generate: async () => { throw new DOMException(secret, "TimeoutError"); } }, 504, "CHAT_TIMEOUT"],
    [{ getConfig: () => { throw new ChatError("CHAT_NOT_CONFIGURED", "Chat is not configured on the server.", 503); } }, 503, "CHAT_NOT_CONFIGURED"],
  ] as const) {
    const response = await handler(overrides)(request());
    assert.equal(response.status, status);
    const result = await response.json();
    assert.equal(result.code, code);
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("honors a cancelled request before generation", async () => {
  const controller = new AbortController();
  const req = new Request(request(), { signal: controller.signal });
  controller.abort();
  const response = await handler({ generate: async () => assert.fail("must not generate") })(req);
  assert.equal(response.status, 504);
});

test("provider configuration requires a server key and valid threshold in every environment", () => {
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  assert.throws(getChatConfig, (e: unknown) => e instanceof ChatError && e.code === "CHAT_NOT_CONFIGURED");
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  for (const value of ["", "NaN", "-0.1", "1.1"]) {
    process.env.RAG_MIN_SIMILARITY = value;
    assert.throws(getChatConfig, ChatError);
  }
  delete process.env.RAG_MIN_SIMILARITY;
  assert.equal(getChatConfig().minSimilarity, 0.5);
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal(getChatConfig().minSimilarity, 0.5);
});

function mockServices(providerStatus = 200, output: unknown = generated, finishReason = "STOP") {
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  delete process.env.RAG_MIN_SIMILARITY;
  let query: { text: string; values: unknown[] } | undefined;
  mock.method(pool, "query", async (config: typeof query|string) => { if((typeof config==='string'?config:config?.text)?.startsWith('SELECT s.user_id'))return {rows:[sessionRow]}; if(typeof config!=='string')query = config; return { rows: [{ ...row, branch:'semantic', branch_rank:1 }] }; });
  const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    if (url.endsWith("/api/embed")) return Response.json({ embeddings: [Array(768).fill(0.1)] });
    assert.ok(url.startsWith("https://generativelanguage.googleapis.com/"), "only the direct Google provider is allowed");
    if (providerStatus !== 200) return Response.json({ error: { message: "test-key must not leak", code: providerStatus, status: "UNAVAILABLE" } }, { status: providerStatus });
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(output && typeof output==='object' && 'statements' in output ? {...output,statements:(output as typeof generated).statements.map(s=>({...s,citations:s.citations.map(c=>{const prompt=JSON.parse(String((JSON.parse(String(init?.body)).contents as Array<{parts:Array<{text:string}>}>).at(-1)!.parts[0].text));const q=prompt.quoteChoices?.find((q:{sourceId:string;quote:string})=>q.sourceId===c.sourceId&&q.quote===c.quote);return q?{sourceId:c.sourceId,quoteId:q.quoteId}:c;})}))}:output) }] }, finishReason, index: 0 }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30, totalTokenCount: 40 },
    });
  });
  return { calls, getQuery: () => query };
}

test("real route uses BGE retrieval, parameterized user scoping, and the verified Google model", async () => {
  const services = mockServices();
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).grounded, true);
  assert.equal(services.calls.length, 2);
  const [embedding, gemini] = services.calls;
  assert.equal(embedding.body.input, "How much annual leave is available?");
  assert.equal(gemini.url.includes(`/models/${GEMINI_MODEL}:generateContent`), true);
  assert.equal(gemini.headers.get("x-goog-api-key"), "test-key");
  assert.equal(gemini.url.includes("test-key"), false);
  assert.ok(JSON.stringify(gemini.body).includes(row.chunk_text));
  assert.ok(!JSON.stringify(gemini.body).includes("file_path"));
  assert.equal(services.getQuery()?.values[1], '1');
  assert.equal(JSON.parse(String(services.getQuery()?.values[0])).length, 768);
  assert.match(services.getQuery()!.text, /d.status = 'ready'/);
  assert.match(services.getQuery()!.text, /d.user_id = \$2/);
  assert.match(services.getQuery()!.text, /(?:dc\.)?embedding <=> \$1::vector/);
});

test("real provider failures including auth and quota errors return sanitized 502 responses", async () => {
  for (const status of [401, 429, 503]) {
    mockServices(status);
    const response = await POST(request());
    assert.equal(response.status, status===429?429:502);
    const body = await response.text();
    assert.ok(body.includes(status===429?"PROVIDER_RATE_LIMITED":"GENERATION_FAILED"));
    assert.ok(!body.includes("test-key"));
    mock.restoreAll();
  }
});

test("real provider malformed output and truncated generation fail closed", async () => {
  for (const [output, finish] of [[{ unexpected: true }, "STOP"], [generated, "MAX_TOKENS"]] as const) {
    mockServices(200, output, finish);
    const response = await POST(request());
    assert.equal(response.status, 502);
    mock.restoreAll();
  }
});

test("real route reports missing configuration without touching retrieval", async () => {
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  mock.method(pool, "query", (q:{text:string}|string) => {if((typeof q==='string'?q:q.text).startsWith('SELECT s.user_id'))return Promise.resolve({rows:[sessionRow]}); return assert.fail('document database must not be called');});
  const response = await POST(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "CHAT_NOT_CONFIGURED");
});

test("real route rejects malformed BGE embeddings before querying PostgreSQL", async () => {
  mockServices();
  mock.method(pool, "query", (q:{text:string}|string) => {if((typeof q==='string'?q:q.text).startsWith('SELECT s.user_id'))return Promise.resolve({rows:[sessionRow]});return assert.fail('invalid vectors must never reach PostgreSQL');});
  mock.method(globalThis, "fetch", async () => Response.json({ embeddings: [Array(767).fill(0.1)] }));
  const response = await POST(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "RETRIEVAL_FAILED");
});

test('PDF education quotes preserve exact line breaks and punctuation without quote repair',()=>{
 const pdf={...row,chunk_text:'Education\nBSc Computing\nFictional River University\nOther qualification\nGrade:\nCGPA:\nB\n3.42/ 4.0'};
 const evidence=selectEvidence([pdf],.5);
 const output={answerable:true,statements:[
  {text:'The fictional graduate attended Fictional River University.',citations:[{sourceId:'S1',quote:'BSc Computing\nFictional River University'}]},
  {text:'The CGPA is 3.42/4.0.',citations:[{sourceId:'S1',quote:'Grade:\nCGPA:\nB\n3.42/ 4.0'}]},
 ]};
 const result=validateGroundedAnswer(output,evidence);assert.equal(result.grounded,true);assert.deepEqual(result.sources[0].quotes,output.statements.map(s=>s.citations[0].quote));
 for(const quote of ['CGPA: 3.42/4.0','BSc Computing Fictional River University','Fictional River University\nCGPA:\nB\n3.42/ 4.0'])assert.throws(()=>validateGroundedAnswer({answerable:true,statements:[{text:'A claim.',citations:[{sourceId:'S1',quote}]}]},evidence),{code:'UNSUPPORTED_ANSWER',status:502});
});

test('rejected exact quotes log the citation-verification stage without evidence or generated text',async()=>{
 const events:Record<string,unknown>[]=[];const original=console.info;const secret='fictional-private-education-text';console.info=(...args:unknown[])=>{if(args[0]==='[reliability]')events.push(JSON.parse(String(args[1])));};
 try{
 const response=await handler({generate:async()=>({answerable:true,statements:[{text:secret,citations:[{sourceId:'S1',quote:secret}]}]})})(request());
 assert.equal(response.status,502);const body=await response.json();assert.equal(body.code,'UNSUPPORTED_ANSWER');assert.ok(events.some(e=>e.stage==='final-generation'&&e.outcome==='ok'));assert.ok(events.some(e=>e.stage==='citation-verification'&&e.outcome==='error'));assert.ok(!JSON.stringify({events,body}).includes(secret));
 }finally{console.info=original;}
});

test('document quote references resolve only exact, bounded source excerpts',async()=>{
 const {documentReferenceSchema,documentQuoteChoices,resolveDocumentAnswer}=await import('../src/lib/document-answer-schema');
 const text='BSc Computing\nFictional River University\nGrade:\nCGPA:\nB\n3.42/ 4.0';const evidence=selectEvidence([{...row,chunk_text:text}],.5),choices=documentQuoteChoices(evidence);
 const value=(sourceId:string,quoteId:string)=>({answerable:true,statements:[{text:'The CGPA is 3.42/4.0.',citations:[{sourceId,quoteId}]}]});
 assert.equal(documentReferenceSchema.safeParse(value('S1',choices[0].quoteId)).success,true);
 const resolved=resolveDocumentAnswer(value('S1',choices[0].quoteId),choices);assert.equal(resolved.statements[0].citations[0].quote,text);assert.equal(validateGroundedAnswer(resolved,evidence).grounded,true);
 for(const [sourceId,quoteId] of [['S1','Q999'],['S2',choices[0].quoteId]])assert.throws(()=>resolveDocumentAnswer(value(sourceId,quoteId),choices),{code:'UNSUPPORTED_ANSWER'});
 assert.throws(()=>resolveDocumentAnswer({answerable:true,statements:[{text:'Claim',citations:[{sourceId:'S1',quote:'CGPA: 3.42/4.0'}]}]},choices),{code:'UNSUPPORTED_ANSWER'});
 const long=[{...evidence[0],text:('Fictional line\n').repeat(1000).slice(0,6000)}];const bounded=documentQuoteChoices(long);assert.ok(bounded.length<=32);assert.ok(bounded.every(q=>q.quote.length<=2000&&long[0].text.includes(q.quote)));assert.throws(()=>documentQuoteChoices([]));
});
