// Regression probe: hide-controller toggle (design 2026-07-20, revised
// 2026-07-21 after Frank's live-demo feedback). A header toggle switch
// (styled like the "Keyboard (HID)" switch, not a button) collapses
// .stage (device image + faders) via a CSS grid 1fr<->0fr trick,
// reclaiming vertical space for the bank config panels. The Send button
// (#send-btn + its change popover) normally lives inside .device-wrap;
// while the controller is hidden it reparents into a new sticky row
// directly under the header (#send-sticky-row) instead of squeezing into
// the header's own control row — kept sticky so it's still reachable
// while scrolling through a long config. State persists in localStorage
// across reloads.
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
P('initially: switch is unchecked', before.switchChecked === false, JSON.stringify(before));

await p.click('#controller-toggle-input');
await new Promise(r => setTimeout(r, 500));

const hidden = await p.evaluate(() => {
  const anchor = document.querySelector('.send-anchor');
  const btn = document.getElementById('send-btn');
  return {
    wrapHeight: document.getElementById('stage-collapse').getBoundingClientRect().height,
    anchorInStickyRow: anchor.parentElement.id === 'send-sticky-row',
    anchorHasDockedClass: anchor.classList.contains('docked'),
    rowHidden: document.getElementById('send-sticky-row').hidden,
    sendBtnClickable: !!btn.offsetParent,
    switchChecked: document.getElementById('controller-toggle-input').checked,
  };
});
P('after hiding: stage collapses to 0 height (real space reclaimed)', hidden.wrapHeight === 0, String(hidden.wrapHeight));
P('after hiding: Send button reparented into the sticky row', hidden.anchorInStickyRow && hidden.anchorHasDockedClass, JSON.stringify(hidden));
P('after hiding: sticky row is shown', hidden.rowHidden === false, JSON.stringify(hidden));
P('after hiding: Send button is still visible/clickable', hidden.sendBtnClickable, String(hidden.sendBtnClickable));
P('after hiding: switch is checked', hidden.switchChecked === true, JSON.stringify(hidden));

// Sticky behavior: the row should stay pinned right under the header while scrolling
const stickyTop = await p.evaluate(async () => {
  window.scrollTo(0, 400);
  await new Promise(r => setTimeout(r, 100));
  return document.getElementById('send-sticky-row').getBoundingClientRect().top;
});
P('sticky send row stays pinned under the header while scrolling', stickyTop >= 0 && stickyTop < 60, String(stickyTop));
await p.evaluate(() => window.scrollTo(0, 0));

await p.click('#controller-toggle-input');
await new Promise(r => setTimeout(r, 500));

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
P('hidden state persists across reload (localStorage)', afterReload.collapsed && afterReload.height === 0 && afterReload.switchChecked, JSON.stringify(afterReload));

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
