/* ============================================================
   AMOUR JEWELS — Product detail page
   ============================================================ */

const LINK_STYLE = 'color:var(--gold-deep);text-decoration:underline;text-underline-offset:3px';
const WA = '<a href="https://wa.me/919009055502" target="_blank" rel="noopener" style="' + LINK_STYLE + '">WhatsApp</a>';

/* Same wording as the footer pages: shipping-policy.html & returns-exchange.html */
const SHIPPING_POLICY_HTML = `
<h4>Shipping Policy</h4>
<p>At Amour Jewels, we take extra care to ensure your treasured pieces reach you safely and as promptly as possible.</p>
<h5>Order Processing &amp; Dispatch</h5>
<p>In-stock items are usually dispatched within <b>24–48 hours</b> of receiving your order.</p>
<h5>Estimated Delivery Timelines</h5>
<p>Once dispatched, the usual delivery time is <b>3–8 days</b>, depending on your delivery location and courier service.</p>
<p>Need your order sooner? For urgent orders or express shipping options, please reach out to us on ${WA} before placing your order. Our team will be happy to assist you.</p>
<h5>Custom Orders</h5>
<p>Custom-made and specially requested pieces may require additional processing time.</p>
<p>For an estimated dispatch and delivery timeline, please contact our team before placing your order. We will guide you based on the requirements of your piece.</p>
<h5>Shipping Delays</h5>
<p>While we strive to deliver every order within the estimated timeframe, delays may occasionally occur due to public holidays, adverse weather, natural calamities, courier disruptions or other circumstances beyond our control.</p>
<p>We appreciate your patience and understanding in such situations.</p>
<h5>Need Assistance?</h5>
<p>For shipping updates, urgent delivery requests or any other shipping-related queries, please contact our team on ${WA}. We’re always happy to help make your Amour experience seamless.</p>
<h4>International Shipping</h4>
<p>Amour Jewels brings the beauty of Indian adornment to customers around the world. We offer international shipping, subject to service availability.</p>
<h5>Delivery Timelines</h5>
<p>International delivery timelines vary depending on the destination, customs clearance and courier services. For an estimated delivery timeframe, please contact our team before placing your order.</p>
<h5>Customs Duties &amp; Import Taxes</h5>
<p>International orders may be subject to customs duties, import taxes, VAT or other charges imposed by the destination country. These charges, where applicable, are the responsibility of the customer and are not included in the product price or shipping charges unless explicitly stated at checkout.</p>
<h5>Customs Clearance &amp; Delays</h5>
<p>International shipments may experience delays due to customs inspections, documentation requirements, public holidays, adverse weather or other circumstances beyond our control. Amour Jewels cannot guarantee delivery dates where such delays occur.</p>
<h5>Need Assistance?</h5>
<p>For international shipping enquiries, destination-specific delivery estimates or assistance with your order, please contact our team on ${WA}. We will be happy to help you discover and shop Amour from wherever you are in the world.</p>`;

const RETURNS_POLICY_HTML = `
<h4>Exchange / Return Policy</h4>
<p>At Amour Jewels, every piece is carefully checked and packed before dispatch. We want you to love your purchase, and our team is here to help if something isn’t right.</p>
<p>Please read our policy carefully before placing your order.</p>
<h5>Damaged or Defective Products</h5>
<p>If your jewellery arrives damaged or defective, please notify us within <b>48 hours</b> of receiving your order.</p>
<p>To help us verify and resolve your claim, you must provide:</p>
<ul><li>Clear photographs and videos of the damaged or defective item.</li>
<li>Your order number and a brief description of the issue.</li>
<li>Unboxing videos are mandatory for damage claims. Claims submitted without the required video evidence may not be eligible for approval.</li></ul>
<p>Once our team reviews and approves the claim, we will guide you through the appropriate resolution.</p>
<h5>Returns &amp; Refunds</h5>
<p>For eligible returns approved by our team, the refund will be issued as <b>store credit only</b> — no refund to the original payment method.</p>
<p>Store credit will be valid for <b>90 days</b> from the date of issue and must be used within this period. Any unused balance after expiry will no longer be redeemable.</p>
<h5>Size Exchanges</h5>
<p>If you need a different size for rings, bangles or other size-dependent jewellery, please contact our team within <b>48 hours</b> of receiving your order.</p>
<ul><li>Size exchanges are subject to product availability and approval by our team.</li>
<li>Additional shipping charges for the exchange will be borne by the customer.</li>
<li>The item must be unused, unworn, undamaged and returned in its original packaging.</li>
<li>Products showing signs of wear, alteration or damage may not be eligible for exchange.</li></ul>
<h5>Conditions for Returns &amp; Exchanges</h5>
<p>To be eligible for an approved return or exchange:</p>
<ul><li>The request must be raised within the applicable 48-hour window.</li>
<li>The jewellery must be unused, unworn and in its original condition.</li>
<li>Original packaging and any accompanying items must be included.</li>
<li>The request must be approved by our team before the item is shipped back.</li></ul>
<h5>Important Note</h5>
<p>We recommend recording an uninterrupted video while opening your parcel to help protect both you and Amour Jewels in the event of a transit-damage claim.</p>
<p>Our team reviews every request individually and will communicate the outcome and available resolution.</p>
<h5>Need assistance?</h5>
<p>Message us on ${WA} with your order number — we will take it from there.</p>`;

