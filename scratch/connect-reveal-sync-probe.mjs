// Regression: after connectTransitionWelcome() runs, the live-status HUD and
// the Send-to-device button must become visible at (very nearly) the same
// moment. Before this fix: HUD's opacity transition started at T+1100ms
// (.28s), the button's reveal animation started at T+1450ms (.6s) — a 350ms
// gap plus a longer total animation, so the button visibly lagged.
// TODO #3 explicitly overrides an earlier decision (2026-07-21 code comment)
// to keep them as separate beats — confirmed by Frank 2026-08-10.
// Spec: 2026-08-10-todo-batch-design.md §5.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const timings = await p.evaluate(() => new Promise(resolve => {
  showWelcome();
  const strip = document.getElementById('live-strip');
  const btn = document.getElementById('send-btn');
  let stripVisibleAt = null, btnVisibleAt = null;
  const t0 = performance.now();
  const poll = setInterval(() => {
    if (stripVisibleAt === null && strip.classList.contains('is-contextual-visible') && getComputedStyle(strip).opacity === '1') {
      stripVisibleAt = performance.now() - t0;
    }
    if (btnVisibleAt === null && parseFloat(getComputedStyle(btn).opacity) >= 0.99) {
      btnVisibleAt = performance.now() - t0;
    }
    if (stripVisibleAt !== null && btnVisibleAt !== null) { clearInterval(poll); resolve({ stripVisibleAt, btnVisibleAt }); }
  }, 20);
  setTimeout(() => { clearInterval(poll); resolve({ stripVisibleAt, btnVisibleAt }); }, 3000);
  connectTransitionWelcome();
}));

P('both HUD and Send button became visible within 3s', timings.stripVisibleAt !== null && timings.btnVisibleAt !== null, JSON.stringify(timings));
if (timings.stripVisibleAt !== null && timings.btnVisibleAt !== null) {
  const gap = Math.abs(timings.btnVisibleAt - timings.stripVisibleAt);
  P('HUD and Send button reveal within 150ms of each other', gap < 150, `gap=${gap.toFixed(0)}ms strip=${timings.stripVisibleAt.toFixed(0)}ms btn=${timings.btnVisibleAt.toFixed(0)}ms`);
}

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
