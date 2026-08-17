// Regression probe for the unified live-status HUD: it shares the header
// glass surface, shows the fader level as a background wash, and truncates
// the longest name gracefully instead of overflowing the card.
// UPDATED 2026-07-23: Task 4 of Frank's UX polish plan replaced the
// horizontal is-compact capsule with a permanent 112x112 square (see
// scratch/live-hud-square-probe.mjs) — meter bars are no longer hidden,
// and long articulation names truncate via CSS ellipsis instead of
// always fitting untruncated.
// UPDATED 2026-08-17: the separate meter bar (.live-hud-meter) was replaced
// by a background wash on the item itself (::before, scaleY'd by the
// unitless --live-level-frac custom property set on #live-f1-item/
// #live-f2-item — option D of 4, Frank 2026-08-17). scaleY instead of a
// percentage height: percentage height on an absolutely positioned pseudo
// needs its containing block's height to be "specified", which a grid
// item's stretch-derived height isn't reliably treated as.
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
  const item = document.getElementById('live-f1-item');
  const value = document.getElementById('live-roller-value');
  const hs = getComputedStyle(document.querySelector('header'));
  const ls = getComputedStyle(hud);
  const hr = hud.getBoundingClientRect();
  const washFrac = parseFloat(item.style.getPropertyValue('--live-level-frac'));
  // 2026-07-26: keyboard arrows now NUDGE to a free position (Frank + Sláv's
  // free-manipulation feature), not snap to a left/right side. From the
  // default position ArrowRight sets an inline left and a custom position
  // persisted under the new ff_live_hud_pos key.
  hud.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  const cardRect = hud.getBoundingClientRect();
  const savedPos = JSON.parse(localStorage.getItem('ff_live_hud_pos') || 'null');
  return {
    square: !hud.classList.contains('is-compact') && Math.abs(hr.width-112) <= 1 && Math.abs(hr.height-112) <= 1,
    washVisible: washFrac > 0,
    valueOverflowsCard: value.getBoundingClientRect().right > cardRect.right + 1,
    sharedGlass: hs.background === ls.background && hs.backdropFilter === ls.backdropFilter && hs.boxShadow === ls.boxShadow,
    keyboardNudge: !!hud.style.left && !!savedPos && Number.isFinite(savedPos.x),
  };
});

P('desktop status is the permanent 112x112 square (not a compact capsule)', r.square, r.square);
P('fader level wash fill is visible behind the value', r.washVisible, r.washVisible);
P('longest articulation truncates gracefully without overflowing the card', !r.valueOverflowsCard, r.valueOverflowsCard);
P('status capsule and header share the same glass surface', r.sharedGlass, r.sharedGlass);
P('keyboard arrow nudges to a free position and persists (ff_live_hud_pos)', r.keyboardNudge, JSON.stringify(r.keyboardNudge));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
