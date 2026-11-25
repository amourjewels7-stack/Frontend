const { chromium } = require('playwright');
const SITE = 'http://localhost:5173', API = 'http://localhost:10000';
let pass = 0, fail = 0; const failures = [];
const ok = (c, l, x) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; failures.push(l); console.log('  ✗', l, x !== undefined ? '→ ' + JSON.stringify(x) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = async () => (await fetch(API + '/__state')).json();

(async () => {
  await fetch(API + '/__reset');
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_|error-boundary\] (image|script-load)/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const toast = async () => (await page.locator('.toast').first().textContent().catch(() => '')) || '';
  const activeSec = async () => page.evaluate(() => [...document.querySelectorAll('.st-sec.on')].map(s => s.dataset.sec));

  console.log('\n1. Access control');
  await page.goto(SITE + '/settings.html'); await page.waitForURL('**/login.html**');
  ok(page.url().includes('next=settings.html'), 'signed-out visitor → login.html?next=settings.html');

  console.log('\n2. Account section');
  await page.goto(SITE + '/register.html'); await page.click('#tabEmail');
  await page.fill('#auName', 'Prachi Motwani'); await page.fill('#auEmail', 'prachi@example.com'); await page.fill('#auPass', 'secret123'); await page.fill('#auPass2', 'secret123');
  await page.click('#pnlEmail button[type=submit]'); await page.waitForURL('**/index.html');
  await page.goto(SITE + '/settings.html'); await page.waitForSelector('#st-account.on');
  const acct = await page.locator('#st-account').textContent();
  ok(acct.includes('Prachi Motwani') && acct.includes('prachi@example.com'), 'shows real name and email from the sign-in');
  ok(acct.includes('Email & password') && acct.includes('Not added'), 'sign-in method + "Not added" for missing mobile');
  ok(await page.locator('#st-account .st-chip.cur').textContent() === 'Current', '"Where you’re logged in" lists this device as Current');
  ok((await page.locator('#st-account .tr').textContent()).includes('Chrome'), 'device name parsed from the browser');
  ok((await activeSec()).join() === 'account', 'only one section visible at a time');
  ok(await page.locator('.st-nav button').count() === 6, 'six sections in the left list');
  ok(await page.locator('#stCard').evaluate(el => getComputedStyle(el).display === 'grid'), 'two-column card layout');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.st-top h1')).fontFamily.includes('Fraunces') || getComputedStyle(document.querySelector('.st-top h1')).fontFamily.includes('Mongolian')), 'heading uses the storefront serif');
  await page.screenshot({ path: 'st-account.png' });

  console.log('\n3. Navigation');
  await page.click('#stNav [data-sec="notifications"]');
  ok((await activeSec()).join() === 'notifications' && page.url().endsWith('#notifications'), 'clicking a section switches panel and sets the #hash');
  await page.goto(SITE + '/settings.html#privacy'); await page.waitForSelector('#st-privacy.on');
  ok((await activeSec()).join() === 'privacy', 'deep link #privacy opens that section');

  console.log('\n4. Addresses');
  await page.click('#stNav [data-sec="addresses"]');
  ok((await page.locator('#st-addresses').textContent()).includes('no saved addresses'), 'empty state');
  await page.click('#stAddrToggle'); await page.click('#stAddrForm button[type=submit]');
  ok((await page.locator('#stAddrMsg').textContent()).includes('highlighted') && await page.locator('#stAddrForm input.err').count() === 6, 'validation highlights all 6 fields');
  const fill = async (n, ph, a, pin, c, st) => { await page.fill('#stfName', n); await page.fill('#stfPhone', ph); await page.fill('#stfAddr', a); await page.fill('#stfPin', pin); await page.fill('#stfCity', c); await page.fill('#stfState', st); await page.click('#stAddrForm button[type=submit]'); };
  await fill('Ananya Sharma', '9876543210', 'Flat 402 Rose Residency', '452001', 'Indore', 'Madhya Pradesh'); await page.waitForSelector('.st-addr');
  ok(await page.locator('.st-addr').count() === 1 && (await page.locator('.st-addr').textContent()).includes('Default'), 'address saved and marked Default');
  await page.click('#stAddrToggle'); await fill('Ravi Gupta', '9123456780', '12 MG Road', '110001', 'Delhi', 'Delhi'); await page.waitForFunction(() => document.querySelectorAll('.st-addr').length === 2);
  ok((await page.locator('.st-addr').first().textContent()).includes('Ravi Gupta'), 'newest address becomes the default (first)');
  await page.locator('[data-addr-default]').click(); await sleep(200);
  ok((await page.locator('.st-addr').first().textContent()).includes('Ananya'), '"Make default" reorders');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('amour_address_v1')).name === 'Ananya Sharma'), 'default address is what checkout pre-fills (amour_address_v1)');
  await page.locator('[data-addr-del]').first().click(); await sleep(150);
  ok(await page.locator('.st-addr').count() === 1, 'remove works');

  console.log('\n5. Preferences (currency)');
  await page.click('#stNav [data-sec="preferences"]');
  ok(await page.locator('#stCurrency option').count() === 6, 'currency list comes from currency.js');
  await Promise.all([page.waitForNavigation(), page.selectOption('#stCurrency', 'USD')]);
  await page.waitForSelector('#st-preferences.on');
  ok(await page.evaluate(() => localStorage.getItem('amour_currency_v1') === 'USD') && (await activeSec()).join() === 'preferences', 'choice saved; page reloads on the same section');
  ok(await page.locator('#stCurrency').inputValue() === 'USD', 'select shows the saved currency');
  await page.evaluate(() => localStorage.setItem('amour_currency_v1', 'INR'));

  console.log('\n6. Notifications (offers & reminders)');
  await page.goto(SITE + '/settings.html#notifications'); await page.waitForSelector('#stMkt:not([disabled])');
  ok(await page.getAttribute('#stMkt', 'aria-checked') === 'false', 'switch starts off (server value)');
  ok((await page.locator('#st-notifications .st-chip.ok').textContent()) === 'Always on', 'order updates shown as always on');
  await page.click('#stMkt'); await page.waitForFunction(() => document.getElementById('stMkt').getAttribute('aria-checked') === 'true');
  ok((await state()).log.includes('MARKETING=true'), 'toggle → PUT /api/account/marketing');
  ok((await page.locator('#stMktDesc').textContent()).includes('occasional emails'), 'description updates');
  await page.reload(); await page.waitForSelector('#stMkt:not([disabled])');
  ok(await page.getAttribute('#stMkt', 'aria-checked') === 'true', 'setting survives a reload (read from server)');
  await page.click('#stMkt'); await page.waitForFunction(() => document.getElementById('stMkt').getAttribute('aria-checked') === 'false');
  ok((await state()).log.includes('MARKETING=false'), 'can switch off again');

  console.log('\n7. Search');
  await page.fill('#stSearch', 'currency');
  ok(await page.evaluate(() => document.getElementById('stBody').classList.contains('searching')), 'searching mode on');
  const vis = await page.evaluate(() => [...document.querySelectorAll('.st-sec')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.dataset.sec));
  ok(vis.join() === 'preferences,privacy', 'shows exactly the sections that mention it (Preferences + the Privacy "saved data" row)', vis);
  await page.fill('#stSearch', 'switch');
  const visB = await page.evaluate(() => [...document.querySelectorAll('.st-sec')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.dataset.sec));
  ok(visB.join() === 'notifications', 'a term found in one section shows only that section', visB);
  await page.fill('#stSearch', 'delete');
  const vis2 = await page.evaluate(() => [...document.querySelectorAll('.st-sec')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.dataset.sec));
  ok(vis2.join() === 'privacy', '"delete" finds Privacy & data', vis2);
  await page.fill('#stSearch', 'zzzzzz'); ok(await page.locator('#stNoMatch').isVisible(), 'no-match message');
  await page.fill('#stSearch', ''); await sleep(100);
  ok(!(await page.evaluate(() => document.getElementById('stBody').classList.contains('searching'))) && (await activeSec()).length === 1, 'clearing search restores single-section view');

  console.log('\n8. Orders section + delete-account safety');
  await page.goto(SITE + '/settings.html#orders'); await page.waitForSelector('#stOrdCount');
  await page.waitForFunction(() => document.getElementById('stOrdCount').textContent !== 'Loading…');
  ok((await page.locator('#stOrdCount').textContent()) === 'No orders yet.', 'no orders yet');
  // place + pay an order through the real API calls
  const orderNo = await page.evaluate(async () => {
    await AmourAPI.cartAdd({ productId: 'prod1000', sku: 'X', title: 'Test piece', price: 1, quantity: 1, imageUrl: '' });
    const o = await AmourAPI.checkout({ firstName: 'A', lastName: 'B', addressLine1: 'Street 1', city: 'Indore', state: 'MP', zipCode: '452001', phone: '9876543210' }, null, 'k-' + Math.random());
    await fetch('http://localhost:10000/__pay/' + o.orderNumber, { method: 'POST' });
    return o.orderNumber;
  });
  await page.reload(); await page.waitForFunction(() => /1 order/.test((document.getElementById('stOrdCount') || {}).textContent || ''));
  ok((await page.locator('#stOrdCount').textContent()).includes('1 on the way'), 'order count + "on the way" from the backend');
  await page.click('#stNav [data-sec="privacy"]'); await page.click('#stDelete');
  await page.waitForSelector('#stDelCheck .st-alert');
  ok((await page.locator('#stDelCheck').textContent()).includes(orderNo), 'deletion BLOCKED while an order is in progress (names the order)');
  ok(await page.locator('#stDelConfirm').isHidden() && await page.locator('#stDelGo').isDisabled(), 'no way to confirm while blocked');
  await page.keyboard.press('Escape'); ok(await page.locator('#stModal').count() === 0, 'Escape closes the dialog');
  await fetch(API + '/__status/' + orderNo + '/DELIVERED');
  await page.click('#stDelete'); await page.waitForSelector('#stDelConfirm:not([hidden])');
  ok(await page.locator('#stDelGo').isDisabled(), 'delivered order → allowed, but button locked until confirmed');
  await page.fill('#stDelInput', 'delete me'); ok(await page.locator('#stDelGo').isDisabled(), 'wrong text keeps it locked');
  await page.screenshot({ path: 'st-delete.png' });
  await page.fill('#stDelInput', 'DELETE'); ok(await page.locator('#stDelGo').isEnabled(), 'typing DELETE unlocks it');
  await page.click('#stDelGo'); await page.waitForSelector('text=Your account has been deleted');
  let st = await state();
  ok(st.deleted === 1 && st.users === 0, 'DELETE /api/account/customer called; user removed');
  ok(st.orders[0].customerEmail === 'deleted@amourjewels.in', 'past order anonymised by the backend');
  ok(await page.evaluate(() => !localStorage.getItem('amour_account_v1') && !localStorage.getItem('amour_addresses_v1') && !localStorage.getItem('amour_cart_v1')), 'local profile, addresses and bag wiped');
  await page.goto(SITE + '/settings.html'); await page.waitForURL('**/login.html**'); ok(true, 'deleted user is signed out (settings redirects to login)');

  console.log('\n9. Phone-only account (no email)');
  await fetch(API + '/__reset');
  const p2 = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p2.on('dialog', d => d.accept());
  await p2.goto(SITE + '/login.html'); await p2.fill('#auPhone', '9876543211'); await p2.click('#pnlPhone button[type=submit]'); await p2.waitForSelector('#pnlOtp:not([hidden])');
  await p2.fill('#auOtp', '123456'); await p2.click('#pnlOtp button[type=submit]'); await p2.waitForURL('**/index.html');
  await p2.goto(SITE + '/settings.html'); await p2.waitForSelector('#st-account.on');
  const t = await p2.locator('#st-account').textContent();
  ok(t.includes('+91 98765 43211') && t.includes('Mobile number (OTP)') && t.includes('Not set'), 'phone account: number, method and "Not set" name');
  await p2.click('#stNav [data-sec="notifications"]'); await p2.waitForFunction(() => /no email/i.test(document.getElementById('stMktDesc').textContent));
  ok(await p2.locator('#stMkt').isDisabled(), 'no email → offers switch disabled with an explanation');
  await p2.click('#stNav [data-sec="account"]'); await p2.click('#stSignOut'); await p2.waitForURL('**/index.html');
  ok(await p2.evaluate(() => !localStorage.getItem('amour_account_v1')), 'Sign out of this device works');

  console.log('\n10. Entry point + mobile');
  await fetch(API + '/__reset');
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } }); const mp = await m.newPage(); mp.on('dialog', d => d.accept());
  await mp.goto(SITE + '/register.html'); await mp.click('#tabEmail'); await mp.fill('#auName', 'Mobile User'); await mp.fill('#auEmail', 'm@example.com'); await mp.fill('#auPass', 'secret123'); await mp.fill('#auPass2', 'secret123');
  await mp.click('#pnlEmail button[type=submit]'); await mp.waitForURL('**/index.html');
  await mp.evaluate(() => openAccount()); await mp.waitForSelector('#acctDrawer.open .acct-card[href="settings.html"]');
  ok(true, 'account drawer has a Settings card linking to settings.html');
  await mp.goto(SITE + '/settings.html'); await mp.waitForSelector('#st-account.on');
  const swSettings = await mp.evaluate(() => document.documentElement.scrollWidth);
  await mp.goto(SITE + '/about.html'); await mp.waitForTimeout(500);
  const swAbout = await mp.evaluate(() => document.documentElement.scrollWidth);
  await mp.goto(SITE + '/settings.html'); await mp.waitForSelector('#st-account.on');
  ok(swSettings <= swAbout, 'mobile: settings is no wider than your existing pages (' + swSettings + ' vs ' + swAbout + ')');
  ok(await mp.evaluate(() => document.querySelector('.st-card').getBoundingClientRect().right <= window.innerWidth), 'mobile: the settings card itself fits the screen');
  ok(await mp.evaluate(() => getComputedStyle(document.querySelector('.st-nav nav')).flexDirection === 'row'), 'mobile: section list becomes a tab strip');
  await mp.screenshot({ path: 'st-mobile.png' });

  console.log('\n11. Console hygiene');
  ok(errors.length === 0, 'no JS errors', errors.slice(0, 4));
  await browser.close();
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail) { console.log('FAILED:', failures); process.exit(1); }
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
