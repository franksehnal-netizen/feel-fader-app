// Regression: after connectTransitionWelcome() runs, the reveal of the
// live-status HUD and the reveal of the Send-to-device button must be
// scheduled with the same delay. Before this fix they weren't (HUD's
// trigger at T+1100ms, button's at T+1450ms) — TODO #3 explicitly overrides
// an earlier decision (2026-07-21 code comment) to keep them as separate
// beats, confirmed by Frank 2026-08-10.
//
// This does NOT poll rendered opacity to detect "visible" — verified
// empirically 2026-08-10 that doesn't work here: #send-btn is already
// opacity:1 (from the earlier "Connect & load" CTA reveal, via the
// unrelated .welcome-start.show class) before connectTransitionWelcome()
// ever runs, and the button's later hide-then-reveal happens through a
// separate body.welcome-connecting CSS-driven fade layered on top of that
// — so a plain "poll until opacity>=0.99" check reports "visible" at ~20ms
// regardless of either the old 1450ms delay or the new 1100ms one; it
// can't discriminate the change at all. Instead this spies on the actual
// setTimeout call the code makes for revealPostConnectUI — the exact,
// deterministic thing this task changes — and separately checks the
// animation-duration change by calling revealPostConnectUI() directly.
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
  const captured = [];
  const origSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (fn === revealPostConnectUI) captured.push(delay);
    return origSetTimeout.call(window, fn, delay, ...args);
  };
  connectTransitionWelcome();
  window.setTimeout = origSetTimeout;
  await new Promise(res => origSetTimeout(res, 50));

  const btn = document.getElementById('send-btn');
  revealPostConnectUI();
  const animationStr = btn.style.animation;

  return { revealDelay: captured[0], animationStr };
});

P('revealPostConnectUI is scheduled at the same T+1100ms delay as the HUD reveal', r.revealDelay === 1100, `delay=${r.revealDelay}`);
P('welcome-btn-reveal animation duration is .3s (matches the HUD\'s .28s opacity transition)', /welcome-btn-reveal/.test(r.animationStr) && /^0?\.3s/.test(r.animationStr), r.animationStr);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
