/* ============================================================
   AMOUR JEWELS — Error boundary
   Catches uncaught errors / failed promises / broken images so a
   single failure never leaves a blank or half-broken page.
   Load this FIRST on every page (no defer).
   ============================================================ */
(function () {
  'use strict';
  var shown = 0, MAX_BANNERS = 1, seen = {};

  function log(kind, info) {
    try { console.error('[Amour error-boundary]', kind, info); } catch (e) {}
  }

  /* friendly dismissible banner — shown once per page, never blocks the site */
  function banner(msg) {
    if (shown >= MAX_BANNERS || !document.body) return;
    shown++;
    var d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100000;' +
      'max-width:min(92vw,460px);background:#2a1f1c;color:#fff;padding:14px 18px;border-radius:6px;' +
      'font:14px/1.45 Georgia,serif;box-shadow:0 8px 30px rgba(0,0,0,.3);display:flex;gap:14px;align-items:center';
    d.innerHTML = '<span>' + msg + '</span>' +
      '<button type="button" style="background:none;border:1px solid rgba(255,255,255,.5);color:#fff;padding:6px 12px;cursor:pointer;font:inherit">Reload</button>' +
      '<button type="button" aria-label="Dismiss" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1">&times;</button>';
    var b = d.getElementsByTagName('button');
    b[0].onclick = function () { location.reload(); };
    b[1].onclick = function () { d.remove(); };
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 12000);
  }

  function handle(kind, err) {
    var key = kind + ':' + (err && (err.message || err));
    if (seen[key]) return;
    seen[key] = 1;
    log(kind, err);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { banner('Something went wrong loading this page. Please reload.'); });
    } else {
      banner('Something went wrong. Please reload the page.');
    }
  }

  window.addEventListener('error', function (e) {
    /* resource errors (img/script) arrive here too in the capture phase */
    var t = e.target;
    if (t && t !== window && t.tagName) {
      if (t.tagName === 'IMG') return imgFallback(t);
      if (t.tagName === 'SCRIPT') return handle('script-load', t.src);
      return;
    }
    handle('error', e.error || e.message);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    handle('promise', e.reason);
  });

  /* broken image → soft placeholder instead of the browser's broken-icon */
  function imgFallback(img) {
    if (img.dataset.ebDone) return;
    img.dataset.ebDone = '1';
    log('image', img.currentSrc || img.src);
    img.removeAttribute('srcset');
    img.style.visibility = 'hidden';
    var p = img.parentElement;
    if (p && !p.classList.contains('eb-img-fallback')) {
      p.classList.add('eb-img-fallback');
      p.style.background = p.style.background || 'linear-gradient(135deg,#efe6da,#e2d3c0)';
    }
  }

  /* run a function so its failure is contained; returns fallback on error */
  window.safeRun = function (fn, fallback) {
    try { return fn(); } catch (e) { handle('safeRun', e); return typeof fallback === 'function' ? fallback(e) : fallback; }
  };

  /* inline fallback block for sections that fail to render */
  window.renderFallback = function (el, msg) {
    if (!el) return;
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;font-family:Georgia,serif">' +
      '<p style="font-size:20px;margin-bottom:18px">' + (msg || 'We couldn’t load this right now.') + '</p>' +
      '<a href="shop.html" style="display:inline-block;border:1px solid currentColor;padding:12px 22px;text-decoration:none;color:inherit;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Back to shop</a></div>';
  };
})();
