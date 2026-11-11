/* ============================================================
   AMOUR JEWELS — Checkout (address → payment → success)
   ------------------------------------------------------------
   Real flow, all prices decided by the backend:
     1. Sign-in required (the bag is the account's server-side bag).
     2. "Pay" → POST /api/orders/checkout  { shippingAddress, couponCode }
        with a NEW Idempotency-Key for every attempt. The server re-reads the bag,
        reserves stock, prices everything and creates the Razorpay order.
     3. The Razorpay payment window opens with the order the server returned.
     4. Razorpay tells the BACKEND (webhook) that the money arrived — that is what
        marks the order paid. This page then polls GET /api/orders/my-orders until
        the order is no longer "awaiting payment", and only then shows success.
   An unpaid order holds its stock for 30 minutes; paying again simply replaces it.
   ============================================================ */

const ADDR_KEY = 'amour_address_v1';
const COUPON_SESSION_KEY = 'amour_coupon_active_v1';

const getAddr = () => { try { return JSON.parse(localStorage.getItem(ADDR_KEY)) || null; } catch (e) { return null; } };
const saveAddr = a => localStorage.setItem(ADDR_KEY, JSON.stringify(a));

const fieldOk = {
  name:    v => v.trim().length >= 2,
  phone:   v => /^[6-9]\d{9}$/.test(v.trim()),
  address: v => v.trim().length >= 5,
  pincode: v => /^\d{6}$/.test(v.trim()),
  city:    v => v.trim().length >= 2,
  state:   v => v.trim().length >= 2
};
const cxEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);

/* ---------- pincode serviceability (GET /api/pincode/{pin}) ---------- */
let pinRun = 0;
async function checkPincode() {
  const box = $('#cxShipBox');
  const pin = $('#cxPincode').value.trim();
  if (!/^\d{6}$/.test(pin)) { box.hidden = true; return null; }
  const run = ++pinRun;
  const info = await pincodeInfo(pin);
  if (run !== pinRun) return info;
  box.hidden = false;
  if (info && !info.serviceable) {
    box.className = 'ship-widget bad';
    box.innerHTML = `<b>✕ Not serviceable</b><p>Sorry — we don't ship to ${pin} yet. Write to <a href="mailto:${STORE.email}">${STORE.email}</a> and we'll try.</p>`;
  } else if (info && info.unknown) {
    box.className = 'ship-widget';
    box.innerHTML = `<b>Delivery check unavailable</b><p>We'll confirm delivery to ${pin} when you pay.</p>`;
  } else if (info) {
    box.className = 'ship-widget ok';
    box.innerHTML = `<b>✓ Serviceable${info.courier ? ' — ' + cxEsc(info.courier) : ''}</b><p>Estimated delivery <b>${cxEsc(info.eta)}</b> · Insured, fully tracked.</p>`;
  }
  return info;
}

/* ---------- coupons / gift cards (POST /api/checkout/validate-coupon) ---------- */
function activeCoupon() {
  try { return JSON.parse(sessionStorage.getItem(COUPON_SESSION_KEY)); } catch (e) { return null; }
}
function setActiveCoupon(c) { sessionStorage.setItem(COUPON_SESSION_KEY, JSON.stringify(c)); renderSummary(); renderCouponState(); }
function clearCoupon() { sessionStorage.removeItem(COUPON_SESSION_KEY); renderSummary(); renderCouponState(); }
async function applyCoupon() {
  const code = $('#cxCode').value.trim().toUpperCase();
  if (!code) return;
  const btn = $('#cxApply'); btn.disabled = true;
  try {
    const r = await AmourAPI.validateCoupon(code, cartSubtotal());
    if (!r || r.valid === false) { toast((r && r.message) || 'Invalid or expired code'); return; }
    setActiveCoupon({ code, discount: Math.round(+r.discountAmount || 0), type: r.type, label: r.type === 'GIFT_CARD' ? 'Gift card' : 'Coupon' });
    toast(code + ' applied');
  } catch (e) {
    if (!e.status || e.status !== 401) toast(e.message || 'Invalid or expired code');
  } finally { btn.disabled = false; }
}
function renderCouponState() {
  const c = activeCoupon();
  const row = $('#cxApplied');
  if (!c) { row.hidden = true; $('#cxCodeRow').hidden = false; return; }
  row.hidden = false; $('#cxCodeRow').hidden = true;
  row.innerHTML = `<span class="code-chip">✓ ${cxEsc(c.code)} — ${cxEsc(c.label)}</span><button type="button" id="cxRemoveCode">Remove</button>`;
  $('#cxRemoveCode').addEventListener('click', clearCoupon);
}

