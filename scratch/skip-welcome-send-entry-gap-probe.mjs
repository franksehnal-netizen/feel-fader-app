// Regression probe: after "Continue without device" (skipWelcome()), .stage's
// padding stays at its static CSS default. Historically this drifted because
// handoffPrimaryActionToApp() measured a stale --send-entry-gap value at a bad
// moment in the skip path (Frank screenshot 2026-07-20, "je tu strašně moc
// místa"). The single-mount welcome/app redesign (2026-07-21, see
// docs/superpowers/specs/2026-07-21-welcome-blur-overlay-design.md) removed
// --send-entry-gap and --stage-entry-offset entirely — .stage's padding is a
// fixed value now, so this probe checks the fixed value directly instead of
// checking that a since-deleted CSS variable got reset.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); skipWelcome(); });
await new Promise(r => setTimeout(r, 400));

const state = await p.evaluate(() => {
  const stage = document.querySelector('.stage');
  const image = document.getElementById('device-img');
  const btn = document.getElementById('send-btn');
  return {
    stagePaddingBottom: stage ? parseFloat(getComputedStyle(stage).paddingBottom) : null,
    stageMarginTop: stage ? parseFloat(getComputedStyle(stage).marginTop) : null,
    imageToButtonGap: btn && image ? btn.getBoundingClientRect().top - image.getBoundingClientRect().bottom : null,
  };
});
P('.stage bottom padding stays at the fixed CSS default (<=150px)', state.stagePaddingBottom <= 150, `${state.stagePaddingBottom}px`);
P('.stage has no leftover top margin', state.stageMarginTop === 0, `${state.stageMarginTop}px`);
P('device image and Send button stay visually close (<=100px gap)', state.imageToButtonGap <= 100, `${state.imageToButtonGap?.toFixed(1)}px`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
