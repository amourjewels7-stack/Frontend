/* ============================================================
   AMOUR JEWELS — Store configuration
   Brand / legal copy + the pricing rules the backend enforces.
   ------------------------------------------------------------
   ⚠ shipping numbers below MIRROR the backend (OrderService.createOrderFromCart):
       order value after discount ≥ ₹2,000  →  free shipping,  otherwise ₹100 flat.
     They are only used to show the customer an estimate; the amount that is
     actually charged always comes from the server when the order is created.
     If you change the rule in the backend, change it here too.
   ============================================================ */

const STORE = {
  brand: 'Amour Jewels',
  legalName: 'Amour Jewels Retail LLP',
  founded: 2019,          /* single source of truth for "years of craft" */
  karigars: 40,           /* in-house craftspeople — the one figure only the business can assert */
  gstin: '08AAGCA1234K1ZP',
  pan: 'AAGCA1234K',
  address: 'India',
  email: 'amourjewelsretail@gmail.com',
  phone: '+91 9009055502',
  sellerState: 'India',
  hours: 'Mon–Sat · 11 am – 8 pm IST',
  grievance: {
    name: 'Meera Kothari',
    designation: 'Grievance Officer — Customer Experience',
    email: 'amourjewelsretail@gmail.com',
    phone: '+91 9009055502',
    sla: 'Acknowledgement within 48 hrs · resolution within 30 days'
  },
  freeShip: 2000,         /* = backend: free shipping from ₹2,000 */
  ship: { std: 100 },     /* = backend: flat ₹100 below that (there is no express option) */
  whatsapp: { number: '919009055502', enabled: true }
};

/* ---------- analytics (optional) ----------
   Set enabled:true and paste real ids to switch Google Analytics / Meta Pixel on. */
const ANALYTICS = { enabled: false, ga4: '', metaPixel: '' };

function loadAnalytics() {
  if (!ANALYTICS.enabled) return;
  if (ANALYTICS.ga4) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS.ga4;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', ANALYTICS.ga4);
  }
  if (ANALYTICS.metaPixel) {
    window.fbq = window.fbq || function () { (window.fbq.queue = window.fbq.queue || []).push(arguments); };
    window.fbq.queue = window.fbq.queue || [];
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    fbq('init', ANALYTICS.metaPixel);
    fbq('track', 'PageView');
  }
}
function trackEvent(name, data) {
  if (!ANALYTICS.enabled) return;
  if (window.gtag) gtag('event', name, data || {});
  if (window.fbq) fbq('track', name, data || {});
}

/* ---------- delivery estimate (GET /api/pincode/{pin}) ----------
   Resolves to {pin, serviceable, eta, courier} or null for an invalid pincode.
   If the server can't be reached the pincode is NOT blocked — the real checks happen at checkout. */
async function pincodeInfo(pin) {
  pin = String(pin || '').trim();
  if (!/^\d{6}$/.test(pin)) return null;
  try {
    const d = await AmourAPI.pincode(pin);
    return { pin, serviceable: !!d.serviceable, eta: d.eta || '', courier: d.courier || '' };
  } catch (e) {
    if (e && e.status === 400) return null;
    return { pin, serviceable: true, eta: '', courier: '', unknown: true };
  }
}

/* shipping the customer will be charged for a given order value (mirrors the backend rule above) */
const shippingFor = amountAfterDiscount => (amountAfterDiscount <= 0 || amountAfterDiscount >= STORE.freeShip) ? 0 : STORE.ship.std;
