const { chromium } = require('playwright');
const SITE = 'http://localhost:5173', API = 'http://localhost:10000';
let pass = 0, fail = 0; const failures = [];
const ok = (cond, label, extra) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; failures.push(label); console.log('  ✗', label, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = async () => (await fetch(API + '/__state')).json();
const FAKE_RZP = `
  window.Razorpay = function (o) { this.o = o; this.h = {}; };
  window.Razorpay.prototype.on = function (e, f) { this.h[e] = f; };
  window.Razorpay.prototype.open = function () {
    window.__rzp = this.o;
    const o = this.o;
    setTimeout(() => o.handler({ razorpay_payment_id: 'pay_mock' }), 200);                 // browser callback first…
    setTimeout(() => fetch('http://localhost:10000/__pay/' + o.notes.order_number, { method: 'POST' }), 3200); // …webhook lands later
  };`;

(async () => {
  await fetch(API + '/__reset');
  const browser = await chromium.launch();
  const newCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(FAKE_RZP);
    return ctx;
  };
  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_|error-boundary\] (image|script-load)/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
    page.on('dialog', d => d.accept());
  };
  const ctx = await newCtx();
  const page = await ctx.newPage(); watch(page, 'main');
  const toastText = async () => (await page.locator('.toast').first().textContent().catch(() => '')) || '';

  console.log('\n1. Catalogue from the backend');
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#arrivalsGrid .p-card');
  ok(await page.locator('#arrivalsGrid .p-card').count() === 4, 'home: 4 new arrivals rendered from API data');
  ok(await page.locator('#bestGrid .p-card').count() === 4, 'home: 4 bestsellers (featured flag → tag)');
  ok(!(await page.locator('[data-proof-claim]').first().isVisible().catch(() => false)), 'home: no "0.0 / 5 — 0 reviews" claim shown');
  await page.goto(SITE + '/shop.html'); await page.waitForSelector('#shopGrid .p-card');
  ok(await page.locator('#shopGrid .p-card').count() === 20, 'shop: all 20 products listed');
  await page.goto(SITE + '/shop.html?cat=rings'); await page.waitForSelector('#shopGrid .p-card');
  ok(await page.locator('#shopGrid .p-card').count() === 4, 'shop: ?cat=rings → 4 (multi-category via attributes.cats)');
  await page.goto(SITE + '/shop.html?collection=bridal'); await page.waitForSelector('#shopGrid .p-card');
  ok(await page.locator('#shopGrid .p-card').count() === 4, 'shop: ?collection=bridal → 4');
  await page.goto(SITE + '/shop.html?q=pearl'); await page.waitForSelector('#shopGrid .p-card');
  ok(await page.locator('#shopGrid .p-card').count() >= 2, 'shop: search "pearl" works');

  console.log('\n2. Product page + guest bag');
  await page.goto(SITE + '/product.html?id=aaroha-halo-solitaire-ring'); await page.waitForSelector('#pdpAdd');
  ok((await page.locator('.pdp-info h1').textContent()).includes('Aaroha'), 'PDP found by slug');
  ok(await page.locator('#sizeRow button').count() === 4, 'PDP: sizes 6–9 from attributes.sizes');
  await page.click('#pdpAdd'); await sleep(150);
  ok((await toastText()).includes('select a size'), 'PDP: size required');
  await page.click('#sizeRow [data-size="7"]'); await page.click('#pdpAdd'); await sleep(300);
  let calls = (await state()).log.filter(l => l.includes('/api/cart'));
  ok(calls.length === 0, 'guest bag stays local (no cart API calls)');
  ok(await page.locator('#bagCount').textContent() === '1', 'bag badge = 1');
  await page.evaluate(() => closeBag());
  await page.fill('#pdpPin', '452001'); await page.click('#pdpPinBtn'); await page.waitForFunction(() => /Delivers in/.test(document.querySelector('#pdpPinResult').textContent));
  ok(true, 'PDP: pincode via GET /api/pincode');
  await page.fill('#pdpPin', '900001'); await page.click('#pdpPinBtn'); await page.waitForFunction(() => /Not serviceable/.test(document.querySelector('#pdpPinResult').textContent));
  ok(true, 'PDP: unserviceable pincode reported');
  ok(await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]:last-of-type').textContent).aggregateRating === undefined), 'PDP: no aggregateRating without real reviews');

  console.log('\n3. Register (email) → bag merges into the account');
  await page.goto(SITE + '/register.html?next=cart.html');
  await page.click('#tabEmail');
  await page.fill('#auName', 'Test Customer'); await page.fill('#auEmail', 'test@example.com');
  await page.fill('#auPass', 'secret123'); await page.fill('#auPass2', 'secret999');
  await page.click('#pnlEmail button[type=submit]'); await sleep(200);
  ok((await page.locator('#auErrEmail').textContent()).includes('match'), 'register: password mismatch caught client-side');
  await page.fill('#auPass2', 'secret123'); await page.click('#pnlEmail button[type=submit]');
  await page.waitForURL('**/cart.html', { timeout: 8000 });
  await page.waitForSelector('.cart-row');
  ok(await page.locator('.cart-row').count() === 1 && (await page.locator('.cart-row .cr-meta').textContent()).includes('Size 7'), 'cart page shows the merged line with Size 7');
  let st = await state();
  const sc = st.carts['test@example.com'];
  ok(sc && sc.items.length === 1 && sc.items[0].title === 'Aaroha Halo Solitaire Ring (Size 7)', 'server cart holds the line; size carried in title', sc && sc.items);
  ok(await page.evaluate(() => !localStorage.getItem('amour_account_v1').includes('accessToken') && !document.cookie.includes('accessToken')), 'no token readable by JavaScript (HttpOnly cookies)');

  console.log('\n4. Access token expires → silent refresh');
  await fetch(API + '/__expire');
  await page.reload(); await page.waitForSelector('.cart-row');
  for (let i = 0; i < 30 && !(await state()).log.includes('POST /api/auth/refresh'); i++) await sleep(100);
  st = await state();
  ok(st.log.filter(l => l === 'POST /api/auth/refresh').length >= 1, 'bare 403 → POST /api/auth/refresh → retry');
  ok(await page.locator('.cart-row').count() === 1, 'bag still loaded after refresh');
  ok(await page.evaluate(() => !!JSON.parse(localStorage.getItem('amour_account_v1')).email), 'still signed in');

  console.log('\n5. Quantity changes sync to the server');
  await page.click('.cart-row [data-inc]'); await sleep(600);
  st = await state(); ok(st.carts['test@example.com'].items[0].quantity === 2, 'qty +1 → server quantity 2');
  await page.click('.cart-row [data-dec]'); await sleep(900);
  st = await state(); ok(st.carts['test@example.com'].items[0].quantity === 1, 'qty −1 → server quantity 1 (remove + re-add)');
  ok(st.carts['test@example.com'].items[0].title.includes('Size 7'), 'size survives the remove + re-add');
  for (let i = 0; i < 12; i++) { await page.click('.cart-row [data-inc]').catch(() => {}); await sleep(120); }
  ok(await page.locator('.cart-row .qty span').textContent() === '10', 'bag cannot exceed stock (10)');

  // back to 1 for the rest
  await page.evaluate(async () => { for (let i = 0; i < 9; i++) { setQty('aaroha-halo-solitaire-ring', getCart()[0].qty - 1); await new Promise(r => setTimeout(r, 400)); } });
  await sleep(600);
  st = await state(); ok(st.carts['test@example.com'].items[0].quantity === 1, 'bag trimmed back to 1');
  ok((await page.locator('.cart-row .qty span').textContent()) === '1', 'UI shows 1');
  ok((await page.locator('.summary').textContent()).includes('₹8,900'), 'cart summary: ₹8,900 subtotal');
  ok((await page.locator('.summary .sum-row').nth(1).textContent()).includes('FREE'), 'shipping FREE above ₹2,000 (backend rule)');

  console.log('\n6. Checkout with coupon + payment');
  await page.goto(SITE + '/checkout.html'); await page.waitForSelector('#cxAddressForm');
  ok(await page.locator('#cxGstin, #cxWaOpt, #cxEmail').count() === 0, 'checkout: GSTIN / WhatsApp / e-mail fields removed');
  await page.click('#cxAddressForm button[type=submit]'); await sleep(300);
  ok((await toastText()).includes('fix the highlighted'), 'checkout: validation blocks empty address');
  await page.fill('#cxName', 'Ananya Sharma'); await page.fill('#cxPhone', '9876543210'); await page.fill('#cxAddress', 'Flat 402, Rose Residency');
  await page.fill('#cxLandmark', 'Near MG Road'); await page.fill('#cxPincode', '900001'); await page.fill('#cxCity', 'Indore'); await page.fill('#cxState', 'Madhya Pradesh');
  await page.click('#cxAddressForm button[type=submit]'); await sleep(500);
  ok((await toastText()).includes('not serviceable'), 'checkout: unserviceable pincode blocked');
  await page.fill('#cxPincode', '452001');
  await page.click('#cxAddressForm button[type=submit]'); await page.waitForSelector('#cxStep2:not([hidden])');
  await page.fill('#cxCode', 'bogus'); await page.click('#cxApply'); await sleep(500);
  ok((await toastText()).toLowerCase().includes('invalid'), 'coupon: invalid code rejected by server');
  await page.fill('#cxCode', 'first10'); await page.click('#cxApply'); await page.waitForSelector('#cxApplied:not([hidden])');
  ok((await page.locator('#cxDisc').textContent()).includes('890'), 'coupon: FIRST10 → ₹890 off (server-validated)');
  ok((await page.locator('#cxTotal').textContent()).includes('8,010'), 'summary total ₹8,010');
  await page.click('#cxPayNow');
  await page.waitForSelector('#cxStep3:not([hidden])', { timeout: 8000 });
  ok((await page.locator('#cxOrderId').textContent()).includes('confirming'), 'success step first shows "confirming payment"');
  await page.waitForFunction(() => /paid/.test(document.querySelector('#cxOrderId').textContent), null, { timeout: 15000 });
  ok(true, 'polling saw the webhook: order flips to "paid"');
  st = await state();
  const ord = st.orders[0];
  ok(ord && ord.totalAmount === 8010 && ord.discountAmount === 890 && ord.shippingCost === 0, 'server order priced correctly', ord && { t: ord.totalAmount, d: ord.discountAmount });
  ok(ord.shippingAddress.firstName === 'Ananya' && ord.shippingAddress.lastName === 'Sharma' && ord.shippingAddress.zipCode === '452001' && ord.shippingAddress.addressLine2 === 'Near MG Road', 'address mapped to backend fields');
  ok(await page.evaluate(() => window.__rzp.amount === 801000 && window.__rzp.order_id.startsWith('order_') && window.__rzp.key === 'rzp_test_mock'), 'Razorpay opened with server-provided key / order / amount');
  ok(await page.evaluate(() => (getCart()).length === 0), 'local bag cleared after payment');
  ok(st.carts['test@example.com'].items.length === 0, 'server bag cleared');
  ok(st.products.find(p => p.sku === 'AJ-RG-019').stock === 9, 'stock reserved on the server (10 → 9)');
  const orderNo = ord.orderNumber;

  console.log('\n7. Your Orders + tracking + invoice');
  await page.goto(SITE + '/orders.html'); await page.waitForSelector('.ord-card');
  ok(await page.locator('.ord-card').count() === 1, 'orders page lists the paid order');
  ok((await page.locator('.ord-card .acct-chip').textContent()) === 'Placed', 'status label: PAYMENT_CONFIRMED → Placed');
  ok((await page.locator('.ord-card').textContent()).includes('8,010'), 'order total shown');
  await fetch(API + '/__status/' + orderNo + '/PACKED'); await fetch(API + '/__status/' + orderNo + '/SHIPPED');
  await page.goto(SITE + '/track.html?order=' + orderNo); await page.waitForSelector('#trkResult .bento');
  ok((await page.locator('#trkResult .badge-ver').textContent()) === 'Shipped', 'track (signed in): Shipped');
  ok((await page.locator('#trkResult .scan').count()) >= 3, 'track: real timeline events shown');
  ok((await page.locator('#trkResult .trk-meta').textContent()).includes('AWB123456'), 'track: AWB from backend');
  ok(await page.locator('#trkResult a[href^="https://www.delhivery.com"]').count() === 1, 'track: courier link only if https');
  await fetch(API + '/__status/' + orderNo + '/DELIVERED');
  await page.goto(SITE + '/track.html?order=' + orderNo); await page.waitForSelector('#trkResult [data-act="return"]');
  ok(await page.locator('[data-act="cancel"]').count() === 0, 'no fake Cancel button');
  await page.click('[data-act="return"]'); await page.selectOption('#rtReason', 'DEFECTIVE'); await page.fill('#rtText', 'Stone loose');
  await page.click('#rtSubmit'); await page.waitForSelector('#rtBox .rv-thanks');
  st = await state(); ok(st.returns.length === 1 && st.returns[0].orderNumber === orderNo && st.returns[0].productId === ord.items[0].productId && st.returns[0].reason === 'DEFECTIVE', 'return request sent with orderNumber/productId/reason', st.returns[0]);
  await page.locator('.rv-star[data-star="5"]').click(); await page.fill('#rvTitle', 'Gorgeous'); await page.fill('#rvText', 'Absolutely beautiful finish and sparkle.');
  await page.click('#rvSubmit'); await page.waitForSelector('#rvSec .rv-thanks');
  st = await state(); ok(st.reviews.length === 1 && st.reviews[0].rating === 5 && st.reviews[0].comment.startsWith('Gorgeous — '), 'review posted (title folded into comment)', st.reviews[0]);
  await page.goto(SITE + '/product.html?id=aaroha-halo-solitaire-ring'); await page.waitForSelector('.pdp-info');
  await page.waitForSelector('text=Customer reviews (1)', { timeout: 5000 });
  ok(await page.evaluate(() => !!JSON.parse(document.querySelector('script[type="application/ld+json"]:last-of-type').textContent).aggregateRating), 'PDP now shows real review + aggregateRating');
  await page.goto(SITE + '/invoice.html?order=' + orderNo); await page.waitForSelector('#invRoot iframe', { timeout: 8000 });
  ok((await page.locator('#invRoot iframe').getAttribute('src')).startsWith('blob:'), 'invoice: authenticated PDF fetched as blob and embedded');

  console.log('\n8. Guest tracking (order number + e-mail)');
  const g = await newCtx(); const gp = await g.newPage(); watch(gp, 'guest');
  await gp.goto(SITE + '/track.html'); await gp.fill('#trkId', orderNo); await gp.click('#trkForm button');
  await sleep(500); ok((await gp.locator('.toast').first().textContent()).includes('e-mail'), 'guest: e-mail required');
  await gp.fill('#trkEmail', 'wrong@example.com'); await gp.click('#trkForm button'); await sleep(600);
  ok((await gp.locator('.toast').first().textContent()).includes('No order found'), 'guest: wrong e-mail → friendly not-found');
  await gp.fill('#trkEmail', 'test@example.com'); await gp.click('#trkForm button'); await gp.waitForSelector('#trkResult .bento');
  ok((await gp.locator('#trkResult .badge-ver').textContent()) === 'Delivered', 'guest: tracked with order number + e-mail');
  ok(await gp.locator('[data-act="return"]').count() === 0, 'guest: no return button (must sign in)');
  await gp.goto(SITE + '/orders.html'); await gp.waitForURL('**/login.html**'); ok(gp.url().includes('next=orders.html'), 'guest: orders page redirects to login with ?next');
  await gp.goto(SITE + '/checkout.html'); await gp.waitForURL('**/login.html**'); ok(gp.url().includes('next=checkout.html'), 'guest: checkout redirects to login with ?next');

  console.log('\n9. Phone OTP login');
  await gp.goto(SITE + '/login.html?next=index.html');
  await gp.fill('#auPhone', '9876543211'); await gp.click('#pnlPhone button[type=submit]'); await gp.waitForSelector('#pnlOtp:not([hidden])');
  ok((await gp.locator('#authMsg').textContent()).includes('by SMS'), 'login: OTP step (no demo code on screen)');
  await gp.fill('#auOtp', '111111'); await gp.click('#pnlOtp button[type=submit]'); await sleep(400);
  ok((await gp.locator('#auErrOtp').textContent()).length > 0, 'login: wrong OTP rejected by server');
  await gp.fill('#auOtp', '123456'); await gp.click('#pnlOtp button[type=submit]'); await gp.waitForURL('**/index.html', { timeout: 6000 });
  ok(await gp.evaluate(() => JSON.parse(localStorage.getItem('amour_account_v1')).type === 'phone'), 'login: phone profile saved');
  await gp.click('[data-account]'); await gp.waitForSelector('#acctDrawer.open');
  ok((await gp.locator('#acctBody').textContent()).includes('+91 98765 43211'), 'account drawer shows the real signed-in phone');
  await gp.click('[data-acct-signout]'); await sleep(600);
  ok(await gp.evaluate(() => !localStorage.getItem('amour_account_v1')), 'sign out clears the profile');

  console.log('\n10. Wrong password · contact · newsletter · sold-out');
  await gp.goto(SITE + '/login.html'); await gp.click('#tabEmail'); await gp.fill('#auEmail', 'test@example.com'); await gp.fill('#auPass', 'nottherightone1');
  await gp.click('#pnlEmail button[type=submit]'); await sleep(500);
  ok((await gp.locator('#auErrEmail').textContent()).includes('Wrong email or password'), 'login: wrong password message');
  await gp.goto(SITE + '/contact.html'); await gp.fill('#cfName', 'Priya'); await gp.fill('#cfEmail', 'priya@example.com'); await gp.fill('#cfPhone', '98765 43210');
  await gp.selectOption('#cfTopic', { index: 1 }); await gp.fill('#cfMsg', 'Do you ship to Pune?'); await gp.click('#contactForm button[type=submit], #contactForm button:not([type])');
  await gp.waitForSelector('#contactSuccess.show'); st = await state();
  ok(st.messages.length === 1 && st.messages[0].phone === '9876543210' && st.messages[0].name === 'Priya', 'contact form → POST /api/messages', st.messages[0]);
  await gp.goto(SITE + '/index.html'); await gp.fill('.nl-form input[type=email]', 'fan@example.com'); await gp.click('.nl-form button'); await sleep(500);
  st = await state(); ok(st.newsletter.includes('fan@example.com'), 'newsletter → POST /api/newsletter');
  await fetch(API + '/__stock?sku=AJ-ER-002&n=0');
  await gp.evaluate(() => sessionStorage.removeItem('amour_catalogue_v1'));   // catalogue is cached for 60 s
  await gp.goto(SITE + '/shop.html'); await gp.waitForSelector('#shopGrid .p-card');
  ok((await gp.locator('#shopGrid .p-card', { hasText: 'Zoya' }).locator('.p-tag').textContent()).includes('Sold out'), 'sold-out product tagged on the shop grid');
  await gp.goto(SITE + '/product.html?id=zoya-chunky-hoops'); await gp.waitForSelector('#pdpAdd');
  ok(await gp.locator('#pdpAdd').isDisabled() && (await gp.locator('#pdpAdd').textContent()) === 'Sold out', 'PDP: Add disabled and labelled "Sold out"');
  await gp.goto(SITE + '/product.html?id=does-not-exist'); await gp.waitForSelector('.shop-empty');
  ok((await gp.locator('.shop-empty').textContent()).includes("couldn’t find"), 'unknown product → not-found message (not product #1)');
  await gp.goto(SITE + '/gift-card.html');
  ok(await gp.locator('#gcAdd').count() === 0 && (await gp.locator('#gcWa').getAttribute('href')).includes('wa.me'), 'gift cards: WhatsApp ordering, no fake add-to-bag');
  ok((await gp.content()).indexOf('admin.html') < 0, 'no public link to admin.html');

  console.log('\n11. Backend unreachable');
  const d = await newCtx(); await d.addInitScript("window.AMOUR_API_BASE='http://localhost:1'"); const dp = await d.newPage();
  await dp.goto(SITE + '/shop.html'); await dp.waitForSelector('.shop-empty');
  ok((await dp.locator('.shop-empty').textContent()).includes("couldn’t load"), 'shop: friendly error when the API is down');
  await dp.goto(SITE + '/index.html'); await dp.waitForSelector('#arrivalsGrid p'); ok(true, 'home: friendly error when the API is down');

  console.log('\n12. Console hygiene');
  ok(errors.length === 0, 'no JS errors on any page', errors.slice(0, 5));

  await browser.close();
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail) { console.log('FAILED:', failures); process.exit(1); }
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
