// C1 verification probe — control mode state + header toggle gating.
// Run: node scratch/cm-probe.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'feel-fader.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

(async () => {
  let browser;
  const pageErrors = [];
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      pipe: true,
    });

    const page = await browser.newPage();
    page.on('pageerror', err => pageErrors.push('pageerror: ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push('console.error: ' + msg.text());
    });

    console.log('Loading:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.evaluate(() => { skipWelcome(); render(); });

    const result = await page.evaluate(() => {
      const out = {};

      // Scenario 1: no HW present -> toggle visible
      _ffConnected = false; _serialPort = null;
      controlMode = false;
      refreshControlToggle();
      let btn = document.getElementById('ctrl-mode-toggle');
      out.s1_hidden = btn.hidden;                 // expect false (not hidden)
      out.s1_controlMode = controlMode;            // expect false

      // Scenario 2: HW connects (MIDI) -> toggle hidden, controlMode stays false
      _ffConnected = true;
      refreshControlToggle();
      btn = document.getElementById('ctrl-mode-toggle');
      out.s2_hidden = btn.hidden;                  // expect true
      out.s2_controlMode = controlMode;            // expect false

      // Scenario 3: control mode was on, HW connects -> auto-off
      _ffConnected = false; _serialPort = null;
      controlMode = false;
      refreshControlToggle();                      // back to no-HW state, toggle visible
      controlMode = true;                          // simulate control mode already on
      _ffConnected = true;                         // HW connects
      refreshControlToggle();
      out.s3_controlMode = controlMode;             // expect false (auto-off)
      out.s3_hidden = document.getElementById('ctrl-mode-toggle').hidden; // expect true

      // Scenario 4: toggleControlMode() while no HW turns it on (uses TEMP stub ensureControlOutput)
      _ffConnected = false; _serialPort = null;
      controlMode = false;
      refreshControlToggle();
      toggleControlMode();
      out.s4_controlMode = controlMode;             // expect true (stub ensureControlOutput returns true)
      out.s4_bodyClass = document.body.classList.contains('control-mode'); // expect true
      out.s4_btnOn = document.getElementById('ctrl-mode-toggle').classList.contains('on'); // expect true
      out.s4_btnText = document.getElementById('ctrl-mode-toggle').textContent;

      // Scenario 5: setControlMode(true) while HW present -> refused, toast shown, no throw
      _ffConnected = true; controlMode = false;
      setControlMode(true);
      out.s5_controlMode = controlMode;             // expect false (refused)

      // Reset to clean no-HW state
      _ffConnected = false; _serialPort = null; controlMode = false;
      refreshControlToggle();

      out.ensureControlOutputType = typeof ensureControlOutput;
      out.renderControlIndicatorType = typeof renderControlIndicator;

      return out;
    });

    console.log('\nResults:', JSON.stringify(result, null, 2));

    const checks = [
      ['s1: toggle visible w/o HW', result.s1_hidden === false],
      ['s1: controlMode off initially', result.s1_controlMode === false],
      ['s2: toggle hidden w/ HW', result.s2_hidden === true],
      ['s2: controlMode stays off', result.s2_controlMode === false],
      ['s3: auto-off when HW connects while control mode on', result.s3_controlMode === false],
      ['s3: toggle hidden after auto-off', result.s3_hidden === true],
      ['s4: toggle turns control mode on w/o HW', result.s4_controlMode === true],
      ['s4: body.control-mode class set', result.s4_bodyClass === true],
      ['s4: toggle button .on class set', result.s4_btnOn === true],
      ['s5: setControlMode(true) refused when HW present', result.s5_controlMode === false],
      ['stubs present', result.ensureControlOutputType === 'function' && result.renderControlIndicatorType === 'function'],
      ['no page errors', pageErrors.length === 0],
    ];

    console.log('\nChecks:');
    let allPass = true;
    for (const [name, pass] of checks) {
      console.log(' ', pass ? 'PASS' : 'FAIL', '-', name);
      if (!pass) allPass = false;
    }

    if (pageErrors.length) {
      console.log('\nPage errors:');
      pageErrors.forEach(e => console.log('  ' + e));
    }

    console.log('\n' + (allPass ? 'ALL PASS' : 'SOME FAILED'));
    process.exit(allPass ? 0 : 1);
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log(e.stack);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
