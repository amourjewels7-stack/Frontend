/* ============================================================
   AMOUR JEWELS — Order tracking, returns & reviews
   ------------------------------------------------------------
   Look-up   signed in  → your own orders (GET /api/orders/my-orders)
             guest      → order number + checkout e-mail (GET /api/orders/track)
   Timeline  the real events the backend records as the order moves
   Returns   POST /api/returns   (signed in · delivered · within 7 days)
   Reviews   POST /api/feedback/reviews  (signed in · after delivery)
   Not offered because the backend has no endpoint for them: cancelling an
   order, exchanges. Those buttons open a WhatsApp chat with the team instead.
   ============================================================ */

const STAGES = [
  { key: 'Placed',     label: 'Order Placed',      note: 'Order confirmed. Payment verified.' },
  { key: 'Packed',     label: 'Packed at Atelier', note: 'Hand-finished, quality-checked and packed in the signature keepsake box.' },
  { key: 'Shipped',    label: 'Shipped',           note: 'Picked up by courier. Fully insured in transit.' },
  { key: 'In Transit', label: 'In Transit',        note: 'Moving through the courier network towards you.' },
  { key: 'Delivered',  label: 'Delivered',         note: 'Enjoy your sparkle! Returns can be requested for 7 days after delivery.' }
];
const RETURN_REASONS = [['DEFECTIVE', 'Damaged or defective'], ['WRONG_ITEM', 'Wrong item received'], ['NOT_AS_DESCRIBED', 'Not as described'], ['SIZE_ISSUE', 'Size issue'], ['CHANGED_MIND', 'Changed my mind'], ['OTHER', 'Other']];
const REVIEWED_KEY = 'amour_reviewed_v1';          /* order+product pairs already reviewed from this browser */

const stageIndex = s => Math.max(0, STAGES.findIndex(x => x.key === s));
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const safeHttps = u => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : '';
const reviewedSet = () => { try { return JSON.parse(localStorage.getItem(REVIEWED_KEY)) || []; } catch (e) { return []; } };

let trkOrder = null;

/* ---------- find an order ---------- */
async function trkLookup(number, email) {
  number = String(number || '').trim().toUpperCase();
  if (!number) throw new Error('Please enter your order number.');
  if (AmourAuth.isIn()) {
    try {
      const mine = (await loadMyOrders()).find(o => o.id.toUpperCase() === number);
      if (mine) return mine;
    } catch (e) { /* fall through to the public look-up */ }
  }
  if (!email) {
    throw new Error(AmourAuth.isIn()
      ? 'That order is not on your account. Enter the e-mail address used at checkout to look it up.'
      : 'Please enter the e-mail address used at checkout.');
  }
  try { return normalizeOrder(await AmourAPI.trackOrder(number, email.trim())); }
  catch (e) { throw e.status === 404 ? new Error('No order found for that number and e-mail. Please check both and try again.') : e; }
}

/* ---------- pieces of the page ---------- */
function waInline(text) {
  return `<a class="wa-inline" target="_blank" rel="noopener" href="https://wa.me/${STORE.whatsapp.number}?text=${encodeURIComponent(text)}">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.7-1.2 1.3-1.7 1.3-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.3.9-1.5c.2-.2.5-.2.7-.2h.5c.2 0 .4 0 .6.5.2.5.8 1.8.8 2 .1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.8 1.2 2.1 1.3.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.9.9.3.2.5.2.5.3.1.1.1.6-.1 1.3z"/></svg>
    Message us on WhatsApp</a>`;
}

function timelineHTML(order) {
  const idx = stageIndex(order.status);
  const terminal = order.status === 'Cancelled';
  return '<div class="tl">' + STAGES.map((s, i) => `
    <div class="tl-step ${i < idx ? 'done' : ''} ${i === idx && !terminal ? 'now' : ''}">
      <span class="tl-dot">${i < idx ? '✓' : (i + 1)}</span>
      <div class="tl-body"><b>${s.label}</b><p>${s.note}</p></div>
    </div>`).join('') + '</div>';
}