/* Manufacturer / consumer-care block shown on every product (values come from store-config.js) */
function makerHTML() {
  const S = (typeof STORE !== 'undefined') ? STORE : {};
  const name = S.legalName || 'Amour Jewels Retail LLP';
  const addr = S.address || 'India';
  const mail = S.email || 'amourjewelsretail@gmail.com';
  const tel = S.phone || '+91 9009055502';
  const hrs = S.hours || 'Mon–Sat · 11 am – 8 pm IST';
  const telHref = tel.replace(/[^\d+]/g, '');
  return `<p><b>Manufactured, packed &amp; marketed by:</b><br>${name}, ${addr}</p>
    <p><b>Country of origin:</b> India</p>
    <p><b>Consumer care:</b><br>
      Email: <a href="mailto:${mail}" style="${LINK_STYLE}">${mail}</a><br>
      Phone: <a href="tel:${telHref}" style="${LINK_STYLE}">${tel}</a> (${hrs})<br>
      ${WA}: <a href="https://wa.me/${telHref.replace('+','')}" target="_blank" rel="noopener" style="${LINK_STYLE}">${tel}</a></p>`;
}


let pdp = { size: null, qty: 1 };

function galleryHTML(p) {
  const imgs = [...new Set([p.img, p.alt])];
  return `
  <div class="pdp-gallery">
    <div class="pdp-main">
      ${p.tag === 'New' ? '<span class="p-tag new">New In</span>' : p.tag === 'Bestseller' ? '<span class="p-tag">Bestseller</span>' : ''}
      <img id="pdpMainImg" src="${imgs[0]}" alt="${p.name}">
    </div>
    <div class="pdp-thumbs">
      ${imgs.map((src, i) => `<button class="${i === 0 ? 'active' : ''}" data-thumb="${src}"><img src="${src}" alt="${p.name} — view ${i + 1}"></button>`).join('')}
    </div>
  </div>`;
}

