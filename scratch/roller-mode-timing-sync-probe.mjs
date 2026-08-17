// Regression: CL-1 (final review 2026-08-17). `.roller-mode-content`'s
// leave-transition animates opacity and transform together (both change on
// the same mode switch), but opacity used the `--dur-fast` token (.16s)
// while transform used a literal `.22s` — a leftover the 2026-08-17o
// timing-token sweep missed. setRollerMode()'s setTimeout(…,160) swaps the
// DOM content the instant opacity finishes, cutting the still-running
// transform short by 60ms — a visible stutter, exactly the "seamless"
// inconsistency class 08-17o targeted elsewhere. Fix: both properties share
// one token so they can never drift apart again.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  const el = document.createElement('div');
  el.className = 'roller-mode-content';
  document.body.appendChild(el);
  const durations = getComputedStyle(el).transitionDuration.split(',').map(s => s.trim());
  const props = getComputedStyle(el).transitionProperty.split(',').map(s => s.trim());
  el.remove();
  const opacityDur = durations[props.indexOf('opacity')];
  const transformDur = durations[props.indexOf('transform')];
  return { opacityDur, transformDur };
});

P('.roller-mode-content opacity and transform share the same transition duration', r.opacityDur === r.transformDur, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
