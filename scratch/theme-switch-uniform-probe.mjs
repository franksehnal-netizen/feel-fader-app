// Regression probe (Frank 2026-09-29): switching light/dark must move every
// surface at one tempo. With reduced motion (e.g. Windows "Animation effects"
// off) or without View Transitions the theme flips instantly – and the
// .ui-control buttons (theme toggle, bank tabs, pills) used to run their own
// .14s colour transition on top, lagging behind everything else. Neither path
// may start a CSS transition now.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const errs = [];

for (const motion of ['reduce', 'no-preference']) {
  const p = await b.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:motion }]);
  await p.evaluateOnNewDocument(() => { try { localStorage.removeItem('ff-dark'); } catch (_) {} });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
  await p.evaluate(() => skipWelcome());
  await new Promise(r => setTimeout(r, 1200));
  const r = await p.evaluate(() => new Promise(res => {
    const runs = [];
    const onRun = e => { if (e.target.closest?.('.ui-control, .bank-block-tab, .dark-toggle') && /color|background|border|shadow/.test(e.propertyName)) runs.push(`${e.target.className.split(' ')[0]}:${e.propertyName}`); };
    document.addEventListener('transitionrun', onRun, true);
    const tab = document.querySelector('.bank-block-tab');
    const before = getComputedStyle(tab).backgroundColor;
    toggleDark();
    setTimeout(() => {
      document.removeEventListener('transitionrun', onRun, true);
      res({ runs: [...new Set(runs)], dark: document.documentElement.classList.contains('dark'), before, after: getComputedStyle(tab).backgroundColor, snapshotLeft: document.documentElement.classList.contains('theme-snapshot') });
    }, 700);
  }));
  P(`${motion}: theme switched to dark`, r.dark && r.before !== r.after, JSON.stringify(r));
  P(`${motion}: no button runs its own colour transition during the switch`, r.runs.length === 0, r.runs.join(', '));
  P(`${motion}: .theme-snapshot is released afterwards`, !r.snapshotLeft);
  await p.close();
}

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
