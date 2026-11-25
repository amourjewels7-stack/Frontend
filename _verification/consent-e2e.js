const { chromium } = require('playwright');
const SITE = 'http://localhost:5173', API = 'http://localhost:10000';
let pass = 0, fail = 0; const failures = [];
const ok = (c, l, x) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; failures.push(l); console.log('  ✗', l, x !== undefined ? '→ ' + JSON.stringify(x) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = async () => (await fetch(API + '/__state')).json();
const reset = () => fetch(API + '/__reset');

(async () => {
  await reset();
  const browser = await chromium.launch();
  const errors = [];
  const fresh = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_|error-boundary\] (image|script-load)/.test(m.text())) errors.push('console: ' + m.text()); });
    p.on('dialog', d => d.accept());
    return p;
  };
  const emailSignup = async (p, name, email, tick) => {
    await p.goto(SITE + '/register.html'); await p.click('#tabEmail');
    await p.fill('#auName', name); await p.fill('#auEmail', email); await p.fill('#auPass', 'secret123'); await p.fill('#auPass2', 'secret123');
    if (tick) await p.check('#auMarketing');
    await p.click('#pnlEmail button[type=submit]'); await p.waitForURL('**/index.html');
  };
  const googleOnRegister = async (p, email, tick, tab) => {
    await p.goto(SITE + '/register.html');
    if (tab === 'email') await p.click('#tabEmail');
    if (tick) await p.check(tab === 'email' ? '#auMarketing' : '#auMarketingG');
    await p.evaluate(e => authHandleCredential({ credential: 'gtok-' + e }), email);
    await p.waitForURL('**/index.html', { timeout: 6000 });
  };
  const logCount = async (needle) => (await state()).log.filter(l => l.startsWith(needle)).length;

  console.log('\n1. The checkboxes on the register page');
  let p = await fresh();
  await p.goto(SITE + '/register.html');
  ok(await p.locator('#auGConsent').isVisible(), 'Phone tab (default): the Google consent checkbox is visible');
  ok(!(await p.locator('#auMarketingG').isChecked()), 'it is NOT pre-ticked');
  ok(await p.locator('#pnlPhone input[type=checkbox]').count() === 0, 'phone form has no marketing checkbox (no email address to send to)');
  await p.click('#tabEmail');
  ok(await p.locator('#auGConsent').isHidden(), 'Email tab: the Google box hides (the email form has its own)');
  ok(await p.locator('#auMarketing').isVisible() && !(await p.locator('#auMarketing').isChecked()), 'Email tab: its own checkbox is visible and unticked');
  await p.click('#tabPhone'); ok(await p.locator('#auGConsent').isVisible(), 'back on Phone tab the Google box returns');
  await p.screenshot({ path: 'consent-register.png' });
  await p.goto(SITE + '/login.html');
  ok(await p.locator('#auGConsent, #auMarketing, #auMarketingG').count() === 0, 'login page has no marketing checkbox');

  console.log('\n2. E-mail sign-up');
  p = await fresh(); await emailSignup(p, 'No Consent', 'no@example.com', false);
  let st = await state();
  ok(st.log.includes('SIGNUP_CONSENT=false') && st.marketing['no@example.com'] === false, 'unticked → account created with marketing OFF');
  p = await fresh(); await emailSignup(p, 'Yes Consent', 'yes@example.com', true);
  st = await state();
  ok(st.log.includes('SIGNUP_CONSENT=true') && st.marketing['yes@example.com'] === true, 'ticked → account created with marketing ON');

  console.log('\n3. Google sign-up (the gap that existed)');
  await reset();
  p = await fresh(); await googleOnRegister(p, 'g1@example.com', true, 'phone');
  st = await state();
  ok(st.marketing['g1@example.com'] === true && st.log.includes('MARKETING=true'), 'ticked (phone tab) → saved right after Google sign-in via PUT /api/account/marketing');
  p = await fresh(); await googleOnRegister(p, 'g2@example.com', false, 'phone');
  st = await state();
  ok(st.marketing['g2@example.com'] === false && (await logCount('MARKETING=')) === 1, 'unticked → NO preference call at all (only g1\'s earlier one is in the log)');
  p = await fresh(); await googleOnRegister(p, 'g3@example.com', true, 'email');
  st = await state();
  ok(st.marketing['g3@example.com'] === true, 'Email tab + visible email-form box ticked + Google → counts');
  p = await fresh();
  await p.goto(SITE + '/register.html'); await p.click('#tabEmail'); await p.check('#auMarketing'); await p.click('#tabPhone');
  await p.evaluate(() => authHandleCredential({ credential: 'gtok-g4@example.com' })); await p.waitForURL('**/index.html');
  st = await state();
  ok(st.marketing['g4@example.com'] === false, 'only the box you can SEE counts (ticked email box, switched to Phone tab → not applied)');

  console.log('\n4. An existing choice is never overwritten by an unticked box');
  p = await fresh(); await googleOnRegister(p, 'g1@example.com', false, 'phone');   // g1 opted in earlier
  st = await state();
  ok(st.marketing['g1@example.com'] === true, 'existing opted-in account signing in via Google with the box unticked stays opted in');

  console.log('\n5. Phone sign-up never touches marketing');
  p = await fresh(); const before = await logCount('MARKETING=');
  await p.goto(SITE + '/register.html'); await p.check('#auMarketingG');
  await p.fill('#auPhone', '9876543299'); await p.click('#pnlPhone button[type=submit]'); await p.waitForSelector('#pnlOtp:not([hidden])');
  await p.fill('#auOtp', '123456'); await p.click('#pnlOtp button[type=submit]'); await p.waitForURL('**/index.html');
  ok((await logCount('MARKETING=')) === before, 'ticking the Google box then signing up by phone → no marketing call');

  console.log('\n6. Settings → Notifications (round trip)');
  await reset();
  p = await fresh(); await emailSignup(p, 'Round Trip', 'rt@example.com', true);
  await p.goto(SITE + '/settings.html#notifications'); await p.waitForSelector('#stMkt:not([disabled])');
  ok((await p.locator('#st-notifications').textContent()).includes('Marketing emails'), 'row is labelled "Marketing emails"');
  ok(await p.getAttribute('#stMkt', 'aria-checked') === 'true' && (await p.locator('#stMktDesc').textContent()).startsWith('On'), 'shows ON (the choice made at sign-up)');
  ok((await p.locator('#st-notifications').textContent()).includes('unsubscribe link'), 'tells the customer every email has an unsubscribe link');
  await p.click('#stMkt'); await p.waitForFunction(() => document.getElementById('stMkt').getAttribute('aria-checked') === 'false');
  st = await state(); ok(st.marketing['rt@example.com'] === false, 'switching OFF in Settings is saved on the server');
  ok((await p.locator('#stMktDesc').textContent()).startsWith('Off'), 'state text updates');
  await p.click('#stMkt'); await p.waitForFunction(() => document.getElementById('stMkt').getAttribute('aria-checked') === 'true');
  st = await state(); ok(st.marketing['rt@example.com'] === true, 'switching back ON is saved');

  console.log('\n7. Unsubscribe link in an e-mail → Settings agrees');
  const u = await fresh();
  await u.goto(SITE + '/unsubscribe.html'); await u.waitForSelector('#mpText');
  ok((await u.locator('#mpText').textContent()).includes('Settings → Notifications'), 'link without a token: tells people to use Settings → Notifications');
  await u.goto(SITE + '/about.html');   // a hash-only change would not reload the page script
  await u.goto(SITE + '/unsubscribe.html#t=tok-rt@example.com'); await u.waitForSelector('#mpBtn:not([hidden])');
  await u.click('#mpBtn'); await u.waitForFunction(() => /unsubscribed/i.test(document.getElementById('mpTitle').textContent));
  ok((await u.locator('#mpText').textContent()).includes('Settings → Notifications'), 'after unsubscribing: tells how to switch it back on');
  st = await state(); ok(st.marketing['rt@example.com'] === false && st.log.includes('UNSUB rt@example.com'), 'unsubscribe endpoint turned marketing OFF');
  await p.reload(); await p.waitForSelector('#stMkt:not([disabled])');
  ok(await p.getAttribute('#stMkt', 'aria-checked') === 'false', 'Settings now shows OFF (reads the server, not a local copy)');

  console.log('\n8. Hygiene');
  ok(errors.length === 0, 'no JS errors', errors.slice(0, 4));
  await browser.close();
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail) { console.log('FAILED:', failures); process.exit(1); }
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
