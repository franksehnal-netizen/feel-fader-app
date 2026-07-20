// Regression probe: after "Continue without device" (skipWelcome()), the
// stage padding around the device/Send-button/first-card must stay at the
// small CSS default, not the value handoffPrimaryActionToApp() measures
// for the animated hardware-connect transition. Before this fix,
// skipWelcome() called handoffPrimaryActionToApp() (needed to fix the
// missing-button bug — see skip-welcome-send-btn-probe.mjs) without
// resetting --send-entry-gap, and the button/image weren't in a coherent
// "before" layout at measurement time: it measured 162px instead of the
// ~32px default, doubled by the CSS that consumes it into a ~350px empty
// gap between the device and the button, and again below the button.
// Reported by Frank via screenshot ("je tu strašně moc místa").
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
  const controller = document.getElementById('device-wrap');
  const image = document.getElementById('device-img');
  const btn = document.getElementById('send-btn');
  return {
    controllerGapVar: controller?.style.getPropertyValue('--send-entry-gap'),
    stageGapVar: stage?.style.getPropertyValue('--send-entry-gap'),
    stagePaddingBottom: stage ? parseFloat(getComputedStyle(stage).paddingBottom) : null,
    imageToButtonGap: btn && image ? btn.getBoundingClientRect().top - image.getBoundingClientRect().bottom : null,
  };
});
P('--send-entry-gap is not left set to a stale measured value', !state.controllerGapVar && !state.stageGapVar, JSON.stringify(state));
P('.stage bottom padding stays at the small CSS default (<=150px)', state.stagePaddingBottom <= 150, `${state.stagePaddingBottom}px`);
P('device image and Send button stay visually close (<=100px gap)', state.imageToButtonGap <= 100, `${state.imageToButtonGap?.toFixed(1)}px`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
