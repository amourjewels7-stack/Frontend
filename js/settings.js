/* ============================================================
   AMOUR JEWELS — Settings page (settings.html)
   ------------------------------------------------------------
   Everything shown here is real:
     Account       who is signed in (from the sign-in), sign out
     Addresses     delivery addresses saved in this browser (the first one pre-fills checkout)
     Orders        live order count (GET /api/orders/my-orders) + quick links
     Preferences   display currency (js/currency.js)
     Notifications offers & cart reminders  GET / PUT /api/account/marketing
     Privacy       clear this device, delete the account  DELETE /api/account/customer
   Not shown because the backend has no endpoint for it: changing your name,
   a list of other devices, "sign out everywhere".
   Needs js/api.js, products.js, store-config.js, currency.js, main.js (loaded before this file).
   ============================================================ */
'use strict';

const ST_ICON = {
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  pin: '<path d="M12 21s-6-5.1-6-9.6A6 6 0 0 1 18 11.4C18 15.9 12 21 12 21z"/><circle cx="12" cy="11" r="2.4"/>',
  orders: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 10h6M9 14h6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>'
};
const stIcon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ST_ICON[n] || ''}</svg>`;
const stRow = (title, desc, ctl) =>
  `<div class="st-row"><div class="st-label"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="st-ctl">${ctl || ''}</div></div>`;
const stVal = (v, fallback) => v ? `<div class="st-val">${esc(v)}</div>` : `<div class="st-val muted">${esc(fallback || 'Not set')}</div>`;
const stDate = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'; };
const $id = id => document.getElementById(id);

/* "Chrome (Windows)" from the browser's own description */
function stDevice() {
  const ua = navigator.userAgent;
  let b = 'Browser';
  if (/Edg\//.test(ua)) b = 'Edge'; else if (/OPR\/|Opera/.test(ua)) b = 'Opera'; else if (/SamsungBrowser/.test(ua)) b = 'Samsung Internet';
  else if (/Firefox\//.test(ua)) b = 'Firefox'; else if (/Chrome\//.test(ua)) b = 'Chrome'; else if (/Safari\//.test(ua)) b = 'Safari';
  let os = '';
  if (/Android/.test(ua)) os = 'Android'; else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'; else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'; else if (/CrOS/.test(ua)) os = 'ChromeOS'; else if (/Linux/.test(ua)) os = 'Linux';
  return b + (os ? ' (' + os + ')' : '');
}

/* ============================================================
   SECTIONS
   ============================================================ */
const ST_SECTIONS = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'addresses', label: 'Addresses', icon: 'pin' },
  { id: 'orders', label: 'Orders & help', icon: 'orders' },
  { sep: true },
  { id: 'preferences', label: 'Preferences', icon: 'sliders' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'privacy', label: 'Privacy & data', icon: 'shield' }
];

function stAccountHTML(me) {
  const method = me.provider === 'google' ? 'Google' : (me.type === 'phone' ? 'Mobile number (OTP)' : 'Email & password');
  /* initials: from the name; else the letters of the e-mail name; else the last 2 digits of the phone */
  const initials = me.name ? me.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (me.email ? me.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() : String(me.phone || 'AM').slice(-2));
  const photo = me.picture ? `<img src="${esc(me.picture)}" alt="" referrerpolicy="no-referrer">` : esc(initials);
  return `
    ${stRow('Profile photo', me.picture ? 'From your Google account.' : 'Shown as your initials.', `<span class="st-ava">${photo}</span>`)}
    ${stRow('Full name', 'To change it, <a href="contact.html" style="text-decoration:underline">message us</a>.', stVal(me.name, 'Not set'))}
    ${stRow('Email', '', stVal(me.email, 'Not added'))}
    ${stRow('Mobile number', '', stVal(me.phone ? '+91 ' + me.phone.replace(/(\d{5})(\d{5})/, '$1 $2') : '', 'Not added'))}
    ${stRow('Sign-in method', '', stVal(method))}
    <div class="st-group"><h2>Where you’re logged in</h2><button class="st-btn" type="button" id="stSignOut">Sign out of this device</button></div>
    <div class="st-table">
      <div class="th"><span>Device</span><span>Signed in</span><span>Last active</span></div>
      <div class="tr"><span>${esc(stDevice())} <i class="st-chip cur">Current</i></span><span>${stDate(me.since)}</span><span>Just now</span></div>
    </div>
    <p class="st-note">Your session ends on its own if you don’t visit for 7 days. If you use a shared device, sign out when you’re done.</p>`;
}

function stAddressesHTML() {
  return `<div id="stAddrBox"></div>`;
}
function stDrawAddresses(showForm) {
  const box = $id('stAddrBox');
  if (!box) return;
  let list = getAddresses();
  if (!list.length) {                                   /* import the address saved during checkout, once */
    try { const one = JSON.parse(localStorage.getItem('amour_address_v1')); if (one && one.name) { list = [one]; saveAddresses(list); } } catch (e) {}
  }
  const cards = list.map((a, i) => `
    <div class="st-addr">
      <b>${esc(a.name)} ${i === 0 ? '<i class="st-chip ok">Default</i>' : ''}</b>
      <p>${esc(a.address)}<br>${esc(a.city)}, ${esc(a.state)} — ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}</p>
      <div class="st-acts">${i === 0 ? '' : `<button type="button" data-addr-default="${i}">Make default</button>`}<button type="button" class="del" data-addr-del="${i}">Remove</button></div>
    </div>`).join('');
  const f = (id, label, ph, extra) => `<div ${extra && extra.full ? 'class="full"' : ''}><label for="${id}">${label}</label><input id="${id}" placeholder="${ph}" ${extra && extra.attrs ? extra.attrs : ''}></div>`;
  box.innerHTML = `
    ${list.length ? `<div class="st-addrs">${cards}</div>` : `<p class="st-empty">You have no saved addresses yet.</p>`}
    <div class="st-ctl" style="justify-content:flex-start;margin:6px 0 4px"><button class="st-btn ${showForm ? '' : 'dark'}" type="button" id="stAddrToggle">${showForm ? 'Close form' : '+ Add a new address'}</button></div>
    ${showForm ? `
    <form class="st-form" id="stAddrForm" novalidate>
      ${f('stfName', 'Full name', 'Ananya Sharma')}
      ${f('stfPhone', 'Mobile number', '98765 43210', { attrs: 'type="tel" maxlength="10" inputmode="numeric"' })}
      ${f('stfAddr', 'Address (house, street, area)', 'Flat 402, Rose Residency, MG Road', { full: true })}
      ${f('stfPin', 'Pincode', '110001', { attrs: 'type="tel" maxlength="6" inputmode="numeric"' })}
      ${f('stfCity', 'City', 'Your city')}
      ${f('stfState', 'State', 'Your state', { full: true })}
      <p class="st-msg full" id="stAddrMsg" role="alert"></p>
      <div class="full"><button class="st-btn dark" type="submit">Save address</button></div>
    </form>` : ''}
    <p class="st-note">Saved in this browser. The default address fills in at checkout.</p>`;
  if (showForm) setTimeout(() => { const i = $id('stfName'); i && i.focus(); }, 30);
}
async function stSaveAddress() {
  const v = id => ($id(id).value || '').trim();
  const a = { name: v('stfName'), phone: v('stfPhone').replace(/\D/g, ''), address: v('stfAddr'), pincode: v('stfPin'), city: v('stfCity'), state: v('stfState'), at: new Date().toISOString() };
  const bad = [];
  if (a.name.length < 2) bad.push('stfName');
  if (!/^[6-9]\d{9}$/.test(a.phone)) bad.push('stfPhone');
  if (a.address.length < 5) bad.push('stfAddr');
  if (!/^\d{6}$/.test(a.pincode)) bad.push('stfPin');
  if (a.city.length < 2) bad.push('stfCity');
  if (a.state.length < 2) bad.push('stfState');
  document.querySelectorAll('#stAddrForm input').forEach(i => i.classList.remove('err'));
  if (bad.length) { bad.forEach(id => $id(id).classList.add('err')); $id('stAddrMsg').textContent = 'Please fix the highlighted fields.'; return; }
  const list = getAddresses().filter(x => !(x.phone === a.phone && x.pincode === a.pincode && x.address === a.address));
  list.unshift(a);
  saveAddresses(list);
  stDrawAddresses(false);
  toast('Address saved — set as your default');
  const info = await pincodeInfo(a.pincode);              /* a heads-up only; saving is never blocked */
  if (info && info.serviceable === false) toast('Saved — note that we do not deliver to ' + a.pincode + ' yet');
}

function stOrdersHTML() {
  return `
    ${stRow('Your orders', '<span id="stOrdCount">Loading…</span>', '<a class="st-btn" href="orders.html">View orders</a>')}
    ${stRow('Track an order', 'Live courier status, returns and reviews.', '<a class="st-btn" href="track.html">Track</a>')}
    ${stRow('Returns & refunds', 'Returns can be requested from the tracking page within 7 days of delivery.', '<a class="st-btn" href="returns-exchange.html">Read the policy</a>')}
    ${stRow('Need help?', `${esc(STORE.email)} · ${esc(STORE.phone)}<br>${esc(STORE.hours)}`, '<a class="st-btn dark" href="contact.html">Contact us</a>')}`;
}

function stPreferencesHTML() {
  const list = (typeof CUR_LIST !== 'undefined') ? CUR_LIST : [];
  const cur = (typeof getCurrencyCode === 'function') ? getCurrencyCode() : 'INR';
  return stRow('Currency',
      'Prices are <b>shown</b> in this currency while you browse (indicative rates). You are always charged in Indian Rupees (₹) at checkout.',
      list.length ? `<select class="st-select" id="stCurrency" aria-label="Currency">${list.map(c => `<option value="${esc(c.code)}" ${c.code === cur ? 'selected' : ''}>${esc(c.code)} — ${esc(c.name)}</option>`).join('')}</select>` : stVal('INR — Indian Rupee'));
}

function stNotificationsHTML() {
  return `
    ${stRow('Order & delivery updates', 'Confirmation, dispatch and delivery messages for orders you place. These are essential, so they can’t be switched off.', '<span class="st-chip ok">Always on</span>')}
    ${stRow('Offers & cart reminders', '<span id="stMktDesc">Loading…</span>', '<button class="st-switch" type="button" role="switch" aria-checked="false" aria-label="Offers and cart reminders" id="stMkt" disabled></button>')}`;
}

function stPrivacyHTML() {
  return `
    ${stRow('Privacy policy & terms', 'How we handle your information.', '<a class="st-btn" href="privacy-terms.html">Read</a>')}
    ${stRow('Saved data on this device', 'Your saved addresses, currency choice and review history are kept in this browser.', '<button class="st-btn" type="button" id="stClear">Clear</button>')}
    ${stRow('Delete account', 'Permanently removes your account and saved bag. Past orders stay on record for tax purposes, with your name, phone and address removed.', '<button class="st-btn danger" type="button" id="stDelete">Delete account</button>')}`;
}

const ST_RENDER = { account: stAccountHTML, addresses: stAddressesHTML, orders: stOrdersHTML, preferences: stPreferencesHTML, notifications: stNotificationsHTML, privacy: stPrivacyHTML };

/* ============================================================
   BUILD + NAVIGATION + SEARCH
   ============================================================ */
let stActive = 'account';

function stBuild(me) {
  $id('stNav').innerHTML = ST_SECTIONS.map(s => s.sep ? '<div class="st-sep"></div>'
    : `<button type="button" data-sec="${s.id}" aria-current="false">${stIcon(s.icon)}<span>${s.label}</span></button>`).join('');
  $id('stBody').innerHTML = ST_SECTIONS.filter(s => !s.sep).map(s =>
    `<section class="st-sec" id="st-${s.id}" data-sec="${s.id}" aria-label="${s.label}"><h2 class="st-sec-title">${s.label}</h2>${ST_RENDER[s.id](me)}</section>`).join('') +
    '<p class="st-empty" id="stNoMatch" hidden>No settings match your search.</p>';
}

function stShow(id) {
  if (!ST_RENDER[id]) id = 'account';
  stActive = id;
  document.querySelectorAll('#stNav button').forEach(b => b.setAttribute('aria-current', b.dataset.sec === id ? 'true' : 'false'));
  document.querySelectorAll('.st-sec').forEach(s => s.classList.toggle('on', s.dataset.sec === id));
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
}

function stSearch(q) {
  q = q.trim().toLowerCase();
  const body = $id('stBody');
  body.classList.toggle('searching', !!q);
  let any = false;
  document.querySelectorAll('.st-sec').forEach(sec => {
    const titleHit = !!q && sec.getAttribute('aria-label').toLowerCase().includes(q);
    let hits = 0;
    sec.querySelectorAll('.st-row, .st-group, .st-table, .st-note, .st-addrs, .st-form').forEach(r => {
      const hit = !q || titleHit || r.textContent.toLowerCase().includes(q);
      r.classList.toggle('hide', !hit); if (hit) hits++;
    });
    sec.classList.toggle('nomatch', !!q && !hits);
    const nb = document.querySelector(`#stNav button[data-sec="${sec.dataset.sec}"]`);
    if (nb) nb.classList.toggle('dim', !!q && !hits);
    if (hits) any = true;
  });
  $id('stNoMatch').hidden = !q || any;
  if (!q) stShow(stActive);
}

