// Regression probe: Live HUD free manipulation (Frank + Sláv 2026-07-26).
// The floating live-values HUD can be dragged anywhere and toggled 1x<->2x via
// a corner button; position + size persist per-browser. Desktop only.
//   - default sits top-left just under the header
//   - corner button toggles the whole HUD to 2x (transform scale, everything
//     scales together and stays crisp)
//   - drag/keyboard set a free position, clamped inside the viewport, and it
//     cannot be pushed up under the top bar (top limit = header bottom + the
//     same margin used on the sides)
//   - position + size persist under ff_live_hud_pos and restore on reload
//   - Home / double-click reset to default
//   - glass matches the header exactly (no idle dimming) and left is animated
//     so reset / enlarge read as one smooth glide, not a jump-then-slide
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const near=(a,t,tol=1.5)=>Math.abs(a-t)<=tol;
const errs=[];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.removeItem('ff_live_hud_pos'); });
await p.evaluate(() => { try{skipWelcome&&skipWelcome()}catch(e){} _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); initLiveHudPositioning(); renderLiveStrip(); updateContextualLiveStrip(); document.getElementById('live-strip').classList.add('is-contextual-visible'); });
await new Promise(r => setTimeout(r, 500)); // settle the fade-in

// 1. Default placement: 112x112, top-left, just under the header
const def = await p.evaluate(() => {
  const s = document.getElementById('live-strip').getBoundingClientRect();
  const hb = document.querySelector('header').getBoundingClientRect().bottom;
  return { w: Math.round(s.width), h: Math.round(s.height), left: Math.round(s.left), top: Math.round(s.top), headerBottom: Math.round(hb) };
});
P('default HUD is 112x112', near(def.w,112) && near(def.h,112), JSON.stringify(def));
P('default sits top-left just under the header (~12px below)', near(def.left,28,2) && near(def.top, def.headerBottom+12, 2), JSON.stringify(def));

// 2. Size toggle -> 2x, then back
const sizes = await p.evaluate(async () => {
  toggleLiveHudSize();
  await new Promise(r=>setTimeout(r,450));
  const big = document.getElementById('live-strip').getBoundingClientRect();
  const scaleBig = getComputedStyle(document.getElementById('live-strip')).getPropertyValue('--hud-scale').trim();
  toggleLiveHudSize();
  await new Promise(r=>setTimeout(r,450));
  const small = document.getElementById('live-strip').getBoundingClientRect();
  return { bigW: Math.round(big.width), scaleBig, smallW: Math.round(small.width) };
});
P('corner button enlarges the whole HUD to 2x (~224px, --hud-scale 2)', near(sizes.bigW,224,2) && sizes.scaleBig==='2', JSON.stringify(sizes));
P('toggling again returns to 1x (~112px)', near(sizes.smallW,112,2), JSON.stringify(sizes));

// 3. Clamp: cannot be dragged up under the top bar; sides/bottom stay inside
const clamp = await p.evaluate(() => {
  const hb = document.querySelector('header').getBoundingClientRect().bottom;
  _liveHudState.large = false;
  const topTry = clampLiveHudPos(500, 0);      // dragged to the very top
  const leftTry = clampLiveHudPos(0, 400);     // dragged past the left edge
  const brTry = clampLiveHudPos(99999, 99999); // dragged off bottom-right
  return { headerBottom: Math.round(hb), topY: Math.round(topTry.y), leftX: Math.round(leftTry.x),
    brX: Math.round(brTry.x), brY: Math.round(brTry.y), vw: window.innerWidth, vh: window.innerHeight };
});
P('top limit is header bottom + side margin (cannot slide under the top bar)', clamp.topY === clamp.headerBottom + 12, JSON.stringify(clamp));
P('side margin matches (12px from the left edge)', clamp.leftX === 12, JSON.stringify(clamp));
P('bottom-right stays fully inside the viewport', clamp.brX === clamp.vw-112-12 && clamp.brY === clamp.vh-112-12, JSON.stringify(clamp));

