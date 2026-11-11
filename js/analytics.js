/* ============================================================
   AMOUR JEWELS — Google Analytics 4 (site-wide, 60-sec setup)
   Paste your Measurement ID once below and analytics goes live
   on every page. No admin toggle / localStorage needed.
   Get ID: analytics.google.com → Admin → Data Streams → G-XXXX
   ============================================================ */
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // ← REPLACE with your real ID, e.g. 'G-1A2B3C4D5E'

(function initGA4() {
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    console.warn('[GA4] Set your ID in js/analytics.js → GA_MEASUREMENT_ID');
    return; // stop silently until the real ID is pasted — nothing breaks
  }
  // 1. Load gtag.js
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);

  // 2. Init dataLayer + config (page_view fires automatically)
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });

  // 3. Bridge existing store events (checkout.js → trackEvent('Purchase'…))
  //    so Purchase / AddToCart / ViewContent also reach GA even when the
  //    admin-panel analytics switch is off.
  var _track = window.trackEvent;
  window.trackEvent = function (name, data) {
    try {
      if (window.gtag) {
        var map = { Purchase: 'purchase', AddToCart: 'add_to_cart', ViewContent: 'view_item', BeginCheckout: 'begin_checkout' };
        window.gtag('event', map[name] || name, data || {});
      }
    } catch (e) {}
    if (typeof _track === 'function') return _track(name, data);
  };
})();
