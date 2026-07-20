// Regression probe: numeric steppers (MIDI channel/CC/velocity/keyswitch
// bounds) and section-toggle buttons reach the 44px touch target on coarse
// pointers (A8, functional-audit finding 2026-07-20). An earlier fix added
// @media(pointer:coarse){.step-btn{width:44px;height:44px}}, but
// .stepper .step-btn (a 2-class compound selector defined outside any media
// query) has higher CSS specificity and kept winning at 24x24 regardless of
// pointer type — the fix existed in the stylesheet but never actually
// applied to the app's most-used control. .section-toggle-action was
// missing from the coarse block entirely.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); renderPanels(); });
await new Promise(r => setTimeout(r, 300));

const state = await p.evaluate(() => {
  const isCoarse = matchMedia('(pointer:coarse)').matches;
  const stepBtn = document.querySelector('.stepper .step-btn');
  const toggleAction = document.querySelector('.section-toggle-action');
  const csStep = stepBtn ? getComputedStyle(stepBtn) : null;
  const csToggle = toggleAction ? getComputedStyle(toggleAction) : null;
  return {
    isCoarse,
    stepBtnFound: !!stepBtn,
    stepBtnWidth: csStep ? parseFloat(csStep.width) : null,
    stepBtnHeight: csStep ? parseFloat(csStep.height) : null,
    toggleActionFound: !!toggleAction,
    toggleActionMinHeight: csToggle ? parseFloat(csToggle.minHeight) : null,
  };
});
P('coarse pointer is being emulated (test sanity)', state.isCoarse, String(state.isCoarse));
P('stepper +/- buttons reach 44x44 on coarse pointer', state.stepBtnFound && state.stepBtnWidth === 44 && state.stepBtnHeight === 44,
  `${state.stepBtnWidth}x${state.stepBtnHeight}`);
P('section-toggle-action reaches 44px min-height on coarse pointer', state.toggleActionFound && state.toggleActionMinHeight === 44,
  String(state.toggleActionMinHeight));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
