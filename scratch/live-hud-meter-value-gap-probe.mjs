// Regression probe for the unified live-status capsule: it shares the
// header glass surface, hides obsolete meters and fits the longest name.
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
  liveValues.f1 = 127; liveSeen.f1 = true;
  liveValues.f2 = 86; liveSeen.f2 = true;
  encLiveVal = 44;
  renderLiveStrip();
  updateContextualLiveStrip();
  await new Promise(resolve => setTimeout(resolve, 500));
  const hud = document.getElementById('live-strip');
  const meter = document.getElementById('live-f1-meter').closest('.live-hud-meter');
  const value = document.getElementById('live-roller-value');
  const hs = getComputedStyle(document.querySelector('header'));
  const ls = getComputedStyle(hud);
  const hr = hud.getBoundingClientRect();
  const mr = meter.getBoundingClientRect();
  hud.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  return {
    capsule: hud.classList.contains('is-compact') && Math.abs(hr.width-252) <= 1 && Math.abs(hr.height-46) <= 1,
    meterHidden: mr.width === 0 && mr.height === 0,
    valueFits: value.scrollWidth <= value.clientWidth + 1 && value.textContent === 'Short — Snap Pizzicato',
    sharedGlass: hs.background === ls.background && hs.backdropFilter === ls.backdropFilter && hs.boxShadow === ls.boxShadow,
    keyboardSnap: hud.dataset.side === 'right' && localStorage.getItem('ff_live_hud_side') === 'right',
  };
});

P('desktop status uses one horizontal capsule', r.capsule, r.capsule);
P('obsolete meter bars are hidden', r.meterHidden, r.meterHidden);
P('longest articulation fits without clipping', r.valueFits, r.valueFits);
P('status capsule and header share the same glass surface', r.sharedGlass, r.sharedGlass);
P('keyboard repositioning snaps and persists', r.keyboardSnap, r.keyboardSnap);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
