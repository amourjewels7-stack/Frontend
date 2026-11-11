Browser test for the storefront <-> backend integration.
  1. npm i playwright && npx playwright install chromium
  2. node mock.js ..            (mock API on :10000, serves the site on :5173)
  3. node e2e.js                (78 checks)
The mock mirrors the real controllers' contracts; it is NOT your backend. Use it to re-check the storefront after edits.
