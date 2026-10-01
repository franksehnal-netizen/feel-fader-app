// Regression probe (UX audit 2026-09-25, C-5): every collapsed section header
// summarises its mapping, like BUTTON already did. (The Live HUD half of this
// probe went with the HUD, Frank 2026-10-01.)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(async () => {
  const out = {};
  activeBank = 0; _openSections.clear();
  cfg.banks[0].name = 'Bank 1';
  applyLibraryPreset('Spitfire BBC Symphony Orchestra');
  const summary = key => document.getElementById(`section-summary-0-${key}`)?.textContent.replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim() || '';
  out.f1 = summary('fader1'); out.f2 = summary('fader2'); out.roller = summary('roller');
  stepCtrl(0, 'fader1', 'cc', 1);
  out.f1Stepped = summary('fader1');
  setRollerMode(0, 'keyswitch');
  await new Promise(res => setTimeout(res, 400));
  out.rollerKs = summary('roller');
  onKs(0, 'ks_channel', 3);
  out.rollerKsCh = summary('roller');
  setRollerMode(0, 'cc_relative');
  await new Promise(res => setTimeout(res, 400));
  out.rollerRel = summary('roller');
  return out;
});

P('collapsed fader headers show channel and CC', r.f1 === 'Ch 1 · CC11' && r.f2 === 'Ch 1 · CC1', `${r.f1} | ${r.f2}`);
P('collapsed roller header shows articulations and CC', r.roller === '15 articulations · Ch 1 · CC32', r.roller);
P('fader summary follows a CC step without a full render', r.f1Stepped === 'Ch 1 · CC12', r.f1Stepped);
P('keyswitch mode summarises notes and range', /^12 keyswitches · Ch 1 · C-2 → B-2$/.test(r.rollerKs), r.rollerKs);
P('typed keyswitch channel updates the summary', /Ch 4/.test(r.rollerKsCh), r.rollerKsCh);
P('relative CC mode summary', r.rollerRel === 'Relative · Ch 1 · CC32', r.rollerRel);
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
