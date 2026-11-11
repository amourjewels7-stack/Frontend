/* ============================================================
   AMOUR JEWELS — Cart page
   ============================================================ */

function renderCartPage() {
  const wrap = $('#cartRoot');
  if (!wrap) return;
  const items = getCart();
  if (!items.length) {
    wrap.innerHTML = `
      <div class="cart-empty-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.2"><path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 8z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>
        <h2>Your bag is empty</h2>
        <p>Nothing sparkly in here yet. Let’s fix that.</p>
        <a class="btn" href="shop.html">Shop the Collections</a>
      </div>`;
    return;
  }
  const sub = cartSubtotal();
  const ship = shippingFor(sub);
  wrap.innerHTML = `
  <div class="cart-layout">
    <div class="cart-table" id="cartLines">
      ${items.map(i => {
        const p = productById(i.id);
        if (!p) return '';
        return `
        <div class="cart-row" data-key="${i.key}">
          <a href="product.html?id=${p.id}"><img src="${p.img}" alt="${p.name}"></a>
          <div class="cr-body">
            <p class="cr-cat">${catLabel(p)}</p>
            <a class="cr-name" href="product.html?id=${p.id}">${p.name}</a>
            <p class="cr-meta">${i.size ? 'Size ' + i.size + ' · ' : ''}${money(p.price)} each${p.stock > 0 && p.stock <= 3 ? ' · only ' + p.stock + ' left' : ''}</p>
            <div style="margin-top:14px">
              <span class="qty">
                <button data-dec aria-label="Decrease quantity">−</button>
                <span>${i.qty}</span>
                <button data-inc aria-label="Increase quantity">+</button>
              </span>
            </div>
          </div>
          <div class="cr-right">
            <p class="cr-price">${money(p.price * i.qty)}${i.qty > 1 ? `<s>${money(p.price)}</s>` : ''}</p>
            <button class="cr-remove" data-remove>Remove</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <aside class="summary">
      <h3>Order Summary</h3>
      <div class="sum-row"><span>Subtotal</span><span>${money(sub)}</span></div>
      <div class="sum-row"><span>Shipping</span>${ship === 0 ? '<span class="free">FREE — insured</span>' : `<span>${money(STORE.ship.std)}</span>`}</div>
      <div class="sum-row total"><span>Total</span><span>${money(sub + ship)}</span></div>
      <p class="sum-note">${ship === 0 ? 'Free insured shipping unlocked.' : 'Add ' + money(FREE_SHIP - sub) + ' more for free insured shipping.'} Taxes included.</p>
      <button class="btn wide" id="checkoutBtn">Buy Now</button>
      <div class="trust-lines">
        <p><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg> Insured shipping — free from ₹2,000</p>
        
        <p><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 10h20"/></svg> Secure prepaid — UPI · Cards · NetBanking</p>
      </div>
    </aside>
  </div>`;

  /* line interactions */
  $('#cartLines').addEventListener('click', e => {
    const row = e.target.closest('.cart-row');
    if (!row) return;
    const key = row.dataset.key;
    const line = getCart().find(i => i.key === key);
    if (!line) return;
    if (e.target.closest('[data-inc]')) setQty(key, line.qty + 1);
    else if (e.target.closest('[data-dec]')) setQty(key, line.qty - 1);
    else if (e.target.closest('[data-remove]')) removeLine(key);
  });

  $('#checkoutBtn').addEventListener('click', () => {
    window.location.href = getProfile() ? 'checkout.html' : 'login.html?next=checkout.html';
  });
}

amourReady(() => {
  if (CATALOGUE_ERROR && $('#cartRoot')) { $('#cartRoot').innerHTML = '<div class="cart-empty-wrap"><h2>We couldn’t load your bag</h2><p>Please refresh in a moment.</p></div>'; return; }
  renderCartPage();
  if (getProfile()) cartPull();
});
