// onb-probe4: Phase 2 — no-HW decorative demo + display-only invariant.
// Run: node scratch/onb-probe4.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'feel-fader.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

(async () => {
  let browser; const pageErrors = [];
  try {
    browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', pipe: true });
    const page = await browser.newPage();
    page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console.error: ' + m.text()); });
    // Headless Chrome reports prefers-reduced-motion:reduce by default, which would
    // make onbDemoStart() take the badge-only (no interval) branch and the "moves a
    // fader thumb" check would fail for every run regardless of implementation.
    // Force no-preference so this probe exercises the actual motion path.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    const run = await page.evaluate(async () => {
      localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      _onbConfigStarted = false; _onbDone = false;
      const badgeShown = () => { const b = document.getElementById('onb-demo-badge'); return b && getComputedStyle(b).display !== 'none'; };
      const badge0 = badgeShown();
      skipWelcome(); render(); onbMaybeStartConfig();
      // pF() moves thumbs via a CSS transform (translate3d), not `top` — read the
      // property it actually mutates.
      const before = document.getElementById('thumb-l')?.style.transform;
      await new Promise(r => setTimeout(r, 900));
      const after = document.getElementById('thumb-l')?.style.transform;
      // INVARIANT: the demo tick must never reach a MIDI output — assert its source
      // contains no send() call (display-only). This inspects the real function body,
      // so it fails loudly if a future edit wires MIDI into the decorative animation.
      const noSend = !/\bsend\s*\(/.test(onbDemoTick.toString());
      onbDemoStop();
      const badgeAfterStop = badgeShown();
      return { badge0, moved: before !== after, badgeAfterStop, noSend };
    });
    const checks = [
      ['no demo badge before start', run.badge0 === false],
      ['no-HW demo moves a fader thumb', run.moved === true],
      ['onbDemoStop hides badge', run.badgeAfterStop === false],
      ['INVARIANT: onbDemoTick source contains no send() call', run.noSend === true],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
    let ok = true; console.log('\nChecks:');
    for (const [n, p] of checks) { console.log(' ', p ? 'PASS' : 'FAIL', '-', n); if (!p) ok = false; }
    pageErrors.forEach(e => console.log('  ' + e));
    console.log('\n' + (ok ? 'ALL PASS' : 'SOME FAILED'));
    process.exit(ok ? 0 : 1);
  } catch (e) { console.log('ERROR:', e.message, e.stack); process.exit(1); }
  finally { if (browser) await browser.close(); }
})();
