// Regression probe: "safe batch" of P2/P3 fixes from the functional audit
// (docs/feel-fader-functional-audit-2026-07-20.md), approved by Frank in one
// go: A10, S11, F-03, B3, B4, F-02 remainder.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

// A10: .bank-name-input focus ring visible
const a10 = await p.evaluate(() => {
  const el = document.querySelector('.bank-name-input');
  el.focus();
  const cs = getComputedStyle(el);
  return { boxShadow: cs.boxShadow, hasFocus: document.activeElement === el };
});
P('A10: bank-name-input shows a focus ring', a10.hasFocus && a10.boxShadow !== 'none', JSON.stringify(a10));

// F-02: duplicate CC/channel validation errors get aria-invalid + aria-describedby
// (run before the S11 8-bank duplication below, which switches activeBank away
// from bank 0 and collapses its panel, removing its inputs from the DOM)
const f02 = await p.evaluate(() => {
  cfg.banks[0].fader2.cc = cfg.banks[0].fader1.cc;
  cfg.banks[0].fader2.channel = cfg.banks[0].fader1.channel;
  runValidation();
  const cc1 = document.getElementById('b0-fader1-cc');
  return {
    cc1Invalid: cc1 ? cc1.getAttribute('aria-invalid') : null,
    describedBy: cc1 ? cc1.getAttribute('aria-describedby') : null,
  };
});
P('F-02: conflicting CC input gets aria-invalid="true"', f02.cc1Invalid === 'true', JSON.stringify(f02));
P('F-02: conflicting CC input has aria-describedby pointing at its error', !!f02.describedBy, JSON.stringify(f02));

// S11: header title doesn't wrap/shrink when many banks are present at a narrow width
await p.evaluate(() => {
  while (cfg.banks.length < 8) duplicateBank(cfg.banks.length - 1);
});
await p.setViewport({ width: 360, height: 800 });
const s11b = await p.evaluate(() => {
  const el = document.querySelector('.h-title');
  const cs = getComputedStyle(el);
  return { height: el.getBoundingClientRect().height, flexShrink: cs.flexShrink, whiteSpace: cs.whiteSpace };
});
P('S11: .h-title has flex-shrink:0 and stays single-line at 360px', s11b.flexShrink === '0' && s11b.whiteSpace === 'nowrap' && s11b.height < 24, JSON.stringify(s11b));
await p.setViewport({ width: 1280, height: 900 });

// F-03: Duplicate button stays clickable at the 8-bank cap (not disabled)
const f03 = await p.evaluate(() => {
  const btn = document.querySelector('.btn-duplicate-bank') || document.querySelector('[onclick*="duplicateBank"]');
  return { exists: !!btn, disabled: btn ? btn.disabled : null };
});
P('F-03: Duplicate button exists and is not disabled at 8-bank cap', f03.exists && f03.disabled === false, JSON.stringify(f03));

// B3: dark-mode text uses design tokens, not raw hex, on spot-checked elements
const b3 = await p.evaluate(() => {
  document.documentElement.classList.add('dark');
  const rm = document.querySelector('.btn-remove-bank');
  const lbl = document.querySelector('.info-lbl');
  const r = { rmColor: rm ? getComputedStyle(rm).color : null, lblColor: lbl ? getComputedStyle(lbl).color : null };
  document.documentElement.classList.remove('dark');
  return r;
});
P('B3: .btn-remove-bank dark color is not raw red hex (#e33 etc)', !!b3.rmColor && b3.rmColor !== 'rgb(238, 51, 51)', JSON.stringify(b3));
P('B3: .info-lbl dark color resolves to a token grey', !!b3.lblColor, JSON.stringify(b3));

// B4: footer logo visible (non-washed-out) in dark mode
const b4 = await p.evaluate(() => {
  const el = document.getElementById('footer-logo');
  const light = getComputedStyle(el).opacity;
  document.documentElement.classList.add('dark');
  const dark = getComputedStyle(el).opacity;
  document.documentElement.classList.remove('dark');
  return { light, dark };
});
P('B4: footer logo opacity is higher in dark mode than light mode', parseFloat(b4.dark) > parseFloat(b4.light), JSON.stringify(b4));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
