// onb-probe1: foundation — onbShouldRun/onbFinish + ff-onboarded gate + i18n keys.
// Run: node scratch/onb-probe1.mjs
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
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    const r = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      const before = onbShouldRun();
      onbFinish();
      const after = onbShouldRun();
      return { before, after, flag: localStorage.getItem('ff-onboarded'),
               hasKey: typeof t === 'function' && t('onb.beat1.title') !== 'onb.beat1.title' };
    });

    const checks = [
      ['onbShouldRun() true when flag absent', r.before === true],
      ['onbFinish() sets ff-onboarded="1"', r.flag === '1'],
      ['onbShouldRun() false after finish', r.after === false],
      ['i18n key onb.beat1.title resolves', r.hasKey === true],
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
