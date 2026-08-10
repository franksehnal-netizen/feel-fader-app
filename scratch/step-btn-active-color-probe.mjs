// Regression: .step-btn:active must not read red — a plain +/- tap isn't an
// error state (Frank, 2026-08-10 HW test: "Červená barva symbolu +/− při
// kliknutí působí jako chyba"). Parsed against the live stylesheet (not
// forced via a real held-down click, which CDP can't hold reliably across an
// evaluate() round-trip) so this fails honestly if the rule ever drifts back.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  const rules = [...document.styleSheets].flatMap(sheet => {
    try { return [...sheet.cssRules]; } catch (_) { return []; }
  });
  const find = (selectorText) => rules.find(r => r.selectorText === selectorText);
  const active = find('.step-btn:active');
  const activeClass = find('.step-btn.active, .step-btn.active:hover');
  return {
    activeColor: active ? active.style.color : null,
    activeBg: active ? active.style.background || active.style.backgroundColor : null,
    // .step-btn.active (a persistent toggled-state class, unrelated to this
    // fix) and .step-btn.capturing (key-record indicator) are meant to stay
    // red — only the transient :active mouse-press flash changes.
    toggledClassColorUnchanged: activeClass ? activeClass.style.color : null,
  };
});

P('.step-btn:active color is not var(--red)', r.activeColor !== 'var(--red)', r.activeColor);
P('.step-btn:active color is var(--green)', r.activeColor === 'var(--green)', r.activeColor);
P('.step-btn.active (toggled state) still reads #fff, untouched by this fix', r.toggledClassColorUnchanged === 'rgb(255, 255, 255)', r.toggledClassColorUnchanged);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
