/* Confirm-subscription and unsubscribe pages.
   The token arrives in the URL fragment (#t=...), so it never reaches a server log. Nothing happens until the
   person presses the button: security scanners that open links in a browser cannot act on their behalf. */
(function () {
  'use strict';
  var mode = document.body.getAttribute('data-mp');
  if (!mode) return;

  var $ = function (id) { return document.getElementById(id); };
  var btn = $('mpBtn'), status = $('mpStatus'), title = $('mpTitle'), lede = $('mpLede'), text = $('mpText');
  var token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') || '';

  function finish(t, l, msg) {
    title.textContent = t; lede.textContent = l; text.textContent = msg;
    btn.hidden = true; status.textContent = ''; status.className = 'mp-status';
  }

  if (!token) {
    finish('This link is incomplete', 'Please use the link in your email.',
      mode === 'confirm'
        ? 'You can subscribe again from the form at the bottom of any page.'
        : 'Open the unsubscribe link from the email again, or switch this off any time from Settings → Notifications when you are signed in.');
    return;
  }
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* the token stays in memory either way */ }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    status.className = 'mp-status'; status.textContent = 'Working…';
    var call = mode === 'confirm' ? AmourAPI.newsletterConfirm(token) : AmourAPI.unsubscribe(token);
    call.then(function () {
      if (mode === 'confirm') finish('You are subscribed', 'Thank you.', 'We will send you the occasional note about new pieces and offers. Every email has an unsubscribe link.');
      else finish('You are unsubscribed', 'It is done.', 'You will no longer receive offers or cart reminders. Order and delivery updates are not affected. Changed your mind? Switch it back on any time in Settings → Notifications.');
    }).catch(function (e) {
      btn.disabled = false;
      status.className = 'mp-status bad';
      status.textContent = (e && e.message) || 'Something went wrong. Please try again.';
    });
  });
})();
