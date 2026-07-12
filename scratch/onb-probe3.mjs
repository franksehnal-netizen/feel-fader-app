// onb-probe3: Phase 2 — intro card, help anchors, pulses, branching.
// Run: node scratch/onb-probe3.mjs
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

    // --- no-HW branch ---
    const nohw = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      _onbConfigStarted = false; _onbDone = false;
      skipWelcome(); render(); onbMaybeStartConfig();
      const card = document.getElementById('onb-intro-card');
      return {
        cardShown: !!card && getComputedStyle(card).display !== 'none',
        copy: card ? card.textContent : '',
        pulses: document.querySelectorAll('.onb-pulse').length,
        anchors: ['bank','fader','roller'].map(k => !!document.querySelector(`[data-onb="${k}"]`)),
        helpBanks: !!document.getElementById('help-banks'),
        helpFaders: !!document.getElementById('help-faders'),
      };
    });
    // clicking a pulse expands help + clears that pulse
    const afterClick = await page.evaluate(() => {
      const a = document.querySelector('[data-onb="roller"]'); a && a.click();
      return { helpOpen: document.getElementById('help-body').style.display !== 'none',
               pulseCleared: !a.classList.contains('onb-pulse') };
    });
    // --- HW branch: no demo, HW copy ---
    const hw = await page.evaluate(() => {
      onbFinish(); localStorage.removeItem('ff-onboarded');
      _ffConnected = true; _serialPort = {}; _midiState = 'granted';
      _onbConfigStarted = false; _onbDone = false;
      onbMaybeStartConfig();
      const card = document.getElementById('onb-intro-card');
      return { hwCopy: card ? card.textContent.includes('connected') : false,
               demoBadgeShown: (function(){ const b = document.getElementById('onb-demo-badge'); return !!b && getComputedStyle(b).display !== 'none'; })() };
    });
    const checks = [
      ['no-HW: intro card shown', nohw.cardShown === true],
      ['no-HW: card uses no-device copy', nohw.copy.includes('live demo')],
      ['3 pulse anchors present', nohw.anchors.every(Boolean)],
      ['pulses applied (3)', nohw.pulses === 3],
      ['help sections help-banks + help-faders exist', nohw.helpBanks && nohw.helpFaders],
      ['click pulse opens help', afterClick.helpOpen === true],
      ['click pulse clears its pulse', afterClick.pulseCleared === true],
      ['HW: card uses connected copy', hw.hwCopy === true],
      ['HW: demo badge hidden (display:none)', hw.demoBadgeShown === false],
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
