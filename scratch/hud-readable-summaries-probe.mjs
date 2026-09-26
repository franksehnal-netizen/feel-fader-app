// Regression probe (UX audit 2026-09-25, C-2 + C-5; Frank chose variant C):
// the desktop Live HUD is a 144 px square with meter-sized type (value 20 px,
// roller 14 px, label/tech 10 px, tech in --t2), and every collapsed section
// header summarises its mapping again, like BUTTON already did.
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
  _ffConnected = true; _midiState = 'granted'; liveBank = 0;
  liveValues = { f1: 127, f2: 104 }; liveSeen = { f1: true, f2: true }; encLiveVal = 31;
  renderConnState(); renderLiveStrip();
  await new Promise(res => setTimeout(res, 700));
  const hud = document.getElementById('live-strip');
  const rect = hud.getBoundingClientRect();
  out.size = [Math.round(rect.width), Math.round(rect.height)];
  const px = sel => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
  out.fonts = { value: px('#live-f1-value'), roller: px('#live-roller-value'), label: px('.live-hud-item:not(.live-hud-roller) .live-hud-label'), tech: px('#live-f1-tech') };
  const probe = document.createElement('span'); probe.style.color = 'var(--t2)'; hud.appendChild(probe);
  out.techColor = getComputedStyle(document.getElementById('live-f1-tech')).color === getComputedStyle(probe).color;
  probe.remove();
  out.clipped = [...hud.querySelectorAll('.live-hud-item:not(.live-hud-roller) .live-hud-value, .live-hud-item:not(.live-hud-roller) .live-hud-tech')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.id);
  out.geo = [...hud.querySelectorAll('.live-hud-item:not(.live-hud-roller)')].map(item => ['.live-hud-label','.live-hud-value','.live-hud-tech'].map(s => { const q = item.querySelector(s).getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; }));
  out.overlap = [...hud.querySelectorAll('.live-hud-item:not(.live-hud-roller)')].some(item => {
    const l = item.querySelector('.live-hud-label').getBoundingClientRect(), v = item.querySelector('.live-hud-value').getBoundingClientRect();
    return l.bottom > v.top + 1;
  });
  out.clampX = clampLiveHudPos(99999, 200).x; out.maxX = window.innerWidth - 144 - 12;

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

P('desktop HUD is a 144 px square', r.size.join() === '144,144', r.size.join('×'));
P('HUD type is meter-sized (value 20, roller 14, label 10, tech 10 px)', r.fonts.value >= 20 && r.fonts.roller >= 14 && r.fonts.label >= 10 && r.fonts.tech >= 10, JSON.stringify(r.fonts));
P('HUD tech line uses --t2, not the faint --t3', r.techColor === true);
P('fader values and tech lines are not clipped', r.clipped.length === 0, r.clipped.join(','));
P('fader labels do not overlap their values', r.overlap === false, JSON.stringify(r.geo));
P('drag clamp uses the new 144 px size', r.clampX === r.maxX, `${r.clampX} vs ${r.maxX}`);
P('collapsed fader headers show channel and CC', r.f1 === 'Ch 1 · CC11' && r.f2 === 'Ch 1 · CC1', `${r.f1} | ${r.f2}`);
P('collapsed roller header shows articulations and CC', r.roller === '15 articulations · Ch 1 · CC32', r.roller);
P('fader summary follows a CC step without a full render', r.f1Stepped === 'Ch 1 · CC12', r.f1Stepped);
P('keyswitch mode summarises notes and range', /^12 keyswitches · Ch 1 · C-2–B-2$/.test(r.rollerKs), r.rollerKs);
P('typed keyswitch channel updates the summary', /Ch 4/.test(r.rollerKsCh), r.rollerKsCh);
P('relative CC mode summary', r.rollerRel === 'Relative · Ch 1 · CC32', r.rollerRel);
// M-1 (Frank chose the bigger square): the connected mobile HUD with bank dots
// is 112 px and its L/R label, value and Ch·CC line never overlap.
const pm = await b.newPage(); pm.on('pageerror',e=>errs.push(String(e)));
await pm.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await pm.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
const m = await pm.evaluate(async () => {
  skipWelcome(); activeBank = 0;
  applyLibraryPreset('Sonuscore LUX – Violins 1');
  _ffConnected = true; _midiState = 'granted'; liveBank = 0;
  liveValues = { f1: 87, f2: 104 }; liveSeen = { f1: true, f2: true }; ksLiveNote = 29;
  renderConnState(); render(); renderLiveStrip();
  await new Promise(res => setTimeout(res, 800));
  const hud = document.getElementById('live-strip'), rect = hud.getBoundingClientRect();
  const px = sel => parseFloat(getComputedStyle(hud.querySelector(sel)).fontSize);
  return {
    size: [Math.round(rect.width), Math.round(rect.height)],
    fonts: { label: px('.live-hud-item:not(.live-hud-roller) .live-hud-label'), value: px('#live-f1-value'), tech: px('#live-f1-tech') },
    overlaps: [...hud.querySelectorAll('.live-hud-item:not(.live-hud-roller)')].map(item => {
      const r = s => item.querySelector(s).getBoundingClientRect();
      return [r('.live-hud-label').bottom - r('.live-hud-value').top, r('.live-hud-value').bottom - r('.live-hud-tech').top].map(v => +v.toFixed(1));
    }),
  };
});
P('mobile HUD is a 112 px square', m.size.join() === '112,112', m.size.join('×'));
P('mobile HUD label, value and Ch·CC do not overlap', m.overlaps.flat().every(v => v <= 0), JSON.stringify(m.overlaps));
P('mobile HUD type is on the scale (label 10, value 12, tech 8 px)', m.fonts.label >= 10 && m.fonts.value >= 12 && m.fonts.tech >= 8, JSON.stringify(m.fonts));
P('no page errors', errs.length === 0, errs.join(' | '));
await pm.close();
await p.close();
await b.close();
