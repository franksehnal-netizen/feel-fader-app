// Regression probe (UX audit 2026-09-25, C-6): DAW users reach for
// Ctrl/Cmd+S and Ctrl/Cmd+Z. Ctrl/Cmd+S runs the primary Send action when
// there are unsaved changes (never the browser "Save page" dialog); Ctrl/Cmd+Z
// undoes the last config change outside text fields. Key capture (macro /
// navigation keys) must keep receiving these combos untouched.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

await p.evaluate(() => {
  window.__sends = 0;
  window.handleDirtyAction = () => { window.__sends++; };
  window.__key = (key, opts = {}, target = document.body) => {
    const ev = new KeyboardEvent('keydown', { key, code: 'Key' + key.toUpperCase(), bubbles: true, cancelable: true, ...opts });
    return !target.dispatchEvent(ev);   // true = default prevented
  };
});

const welcome = await p.evaluate(() => ({ prevented: __key('s', { ctrlKey: true }), sends: __sends }));
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(() => {
  const out = {};
  out.cleanSave = { prevented: __key('s', { ctrlKey: true }), sends: __sends };
  stepCtrl(0, 'fader1', 'cc', 1);
  out.dirtySave = { prevented: __key('s', { ctrlKey: true }), sends: __sends };
  out.metaSave = { prevented: __key('s', { metaKey: true }), sends: __sends };

  const ccBefore = cfg.banks[0].fader1.cc;
  const input = document.getElementById('section-title-0-fader1') || document.querySelector('input[type="text"]');
  input.focus();
  out.inputUndo = { prevented: __key('z', { ctrlKey: true }, input), cc: cfg.banks[0].fader1.cc, ccBefore };
  input.blur();

  out.undo = { prevented: __key('z', { ctrlKey: true }), cc: cfg.banks[0].fader1.cc, dirty };

  startKeyCapture(0, 'cw');
  const capturing = !!_keyCapture;
  const before = __sends;
  __key('s', { ctrlKey: true });
  out.capture = { capturing, sendsDuring: __sends - before, combo: keyComboLabel(cfg.banks[0].nav_keys_cw) };
  return out;
});
P('Ctrl+S on the welcome screen does not send', welcome.sends === 0, JSON.stringify(welcome));
P('Ctrl+S with no changes blocks the browser Save dialog and does not send', r.cleanSave.prevented && r.cleanSave.sends === 0, JSON.stringify(r.cleanSave));
P('Ctrl+S with unsaved changes runs the primary Send action', r.dirtySave.prevented && r.dirtySave.sends === 1, JSON.stringify(r.dirtySave));
P('Cmd+S does the same on macOS', r.metaSave.prevented && r.metaSave.sends === 2, JSON.stringify(r.metaSave));
P('during key capture Ctrl+S is captured as a key combo, not sent', r.capture.capturing && r.capture.sendsDuring === 0 && /S/.test(r.capture.combo), JSON.stringify(r.capture));
P('Ctrl+Z inside a text field stays native', !r.inputUndo.prevented && r.inputUndo.cc === r.inputUndo.ccBefore, JSON.stringify(r.inputUndo));
P('Ctrl+Z outside text fields undoes the last config change', r.undo.prevented && r.undo.cc === 11 && r.undo.dirty === false, JSON.stringify(r.undo));
await p.close();
await b.close();
