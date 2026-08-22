// Loaded into every probe process by run-all-probes.mjs. The runner owns one
// Chrome process; every probe gets a fresh incognito context so cookies,
// storage, pages and permissions remain isolated like a fresh launch.
const puppeteer = require('puppeteer-core');

const endpoint = process.env.FF_SHARED_BROWSER_WS;
if (endpoint) {
  puppeteer.launch = async function connectToSharedBrowser() {
    const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    const context = await browser.createBrowserContext();

    Object.defineProperty(browser, 'newPage', {
      configurable: true,
      value: () => context.newPage(),
    });
    Object.defineProperty(browser, 'close', {
      configurable: true,
      value: async () => {
        try { await context.close(); } finally { browser.disconnect(); }
      },
    });
    return browser;
  };
}
