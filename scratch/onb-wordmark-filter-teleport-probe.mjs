// Regression probe: clicking "Connect & load" during onboarding, at a short
// viewport (max-height:820px breakpoint, where .welcome-wordmark and
// .welcome-copy-stage switch to position:absolute), used to teleport the
// "FEEL FADER" wordmark from above the device to a stale
// --welcome-anchor-top offset well below it, the instant the ~720ms
// welcome-text-out fade-out animation started.
//
// Root cause: welcome-text-out used to animate `filter` (added as a fix for
// unrelated ghost-text-over-app issue). Per the CSS filter/containing-block
// spec, ANY non-none filter on an element — even blur(0px) — makes it a
// containing block for its position:fixed/absolute descendants. The instant
// #welcome-text-block got filter:blur(0px), it became the wordmark's
// containing block instead of #welcome-screen, and the wordmark's
// viewport-relative `top` calc got reinterpreted against
// #welcome-text-block's own (stale-offset) in-flow box.
// Fix: welcome-text-out animates opacity only, never filter (Frank
// 2026-08-16, confirmed via live frame-by-frame capture on real hardware:
// wordmark top jumped 24px -> 555px exactly when computed filter went
// none -> blur(0px)).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.setViewport({ width: 1366, height: 768 });   // common laptop res, under the 820px breakpoint
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => new Promise(resolve => {
  try { localStorage.setItem('ff-onboarded', '1'); } catch(_){}   // matches a returning user replaying onboarding
  showWelcome();
  onbStartWelcome();

  const wm = document.getElementById('welcome-wordmark');
  const startTop = wm.getBoundingClientRect().top;

  requestAnimationFrame(() => {
    const samples = [];
    const t0 = performance.now();
    function tick() {
      samples.push(Math.round(wm.getBoundingClientRect().top));
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
      else resolve({ startTop, samples });
    }
    requestAnimationFrame(tick);
    connectTransitionWelcome();
  });
}));

// Every sample must be either at the starting position (still visible) or 0
// (the welcome screen has since gone display:none, so getBoundingClientRect
// legitimately zeroes out) — never anything in between, which is what the
// stale-containing-block teleport produced (~555px while still "visible").
const badSamples = r.samples.filter(s => Math.abs(s - r.startTop) > 2 && s !== 0);
P('onboarding wordmark never teleports to a stale containing-block offset during connectTransitionWelcome() at a short viewport',
  badSamples.length === 0, `startTop=${r.startTop}, badSamples=${JSON.stringify(badSamples)}, allSamples=${JSON.stringify(r.samples)}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
