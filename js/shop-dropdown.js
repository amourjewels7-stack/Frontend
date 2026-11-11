/* AMOUR JEWELS - Shop All dropdown, shared across all pages.
   Hover SHOP ALL to browse the curated sub-categories (no counts).
   Every page now ships static dropdown markup; shop.html owns its
   behaviour in js/shop.js, so this stands down there (see the
   shopGrid guard). The auto-injection below is a legacy fallback
   kept for any page missing the markup. */

amourReady(() => {
  if (window.__shopDropdownInit) return;
  window.__shopDropdownInit = true;
  if (document.getElementById('shopGrid')) return;
  if (typeof PRODUCTS === 'undefined' || typeof CATEGORIES === 'undefined') return;

  let navDrop = document.getElementById('navDrop');
  if (!navDrop) {
    const cta = document.querySelector('.main-nav a.nav-cta');
    if (!cta) return;
    navDrop = document.createElement('span');
    navDrop.className = 'nav-drop';
    navDrop.id = 'navDrop';
    cta.replaceWith(navDrop);
    navDrop.appendChild(cta);
    if (!cta.id) cta.id = 'shopBtn';
  }

  let shopDropdown = document.getElementById('shopDropdown');
  if (!shopDropdown) {
    shopDropdown = document.createElement('div');
    shopDropdown.className = 'shop-dropdown';
    shopDropdown.id = 'shopDropdown';
    shopDropdown.hidden = true;
    shopDropdown.innerHTML =
      '<div class="dd-header"><h3 id="ddHeading">All Jewellery</h3>' +
      '<button class="dd-close" id="ddClose" aria-label="Close">x</button></div>' +
      '<div class="dd-categories" id="ddCategories"></div>' +
      '<div class="dd-list" id="ddList"></div>';
    navDrop.appendChild(shopDropdown);
  }

  let shopOverlay = document.getElementById('shopOverlay');
  if (!shopOverlay) {
    shopOverlay = document.createElement('div');
    shopOverlay.className = 'shop-overlay';
    shopOverlay.id = 'shopOverlay';
    document.body.appendChild(shopOverlay);
  }

  const shopBtn = document.getElementById('shopBtn');
  const ddCategories = document.getElementById('ddCategories');
  const ddList = document.getElementById('ddList');
  const ddClose = document.getElementById('ddClose');
  const ddHeading = document.getElementById('ddHeading');
  if (!ddCategories || !ddList) return;

  let ddHideTimer = null;
  let ddActive = '';
  const catalog = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
  const navKeys = ['hand', 'necklaces', 'earrings', 'bracelets', 'hair', 'groom', 'brooches', 'diamond'];
  const list = [{ key: '', label: 'All Jewellery', img: 'images/all-jewellery.jpg' }];
  for (const catKey of navKeys) {
    if (!CATEGORIES[catKey]) continue;
    list.push({ key: catKey, label: CATEGORIES[catKey].label, img: CATEGORIES[catKey].img || '' });
  }

  function renderChips() {
    ddCategories.innerHTML = list.map(c =>
      '<button type="button" class="dd-category' + (c.key === ddActive ? ' active' : '') + '" data-cat="' + c.key + '">' +
      (c.img ? '<img class="dc-badge" src="' + c.img + '" alt="' + c.label + '">' : '<span class="dc-badge dc-all">&#10022;</span>') +
      '<span class="dc-label">' + c.label + '</span></button>'
    ).join('');
  }

  function renderList() {
    const live = (typeof getCatalog === 'function') ? getCatalog() : PRODUCTS;
    const items = ddActive ? live.filter(p => (p.cat || []).indexOf(ddActive) !== -1) : live;
    let html = '';
    for (const p of items) {
      html += '<a class="dd-product" href="product.html?id=' + p.id + '">' +
        '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
        '<span class="dp-cat">' + catLabel(p) + '</span>' +
        '<span class="dp-name">' + p.name + '</span>' +
        '<span class="dp-price">' + money(p.price) + '</span></a>';
    }
    ddList.innerHTML = html || '<div class="dd-empty">Nothing here (yet).</div>';
    if (ddHeading) {
      const label = (ddActive && CATEGORIES[ddActive]) ? CATEGORIES[ddActive].label : 'All Jewellery';
      ddHeading.textContent = label;
    }
  }

  // Open once: while open, further mouseenter events are no-ops
  // so the fade-in never restarts (no re-animation on hover).
  function openDropdown() {
    clearTimeout(ddHideTimer);
    if (!shopDropdown.hidden && shopDropdown.classList.contains('open')) return;
    renderChips();
    renderList();
    shopDropdown.hidden = false;
    void shopDropdown.offsetWidth;
    shopDropdown.classList.add('open');
    shopOverlay.classList.add('show');
  }

  function closeDropdown() {
    clearTimeout(ddHideTimer);
    if (shopDropdown.hidden || !shopDropdown.classList.contains('open')) return;
    shopDropdown.classList.remove('open');
    shopOverlay.classList.remove('show');
    ddHideTimer = setTimeout(() => { shopDropdown.hidden = true; }, 240);
  }

  function scheduleClose() {
    clearTimeout(ddHideTimer);
    ddHideTimer = setTimeout(closeDropdown, 220);
  }

  navDrop.addEventListener('mouseenter', openDropdown);
  navDrop.addEventListener('mouseleave', scheduleClose);
  navDrop.addEventListener('focusin', openDropdown);
  navDrop.addEventListener('focusout', scheduleClose);

  ddCategories.addEventListener('mouseover', e => {
    const chip = e.target.closest ? e.target.closest('.dd-category') : null;
    if (!chip || chip.dataset.cat === ddActive) return;
    ddActive = chip.dataset.cat;
    Array.prototype.forEach.call(ddCategories.children, c =>
      c.classList.toggle('active', c.dataset.cat === ddActive));
    renderList();
  });
  ddCategories.addEventListener('click', e => {
    const chip = e.target.closest ? e.target.closest('.dd-category') : null;
    if (!chip) return;
    window.location.href = chip.dataset.cat ? 'shop.html?cat=' + chip.dataset.cat : 'shop.html';
  });

  if (ddClose) ddClose.addEventListener('click', closeDropdown);
  shopOverlay.addEventListener('click', closeDropdown);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

  if (shopBtn) {
    shopBtn.addEventListener('click', e => {
      if (window.matchMedia('(hover: none)').matches) {
        e.preventDefault();
        if (shopDropdown.hidden || !shopDropdown.classList.contains('open')) openDropdown();
        else closeDropdown();
      }
    });
  }
});
