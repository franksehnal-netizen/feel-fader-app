// Regression: in the "no onboarding tips" welcome state (returning user,
// ff-onboarded already set), the heading must not sit flush against the
// action button with zero gap. Measured 2026-08-10: gap was exactly 0px.
// Spec: 2026-08-10-todo-batch-design.md §4.
//
// First-run state (final review 2026-08-17, welcome-heading-gap-probe fix):
// the original assertion here expected #send-btn BELOW #onb-beats, per the
// 2026-08-10 spec's stacking order. The mid-August onboarding redesign
// (wordmark/controller/notice top-to-bottom cascade, see docs/TODO.md
// 2026-08-17l onward) flipped that — the button now sits directly under the
// controller, with the tour copy below it (confirmed correct via screenshot,
// Frank 2026-08-18). Assertion updated to match; still guards against the
// two flush-against-each-other zero-gap regression this probe exists for.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const noTips = await p.evaluate(async () => {
  localStorage.setItem('ff-onboarded','1');
  showWelcome();
  await new Promise(r => setTimeout(r, 100));
  const w = document.getElementById('welcome-wordmark').getBoundingClientRect();
  const slot = document.getElementById('welcome-action-slot').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { gap: slot.top - w.bottom, btnTop: btn.top };
});
P('heading has a visible gap above the button in the no-tips state', noTips.gap >= 16, `gap=${noTips.gap}`);

const withTips = await p.evaluate(async () => {
  localStorage.removeItem('ff-onboarded');
  showWelcome();
  await new Promise(r => setTimeout(r, 100));
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  const beats = document.getElementById('onb-beats').getBoundingClientRect();
  return { btnBottom: btn.bottom, beatsTop: beats.top };
});
P('first-run cardless onboarding copy sits below #send-btn with a visible gap', withTips.beatsTop >= withTips.btnBottom + 16,
  `btnBottom=${withTips.btnBottom} beatsTop=${withTips.beatsTop}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
