// C3 verification probe — on-screen faders send CC in control mode (rAF-throttled).
// Run: node scratch/cm-probe-c3.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'feel-fader.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

function raf2() {
  // wait two animation frames (flushControlSend runs on the next rAF after schedule)
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

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

    await page.evaluate(() => { skipWelcome(); render(); layoutFaders(); });

    // Install capturing stub output + enable control mode.
    await page.evaluate(() => {
      window.__cap = [];
      midiAccess = {
        outputs: new Map([
          ['x', { id: 'x', name: 'loopMIDI Port', open: () => Promise.resolve(), send: (a) => window.__cap.push(Array.from(a)) }],
        ]),
      };
      localStorage.setItem('ff-ctrl-out', 'x');
      controlMode = true;
      activeBank = 0;
    });

    // Scenario 1: rapid mF('l', ...) calls -> coalesced to ~1 CC per rAF frame,
    // last captured frame carries the final value.
    const s1 = await page.evaluate(async () => {
      window.__cap.length = 0;
      const tr = document.getElementById('track-l').getBoundingClientRect();
      const N = 20;
      for (let i = 0; i < N; i++) {
        // sweep clientY across the track so each call yields a different value
        const cy = tr.top + (tr.height * i) / (N - 1);
        mF('l', cy);
      }
      const before = window.__cap.length; // expect 0 (rAF hasn't fired yet — proves coalescing, not synchronous send)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = cfg.banks[activeBank];
      return {
        callsIssued: N,
        capturedBeforeFrame: before,
        capturedAfterFrame: window.__cap.length,
        lastFrame: window.__cap[window.__cap.length - 1],
        expectedCh: 0xB0 | (b.fader1.channel & 0x0F),
        expectedCc: b.fader1.cc & 0x7F,
        expectedVal: liveValues.f1 & 0x7F,
        liveValueF1: liveValues.f1,
      };
    });

    // Scenario 2: controlMode = false -> mF sends nothing.
    const s2 = await page.evaluate(async () => {
      window.__cap.length = 0;
      controlMode = false;
      const tr = document.getElementById('track-l').getBoundingClientRect();
      mF('l', tr.top + tr.height * 0.25);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { captured: window.__cap.length };
    });

    // Scenario 3: switching activeBank changes cc/channel sent.
    const s3 = await page.evaluate(async () => {
      controlMode = true;
      window.__cap.length = 0;
      activeBank = 1; // Bank 2: fader1 = {cc:12, channel:1}
      const tr = document.getElementById('track-l').getBoundingClientRect();
      mF('l', tr.top + tr.height * 0.6);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b1 = cfg.banks[1];
      const frame = window.__cap[window.__cap.length - 1];
      const result = {
        bank: 1,
        frame,
        expectedCh: 0xB0 | (b1.fader1.channel & 0x0F),
        expectedCc: b1.fader1.cc & 0x7F,
      };
      // switch back to bank 0 and confirm the sent byte changes again
      window.__cap.length = 0;
      activeBank = 0;
      mF('l', tr.top + tr.height * 0.6);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b0 = cfg.banks[0];
      result.bank0Frame = window.__cap[window.__cap.length - 1];
      result.expectedCh0 = 0xB0 | (b0.fader1.channel & 0x0F);
      result.expectedCc0 = b0.fader1.cc & 0x7F;
      return result;
    });

    // Scenario 4: value-persist behavior unchanged — liveValues.f1 stays at the
    // released value regardless of control mode (mF's existing snap-free behavior).
    const s4 = await page.evaluate(() => {
      const tr = document.getElementById('track-l').getBoundingClientRect();
      controlMode = false;
      mF('l', tr.top + tr.height * 0.1);
      const v1 = liveValues.f1;
      controlMode = true;
      mF('l', tr.top + tr.height * 0.9);
      const v2 = liveValues.f1;
      return { v1, v2, changed: v1 !== v2 };
    });

    const result = { s1, s2, s3, s4 };
    console.log('\nResults:', JSON.stringify(result, null, 2));

    const checks = [
      ['s1: rAF not yet fired right after synchronous mF calls -> 0 captured', s1.capturedBeforeFrame === 0],
      ['s1: coalesced to exactly 1 CC after rAF flush (not one per mF call)', s1.capturedAfterFrame === 1],
      ['s1: last frame status byte = 0xB0|channel from active bank', Array.isArray(s1.lastFrame) && s1.lastFrame[0] === s1.expectedCh],
      ['s1: last frame cc = bank.fader1.cc', Array.isArray(s1.lastFrame) && s1.lastFrame[1] === s1.expectedCc],
      ['s1: last frame value = liveValues.f1 (masked)', Array.isArray(s1.lastFrame) && s1.lastFrame[2] === s1.expectedVal],
      ['s2: controlMode=false -> mF sends nothing', s2.captured === 0],
      ['s3: bank switch changes channel/cc sent (bank1)', Array.isArray(s3.frame) && s3.frame[0] === s3.expectedCh && s3.frame[1] === s3.expectedCc],
      ['s3: switching back to bank0 changes it again', Array.isArray(s3.bank0Frame) && s3.bank0Frame[0] === s3.expectedCh0 && s3.bank0Frame[1] === s3.expectedCc0],
      ['s4: value persists where released regardless of control mode', s4.changed === true],
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
