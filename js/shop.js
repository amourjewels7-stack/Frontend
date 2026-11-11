/* ============================================================
   AMOUR JEWELS — Shop page (filters + sort + search)
   ============================================================ */

const shopState = { cat: null, coll: null, band: null, q: null, sort: 'featured' };

function readParams() {
  const u = new URLSearchParams(window.location.search);
  shopState.cat = u.get('cat');
  shopState.coll = u.get('collection');
  shopState.q = u.get('q');
  if (u.get('sort')) shopState.sort = u.get('sort');
}

function bannerCopy() {
  const head = $('#bannerHead'), title = $('#bannerTitle'), lede = $('#bannerLede');
  let h = 'Shop All';
  let l = 'Shop All';
  if (shopState.cat && CATEGORIES[shopState.cat]) {
    h = CATEGORIES[shopState.cat].label;
    l = {
      earrings: undefined,
      necklaces: undefined,
      rings: undefined,
      bracelets: undefined,
      pearls: undefined,
      everyday: undefined,
      hand: undefined,
      hair: undefined,
      groom: undefined,
      brooches: undefined
    }[shopState.cat] || l;
  } else if (shopState.cat) {
    /* unknown ?cat= value (e.g. a stale footer/SEO link): fall back to
       Shop All copy instead of silently showing an empty grid */
    shopState.cat = null;
  } else if (shopState.coll === 'new') {
    h = 'New Arrivals'; l = undefined;
  } else if (shopState.coll === 'bridal') {
    h = 'The Bridal Edit'; l = undefined;
  } else if (shopState.coll === 'bestsellers') {
    h = 'Best Sellers'; l = undefined;
  } else if (shopState.coll === 'spotted') {
    h = 'Spotted'; l = undefined;
  } else if (shopState.coll === 'core') {
    h = 'Everyday Icons'; l = undefined;
  } else if (shopState.coll) {
    /* unknown ?collection= value: same fallback, no empty grid */
    shopState.coll = null;
  } else if (shopState.q) {
    h = 'Search: “' + shopState.q + '”'; l = undefined;
  }
  if (head) head.textContent = h;
  if (title) title.textContent = h;
  if (lede) lede.textContent = l;
}

function buildFilters() {
  const catWrap = $('#catFilter');
  const collWrap = $('#collFilter');
  const counts = {};
  const catalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
  catalog.forEach(p => (p.cat || []).forEach(c => counts[c] = (counts[c] || 0) + 1));
  /* visible categories — rings / pearls / everyday hidden from browsing but products stay live */
  const VISIBLE_CATS = ['hand', 'necklaces', 'earrings', 'bracelets', 'hair', 'groom', 'brooches', 'diamond'];
  if (catWrap) {
    catWrap.insertAdjacentHTML('beforeend',
      `<a href="shop.html" class="${!shopState.cat ? 'active' : ''}">All Jewellery <span class="n">${catalog.length}</span></a>` +
      VISIBLE_CATS.filter(c => CATEGORIES[c]).map(c =>
        `<a href="shop.html?cat=${c}" class="${shopState.cat === c ? 'active' : ''}">${CATEGORIES[c].label} <span class="n">${counts[c] || 0}</span></a>`
      ).join(''));
  }
  if (collWrap) {
    collWrap.insertAdjacentHTML('beforeend',
      [['new', 'New Arrivals'], ['bestsellers', 'Best Sellers'], ['spotted', 'Spotted'], ['bridal', 'The Bridal Edit'], ['core', 'Everyday Icons']]
        .map(([k, label]) => `<a href="shop.html?collection=${k}" class="${shopState.coll === k ? 'active' : ''}">${label}</a>`).join(''));
  }
}

function applyFilters() {
  const catalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
  let list = catalog.slice();
  if (shopState.cat) list = list.filter(p => (p.cat || []).includes(shopState.cat));
  if (shopState.coll === 'bestsellers') list = list.filter(p => p.tag === 'Bestseller');
  else if (shopState.coll === 'spotted') list = list.filter(p => p.collection === 'spotted');
  else if (shopState.coll) list = list.filter(p => p.collection === shopState.coll);
  if (shopState.q) {
    const t = shopState.q.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(t) || p.desc.toLowerCase().includes(t) || catLabel(p).toLowerCase().includes(t));
  }
  if (shopState.band) {
    const parts = shopState.band.split('-').map(Number);
    list = list.filter(p => p.price >= parts[0] && p.price < parts[1]);
  }
  switch (shopState.sort) {
    case 'low': list.sort((a, b) => a.price - b.price); break;
    case 'high': list.sort((a, b) => b.price - a.price); break;
    case 'rating': list.sort((a, b) => b.rating - a.rating); break;
    case 'new': list.sort((a, b) => (b.collection === 'new') - (a.collection === 'new')); break;
    default: list.sort((a, b) => (b.tag === 'Bestseller') - (a.tag === 'Bestseller'));
  }
  return list;
}