function infoHTML(p) {
  const off = Math.round((1 - p.price / p.mrp) * 100);
  const sizes = p.sizes ? `
    <div class="opt-label"><span>Select Size ${p.sizes.length <= 4 ? '· US' : '· Inches'}</span><a href="contact.html">Size help</a></div>
    <div class="size-row" id="sizeRow">
      ${p.sizes.map(s => `<button data-size="${s}">${s}</button>`).join('')}
    </div>` : '';
  return `
  <div class="pdp-info">
    <p class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; <a href="shop.html">Shop</a> &nbsp;/&nbsp; <span>${catLabel(p)}</span></p>
    <h1>${p.name}</h1>
    ${starHTML(p.rating, p.reviews)}
    <div class="pdp-price">
      <span class="now">${money(p.price)}</span>
      ${p.mrp > p.price ? `<s>${money(p.mrp)}</s><span class="save">Save ${off}%</span>` : ''}
    </div>
    <p class="pdp-tax">Inclusive of all taxes · SKU ${p.sku}</p>
    <p class="pdp-desc">${p.desc}</p>
    ${sizes}
    <div class="pdp-actions">
      <button class="btn" id="pdpAdd" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Sold out' : 'Add to Bag — ' + money(p.price)}</button>
      <button class="wish-toggle ${isWished(p.id) ? 'active' : ''}" id="pdpWish" aria-label="Add to wishlist">
        <svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M12 20.5c-5.2-3.9-8.5-7-8.5-10.6C3.5 7 5.5 5 8 5c1.6 0 3.1.9 4 2.2C12.9 5.9 14.4 5 16 5c2.5 0 4.5 2 4.5 4.9 0 3.6-3.3 6.7-8.5 10.6z"/></svg>
      </button>
    </div>
    ${p.stock > 0 && p.stock <= 3 ? `<p class="pdp-tax" style="color:var(--gold-deep)">Only ${p.stock} left</p>` : ''}
    <button class="btn ghost" id="buyNow" style="margin-top:12px" ${p.stock <= 0 ? 'disabled' : ''}>Buy Now</button>
    <a class="wa-inline" id="pdpWa" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.7-1.2 1.3-1.7 1.3-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.4z"/></svg>
      Order on WhatsApp</a>
    <div class="ship-widget" id="pdpShipCheck" style="margin-top:18px">
      <b>Delivery &amp; Prepaid Checkout</b>
      <div class="coupon-row">
        <input id="pdpPin" placeholder="Enter pincode" inputmode="numeric" maxlength="6" style="text-transform:none">
        <button class="btn ghost" id="pdpPinBtn" type="button">Check</button>
      </div>
      <p id="pdpPinResult" style="margin-top:8px"></p>
    </div>
    <div class="pdp-trust">
      <div>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4"><path d="M2 7h11v10H2zM13 10h4l3 3v4h-7z"/><circle cx="6" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>
        <span>Insured, tracked shipping</span>
      </div>
      <div>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.4"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 10h20"/></svg>
        <span>Secure prepaid payments</span>
      </div>
    </div>
    <div class="accordions" id="pdpAcc">
      <div class="acc">
        <button class="acc-head">Product Details
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div class="acc-body"><div class="acc-body-in"><ul>${p.details.map(d => `<li>${d}</li>`).join('')}</ul></div></div>
      </div>
      <div class="acc">
        <button class="acc-head">Care &amp; Composition
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div class="acc-body"><div class="acc-body-in"><p>Wear it, love it — just keep it away from perfume, chlorine and the gym. Wipe with the flannel pouch after wear and store flat. Vermeil matures like everything beautiful: a soft patina is normal; a gold-tone polish cloth brings the shine right back.</p></div></div>
      </div>
      <div class="acc">
        <button class="acc-head">Shipping &amp; Returns
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div class="acc-body"><div class="acc-body-in policy-copy">${SHIPPING_POLICY_HTML}${RETURNS_POLICY_HTML}</div></div>
      </div>
      <div class="acc">
        <button class="acc-head">Manufacturer &amp; Consumer Care
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div class="acc-body"><div class="acc-body-in">${makerHTML()}</div></div>
      </div>
    </div>
  </div>`;
}


function bindPDP(p) {
  $('#pdpAcc').addEventListener('click', e => {
    const head = e.target.closest('.acc-head');
    if (!head) return;
    const acc = head.parentElement;
    const body = acc.querySelector('.acc-body');
    const open = acc.classList.toggle('open');
    body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
  });

  const sizeRow = $('#sizeRow');
  if (sizeRow) {
    sizeRow.addEventListener('click', e => {
      const b = e.target.closest('[data-size]');
      if (!b) return;
      $$('#sizeRow button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      pdp.size = b.dataset.size;
    });
  }

  $('#pdpAdd').addEventListener('click', () => {
    if (addToCart(p.id, pdp.size, pdp.qty)) {
      const b = $('#pdpAdd');
      b.textContent = 'Added to Bag ✓';
      setTimeout(() => { b.textContent = 'Add to Bag — ' + money(p.price); }, 1800);
    }
  });

  $('#pdpWish').addEventListener('click', () => {
    toggleWish(p.id);
    $('#pdpWish').classList.toggle('active', isWished(p.id));
  });

  $('#buyNow').addEventListener('click', () => {
    if (addToCart(p.id, pdp.size, pdp.qty, false)) {
      window.location.href = 'checkout.html';
    }
  });

  const wa = $('#pdpWa');
  if (wa) {
    const pageUrl = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(p.id)
      : window.location.href;
    const msg = [
      'Hi Amour Jewels! I would like to order:',
      '',
      '*' + p.name + '*',
      'Price: ' + money(p.price),
      'SKU: ' + p.sku,
      'Link: ' + pageUrl,
      '',
      'Please confirm availability and delivery details. Thank you!'
    ].join('\n');
    wa.href = 'https://wa.me/' + (typeof STORE !== 'undefined' ? STORE.whatsapp.number : '919009055502')
      + '?text=' + encodeURIComponent(msg);
  }

  const pinBtn = $('#pdpPinBtn');
  const pinCheck = async () => {
    const res = $('#pdpPinResult');
    $('#pdpPin').value = $('#pdpPin').value.replace(/\D/g, '').slice(0, 6);
    res.textContent = 'Checking…';
    const info = await pincodeInfo($('#pdpPin').value);
    if (!info) { res.textContent = 'Enter a valid 6-digit pincode.'; return; }
    if (!info.serviceable) res.innerHTML = '✕ Not serviceable at ' + info.pin + ' yet.';
    else if (info.unknown) res.innerHTML = 'We could not check right now — delivery is confirmed at checkout.';
    else res.innerHTML = '✓ Delivers in <b>' + info.eta + '</b> via ' + info.courier + ' · Secure prepaid checkout.';
  };
  if (pinBtn) {
    pinBtn.addEventListener('click', pinCheck);
    $('#pdpPin').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pinCheck(); } });
  }

  $$('.pdp-thumbs button').forEach(b => b.addEventListener('click', () => {
    $$('.pdp-thumbs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('#pdpMainImg').src = b.dataset.thumb;
  }));
}

