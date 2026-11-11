# Amour Jewels storefront ↔ live backend — integration guide

This folder is your storefront (`AmourJewels-front`) wired to the backend in `backend-currently-live.zip`.
Theme, fonts, layout and page structure are unchanged. **Copy these files over your site folder and keep your `images/` folder as it is.**

---

## 1. Do these in order

### Step 1 — Put the catalogue in the backend
The storefront no longer has products in code; it reads them from `GET /api/products`.
`catalogue-seed.json` holds your 20 products in the backend's format (slugs, categories, sizes, details are stored in each product's `attributes`).

1. Sign in to the admin panel and copy its session token (browser dev tools → Application → Session Storage on the admin site). Until the panel supports the new 2FA login (see issue 4 below), you can also use any admin JWT issued by the backend.
2. Import (the endpoint accepts up to 500 products):
   ```
   curl -X POST https://api.amourjewels.in/api/admin/products/bulk-import \
     -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
     --data @catalogue-seed.json
   ```
3. **Open each product in the admin panel and set real stock.** The seed uses `10` as a placeholder because the old site had no stock data. Product image links point to `https://amourjewels.in/images/...`, so your `images/` folder must be deployed there.

Imports are upserts by SKU, so running it twice is safe.

### Step 2 — Backend environment (Render / your host)
| Variable | Production value |
|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://amourjewels.in,https://www.amourjewels.in,https://admin.amourjewels.in` — the `.env` in the zip only allows `http://localhost:5173`, so **every storefront request would be blocked** |
| `APP_COOKIE_SECURE` | `true` (the zip's `.env` has `false`, which is for local http only) |
| `APP_COOKIE_SAMESITE` | leave `Lax` while the site is on `amourjewels.in` and the API on `api.amourjewels.in` (same site). If the site is ever hosted on another domain (e.g. `*.vercel.app`) you need `None` |
| `RAZORPAY_KEY_ID / SECRET` | currently **test** keys (`rzp_test_…`). Switch to live keys when you go live |
| `GOOGLE_CLIENT_ID` | already set; it is also in `js/api.js`. In Google Cloud Console add your site origins under *Authorised JavaScript origins* |

### Step 3 — Razorpay webhook
Payment is confirmed **only** by the webhook (the browser cannot mark an order paid). In the Razorpay dashboard point the webhook to `https://api.amourjewels.in/api/webhooks/razorpay` with the secret from your env.

### Step 4 — Test with a test payment
Place one order with a Razorpay test card, confirm: order appears in *Your Orders*, in the admin panel as *Paid*, invoice PDF opens, stock dropped.

---

## 2. What changed

**New:** `js/api.js` — the one place that knows the API address and session handling.
API address: `localhost` → `http://localhost:10000`, anywhere else → `https://api.amourjewels.in` (override with `window.AMOUR_API_BASE`).

| Area | Before | Now |
|---|---|---|
| Products | static array in `products.js` | loaded from `/api/products`, cached 60 s; categories/nav labels unchanged |
| Sign-in | fake (any 10 digits worked; the OTP was printed on screen) | real: e-mail + password, phone OTP by SMS, Google — HttpOnly cookie session, silent refresh |
| Register | no name field | **Full name** added (backend requires it) |
| Bag | browser only | guests: browser; signed-in: server bag (`/api/cart`), guest items merge in at sign-in |
| Checkout | simulated (`setTimeout`, wrote to localStorage) | real: server prices the order → Razorpay window → page waits for the webhook → success |
| Coupons | hard-coded codes | validated by the server |
| Orders / track | invented demo orders | real orders, real tracking timeline, real AWB |
| Invoice | computed in the browser | the backend's PDF (only the owner can open it) |
| Returns | local form | `POST /api/returns` |
| Reviews | static stars/counts | real reviews on the product page; stars/`aggregateRating` shown only when real reviews exist |
| Contact / newsletter | no-op | `POST /api/messages`, `POST /api/newsletter` |
| Pincode | local table | `GET /api/pincode/{pin}` |
| Shipping copy | ₹3,500 free / ₹99 / ₹249 express | matches the backend: **free from ₹2,000, otherwise ₹100**, no express |

**Removed because the backend cannot honour them:** GSTIN field, WhatsApp-updates checkbox, express shipping, payment-method radios (Razorpay handles it), cancel-order button, exchange flow, on-site gift-card purchase (the page now orders by WhatsApp), the public "Admin" footer link (22 pages), demo order IDs, the invented star ratings/review counts.

**Fixed along the way:** garbled characters (`â€”`) in `checkout.html`, `shop.html`, `js/shop.js`; unknown product URLs used to silently show product #1 (now "not found").

### Product attributes the storefront understands
Set in the admin panel's product form under *Details* (one `name: value` per line), or in the seed:
`slug` (URL id) · `cats` (e.g. `rings, bridal`) · `collection` (`new`, `bridal`, …) · `tag` · `sizes` (`6, 7, 8, 9`) · `details` (`point one | point two`). The admin "Featured" switch = the *Bestseller* rail on the home page.

### Sizes
The backend keeps **one line per product** in the bag, so a piece has one size per order. The size travels in the line title (`Aaroha Halo Solitaire Ring (Size 7)`) and shows on the order and invoice. Choosing a different size for a piece already in the bag replaces the size.

---

## 3. Issues found in the backend (not changed — your call)

**Fix before launch**
1. **Real secrets are in the zips** (`backend/.env` in both uploads). Rotate the Mongo, Redis, Razorpay, JWT, Resend and SMS keys, and never zip `.env`.
2. **Admin login OTP is printed to the server log** (`System.out.println` in `AdminAuthController`).
3. **Admin 2FA code has no attempt limit** (a 6-digit code can be brute-forced inside its 5 minutes), and the login lockout key includes `X-Forwarded-For`, which a client can change to dodge the lockout.
4. **The live admin panel cannot sign in to this backend yet**: `/login` now returns `twoFactorRequired` and `/verify-2fa` returns only `{token}` (no name/roles). The panel needs the OTP screen and a `GET /api/admin/auth/me` call.
5. `SecurityConfig` allows `/resend-2fa`, `/forgot-password`, `/reset-password`, `/accept-invite`, **but those endpoints don't exist** yet.
6. **Product rating summary always returns 0** (it aggregates collection `product_reviews`, reviews live in `reviews`). The storefront works around it by averaging the review list.
7. **SMS OTP failures are swallowed**: the API says "OTP sent" even when Fast2SMS rejects it. The storefront sends plain 10-digit numbers, which is what Fast2SMS expects.
8. `CartService` stores the **client-supplied `title`/`sku`/`imageUrl`** (price is re-read from the database). These flow into orders, e-mails and invoices; take them from the product instead.

**Business decisions**
9. **Policy vs system**: `returns-exchange.html` says refunds are *store credit only* and damage claims within 48 hours; the backend refunds to the original payment via Razorpay and allows 7 days. The storefront text now says only what the system does ("returns within 7 days of delivery"); please align the policy pages.
10. **Invoice**: GST is computed as `total × 3%` and the seller GSTIN is `23AABCA1234D1Z5` (placeholder-looking; the storefront config has a different one). Have your CA review the PDF before real sales.
11. Phone-only accounts get `customerEmail = phone number`, so order e-mails can't reach them (guest tracking by e-mail also doesn't apply). Consider asking for an e-mail at checkout.
12. Not in the backend (so not in the storefront): gift-card purchase, customer-side cancel, exchanges, order search for admins, newsletter storage (it returns OK but saves nothing), `StoreSettings` (nothing reads it), analytics events (nothing writes them).

---

## 4. How this was verified
A browser test (`_verification/`, Playwright) drives the real storefront files against a mock of your API written from your controllers' actual contracts: catalogue and filters, guest bag, registration and cart merge, token expiry with silent refresh, quantity changes, coupon, checkout with simulated Razorpay and a delayed webhook, orders, tracking, return, review, invoice, phone OTP, contact, newsletter, sold-out, and "backend down". **78 checks pass.**

Not tested here: your real database, real Razorpay / Google / SMS, and your images (not included in the upload). Do Step 4 above on your staging site.
