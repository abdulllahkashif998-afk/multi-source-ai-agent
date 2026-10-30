import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.UI_BASE_URL||'http://localhost:3108';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const policy='Minimum team total is 15.';
function documentSource(id,agent=true,metadata=true){return {id,filename:'Fictional policy.docx',text:policy,quotes:[policy],...(agent?{type:'document'}:{}),...(metadata?{chunkIndex:0,pageNumber:4}:{})};}
function csvSource(limited=false){const rows=[{team:'Alpha',value:30},{team:'Beta',value:6}];return {id:'C1',type:'csv',filename:'Fictional sales.csv',datasetId:'7',plan:{datasetId:'7',aggregate:{op:'sum',column:'amount'},groupBy:['team']},rows,text:JSON.stringify(rows),quotes:[JSON.stringify(rows[1])],possiblyTruncated:limited};}
function answer(endpoint,state){
 if(state.response)return state.response;
 if(state.kind==='missing')return {success:true,grounded:false,answer:'I do not have enough evidence to answer this question.',sources:[]};
 if(endpoint==='/api/chat')return {success:true,grounded:true,answer:'Minimum team total is 15. [S1]',sources:[documentSource('S1',false,state.metadata)]};
 if(state.kind==='csv')return {success:true,grounded:true,answer:'Alpha has 30 and Beta has 6. [C1]',sources:[csvSource(state.limited)]};
 if(state.kind==='combined')return {success:true,grounded:true,answer:'Beta has 6, which is 9 below the threshold of 15. [D1] [C1]',sources:[documentSource('D1',true,state.metadata),csvSource(state.limited)]};
 return {success:true,grounded:true,answer:'Minimum team total is 15. [D1]',sources:[documentSource('D1',true,state.metadata)]};
}
const results=[];
async function visible(locator){await locator.waitFor({state:'visible'});}
async function run(name,work,mobile=false){
 if(process.env.CHAT_TEST_FILTER&&!name.includes(process.env.CHAT_TEST_FILTER))return;
 const context=await browser.newContext({baseURL,viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
 const state={signedIn:true,status:200,code:'AGENT_FAILED',kind:'document',metadata:true,email:'fictional@example.test',limited:false,delay:0,network:false,response:null,requests:[],sessionGate:null};
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/api/auth/session',async route=>{const email=state.email,signedIn=state.signedIn;if(state.sessionGate)await state.sessionGate;return route.fulfill({status:signedIn?200:401,contentType:'application/json',body:JSON.stringify(signedIn?{success:true,name:'Fictional User',email,csrfToken:'c'.repeat(64)}:{success:false,code:'UNAUTHENTICATED'})});});
 const handler=async route=>{
  const request=route.request(),endpoint=new URL(request.url()).pathname;assert.equal(request.method(),'POST');assert.equal(request.headers()['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers().origin,new URL(baseURL).origin);
  const body=request.postDataJSON();assert.deepEqual(Object.keys(body),['question']);assert.ok(body.question.length>=1&&body.question.length<=2000);state.requests.push({endpoint,body});
  if(state.network)return route.abort('failed');if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
  return route.fulfill({status:state.status,contentType:'application/json',body:JSON.stringify(state.status===200?answer(endpoint,state):{success:false,code:state.code,error:'private API key and provider response'})});
 };
 await context.route('**/api/chat',handler);await context.route('**/api/agent',handler);
 try{await work(page,state);assert.deepEqual(errors,[]);results.push({name,result:'passed'});console.log(`PASS: ${name}`);}finally{await context.close();}
}
async function open(page){await page.goto('/dashboard/chat');await visible(page.getByRole('heading',{name:'AI Chat',exact:true}));await visible(page.getByLabel('Your question',{exact:true}));}
async function send(page,text='What is the policy?'){await page.getByLabel('Your question',{exact:true}).fill(text);await page.getByRole('button',{name:'Send question',exact:true}).click();await visible(page.locator('.assistant-message .chat-answer-text').last());}
try{
 await run('Agent defaults, Enter/Shift+Enter, IME handling and duplicate prevention',async(page,state)=>{
  state.delay=800;await open(page);assert.equal(await page.getByRole('radio',{name:/Multi-Source Agent/}).isChecked(),true);
  const input=page.getByLabel('Your question',{exact:true});await input.fill('First line');await input.press('Shift+Enter');await input.pressSequentially('Second line');assert.equal(state.requests.length,0);assert.equal(await input.inputValue(),'First line\nSecond line');
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});assert.equal(state.requests.length,0);
  await input.press('Enter');await visible(page.getByText('Gathering evidence and preparing your answer. This may take a little while.',{exact:true}));
  assert.equal(await page.getByRole('button',{name:'Processing…',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('radio',{name:/Document RAG/}).isDisabled(),true);
  await page.locator('.chat-composer').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await visible(page.locator('.assistant-message .chat-answer-text'));assert.equal(state.requests.length,1);assert.equal(state.requests[0].endpoint,'/api/agent');assert.equal(state.requests[0].body.question,'First line\nSecond line');
 });
 await run('Document RAG uses S citations and displays only provided metadata',async(page,state)=>{
  await open(page);await page.getByRole('radio',{name:/Document RAG/}).check();await send(page);assert.equal(state.requests[0].endpoint,'/api/chat');assert.match(await page.locator('.assistant-message .chat-answer-text').innerText(),/\[S1\]/);
  await visible(page.getByRole('region',{name:'Document sources'}));await visible(page.getByText('Chunk index 0 · Page 4',{exact:true}));assert.equal(await page.locator('.chat-source').evaluate(el=>el.open),true);await visible(page.getByText(policy,{exact:true}));await page.locator('.chat-source>summary').click();assert.equal(await page.locator('.chat-source').evaluate(el=>el.open),false);await page.locator('.chat-source>summary').click();await visible(page.getByText(policy,{exact:true}));assert.equal(await page.getByRole('region',{name:'CSV sources'}).count(),0);
  state.metadata=false;await send(page,'Another document question');const last=page.locator('.assistant-message').last();assert.equal(await last.getByText(/Chunk index|Page [0-9]/).count(),0);
 });
 await run('CSV-only agent sources render tables and limitation warnings, without invented chunk metadata',async(page,state)=>{
  state.kind='csv';state.limited=true;await open(page);await send(page,'What is the total amount per team in my CSV?');
  await visible(page.getByRole('region',{name:'CSV sources'}));await visible(page.getByRole('cell',{name:'Beta',exact:true}));await visible(page.getByRole('cell',{name:'6',exact:true}));await visible(page.getByText('This evidence may be limited; it may not include every matching row.',{exact:true}));assert.equal(await page.getByText(/Chunk index/).count(),0);assert.equal(await page.getByRole('region',{name:'Document sources'}).count(),0);
  await page.getByText('Exact cited evidence',{exact:true}).click();await visible(page.getByText('{"team":"Beta","value":6}',{exact:true}));
 });
 await run('Combined evidence preserves D/C markers and separate source sections',async(page,state)=>{
  state.kind='combined';await open(page);await send(page,'Compare team totals with the document threshold.');const text=await page.locator('.assistant-message .chat-answer-text').innerText();assert.match(text,/\[D1\] \[C1\]/);assert.match(text,/9 below/);await visible(page.getByRole('region',{name:'Document sources'}));await visible(page.getByRole('region',{name:'CSV sources'}));
 });
 await run('Missing information is a graceful abstention, not a failed request',async(page,state)=>{
  state.kind='missing';await open(page);await send(page,'What is unknown?');await visible(page.getByText('Insufficient evidence',{exact:true}));assert.equal(await page.locator('.chat-citations').count(),0);assert.equal(await page.locator('.notice[role=alert]').count(),0);await visible(page.getByText('Try a more specific question or add relevant documents and datasets.',{exact:true}));
 });
 await run('429 errors do not retry automatically; manual retry uses original mode without a duplicate user message',async(page,state)=>{
  state.status=429;await open(page);await page.getByLabel('Your question',{exact:true}).fill('Retry this question');await page.getByRole('button',{name:'Send question',exact:true}).click();await visible(page.getByText('The answer service is rate limited. Please wait before retrying manually.',{exact:true}));assert.equal(state.requests.length,1);assert.ok(!(await page.locator('body').innerText()).includes('private API'));
  await page.getByRole('radio',{name:/Document RAG/}).check();state.status=200;await page.getByRole('button',{name:'Retry question 1'}).click();await visible(page.locator('.assistant-message .chat-answer-text'));assert.deepEqual(state.requests.map(r=>r.endpoint),['/api/agent','/api/agent']);assert.equal(await page.locator('.user-message').count(),1);assert.equal(await page.getByRole('radio',{name:/Document RAG/}).isChecked(),true);
 });
 await run('Timeout, network, unavailable-service and unsupported-answer errors remain safe',async(page,state)=>{
  await open(page);
  for(const [status,code,pattern] of [[504,'AGENT_TIMEOUT',/timed out/],[503,'CHAT_NOT_CONFIGURED',/not configured/],[503,'PROVIDER_BILLING_REQUIRED',/temporarily unavailable/],[502,'UNSUPPORTED_ANSWER',/could not verify/]]){
   state.status=status;state.code=code;await page.getByLabel('Your question',{exact:true}).fill(`Question ${status}`);await page.getByRole('button',{name:'Send question',exact:true}).click();const alert=page.locator('.assistant-message').last().locator('.notice[role=alert]');await visible(alert);assert.match(await alert.innerText(),pattern);
  }
  state.status=200;state.network=true;await page.getByLabel('Your question',{exact:true}).fill('Network question');await page.getByRole('button',{name:'Send question',exact:true}).click();await visible(page.getByText('The connection was interrupted. The server may have processed your question. Retry manually when you are ready.',{exact:true}));assert.equal(state.requests.length,5);
 });
 await run('Invalid questions, malformed sources and expired sessions fail safely',async(page,state)=>{
  await open(page);await page.getByLabel('Your question',{exact:true}).fill('   ');await page.getByLabel('Your question',{exact:true}).press('Enter');await visible(page.getByText('Enter a question between 1 and 2,000 characters.',{exact:true}));assert.equal(state.requests.length,0);
  state.response={success:true,grounded:true,answer:'Unsupported [D99]',sources:[]};await page.getByLabel('Your question',{exact:true}).fill('Malformed reply');await page.getByRole('button',{name:'Send question',exact:true}).click();await visible(page.getByText('The service returned an unreadable answer. Please retry manually.',{exact:true}));
  state.signedIn=false;await page.getByLabel('Your question',{exact:true}).fill('Expired');await page.getByRole('button',{name:'Send question',exact:true}).click();await page.waitForURL('**/login?reason=expired');assert.equal(state.requests.length,1);
 });
 await run('Unauthorized and CSRF-rejected API responses preserve protections',async(page,state)=>{
  await open(page);state.status=403;await page.getByLabel('Your question',{exact:true}).fill('CSRF question');await page.getByRole('button',{name:'Send question',exact:true}).click();await visible(page.getByText('This request could not be verified. Refresh the page and try again.',{exact:true}));
  state.status=401;await page.getByRole('button',{name:'Retry question 1'}).click();await page.waitForURL('**/login?reason=expired');
 });
 await run('History is ordered, clearing requires confirmation and mode survives clearing but not reload',async(page,state)=>{
  await open(page);await send(page,'First question');await page.getByRole('radio',{name:/Document RAG/}).check();await send(page,'Second question');const messages=page.locator('.chat-message');assert.equal(await messages.count(),4);assert.match(await messages.nth(0).innerText(),/First question/);assert.match(await messages.nth(2).innerText(),/Second question/);
  await page.getByRole('button',{name:'Clear conversation',exact:true}).click();await visible(page.getByRole('dialog'));assert.equal(await page.locator(':focus').innerText(),'Cancel');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await messages.count(),4);
  await page.getByRole('button',{name:'Clear conversation',exact:true}).click();await page.getByRole('button',{name:'Clear messages',exact:true}).click();await visible(page.getByRole('heading',{name:'Start with a question.',exact:true}));assert.equal(await messages.count(),0);assert.equal(await page.getByRole('radio',{name:/Document RAG/}).isChecked(),true);assert.equal(state.requests.length,2);
  await page.reload();await visible(page.getByLabel('Your question',{exact:true}));assert.equal(await page.getByRole('radio',{name:/Multi-Source Agent/}).isChecked(),true);assert.equal(await page.locator('.chat-message').count(),0);
 });
 await run('Verified account changes reset history even when a focus refresh is already in flight',async(page,state)=>{
  await open(page);await page.getByRole('radio',{name:/Document RAG/}).check();await send(page,'Private page-session question');
  let release;state.sessionGate=new Promise(resolve=>{release=resolve;});
  const pending=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/auth/session');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await pending;
  assert.equal(await page.locator('.chat-message').count(),2);
  state.email='second-fictional@example.test';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));state.sessionGate=null;release();
  await visible(page.getByRole('heading',{name:'Start with a question.',exact:true}));assert.equal(await page.locator('.chat-message').count(),0);assert.equal(await page.getByRole('radio',{name:/Multi-Source Agent/}).isChecked(),true);
 });
 await run('AI text, filenames, quotes and CSV cells cannot inject HTML or executable links',async(page,state)=>{
  const payload='<img src=x onerror=window.__chatXSS=1>';const document={...documentSource('D1'),filename:'<script>literal</script>.docx',text:payload,quotes:[payload]};const source={...csvSource(),rows:[{note:payload}],text:JSON.stringify([{note:payload}]),quotes:[payload]};
  state.response={success:true,grounded:true,answer:`${payload} [D1] [C1] [link](javascript:alert(1))`,sources:[document,source]};await open(page);await send(page);assert.equal(await page.locator('.assistant-message img,.assistant-message script,.assistant-message a[href^="javascript:"]').count(),0);assert.equal(await page.evaluate(()=>window.__chatXSS),undefined);assert.ok((await page.locator('.assistant-message .chat-answer-text').innerText()).includes(payload));await visible(page.getByRole('cell',{name:payload,exact:true}));
 });
 for(const mobile of [false,true])await run(`${mobile?'Mobile':'Desktop'} long answers, source tables and composer fit the viewport`,async(page,state)=>{
  state.response={success:true,grounded:true,answer:`${'A long grounded response. '.repeat(100)}\n${'x'.repeat(1000)} [D1] [C1]`,sources:[documentSource('D1'),csvSource()]};await open(page);await send(page,'Compare the available sources.');await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.chat-modes').evaluate(el=>getComputedStyle(el).display),'grid');await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:`/tmp/ai-chat-long-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:'Clear conversation',exact:true}).click();await page.getByRole('button',{name:'Clear messages',exact:true}).click();state.response=null;state.kind='combined';await send(page,'Compare the policy threshold with each team’s total.');await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:`/tmp/ai-chat-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  const region=page.getByRole('region',{name:'C1 CSV evidence table'});await region.focus();await page.keyboard.press('ArrowRight');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },mobile);
 console.log(JSON.stringify({tests:results.length,passed:results.length,results},null,2));
}finally{await browser.close();}