// 4. Keyboard nudge sets a free custom position and persists it
const nudge = await p.evaluate(async () => {
  const strip = document.getElementById('live-strip');
  strip.focus();
  strip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,50));
  const saved = JSON.parse(localStorage.getItem('ff_live_hud_pos')||'null');
  return { inlineLeft: strip.style.left, savedX: saved && saved.x };
});
P('keyboard arrow moves to a free position and persists (ff_live_hud_pos)', !!nudge.inlineLeft && Number.isFinite(nudge.savedX), JSON.stringify(nudge));

// 5. Persistence across reload: set a custom pos + 2x, reload, confirm restored
await p.evaluate(() => { _liveHudState = { x: 620, y: 300, large: true }; applyLiveHudState(true); });
await p.reload({ waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome&&skipWelcome()}catch(e){} });
await new Promise(r=>setTimeout(r,200));
const restored = await p.evaluate(() => ({ x: _liveHudState.x, y: _liveHudState.y, large: _liveHudState.large,
  scale: getComputedStyle(document.getElementById('live-strip')).getPropertyValue('--hud-scale').trim() }));
P('position + size restore from localStorage on reload', restored.x===620 && restored.y===300 && restored.large===true && restored.scale==='2', JSON.stringify(restored));

// 6. Reset returns to default
const reset = await p.evaluate(() => {
  resetLiveHud();
  const strip = document.getElementById('live-strip');
  return { inlineLeft: strip.style.left, dataSide: strip.dataset.side, large: _liveHudState.large,
    saved: JSON.parse(localStorage.getItem('ff_live_hud_pos')||'null') };
});
P('reset clears custom position and size (back to default)', !reset.inlineLeft && reset.dataSide==='left' && reset.large===false && reset.saved && reset.saved.x===null, JSON.stringify(reset));

// 7. Glass matches the header exactly — no idle dimming (opacity 1 even when idle)
const glass = await p.evaluate(async () => {
  const strip = document.getElementById('live-strip');
  _liveHudState = { x:null, y:null, large:false }; applyLiveHudState();
  liveSeen.f1=false; liveSeen.f2=false; encLiveVal=null; ksLiveNote=null;
  renderLiveStrip(); updateContextualLiveStrip(); strip.classList.add('is-contextual-visible');
  await new Promise(r=>setTimeout(r,500));
  const hs = getComputedStyle(document.querySelector('header'));
  const ls = getComputedStyle(strip);
  return { idle: strip.classList.contains('is-idle'), hudOpacity: ls.opacity, headerOpacity: hs.opacity,
    sameBg: hs.background===ls.background, sameBackdrop: hs.backdropFilter===ls.backdropFilter,
    leftAnimated: ls.transitionProperty.includes('left') };
});
P('HUD glass matches header: full opacity even when idle (no dimming)', Math.abs(parseFloat(glass.hudOpacity)-1)<0.01 && glass.headerOpacity==='1', JSON.stringify(glass));
P('HUD and header share the same glass surface', glass.sameBg && glass.sameBackdrop, JSON.stringify(glass));
P('left is animated so reset/enlarge glide as one motion (no jump)', glass.leftAnimated, glass.leftAnimated);

// 8. Mobile: no free-manip controls (size button hidden)
const p2 = await b.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.setViewport({ width: 390, height: 844 });
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p2.evaluate(() => { try{skipWelcome&&skipWelcome()}catch(e){} });
const mobile = await p2.evaluate(() => ({ sizeBtnDisplay: getComputedStyle(document.getElementById('live-hud-size-btn')).display, desktop: liveHudDesktop() }));
P('mobile: size button is hidden and free-manip is off', mobile.sizeBtnDisplay==='none' && mobile.desktop===false, JSON.stringify(mobile));
await p2.close();

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
