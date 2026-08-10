// Regression: in track_nav (HID) roller mode, the live-status ROLLER row
// must show the configured key combo instead of a blank dash. There is no
// live "key just triggered" signal available (see task doc) — this shows
// the static, currently-configured combo. Spec: 2026-08-10-todo-batch-design.md §7.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); _ffConnected = true; _midiState = 'granted'; });
await new Promise(r => setTimeout(r, 200));

const r = await p.evaluate(() => {
  setRollerMode(0, 'track_nav');
  cfg.banks[0].nav_keys_cw = [0x4F];  // ArrowRight
  cfg.banks[0].nav_keys_ccw = [0x50]; // ArrowLeft
  renderLiveStrip();
  return {
    value: document.getElementById('live-roller-value').textContent,
    expected: `${keyComboLabel([0x4F])} / ${keyComboLabel([0x50])}`,
  };
});
P('ROLLER value shows the configured nav key combo, not a dash', r.value === r.expected && r.value !== '—',
  `got="${r.value}" expected="${r.expected}"`);

const empty = await p.evaluate(() => {
  cfg.banks[0].nav_keys_cw = [];
  cfg.banks[0].nav_keys_ccw = [];
  renderLiveStrip();
  return document.getElementById('live-roller-value').textContent;
});
P('empty key lists fall back to keyComboLabel\'s own "—" per side', empty.includes('—'), empty);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
