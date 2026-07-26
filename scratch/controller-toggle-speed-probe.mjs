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

// Coupled single-phase choreography (Frank 2026-07-26): box + content animate
// together over one ~.55s window, no sequential delay, so the controller
// grows/shrinks AS the button and panels move (the earlier box-then-content
// two-step read as "the button arrives, then the controller catches up").
// The box uses the SAME fast ease-out in both directions so hide feels as
// snappy as show; only the content OPACITY is front-loaded on hide (.32s) so
// it leads the box down and is faint before the clip bites — no squish, no
// dead-time, no easing mismatch.
const durations = await p.evaluate(() => {
  const wrapBase = getComputedStyle(document.getElementById('stage-collapse'));
  const innerBase = getComputedStyle(document.querySelector('#stage-collapse > .stage'));
  return { wrapDuration: wrapBase.transitionDuration, wrapDelay: wrapBase.transitionDelay, innerDuration: innerBase.transitionDuration, innerDelay: innerBase.transitionDelay };
});
P('Box (show, base rule) grows in 0.55s, no delay', durations.wrapDuration === '0.55s' && durations.wrapDelay === '0s', JSON.stringify(durations));
P('Content (show, base rule) opacity+transform both 0.55s, no delay', durations.innerDuration === '0.55s, 0.55s' && durations.innerDelay === '0s, 0s', JSON.stringify(durations));

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
P('Box (hide) collapses in 0.55s, no delay — SAME fast curve as show (symmetric)', hideDurations.wrapDuration === '0.55s' && hideDurations.wrapDelay === '0s', JSON.stringify(hideDurations));
P('Content (hide) opacity front-loaded 0.32s, transform 0.55s, no delay', hideDurations.innerDuration === '0.32s, 0.55s' && hideDurations.innerDelay === '0s, 0s', JSON.stringify(hideDurations));

// The real behavioral guarantee: no BAD squish. "severity" = opacity × how
// clipped the device is; a flattened-rectangle squish (content fully visible
// while the box slices it to a thin band) spikes this high (the old pure-
// parallel coupling hit ~0.46). The front-loaded hide opacity keeps it low
// (~0.14 measured) — a brief, faint, mostly-visible frame, never a hard band.
const maxSeverity = await p.evaluate(async () => {
  const input = document.getElementById('controller-toggle-input');
  const wrap = document.getElementById('stage-collapse');
  const stage = wrap.querySelector(':scope > .stage');
  const deviceImg = document.querySelector('.device-img');
  input.click(); // hide
  let worst = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 800) {
    const wrapRect = wrap.getBoundingClientRect();
    const devRect = deviceImg.getBoundingClientRect();
    const opacity = parseFloat(getComputedStyle(stage).opacity);
    const visFrac = Math.max(0, Math.min(devRect.bottom, wrapRect.bottom) - Math.max(devRect.top, wrapRect.top)) / (devRect.height || 1);
    worst = Math.max(worst, opacity * (1 - visFrac));
    await new Promise(r => setTimeout(r, 25));
  }
  return worst;
});
P('No bad squish on hide (clip severity stays low, well under the ~0.46 of un-front-loaded coupling)', maxSeverity < 0.25, `maxSeverity=${maxSeverity.toFixed(3)}`);

// prefers-reduced-motion still disables the transition — check both the base
// rule AND the .is-collapsed rule (the .is-collapsed>.stage rule declares its
// own transition at 2-class specificity, which the media query override must
// match to avoid silently re-enabling motion for reduced-motion users).
await p.evaluate(() => document.getElementById('stage-collapse').classList.remove('is-collapsed'));
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const reducedDurations = await p.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const stage = wrap.querySelector(':scope > .stage');
  const base = getComputedStyle(wrap).transitionDuration;
  const baseStage = getComputedStyle(stage).transitionDuration;
  wrap.classList.add('is-collapsed');
  const collapsed = getComputedStyle(wrap).transitionDuration;
  const collapsedStage = getComputedStyle(stage).transitionDuration;
  wrap.classList.remove('is-collapsed');
  return { base, baseStage, collapsed, collapsedStage };
});
P('prefers-reduced-motion disables the show-direction transition (box + content)', reducedDurations.base === '0s' && /^0s(, 0s)?$/.test(reducedDurations.baseStage), JSON.stringify(reducedDurations));
P('prefers-reduced-motion disables the hide-direction transition too (box + content)', reducedDurations.collapsed === '0s' && /^0s(, 0s)?$/.test(reducedDurations.collapsedStage), JSON.stringify(reducedDurations));

await p.close();
await b.close();
