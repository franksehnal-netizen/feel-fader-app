import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); applyControllerVisibility(false, false); });

// The 900ms Frank picked (A/B/C companion, 2026-07-23) is now split into two
// sequential, non-overlapping phases per a later live-DevTools finding
// (2026-07-23): content fades/settles in .4s, the box collapses in .5s
// delayed until the content is already invisible — .4s + .5s = .9s total,
// same overall duration, no more mid-fade clipping into a flattened box.
const durations = await p.evaluate(() => {
  const wrapBase = getComputedStyle(document.getElementById('stage-collapse'));
  const innerBase = getComputedStyle(document.querySelector('#stage-collapse > .stage'));
  return { wrapDuration: wrapBase.transitionDuration, wrapDelay: wrapBase.transitionDelay, innerDuration: innerBase.transitionDuration, innerDelay: innerBase.transitionDelay };
});
P('Container (show direction, base rule) collapses in 0.5s with no delay', durations.wrapDuration === '0.5s' && durations.wrapDelay === '0s', JSON.stringify(durations));
P('Content (show direction, base rule) fades in 0.4s, delayed 0.5s (waits for the box)', durations.innerDuration === '0.4s, 0.4s' && durations.innerDelay === '0.5s, 0.5s', JSON.stringify(durations));

// Hide direction reads its transition off the .is-collapsed rule (CSS uses
// the "after" style's transition config) — add the class directly rather
// than clicking, so this reads the declared values, not a mid-animation snapshot.
const hideDurations = await p.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  wrap.classList.add('is-collapsed');
  const wrapCs = getComputedStyle(wrap);
  const innerCs = getComputedStyle(wrap.querySelector(':scope > .stage'));
  const out = { wrapDuration: wrapCs.transitionDuration, wrapDelay: wrapCs.transitionDelay, innerDuration: innerCs.transitionDuration, innerDelay: innerCs.transitionDelay };
  wrap.classList.remove('is-collapsed');
  return out;
});
P('Container (hide direction) collapses in 0.5s, delayed 0.4s (waits for content to fade)', hideDurations.wrapDuration === '0.5s' && hideDurations.wrapDelay === '0.4s', JSON.stringify(hideDurations));
P('Content (hide direction) fades out in 0.4s with no delay', hideDurations.innerDuration === '0.4s, 0.4s' && hideDurations.innerDelay === '0s, 0s', JSON.stringify(hideDurations));

// The real behavioral guarantee: at no point is the content clipped by the
// shrinking box while still meaningfully visible (opacity > 0.1) — this is
// the actual defect the phased timing fixes, not just the raw numbers above.
const clipCheck = await p.evaluate(async () => {
  const input = document.getElementById('controller-toggle-input');
  const wrap = document.getElementById('stage-collapse');
  const stage = wrap.querySelector(':scope > .stage');
  const deviceImg = document.querySelector('.device-img');
  input.click(); // hide
  const badFrames = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 1000) {
    const wrapRect = wrap.getBoundingClientRect();
    const devRect = deviceImg.getBoundingClientRect();
    const opacity = parseFloat(getComputedStyle(stage).opacity);
    const clippedH = Math.max(0, Math.min(devRect.bottom, wrapRect.bottom) - Math.max(devRect.top, wrapRect.top));
    if (opacity > 0.1 && clippedH < devRect.height - 2) badFrames.push({ opacity, clippedH: Math.round(clippedH), naturalH: Math.round(devRect.height) });
    await new Promise(r => setTimeout(r, 40));
  }
  return badFrames;
});
P('Content is never visibly clipped by the collapsing box mid-fade', clipCheck.length === 0, JSON.stringify(clipCheck));

// prefers-reduced-motion still disables the transition — check both the
// base rule AND the .is-collapsed rule (2026-07-23 fix: the phased-sequence
// rules made .is-collapsed's transition 2-class-specific, which used to beat
// the 1-class reduced-motion override until the media query was updated to match).
await p.evaluate(() => document.getElementById('stage-collapse').classList.remove('is-collapsed'));
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const reducedDurations = await p.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const base = getComputedStyle(wrap).transitionDuration;
  wrap.classList.add('is-collapsed');
  const collapsed = getComputedStyle(wrap).transitionDuration;
  wrap.classList.remove('is-collapsed');
  return { base, collapsed };
});
P('prefers-reduced-motion disables the show-direction transition', reducedDurations.base === '0s', reducedDurations.base);
P('prefers-reduced-motion disables the hide-direction transition too', reducedDurations.collapsed === '0s', reducedDurations.collapsed);

await p.close();
await b.close();
