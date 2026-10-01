// Connect & load intro motion (Frank 2026-10-01), through the REAL
// serialReadInfo() – only the serial line is mocked:
// - the welcome thumbs must not snap to the device snapshot while "Loading…"
//   (serialReadInfo() used to call positionThumbs(), leaving the connect
//   transition nothing to animate – read as a jump from the middle);
// - the settle then ramps in softly and lands at --dur-link-in, running on
//   through the 0.43 s layout swap (the glide starts mid-settle);
// - "Live positions unavailable" stays hidden through the whole intro and
//   only then fades in over 3 s.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.setViewport({ width:1512, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const motion = await p.evaluate(async () => {
  showWelcome(); await new Promise(requestAnimationFrame);
  const th = document.getElementById('thumb-l'), rail = document.getElementById('track-l');
  const y = () => th.getBoundingClientRect().top - rail.getBoundingClientRect().top;
  const deviceCfg = JSON.stringify(cfg);
  window._serialEnsureOpen = async () => {};
  window.serialRequest = async cmd => cmd === 'CMD_INFO'
    ? JSON.stringify({ schema_version:2, config_hash:'h', firmware:'1.4.0', faders:[127,0] }) : '';
  window.serialReadConfig = async () => deviceCfg;
  window.normalizeFwConfig = x => x;
  window.fetchFirmwareManifest = () => {};
  _serialPort = { getInfo: () => ({ usbProductId:1 }) };
  const start = y();
  await doStart();
  const afterLoad = y();                       // transition armed, settle not yet started (2 rAFs)
  const travel = rail.offsetHeight - th.querySelector('img').offsetHeight;
  const target = Math.round((1 - liveValues.f1 / 127) * travel);
  const t0 = performance.now();
  const at = async ms => { await new Promise(r => setTimeout(r, Math.max(0, t0 + ms - performance.now()))); return y(); };
  const early = await at(180);
  const swapped = await at(900);   // past the swap: still travelling, not snapped
  const late = await at(1400);
  return { start, afterLoad, target, early, swapped, late, f1: liveValues.f1 };
});
P('welcome thumbs stay put while the device loads (no snap before the transition)',
  Math.abs(motion.afterLoad - motion.start) < 1 && Math.abs(motion.target - motion.start) > 40, JSON.stringify(motion));
const progress = (motion.early - motion.start) / (motion.target - motion.start);
P('settle ramps in softly (≤15 % of the travel after ~150 ms)', progress >= 0 && progress <= 0.15, `${(progress * 100).toFixed(1)} %`);
const midProgress = (motion.swapped - motion.start) / (motion.target - motion.start);
P('settle keeps travelling through the layout swap (no snap)', midProgress > 0.3 && midProgress < 0.98, `${(midProgress * 100).toFixed(1)} %`);
P('settle lands on the device snapshot', Math.abs(motion.late - motion.target) < 1.5, JSON.stringify(motion));

const note = () => p.evaluate(() => {
  const el = document.getElementById('live-note');
  return { hidden: el.hidden, opacity: +getComputedStyle(el).opacity,
    held: document.body.classList.contains('live-note-held'), reveal: document.body.classList.contains('live-note-reveal') };
});
// No owner: intro ends at 0.43 s swap + max(glide 1.8 s, chrome 0.9 + 1.3 s) = 2.63 s.
await new Promise(r => setTimeout(r, 800));   // ≈ 2.2 s
const n1 = await note();
P('live note is on (CONNECTED_BLIND) but invisible during the intro', !n1.hidden && n1.opacity === 0 && n1.held, JSON.stringify(n1));
await new Promise(r => setTimeout(r, 1500));   // ≈ 3.7 s: 1.1 s into the 3 s fade
const n2 = await note();
P('live note fades in slowly once the intro has come to rest', n2.reveal && n2.opacity > 0 && n2.opacity < 1, JSON.stringify(n2));
await new Promise(r => setTimeout(r, 2400));   // ≈ 6.1 s
const n3 = await note();
P('live note fully in, reveal classes cleaned up', n3.opacity === 1 && !n3.held && !n3.reveal, JSON.stringify(n3));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