/* ---------- totals & summary (an estimate — the server's numbers win at payment) ---------- */
function totals() {
  const sub = cartSubtotal();
  const c = activeCoupon();
  const disc = c ? Math.min(c.discount || 0, sub) : 0;
  const ship = shippingFor(Math.max(0, sub - disc));
  return { sub, disc, ship, total: Math.max(0, sub - disc) + ship, coupon: c };
}

function renderSummary(exact) {
  const items = getCart();
  if (!items.length && !exact) return;
  const t = exact || totals();
  $('#cxLines').innerHTML = items.map(i => {
    const p = productById(i.id);
    if (!p) return '';
    return `<div class="sum-row"><span>${p.name}${i.size ? ' · Size ' + cxEsc(i.size) : ''} × ${i.qty}</span><span>${money(p.price * i.qty)}</span></div>`;
  }).join('');
  $('#cxSub').textContent = money(t.sub);
  $('#cxDisc').parentElement.hidden = !t.disc;
  $('#cxDisc').textContent = '— ' + money(t.disc);
  $('#cxShip').innerHTML = t.ship === 0 ? '<span class="free">FREE</span>' : money(t.ship);
  $('#cxGst').textContent = 'Prices include GST';
  $('#cxTotal').textContent = money(t.total);
  $('#cxPayNow').textContent = `Pay ${money(t.total)} Securely`;
}

