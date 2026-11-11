/* ============================================================
   AMOUR JEWELS — Product catalogue (loaded from the backend)
   ============================================================ */

const IMG = (id, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const CATEGORIES = {
  hand:      { label: 'Hand Accessories', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80' },
  necklaces: { label: 'Necklaces | Chokers', img: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=900&q=80' },
  earrings:  { label: 'Earrings', img: 'https://images.unsplash.com/photo-1601821765780-754fa98637c1?auto=format&fit=crop&w=900&q=80' },
  bracelets: { label: 'Bangles | Kadas', img: 'https://images.unsplash.com/photo-1608042314453-ae338d80c427?auto=format&fit=crop&w=900&q=80' },
  hair:      { label: 'Hair Accessories', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80' },
  groom:     { label: "Groom's Jewellery", img: 'https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?auto=format&fit=crop&w=900&q=80' },
  brooches:  { label: 'Brooches & Kalangi', img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80' },
  rings:     { label: 'Rings', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80' },
  pearls:    { label: 'Pearls', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80' },
  diamond:   { label: 'Diamond Jewellery', img: 'images/cat-diamond.jpg' },
  everyday:  { label: 'Everyday Gold', img: 'https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?auto=format&fit=crop&w=900&q=80' }
};

/* Curated order for the Shop All dropdown — new labels first, no counts shown */
const NAV_CATEGORIES = ['hand', 'necklaces', 'earrings', 'bracelets', 'hair', 'groom', 'brooches', 'diamond'];


/* ============================================================
   CATALOGUE — GET /api/products   (public, served from Redis by the backend)
   PRODUCTS is filled IN PLACE once the request finishes, so every page that
   reads PRODUCTS / productById() keeps working unchanged. Pages wait for
   window.CATALOGUE_READY (see amourReady() in js/api.js) before they draw.

   How a backend Product becomes a storefront product:
     id (URL / wishlist key)  attributes.slug  (else made from the title)
     _id                      backend id — used for cart / orders / reviews
     name · desc              title · description
     price · mrp              price · compareAtPrice
     img · alt                imageUrls[0] · imageUrls[1]
     stock                    stockQuantity
     tag 'Bestseller'         attributes.tag, or the "Featured" switch in the admin panel
     cat · collection         attributes.cats / attributes.collection (else the category)
     sizes · details          attributes.sizes ("6, 7, 8, 9") · attributes.details ("a | b | c")
   Add these as "Details" lines in the admin panel's product form.
   ============================================================ */
const PRODUCTS = [];
let CATALOGUE_ERROR = null;
const CATALOGUE_CACHE_KEY = 'amour_catalogue_v1';
const CATALOGUE_TTL_MS = 60 * 1000;
const NO_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><rect width="4" height="5" fill="#eff6fa"/></svg>');

const slugify = s => String(s || '').toLowerCase().replace(/&amp;|&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const listOf = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
  : (typeof v === 'string' ? v.split(/[,|]/).map(x => x.trim()).filter(Boolean) : []);

/* "Necklaces", "Bangles | Kadas", "Diamonds" … → a CATEGORIES key; unknown names get their own entry */
function categoryKey(name, fallbackImg) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const keys = Object.keys(CATEGORIES);
  let hit = keys.find(k => k === n) ||
    keys.find(k => CATEGORIES[k].label.toLowerCase() === n) ||
    keys.find(k => n.startsWith(k) || k.startsWith(n.replace(/s$/, ''))) ||
    keys.find(k => CATEGORIES[k].label.toLowerCase().split(/[|,&]/).some(w => w.trim() === n));
  if (hit) return hit;
  hit = slugify(name);
  CATEGORIES[hit] = { label: String(name).trim(), img: fallbackImg || NO_IMAGE };
  return hit;
}

function adaptProduct(b) {
  const a = b.attributes || {};
  const imgs = (b.imageUrls || []).filter(Boolean);
  const main = imgs[0] || NO_IMAGE;
  let cats = listOf(a.cats).map(k => (CATEGORIES[k] ? k : categoryKey(k, main))).filter(Boolean);
  if (!cats.length) { const k = categoryKey(b.category, main); cats = k ? [k] : []; }
  const price = Number(b.price) || 0;
  const mrp = Number(b.compareAtPrice) > price ? Number(b.compareAtPrice) : price;
  const sizes = listOf(a.sizes).map(s => (/^\d+$/.test(s) ? Number(s) : s));
  return {
    id: String(a.slug || slugify(b.title) || b.id), _id: b.id, sku: b.sku || '',
    name: b.title || 'Untitled', cat: cats,
    collection: a.collection ? String(a.collection).toLowerCase() : 'core',
    price, mrp, tag: a.tag || (b.featured ? 'Bestseller' : null),
    rating: Number(a.rating) || 0, reviews: Number(a.reviews) || 0,
    img: main, alt: imgs[1] || main, desc: b.description || '',
    details: listOf(typeof a.details === 'string' && a.details.indexOf('|') < 0 ? [a.details] : (Array.isArray(a.details) ? a.details : String(a.details || '').split('|'))),
    sizes: sizes.length ? sizes : null,
    stock: Number.isFinite(+b.stockQuantity) ? +b.stockQuantity : 0, createdAt: b.createdAt || null
  };
}

function fillCatalogue(list) {
  const seen = {};
  const out = (list || []).filter(b => b && b.id && b.active !== false).map(adaptProduct).map(p => {
    if (seen[p.id]) p.id = p.id + '-' + String(p.sku || p._id).toLowerCase().replace(/[^a-z0-9]+/g, '');   /* keep ids unique */
    seen[p.id] = 1; return p;
  });
  PRODUCTS.length = 0;
  Array.prototype.push.apply(PRODUCTS, out);
}

async function loadCatalogue(force) {
  let raw = null;
  if (!force) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CATALOGUE_CACHE_KEY));
      if (c && Date.now() - c.at < CATALOGUE_TTL_MS) raw = c.data;
    } catch (e) { /* no cache */ }
  }
  try {
    if (!raw) {
      raw = await AmourAPI.products();
      try { sessionStorage.setItem(CATALOGUE_CACHE_KEY, JSON.stringify({ at: Date.now(), data: raw })); } catch (e) {}
    }
    fillCatalogue(raw);
    CATALOGUE_ERROR = null;
  } catch (e) {
    CATALOGUE_ERROR = e;
    console.error('Catalogue failed to load', e);
  }
}
window.CATALOGUE_READY = loadCatalogue();
