import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.UI_BASE_URL||'http://localhost:3107';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const columns=[{name:'team',type:'text'},{name:'amount',type:'number'},{name:'active',type:'boolean'},{name:'code',type:'text'}];
const dataset={id:'7',filename:'Fictional sales.csv',row_count:3,columns};
const rows=[{team:'Alpha',amount:10,active:true,code:'001'},{team:'Alpha',amount:20,active:false,code:'002'},{team:'Beta',amount:6,active:true,code:'003'}];
const file={name:'Fictional upload.csv',mimeType:'text/csv',buffer:Buffer.from('team,amount,active,code\nAlpha,10,true,001\nAlpha,20,false,002\nBeta,6,true,003')};
const result=[];
async function visible(locator){await locator.waitFor({state:'visible'});}
async function run(name,work,mobile=false){
 const context=await browser.newContext({baseURL,viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
 const state={datasets:[dataset],signedIn:true,email:'fictional@example.test',mutationStatus:200,mutationDelay:0,mutations:[],listError:false,listDelay:0,uploadError:false,uploadDelay:0,uploadNetwork:false,queryStatus:200,queryDelay:0,queryRows:rows,expectedPlan:null,newId:'9',hideNewImport:false,queries:[],uploads:0};
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/api/auth/session',route=>route.fulfill({status:state.signedIn?200:401,contentType:'application/json',body:JSON.stringify(state.signedIn?{success:true,name:'Fictional User',email:state.email,csrfToken:'c'.repeat(64)}:{success:false,code:'UNAUTHENTICATED'})}));
 await context.route('**/api/datasets',async route=>{
  if(route.request().method()==='GET'){
   if(state.listDelay)await new Promise(resolve=>setTimeout(resolve,state.listDelay));
   return route.fulfill({status:state.listError?503:200,contentType:'application/json',body:JSON.stringify(state.listError?{success:false,error:'private database detail'}:{success:true,datasets:state.datasets.slice(0,100)})});
  }
  const request=route.request();assert.equal(request.method(),'POST');assert.equal(request.headers()['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers().origin,new URL(baseURL).origin);state.uploads++;
  if(state.uploadNetwork)return route.abort('failed');
  if(state.uploadDelay)await new Promise(resolve=>setTimeout(resolve,state.uploadDelay));
  if(state.uploadError)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({success:false,error:'private parser details'})});
  const form=await new Request('http://fixture',{method:'POST',headers:request.headers(),body:request.postDataBuffer()}).formData();assert.deepEqual([...form.keys()],['file']);
  const next={...dataset,id:state.newId,filename:form.get('file').name};if(!state.hideNewImport)state.datasets.push(next);
  return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,datasetId:next.id,importedRows:3,columns})});
 });
 await context.route(/\/api\/datasets\/\d+$/,async route=>{
  const request=route.request(),method=request.method();assert.ok(['PUT','DELETE'].includes(method));assert.equal(request.headers()['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers().origin,new URL(baseURL).origin);
  const id=new URL(request.url()).pathname.split('/').pop(),account=state.email;state.mutations.push(method);
  if(state.mutationDelay)await new Promise(resolve=>setTimeout(resolve,state.mutationDelay));
  if(state.mutationStatus!==200)return route.fulfill({status:state.mutationStatus,contentType:'application/json',body:JSON.stringify({success:false,code:state.mutationStatus===409?'IDENTICAL_DATASET':'MUTATION_FAILED',error:'private mutation detail'})});
  let next;
  if(method==='PUT'){
   const form=await new Request('http://fixture',{method,headers:request.headers(),body:request.postDataBuffer()}).formData();assert.deepEqual([...form.keys()],['file']);
   next={id,filename:form.get('file').name,row_count:1,columns:[{name:'region',type:'text'},{name:'score',type:'number'}]};
  }
  if(account===state.email)state.datasets=method==='DELETE'?state.datasets.filter(d=>d.id!==id):state.datasets.map(d=>d.id===id?next:d);
  return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,datasetId:id,...(next?{importedRows:next.row_count,columns:next.columns}:{})})});
 });
 await context.route('**/api/datasets/query',async route=>{
  const request=route.request(),plan=request.postDataJSON();assert.equal(request.method(),'POST');assert.equal(request.headers()['x-csrf-token'],'c'.repeat(64));assert.equal(request.headers().origin,new URL(baseURL).origin);assert.ok(!('sql' in plan));assert.ok(!('userId' in plan));assert.ok(plan.limit>=1&&plan.limit<=100);
  if(state.expectedPlan)assert.deepEqual(plan,state.expectedPlan);state.queries.push(plan);
  if(state.queryDelay)await new Promise(resolve=>setTimeout(resolve,state.queryDelay));
  return route.fulfill({status:state.queryStatus,contentType:'application/json',body:JSON.stringify(state.queryStatus===200?{success:true,rows:state.queryRows}:{success:false,error:'private SQL detail'})});
 });
 try{await work(page,state);assert.deepEqual(errors,[]);result.push({name,result:'passed'});console.log(`PASS: ${name}`);}finally{await context.close();}
}
async function open(page){await page.goto('/dashboard/datasets');await visible(page.getByRole('heading',{name:'Datasets',exact:true}));}
async function select(page,name=dataset.filename){await page.locator('.dataset-select').filter({hasText:name}).click();await visible(page.locator('.dataset-explorer'));}
async function execute(page){await page.getByRole('button',{name:'Run query',exact:true}).click();await visible(page.getByRole('heading',{name:'Query results',exact:true}));}
const plan=(change={})=>({datasetId:'7',filters:[],groupBy:[],limit:20,...change});
try{
 await run('CSV file validation, import loading/success and automatic schema selection',async(page,state)=>{
  state.datasets=[];state.uploadDelay=700;await open(page);await visible(page.getByRole('heading',{name:'Your first dataset starts here'}));
  await page.getByLabel('Select CSV file',{exact:true}).setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('x')});await visible(page.locator('.notice[role=alert]'));assert.equal(state.uploads,0);
  await page.getByLabel('Select CSV file',{exact:true}).setInputFiles({name:'empty.csv',mimeType:'text/csv',buffer:Buffer.alloc(0)});assert.equal(state.uploads,0);
  await page.getByLabel('Select CSV file',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Upload CSV',exact:true}).click();await visible(page.getByText('Uploading and validating your CSV…',{exact:true}));
  await visible(page.getByText('CSV uploaded successfully. 3 rows imported.',{exact:true}));await visible(page.getByRole('heading',{name:file.name,exact:true}));assert.equal(state.uploads,1);assert.equal(await page.locator('.schema-panel li').count(),4);
 });
 await run('Dataset schema discovery, raw results and typed code values',async(page,state)=>{
  await open(page);await select(page);await visible(page.locator('.schema-panel').getByText('Boolean',{exact:true}));assert.equal(await page.locator('.schema-panel li').count(),4);assert.match(await page.locator('.schema-panel li').filter({hasText:'code'}).innerText(),/Text/);
  state.expectedPlan=plan();await execute(page);assert.equal(await page.locator('.results-region tbody tr').count(),3);await visible(page.getByRole('cell',{name:'001',exact:true}));
 });
 await run('Numeric filtering/sorting, boolean operators and query-result invalidation',async(page,state)=>{
  await open(page);await select(page);await page.getByRole('button',{name:'+ Add filter',exact:true}).click();await page.getByLabel('Filter 1 column',{exact:true}).selectOption('amount');await page.getByLabel('Comparison 1',{exact:true}).selectOption('gte');await page.getByLabel('Value 1',{exact:true}).fill('10');await page.getByLabel('Sort by',{exact:true}).selectOption('amount');await page.getByLabel('Direction',{exact:true}).selectOption('desc');
  state.expectedPlan=plan({filters:[{column:'amount',op:'gte',value:10}],sort:{column:'amount',direction:'desc'}});state.queryRows=[rows[1],rows[0]];await execute(page);assert.equal(await page.locator('.results-region tbody tr').count(),2);assert.match(await page.locator('.results-region tbody tr').first().innerText(),/20/);
  await page.getByLabel('Filter 1 column',{exact:true}).selectOption('active');assert.equal(await page.locator('.results-region').count(),0);assert.equal(await page.getByLabel('Comparison 1',{exact:true}).locator('option').count(),2);
  state.expectedPlan=plan({filters:[{column:'active',op:'eq',value:true}],sort:{column:'amount',direction:'desc'}});state.queryRows=[rows[0],rows[2]];await execute(page);assert.equal(state.queries.length,2);
 });
 await run('COUNT, SUM, AVG and grouped aggregate sorting use validated plans',async(page,state)=>{
  await open(page);await select(page);
  for(const [operation,value] of [['count',3],['sum',36],['avg',12]]){
   await page.getByLabel('Result',{exact:true}).selectOption(operation);state.expectedPlan=plan({aggregate:operation==='count'?{op:operation}:{op:operation,column:'amount'}});state.queryRows=[{value}];await execute(page);await visible(page.getByRole('cell',{name:String(value),exact:true}));
  }
  await page.getByLabel('Result',{exact:true}).selectOption('sum');await page.getByLabel('team',{exact:true}).check();await page.getByLabel('Sort by',{exact:true}).selectOption('value');await page.getByLabel('Direction',{exact:true}).selectOption('desc');state.expectedPlan=plan({aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'value',direction:'desc'}});state.queryRows=[{team:'Alpha',value:30},{team:'Beta',value:6}];await execute(page);assert.equal(await page.locator('.results-region tbody tr').count(),2);await visible(page.getByRole('columnheader',{name:'SUM (amount)',exact:true}));
 });
 await run('Limits, empty results and zero-row count are displayed accurately',async(page,state)=>{
  await open(page);await select(page);await page.getByLabel('Maximum result rows',{exact:true}).fill('101');await page.getByRole('button',{name:'Run query',exact:true}).click();await visible(page.locator('.dataset-explorer .notice[role=alert]'));assert.equal(state.queries.length,0);
  await page.getByLabel('Maximum result rows',{exact:true}).fill('2');state.queryRows=rows.slice(0,2);await execute(page);await visible(page.getByText('This result may be limited. Increase the row limit or use an aggregate for a full total.',{exact:true}));
  await page.getByRole('button',{name:'Reset query',exact:true}).click();state.queryRows=[];await execute(page);await visible(page.getByText('No rows match this query.',{exact:true}));
  await page.getByLabel('Result',{exact:true}).selectOption('count');state.queryRows=[{value:0}];await execute(page);await visible(page.getByRole('cell',{name:'0',exact:true}));
 });
 await run('A discovered zero-row dataset remains inspectable and count zero is not fabricated as an empty result',async(page,state)=>{
  state.datasets=[{...dataset,row_count:0}];state.queryRows=[];await open(page);await select(page);await visible(page.locator('.dataset-title').getByText('0 rows · 4 columns',{exact:true}));await execute(page);await visible(page.getByText('No rows match this query.',{exact:true}));
  await page.getByLabel('Result',{exact:true}).selectOption('count');state.expectedPlan=plan({aggregate:{op:'count'}});state.queryRows=[{value:0}];await execute(page);await visible(page.getByRole('cell',{name:'0',exact:true}));
 });
 await run('Invalid CSV and query errors are safe and allow correction',async(page,state)=>{
  state.uploadError=true;await open(page);await page.getByLabel('Select CSV file',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Upload CSV',exact:true}).click();await visible(page.getByText('This CSV could not be imported. Check for unique column headings and at least one consistent data row.',{exact:true}));assert.equal(state.datasets.length,1);
  await select(page);state.queryStatus=404;await page.getByRole('button',{name:'Run query',exact:true}).click();await visible(page.locator('.dataset-explorer .notice[role=alert]'));assert.ok(!(await page.locator('body').innerText()).includes('private'));
  state.queryStatus=200;await execute(page);
 });
 await run('Discovery loading/error retry, query loading, CSRF rejection and expiry',async(page,state)=>{
  state.listDelay=600;state.listError=true;await open(page);await visible(page.getByText('Loading your datasets…',{exact:true}));await visible(page.getByText('Datasets could not be loaded. Please try again.',{exact:true}));state.listError=false;state.listDelay=0;await page.getByRole('button',{name:'Try again',exact:true}).click();await select(page);
  state.queryDelay=700;await page.getByRole('button',{name:'Run query',exact:true}).click();await visible(page.getByText('Running your query…',{exact:true}));assert.equal(await page.getByRole('button',{name:'Run query',exact:true}).isDisabled(),true);await visible(page.getByRole('heading',{name:'Query results',exact:true}));state.queryDelay=0;
  state.queryStatus=403;await page.getByRole('button',{name:'Run query',exact:true}).click();await visible(page.getByText('This request could not be verified. Refresh the page and try again.',{exact:true}));const count=state.queries.length;state.signedIn=false;await page.getByRole('button',{name:'Run query',exact:true}).click();await page.waitForURL('**/login?reason=expired');assert.equal(state.queries.length,count);
 });
 await run('Changing dataset clears the previous query and shows the selected schema',async(page,state)=>{
  state.datasets.push({id:'8',filename:'Other fictional.csv',row_count:1,columns:[{name:'project',type:'text'},{name:'cost',type:'number'}]});await open(page);await select(page);await execute(page);await select(page,'Other fictional.csv');assert.equal(await page.locator('.results-region').count(),0);assert.equal(await page.locator('.schema-panel li').count(),2);await visible(page.locator('.schema-panel').getByText('project',{exact:true}));
 });
 await run('An import missing from a short discovery list is not mistaken for the 100-dataset cap',async(page,state)=>{
  state.hideNewImport=true;await open(page);await page.getByLabel('Select CSV file',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Upload CSV',exact:true}).click();await visible(page.getByText('CSV uploaded, but it is not visible in discovery yet. Refresh the list before uploading again.',{exact:true}));assert.equal(await page.locator('.dataset-select').count(),1);
 });
 await run('Discovery limit is preserved and uploads outside it are explained',async(page,state)=>{
  state.datasets=Array.from({length:100},(_,index)=>({...dataset,id:String(100+index),filename:`Fictional ${index}.csv`}));state.newId='999';await open(page);await visible(page.getByText('Showing the first 100 available datasets. Discovery is limited by the current service.',{exact:true}));await page.getByLabel('Select CSV file',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Upload CSV',exact:true}).click();await visible(page.getByText('CSV uploaded. This dataset is outside the current 100-dataset discovery limit.',{exact:true}));assert.equal(await page.locator('.dataset-select').count(),100);
 });

 await run('Replacement validates file, preserves old data on failure and clears outdated schema/results',async(page,state)=>{
  await open(page);await select(page);await execute(page);await page.getByRole('button',{name:`Replace ${dataset.filename}`,exact:true}).click();
  const modal=page.getByRole('dialog');await visible(modal);assert.equal(await modal.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>el===document.activeElement),true);
  await modal.getByLabel('Replacement CSV (up to 10 MiB)',{exact:true}).setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('x')});await visible(modal.getByRole('alert'));assert.equal(state.mutations.length,0);
  const replacement={name:'revised.csv',mimeType:'text/csv',buffer:Buffer.from('region,score\nNorth,9')};await modal.getByLabel('Replacement CSV (up to 10 MiB)',{exact:true}).setInputFiles(replacement);
  state.mutationStatus=400;await modal.getByRole('button',{name:'Replace dataset',exact:true}).click();await visible(modal.getByRole('alert'));assert.equal(state.datasets[0].filename,dataset.filename);assert.equal(await page.locator('.results-region').count(),0);
  state.mutationStatus=200;state.mutationDelay=350;await modal.getByRole('button',{name:'Replace dataset',exact:true}).click();await visible(modal.getByText('Replacing and validating CSV…',{exact:true}));assert.equal(await modal.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true);
  await visible(page.getByText('Dataset replaced successfully. Its ID is unchanged.',{exact:true}));await visible(page.getByRole('heading',{name:'revised.csv',exact:true}));assert.equal(await page.locator('.schema-panel li').count(),2);assert.equal(state.datasets[0].id,'7');assert.equal(await page.locator('.results-region').count(),0);
 });
 await run('Identical replacement shows a clear message and leaves original discovery unchanged',async(page,state)=>{
  await open(page);await select(page);await execute(page);await page.getByRole('button',{name:`Replace ${dataset.filename}`,exact:true}).click();const modal=page.getByRole('dialog');
  await modal.getByLabel('Replacement CSV (up to 10 MiB)',{exact:true}).setInputFiles(file);state.mutationStatus=409;
  await modal.getByRole('button',{name:'Replace dataset',exact:true}).click();await visible(modal.getByText('This dataset already contains the same data. No changes were made.',{exact:true}));assert.equal(state.mutations.length,1);assert.equal(state.datasets[0].filename,dataset.filename);assert.equal(state.datasets[0].row_count,3);assert.ok(!(await modal.innerText()).includes('private mutation detail'));await modal.getByRole('button',{name:'Cancel',exact:true}).click();await select(page);await execute(page);assert.equal(await page.locator('.results-region tbody tr').count(),3);
 });
 await run('Deletion requires confirmation, removes the selection and returns to empty state',async(page,state)=>{
  await open(page);await select(page);await execute(page);await page.getByRole('button',{name:`Delete ${dataset.filename}`,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(state.mutations.length,0);assert.equal(await page.locator('.results-region').count(),1);
  await page.getByRole('button',{name:`Delete ${dataset.filename}`,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete dataset',exact:true}).click();await visible(page.getByText('Dataset deleted.',{exact:true}));await visible(page.getByRole('heading',{name:'Your first dataset starts here'}));assert.equal(await page.locator('.dataset-explorer').count(),0);assert.deepEqual(state.mutations,['DELETE']);
 });
 await run('Deletion CSRF and missing-dataset errors are safe and manually recoverable',async(page,state)=>{
  await open(page);await page.getByRole('button',{name:`Delete ${dataset.filename}`,exact:true}).click();const modal=page.getByRole('dialog');state.mutationStatus=403;await modal.getByRole('button',{name:'Delete dataset',exact:true}).click();await visible(modal.getByRole('alert'));assert.ok(!(await modal.innerText()).includes('private mutation detail'));assert.equal(state.datasets.length,1);
  state.mutationStatus=404;await modal.getByRole('button',{name:'Delete dataset',exact:true}).click();await visible(modal.getByText('This dataset is no longer available. Refresh the list.',{exact:true}));await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);
 });
 await run('Verified account changes discard pending mutation UI and old private selections',async(page,state)=>{
  await open(page);await select(page);await page.getByRole('button',{name:`Delete ${dataset.filename}`,exact:true}).click();state.mutationDelay=800;await page.getByRole('dialog').getByRole('button',{name:'Delete dataset',exact:true}).click();await visible(page.getByText('Deleting dataset…',{exact:true}));state.email='other-fictional@example.test';state.datasets=[];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await visible(page.getByRole('heading',{name:'Your first dataset starts here'}));await page.waitForTimeout(1000);assert.equal(await page.getByText('Dataset deleted.',{exact:true}).count(),0);assert.equal(await page.locator('.dataset-explorer').count(),0);
 });
 for(const mobile of [false,true])await run(`${mobile?'Mobile':'Desktop'} lifecycle dialog keyboard and responsive layout`,async(page)=>{
  await open(page);await page.getByRole('button',{name:`Replace ${dataset.filename}`,exact:true}).click();const modal=page.getByRole('dialog');await visible(modal);await page.keyboard.press('Shift+Tab');assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/dataset-lifecycle-${mobile?'mobile':'desktop'}.png`,fullPage:true});await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);
 },mobile);
 for(const mobile of [false,true])await run(`${mobile?'Mobile':'Desktop'} schema/query/results layout and keyboard table scrolling`,async(page,state)=>{
  await open(page);await select(page);await page.getByLabel('Result',{exact:true}).selectOption('sum');await page.getByLabel('team',{exact:true}).check();state.queryRows=[{team:'Alpha',value:30},{team:'Beta',value:6}];await execute(page);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.dataset-workspace').evaluate(el=>getComputedStyle(el).display),'grid');
  assert.equal(await page.locator('.dataset-workspace').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),mobile?1:2);
  assert.equal(await page.locator('.results-region').evaluate(el=>getComputedStyle(el).overflowX),'auto');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/datasets-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByLabel('Result',{exact:true}).selectOption('rows');state.queryRows=rows;await execute(page);const region=page.getByRole('region',{name:'Query results table'});await region.focus();await page.keyboard.press('ArrowRight');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },mobile);
 console.log(JSON.stringify({tests:result.length,passed:result.length,result},null,2));
}finally{await browser.close();}
