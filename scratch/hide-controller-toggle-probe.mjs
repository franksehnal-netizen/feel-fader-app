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
// Send begins its tracked move immediately, while the row itself opens with
// the same long stage clock. The controller must already be visually gone
// when the moving pill passes its former area; otherwise the two layers read
// as a ghosted overlap (Frank 2026-08-22).
const collapseHandoff = await p.evaluate(() => new Promise(resolve => setTimeout(() => {
  const stage = document.querySelector('.stage');
  const row = document.getElementById('send-sticky-row');
  resolve({
    stageOpacity: Number(getComputedStyle(stage).opacity),
    rowHeight: Math.round(row.getBoundingClientRect().height),
    sendIsFloating: document.querySelector('.send-anchor')?.parentElement === document.body,
  });
}, 460)));
P('collapse handoff: controller is fully faded before moving Send overlaps its former area', collapseHandoff.stageOpacity <= 0.01 && collapseHandoff.rowHeight > 0 && collapseHandoff.sendIsFloating, JSON.stringify(collapseHandoff));
// 2026-07-26/27: the collapse is one coupled transition (box + content move
// together, no sequential delay); reparenting waits for transitionend with a
// 1400ms safety fallback (feel-fader.html applyControllerVisibility). The box
// itself now runs 1.1s (retuned from .55s on 2026-07-27, "slow controller
// collapse") — this wait needs headroom past that 1.1s transition AND past
// the JS's own 1400ms safety timeout, not just the old .9s/500ms figures.
await new Promise(r => setTimeout(r, 1500));

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
// Same coupled-transition mechanism as the hide direction above: reparenting
// waits for transitionend (1.1s box transition) or the 1400ms JS safety
// fallback — needs headroom past both, not the old .9s-era figures.
await new Promise(r => setTimeout(r, 1500));

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

// Panels below must not stretch to fill the reclaimed space. .panel carries
// flex:1 (for equal widths inside .panels-row); the standalone wide panels
// (Device & Settings, Help & Guide) are direct children of .center-col, a
// flex COLUMN, where flex:1 makes them GROW vertically and balloon into the
// space freed by hiding the controller. This only shows on a TALL window
// (lots of leftover space), so measure at 1900px — at 900px they barely grow
// and the regression slips through (Frank 2026-07-26). Fixed by
// .center-col>.panel-wide{flex:0 0 auto}.
await p.setViewport({ width: 1280, height: 1900 });
await new Promise(r => setTimeout(r, 100));
const panelHeights = await p.evaluate(() => {
  return [...document.querySelectorAll('.center-col > .panel.panel-wide')]
    .map(el => Math.round(el.getBoundingClientRect().height));
});
P('Device & Settings / Help & Guide keep their natural height on a tall window (no balloon)', panelHeights.every(h => h < 100), JSON.stringify(panelHeights));
await p.setViewport({ width: 1280, height: 900 });

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

// 2026-07-26: showing the controller for the FIRST time from a hidden LOAD
// must glide Send smoothly to its home, NOT park it mid-controller for the
// whole expansion and jump to the bottom at the end. That happened because
// the home position was captured while the stage was collapsed (garbage
// ~mid-screen value); now those metrics are only captured at full height, so
// this first show tracks the live device slot. Guard: sample the pill near
// the end of the show and at rest — a park-then-jump shows a big late delta.
const firstShowGlide = await p3.evaluate(async () => {
  const btn = document.getElementById('send-btn');
  document.getElementById('controller-toggle-input').click(); // first show from a hidden load
  await new Promise(r => setTimeout(r, 470));   // ~85% through the .55s expansion
  const nearEnd = btn.getBoundingClientRect().top;
  await new Promise(r => setTimeout(r, 400));    // settled
  const rest = btn.getBoundingClientRect().top;
  const dev = document.querySelector('.device-img').getBoundingClientRect();
  return { nearEnd: Math.round(nearEnd), rest: Math.round(rest), lateJump: Math.round(Math.abs(rest - nearEnd)), belowDevice: rest > dev.top + dev.height * 0.6 };
});
P('first show from a hidden load glides Send home smoothly (no mid-controller park + late jump)', firstShowGlide.lateJump < 40 && firstShowGlide.belowDevice, JSON.stringify(firstShowGlide));

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
    viewportCenterX: window.innerWidth / 2,
  };
});
P('stage-collapse stays deferred while welcome is still showing', whileWelcome.isCollapsedDeferred, JSON.stringify(whileWelcome));
// Tolerance covers the ~3px offset from html's scrollbar-gutter:stable
// (2026-07-26); a transformed-ancestor hijack (guarded by stageHasNoTransform
// above) would shift it far more.
P('#send-btn.welcome-floating centers on the true viewport, not a transformed ancestor', Math.abs(whileWelcome.btnCenterX - whileWelcome.viewportCenterX) <= 8, JSON.stringify(whileWelcome));
await p5.evaluate(() => localStorage.removeItem('ff-controller-hidden'));
await p5.close();

await p3.evaluate(() => localStorage.removeItem('ff-controller-hidden'));
await p3.close();

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
