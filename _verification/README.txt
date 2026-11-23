Browser tests (Playwright) against a MOCK of the backend (not your real one).
  npm i playwright && npx playwright install chromium
  node mock.js ..          (mock API :10000 + the site on :5173; leave running)
  node e2e.js              (whole store: 78 checks)
  node settings-e2e.js     (settings page: 53 checks)
