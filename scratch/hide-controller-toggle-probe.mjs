// Regression probe: hide-controller toggle (2026-07-20 design,
// docs/superpowers/specs/2026-07-20-hide-controller-toggle-design.md).
// A header toggle collapses .stage (device image + faders) via a CSS
// grid 1fr<->0fr trick, reclaiming vertical space for the bank config
// panels, while the Send button (#send-btn + its change popover) gets
// reparented from inside .device-wrap into a header slot so it's still
// reachable while the controller is hidden. State persists in
// localStorage across reloads.
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
await p.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));

const before = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInDeviceWrap: anchor.parentElement.id === 'device-wrap',
    ariaPressed: document.querySelector('.controller-toggle').getAttribute('aria-pressed'),
  };
});
P('initially: controller visible with real height', before.wrapHeight > 100, String(before.wrapHeight));
P('initially: Send button lives inside device-wrap', before.anchorInDeviceWrap, JSON.stringify(before));
P('initially: toggle aria-pressed is false', before.ariaPressed === 'false', before.ariaPressed);

await p.click('.controller-toggle');
await new Promise(r => setTimeout(r, 500));

const hidden = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  const btn = document.getElementById('send-btn');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInHeaderSlot: anchor.parentElement.id === 'send-anchor-slot',
    anchorHasInHeaderClass: anchor.classList.contains('in-header'),
    sendBtnClickable: !!btn.offsetParent,
    ariaPressed: document.querySelector('.controller-toggle').getAttribute('aria-pressed'),
  };
});
P('after hiding: stage collapses to 0 height (real space reclaimed)', hidden.wrapHeight === 0, String(hidden.wrapHeight));
P('after hiding: Send button reparented into the header slot', hidden.anchorInHeaderSlot && hidden.anchorHasInHeaderClass, JSON.stringify(hidden));
P('after hiding: Send button is still visible/clickable', hidden.sendBtnClickable, String(hidden.sendBtnClickable));
P('after hiding: toggle aria-pressed is true', hidden.ariaPressed === 'true', hidden.ariaPressed);

await p.click('.controller-toggle');
await new Promise(r => setTimeout(r, 500));

const restored = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInDeviceWrap: anchor.parentElement.id === 'device-wrap',
    anchorHasInHeaderClass: anchor.classList.contains('in-header'),
  };
});
P('showing again: stage height restored', restored.wrapHeight > 100, String(restored.wrapHeight));
P('showing again: Send button reparented back into device-wrap', restored.anchorInDeviceWrap && !restored.anchorHasInHeaderClass, JSON.stringify(restored));

// localStorage persistence across reload
await p.evaluate(() => document.querySelector('.controller-toggle').click());
await new Promise(r => setTimeout(r, 500));
await p.reload({ waitUntil: 'networkidle0' });
const afterReload = await p.evaluate(() => {
  skipWelcome();
  const wrap = document.getElementById('stage-collapse');
  return { collapsed: wrap.classList.contains('is-collapsed'), height: wrap.getBoundingClientRect().height };
});
P('hidden state persists across reload (localStorage)', afterReload.collapsed && afterReload.height === 0, JSON.stringify(afterReload));

// prefers-reduced-motion
const p2 = await b.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p2.evaluate(() => skipWelcome());
const reducedMotion = await p2.evaluate(() => getComputedStyle(document.getElementById('stage-collapse')).transitionDuration);
P('prefers-reduced-motion: transition is disabled', reducedMotion === '0s', reducedMotion);
await p2.close();

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