amourReady(() => {
  const root = $('#pdpRoot');
  if (!root) return;
  if (CATALOGUE_ERROR) { root.innerHTML = '<div class="shop-empty"><h3>We couldn’t load this piece</h3><p>Please check your connection and refresh.</p></div>'; return; }
  const id = new URLSearchParams(window.location.search).get('id');
  const p = productById(id);
  if (!p) { document.title = 'Piece not found — Amour Jewels'; root.innerHTML = '<div class="shop-empty"><h3>We couldn’t find that piece</h3><p>It may have sold out or been retired. <a href="shop.html">Browse the collection →</a></p></div>'; return; }
  document.title = p.name + ' — Amour Jewels';
  try {
    root.innerHTML = galleryHTML(p) + infoHTML(p);
    bindPDP(p);
  } catch (err) {
    console.error(err);
    if (window.renderFallback) renderFallback(root, 'We couldn’t load this product right now.');
    return;
  }

  /* SEO — Product schema */
  const schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    image: [p.img, p.alt],
    description: p.desc,
    brand: { '@type': 'Brand', name: 'Amour Jewels' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: p.price,
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href
    }
  });
  document.head.appendChild(schema);
  loadReviews(p, schema);

  let pairs = PRODUCTS.filter(x => x.id !== p.id && (x.cat || []).some(c => (p.cat || []).includes(c)));
  if (pairs.length < 2) pairs = PRODUCTS.filter(x => x.id !== p.id);
  const sec = $('#pairsSection');
  sec.hidden = false;
  $('#pairsGrid').innerHTML = pairs.slice(0, 4).map(cardHTML).join('');
});

/* ---------- real customer reviews (GET /api/feedback/reviews/product/{id}) ----------
   Shows the average + latest reviews, updates the star line, and adds aggregateRating to the
   structured data ONLY when there is at least one genuine review. */
async function loadReviews(p, schemaEl) {
  const root = $('#pdpRoot');
  try {
    const d = await AmourAPI.reviews(p._id, 50);
    const list = (d && d.reviews) || [];
    const total = (d && d.totalReviews) || list.length;
    if (!total) return;
    const avg = list.reduce((n, r) => n + (+r.rating || 0), 0) / (list.length || 1);
    const stars = $('.pdp-info .p-stars');
    if (stars) stars.outerHTML = starHTML(avg, total);
    try {
      const ld = JSON.parse(schemaEl.textContent);
      ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Math.round(avg * 10) / 10, reviewCount: total };
      schemaEl.textContent = JSON.stringify(ld);
    } catch (e) {}
    const info = $('.pdp-info');
    if (!info) return;
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:26px;padding-top:18px;border-top:1px solid var(--line-soft)';
    box.innerHTML = `<h4 style="font-size:15px;margin-bottom:12px">Customer reviews (${total})</h4>` + list.slice(0, 5).map(r => `
      <div style="margin-bottom:14px">
        <div>${starHTML(+r.rating || 0, 0)} <b style="font-weight:500;font-size:13px">${esc(r.userName || 'Customer')}</b>
          <span style="color:var(--taupe);font-size:12px"> · ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</span></div>
        <p style="margin-top:4px;font-size:13.5px;line-height:1.6">${esc(r.comment || '')}</p>
      </div>`).join('');
    info.appendChild(box);
  } catch (e) { /* reviews are a nicety — the page works without them */ }
}