function renderShop() {
  const grid = $('#shopGrid');
  if (!grid) return;
  const list = applyFilters();
  const catalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
  const countEl = $('#shopCount');
  if (countEl) countEl.innerHTML = `Showing <b>${list.length}</b> of ${catalog.length} pieces`;
  grid.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : `<div class="shop-empty"><h3>Nothing here (yet).</h3><p>Try a different filter &mdash; or tell us what you&rsquo;re hunting for and we&rsquo;ll make it.</p><a class="btn ghost" href="contact.html">Request a Piece</a></div>`;

  const chips = [];
  if (shopState.cat && CATEGORIES[shopState.cat]) chips.push(['cat', CATEGORIES[shopState.cat].label]);
  if (shopState.coll === 'new') chips.push(['coll', 'New Arrivals']);
  if (shopState.coll === 'bestsellers') chips.push(['coll', 'Best Sellers']);
  if (shopState.coll === 'spotted') chips.push(['coll', 'Spotted']);
  if (shopState.coll === 'bridal') chips.push(['coll', 'The Bridal Edit']);
  if (shopState.coll === 'core') chips.push(['coll', 'Everyday Icons']);
  if (shopState.q) chips.push(['q', '“' + shopState.q + '”']);
  if (shopState.band) {
    const parts = shopState.band.split('-').map(Number);
    chips.push(['band', parts[0] === 0
      ? 'Under ₹' + parts[1].toLocaleString('en-IN')
      : '₹' + parts[0].toLocaleString('en-IN') + ' – ₹' + parts[1].toLocaleString('en-IN')]);
  }
  const row = $('#chipsRow');
  if (row) {
    row.hidden = chips.length === 0;
    row.innerHTML = chips.map(([k, label]) =>
      `<span class="chip">${label}<button data-clear="${k}" aria-label="Clear filter">x</button></span>`).join('');
  }
  $$('.filter-group [data-band]').forEach(a =>
    a.classList.toggle('active', a.dataset.band === shopState.band));
}

function clearParam(k) {
  const u = new URLSearchParams(window.location.search);
  /* chips use short keys (cat/coll/q) but the URL params are
     cat/collection/q — map them so the × buttons actually clear */
  const param = k === 'coll' ? 'collection' : k;
  u.delete(param);
  const qs = u.toString();
  window.location.href = 'shop.html' + (qs ? '?' + qs : '');
}

