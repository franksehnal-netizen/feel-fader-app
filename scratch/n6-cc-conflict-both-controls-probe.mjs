// Regression probe (UX audit 2026-09-28, N-6): a CC conflict is reported on BOTH
// controls of the pair, each worded from its own side – not only on the first
// one, while the section the composer is editing stays silent.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
p.on('dialog', d => d.accept());
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome()); await wait(1200);

const state = () => p.evaluate(() => {
  const txt = id => document.getElementById(id)?.textContent.trim() || '';
  const dot = key => !!document.querySelector(`.bank-section[data-fader="${key}"] .section-issue-dot`);
  return {
    f1: txt('err-b0-fader1'), f2: txt('err-b0-fader2'), roller: txt('err-b0-roller'),
    dots: ['fader1', 'fader2', 'roller'].filter(dot),
    f2Invalid: document.getElementById('b0-fader2-cc')?.getAttribute('aria-invalid'),
  };
});

await p.evaluate(() => {
  _openSections.add('fader1'); _openSections.add('fader2'); _openSections.add('roller');
  const bank = cfg.banks[0];
  bank.fader2.cc = bank.fader1.cc; bank.fader2.channel = bank.fader1.channel;
  dirty = true; render(); runValidation();
});
let s = await state();
P('fader conflict: error shown under Expression', /Expression/.test(s.f1) && /Dynamics/.test(s.f1), JSON.stringify(s));
P('fader conflict: error shown under Dynamics too', /Dynamics/.test(s.f2) && /Expression/.test(s.f2), JSON.stringify(s));
P('fader conflict: each message names its own control first', s.f1.indexOf('Expression') < s.f1.indexOf('Dynamics') && s.f2.indexOf('Dynamics') < s.f2.indexOf('Expression'), JSON.stringify(s));
P('fader conflict: both section headers carry the issue dot', s.dots.includes('fader1') && s.dots.includes('fader2'), JSON.stringify(s.dots));
P('fader conflict: Dynamics CC input is aria-invalid', s.f2Invalid === 'true', String(s.f2Invalid));

await p.evaluate(() => {
  const bank = cfg.banks[0];
  bank.fader2.cc = 1; bank.encoder.cc = bank.fader1.cc; bank.encoder.channel = bank.fader1.channel;
  render(); runValidation();
});
s = await state();
P('roller conflict: error shown in the roller section as well', s.roller.length > 0 && s.dots.includes('roller') && s.f1.length > 0, JSON.stringify(s));

await p.evaluate(() => { cfg.banks[0].encoder.cc = 32; render(); runValidation(); });
s = await state();
P('fixing the conflict clears every side', !s.f1 && !s.f2 && !s.roller && s.dots.length === 0, JSON.stringify(s));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
