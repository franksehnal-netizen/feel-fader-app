// Regression probe: the compact Feel Fader wordmark stays fixed while each
// slide's title, description, and capability pills cross-fade in lockstep.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

async function sampleTransition(triggerExpr) {
  return p.evaluate((triggerExpr) => new Promise(resolve => {
    const t = document.querySelector('.onb-beat-title');
    const s = document.querySelector('.onb-beat-sub');
    const d = document.querySelector('.onb-beat-details');
    const samples = [];
    const t0 = performance.now();
    function tick() {
      const now = performance.now() - t0;
      samples.push({ t: +getComputedStyle(t).opacity, s: +getComputedStyle(s).opacity, d: +getComputedStyle(d).opacity });
      if (now < 550) requestAnimationFrame(tick);
      else resolve(samples);
    }
    // eslint-disable-next-line no-new-func
    new Function(triggerExpr)();
    requestAnimationFrame(tick);
  }), triggerExpr);
}

function worstDesync(samples) {
  let worst = 0, frame = null;
  for (const f of samples) {
    const delta = Math.max(Math.abs(f.t - f.s), Math.abs(f.t - f.d), Math.abs(f.s - f.d));
    if (delta > worst) { worst = delta; frame = f; }
  }
  return { worst, frame };
}

await p.evaluate(() => { onbStartWelcome(); });
const slides = await p.evaluate(async () => {
  const states = [];
  for (let index = 0; index < 4; index += 1) {
    onbBeatGo(index, true);
    await new Promise(requestAnimationFrame);
    states.push({
      title: document.querySelector('.onb-beat-title').textContent,
      details: [...document.querySelectorAll('.onb-detail-pill')].map(el => el.textContent),
      feature: document.getElementById('device-wrap').dataset.onbFeature,
      activeDot: [...document.querySelectorAll('.onb-dot')].findIndex(d => d.classList.contains('on')),
      rollerDisplay: getComputedStyle(document.getElementById('zone-roller')).display,
      buttonDisplay: getComputedStyle(document.getElementById('zone-macro')).display,
    });
  }
  return {
    states,
    dots: document.querySelectorAll('.onb-dot').length,
    userSelect: getComputedStyle(document.getElementById('onb-beats')).userSelect,
  };
});
P('four slides cover faders, roller modes, button actions, and app role',
  slides.dots === 4
    && slides.states.map(s => s.feature).join(',') === 'faders,roller,button,configure'
    && slides.states[0].title.includes('MIDI CCs')
    && slides.states[1].details.join('|').includes('Articulation CC')
    && slides.states[1].details.join('|').includes('Keyswitch')
    && slides.states[1].details.join('|').includes('Navigation')
    && slides.states[2].details.join('|').includes('Switch bank')
    && slides.states[2].details.join('|').includes('Run macro')
    && slides.states[3].title.includes('Perform'), JSON.stringify(slides));
P('roller and button slides highlight their matching hardware controls',
  slides.states[1].rollerDisplay !== 'none' && slides.states[2].buttonDisplay !== 'none', JSON.stringify(slides.states));
P('onboarding copy cannot be accidentally selected while swiping', slides.userSelect === 'none', slides.userSelect);
P('dot nav marks the 4th slide as current', slides.states[3].activeDot === 3, String(slides.states[3].activeDot));

let samples = await sampleTransition('onbBeatGo(1)');
let detail = worstDesync(samples);
P('beat0->beat1 copy and capability pills stay synced every frame', detail.worst < 0.01, `worst per-frame diff ${detail.worst.toFixed(4)} at ${JSON.stringify(detail.frame)}`);

await new Promise(r => setTimeout(r, 600));
samples = await sampleTransition('onbBeatGo(0)');
detail = worstDesync(samples);
P('beat1->beat0 copy and capability pills stay synced every frame', detail.worst < 0.01, `worst per-frame diff ${detail.worst.toFixed(4)} at ${JSON.stringify(detail.frame)}`);

await new Promise(r => setTimeout(r, 600));
samples = await sampleTransition('onbBeatGo(2); onbBeatGo(3)');
detail = worstDesync(samples);
P('rapid double-advance settles without desync', detail.worst < 0.01, `worst per-frame diff ${detail.worst.toFixed(4)} at ${JSON.stringify(detail.frame)}`);

const brand = await p.evaluate(() => {
  const el = document.getElementById('welcome-wordmark');
  return { text: el.textContent.trim(), opacity: +getComputedStyle(el).opacity, ariaHidden: el.getAttribute('aria-hidden') };
});
P('Feel Fader wordmark stays visible and static above every slide', brand.text === 'Feel Fader' && brand.opacity === 1 && brand.ariaHidden === 'false', JSON.stringify(brand));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
