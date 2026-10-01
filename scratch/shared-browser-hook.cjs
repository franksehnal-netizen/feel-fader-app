// Loaded into every probe process by run-all-probes.mjs. The runner owns one
// browser process; every probe gets a fresh incognito context so cookies,
// storage, pages and permissions remain isolated like a fresh launch.
//
// puppeteer-core is ESM-only: require() returns its read-only module
// namespace, so assigning puppeteer.launch fails silently. That is how every
// probe ended up starting its own full Chrome (one failed Windows logon each,
// account lockout – AE-FB-20261001-01). Instead, hand probes a copy of the
// module whose launch() connects to the runner's browser.
const Module = require('module');
const puppeteer = require('puppeteer-core');

const endpoint = process.env.FF_SHARED_BROWSER_WS;
if (endpoint) {
  async function connectToSharedBrowser() {
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
  }

  const shared = { ...puppeteer, launch: connectToSharedBrowser };
  const load = Module._load;
  // Matches 'puppeteer-core' and absolute paths to node_modules/puppeteer-core.
  const isPuppeteer = /(^|[\\/])puppeteer-core[\\/]?$/;
  Module._load = function loadWithSharedBrowser(request, ...rest) {
    return isPuppeteer.test(request) ? shared : load.call(this, request, ...rest);
  };
}
