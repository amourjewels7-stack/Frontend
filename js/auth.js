/* ============================================================
   AMOUR JEWELS — Login & Register (login.html · register.html)
   Three ways in, all verified by the backend:
     1. Email + password   POST /api/auth/signup (register) · POST /api/auth/login
     2. Phone + SMS OTP    POST /api/auth/send-otp · POST /api/auth/verify-otp
                           (a new number automatically gets an account)
     3. Google             POST /api/auth/google  (backend verifies the ID token)
   The backend answers with HttpOnly session cookies (see js/api.js); nothing
   secret is stored in the browser. Layout/skin: css/auth.css (body.auth-dark).
   ------------------------------------------------------------
   GOOGLE: the OAuth Web Client ID lives in js/api.js (AmourAPI.googleClientId) and
   must be the same one the backend uses (GOOGLE_CLIENT_ID). Add this site's origin
   under "Authorised JavaScript origins" in Google Cloud Console.
   ============================================================ */

const AUTH_MODE = document.body.dataset.authMode === 'register' ? 'register' : 'login';
const GOOGLE_CLIENT_ID = AmourAPI.googleClientId;
const AUTH_NEEDS_ID = !GOOGLE_CLIENT_ID || /^__|^YOUR_CLIENT_ID/.test(GOOGLE_CLIENT_ID);
const AUTH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AUTH_PHONE_RE = /^[6-9]\d{9}$/;                 /* Indian mobile */
const auPending = { phone: null };                    /* OTP challenge in flight */

/* ---------- tiny DOM helpers ---------- */
const auVal = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
const auShow = (id, show) => { const el = document.getElementById(id); if (el) el.hidden = !show; };
function auErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}
function auBad(id, on) {
  const el = document.getElementById(id);
  if (el && el.classList) el.classList.toggle('bad', !!on);
}
function auClearErrs() {
  ['auErrEmail', 'auErrPhone', 'auErrOtp'].forEach(id => auErr(id, ''));
  ['auName', 'auEmail', 'auPass', 'auPass2', 'auPhone', 'auOtp'].forEach(id => auBad(id, false));
}
/* disable a form's submit button while a request is running */
function auBusy(formId, busy) {
  const f = document.getElementById(formId);
  const b = f && f.querySelector('button[type="submit"],button:not([type])');
  if (!b) return;
  if (busy) { b.dataset.label = b.textContent; b.textContent = 'Please wait…'; b.disabled = true; }
  else { b.disabled = false; if (b.dataset.label) b.textContent = b.dataset.label; }
}

