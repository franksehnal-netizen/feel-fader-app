// Regression probe: "Demo — no device" badge must sit with a real gap below
// the sticky header after "Continue without device", not cramped against it
// (Frank screenshot 2026-07-20, "moc nalepené nahoře"). Root cause was
// skipWelcome() leaving a stale --stage-entry-offset applied to .stage, which
// #onb-demo-badge (a direct .stage child) inherited. The single-mount
// welcome/app redesign (2026-07-21) removed --stage-entry-offset entirely —
// .stage's margin-top is a static 0 now, so this probe checks that directly.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 700 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); });
await p.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));
await p.click('.welcome-skip');
await new Promise(r => setTimeout(r, 800));

const state = await p.evaluate(() => {
  const stage = document.querySelector('.stage');
  const badge = document.getElementById('onb-demo-badge').getBoundingClientRect();
  const header = document.querySelector('header').getBoundingClientRect();
  return {
    stageMarginTop: parseFloat(getComputedStyle(stage).marginTop),
    gapFromHeader: badge.top - header.bottom,
    badgeVisible: getComputedStyle(document.getElementById('onb-demo-badge')).display === 'block',
  };
});
P('.stage has no top-margin offset (static CSS default, nothing to reset)', state.stageMarginTop === 0, `${state.stageMarginTop}px`);
P('demo badge shown', state.badgeVisible, state.badgeVisible);
P('demo badge sits with a real gap below the header (>=20px, <150px)', state.gapFromHeader >= 20 && state.gapFromHeader < 150, `${state.gapFromHeader.toFixed(1)}px`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