function setStep(n) {
  $$('#cxStep1,#cxStep2,#cxStep3').forEach(el => el.hidden = true);
  $('#cxStep' + n).hidden = false;
  $$('.step-tab[data-step-tab]').forEach(t => t.classList.toggle('active', +t.dataset.stepTab <= n));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function validateAddress() {
  let firstBad = null;
  Object.keys(fieldOk).forEach(name => {
    const input = $('#cx' + name[0].toUpperCase() + name.slice(1));
    const wrap = input.closest('.field');
    const ok = fieldOk[name](input.value);
    wrap.classList.toggle('invalid', !ok);
    if (!ok && !firstBad) firstBad = input;
  });
  if (firstBad) { firstBad.focus(); toast('Please fix the highlighted fields'); return null; }
  const info = await pincodeInfo($('#cxPincode').value.trim());
  if (!info || !info.serviceable) { toast('Sorry — this pincode is not serviceable'); return null; }
  return {
    name: $('#cxName').value.trim(),
    phone: $('#cxPhone').value.trim(),
    address: $('#cxAddress').value.trim(),
    landmark: $('#cxLandmark').value.trim(),
    pincode: $('#cxPincode').value.trim(),
    city: $('#cxCity').value.trim(),
    state: $('#cxState').value.trim()
  };
}

function prefillAddress() {
  const me = getProfile() || {};
  const a = getAddr() || {};
  const merged = Object.assign({ name: me.name || '', phone: me.phone || '' }, a);
  Object.keys(merged).forEach(k => {
    const input = $('#cx' + k[0].toUpperCase() + k.slice(1));
    if (input && merged[k]) input.value = merged[k];
  });
}

function showShipTo(addr) {
  $('#cxShipTo').innerHTML = `${cxEsc(addr.name)}<br>${cxEsc(addr.address)}${addr.landmark ? ', ' + cxEsc(addr.landmark) : ''}<br>${cxEsc(addr.city)}, ${cxEsc(addr.state)} — ${cxEsc(addr.pincode)}<br>${cxEsc(addr.phone)}`;
}

/* the form's address → the backend's Address */
function toBackendAddress(a) {
  const parts = a.name.trim().split(/\s+/);
  return {
    firstName: parts.shift(), lastName: parts.join(' '),
    addressLine1: a.address, addressLine2: a.landmark || '',
    city: a.city, state: a.state, zipCode: a.pincode, phone: a.phone
  };
}

/* ---------- Razorpay ---------- */
let rzpLoading = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (rzpLoading) return rzpLoading;
  rzpLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { rzpLoading = null; reject(new Error('Could not load the secure payment window. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return rzpLoading;
}

function payError(msg) {
  const b = $('#cxPayErr');
  if (b) { b.textContent = msg || ''; b.hidden = !msg; }
  if (msg) toast(msg);
}
function resetPayButton() {
  const btn = $('#cxPayNow');
  btn.disabled = false;
  renderSummary();
}

/* after Razorpay reports success: wait for the backend to confirm the payment */
async function awaitConfirmation(order, addr) {
  setStep(3);
  $('#cxSuccessName').textContent = (addr.name || 'friend').split(' ')[0];
  $('#cxOrderId').textContent = `Order ${order.orderNumber} · confirming your payment…`;
  $('#cxTrackBtn').href = 'track.html?order=' + encodeURIComponent(order.orderNumber);
  $('#cxInvoiceBtn').href = 'invoice.html?order=' + encodeURIComponent(order.orderNumber);
  $('#cxWaBtn').href = 'https://wa.me/' + STORE.whatsapp.number + '?text=' + encodeURIComponent('Hi Amour Jewels! Order ' + order.orderNumber + ' — please share updates.');

  const deadline = Date.now() + 90 * 1000;
  let confirmed = null;
  while (Date.now() < deadline) {
    try {
      const mine = (await AmourAPI.myOrders()).find(o => o.orderNumber === order.orderNumber);
      if (mine && mine.status !== 'PENDING_PAYMENT') { confirmed = mine; break; }
    } catch (e) { if (e && e.status === 401) break; }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (confirmed && confirmed.status !== 'CANCELLED') {
    localStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(COUPON_SESSION_KEY);
    syncBadges(); renderDrawer();
    cartPull();
    $('#cxOrderId').textContent = `Order ${order.orderNumber} · paid · ${money(confirmed.totalAmount)}`;
    trackEvent('Purchase', { value: confirmed.totalAmount, currency: 'INR', transaction_id: order.orderNumber });
    toast('Payment successful — order placed ♥');
  } else if (confirmed) {
    $('#cxOrderId').textContent = `Order ${order.orderNumber} · we need to refund your payment`;
    $('#cxSuccessName').parentElement.innerHTML = `We received your payment, but this order had expired and the items are no longer available. We will refund you — please <a href="contact.html">contact us</a> with order number ${cxEsc(order.orderNumber)}.`;
  } else {
    $('#cxOrderId').textContent = `Order ${order.orderNumber} · payment received, confirmation pending`;
    toast('Payment received — confirmation is taking a little longer');
    const note = document.createElement('p');
    note.className = 'sub-hint';
    note.innerHTML = 'Your bank has confirmed the payment and our system is catching up. Check <a href="orders.html">Your Orders</a> in a minute. If you were charged and see no order, <a href="contact.html">contact us</a> with this order number.';
    $('#cxOrderId').after(note);
  }
}

async function startPayment() {
  const btn = $('#cxPayNow');
  const addr = getAddr();
  if (!addr) { setStep(1); return; }
  btn.disabled = true; btn.textContent = 'Preparing your order…';
  payError('');
  try {
    await cartQueue;                                         /* let any pending bag change reach the server */
    await cartPull();
    if (!getCart().length) { toast('Your bag is empty'); location.href = 'cart.html'; return; }
    const coupon = activeCoupon();
    const order = await AmourAPI.checkout(toBackendAddress(addr), coupon && coupon.code, uuid());
    renderSummary({ sub: order.subtotal, disc: order.discountAmount, ship: order.shippingCost, total: order.totalAmount });
    if (coupon && !order.discountAmount) { sessionStorage.removeItem(COUPON_SESSION_KEY); renderCouponState(); toast('The code could not be applied to this order'); }
    await loadRazorpay();
    const me = getProfile() || {};
    const rzp = new Razorpay({
      key: order.razorpayKeyId,
      amount: order.amountInPaise,
      currency: 'INR',
      name: STORE.brand,
      description: 'Order ' + order.orderNumber,
      order_id: order.razorpayOrderId,
      prefill: { name: addr.name, email: me.email || '', contact: addr.phone },
      notes: { order_number: order.orderNumber },
      theme: { color: '#0e2a3d' },
      handler: () => { awaitConfirmation(order, addr); },
      modal: { ondismiss: () => { resetPayButton(); toast('Payment window closed — your bag is still here'); } }
    });
    rzp.on('payment.failed', r => {
      const d = r && r.error && r.error.description;
      payError(d ? 'Payment failed: ' + d : 'Payment failed. Please try again.');
    });
    btn.textContent = 'Waiting for payment…';
    rzp.open();
  } catch (e) {
    if (e && e.status === 401) return;                       /* signed out → api.js already redirects via event */
    if (e && e.status === 409) { payError('Your order is already being processed. Please wait a moment, then check Your Orders.'); }
    else payError(e.message || 'Could not start payment. Please try again.');
    await cartPull(); renderSummary();
    resetPayButton();
  }
}

window.addEventListener('amour:signedout', () => {
  if ($('#cxAddressForm')) location.replace('login.html?next=checkout.html');
});

amourReady(async () => {
  if (!$('#cxAddressForm')) return;
  if (!AmourAuth.require()) return;                          /* → login.html?next=checkout.html */

  if (CATALOGUE_ERROR) {
    $('.checkout-grid').innerHTML = `<div class="bento success-wrap" style="grid-column:1/-1"><h2>We couldn’t load checkout</h2><p>Please check your connection and <a href="checkout.html">try again</a>.</p></div>`;
    return;
  }
  await cartMerge();                                         /* guest bag joins the account, then we show the server's truth */

  /* empty bag guard */
  if (!getCart().length) {
    $('.checkout-grid').innerHTML = `
      <div class="bento success-wrap" style="grid-column:1/-1">
        <svg class="success-ring" viewBox="0 0 24 24" fill="none" stroke-width="1.2" style="stroke:var(--stone)"><path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 8z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>
        <h2>Your bag is empty</h2>
        <p>Add something sparkly before checking out.</p>
        <a class="btn" href="shop.html">Shop the Collections</a>
      </div>`;
    return;
  }

  prefillAddress();
  renderCouponState();
  renderSummary();
  const errBox = document.createElement('p');
  errBox.id = 'cxPayErr'; errBox.className = 'auth-err'; errBox.hidden = true; errBox.setAttribute('role', 'alert');
  errBox.style.cssText = 'color:var(--fail);font-size:13.5px;margin-top:12px';
  $('#cxPayNow').parentElement.after(errBox);

  $('#cxPincode').addEventListener('input', () => {
    $('#cxPincode').value = $('#cxPincode').value.replace(/\D/g, '').slice(0, 6);
    if ($('#cxPincode').value.length === 6) checkPincode();
  });
  $('#cxApply').addEventListener('click', applyCoupon);
  $('#cxCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });

  /* step 1 → 2 */
  $('#cxAddressForm').addEventListener('submit', async e => {
    e.preventDefault();
    const addr = await validateAddress();
    if (!addr) return;
    saveAddr(addr);
    showShipTo(addr);
    toast('Address saved — review & pay');
    loadRazorpay().catch(() => {});                          /* warm up the payment window */
    setStep(2);
  });

  /* step 2 → payment */
  $('#cxPayForm').addEventListener('submit', e => { e.preventDefault(); startPayment(); });
  $('#cxBackToAddress').addEventListener('click', () => setStep(1));

  const saved = getAddr();
  if (saved) showShipTo(saved);
  if (saved && saved.pincode) { $('#cxPincode').value = saved.pincode; checkPincode(); }
});
