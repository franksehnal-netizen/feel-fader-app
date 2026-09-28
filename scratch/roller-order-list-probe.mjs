// Regression probe (minimal hybrid, spec 2026-09-26 §6): roller order is a
// vertical list (index · name · value · ≡). Drag uses the vertical midpoint,
// Alt+↑/↓ reorders with focus following, Move/× are hidden at rest but stay
// in the tab order and show on focus, and the live row follows the value.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

const layout = await p.evaluate(() => {
  cfg.banks[0].roller_mode = 'cc'; cfg.banks[0].uacc_values = [20, 1, 42];
  activeBank = 0; _openSections.clear(); _openSections.add('roller'); render();
  const rows = [...document.querySelectorAll('#uacc-grid .seq-row')];
  const r = rows.map(el => el.getBoundingClientRect());
  const actions = rows[1].querySelector('.seq-actions');
  return {
    count: rows.length,
    vertical: r.every((x, i) => i === 0 || (x.top >= r[i-1].bottom - 1 && Math.abs(x.left - r[0].left) < 1)),
    cells: rows.map(el => [el.querySelector('.seq-index')?.textContent.trim(), el.querySelector('.uacc-label')?.textContent.trim(), el.querySelector('.uacc-num')?.textContent.trim(), !!el.querySelector('.seq-handle')]),
    restOpacity: getComputedStyle(actions).opacity,
    links: [...document.querySelectorAll('#section-body-0-roller .seq-link')].map(el => el.textContent.trim()),
  };
});
P('articulations render as one vertical list', layout.count === 3 && layout.vertical, JSON.stringify(layout));
P('row reads index · name · value · handle', JSON.stringify(layout.cells[0]) === JSON.stringify(['1', 'Legato', '20', true]), JSON.stringify(layout.cells));
P('row actions are hidden at rest', layout.restOpacity === '0', layout.restOpacity);
P('Add articulation… and Templates… are text links', layout.links.join() === 'Add articulation…,Templates…', layout.links.join());

// Tab from the row reaches Move earlier, and focus reveals the actions.
await p.focus('#uacc-grid .seq-row[data-sequence-index="1"]');
await p.keyboard.press('Tab');
await wait(200);
const tabbed = await p.evaluate(() => ({
  focusTitle: document.activeElement?.title,
  shown: getComputedStyle(document.querySelector('#uacc-grid .seq-row[data-sequence-index="1"] .seq-actions')).opacity,
}));
P('Tab reaches the row actions and focus shows them', tabbed.focusTitle === 'Move earlier' && tabbed.shown === '1', JSON.stringify(tabbed));

// Alt+ArrowDown reorders and focus follows.
await p.focus('#uacc-grid .seq-row[data-sequence-index="0"]');
await p.keyboard.down('Alt'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Alt');
await wait(60);
const moved = await p.evaluate(() => ({ values: cfg.banks[0].uacc_values.join(), focus: document.activeElement?.dataset?.sequenceIndex }));
P('Alt+ArrowDown moves the row and focus follows', moved.values === '1,20,42' && moved.focus === '1', JSON.stringify(moved));

// Drag uses the vertical midpoint: drop row 0 onto the lower half of row 2 → last.
const dragged = await p.evaluate(() => {
  const rows = () => [...document.querySelectorAll('#uacc-grid .seq-row')];
  const dt = new DataTransfer();
  const src = rows()[0], dst = rows()[2], rect = dst.getBoundingClientRect();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles:true, cancelable:true, dataTransfer:dt }));
  dst.dispatchEvent(new DragEvent('dragover', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:rect.left + 5, clientY:rect.bottom - 3 }));
  const after = dst.classList.contains('sequence-drop-after');
  dst.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:rect.left + 5, clientY:rect.bottom - 3 }));
  return { after, values: cfg.banks[0].uacc_values.join() };
});
P('drop position follows the vertical midpoint', dragged.after && dragged.values === '20,42,1', JSON.stringify(dragged));

// Live row follows the received value.
const live = await p.evaluate(() => {
  _midiState = 'granted'; _ffConnected = true; liveBank = 0;
  const bank = cfg.banks[0];
  onMidiMsg({ data: new Uint8Array([0xB0 | bank.encoder.channel, bank.encoder.cc, 42]) });
  const liveRows = () => [...document.querySelectorAll('#uacc-grid .seq-row.is-live')].map(el => el.dataset.value);
  const first = liveRows();
  moveUacc(1, -1);   // 42 moves to index 0 → render()
  return { first, afterMove: liveRows(), weight: getComputedStyle(document.querySelector('#uacc-grid .seq-row.is-live .uacc-label')).fontWeight };
});
P('live articulation row is marked and bold', live.first.join() === '42' && live.weight === '700', JSON.stringify(live));
P('live marker follows the value after a reorder', live.afterMove.join() === '42', JSON.stringify(live));

// Keyswitch list shares the component.
const ks = await p.evaluate(() => {
  const bank = cfg.banks[0];
  bank.roller_mode = 'keyswitch'; bank.ks_channel = 0; bank.ks_notes = [24, 25, 26];
  _openRollerAdvanced.add(0); render();
  onMidiMsg({ data: new Uint8Array([0x90, 25, 100]) });
  const rows = [...document.querySelectorAll('#ks-tags-0 .seq-row')];
  return { count: rows.length, live: rows.filter(el => el.classList.contains('is-live')).map(el => el.dataset.ksnote), handle: rows.every(el => el.querySelector('.seq-handle')) };
});
P('keyswitches use the same row list with a live row', ks.count === 3 && ks.live.join() === '25' && ks.handle, JSON.stringify(ks));

// Final review 2: a bank switch (Program Change) or a disconnect must drop the
// live row instantly, not just the next time something else re-renders it.
await p.evaluate(() => {
  cfg.banks[0].roller_mode = 'cc'; cfg.banks[0].uacc_values = [20, 1, 42];
  cfg.banks.splice(1); addBank();
  cfg.banks[1].roller_mode = 'cc'; cfg.banks[1].uacc_values = [20, 1, 42];
  activeBank = 0; liveBank = 0; dirty = false;
  _openSections.clear(); _openSections.add('roller'); render();
});
const pc = await p.evaluate(() => {
  onMidiMsg({ data: new Uint8Array([0xB0 | cfg.banks[0].encoder.channel, cfg.banks[0].encoder.cc, 20]) });
  const liveBefore = [...document.querySelectorAll('.seq-row.is-live')].map(el => el.dataset.value);
  onMidiMsg({ data: new Uint8Array([0xC0, 1]) });   // hardware Program Change → bank 1
  return { liveBefore, liveAfterPc: document.querySelectorAll('.seq-row.is-live').length, activeBank };
});
P('CC value marks the live row', pc.liveBefore.join() === '20', JSON.stringify(pc));
P('Program Change to another bank leaves no stale live row', pc.activeBank === 1 && pc.liveAfterPc === 0, JSON.stringify(pc));

const disc = await p.evaluate(() => {
  onMidiMsg({ data: new Uint8Array([0xB0 | cfg.banks[1].encoder.channel, cfg.banks[1].encoder.cc, 1]) });
  const liveBefore = document.querySelectorAll('.seq-row.is-live').length;
  midiAccess = { inputs: { forEach(){} }, outputs: { forEach(){} } };   // device no longer enumerated
  connectInputs();
  return { liveBefore, liveAfterDisconnect: document.querySelectorAll('.seq-row.is-live').length };
});
P('disconnect leaves no stale live row', disc.liveBefore === 1 && disc.liveAfterDisconnect === 0, JSON.stringify(disc));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
