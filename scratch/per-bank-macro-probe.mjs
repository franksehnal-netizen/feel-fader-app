// Regression probe: the BUTTON long-press macro can be per-bank, with a
// "Global" checkbox collapsing all banks to one shared value. Transition
// rules matter more than the storage: turning Global ON adopts the currently
// displayed bank's macro (what you see stays), turning it OFF seeds every
// bank from the global value (nothing changes until you edit something).
// Spec: 2026-08-08-ui-backlog-design.md §D.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const dflt = await p.evaluate(() => ({ global: cfg.macro_global, perBank: cfg.banks.map(x => x.macro_keys) }));
P('macro_global defaults to true', dflt.global === true, String(dflt.global));
P('every bank has a macro_keys array', dflt.perBank.every(Array.isArray), JSON.stringify(dflt.perBank));

const globalRead = await p.evaluate(() => {
  cfg.macro_global = true; cfg.macro_keys = [0xE0, 0x16];
  cfg.banks[0].macro_keys = [0x2C];
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('Global on: every bank reads the shared value',
  JSON.stringify(globalRead.b0) === JSON.stringify([224,22]) && JSON.stringify(globalRead.b1) === JSON.stringify([224,22]),
  JSON.stringify(globalRead));

const seeded = await p.evaluate(() => { selectBank(0); setMacroGlobal(false); return cfg.banks.map(x => x.macro_keys); });
P('Global off seeds every bank from the global value',
  seeded.every(k => JSON.stringify(k) === JSON.stringify([224,22])), JSON.stringify(seeded));

const perBank = await p.evaluate(() => {
  setActiveMacroKeys(1, [0x2C]);
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('per-bank edit touches only that bank',
  JSON.stringify(perBank.b0) === JSON.stringify([224,22]) && JSON.stringify(perBank.b1) === JSON.stringify([44]),
  JSON.stringify(perBank));

const adopted = await p.evaluate(() => { selectBank(1); setMacroGlobal(true); return { keys: cfg.macro_keys, shown: activeMacroKeys(1) }; });
P('Global on adopts the displayed bank\'s macro',
  JSON.stringify(adopted.keys) === JSON.stringify([44]) && JSON.stringify(adopted.shown) === JSON.stringify([44]),
  JSON.stringify(adopted));

const empty = await p.evaluate(() => { setMacroGlobal(false); setActiveMacroKeys(0, []); return activeMacroKeys(0); });
P('empty per-bank macro stays empty (no fallback to global)', empty.length === 0, JSON.stringify(empty));

await p.evaluate(() => { toggleSection('macro'); });
await new Promise(r => setTimeout(r, 200));

const ui = await p.evaluate(() => {
  const box = document.getElementById('macro-global-toggle');
  const cap = document.getElementById('macro-capture');
  return { hasBox: !!box, checked: box ? box.checked : null,
           capLabel: cap ? cap.textContent.trim() : null,
           capBank: cap ? cap.getAttribute('data-bank') : null };
});
P('BUTTON section has a Global checkbox', ui.hasBox, String(ui.hasBox));
P('checkbox reflects cfg.macro_global (currently false)', ui.checked === false, String(ui.checked));
P('capture button is bound to the displayed bank', ui.capBank === String(await p.evaluate(() => activeBank)), ui.capBank);

await p.evaluate(() => { document.getElementById('macro-global-toggle').click(); });
await new Promise(r => setTimeout(r, 200));
const afterToggle = await p.evaluate(() => ({ flag: cfg.macro_global, checked: document.getElementById('macro-global-toggle').checked }));
P('clicking the checkbox flips cfg.macro_global', afterToggle.flag === true && afterToggle.checked === true, JSON.stringify(afterToggle));

// Fix round 1, Finding 1: a hardware bank switch (Program Change) arriving mid-capture
// must not silently retarget the capture to the wrong bank. Drive the exact code path
// the firmware's short-press bank switch uses: onMidiMsg() with a Program Change message.
const pcMidCapture = await p.evaluate(() => {
  DEVICE_INFO.hid_enabled = true;
  setMacroGlobal(false);
  cfg.banks[0].macro_keys = [];
  cfg.banks[1].macro_keys = [];
  dirty = false;
  selectBank(0);
  startMacroCapture(0);
  const capturingBefore = document.getElementById('macro-capture').classList.contains('capturing');
  onMidiMsg({ data: [0xC0, 1, 0] });   // hardware short-press -> Program Change to bank 1, same path as the real device
  const captureSurvived = !!_keyCapture;
  const bankAfterPC = activeBank;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true }));
  return {
    capturingBefore, captureSurvived, bankAfterPC,
    b0: cfg.banks[0].macro_keys.slice(),
    b1: cfg.banks[1].macro_keys.slice(),
  };
});
P('macro capture is visibly active before the Program Change', pcMidCapture.capturingBefore === true, String(pcMidCapture.capturingBefore));
P('Program Change mid-capture cancels the in-flight capture', pcMidCapture.captureSurvived === false, String(pcMidCapture.captureSurvived));
P('Program Change mid-capture: no macro written to bank 0', pcMidCapture.b0.length === 0, JSON.stringify(pcMidCapture.b0));
P('Program Change mid-capture: no macro written to bank 1', pcMidCapture.b1.length === 0, JSON.stringify(pcMidCapture.b1));

const notice = await p.evaluate(() => {
  _ffConnected = true; DEVICE_INFO.schema_version = 2;
  cfg.macro_global = false; renderPanels();
  const n = document.getElementById('macro-schema-notice');
  return { shown: !!n, text: n ? n.textContent.trim() : '' };
});
P('old firmware warning shows for per-bank macros', notice.shown, notice.text);

const noNotice = await p.evaluate(() => {
  DEVICE_INFO.schema_version = 3; renderPanels();
  const a = !!document.getElementById('macro-schema-notice');
  DEVICE_INFO.schema_version = 2; cfg.macro_global = true; renderPanels();
  const b = !!document.getElementById('macro-schema-notice');
  return { onNewFw: a, onGlobal: b };
});
P('no warning on schema_version 3', !noNotice.onNewFw, String(noNotice.onNewFw));
P('no warning while Global is on', !noNotice.onGlobal, String(noNotice.onGlobal));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
