/* Mock of the Amour Jewels backend — mirrors the real controllers' contracts (read from source). */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const SITE_DIR = process.argv[2], WEB_PORT = 5173, API_PORT = 10000, ORIGIN = 'http://localhost:5173';
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../catalogue-seed.json'), 'utf8'));

let S;
function reset() {
  S = { products: seed.map((p, i) => Object.assign({ id: 'prod' + (1000 + i), createdAt: new Date(Date.now() - i * 864e5).toISOString() }, p)),
    users: {}, access: new Set(), refresh: {}, carts: {}, orders: [], returns: [], reviews: [], messages: [], newsletter: [], otps: {}, log: [], idem: new Set(), seq: 1 };
}
reset();

const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
const json = (res, code, body, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, cors, extra || {})); res.end(body === undefined ? '' : JSON.stringify(body)); };
const forbidden = (req, res) => json(res, 403, { timestamp: new Date().toISOString(), status: 403, error: 'Forbidden', path: req.url });   // Spring's bare 403
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => c.trim().split('=')).map(([k, ...v]) => [k, v.join('=')]));
const setCookies = (acc, ref) => ['accessToken=' + acc + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=900', 'refreshToken=' + ref + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'];
const userOut = u => ({ id: u.id, name: u.name, email: u.email, phoneNumber: u.phoneNumber, roles: ['ROLE_CUSTOMER'], active: true });
const round2 = v => Math.round(v * 100) / 100;

function issue(res, user, body) {
  const acc = 'acc-' + crypto.randomBytes(6).toString('hex'), ref = 'ref-' + crypto.randomBytes(6).toString('hex');
  S.access.add(acc); S.refresh[ref] = user.id;
  Object.keys(S.refresh).forEach(k => { if (S.refresh[k] === user.id && k !== ref) delete S.refresh[k]; });   // one refresh token per user, like the backend
  json(res, 200, body, { 'Set-Cookie': setCookies(acc, ref) });
}
const authed = req => { const c = cookies(req); if (!c.accessToken || !S.access.has(c.accessToken)) return null; return c.accessToken; };
const sessionUser = req => { const t = authed(req); return t ? S.tokenUser && S.tokenUser[t] : null; };
S.tokenUser = {};
const _issue = issue;
function issueFor(res, user, body) {
  const acc = 'acc-' + crypto.randomBytes(6).toString('hex'), ref = 'ref-' + crypto.randomBytes(6).toString('hex');
  S.access.add(acc); S.tokenUser[acc] = user; S.refresh[ref] = user.id;
  Object.keys(S.refresh).forEach(k => { if (S.refresh[k] === user.id && k !== ref) delete S.refresh[k]; });
  json(res, 200, body, { 'Set-Cookie': setCookies(acc, ref) });
}

function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch (e) { r({}); } }); }); }
const subject = u => u.email || u.phoneNumber;

