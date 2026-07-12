// onb-probe2: Phase 1 — orientation beats on the welcome screen.
// Run: node scratch/onb-probe2.mjs
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

    await page.evaluate(() => { localStorage.removeItem('ff-onboarded'); showWelcome(); onbStartWelcome(); });
    await new Promise(r => setTimeout(r, 50));
    const beat0 = await page.evaluate(() => {
      const beats = document.getElementById('onb-beats');
      return { beatsVisible: beats && getComputedStyle(beats).display !== 'none',
               dots: document.querySelectorAll('#onb-beats .onb-dots span').length,
               ctaHidden: !document.getElementById('welcome-start').classList.contains('show') };
    });
    await new Promise(r => setTimeout(r, 3600));
    const at36 = await page.evaluate(() => ({
      startHidden: !document.getElementById('welcome-start').classList.contains('show'),
      onBeat0or1: !document.querySelector('#onb-beats .onb-dots span:last-child')?.classList.contains('on'),
    }));
    // advance to CTA
    await page.evaluate(() => { onbSkipIntro(); });
    // onbBeatGo() cross-fades text via a 180ms setTimeout (see feel-fader.html); wait past it
    // before reading textContent, otherwise we observe the pre-skip text.
    await new Promise(r => setTimeout(r, 220));
    const beat2 = await page.evaluate(() => ({
      title: document.querySelector('#onb-beats .onb-beat-title')?.textContent || ''
    }));
    // no-HW: skip reveals "Explore the demo" path; Start not forced
    const checks = [
      ['#onb-beats visible on first-run welcome', beat0.beatsVisible === true],
      ['3 step dots rendered', beat0.dots === 3],
      ['CTA (Start) hidden during beats', beat0.ctaHidden === true],
      ['fallback does not surface Start during beats (t=3.6s)', at36.startHidden === true],
      ['onbSkipIntro jumps to final beat (title = Connect or explore)', beat2.title.includes('Connect')],
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
