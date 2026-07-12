// onb-probe5: Replay entry + completion persistence.
// Run: node scratch/onb-probe5.mjs
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

    // completion persists across reload
    const persist = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      _onbConfigStarted = false; _onbDone = false;
      skipWelcome(); render(); onbMaybeStartConfig();
      onbFinish();
      // simulate "reload": onbShouldRun should now be false and a re-entry must not re-show
      _onbConfigStarted = false;
      onbMaybeStartConfig();
      return { flag: localStorage.getItem('ff-onboarded'),
               cardHidden: document.getElementById('onb-intro-card').style.display === 'none' };
    });
    const replay = await page.evaluate(() => {
      onbReplay();
      return { cardShown: getComputedStyle(document.getElementById('onb-intro-card')).display !== 'none' };
    });
    const checks = [
      ['completion sets ff-onboarded', persist.flag === '1'],
      ['after completion, re-entry does not re-show', persist.cardHidden === true],
      ['onbReplay re-shows intro card', replay.cardShown === true],
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