/* the backend's own event log — what really happened, with the time it happened */
function activityHTML(order) {
  const ev = (order.timeline || []).filter(t => t && t.status !== 'REFUND_REQUIRED').slice().reverse();
  if (!ev.length) return '';
  return `
    <div class="trk-items-head" style="border:0;padding:0;margin-top:18px">Tracking activity${order.awb ? ' — AWB ' + esc(order.awb) + (order.courier ? ' · ' + esc(order.courier) : '') : ''}</div>
    <div class="scan-list">${ev.map(t => `
      <div class="scan"><div class="scan-main"><b>${esc(t.description || t.status)}</b></div><span class="scan-date">${fmtDateTime(t.timestamp)}</span></div>`).join('')}</div>`;
}

function actionsHTML(order) {
  const early = ['Placed', 'Packed'].includes(order.status);
  const live = ['Shipped', 'In Transit'].includes(order.status);
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : null;
  const inWindow = order.status === 'Delivered' && (!deliveredAt || Date.now() - deliveredAt < 7 * 864e5);
  const link = safeHttps(order.trackingUrl);
  let html = '<div class="trk-actions">';
  if (live && link) html += `<a class="btn ghost" target="_blank" rel="noopener noreferrer" href="${esc(link)}">Track on ${esc(order.courier || 'courier site')} ↗</a>`;
  if (inWindow && AmourAuth.isIn()) html += '<button class="btn ghost" data-act="return">Request a Return</button>';
  if (order.paid && AmourAuth.isIn()) html += `<a class="btn ghost" href="invoice.html?order=${encodeURIComponent(order.id)}">GST Invoice</a>`;
  html += waInline('Hi Amour Jewels! Regarding order ' + order.id);
  html += '</div>';
  if (live) html += '<p class="sub-hint" style="margin-top:16px">Questions about your delivery? Message us with your order number and we will chase the courier for you.</p>';
  if (early) html += `<p class="sub-hint" style="margin-top:16px">Need to change or cancel before dispatch? Message us on WhatsApp with your order number — we will help right away.</p>`;
  if (order.status === 'Delivered' && !AmourAuth.isIn()) html += '<p class="sub-hint" style="margin-top:16px"><a href="login.html?next=' + encodeURIComponent('track.html?order=' + order.id) + '">Sign in</a> to request a return, download your invoice or leave a review.</p>';
  return html;
}

