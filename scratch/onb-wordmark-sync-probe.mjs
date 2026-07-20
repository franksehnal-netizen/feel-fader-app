// Regression probe: welcome-screen onboarding intro (§3.1) — wordmark and
// .onb-beat-title occupy the same slot and are mutually exclusive; both
// must fade in perfect lockstep with .onb-beat-sub. Before the 2026-07-20
// fix, the wordmark<->title swap used an instant `visibility` toggle fired
// synchronously at click-time while title/sub eased over 300ms — the
// heading visibly snapped while the description faded (reported by Frank).
// Samples computed opacity every animation frame (no round-trip jitter) so
// a re-introduced desync shows up as a real per-frame value gap, not noise.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

async function sampleTransition(triggerExpr) {
  return p.evaluate((triggerExpr) => new Promise(resolve => {
    const w = document.getElementById('welcome-wordmark');
    const t = document.querySelector('.onb-beat-title');
    const s = document.querySelector('.onb-beat-sub');
    const samples = [];
    const t0 = performance.now();
    function tick() {
      const now = performance.now() - t0;
      samples.push({ w: +getComputedStyle(w).opacity, t: +getComputedStyle(t).opacity, s: +getComputedStyle(s).opacity });
      if (now < 550) requestAnimationFrame(tick);
      else resolve(samples);
    }
    // eslint-disable-next-line no-new-func
    new Function(triggerExpr)();
    requestAnimationFrame(tick);
  }), triggerExpr);
}

function worstDesync(samples) {
  let worst = 0;
  for (const f of samples) {
    worst = Math.max(worst, Math.abs(f.w - f.t), Math.abs(f.w - f.s), Math.abs(f.t - f.s));
  }
  return worst;
}

await p.evaluate(() => { onbStartWelcome(); });
let samples = await sampleTransition('onbBeatGo(1)');
let worst = worstDesync(samples);
P('beat0->beat1 (wordmark hides, title shows): opacity stays synced every frame', worst < 0.01, `worst per-frame diff ${worst.toFixed(4)}`);

await new Promise(r => setTimeout(r, 600));
samples = await sampleTransition('onbBeatGo(0)');
worst = worstDesync(samples);
P('beat1->beat0 (wordmark shows, title hides): opacity stays synced every frame', worst < 0.01, `worst per-frame diff ${worst.toFixed(4)}`);

await new Promise(r => setTimeout(r, 600));
samples = await sampleTransition('onbBeatGo(1); onbBeatGo(2)');
worst = worstDesync(samples);
P('rapid double-advance settles without desync', worst < 0.01, `worst per-frame diff ${worst.toFixed(4)}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
