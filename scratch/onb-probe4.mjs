// onb-probe4: clean no-HW state, stable faders, and stable welcome CTA layout.
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
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    const run = await page.evaluate(async () => {
      localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      const badge0 = document.getElementById('onb-demo-badge');
      showWelcome(); onbStartWelcome();
      await new Promise(requestAnimationFrame);
      const ctaBeforeSkip = document.getElementById('send-btn')?.getBoundingClientRect().top;
      onbBeatGo(2, true);
      await new Promise(requestAnimationFrame);
      const ctaAfterSkip = document.getElementById('send-btn')?.getBoundingClientRect().top;
      skipWelcome(); render();
      const before = document.getElementById('thumb-l')?.style.transform;
      await new Promise(r => setTimeout(r, 900));
      const after = document.getElementById('thumb-l')?.style.transform;
      const demoCodeRemoved = typeof window.onbDemoStart === 'undefined' && typeof window.onbDemoStop === 'undefined';
      return { badge0, stable: before === after, demoCodeRemoved, ctaShift: Math.abs(ctaAfterSkip - ctaBeforeSkip) };
    });
    const checks = [
      ['demo badge is absent from the DOM', run.badge0 === null],
      ['no-HW demo keeps fader thumbs stable', run.stable === true],
      ['Final intro beat keeps the welcome CTA fixed', run.ctaShift < 0.5],
      ['obsolete demo badge code is removed', run.demoCodeRemoved === true],
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