/* ============================================================
   LIVE DATA: orders · marketing switch
   ============================================================ */
function stOrdersSummary() {
  const el = $id('stOrdCount');
  if (!el) return;
  const list = ordersForMe();
  const active = list.filter(o => ['Placed', 'Packed', 'Shipped', 'In Transit'].includes(o.status)).length;
  el.textContent = list.length ? `${list.length} order${list.length === 1 ? '' : 's'}${active ? ' · ' + active + ' on the way' : ''}` : 'No orders yet.';
}

async function stInitMarketing() {
  const sw = $id('stMkt'), desc = $id('stMktDesc');
  if (!sw || !desc) return;
  let on = false;
  const paint = p => {
    on = !!p.marketingConsent;
    if (!p.hasEmail) {
      desc.textContent = 'There’s no email address on this account, so we can’t send offers. Order updates reach you by SMS.';
      sw.disabled = true; sw.setAttribute('aria-checked', 'false');
      return;
    }
    desc.textContent = on ? 'You’re getting our occasional offers and reminders about items left in your bag.' : 'Off. You won’t get offers or bag reminders. You can switch this on any time.';
    sw.setAttribute('aria-checked', String(on)); sw.disabled = false;
  };
  try { paint(await AmourAPI.marketingPrefs()); }
  catch (e) { if (!(e && e.status === 401)) desc.textContent = 'We couldn’t load this setting right now. Please refresh in a moment.'; return; }
  sw.addEventListener('click', async () => {
    sw.disabled = true;
    try { paint(await AmourAPI.setMarketingPrefs(!on)); toast(on ? 'You’re subscribed to offers' : 'You’re unsubscribed from offers'); }
    catch (e) { if (!(e && e.status === 401)) toast(e.message || 'Could not update this setting.'); sw.disabled = false; }
  });
}