const api = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  if (m === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const body = (m === 'POST' || m === 'PUT' || m === 'PATCH') ? await readBody(req) : {};
  S.log.push(m + ' ' + p);

  /* ---- test hooks ---- */
  if (p === '/__expire') { S.access.clear(); return json(res, 200, { ok: true }); }
  if (p === '/__reset') { reset(); S.tokenUser = {}; return json(res, 200, { ok: true }); }
  if (p === '/__state') return json(res, 200, { carts: S.carts, orders: S.orders, returns: S.returns, reviews: S.reviews, messages: S.messages, newsletter: S.newsletter, log: S.log, products: S.products.map(x => ({ sku: x.sku, stock: x.stockQuantity })) });
  if (p === '/__stock') { const pr = S.products.find(x => x.sku === url.searchParams.get('sku')); pr.stockQuantity = +url.searchParams.get('n'); return json(res, 200, { ok: true }); }
  let mm;
  if ((mm = p.match(/^\/__pay\/(.+)$/))) {                                 // simulates the Razorpay webhook
    const o = S.orders.find(x => x.orderNumber === mm[1]); if (!o) return json(res, 404, {});
    o.status = 'PAYMENT_CONFIRMED'; o.trackingTimeline.push({ status: 'PAYMENT_CONFIRMED', description: 'Payment received.', timestamp: new Date().toISOString() });
    S.carts[o.userId] = { items: [], totalPrice: 0 }; return json(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/__status\/([^/]+)\/(\w+)$/))) {
    const o = S.orders.find(x => x.orderNumber === mm[1]); o.status = mm[2];
    if (mm[2] !== 'PACKED') { o.courierName = 'Delhivery'; o.trackingNumber = 'AWB123456'; o.trackingUrl = 'https://www.delhivery.com/track/AWB123456'; }
    if (mm[2] === 'DELIVERED') { o.deliveredAt = new Date().toISOString(); o.returnEligible = true; }
    o.trackingTimeline.push({ status: mm[2], description: 'Status: ' + mm[2], timestamp: new Date().toISOString() });
    return json(res, 200, { ok: true });
  }

  /* ---- public ---- */
  if (p === '/api/products' && m === 'GET') return json(res, 200, S.products.filter(x => x.active));
  if (p === '/api/categories') return json(res, 200, ['Earrings', 'Necklaces', 'Rings', 'Bracelets', 'Diamonds', 'Pearls', 'Everyday', 'Bridal']);
  if ((mm = p.match(/^\/api\/pincode\/(.+)$/))) {
    if (!/^\d{6}$/.test(mm[1])) return json(res, 400, { serviceable: false, message: 'Invalid pincode' });
    const ok = !mm[1].startsWith('9'); return json(res, 200, ok ? { serviceable: true, courier: 'Delhivery', eta: '3-6 Days' } : { serviceable: false });
  }
  if ((mm = p.match(/^\/api\/feedback\/reviews\/product\/(.+)$/)) && m === 'GET') {
    const list = S.reviews.filter(r => r.productId === mm[1]);
    return json(res, 200, { reviews: list, currentPage: 0, totalPages: 1, totalReviews: list.length, summary: { averageRating: 0.0, totalReviews: 0 } });   // summary bug mirrored: always 0
  }
  if (p === '/api/messages' && m === 'POST') { if (!body.name || !body.email || !body.message) return json(res, 400, { error: 'A message is required.' }); S.messages.push(body); return json(res, 200, { valid: true, message: 'Message received.' }); }
  if (p === '/api/newsletter' && m === 'POST') { if (!body.email || !body.email.includes('@')) return json(res, 400, { message: 'Invalid email address' }); S.newsletter.push(body.email); return json(res, 200, { message: 'Subscribed successfully' }); }
  if (p === '/api/orders/track' && m === 'GET') {
    const o = S.orders.find(x => x.orderNumber === url.searchParams.get('orderNumber') && x.customerEmail === url.searchParams.get('email'));
    if (!o) return json(res, 404, undefined);
    return json(res, 200, { id: o.id, orderNumber: o.orderNumber, status: o.status, items: o.items, subtotal: o.subtotal, discountAmount: o.discountAmount, shippingCost: o.shippingCost, totalAmount: o.totalAmount,
      shippingAddress: o.shippingAddress, courier: o.courierName, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl, timeline: o.trackingTimeline, isReturnEligible: !!o.returnEligible, createdAt: o.createdAt });
  }

  /* ---- auth ---- */
  if (p === '/api/auth/signup' && m === 'POST') {
    if (!body.name || !body.email || !body.password) return json(res, 400, { error: 'A valid name is required.' });
    if (body.password.length < 8 || !/\d/.test(body.password) || !/[a-z]/i.test(body.password)) return json(res, 400, { error: 'Password must contain at least one letter and one digit.' });
    const em = body.email.toLowerCase();
    if (Object.values(S.users).some(u => u.email === em)) return json(res, 400, { error: 'Unable to create an account with these details.' });
    const u = { id: 'u' + S.seq++, name: body.name, email: em, password: body.password }; S.users[u.id] = u; return json(res, 200, { message: 'User registered successfully!', userId: u.id });
  }
  if (p === '/api/auth/login' && m === 'POST') {
    const u = Object.values(S.users).find(x => x.email === (body.email || '').toLowerCase() && x.password === body.password);
    if (!u) return json(res, 401, { error: 'Invalid credentials.' });
    return issueFor(res, u, { message: 'Login successful!', user: userOut(u) });
  }
  if (p === '/api/auth/send-otp' && m === 'POST') {
    if (!/^\+?\d{10,13}$/.test(body.phoneNumber || '')) return json(res, 400, { error: 'A valid phone number is required.' });
    S.otps[body.phoneNumber] = '123456'; return json(res, 200, { message: 'OTP sent successfully!' });
  }
  if (p === '/api/auth/verify-otp' && m === 'POST') {
    if (S.otps[body.phoneNumber] !== body.otp) return json(res, 401, { error: 'Invalid OTP.' });
    let u = Object.values(S.users).find(x => x.phoneNumber === body.phoneNumber);
    if (!u) { u = { id: 'u' + S.seq++, name: 'Mobile User', phoneNumber: body.phoneNumber }; S.users[u.id] = u; }
    return issueFor(res, u, { message: 'Phone verification successful!', user: userOut(u) });
  }
  if (p === '/api/auth/refresh' && m === 'POST') {
    const r = cookies(req).refreshToken, uid = r && S.refresh[r];
    if (!uid) return json(res, 401, { error: 'Invalid refresh token.' });
    delete S.refresh[r]; return issueFor(res, S.users[uid], { message: 'Token refreshed.', user: userOut(S.users[uid]) });
  }
  if (p === '/api/auth/logout' && m === 'POST') return json(res, 200, { message: 'Logged out.' }, { 'Set-Cookie': ['accessToken=; Max-Age=0; Path=/', 'refreshToken=; Max-Age=0; Path=/'] });

  /* ---- everything below needs a valid access cookie (else Spring's bare 403) ---- */
  const user = sessionUser(req);
  if (!user) return forbidden(req, res);
  const key = subject(user);
  const cart = () => S.carts[key] || (S.carts[key] = { items: [], totalPrice: 0 });
  const recalc = c => { c.totalPrice = c.items.reduce((n, i) => n + i.price * i.quantity, 0); return c; };

  if (p === '/api/cart' && m === 'GET') return json(res, 200, recalc(cart()));
  if (p === '/api/cart/items' && m === 'POST') {
    const pr = S.products.find(x => x.id === body.productId); if (!pr) return json(res, 500, { error: 'Request could not be processed.' });
    const c = cart(), ex = c.items.find(i => i.productId === body.productId);
    if (!pr.active || pr.stockQuantity < body.quantity || (ex && ex.quantity + body.quantity > pr.stockQuantity)) { res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain' }, cors)); return res.end('Product is currently out of stock or discontinued.'); }
    if (ex) ex.quantity += body.quantity; else c.items.push({ productId: body.productId, sku: body.sku, title: body.title, price: pr.price, quantity: body.quantity, imageUrl: body.imageUrl });
    return json(res, 200, recalc(c));
  }
  if ((mm = p.match(/^\/api\/cart\/items\/(.+)$/)) && m === 'DELETE') { const c = cart(); c.items = c.items.filter(i => i.productId !== mm[1]); return json(res, 200, recalc(c)); }
  if (p === '/api/checkout/validate-coupon' && m === 'POST') {
    const code = String(body.code || '').toUpperCase();
    if (code !== 'FIRST10') return json(res, 400, { valid: false, message: 'Invalid coupon code.' });
    if (body.subtotal < 1500) return json(res, 400, { valid: false, message: 'Cart subtotal must be at least ₹1500.0 to use this code.' });
    return json(res, 200, { valid: true, type: 'PERCENTAGE', discountAmount: Math.round(body.subtotal * 0.10) });
  }
  if (p === '/api/orders/checkout' && m === 'POST') {
    const idem = req.headers['idempotency-key']; if (!idem) return json(res, 400, { error: 'Required header Idempotency-Key is missing' });
    if (S.idem.has(idem)) return json(res, 409, { error: 'Checkout is already in progress or completed for this session.' });
    const a = body.shippingAddress || {};
    if (!a.firstName || !a.addressLine1 || !a.city || !a.state) return json(res, 400, { error: 'Name, address, city and state are required.' });
    if (!/^\d{6}$/.test(a.zipCode || '')) return json(res, 400, { error: 'Enter a valid 6-digit pincode.' });
    const c = cart(); if (!c.items.length) return json(res, 400, { error: 'Cannot checkout an empty cart!' });
    S.idem.add(idem);
    S.orders.filter(o => o.userId === key && o.status === 'PENDING_PAYMENT').forEach(o => { o.status = 'CANCELLED'; o.items.forEach(i => S.products.find(x => x.id === i.productId).stockQuantity += i.quantity); });
    for (const i of c.items) { const pr = S.products.find(x => x.id === i.productId); if (pr.stockQuantity < i.quantity) { S.idem.delete(idem); return json(res, 400, { error: 'Item ' + i.sku + ' is out of stock or insufficient quantity.' }); } }
    c.items.forEach(i => S.products.find(x => x.id === i.productId).stockQuantity -= i.quantity);
    const subtotal = round2(c.items.reduce((n, i) => n + i.price * i.quantity, 0));
    let disc = 0, code = null;
    if (body.couponCode && String(body.couponCode).toUpperCase() === 'FIRST10' && subtotal >= 1500) { disc = Math.round(subtotal * 0.1); code = 'FIRST10'; }
    const after = round2(subtotal - disc), ship = after >= 2000 ? 0 : 100, total = round2(after + ship);
    const o = { id: 'ord' + S.seq++, orderNumber: 'AMR-20261107-' + crypto.randomBytes(4).toString('hex').toUpperCase(), userId: key, customerEmail: key,
      items: c.items.map(i => Object.assign({}, i)), subtotal, discountAmount: disc, discountCode: code, shippingCost: ship, totalAmount: total,
      shippingAddress: a, status: 'PENDING_PAYMENT', razorpayOrderId: 'order_' + crypto.randomBytes(5).toString('hex'), createdAt: new Date().toISOString(),
      trackingTimeline: [{ status: 'PENDING_PAYMENT', description: 'Order created, waiting for payment.', timestamp: new Date().toISOString() }] };
    S.orders.push(o);
    return json(res, 200, { id: o.id, orderNumber: o.orderNumber, status: o.status, items: o.items, subtotal, discountAmount: disc, shippingCost: ship, totalAmount: total, shippingAddress: a,
      razorpayOrderId: o.razorpayOrderId, razorpayKeyId: 'rzp_test_mock', amountInPaise: Math.round(total * 100) });
  }
  if (p === '/api/orders/my-orders' && m === 'GET') return json(res, 200, S.orders.filter(o => o.userId === key));
  if ((mm = p.match(/^\/api\/orders\/([^/]+)\/invoice$/))) {
    const o = S.orders.find(x => x.id === mm[1] && x.userId === key); if (!o) return json(res, 404, {});
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/pdf' }, cors)); return res.end(Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
  }
  if (p === '/api/returns' && m === 'POST') {
    const o = S.orders.find(x => x.orderNumber === body.orderNumber && x.userId === key);
    if (!o) return json(res, 500, { error: 'Request could not be processed.' });
    if (o.status !== 'DELIVERED') return json(res, 409, { error: 'Only delivered orders can be returned.' });
    const r = { returnNumber: 'RET-' + crypto.randomBytes(3).toString('hex').toUpperCase(), ...body, status: 'REQUESTED' }; S.returns.push(r); return json(res, 200, r);
  }
  if (p === '/api/feedback/reviews' && m === 'POST') { const r = Object.assign({ id: 'r' + S.seq++, userName: user.name || 'Customer', createdAt: new Date().toISOString() }, body); S.reviews.push(r); return json(res, 200, r); }
  return json(res, 404, { timestamp: new Date().toISOString(), status: 404, error: 'Not Found', path: p });
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg' };
const web = http.createServer((req, res) => {
  let f = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (f === '/') f = '/index.html';
  const fp = path.join(SITE_DIR, f);
  if (!fp.startsWith(SITE_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
});
api.listen(API_PORT); web.listen(WEB_PORT);
console.log('mock api :' + API_PORT + '  site :' + WEB_PORT);
