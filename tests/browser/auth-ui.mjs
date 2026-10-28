// Optional browser checks. Install Playwright outside the app; see the Day 8 guide.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.UI_BASE_URL || 'http://localhost:3103';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
async function check(name, run, mobile = false) {
  const context = await browser.newContext({ baseURL, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const state = { signedIn: false, invalid: false, csrfFailure: false, offline: false, sessionOffline: false, delay: 0, logoutToken: null, signupCalls: 0, loginCalls: 0 };
  const errors = [];
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/datasets', route => route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,datasets:[]})}));
  await context.route('**/api/documents?*', route => route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,documents:[],nextCursor:null})}));
  await context.route('**/api/auth/*', async route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (state.offline || (state.sessionOffline && endpoint.endsWith('/session'))) return route.abort('failed');
    if (state.delay && route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, state.delay));
    let body, status = 200;
    if (endpoint.endsWith('/session')) {
      body = state.signedIn ? { success: true, name: 'Fictional User', email: 'fictional@example.test', csrfToken: 'c'.repeat(64) } : { success: false, code: 'UNAUTHENTICATED' };
      if (!state.signedIn) status = 401;
    } else if (endpoint.endsWith('/logout')) {
      state.logoutToken = route.request().headers()['x-csrf-token'];
      if (state.csrfFailure) { status = 403; body = { success: false, code: 'CSRF_REJECTED' }; }
      else { state.signedIn = false; body = { success: true }; }
    } else {
      if (endpoint.endsWith('/signup')) state.signupCalls++; else state.loginCalls++;
      if (state.invalid) { status = 401; body = { success: false, code: 'INVALID_CREDENTIALS', error: 'Do not display raw private content' }; }
      else { state.signedIn = true; status = endpoint.endsWith('/signup') ? 201 : 200; body = { success: true, userId: '999', csrfToken: 'c'.repeat(64) }; }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  try { await run(page, state, context); assert.deepEqual(errors, []); results.push({ name, result: 'passed' }); console.log(`PASS: ${name}`); }
  finally { await context.close(); }
}
async function fillLogin(page) {
  await page.getByLabel('Email address', { exact: true }).fill('fictional@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Fictional password!');
}
async function visible(locator) { await locator.waitFor({ state: 'visible' }); }
try {
  await check('Signup validates fields and password confirmation before creating the account', async (page, state) => {
    await page.goto('/signup'); await page.screenshot({ path: '/tmp/day8-signup.png', fullPage: true }); await page.getByRole('button', { name: 'Create account' }).click();
    await visible(page.getByText('Enter your name.', { exact: true })); assert.equal(state.signupCalls, 0);
    await page.getByLabel('Full name').fill('Fictional User'); await fillLogin(page);
    await page.getByLabel('Confirm password', { exact: true }).fill('Different password!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await visible(page.getByText('The passwords do not match.')); assert.equal(state.signupCalls, 0);
    await page.getByLabel('Confirm password', { exact: true }).fill('Fictional password!');
    await page.getByRole('button', { name: 'Create account' }).click(); await page.waitForURL('**/dashboard');
    await visible(page.getByRole('heading', { name: 'Welcome to your workspace.' })); assert.equal(state.signupCalls, 1);
  });
  await check('Login, placeholder navigation and CSRF-protected logout', async (page, state) => {
    await page.goto('/login'); await fillLogin(page); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    for (const title of ['Documents', 'Datasets', 'AI Chat']) {
      await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: title, exact: true }).click();
      await visible(page.getByRole('heading', { name: title, exact: true }));
      if (title === 'Documents') await visible(page.getByRole('heading', {name:'Add a document'}));
      else if(title === 'Datasets') await visible(page.getByRole('heading',{name:'Add a CSV dataset'}));
      else await visible(page.getByRole('heading',{name:'Start with a question.',exact:true}));
    }
    await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForURL('**/login');
    assert.equal(state.logoutToken, 'c'.repeat(64)); assert.equal(state.signedIn, false);
    await page.goBack(); await page.waitForURL('**/login?reason=expired');
  });
  await check('Sign-in shows a loading state and prevents duplicate submission', async (page, state) => {
    state.delay = 900; await page.goto('/login'); await fillLogin(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await visible(page.getByText('Verifying your account…', { exact: true }));
    assert.equal(await page.getByRole('button', { name: 'Please wait…' }).isDisabled(), true);
    await page.waitForURL('**/dashboard'); assert.equal(state.loginCalls, 1);
  });
  await check('Sign-in connection failures stay on the form with safe feedback', async (page, state) => {
    await page.goto('/login'); await fillLogin(page); state.offline = true;
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await visible(page.locator('.notice[role="alert"]'));
    assert.match(await page.locator('.notice[role="alert"]').innerText(), /could not connect/);
    assert.equal(new URL(page.url()).pathname, '/login');
  });
  await check('Invalid credentials display a safe error', async (page, state) => {
    state.invalid = true; await page.goto('/login'); await page.screenshot({ path: '/tmp/day8-login.png', fullPage: true }); await fillLogin(page); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await visible(page.locator('.notice[role="alert"]')); assert.match(await page.locator('.notice[role="alert"]').innerText(), /email or password is incorrect/);
    assert.ok(!(await page.locator('body').innerText()).includes('private content')); assert.equal(new URL(page.url()).pathname, '/login');
  });
  await check('Missing session blocks direct protected navigation', async page => {
    await page.goto('/dashboard/documents'); await page.waitForURL('**/login?reason=expired');
    await visible(page.getByText('Your session has ended. Sign in to continue.'));
    assert.equal(await page.getByRole('heading', { name: 'Documents', exact: true }).count(), 0);
  });
  await check('Expired session removes the workspace on focus', async (page, state) => {
    state.signedIn = true; await page.goto('/dashboard'); await visible(page.getByRole('heading', { name: 'Welcome to your workspace.' }));
    state.signedIn = false; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForURL('**/login?reason=expired'); await visible(page.getByText('Your session has ended. Sign in to continue.'));
  });
  await check('CSRF rejection retains the workspace and reports sign-out failure', async (page, state) => {
    state.signedIn = true; state.csrfFailure = true; await page.goto('/dashboard'); await visible(page.getByRole('button', { name: 'Sign out' }));
    await page.getByRole('button', { name: 'Sign out' }).click(); await visible(page.locator('.notice[role="alert"]'));
    assert.match(await page.locator('.notice[role="alert"]').innerText(), /could not verify/); assert.equal(state.signedIn, true);
  });
  await check('Session connection failure stays closed and supports retry', async (page, state) => {
    state.signedIn = true; state.sessionOffline = true; await page.goto('/dashboard');
    await visible(page.getByRole('heading', { name: 'Connection interrupted' }));
    assert.equal(await page.getByRole('navigation', { name: 'Workspace' }).count(), 0);
    state.sessionOffline = false; await page.getByRole('button', { name: 'Try again' }).click();
    await visible(page.getByRole('heading', { name: 'Welcome to your workspace.' }));
  });
  await check('Logout notification expires another open tab', async (page, state, context) => {
    state.signedIn = true; await page.goto('/dashboard'); await visible(page.getByRole('button', { name: 'Sign out' }));
    const other = await context.newPage(); await other.goto('/dashboard'); await visible(other.getByRole('button', { name: 'Sign out' }));
    await page.getByRole('button', { name: 'Sign out' }).click(); await other.waitForURL('**/login');
  });
  await check('Mobile forms and workspace fit the viewport', async (page, state) => {
    for (const path of ['/','/signup','/login']) {
      await page.goto(path); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    state.signedIn = true; await page.goto('/dashboard'); await visible(page.getByRole('heading', { name: 'Welcome to your workspace.' }));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Documents', exact: true }).click();
    await visible(page.getByRole('heading', { name: 'Documents', exact: true }));
    await page.screenshot({ path: '/tmp/day8-mobile.png', fullPage: true });
  }, true);
  await check('Desktop overview screenshot and keyboard focus', async (page, state) => {
    state.signedIn = true; await page.goto('/dashboard'); await visible(page.getByRole('heading', { name: 'Welcome to your workspace.' }));
    await page.keyboard.press('Tab'); assert.match(await page.locator(':focus').innerText(), /Skip to content/);
    await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'), 'main-content');
    await page.locator(':focus').evaluate(element => element.blur());
    await page.screenshot({ path: '/tmp/day8-desktop.png', fullPage: true });
  });
  console.log(JSON.stringify({ tests: results.length, passed: results.length, results }, null, 2));
} finally { await browser.close(); }