amourReady(() => {
  if (!$('#shopGrid')) return;
  if (CATALOGUE_ERROR) {
    $('#shopGrid').innerHTML = '<div class="shop-empty"><h3>We couldn’t load the collection</h3><p>Please check your connection and <a href="shop.html">try again</a>.</p></div>';
    return;
  }
  readParams();
  // — Shop All dropdown —
  const navDrop = $('#navDrop');
  const shopBtn = $('#shopBtn');
  const shopDropdown = $('#shopDropdown');
  const ddCategories = $('#ddCategories');
  const ddList = $('#ddList');
  const shopOverlay = $('#shopOverlay');
  const ddClose = $('#ddClose');
  const ddHeading = $('#ddHeading');
  let ddHideTimer = null;
  let ddActive = '';

  /* NOTE: the Shop All dropdown chrome (hover/open/close + chip clicks)
     is owned by js/shop-dropdown.js on non-shop pages. This page ships its
     own static markup, so we only (re)bind the parts that need the live
     catalog behind null-guards — never double-binding listeners.
     shop-dropdown.js stands down here via its #shopGrid guard. */

  // Build the category chips — curated order, no piece counts.
  // Uses the live catalog (admin edits included) — same source as the grid.
  const liveCatalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
  const navKeys = ['hand', 'necklaces', 'earrings', 'bracelets', 'hair', 'groom', 'brooches', 'diamond'];
  const categoryList = [{ key: '', label: 'All Jewellery', img: 'images/all-jewellery.jpg' }];
  for (const catKey of navKeys) {
    if (!CATEGORIES[catKey]) continue;
    categoryList.push({ key: catKey, label: CATEGORIES[catKey].label, img: CATEGORIES[catKey].img });
  }

  function renderCategoryChips() {
    if (!ddCategories) return;
    ddCategories.innerHTML = categoryList.map(c =>
      `<button type="button" class="dd-category${c.key === ddActive ? ' active' : ''}" data-cat="${c.key}">
        ${c.img ? `<img class="dc-badge" src="${c.img}" alt="${c.label}">` : '<span class="dc-badge dc-all">&#10022;</span>'}
        <span class="dc-label">${c.label}</span>
      </button>`).join('');
  }

  function renderProductList() {
    if (!ddList) return;
    const catalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
    const list = ddActive ? catalog.filter(p => (p.cat || []).includes(ddActive)) : catalog;
    ddList.innerHTML = list.length
      ? list.map(p => `<a class="dd-product" href="product.html?id=${p.id}">
          <img src="${p.img}" alt="${p.name}" loading="lazy">
          <span class="dp-cat">${catLabel(p)}</span>
          <span class="dp-name">${p.name}</span>
          <span class="dp-price">${money(p.price)}</span>
        </a>`).join('')
      : '<div class="dd-empty">Nothing here (yet).</div>';
    if (ddHeading) {
      const label = (ddActive && CATEGORIES[ddActive]) ? CATEGORIES[ddActive].label : 'All Jewellery';
      ddHeading.textContent = label;
    }
  }

  // — open on hover over the button + panel, close when the pointer leaves —
  function openDropdown() {
    clearTimeout(ddHideTimer);
    if (!shopDropdown) return;
    // Already open — stay put so the fade-in never restarts on navbar hover.
    if (!shopDropdown.hidden && shopDropdown.classList.contains('open')) return;
    renderCategoryChips();
    renderProductList();
    shopDropdown.hidden = false;
    void shopDropdown.offsetWidth;
    shopDropdown.classList.add('open');
    if (shopOverlay) shopOverlay.classList.add('show');
  }

  function closeDropdown() {
    clearTimeout(ddHideTimer);
    if (!shopDropdown || shopDropdown.hidden || !shopDropdown.classList.contains('open')) return;
    shopDropdown.classList.remove('open');
    if (shopOverlay) shopOverlay.classList.remove('show');
    ddHideTimer = setTimeout(() => { shopDropdown.hidden = true; }, 240);
  }

  function scheduleClose() {
    clearTimeout(ddHideTimer);
    ddHideTimer = setTimeout(closeDropdown, 220);
  }

  // Tap fallback for touch, close affordances, and hover previews.
  // Hover/open/close chrome is shared with shop-dropdown.js; guard
  // everything so a missing node can never throw on this page.
  if (navDrop && shopDropdown && ddCategories && ddList) {
  if (navDrop) {
    navDrop.addEventListener('mouseenter', openDropdown);
    navDrop.addEventListener('mouseleave', scheduleClose);
    navDrop.addEventListener('focusin', openDropdown);
    navDrop.addEventListener('focusout', scheduleClose);
  }

  // preview a category's products on hover — click navigates to the filtered shop page
  if (ddCategories) {
    ddCategories.addEventListener('mouseover', e => {
      const chip = e.target.closest('.dd-category');
      if (!chip || chip.dataset.cat === ddActive) return;
      ddActive = chip.dataset.cat;
      Array.prototype.forEach.call(ddCategories.children, c =>
        c.classList.toggle('active', c.dataset.cat === ddActive));
      renderProductList();
    });
    ddCategories.addEventListener('click', e => {
      const chip = e.target.closest('.dd-category');
      if (!chip) return;
      window.location.href = chip.dataset.cat ? 'shop.html?cat=' + chip.dataset.cat : 'shop.html';
    });
  }

  if (ddClose) ddClose.addEventListener('click', closeDropdown);
  if (shopOverlay) shopOverlay.addEventListener('click', closeDropdown);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

  // tap fallback for touch devices (desktop nav is hidden ≤1080px anyway)
  if (shopBtn && shopDropdown) {
    shopBtn.addEventListener('click', e => {
      if (window.matchMedia('(hover: none)').matches) {
        e.preventDefault();
        if (shopDropdown.hidden) openDropdown(); else closeDropdown();
      }
    });
  }
  } /* end dropdown guard */

  bannerCopy();
  buildFilters();
  const sel = $('#sortSel');
  if (sel) {
  sel.value = shopState.sort;
  sel.addEventListener('change', () => { shopState.sort = sel.value; renderShop(); });
  }
  $$('.filter-group [data-band]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    shopState.band = shopState.band === a.dataset.band ? null : a.dataset.band;
    renderShop();
  }));
  const chipsRow = $('#chipsRow');
  if (chipsRow) chipsRow.addEventListener('click', e => {
    const btn = e.target.closest('[data-clear]');
    if (!btn) return;
    if (btn.dataset.clear === 'band') { shopState.band = null; renderShop(); }
    else clearParam(btn.dataset.clear);
  });
  renderShop();
});
