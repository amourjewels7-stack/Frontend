/* ============================================================
   AMOUR JEWELS — Backend API layer  (loads FIRST on every page)
   ------------------------------------------------------------
   • One place that knows the API address and how sessions work.
   • Sessions are HttpOnly cookies set by the backend (accessToken 15 min,
     refreshToken 7 days). JavaScript never sees a token — every request is
     sent with credentials:'include'.
   • When an access token has expired the backend answers 401 (or a bare
     403 "Forbidden"). We then call POST /api/auth/refresh ONCE (shared between
     parallel requests and between browser tabs) and retry the original request.
   • The signed-in person's profile (name / e-mail / phone — nothing secret)
     is kept in localStorage under amour_account_v1 so the header and drawers
     can show it instantly.
   ============================================================ */
(function () {
  'use strict';

  /* API address: local development → the Spring Boot dev server; anywhere else → production API.
     To override (staging etc.) define  window.AMOUR_API_BASE  before this file loads. */
  var host = location.hostname;
  var BASE = window.AMOUR_API_BASE ||
    ((host === 'localhost' || host === '127.0.0.1' || host === '') ? 'http://localhost:10000' : 'https://api.amourjewels.in');

  /* Public identifiers (safe in the browser). GOOGLE_CLIENT_ID must equal the backend's GOOGLE_CLIENT_ID. */
  var GOOGLE_CLIENT_ID = window.AMOUR_GOOGLE_CLIENT_ID || '812244899342-u7ugpdjctmbg1jnva2pg1kc6rh5jnp8g.apps.googleusercontent.com';

  var PROFILE_KEY = 'amour_account_v1';

  function ApiError(message, status, data) {
    var e = new Error(message);
    e.name = 'ApiError'; e.status = status; e.data = data;
    return e;
  }

  /* ---------- profile (no secrets) ---------- */
  function readProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch (e) { return null; } }
  function writeProfile(p) { try { p ? localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) : localStorage.removeItem(PROFILE_KEY); } catch (e) {} }
  function tenDigits(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  /* backend User → the profile shape main.js / orders.js already use */
  function profileFromUser(u, provider) {
    u = u || {};
    var named = u.name && u.name !== 'Mobile User' && u.name !== 'Customer';
    return {
      id: u.id || '', type: u.email ? 'email' : 'phone',
      contact: u.email || tenDigits(u.phoneNumber),
      email: u.email || '', phone: tenDigits(u.phoneNumber),
      name: named ? u.name : '', provider: provider || (readProfile() || {}).provider || 'form',
      picture: (readProfile() || {}).picture || '', since: (readProfile() || {}).since || new Date().toISOString()
    };
  }

  /* ---------- low-level request ---------- */
  async function raw(path, opts) {
    var headers = {};
    var body;
    if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    var res;
    try {
      res = await fetch(BASE + path, { method: opts.method || 'GET', headers: headers, body: body, credentials: 'include' });
    } catch (e) {
      throw ApiError('We can’t reach the server right now. Please check your connection and try again.', 0);
    }
    if (opts.blob && res.ok) return { ok: true, status: res.status, data: await res.blob() };
    var text = await res.text(), data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { ok: res.ok, status: res.status, data: data };
  }

  /* Spring answers a missing / expired token with 401 OR a bare 403 (body "Forbidden"). */
  function isAuthFailure(r) {
    if (r.status === 401) return true;
    if (r.status !== 403) return false;
    var d = r.data;
    return !d || typeof d === 'string' || d.error === 'Forbidden' || d.status === 403;
  }

  /* friendly message from the backend's various error shapes: {error} · {message} · plain string · {errors:{…}} */
  function messageOf(r) {
    var d = r.data;
    if (d && typeof d === 'object') {
      if (d.error) return String(d.error);
      if (d.message) return String(d.message);
      if (d.errors && typeof d.errors === 'object') { var f = Object.keys(d.errors)[0]; if (f) return String(d.errors[f]); }
    }
    if (typeof d === 'string' && d && d.length < 240 && d.charAt(0) !== '<') return d;
    if (r.status === 429) return 'Too many attempts. Please wait a little and try again.';
    if (r.status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
    return 'Request failed (' + r.status + ').';
  }

  /* ---------- session refresh (single-flight, one at a time across tabs) ---------- */
  var refreshing = null;
  function refreshSession() {
    if (refreshing) return refreshing;
    var run = async function () {
      var r = await raw('/api/auth/refresh', { method: 'POST', body: {} });
      if (r.ok && r.data && r.data.user) { writeProfile(profileFromUser(r.data.user)); return true; }
      return false;
    };
    refreshing = (navigator.locks ? navigator.locks.request('amour-refresh', run) : run())
      .catch(function () { return false; })
      .then(function (ok) { refreshing = null; return ok; });
    return refreshing;
  }

  function endSession(silent) {
    writeProfile(null);
    if (!silent) window.dispatchEvent(new CustomEvent('amour:signedout'));
  }

  /* api(path, {method, body, auth:false, headers, blob}) → data.  Throws ApiError. */
  async function api(path, opts) {
    opts = opts || {};
    var r = await raw(path, opts);
    if (opts.auth !== false && isAuthFailure(r)) {
      if (await refreshSession()) r = await raw(path, opts);
      if (isAuthFailure(r)) {
        endSession();
        throw ApiError('Please sign in to continue.', 401, r.data);
      }
    }
    if (!r.ok) throw ApiError(messageOf(r), r.status, r.data);
    return r.data;
  }

  /* ---------- auth ---------- */
  var Auth = {
    profile: readProfile,
    isIn: function () { return !!readProfile(); },
    /* after any successful login: remember who it is */
    setUser: function (user, provider, extra) {
      var p = profileFromUser(user, provider);
      if (extra) Object.keys(extra).forEach(function (k) { if (extra[k]) p[k] = extra[k]; });
      writeProfile(p); return p;
    },
    signup: function (name, email, password) { return api('/api/auth/signup', { method: 'POST', body: { name: name, email: email, password: password }, auth: false }); },
    login: async function (email, password) {
      var d = await api('/api/auth/login', { method: 'POST', body: { email: email, password: password }, auth: false });
      return Auth.setUser(d.user, 'form');
    },
    sendOtp: function (phone10) { return api('/api/auth/send-otp', { method: 'POST', body: { phoneNumber: phone10 }, auth: false }); },
    verifyOtp: async function (phone10, otp) {
      var d = await api('/api/auth/verify-otp', { method: 'POST', body: { phoneNumber: phone10, otp: otp }, auth: false });
      return Auth.setUser(d.user, 'phone');
    },
    google: async function (idToken, picture) {
      var d = await api('/api/auth/google', { method: 'POST', body: { idToken: idToken }, auth: false });
      return Auth.setUser(d.user, 'google', { picture: picture });
    },
    logout: async function () {
      try { await api('/api/auth/logout', { method: 'POST', body: {}, auth: false }); } catch (e) { /* cookies are cleared by the server when it can */ }
      endSession(true);
    },
    /* the page must be signed in; otherwise go to the sign-in page and come back here after */
    require: function () {
      if (Auth.isIn()) return true;
      var here = location.pathname.split('/').pop() + location.search;
      location.replace('login.html?next=' + encodeURIComponent(here || 'index.html'));
      return false;
    }
  };

  /* ---------- endpoints ---------- */
  var enc = encodeURIComponent;
  var API = {
    base: BASE,
    googleClientId: GOOGLE_CLIENT_ID,
    request: api,
    products: function () { return api('/api/products', { auth: false }); },
    categories: function () { return api('/api/categories', { auth: false }); },
    pincode: function (pin) { return api('/api/pincode/' + enc(pin), { auth: false }); },
    reviews: function (productId, size) { return api('/api/feedback/reviews/product/' + enc(productId) + '?page=0&size=' + (size || 50), { auth: false }); },
    addReview: function (productId, rating, comment) { return api('/api/feedback/reviews', { method: 'POST', body: { productId: productId, rating: rating, comment: comment } }); },
    contact: function (m) { return api('/api/messages', { method: 'POST', body: m, auth: false }); },
    newsletter: function (email) { return api('/api/newsletter', { method: 'POST', body: { email: email }, auth: false }); },
    /* cart (signed-in only) */
    cart: function () { return api('/api/cart'); },
    cartAdd: function (item) { return api('/api/cart/items', { method: 'POST', body: item }); },
    cartRemove: function (productId) { return api('/api/cart/items/' + enc(productId), { method: 'DELETE' }); },
    /* checkout / orders */
    validateCoupon: function (code, subtotal) { return api('/api/checkout/validate-coupon', { method: 'POST', body: { code: code, subtotal: subtotal } }); },
    checkout: function (address, couponCode, idemKey) {
      return api('/api/orders/checkout', { method: 'POST', body: { shippingAddress: address, couponCode: couponCode || null }, headers: { 'Idempotency-Key': idemKey } });
    },
    myOrders: function () { return api('/api/orders/my-orders'); },
    trackOrder: function (orderNumber, email) { return api('/api/orders/track?orderNumber=' + enc(orderNumber) + '&email=' + enc(email), { auth: false }); },
    invoice: function (orderId) { return api('/api/orders/' + enc(orderId) + '/invoice', { blob: true }); },
    requestReturn: function (dto) { return api('/api/returns', { method: 'POST', body: dto }); }
  };

  window.AmourAPI = API;
  window.AmourAuth = Auth;
  window.ApiError = ApiError;

  /* run fn once the DOM is parsed AND the catalogue has loaded (or failed — pages then show their own error) */
  window.amourReady = function (fn) {
    var go = function () {
      var p = window.CATALOGUE_READY || Promise.resolve();
      p.then(fn, fn);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
  };
})();
