// P6 Deploy hygiene — targets the LIVE public demo (GitHub Pages), not localhost.
// Standalone script, NOT registered in scratch/audit/run-audit-probes.mjs on purpose:
// it needs a real internet connection, so adding it there would make the offline
// audit runner flaky (see task-8 report for the reasoning). Run directly:
//   node scratch/audit/p6-deploy-hygiene.mjs
//
// Demo facts (from memory reference_feelfader_demo_deploy):
//   Host: franksehnal-netizen.github.io
//   Base path: /feel-fader-demo/
//   Served entry point: index.html at the root of that path (NOT feel-fader.html —
//   the demo repo is a snapshot copy of feel-fader.html renamed to index.html).
const HOST = 'franksehnal-netizen.github.io';
const BASE = `https://${HOST}/feel-fader-demo`;
const MAIN_URL = `${BASE}/`; // GitHub Pages serves index.html at the directory root

const P = (l, ok, x = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${x ? '  — ' + x : ''}`);

const main = await fetch(MAIN_URL);
const h = main.headers;
console.log('MAIN URL: ' + MAIN_URL);
console.log('STATUS: ' + main.status);
console.log('HEADERS: ' + JSON.stringify(Object.fromEntries(h.entries()), null, 2));

P('HTTPS + 200 na hlavní stránce', main.ok && MAIN_URL.startsWith('https://'), String(main.status));
P('X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff', h.get('x-content-type-options') || 'chybí');
P('má nějaké Referrer-Policy', !!h.get('referrer-policy'), h.get('referrer-policy') || 'chybí');
P('má Content-Security-Policy HTTP header', !!h.get('content-security-policy'), h.get('content-security-policy') || 'chybí (GH Pages neumožňuje custom response headers — očekávané, viz report)');

const body = await main.text();
P('žádné zjevné secrets v served HTML', !/(api[_-]?key|secret|token|-----BEGIN)/i.test(body), 'grep hit — prověřit ručně');
P('má <meta http-equiv="Content-Security-Policy"> tag v HTML', /<meta[^>]+http-equiv=["']content-security-policy["']/i.test(body), 'chybí meta CSP tag (jediný mechanismus dostupný na GH Pages)');

const sensitivePaths = ['/.git/config', '/.superpowers/', '/scratch/', '/docs/', '/package.json', '/node_modules/'];
for (const path of sensitivePaths) {
  const url = BASE + path;
  let status = 'neterr';
  let ok = false;
  try {
    const r = await fetch(url);
    status = r.status;
    ok = r.ok;
  } catch (e) {
    status = 'fetch-error: ' + e.message;
    ok = false;
  }
  P(`citlivá cesta ${path} nedostupná (non-2xx/error)`, !ok, 'status ' + status);
}
