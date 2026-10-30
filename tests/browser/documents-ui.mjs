import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.UI_BASE_URL||'http://localhost:3105';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const fixture=(id='41',filename='Fictional policy.pdf',version=1)=>({id,filename,version,status:'ready',fileType:filename.endsWith('.pdf')?'pdf':'docx',uploadedAt:'2026-01-01T10:00:00.000Z'});
const pdf={name:'Fictional policy.pdf',mimeType:'application/pdf',buffer:Buffer.from('fictional fixture only')};
const docx={name:'Fictional replacement.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('fictional replacement only')};
const results=[];
async function visible(locator){await locator.waitFor({state:'visible'});}
async function run(name,work,mobile=false){
 const context=await browser.newContext({baseURL,viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
 const state={documents:[fixture()],signedIn:true,listError:false,mutationError:null,cleanup:false,delay:0,listDelay:0,requests:[],nextId:100};
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/api/auth/session',route=>route.fulfill({status:state.signedIn?200:401,contentType:'application/json',body:JSON.stringify(state.signedIn?{success:true,name:'Fictional User',email:'fictional@example.test',csrfToken:'c'.repeat(64)}:{success:false,code:'UNAUTHENTICATED'})}));
 await context.route('**/api/documents?*',async route=>{
  if(state.listDelay)await new Promise(resolve=>setTimeout(resolve,state.listDelay));
  if(state.listError)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'DOCUMENT_LIST_FAILED',error:'private database details'})});
  const params=new URL(route.request().url()).searchParams;assert.equal(params.has('userId'),false);assert.equal(params.get('limit'),'10');
  const filtered=state.documents.filter(d=>!params.get('before')||BigInt(d.id)<BigInt(params.get('before')));
  const documents=filtered.slice(0,10);const nextCursor=filtered.length>10?documents.at(-1).id:null;
  return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,documents,nextCursor})});
 });
 async function mutate(route){
  const request=route.request(),method=request.method(),path=new URL(request.url()).pathname;
  assert.equal(request.headers()['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers().origin,new URL(baseURL).origin);
  state.requests.push({method,path});if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
  if(state.mutationError)return route.fulfill({status:state.mutationError.status,contentType:'application/json',body:JSON.stringify({success:false,code:state.mutationError.code,error:'/private/storage/hidden.pdf'})});
  let result;
  if(method==='DELETE'){state.documents=state.documents.filter(d=>d.id!==path.split('/').at(-1));result={success:true,documentId:path.split('/').at(-1),deleted:true,cleanupPending:state.cleanup};}
  else {
   const form=await new Request('http://fixture',{method,headers:request.headers(),body:request.postDataBuffer()}).formData();
   assert.deepEqual([...form.keys()],['file']);const file=form.get('file');
   let version=1;if(method==='PUT'){const previous=state.documents.find(d=>d.id===path.split('/').at(-1));assert.ok(previous);version=previous.version+1;state.documents=state.documents.filter(d=>d.id!==previous.id);}
   const document=fixture(String(++state.nextId),file.name,version);state.documents.unshift(document);
   result={success:true,documentId:document.id,version,cleanupPending:state.cleanup};
  }
  return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 }
 await context.route('**/api/upload',mutate);await context.route(/\/api\/documents\/[0-9]+$/,mutate);
 try {await work(page,state);assert.deepEqual(errors,[]);results.push({name,result:'passed'});console.log(`PASS: ${name}`);}
 finally {await context.close();}
}
async function open(page){await page.goto('/dashboard/documents');await visible(page.getByRole('heading',{name:'Documents',exact:true}));}
async function ready(page){await visible(page.locator('.document-row').first());}
try {
 await run('List metadata and stable cursor pagination',async(page,state)=>{
  state.documents=Array.from({length:13},(_,i)=>fixture(String(80-i),`Fictional policy ${i+1}.pdf`));await open(page);await ready(page);
  assert.equal(await page.locator('.document-row').count(),10);await visible(page.getByText('Version 1',{exact:true}).first());await visible(page.getByText('Ready',{exact:true}).first());
  await page.getByRole('button',{name:'Next →',exact:true}).click();await visible(page.getByText('Page 2',{exact:true}));await visible(page.getByRole('heading',{name:'Fictional policy 11.pdf',exact:true}));assert.equal(await page.locator('.document-row').count(),3);
  await page.getByRole('button',{name:'← Previous',exact:true}).click();await visible(page.getByRole('heading',{name:'Fictional policy 1.pdf',exact:true}));assert.equal(await page.locator('.document-row').count(),10);
 });
 await run('Empty list, file validation, real HTTP upload processing and refreshed success',async(page,state)=>{
  state.documents=[];
  // A local fictional HTTP endpoint preserves native XHR upload events. Browser
  // route.fulfill alone completes upload+response together and cannot test them.
  const serverErrors=[];
  const server=createServer(async(request,response)=>{
   response.setHeader('Access-Control-Allow-Origin',new URL(baseURL).origin);response.setHeader('Access-Control-Allow-Credentials','true');
   response.setHeader('Access-Control-Allow-Headers','X-CSRF-Token, Content-Type');response.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
   if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
   try {
    assert.equal(request.headers['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers.origin,new URL(baseURL).origin);
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const form=await new Request('http://fixture',{method:'POST',headers:{'Content-Type':request.headers['content-type']},body:Buffer.concat(chunks)}).formData();
    assert.deepEqual([...form.keys()],['file']);state.requests.push({method:'POST',path:'/api/upload'});
    await new Promise(resolve=>setTimeout(resolve,1000));
    const document=fixture('101',form.get('file').name);state.documents.unshift(document);
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({success:true,documentId:document.id,version:1}));
   }catch(error){serverErrors.push(error.message);response.writeHead(500,{'Content-Type':'application/json'});response.end(JSON.stringify({success:false}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
   await page.route('**/api/upload',route=>route.continue({url:`http://127.0.0.1:${server.address().port}/api/upload`}));
   await open(page);await visible(page.getByRole('heading',{name:'Your first source starts here'}));
   await page.getByLabel('Select document',{exact:true}).setInputFiles({name:'wrong.csv',mimeType:'text/csv',buffer:Buffer.from('a,b')});await visible(page.locator('.notice[role=alert]'));assert.equal(state.requests.length,0);
   await page.getByLabel('Select document',{exact:true}).setInputFiles(pdf);await page.getByRole('button',{name:'Upload document',exact:true}).click();
   await visible(page.getByText('Processing your document. This may take a little while…',{exact:true}));assert.equal(await page.getByRole('button',{name:'Working…',exact:true}).isDisabled(),true);
   await visible(page.getByText('Document uploaded and ready to search.',{exact:true}));await ready(page);assert.equal(state.requests.length,1);assert.deepEqual(serverErrors,[]);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });
 await run('Duplicate upload is clear, safe and creates no extra row',async(page,state)=>{
  state.mutationError={status:409,code:'DUPLICATE_DOCUMENT'};await open(page);await ready(page);await page.getByLabel('Select document',{exact:true}).setInputFiles(pdf);await page.getByRole('button',{name:'Upload document',exact:true}).click();
  await visible(page.getByText('An identical active document already exists. No duplicate was added.',{exact:true}));assert.equal(await page.locator('.document-row').count(),1);assert.ok(!(await page.locator('body').innerText()).includes('/private'));
 });
 await run('Replacement failure preserves the prior version; success publishes the new version',async(page,state)=>{
  await open(page);await ready(page);await page.getByRole('button',{name:'Replace Fictional policy.pdf',exact:true}).click();
  await visible(page.getByRole('dialog'));assert.equal(await page.locator(':focus').innerText(),'Cancel');await visible(page.getByText(/replacement becomes version 2/));
  await page.getByLabel('Replacement PDF or DOCX (up to 10 MiB)').setInputFiles(docx);state.mutationError={status:422,code:'INVALID_CONTENT'};
  await page.getByRole('button',{name:'Replace document',exact:true}).click();await visible(page.getByText('This file could not be read. Choose a valid PDF or DOCX document.',{exact:true}));assert.equal(state.documents[0].version,1);
  state.mutationError=null;await page.getByRole('button',{name:'Replace document',exact:true}).click();await visible(page.getByText('Document replaced successfully. Version 2 is now active.',{exact:true}));
  await visible(page.getByRole('heading',{name:'Fictional replacement.docx',exact:true}));assert.equal(await page.getByRole('heading',{name:'Fictional policy.pdf',exact:true}).count(),0);await visible(page.getByText('Version 2',{exact:true}));
 });
 await run('Deletion requires confirmation, Escape cancels, cleanup status contains no paths',async(page,state)=>{
  state.cleanup=true;await open(page);await ready(page);await page.getByRole('button',{name:'Delete Fictional policy.pdf',exact:true}).click();await visible(page.getByRole('dialog'));
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(state.requests.length,0);
  await page.getByRole('button',{name:'Delete Fictional policy.pdf',exact:true}).click();await page.getByRole('button',{name:'Delete document',exact:true}).click();
  await visible(page.getByText('Document deleted. File cleanup is pending; the retired document is already excluded from search.',{exact:true}));await visible(page.getByRole('heading',{name:'Your first source starts here'}));assert.equal(state.requests.length,1);assert.ok(!(await page.locator('body').innerText()).includes('/private'));
 });
 await run('Loading and error states support retry without exposing server details',async(page,state)=>{
  state.listDelay=800;state.listError=true;await open(page);await visible(page.getByText('Loading your documents…',{exact:true}));await visible(page.getByText('Documents could not be loaded. Please try again.',{exact:true}));assert.ok(!(await page.locator('body').innerText()).includes('private database'));
  state.listError=false;state.listDelay=0;await page.getByRole('button',{name:'Try again',exact:true}).click();await ready(page);
 });
 await run('CSRF rejection keeps the document and session expiry redirects before mutation',async(page,state)=>{
  await open(page);await ready(page);state.mutationError={status:403,code:'CSRF_REJECTED'};
  await page.getByRole('button',{name:'Delete Fictional policy.pdf',exact:true}).click();await page.getByRole('button',{name:'Delete document',exact:true}).click();await visible(page.getByText('This request could not be verified. Refresh the page and try again.',{exact:true}));assert.equal(state.documents.length,1);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();state.signedIn=false;
  await page.getByLabel('Select document',{exact:true}).setInputFiles(pdf);await page.getByRole('button',{name:'Upload document',exact:true}).click();await page.waitForURL('**/login?reason=expired');assert.equal(state.requests.length,1);
 });
 for(const mobile of [false,true])await run(`${mobile?'Mobile':'Desktop'} document layout, long names and dialog fit`,async(page,state)=>{
  state.documents=[fixture('41','Fictional very long policy title '.repeat(5)+'.pdf'),fixture('40','Fictional contract.docx',3)];await open(page);await ready(page);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/documents-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:/Delete Fictional very long/}).click();await visible(page.getByRole('dialog'));assert.ok(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));assert.equal(await page.locator(':focus').innerText(),'Cancel');
 },mobile);
 console.log(JSON.stringify({tests:results.length,passed:results.length,results},null,2));
} finally {await browser.close();}
