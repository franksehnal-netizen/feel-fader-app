// Regression probe: bank name / fader label length limits match what
// firmware actually persists (C9, functional-audit finding 2026-07-20).
// Before this fix, .bank-name-input had no maxlength at all and
// onBankRename() didn't clamp — firmware's META_NAME_MAX=24 silently
// truncated on the next round-trip with no warning. .fader-title-input
// claimed maxlength=32 while firmware's META_LABEL_MAX=12 silently
// truncated the same way. Both app-side limits now match ff_config.py.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const state = await p.evaluate(() => {
  onBankRename(0, 'A'.repeat(60));
  onFaderName(0, 'fader1', 'B'.repeat(60));
  const bankInput = document.querySelector('.bank-name-input:not(.fader-title-input)');
  const faderInput = document.querySelector('.fader-title-input');
  return {
    bankNameLen: cfg.banks[0].name.length,
    faderLabelLen: cfg.banks[0].fader1.label.length,
    bankInputMaxlength: bankInput?.getAttribute('maxlength'),
    faderInputMaxlength: faderInput?.getAttribute('maxlength'),
  };
});
P('bank name clamped to firmware META_NAME_MAX (24)', state.bankNameLen === 24, state.bankNameLen);
P('fader label clamped to firmware META_LABEL_MAX (12)', state.faderLabelLen === 12, state.faderLabelLen);
P('.bank-name-input has maxlength=24', state.bankInputMaxlength === '24', state.bankInputMaxlength);
P('.fader-title-input has maxlength=12 (not the old 32)', state.faderInputMaxlength === '12', state.faderInputMaxlength);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
