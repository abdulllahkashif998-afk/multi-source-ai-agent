import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.UI_BASE_URL || 'http://localhost:3000';
const recordOnly = process.env.STYLE_RECORD_ONLY === '1';
const prefix = process.env.STYLE_OUTPUT_PREFIX || '/tmp/frontend-styles';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const [size, width, height] of [['desktop',1440,1000],['mobile',390,844]]) {
    const context = await browser.newContext({ baseURL, viewport:{width,height}, colorScheme:'dark' });
    await context.route('**/api/auth/session', route => route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,name:'Fictional User',email:'fictional@example.test',csrfToken:'c'.repeat(64)})}));
    await context.route('**/api/datasets', route => route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,datasets:[]})}));
  await context.route('**/api/documents?*', route => route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,documents:[],nextCursor:null})}));
    const page = await context.newPage();
    const errors = []; page.on('pageerror',error=>errors.push(error.message));
    const css = [];
    page.on('response', response => {
      if(new URL(response.url()).pathname.endsWith('.css'))css.push({status:response.status(),type:response.headers()['content-type']});
    });
    for (const path of ['/','/signup','/login','/dashboard','/dashboard/documents','/dashboard/datasets','/dashboard/chat']) {
      await page.goto(path);
      await page.locator(path.startsWith('/dashboard')?'.workspace':path==='/'?'.landing':'.auth-page').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      const styles = await page.evaluate(() => {
        const read=(selector,property)=>{const node=document.querySelector(selector);return node?getComputedStyle(node)[property]:null;};
        return {
          background:read('body','backgroundColor'),color:read('body','color'),
          overflow:document.documentElement.scrollWidth>innerWidth,
          landing:read('.landing','display'),form:read('.auth-page','display'),
          columns:read('.auth-page','gridTemplateColumns'),button:read('.primary','backgroundColor'),
          workspace:read('.workspace','display'),direction:read('.workspace','flexDirection'),
          sidebar:read('.sidebar','backgroundColor'),cards:read('.area-grid','display'),
          cardColumns:read('.area-grid','gridTemplateColumns'),empty:read('.empty-state','display'),
          emptyBorder:read('.empty-state','borderTopStyle'),upload:read('.upload-panel','display'),dataset:read('.dataset-workspace','display'),chat:read('.chat-modes','display'),composer:read('.chat-composer','paddingTop'),
        };
      });
      results.push({size,path,...styles});
      if(path==='/dashboard')await page.screenshot({path:`${prefix}-${size}.png`,fullPage:true});
      if(!recordOnly){
        assert.equal(styles.background,'rgb(247, 248, 245)',`${size} ${path}: current theme`);
        assert.equal(styles.overflow,false,`${size} ${path}: no overflow`);
        if(path==='/')assert.equal(styles.landing,'flex');
        if(path==='/signup'||path==='/login'){
          assert.equal(styles.form,'grid');assert.equal(styles.button,'rgb(27, 102, 87)');
          assert.equal(styles.columns.split(' ').length,size==='desktop'?2:1);
        }
        if(path.startsWith('/dashboard')){
          assert.equal(styles.workspace,'flex');assert.equal(styles.direction,size==='desktop'?'row':'column');
          assert.equal(styles.sidebar,'rgb(23, 47, 41)');
          if(path==='/dashboard'){assert.equal(styles.cards,'grid');assert.equal(styles.cardColumns.split(' ').length,size==='desktop'?3:1);}
          else if(path==='/dashboard/documents'||path==='/dashboard/datasets'){assert.equal(styles.upload,'flex');if(path==='/dashboard/datasets')assert.equal(styles.dataset,'grid');}
          else {assert.equal(styles.chat,'grid');assert.ok(parseFloat(styles.composer)>0);}
        }
      }
    }
    if(!recordOnly){assert.ok(css.length>0);assert.ok(css.every(r=>r.status===200&&r.type?.includes('text/css')));assert.deepEqual(errors,[]);}
    await context.close();
  }
  await writeFile(`${prefix}.json`,JSON.stringify({baseURL,recordOnly,checks:results.length,results},null,2));
  console.log(JSON.stringify({baseURL,recordOnly,checks:results.length,result:recordOnly?'recorded':'passed'}));
} finally {await browser.close();}
