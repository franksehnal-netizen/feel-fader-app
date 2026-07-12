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
    // --- skip→connect: no-HW onboarding open, then a device connects mid-Phase-2 ---
    const skipConnect = await page.evaluate(() => {
      // no-HW onboarding open, then a device connects
      onbFinish(); localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      _onbConfigStarted = false; _onbDone = false;
      skipWelcome(); render(); onbMaybeStartConfig();      // no-HW copy + demo
      const before = document.getElementById('onb-intro-text').textContent;
      _ffConnected = true; _serialPort = {}; _midiState = 'granted';
      onbOnConnect();                                       // simulate connect
      const after = document.getElementById('onb-intro-text').textContent;
      const badge = document.getElementById('onb-demo-badge');
      return { flipped: before.toLowerCase().includes('live demo') && after.includes('connected'),
               badgeHidden: getComputedStyle(badge).display === 'none' };
    });
    const checks = [
      ['no-HW: intro card shown', nohw.cardShown === true],
      ['no-HW: card uses no-device copy', nohw.copy.toLowerCase().includes('live demo')],
      ['3 pulse anchors present (bank/fader/roller containers)', nohw.anchors.every(Boolean)],
      ['pulses applied (3)', nohw.pulses === 3],
      ['help sections help-banks + help-faders exist', nohw.helpBanks && nohw.helpFaders],
      ['HW: card uses connected copy', hw.hwCopy === true],
      ['HW: demo badge hidden (display:none)', hw.demoBadgeShown === false],
      ['skip→connect flips intro copy to HW', skipConnect.flipped === true],
      ['skip→connect hides demo badge', skipConnect.badgeHidden === true],
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
