/* ============================================================
   AMOUR JEWELS — Your Orders (orders.html)
   Signed-in page: order status · buy again · address chooser ·
   related picks.
     orders    -> GET /api/orders/my-orders (loadMyOrders in main.js)
     addresses -> saved in this browser (amour_addresses_v1); the
                  first address is the checkout default
   ============================================================ */

const ORD_STEPS = ['Placed', 'Packed', 'Shipped', 'Delivered'];

/* status -> stepper index (Cancelled/Return hide the stepper) */
function ordStepIndex(status) {
  if (status === 'Delivered') return 3;
  if (['Shipped', 'In Transit', 'Out for Delivery'].includes(status)) return 2;
  if (status === 'Packed') return 1;
  return 0;                                   /* Placed / anything new */
}
function ordChipCls(status) {
  return status === 'Delivered' ? 'ok'
    : status === 'Cancelled' ? 'bad'
    : /Transit|Delivery/i.test(status) ? 'warn' : 'placed';
}
const ordTotal = o => (o.total != null ? o.total : (o.sub || 0) + (o.ship || 0));

/* one order: id/date + status chip + 4-step progress + linked items */
function orderCardHTML(o) {
  const d = new Date(o.date);
  const dest = (o.addr && o.addr.city) || (o.customer && o.customer.city) || '';
  const awb = (o.awb && o.awb !== '—') ? ' · AWB ' + o.awb : '';
  const items = (o.items || []).map(it => {
    const p = productById(it.id);
    const inner = `<img src="${esc((p && p.img) || it.img || '')}" alt="${esc(it.name)}" loading="lazy"><span class="oi-n">${esc(it.name)} <i>×${it.qty}</i></span>`;
    /* every product line links straight to its product details page */
    return p
      ? `<a class="ord-item" href="product.html?id=${p.id}">${inner}</a>`
      : `<span class="ord-item">${inner}</span>`;
  }).join('');
  const halted = o.status === 'Cancelled' || o.status === 'Return Requested';
  const idx = ordStepIndex(o.status);
  const steps = ORD_STEPS.map((s, i) =>
    `<span class="o-step ${halted ? '' : i < idx ? 'done' : i === idx ? 'now' : ''}">${s}</span>`).join('');
  return `
  <article class="ord-card">
    <div class="ord-top">
      <div class="ord-id">
        <b>#${esc(o.id)}</b>
        <span>${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${dest ? ' · ' + dest : ''}${esc(awb)}</span>
      </div>
      <span class="acct-chip ${ordChipCls(o.status)}">${esc(o.status)}</span>
    </div>
    ${halted ? '' : `<div class="ord-steps">${steps}</div>`}
    <div class="ord-items">${items}</div>
    <div class="ord-foot">
      <b>${money(ordTotal(o))}</b>
      <div class="ord-acts">
        <a href="track.html?order=${encodeURIComponent(o.id)}">Track</a>
        <a href="invoice.html?order=${encodeURIComponent(o.id)}">Invoice</a>
        <a href="contact.html">Help</a>
      </div>
    </div>
  </article>`;
}

/* ---------- section 1: order status ---------- */
function renderOrders() {
  const box = document.getElementById('ordList');
  if (!box) return;
  const list = ordersForMe();
  const me = getProfile();
  const lede = document.getElementById('ordLede');
  if (lede && me) {
    lede.textContent = `Signed in as ${me.type === 'phone' ? '+91 ' : ''}${me.contact} — ${list.length} order${list.length === 1 ? '' : 's'} on this account.`;
  }
  box.innerHTML = list.length
    ? list.map(orderCardHTML).join('')
    : '<div class="ord-empty"><p>No orders yet — your first piece is one tap away.</p><a class="btn" href="shop.html">Start shopping</a></div>';
}

/* ---------- section 2: buy again (unique ordered products) ---------- */
function boughtIds() {
  const ids = [];
  ordersForMe().forEach(o => (o.items || []).forEach(it => {
    if (productById(it.id) && ids.indexOf(it.id) === -1) ids.push(it.id);
  }));
  return ids;
}
function renderBuyAgain() {
  const grid = document.getElementById('buyGrid');
  if (!grid) return;
  const ps = boughtIds().map(productById).slice(0, 8);
  grid.innerHTML = ps.length
    ? ps.map(cardHTML).join('')      /* cardHTML links to product.html?id= — full details page */
    : '<div class="ord-empty"><p>Nothing to reorder yet — your first order will show up here.</p><a class="btn" href="shop.html">Browse the atelier</a></div>';
}

/* ---------- section 4: related to what you own ---------- */
function renderRelated() {
  const grid = document.getElementById('relGrid');
  if (!grid) return;
  const bought = boughtIds();
  const cats = new Set();
  bought.forEach(id => (productById(id).cat || []).forEach(c => cats.add(c)));
  /* same category as an ordered piece, excluding what they already own */
  let rel = PRODUCTS.filter(p => bought.indexOf(p.id) === -1 && (p.cat || []).some(c => cats.has(c)));
  if (rel.length < 4) {                       /* nothing categories match — fill with popular picks */
    rel = rel.concat(PRODUCTS.filter(p => bought.indexOf(p.id) === -1 && rel.indexOf(p) === -1));
  }
  grid.innerHTML = rel.slice(0, 8).map(cardHTML).join('');
}

