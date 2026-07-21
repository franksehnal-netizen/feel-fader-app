// Regression probe: single-mount welcome/app architecture (2026-07-21 redesign,
// see docs/superpowers/specs/2026-07-21-welcome-blur-overlay-design.md).
// #device-wrap and #send-btn now mount ONCE, at page load, directly into their
// final app position (#device-home / .send-callout) and never reparent again.
// The welcome screen is a pure position:fixed blur overlay on top of the
// already-rendered app; #send-btn gets a `.welcome-floating` class (position:
// fixed, computed --welcome-float-top/left) to visually escape onto the
// welcome card while welcome is up. This replaces the old reparenting +
// --stage-entry-offset/--send-entry-gap pixel-continuity system entirely.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const errs=[];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));

// 1. Fresh load, still on welcome: elements already live in their final app homes.
const atLoad = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const controller = document.getElementById('device-wrap');
  const before = getComputedStyle(document.getElementById('welcome-screen'), '::before');
  return {
    controllerParentId: controller.parentElement?.id,
    btnParentClass: btn.parentElement?.className,
    btnHasFloating: btn.classList.contains('welcome-floating'),
    btnPosition: getComputedStyle(btn).position,
    overlayBackdrop: before.backdropFilter || before.webkitBackdropFilter,
  };
});
P('#device-wrap already lives in #device-home at page load', atLoad.controllerParentId === 'device-home', JSON.stringify(atLoad));
P('#send-btn already lives in .send-callout at page load', atLoad.btnParentClass === 'send-callout', JSON.stringify(atLoad));
P('#send-btn carries .welcome-floating while welcome is up', atLoad.btnHasFloating, JSON.stringify(atLoad));
P('#send-btn is position:fixed while welcome is up', atLoad.btnPosition === 'fixed', atLoad.btnPosition);
P('welcome overlay uses backdrop-filter blur (not an opaque fill)', /blur/.test(atLoad.overlayBackdrop), atLoad.overlayBackdrop);

// 2. skipWelcome(): nothing reparents, .welcome-floating comes off.
await p.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));
const afterSkip = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const controller = document.getElementById('device-wrap');
  return {
    controllerParentId: controller.parentElement?.id,
    btnParentClass: btn.parentElement?.className,
    btnHasFloating: btn.classList.contains('welcome-floating'),
    btnPosition: getComputedStyle(btn).position,
  };
});
P('#device-wrap never moved after skipWelcome()', afterSkip.controllerParentId === 'device-home', JSON.stringify(afterSkip));
P('#send-btn never moved after skipWelcome()', afterSkip.btnParentClass === 'send-callout', JSON.stringify(afterSkip));
P('#send-btn drops .welcome-floating after skipWelcome()', !afterSkip.btnHasFloating, JSON.stringify(afterSkip));
P('#send-btn returns to normal in-flow position after skipWelcome()', afterSkip.btnPosition !== 'fixed', afterSkip.btnPosition);

// 3. Real connect transition: device image must not move AT ALL (nothing ever
//    left its position, so there is nothing to keep continuous — nil movement
//    is now the correct invariant, not just "no big jump").
const p2 = await b.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.setViewport({ width: 1280, height: 900 });
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p2.evaluate(() => localStorage.setItem('ff-onboarded', '1'));
await p2.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
async function imgTop() { return p2.evaluate(() => document.getElementById('device-img').getBoundingClientRect().top); }
const before0 = await imgTop();
await p2.evaluate(() => hideWelcome());
const samples = [];
for (const t of [100, 300, 600, 900, 1200, 1500, 2000]) {
  await new Promise(r => setTimeout(r, t === 100 ? 100 : 300));
  samples.push(await imgTop());
}
const maxDrift = Math.max(...samples.map(s => Math.abs(s - before0)));
P('device image never moves during the connect transition (max drift <=0.5px)', maxDrift <= 0.5, `${maxDrift.toFixed(2)}px`);

// 4. Faders are click-through-blocked by the overlay while welcome is up,
//    implicitly (no dedicated inert CSS/JS needed — the overlay just sits on
//    top in z-index and intercepts the hit-test).
const p3 = await b.newPage();
p3.on('pageerror', e => errs.push(String(e)));
await p3.setViewport({ width: 1280, height: 900 });
await p3.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const hitTest = await p3.evaluate(() => {
  const thumb = document.getElementById('thumb-l');
  const r = thumb.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { hitIsThumb: el === thumb, hitInsideWelcome: !!el?.closest('#welcome-screen') };
});
P('clicking where a fader sits hits the welcome overlay, not the fader', !hitTest.hitIsThumb && hitTest.hitInsideWelcome, JSON.stringify(hitTest));

// 5. Interplay with the "hide controller" toggle: a previously-hidden
//    preference must not hijack #send-btn's position:fixed containing block.
//    (.stage gets `transform` from .stage-collapse.is-collapsed>.stage — if
//    that class were applied before welcome closes, #send-btn.welcome-floating
//    would resolve `fixed` against the transformed .stage instead of the
//    viewport. Fix: applyStageCollapse() is deferred until finalizeWelcomeExit().)
const p4 = await b.newPage();
p4.on('pageerror', e => errs.push(String(e)));
await p4.setViewport({ width: 1280, height: 900 });
await p4.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p4.evaluate(() => localStorage.setItem('ff-controller-hidden', '1'));
await p4.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const whileWelcome = await p4.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const stage = document.querySelector('.stage');
  const btn = document.getElementById('send-btn');
  const r = btn.getBoundingClientRect();
  return {
    isCollapsedDeferred: !wrap.classList.contains('is-collapsed'),
    stageHasNoTransform: getComputedStyle(stage).transform === 'none',
    btnCenterX: r.left + r.width / 2,
    viewportCenterX: 1280 / 2,
  };
});
P('stage-collapse is deferred while welcome is still showing', whileWelcome.isCollapsedDeferred, JSON.stringify(whileWelcome));
P('.stage has no active transform while welcome is showing (would hijack position:fixed)', whileWelcome.stageHasNoTransform, JSON.stringify(whileWelcome));
P('#send-btn.welcome-floating is centered on the true viewport, not a transformed ancestor', Math.abs(whileWelcome.btnCenterX - whileWelcome.viewportCenterX) <= 2, JSON.stringify(whileWelcome));
await p4.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));
const afterSkipHidden = await p4.evaluate(() => document.getElementById('stage-collapse').classList.contains('is-collapsed'));
P('stage-collapse applies once welcome has actually closed', afterSkipHidden, String(afterSkipHidden));
await p4.evaluate(() => localStorage.removeItem('ff-controller-hidden'));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
