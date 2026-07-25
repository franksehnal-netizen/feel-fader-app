// Regression probe: hide-controller toggle (design 2026-07-20, revised
// 2026-07-21 after Frank's live-demo feedback, twice). A header toggle
// switch (styled like the "Keyboard (HID)" switch, with the same
// controller/fader icon used for the "active on device" bank-tab marker)
// collapses .stage (device image + faders) via a CSS grid 1fr<->0fr trick,
// reclaiming vertical space for the bank config panels. Switch ON = controller
// VISIBLE (checked = visible, not hidden — inverted from the first cut per
// Frank's second round of feedback). The Send button (#send-btn + its change
// popover) normally lives inside .device-wrap; while the controller is hidden
// it reparents into a new sticky row directly under the header
// (#send-sticky-row) instead of squeezing into the header's own control row —
// kept sticky so it's still reachable while scrolling through a long config.
// State persists in localStorage across reloads.
//
// Root-cause bug fixed in the second revision: #send-btn is a single shared
// element that handoffPrimaryActionToApp() moves from the welcome screen into
// .device-wrap's .send-callout, but that function looks up the callout
// SCOPED to .device-wrap (controller.querySelector(...)), not document-wide.
// The first cut called the .send-anchor reparent at page load
// (initControllerVisibility(), before the user has even left the welcome
// screen) — if the saved preference was "hidden", it moved .send-anchor out
// of .device-wrap before handoff ran, so handoff silently found no callout
// and no-opped: Send was stranded on the welcome screen, and the sticky row
// showed up empty. Fixed by splitting the effect in two: the stage-collapse
// visual applies at load (safe — hidden behind the welcome overlay either
// way), but the .send-anchor dock is deferred until handoffPrimaryActionToApp()
// itself confirms the callout is in place inside .device-wrap.
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
    rowHidden: document.getElementById('send-sticky-row').hidden,
    switchChecked: document.getElementById('controller-toggle-input').checked,
  };
});
P('initially: controller visible with real height', before.wrapHeight > 100, String(before.wrapHeight));
P('initially: Send button lives inside device-wrap', before.anchorInDeviceWrap, JSON.stringify(before));
P('initially: sticky send row is hidden', before.rowHidden, JSON.stringify(before));
P('initially: switch is checked (ON = controller visible)', before.switchChecked === true, JSON.stringify(before));

await p.click('#controller-toggle-input');
// 2026-07-23: the collapse now runs as two sequential phases (content fades
// .4s, THEN the box collapses .5s, delayed until the fade finishes) instead
// of one .9s transition — 900ms total either way, but the box doesn't reach
// 0 height until closer to the full duration, so this wait needs headroom
// past 900ms rather than the old 500ms half-way sample.
await new Promise(r => setTimeout(r, 1000));

const hidden = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  const btn = document.getElementById('send-btn');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInStickyRow: anchor.parentElement.id === 'send-sticky-row-inner',
    anchorHasDockedClass: anchor.classList.contains('docked'),
    rowHidden: document.getElementById('send-sticky-row').hidden,
    sendBtnClickable: !!btn.offsetParent,
    sendBtnSize: (r=>({w:r.width,h:r.height}))(btn.getBoundingClientRect()),
    switchChecked: document.getElementById('controller-toggle-input').checked,
  };
});
P('after hiding: stage collapses to 0 height (real space reclaimed)', hidden.wrapHeight === 0, String(hidden.wrapHeight));
P('after hiding: Send button reparented into the sticky row', hidden.anchorInStickyRow && hidden.anchorHasDockedClass, JSON.stringify(hidden));
P('after hiding: sticky row is shown', hidden.rowHidden === false, JSON.stringify(hidden));
P('after hiding: Send button is still visible/clickable with real size', hidden.sendBtnClickable && hidden.sendBtnSize.w > 100 && hidden.sendBtnSize.h > 20, JSON.stringify(hidden));
P('after hiding: switch is unchecked (OFF = controller hidden)', hidden.switchChecked === false, JSON.stringify(hidden));

// Sticky behavior: the row should stay pinned right under the header while scrolling
const stickyTop = await p.evaluate(async () => {
  window.scrollTo(0, 400);
  await new Promise(r => setTimeout(r, 100));
  return document.getElementById('send-sticky-row').getBoundingClientRect().top;
});
P('sticky send row stays pinned under the header while scrolling', stickyTop >= 0 && stickyTop < 60, String(stickyTop));
await p.evaluate(() => window.scrollTo(0, 0));

await p.click('#controller-toggle-input');
// 2026-07-23: Send now waits out the box-growth phase (delayed 500ms) before
// reparenting back into device-wrap, so it arrives in sync with the content
// fade-in instead of jumping ahead of it — needs headroom past that 500ms
// delay's own transition, not just the delay itself.
await new Promise(r => setTimeout(r, 1000));

const restored = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInDeviceWrap: anchor.parentElement.id === 'device-wrap',
    anchorHasDockedClass: anchor.classList.contains('docked'),
    rowHidden: document.getElementById('send-sticky-row').hidden,
  };
});
P('showing again: stage height restored', restored.wrapHeight > 100, String(restored.wrapHeight));
P('showing again: Send button reparented back into device-wrap', restored.anchorInDeviceWrap && !restored.anchorHasDockedClass, JSON.stringify(restored));
P('showing again: sticky row is hidden again', restored.rowHidden === true, JSON.stringify(restored));

