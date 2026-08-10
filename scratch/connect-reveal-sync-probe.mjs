// Regression: after connectTransitionWelcome() runs, the reveal of the
// live-status HUD and the reveal of the Send-to-device button must happen
// in the exact same synchronous callback, not just at the same nominal
// delay. TODO #3's first pass (2026-08-10) scheduled them as two separate
// setTimeout(fn, 1100) calls — same delay, but two independently-queued
// timers. Frank's real-HW smoke test that same day caught an intermittent
// flicker: finalizeWelcomeExit() (in the first timer) drops #send-btn's
// .welcome-floating class, which un-pins its opacity from the held
// welcome-screen-out animation and lets it jump to the base rule's
// opacity:1 for a moment; if the browser painted before the second timer's
// revealPostConnectUI() ran, its fresh welcome-btn-reveal animation then
// snapped opacity back to its own `from{opacity:0}` keyframe and re-animated
// up — a visible flash, only when a paint landed in that gap. Fix: call
// revealPostConnectUI() directly inside the SAME callback as
// finalizeWelcomeExit()/updateContextualLiveStrip(), so the browser only
// ever paints the final state. This probe locks that down: exactly one
// setTimeout(…,1100) is scheduled by connectTransitionWelcome() (not two),
// and revealPostConnectUI() actually runs as part of that single callback.
//
// This does NOT poll rendered opacity to detect "visible" — verified
// empirically 2026-08-10 that doesn't work here: #send-btn is already
// opacity:1 (from the earlier "Connect & load" CTA reveal, via the
// unrelated .welcome-start.show class) before connectTransitionWelcome()
// ever runs, and the button's later hide-then-reveal happens through a
// separate body.welcome-connecting CSS-driven fade layered on top of that
// — so a plain "poll until opacity>=0.99" check reports "visible" almost
// immediately regardless of timing; it can't discriminate the change at
// all. Instead this spies on window.setTimeout itself and on
// revealPostConnectUI to verify the consolidated-callback shape, and
// separately checks the animation-duration by calling it directly.
// Spec: 2026-08-10-todo-batch-design.md §5.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// Force a deterministic prefers-reduced-motion state — revealPostConnectUI() has a
// reduced-motion branch that skips setting the animation this probe checks, and
// host OS accessibility settings can flip the default unpredictably.
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  showWelcome();
  const timers1100 = [];
  const origSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (delay === 1100) timers1100.push(fn);
    return origSetTimeout.call(window, fn, delay, ...args);
  };
  const origReveal = revealPostConnectUI;
  let revealCalledInsideTimer = false;
  window.revealPostConnectUI = function(...args) {
    revealCalledInsideTimer = true;
    return origReveal.apply(this, args);
  };
  connectTransitionWelcome();
  window.setTimeout = origSetTimeout;

  // Run whatever the code scheduled at T+1100ms right now, synchronously —
  // this is the single callback under test, not a real 1100ms wait.
  timers1100.forEach(fn => fn());
  window.revealPostConnectUI = origReveal;

  const btn = document.getElementById('send-btn');
  revealPostConnectUI();
  const animationStr = btn.style.animation;

  return { timerCount: timers1100.length, revealCalledInsideTimer, animationStr };
});

P('connectTransitionWelcome schedules exactly one T+1100ms timer (not two racing ones)', r.timerCount === 1, `timerCount=${r.timerCount}`);
P('revealPostConnectUI runs inside that same T+1100ms callback', r.revealCalledInsideTimer);
P('welcome-btn-reveal animation duration is .6s (2x the HUD\'s doubled .56s opacity transition, Frank 2026-08-10)', /welcome-btn-reveal/.test(r.animationStr) && /^0?\.6s/.test(r.animationStr), r.animationStr);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