/* ---------- redirect target: same-site relative ?next= only ---------- */
function authNext() {
  const next = new URLSearchParams(location.search).get('next');
  if (next && /^[a-z0-9][a-z0-9.\-_]*(\.html)?([?#].*)?$/i.test(next)) return next;
  return 'index.html';
}

/* ---------- status line under the buttons ---------- */
function authMsg(text, kind) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.hidden = !text;
  el.className = 'auth-msg' + (kind ? ' ' + kind : '');
  el.textContent = text || '';
}

/* ---------- gate (forms) vs. signed-in panel ---------- */
function authRenderState() {
  const gate = document.getElementById('authGate');
  const done = document.getElementById('authDone');
  if (!gate || !done) return false;
  const me = AmourAuth.profile();
  if (!me) { gate.hidden = false; done.hidden = true; return false; }

  const initials = me.name ? me.name.trim().slice(0, 2).toUpperCase() : (me.contact || 'AM').slice(0, 2).toUpperCase();
  const ava = document.getElementById('authAva');
  if (ava) {
    ava.textContent = '';
    if (me.picture) {
      const img = document.createElement('img');
      img.src = me.picture; img.alt = me.name || 'Profile photo'; img.referrerPolicy = 'no-referrer';
      ava.appendChild(img);
    } else ava.textContent = initials;
  }
  const who = document.getElementById('authWho');
  if (who) who.textContent = AUTH_MODE === 'register'
    ? (me.name ? `Welcome, ${me.name.split(' ')[0]}` : 'You already have an account')
    : (me.name ? `Signed in, ${me.name.split(' ')[0]}` : 'Signed in');
  const em = document.getElementById('authEmail');
  if (em) em.textContent = me.type === 'phone' ? '+91 ' + me.contact : (me.contact || '');
  gate.hidden = true; done.hidden = false;
  return true;
}

/* ---------- Email ⇄ Phone tabs ---------- */
function auSwitchTab(mode) {
  ['email', 'phone'].forEach(m => {
    const tab = document.getElementById('tab' + m.charAt(0).toUpperCase() + m.slice(1));
    if (tab && tab.classList) tab.classList.toggle('active', m === mode);
  });
  auShow('pnlEmail', mode === 'email');
  auShow('pnlPhone', mode === 'phone');
  auShow('pnlOtp', false);
  auClearErrs();
  authMsg();
}

/* ---------- success: the bag joins the account, then go where the customer was heading ---------- */
async function auComplete() {
  authMsg();
  if (typeof toast === 'function') {
    toast(AUTH_MODE === 'register' ? 'Account created — welcome to Amour Jewels' : 'Signed in — welcome back to Amour Jewels');
  }
  authRenderState();
  try { await (window.CATALOGUE_READY || Promise.resolve()); await cartMerge(); } catch (e) { /* the bag syncs on the next page */ }
  setTimeout(() => { location.href = authNext(); }, 500);
}

/* ---------- EMAIL path: register = create account · login = check password ---------- */
async function auSubmitEmail() {
  const email = auVal('auEmail').toLowerCase();
  const pass = document.getElementById('auPass') ? document.getElementById('auPass').value : '';
  auErr('auErrEmail', ''); auBad('auName', false); auBad('auEmail', false); auBad('auPass', false); auBad('auPass2', false);

  if (AUTH_MODE === 'register') {
    const name = auVal('auName');
    if (name.length < 2) { auErr('auErrEmail', 'Please enter your full name.'); auBad('auName', true); return; }
  }
  if (!AUTH_EMAIL_RE.test(email)) { auErr('auErrEmail', 'Enter a valid email address.'); auBad('auEmail', true); return; }
  if (pass.length < 8) { auErr('auErrEmail', 'Password must be at least 8 characters.'); auBad('auPass', true); return; }

  if (AUTH_MODE === 'register') {
    const pass2 = document.getElementById('auPass2').value;
    if (pass !== pass2) { auErr('auErrEmail', 'The two passwords don’t match.'); auBad('auPass2', true); return; }
    if (!/[A-Za-z]/.test(pass) || !/\d/.test(pass)) { auErr('auErrEmail', 'Password must contain at least one letter and one number.'); auBad('auPass', true); return; }
  }
  auBusy('pnlEmail', true);
  try {
    if (AUTH_MODE === 'register') await AmourAuth.signup(auVal('auName'), email, pass);
    await AmourAuth.login(email, pass);
    await auComplete();
  } catch (e) {
    auErr('auErrEmail', e.status === 401 || /credentials/i.test(e.message) ? 'Wrong email or password — please try again.' : e.message);
    if (e.status === 401) auBad('auPass', true);
    if (AUTH_MODE === 'register' && /unable to create/i.test(e.message)) auErr('auErrEmail', 'We couldn’t create an account with these details. If you already have one, please sign in instead.');
  } finally { auBusy('pnlEmail', false); }
}

/* ---------- PHONE path — send the OTP by SMS ---------- */
async function auSendOtp() {
  const phone = auVal('auPhone').replace(/\D/g, '');
  auErr('auErrPhone', ''); auBad('auPhone', false);
  if (!AUTH_PHONE_RE.test(phone)) {
    auErr('auErrPhone', 'Enter a valid 10-digit Indian mobile number.');
    auBad('auPhone', true);
    return;
  }
  auBusy('pnlPhone', true);
  try {
    await AmourAuth.sendOtp(phone);
    auPending.phone = phone;
    auShow('pnlPhone', false);
    auShow('pnlOtp', true);
    const otp = document.getElementById('auOtp');
    if (otp) { otp.value = ''; otp.focus(); }
    authMsg('We sent a 6-digit code by SMS to +91 ' + phone + '. It stays valid for 5 minutes.', 'note');
  } catch (e) {
    auErr('auErrPhone', e.message);
  } finally { auBusy('pnlPhone', false); }
}

/* ---------- PHONE path — verify the OTP ---------- */
async function auVerifyOtp() {
  const code = auVal('auOtp').replace(/\D/g, '');
  auErr('auErrOtp', ''); auBad('auOtp', false);
  if (code.length !== 6) { auErr('auErrOtp', 'Enter the 6-digit code.'); auBad('auOtp', true); return; }
  auBusy('pnlOtp', true);
  try {
    await AmourAuth.verifyOtp(auPending.phone, code);
    await auComplete();
  } catch (e) {
    auErr('auErrOtp', /too many/i.test(e.message) ? e.message + ' Go back and request a new code.' : 'That code is not right or has expired — check the digits and try again.');
    auBad('auOtp', true);
  } finally { auBusy('pnlOtp', false); }
}

/* ---------- Google credential callback → backend verifies the token ---------- */
function authDecodePicture(token) {              /* only for the avatar; the BACKEND does the real verification */
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))).picture || '';
  } catch (e) { return ''; }
}
async function authHandleCredential(resp) {
  if (!resp || !resp.credential) { authMsg('Google did not return an account. Please try again.', 'bad'); return; }
  authMsg('Signing you in…', 'note');
  try {
    await AmourAuth.google(resp.credential, authDecodePicture(resp.credential));
    await auComplete();
  } catch (e) {
    authMsg(e.message || 'Google sign-in failed. Please try again.', 'bad');
  }
}