// The "N unsaved changes" note should still show up docked in the sticky row
const dirtyNote = await p.evaluate(() => {
  cfg.banks[0].fader1.cc = (cfg.banks[0].fader1.cc + 1) % 128;
  dirty = true; runValidation();
  document.getElementById('controller-toggle-input').click();
  return new Promise(resolve => setTimeout(() => {
    const note = document.getElementById('send-change-note');
    resolve({ text: note.textContent, visible: getComputedStyle(note).display !== 'none' });
  }, 500));
});
P('unsaved-changes note is visible alongside Send in the sticky row', dirtyNote.visible && /unsaved/i.test(dirtyNote.text), JSON.stringify(dirtyNote));

// Panels below must not stretch to fill the reclaimed space (regression:
// a stray .panel-wide{flex:1} rule from an unused .blk-wide layout used
// to make Device & Settings / Help & Guide balloon in height once the
// stage collapsed and .center-col had real leftover space to distribute).
const panelHeights = await p.evaluate(() => {
  return [...document.querySelectorAll('.panel.panel-wide')]
    .filter(el => !el.closest('.bank-card'))
    .map(el => el.getBoundingClientRect().height);
});
P('Device & Settings / Help & Guide panels stay compact when collapsed (not stretched)', panelHeights.every(h => h < 100), JSON.stringify(panelHeights));

// localStorage persistence across reload
p.on('dialog', d => d.accept());   // the dirty-state beforeunload confirm from the note above
await p.reload({ waitUntil: 'networkidle0' });
const afterReload = await p.evaluate(() => {
  skipWelcome();
  const wrap = document.getElementById('stage-collapse');
  return { collapsed: wrap.classList.contains('is-collapsed'), height: wrap.getBoundingClientRect().height, switchChecked: document.getElementById('controller-toggle-input').checked };
});
P('hidden state persists across reload (localStorage)', afterReload.collapsed && afterReload.height === 0 && afterReload.switchChecked === false, JSON.stringify(afterReload));

// prefers-reduced-motion
const p2 = await b.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p2.evaluate(() => skipWelcome());
const reducedMotion = await p2.evaluate(() => getComputedStyle(document.getElementById('stage-collapse')).transitionDuration);
P('prefers-reduced-motion: transition is disabled', reducedMotion === '0s', reducedMotion);
await p2.close();

// The actual bug Frank hit: hidden preference saved from a PREVIOUS session,
// loaded fresh (still on the welcome screen when initControllerVisibility()
// runs), then the user skips welcome — Send must not be stranded there.
const p3 = await b.newPage();
p3.on('pageerror', e => errs.push(String(e)));
await p3.setViewport({ width: 1280, height: 900 });
await p3.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p3.evaluate(() => localStorage.setItem('ff-controller-hidden', '1'));
await p3.reload({ waitUntil: 'networkidle0' });
await p3.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 300));
const staleHiddenScenario = await p3.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  const btn = document.getElementById('send-btn');
  return {
    anchorInStickyRow: anchor.parentElement.id === 'send-sticky-row-inner',
    sendBtnSize: (r=>({w:r.width,h:r.height}))(btn.getBoundingClientRect()),
    rowHidden: document.getElementById('send-sticky-row').hidden,
  };
});
P('bug repro: Send survives a fresh load with a previously-saved hidden preference', staleHiddenScenario.anchorInStickyRow && staleHiddenScenario.sendBtnSize.w > 100 && !staleHiddenScenario.rowHidden, JSON.stringify(staleHiddenScenario));

// New with the 2026-07-21 blur-overlay redesign: a previously-hidden
// preference must not hijack #send-btn.welcome-floating's position:fixed
// containing block. .stage-collapse.is-collapsed>.stage gets a `transform`,
// and any transformed ancestor becomes the containing block for `fixed`
// descendants — so this state must stay deferred until welcome actually closes.
const p5 = await b.newPage();
p5.on('pageerror', e => errs.push(String(e)));
await p5.setViewport({ width: 1280, height: 900 });
await p5.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p5.evaluate(() => localStorage.setItem('ff-controller-hidden', '1'));
await p5.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const whileWelcome = await p5.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const stage = document.querySelector('.stage');
  const btn = document.getElementById('send-btn');
  const r = btn.getBoundingClientRect();
  return {
    isCollapsedDeferred: !wrap.classList.contains('is-collapsed'),
    stageHasNoTransform: getComputedStyle(stage).transform === 'none',
    btnCenterX: r.left + r.width / 2,
    viewportCenterX: 640,
  };
});
P('stage-collapse stays deferred while welcome is still showing', whileWelcome.isCollapsedDeferred, JSON.stringify(whileWelcome));
P('#send-btn.welcome-floating centers on the true viewport, not a transformed ancestor', Math.abs(whileWelcome.btnCenterX - whileWelcome.viewportCenterX) <= 2, JSON.stringify(whileWelcome));
await p5.evaluate(() => localStorage.removeItem('ff-controller-hidden'));
await p5.close();

await p3.evaluate(() => localStorage.removeItem('ff-controller-hidden'));
await p3.close();

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