/* ============================================================
   DELETE ACCOUNT
   ============================================================ */
const ST_LOCAL_KEYS = ['amour_cart_v1', 'amour_addresses_v1', 'amour_address_v1', 'amour_account_v1', 'amour_reviewed_v1', 'amour_catalogue_v1'];

function stCloseModal() { const m = $id('stModal'); if (m) m.remove(); document.removeEventListener('keydown', stEsc); }
function stEsc(e) { if (e.key === 'Escape') stCloseModal(); }

/* orders that still need the delivery address: paid and not delivered / cancelled, or a checkout from the last 30 min */
function stOrdersInProgress(all) {
  return all.filter(o => {
    if (['DELIVERED', 'CANCELLED'].includes(o.rawStatus)) return false;
    if (o.rawStatus === 'PENDING_PAYMENT') return Date.now() - new Date(o.date).getTime() < 30 * 60 * 1000;
    return true;
  });
}

function stOpenDelete() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="st-modal-bg" id="stModal"><div class="st-modal" role="dialog" aria-modal="true" aria-labelledby="stDelTitle">
    <h3 id="stDelTitle">Delete your account?</h3>
    <p>This can’t be undone. We will:</p>
    <ul>
      <li>delete your account, sign-in and saved bag,</li>
      <li>remove your name, phone and address from your past orders (the orders themselves stay for tax records),</li>
      <li>sign you out everywhere on this device.</li>
    </ul>
    <div id="stDelCheck"><p class="st-msg note">Checking your orders…</p></div>
    <div id="stDelConfirm" hidden>
      <label for="stDelInput">Type DELETE to confirm</label>
      <input id="stDelInput" autocomplete="off" spellcheck="false" placeholder="DELETE">
    </div>
    <p class="st-msg" id="stDelErr" role="alert"></p>
    <div class="st-acts"><button class="st-btn" type="button" id="stDelCancel">Keep my account</button><button class="st-btn danger" type="button" id="stDelGo" disabled>Delete permanently</button></div>
  </div></div>`);
  document.addEventListener('keydown', stEsc);
  $id('stDelCancel').addEventListener('click', stCloseModal);
  $id('stModal').addEventListener('mousedown', e => { if (e.target.id === 'stModal') stCloseModal(); });

  /* always look at fresh order data before allowing this */
  loadMyOrders().then(all => {
    const busy = stOrdersInProgress(all);
    if (busy.length) {
      $id('stDelCheck').innerHTML = `<div class="st-alert"><b>You have ${busy.length} order${busy.length === 1 ? '' : 's'} in progress</b> (${busy.map(o => esc(o.id)).join(', ')}). We need your delivery details until ${busy.length === 1 ? 'it arrives' : 'they arrive'}. You can delete your account once ${busy.length === 1 ? 'it is' : 'they are'} delivered.</div>`;
      return;
    }
    $id('stDelCheck').innerHTML = '<p class="st-msg note">No orders in progress. If you have an open return request, wait until it is settled before deleting.</p>';
    $id('stDelConfirm').hidden = false;
    const input = $id('stDelInput'), go = $id('stDelGo');
    input.focus();
    input.addEventListener('input', () => { go.disabled = input.value.trim() !== 'DELETE'; });
    go.addEventListener('click', stDoDelete);
  }).catch(e => {
    if (e && e.status === 401) return;
    $id('stDelCheck').innerHTML = `<div class="st-alert">We couldn’t check your orders just now (${esc(e.message || 'network problem')}). Please try again in a moment.</div>`;
  });
}

async function stDoDelete() {
  const go = $id('stDelGo'); go.disabled = true; go.textContent = 'Deleting…';
  $id('stDelErr').textContent = '';
  try {
    await AmourAPI.deleteAccount();
  } catch (e) {
    if (e && e.status === 401) return;
    $id('stDelErr').textContent = e.message || 'We could not delete your account. Please try again.';
    go.disabled = false; go.textContent = 'Delete permanently';
    return;
  }
  try { await AmourAuth.logout(); } catch (e) {}           /* clears the session cookies */
  ST_LOCAL_KEYS.forEach(k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} });
  stCloseModal();
  document.querySelector('.st-card').innerHTML = `
    <div class="st-top" style="grid-column:1/-1"><h1>Account deleted</h1></div>
    <div style="grid-column:1/-1;padding:56px 28px 64px;text-align:center">
      <p style="font-size:16px;color:var(--espresso);margin-bottom:8px">Your account has been deleted.</p>
      <p class="st-empty" style="padding:0 0 24px">We’re sorry to see you go. You’re always welcome back.</p>
      <a class="st-btn dark" href="index.html">Back to the shop</a>
    </div>`;
  if (typeof syncBadges === 'function') syncBadges();
}

/* ============================================================
   EVENTS + BOOT
   ============================================================ */
function stWire() {
  $id('stNav').addEventListener('click', e => {
    const b = e.target.closest('button[data-sec]');
    if (!b) return;
    $id('stSearch').value = ''; stSearch('');
    stShow(b.dataset.sec);
    window.scrollTo({ top: Math.max(0, $id('stCard').offsetTop - 90), behavior: 'smooth' });
  });
  $id('stSearch').addEventListener('input', e => stSearch(e.target.value));
  $id('stClose').addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back(); else location.href = 'index.html';
  });
  const body = $id('stBody');
  body.addEventListener('click', async e => {
    if (e.target.closest('#stSignOut')) { await signOutEverywhere(); location.href = 'index.html'; return; }
    if (e.target.closest('#stAddrToggle')) { stDrawAddresses(!$id('stAddrForm')); return; }
    const del = e.target.closest('[data-addr-del]');
    if (del) { const l = getAddresses(); l.splice(+del.dataset.addrDel, 1); saveAddresses(l); stDrawAddresses(false); toast('Address removed'); return; }
    const def = e.target.closest('[data-addr-default]');
    if (def) { const l = getAddresses(); const [a] = l.splice(+def.dataset.addrDefault, 1); l.unshift(a); saveAddresses(l); stDrawAddresses(false); toast('Default address updated'); return; }
    if (e.target.closest('#stClear')) {
      if (!confirm('Clear saved addresses, currency choice and review history from this browser? You will stay signed in.')) return;
      ['amour_addresses_v1', 'amour_address_v1', 'amour_currency_v1', 'amour_reviewed_v1'].forEach(k => localStorage.removeItem(k));
      stDrawAddresses(false); toast('Cleared from this device'); return;
    }
    if (e.target.closest('#stDelete')) stOpenDelete();
  });
  body.addEventListener('submit', e => { if (e.target.id === 'stAddrForm') { e.preventDefault(); stSaveAddress(); } });
  body.addEventListener('change', e => { if (e.target.id === 'stCurrency') setCurrencyCode(e.target.value); });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (ST_RENDER[id] && !$id('stSearch').value) stShow(id); });
}

window.addEventListener('amour:signedout', () => location.replace('login.html?next=settings.html'));

amourReady(async () => {
  if (!$id('stCard')) return;
  if (!AmourAuth.require()) return;                        /* → login.html?next=settings.html */
  const me = AmourAuth.profile();
  stBuild(me);
  stWire();
  stDrawAddresses(false);
  stShow(location.hash.slice(1) || 'account');
  stInitMarketing();
  try { await loadMyOrders(); } catch (e) { if (e && e.status === 401) return; const el = $id('stOrdCount'); if (el) el.textContent = 'We couldn’t load your orders just now.'; return; }
  stOrdersSummary();
});