/* ---------- official Google button ---------- */
function authRenderButton() {
  const box = document.getElementById('authGoogle');
  if (!box) return true;
  if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: authHandleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    error_callback: () => authMsg('Google sign-in was cancelled or blocked. Please try again.', 'bad')
  });
  window.google.accounts.id.renderButton(box, {
    theme: 'filled_black', size: 'large', shape: 'rectangular',
    text: AUTH_MODE === 'register' ? 'signup_with' : 'signin_with',
    width: Math.max(220, Math.min(300, box.clientWidth || 260))
  });
  return true;
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const signedIn = authRenderState();

  const out = document.getElementById('authSignOut');
  out && out.addEventListener('click', async () => {
    await signOutEverywhere();
    authRenderState();
    if (typeof toast === 'function') toast('Signed out — see you soon');
  });

  document.querySelectorAll('[data-au-tab]').forEach(btn => btn.addEventListener('click', () => auSwitchTab(btn.dataset.auTab)));

  const back = document.getElementById('otpBack');
  back && back.addEventListener('click', () => { auShow('pnlOtp', false); auShow('pnlPhone', true); auClearErrs(); authMsg(); });

  const bind = (id, fn) => {
    const f = document.getElementById(id);
    f && f.addEventListener('submit', e => { e.preventDefault(); fn(); });
  };
  bind('pnlEmail', auSubmitEmail);
  bind('pnlPhone', auSendOtp);
  bind('pnlOtp', auVerifyOtp);

  if (signedIn) return;
  if (AUTH_NEEDS_ID) {
    const g = document.getElementById('authGoogle');
    if (g) g.hidden = true;
    return;                                       /* no client id configured → hide the Google button entirely */
  }
  /* the GIS script loads async — poll briefly, then give up loudly */
  let tries = 0;
  (function waitGsi() {
    if (authRenderButton()) return;
    if (++tries > 40) { authMsg("Google sign-in couldn't load. Check your connection and refresh the page.", 'bad'); return; }
    setTimeout(waitGsi, 250);
  })();
});
