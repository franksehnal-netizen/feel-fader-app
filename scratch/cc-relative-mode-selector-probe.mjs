// New 4th roller mode "Relative CC" (cc_relative): the segmented control
// must offer it, activate it, and lay out 4 equal columns without breaking
// the existing 3-column CSS math. Spec: feel-fader-firmware
// docs/superpowers/specs/2026-08-26-roller-cc-relative-design.md §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  activeBank = 0;
  render();
  setRollerMode(0, 'cc_relative');
  const btn = document.querySelector('[data-roller-mode="cc_relative"]');
  const row = document.querySelector('.bank-section-encoder .roller-mode-row');
  let cols = null;
  if (row) {
    const gtc = getComputedStyle(row).gridTemplateColumns;
    const match = gtc.match(/repeat\((\d+)/);
    cols = match ? parseInt(match[1]) : gtc.trim().split(/\s+/).length;
  }
  return {
    modeSet: cfg.banks[0].roller_mode,
    btnText: btn ? btn.textContent : null,
    btnActive: btn ? btn.classList.contains('active') : null,
    btnAriaPressed: btn ? btn.getAttribute('aria-pressed') : null,
    columns: cols,
  };
});

P('setRollerMode(0,"cc_relative") persists on the bank', r.modeSet === 'cc_relative', JSON.stringify(r));
P('a button for cc_relative exists and is labeled "Relative CC"', r.btnText === 'Relative CC', JSON.stringify(r));
P('the Relative CC button becomes active', r.btnActive === true, JSON.stringify(r));
P('the Relative CC button reports aria-pressed=true', r.btnAriaPressed === 'true', JSON.stringify(r));
P('the segmented control lays out 4 columns', r.columns === 4, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
