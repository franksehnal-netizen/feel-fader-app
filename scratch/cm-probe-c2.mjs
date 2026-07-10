// C2 verification probe — control-mode MIDI output selection + persistence.
// Run: node scratch/cm-probe-c2.mjs
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

      // Scenario 1: single non-FeelFader output -> auto-select, no prompt
      localStorage.removeItem('ff-ctrl-out');
      midiAccess = { outputs: new Map([
        ['x', { id: 'x', name: 'loopMIDI Port', open: () => Promise.resolve(), send(){} }],
      ]) };
      out.s1_controlOutputsLen = controlOutputs().length;              // expect 1
      out.s1_ensure = ensureControlOutput();                            // expect true
      out.s1_lsValue = localStorage.getItem('ff-ctrl-out');             // expect 'x'
      const got1 = getControlOutput();
      out.s1_getControlOutputId = got1 && got1.id;                      // expect 'x'

      // Scenario 2: empty outputs -> ensureControlOutput false + no throw (toast fires)
      localStorage.removeItem('ff-ctrl-out');
      midiAccess = { outputs: new Map() };
      out.s2_ensure = ensureControlOutput();                            // expect false
      out.s2_lsValue = localStorage.getItem('ff-ctrl-out');             // expect null

      // Scenario 3: Feel Fader output present alongside loopMIDI -> excluded from controlOutputs
      midiAccess = { outputs: new Map([
        ['ff', { id: 'ff', name: 'Feel Fader', open: () => Promise.resolve(), send(){} }],
        ['y',  { id: 'y',  name: 'loopMIDI Port 2', open: () => Promise.resolve(), send(){} }],
      ]) };
      const outs3 = controlOutputs();
      out.s3_len = outs3.length;                                        // expect 1
      out.s3_names = outs3.map(o => o.name);                            // expect ['loopMIDI Port 2']

      // Scenario 4: getControlOutput returns null if stale localStorage id refers to a Feel Fader port
      localStorage.setItem('ff-ctrl-out', 'ff');
      out.s4_getControlOutput = getControlOutput();                     // expect null (excluded — isFeelFader guard)
      localStorage.removeItem('ff-ctrl-out');

      // Reset clean
      localStorage.removeItem('ff-ctrl-out');

      out.ensureControlOutputType = typeof ensureControlOutput;
      out.pickControlOutputType = typeof pickControlOutput;
      out.getControlOutputType = typeof getControlOutput;
      out.controlOutputsType = typeof controlOutputs;

      return out;
    });

    console.log('\nResults:', JSON.stringify(result, null, 2));

    const checks = [
      ['s1: controlOutputs() sees the single loopMIDI port', result.s1_controlOutputsLen === 1],
      ['s1: ensureControlOutput() auto-selects (true)', result.s1_ensure === true],
      ['s1: localStorage persisted chosen id', result.s1_lsValue === 'x'],
      ['s1: getControlOutput() returns that output', result.s1_getControlOutputId === 'x'],
      ['s2: ensureControlOutput() false when no outputs', result.s2_ensure === false],
      ['s2: no id persisted on failure', result.s2_lsValue === null],
      ['s3: controlOutputs() excludes Feel Fader port', result.s3_len === 1 && result.s3_names[0] === 'loopMIDI Port 2'],
      ['s4: getControlOutput() rejects stale Feel Fader id', result.s4_getControlOutput === null],
      ['functions present', result.ensureControlOutputType === 'function' && result.pickControlOutputType === 'function' && result.getControlOutputType === 'function' && result.controlOutputsType === 'function'],
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