function reviewHTML(order) {
  if (order.status !== 'Delivered' || !AmourAuth.isIn()) return '';
  const done = reviewedSet();
  const todo = order.items.filter(i => i.pid && done.indexOf(order.id + '|' + i.pid) < 0);
  if (!todo.length) return `<div class="rv" id="rvSec"><div class="rv-thanks"><div><b style="font-weight:500">Thank you — your review has been submitted.</b></div></div></div>`;
  return `
    <div class="rv" id="rvSec">
      <h4>Review your purchase</h4>
      <p class="sub-hint">Your review helps other shoppers — and helps our karigars improve.</p>
      ${todo.length > 1 ? `<div class="rv-row"><select id="rvItem" style="width:100%;padding:12px;border:1px solid var(--line);background:var(--cream);border-radius:var(--r)">${todo.map(i => `<option value="${esc(i.pid)}">${esc(i.name)}</option>`).join('')}</select></div>` : `<input type="hidden" id="rvItem" value="${esc(todo[0].pid)}">`}
      <div class="rv-stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rv-star" data-star="${n}" aria-label="${n} star">★</button>`).join('')}</div>
      <div class="rv-row"><input id="rvTitle" type="text" maxlength="80" placeholder="Review title — e.g. “Exquisite craft”"></div>
      <textarea id="rvText" maxlength="900" placeholder="Tell us about the finish, sparkle, comfort…"></textarea>
      <div class="rv-foot">
        <button class="btn" type="button" id="rvSubmit">Submit Review</button>
        <p class="sub-hint">Your name is taken from your account.</p>
      </div>
    </div>`;
}

function renderOrder(order) {
  trkOrder = order;
  const items = order.items.map(i => `<div class="trk-item">
      <img src="${esc(i.img || '')}" alt="${esc(i.name)}" loading="lazy" onerror="this.style.display='none'">
      <div class="trk-item-info"><b>${esc(i.name)}</b><span>Qty ${i.qty}</span><span class="trk-item-status">${esc(order.status)}</span></div>
      <span class="trk-item-price">${money(i.price * i.qty)}</span>
    </div>`).join('');

  let shipHTML = '';
  if (order.status === 'Placed' || order.status === 'Packed') {
    shipHTML = `<div class="ship-state pre"><span class="ss-ico">📦</span><div><b>Not shipped yet</b>
      <span>${order.status === 'Placed' ? 'Payment verified — packing at the Amour atelier. Ships within 24–48 hrs.' : 'Packed in the signature keepsake box — courier pickup scheduled.'}</span></div></div>`;
  } else if (['Shipped', 'In Transit'].includes(order.status)) {
    shipHTML = `<div class="ship-state"><span class="ss-ico">🚚</span><div><b>${esc(order.status)}</b>
      <span>${order.awb ? 'AWB ' + esc(order.awb) : ''}${order.courier ? ' with ' + esc(order.courier) : ''}.</span></div></div>`;
  } else if (order.status === 'Delivered') {
    shipHTML = `<div class="ship-state done"><span class="ss-ico">✅</span><div><b>Product delivered</b>
      <span>${order.deliveredAt ? 'Delivered on ' + fmtDate(order.deliveredAt) + '. ' : ''}Returns can be requested for 7 days after delivery.</span></div></div>`;
  }
  const delivHTML = order.status === 'Delivered' ? `
    <div class="deliv-banner"><span class="ss-ico">🎉</span><b>Product delivered — we hope you love it!</b><a class="btn" href="shop.html">Shop More</a></div>
    ${reviewHTML(order)}` : '';

  $('#trkResult').innerHTML = `
  <div class="bento">
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div>
        <h3 style="margin-bottom:4px">Order ${esc(order.id)}</h3>
        <p class="sub-hint">Placed ${fmtDate(order.date)}</p>
      </div>
      <span class="badge-ver">${esc(order.status)}</span>
    </div>
    <div class="trk-meta">
      <div class="tm"><span>Courier</span><b>${esc(order.courier || '—')}</b></div>
      <div class="tm"><span>Tracking ID (AWB)</span><b>${esc(order.awb || '—')}</b></div>
      <div class="tm"><span>Shipping to</span><b>${order.addr.city ? esc(order.addr.city + ', ' + order.addr.state) : '—'}</b></div>
      <div class="tm"><span>Total</span><b>${money(order.total)}</b></div>
    </div>
    ${order.status === 'Cancelled' ? '<p class="sub-hint">This order was cancelled. If you paid, your refund will reach you in 3–5 working days — write to us if it has not.</p>'
      : shipHTML + activityHTML(order) + timelineHTML(order)}
    <div class="trk-items-head">Products in this order</div>
    <div class="trk-items">${items}</div>
    ${delivHTML}
    ${actionsHTML(order)}
    <div id="rtBox"></div>
  </div>`;

  const ret = $('#trkResult [data-act="return"]');
  ret && ret.addEventListener('click', () => returnForm(order));
  wireReview(order);
}

/* ---------- reviews ---------- */
function wireReview(order) {
  const sec = $('#rvSec');
  const submit = $('#rvSubmit');
  if (!sec || !submit) return;
  const stars = $$('#rvSec .rv-star');
  stars.forEach(s => s.addEventListener('click', () => {
    const v = +s.dataset.star;
    stars.forEach(x => x.classList.toggle('on', +x.dataset.star <= v));
    sec.dataset.rating = v;
  }));
  submit.addEventListener('click', async () => {
    const rating = +sec.dataset.rating || 0;
    const title = $('#rvTitle').value.trim();
    const text = $('#rvText').value.trim();
    const pid = $('#rvItem').value;
    if (!rating) { toast('Please choose a star rating'); return; }
    if (text.length < 10) { toast('Review must be at least 10 characters'); return; }
    submit.disabled = true;
    try {
      await AmourAPI.addReview(pid, rating, (title ? title + ' — ' : '') + text);
      const done = reviewedSet(); done.push(order.id + '|' + pid);
      localStorage.setItem(REVIEWED_KEY, JSON.stringify(done));
      toast('Thank you — review submitted');
      renderOrder(order);
    } catch (e) { if (!e.status || e.status !== 401) toast(e.message || 'Could not submit your review'); submit.disabled = false; }
  });
}

/* ---------- returns ---------- */
function returnForm(order) {
  const box = $('#rtBox');
  box.innerHTML = `
    <div class="rv" style="margin-top:22px">
      <h4>Request a return</h4>
      <p class="sub-hint">Tell us what went wrong. Our team reviews every request and will e-mail you the next steps.</p>
      <div class="rv-row"><select id="rtItem" style="width:100%;padding:12px;border:1px solid var(--line);background:var(--cream);border-radius:var(--r)">
        ${order.items.filter(i => i.pid).map(i => `<option value="${esc(i.pid)}">${esc(i.name)}</option>`).join('')}</select></div>
      <div class="rv-row"><select id="rtReason" style="width:100%;padding:12px;border:1px solid var(--line);background:var(--cream);border-radius:var(--r)">
        ${RETURN_REASONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
      <textarea id="rtText" maxlength="900" placeholder="Describe the issue (optional)"></textarea>
      <div class="rv-foot"><button class="btn" type="button" id="rtSubmit">Submit request</button>
        <p class="sub-hint">For damage claims, please keep your unboxing video — our team may ask for it.</p></div>
    </div>`;
  $('#rtSubmit').addEventListener('click', async () => {
    const b = $('#rtSubmit'); b.disabled = true;
    try {
      const r = await AmourAPI.requestReturn({ orderNumber: order.id, productId: $('#rtItem').value, reason: $('#rtReason').value, description: $('#rtText').value.trim(), photoUrls: [] });
      box.innerHTML = `<div class="rv"><div class="rv-thanks"><div><b style="font-weight:500">Return request ${esc(r.returnNumber || '')} received.</b>
        <p class="sub-hint" style="margin-top:2px">We will review it and e-mail you the next steps.</p></div></div></div>`;
      toast('Return request received');
    } catch (e) { if (!e.status || e.status !== 401) toast(e.message || 'Could not submit your request'); b.disabled = false; }
  });
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- boot ---------- */
async function trkRun(number, email) {
  const out = $('#trkResult');
  out.innerHTML = '<p class="sub-hint">Looking up your order…</p>';
  try { renderOrder(await trkLookup(number, email)); }
  catch (e) { out.innerHTML = ''; if (!e.status || e.status !== 401) toast(e.message || 'Could not find that order'); }
}
amourReady(() => {
  const form = $('#trkForm');
  if (!form) return;
  const emailBox = $('#trkEmail');
  if (emailBox && AmourAuth.isIn()) { const me = AmourAuth.profile(); if (me && me.email) emailBox.value = me.email; }
  const pre = new URLSearchParams(window.location.search).get('order');
  if (pre) { $('#trkId').value = pre; trkRun(pre, emailBox ? emailBox.value : ''); }
  form.addEventListener('submit', e => { e.preventDefault(); trkRun($('#trkId').value, emailBox ? emailBox.value : ''); });
});
