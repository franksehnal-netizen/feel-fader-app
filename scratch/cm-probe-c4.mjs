// C4 verification probe — CONTROL MODE indicator + active-fader styling.
// Run: node scratch/cm-probe-c4.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'feel-fader.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

async function setupAndEnable(page) {
  await page.evaluate(() => { skipWelcome(); render(); layoutFaders(); });
  return page.evaluate(() => {
    midiAccess = {
      outputs: new Map([
        ['x', { id: 'x', name: 'loopMIDI Port', open: () => Promise.resolve(), send() {} }],
      ]),
    };
    localStorage.setItem('ff-ctrl-out', 'x');
    controlMode = true;
    document.body.classList.add('control-mode');
    renderControlIndicator();
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
    await page.setViewport({ width: 480, height: 900 });
    page.on('pageerror', err => pageErrors.push('pageerror: ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push('console.error: ' + msg.text());
    });

    console.log('Loading:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    await setupAndEnable(page);

    // Scenario 1: indicator visible, text contains CONTROL MODE + port name,
    // body.control-mode present.
    const s1 = await page.evaluate(() => {
      const el = document.getElementById('control-indicator');
      const style = el ? getComputedStyle(el) : null;
      return {
        exists: !!el,
        hiddenAttr: el ? el.hidden : null,
        display: style ? style.display : null,
        text: el ? el.textContent : null,
        bodyHasClass: document.body.classList.contains('control-mode'),
      };
    });

    // Light screenshot (control mode ON).
    await page.screenshot({ path: path.resolve(__dirname, 'c4-light-on.png') });

    // Dark screenshot (control mode ON).
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: path.resolve(__dirname, 'c4-dark-on.png') });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    // Scenario 2: controlMode = false -> indicator hides.
    const s2 = await page.evaluate(() => {
      controlMode = false;
      document.body.classList.remove('control-mode');
      renderControlIndicator();
      const el = document.getElementById('control-indicator');
      const style = el ? getComputedStyle(el) : null;
      return {
        hiddenAttr: el ? el.hidden : null,
        display: style ? style.display : null,
        bodyHasClass: document.body.classList.contains('control-mode'),
      };
    });

    await page.screenshot({ path: path.resolve(__dirname, 'c4-off.png') });

    const result = { s1, s2 };
    console.log('\nResults:', JSON.stringify(result, null, 2));

    const checks = [
      ['indicator element exists', s1.exists === true],
      ['indicator visible (hidden=false, display!=none) when controlMode on', s1.hiddenAttr === false && s1.display !== 'none'],
      ['indicator text contains "CONTROL MODE"', typeof s1.text === 'string' && s1.text.includes('CONTROL MODE')],
      ['indicator text contains port name "loopMIDI Port"', typeof s1.text === 'string' && s1.text.includes('loopMIDI Port')],
      ['body.control-mode present when on', s1.bodyHasClass === true],
      ['indicator hidden when controlMode off', s2.hiddenAttr === true && s2.display === 'none'],
      ['body.control-mode removed when off', s2.bodyHasClass === false],
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

    console.log('\nScreenshots: c4-light-on.png, c4-dark-on.png, c4-off.png (in scratch/)');
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