/* ---------- section 3: address chooser ---------- */
function renderAddresses() {
  const grid = document.getElementById('addrGrid');
  if (!grid) return;
  const list = getAddresses();
  grid.innerHTML = list.length
    ? list.map((a, i) => `
    <div class="addr-card${i === 0 ? ' active' : ''}">
      <div class="addr-head"><b>${esc(a.name)}</b>${i === 0 ? '<span class="def">Default</span>' : ''}</div>
      <p>${esc(a.address)}<br>${esc(a.city)}, ${esc(a.state)} — ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}</p>
      <div class="addr-acts">
        ${i === 0 ? '<span class="addr-used">Delivering here</span>'
          : `<button type="button" data-addr-pick="${i}">Deliver here</button>`}
        <button type="button" data-addr-del="${i}">Remove</button>
      </div>
    </div>`).join('')
    : '<div class="ord-empty"><p>No saved addresses yet — add one below and it will be ready at checkout.</p></div>';
}
function ordPickAddress(i) {
  const list = getAddresses();
  if (!list[i]) return false;
  const picked = list.splice(i, 1)[0];
  list.unshift(picked);                      /* first address = the checkout default */
  saveAddresses(list);
  renderAddresses();
  toast('Default delivery address updated');
  return true;
}
function ordRemoveAddress(i) {
  const list = getAddresses();
  if (!list[i]) return false;
  list.splice(i, 1);
  saveAddresses(list);
  renderAddresses();
  toast('Address removed');
  return true;
}
function ordField(id, ok) {
  const el = document.getElementById(id);
  const grp = el && el.closest ? el.closest('.f-group') : null;
  if (grp && grp.classList) grp.classList.toggle('invalid', !ok);
  return ok;
}
function ordAddAddress() {
  const v = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const name = v('adName'), phone = v('adPhone').replace(/\D/g, ''), addr = v('adAddr'),
        pin = v('adPin').replace(/\D/g, ''), city = v('adCity'), state = v('adState');
  let ok = true;
  ok = ordField('adName', name.length > 1) && ok;
  ok = ordField('adPhone', /^[6-9]\d{9}$/.test(phone)) && ok;
  ok = ordField('adAddr', addr.length > 5) && ok;
  ok = ordField('adPin', /^\d{6}$/.test(pin)) && ok;
  ok = ordField('adCity', city.length > 1) && ok;
  ok = ordField('adState', state.length > 1) && ok;
  if (!ok) return false;
  const list = getAddresses();
  list.push({ name, phone, address: addr, pincode: pin, city, state });
  saveAddresses(list);
  renderAddresses();
  toast('Address saved');
  return true;
}

/* ---------- boot — signed-in only ---------- */
function ordDrawAll() {
  renderOrders();
  renderBuyAgain();
  renderAddresses();
  renderRelated();
}
window.addEventListener('amour:signedout', () => location.replace('login.html?next=orders.html'));

amourReady(async () => {
  if (!AmourAuth.require()) return;          /* not signed in -> sign-in page, back here after */
  const box = document.getElementById('ordList');
  if (box) box.innerHTML = '<div class="ord-empty"><p>Loading your orders…</p></div>';
  renderAddresses();
  try {
    await loadMyOrders();
    ordDrawAll();
  } catch (e) {
    if (e && e.status === 401) return;
    if (box) box.innerHTML = `<div class="ord-empty"><p>${esc(e.message || 'We could not load your orders.')}</p><a class="btn" href="orders.html">Try again</a></div>`;
    renderRelated();
  }

  const grid = document.getElementById('addrGrid');
  grid && grid.addEventListener('click', e => {
    const pick = e.target.closest('[data-addr-pick]');
    if (pick) { ordPickAddress(+pick.dataset.addrPick); return; }
    const del = e.target.closest('[data-addr-del]');
    if (del) ordRemoveAddress(+del.dataset.addrDel);
  });

  const form = document.getElementById('addrNew');
  const toggle = document.getElementById('addrToggle');
  const clearForm = () => {
    ['adName', 'adPhone', 'adAddr', 'adPin', 'adCity', 'adState'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
      ordField(id, true);
    });
  };
  toggle && toggle.addEventListener('click', () => {
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) { const first = document.getElementById('adName'); first && first.focus(); }
  });
  document.getElementById('addrCancel') && document.getElementById('addrCancel').addEventListener('click', () => {
    if (form) form.hidden = true;
    clearForm();
  });
  form && form.addEventListener('submit', e => {
    e.preventDefault();
    if (ordAddAddress()) { form.hidden = true; clearForm(); }
  });
});

