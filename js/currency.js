/* ============================================================
   AMOUR JEWELS — Floating currency switcher (display only)
   ------------------------------------------------------------
   A small pill button (bottom-left) that opens a panel of
   currencies with flags — prices across the storefront are
   re-formatted from the base INR amount by fmtMoney().

   · Base currency is INR — every price in the catalogue, cart
     and checkout is stored/charged in INR; conversion here is
     a DISPLAY concern only (analytics + JSON-LD still report INR).
   · Rates are static indicative demo rates (units per ₹1).
     Swap CURRENCIES[].rate for a live FX feed in production.
   · admin.html (console) and invoice.html (GST tax invoice)
     are force-INR and never show the widget.
   · Switching saves to localStorage and reloads the page so
     every rendered price (grids, PDP, cart, drawer, announce
     bar) repaints consistently in the new currency.
   ============================================================ */

const CUR_KEY = 'amour_currency_v1';

const CUR_LIST = [
  { code: 'INR', name: 'Indian Rupee',      flag: 'in', rate: 1,      sym: '₹',    locale: 'en-IN', dec: 0 },
  { code: 'USD', name: 'US Dollar',         flag: 'us', rate: 0.0114, sym: '$',    locale: 'en-US', dec: 2 },
  { code: 'AED', name: 'UAE Dirham',        flag: 'ae', rate: 0.042,  sym: 'AED ', locale: 'en-AE', dec: 2 },
  { code: 'EUR', name: 'Euro',              flag: 'eu', rate: 0.0098, sym: '€',    locale: 'de-DE', dec: 2 },
  { code: 'AUD', name: 'Australian Dollar', flag: 'au', rate: 0.0174, sym: 'A$',   locale: 'en-AU', dec: 2 },
  { code: 'GBP', name: 'British Pound',     flag: 'gb', rate: 0.0085, sym: '£',    locale: 'en-GB', dec: 2 }
];

/* ISO flag image (flagcdn) — Windows renders emoji flags as letter
   pairs, so real flag art is used to match the design. */
const curFlagURL = iso => 'https://flagcdn.com/w80/' + iso + '.png';

/* GST invoice + admin console must always bill/report in INR */
const CUR_FORCE_INR = /(^|\/)(admin|invoice)\.html?$/i.test(location.pathname);

function curFind(code) {
  return CUR_LIST.find(c => c.code === code) || CUR_LIST[0];
}

function getCurrencyCode() {
  if (CUR_FORCE_INR) return 'INR';
  let code = 'INR';
  try { code = localStorage.getItem(CUR_KEY) || 'INR'; } catch (e) { code = 'INR'; }
  return CUR_LIST.some(c => c.code === code) ? code : 'INR';
}

/* every amount that reaches here is a base (INR) figure */
function fmtMoney(inr) {
  const c = curFind(getCurrencyCode());
  const n = Number(inr) || 0;
  if (c.code === 'INR') return '₹' + Math.round(n).toLocaleString('en-IN'); /* byte-identical to the original formatter */
  const v = n * c.rate;
  return c.sym + v.toLocaleString(c.locale, { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec });
}

function setCurrencyCode(code) {
  if (!CUR_LIST.some(c => c.code === code) || code === getCurrencyCode()) return;
  try {
    localStorage.setItem(CUR_KEY, code);
    sessionStorage.setItem('amour_cur_toast', code);
  } catch (e) { /* private mode — still try to repaint below */ }
  location.reload(); /* full repaint so no price is left in the old currency */
}

/* ---------- floating widget ---------- */
function buildCurrencySwitch() {
  if (CUR_FORCE_INR || document.getElementById('curSwitch')) return;
  const cur = getCurrencyCode();

  const wrap = document.createElement('div');
  wrap.className = 'cur-switch';
  wrap.id = 'curSwitch';
  wrap.innerHTML =
    '<div class="cur-panel" id="curPanel" role="menu" aria-label="Choose currency">' +
      CUR_LIST.map(c =>
        '<button type="button" class="cur-opt' + (c.code === cur ? ' active' : '') + '"' +
        ' role="menuitemradio" aria-checked="' + (c.code === cur) + '" data-cur="' + c.code + '">' +
          '<img src="' + curFlagURL(c.flag) + '" alt="' + c.name + ' flag" width="26" height="18">' +
          '<span>' + c.code + '</span>' +
          '<em>' + c.name + '</em>' +
        '</button>').join('') +
    '</div>' +
    '<button type="button" class="cur-btn" id="curBtn" aria-haspopup="true" aria-expanded="false" aria-label="Change currency — currently ' + cur + '">' +
      '<img src="' + curFlagURL(curFind(cur).flag) + '" alt="' + curFind(cur).name + ' flag" width="26" height="18">' +
      '<span>' + cur + '</span>' +
      '<svg class="cur-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>' +
    '</button>';
  document.body.appendChild(wrap);

  const btn = document.getElementById('curBtn');
  const setOpen = open => {
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    setOpen(!wrap.classList.contains('open'));
  });
  wrap.addEventListener('click', e => {
    const opt = e.target.closest('.cur-opt');
    if (!opt) return;
    setOpen(false);
    setCurrencyCode(opt.dataset.cur);
  });
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

  /* "Prices now shown in USD" — survives the reload */
  let justSwitched = null;
  try {
    justSwitched = sessionStorage.getItem('amour_cur_toast');
    sessionStorage.removeItem('amour_cur_toast');
  } catch (e) { /* ignore */ }
  if (justSwitched && typeof toast === 'function') {
    toast('Prices now shown in ' + justSwitched);
  }
}

document.addEventListener('DOMContentLoaded', buildCurrencySwitch);
