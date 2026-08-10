// Regression: the ART row's live-hud-tech line ("Ch1·CC32") must not shift
// vertically when the articulation name above it changes length and picks
// up .is-long/.is-very-long (font-size drops 9px -> 8.25px -> 7.5px). Before
// this fix, line-height was 'normal' (font-size-relative), so row 1's auto
// grid height changed with it. Spec: 2026-08-10-todo-batch-design.md §1.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  skipWelcome();
  _ffConnected = true; _midiState = 'granted';
  // Drive both states through the real renderLiveStrip() code path (not by
  // hand-writing textContent/classList afterward — that bypasses the actual
  // is-long/is-very-long computation and can mask or fake the bug). Use real
  // UACC_NAMES entries: value 1 = 'Legato' (6 chars, plain), value 26 =
  // 'Long — Sul Ponticello' (22 chars, triggers is-very-long) — the exact
  // pairing TODO #2 itself names ("Short — D…" ↔ "Long — Sul...").
  // .live-hud has CSS transitions up to .38s (width/height/padding/border-radius)
  // and .36s (transform/top/left) — wait 600ms after each render, comfortably
  // past all of them, or the measurement catches the HUD's own reveal/reposition
  // transition mid-flight and reports a false difference unrelated to row height.
  encLiveVal = 1;
  renderLiveStrip();
  await new Promise(res => setTimeout(res, 600));
  const techShort = document.getElementById('live-roller-tech').getBoundingClientRect().top;

  encLiveVal = 26;
  renderLiveStrip();
  await new Promise(res => setTimeout(res, 600));
  const techLong = document.getElementById('live-roller-tech').getBoundingClientRect().top;

  return { techShort, techLong };
});

P('live-roller-tech row does not move when the value becomes .is-very-long',
  Math.abs(r.techLong - r.techShort) < 0.5, `short=${r.techShort} long=${r.techLong}`);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
