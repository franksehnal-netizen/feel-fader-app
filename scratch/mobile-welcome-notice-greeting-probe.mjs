// Phone welcome (Frank 2026-10-01, iPhone screenshot):
// - the unsupported-browser notice is a quiet line just above "Continue
//   without device" – no card – and the stage no longer reserves the top for it;
// - "Continue without device" greets with a visible "Welcome": on a phone the
//   controller never glides out of the center, so the hand-off greeting used to
//   sit hidden behind it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
await p.setViewport({ width:390, height:760, isMobile:true, hasTouch:true });
await p.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
await p.evaluateOnNewDocument(() => { try { delete Navigator.prototype.serial; } catch {} try { localStorage.setItem('ff-onboarded','1'); } catch {} });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await new Promise(r => setTimeout(r, 1200));

const n = await p.evaluate(() => {
  const el = document.getElementById('welcome-browser-notice'), cs = getComputedStyle(el);
  const r = el.getBoundingClientRect(), skip = document.querySelector('.welcome-skip').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  const stage = getComputedStyle(document.querySelector('.stage')).paddingTop;
  return { shown: el.classList.contains('show'), border: cs.borderTopWidth, bg: cs.backgroundColor,
    gapToSkip: Math.round(skip.top - r.bottom), belowButton: r.top >= btn.bottom, stage };
});
P('notice shows for a browser without Web Serial (precondition)', n.shown, JSON.stringify(n));
P('notice is plain text – no border, no card background', n.border === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(n.bg), JSON.stringify(n));
// The skip link is hidden on unsupported browsers (single "Try without device" CTA, 2026-10-01).
P('notice sits below the CTA', n.belowButton, JSON.stringify(n));
P('stage no longer reserves the top for the notice', n.stage === '0px', n.stage);

const ctrlTop0 = await p.evaluate(() => document.getElementById('device-img').getBoundingClientRect().top);
await p.evaluate(() => document.querySelector('.welcome-skip').click());
await new Promise(r => setTimeout(r, 1000));
const g = await p.evaluate(() => {
  const name = document.querySelector('#owner-greeting .owner-greeting-name');
  if (!name) return { missing: true };
  const r = name.getBoundingClientRect();
  // The greeting is pointer-events:none, which elementFromPoint() skips – lift that for the hit test.
  const greeting = document.getElementById('owner-greeting');
  greeting.style.pointerEvents = name.style.pointerEvents = 'auto';
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  greeting.style.pointerEvents = name.style.pointerEvents = '';
  return { text: name.textContent.trim(), onTop: !!hit && name.contains(hit) || hit === name, opacity: +getComputedStyle(document.getElementById('owner-greeting')).opacity };
});
// Ink bottom of "Welcome" touches the controller's top edge as it was at the welcome start
// (ctrlTop0, read before the click) – not pinned to the controller afterwards.
const ink = await p.evaluate(() => {
  const nm = document.querySelector('#owner-greeting .owner-greeting-name'), cs = getComputedStyle(nm);
  const c = document.createElement('canvas'), ctx = c.getContext('2d'); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = ctx.measureText(nm.textContent), r = nm.getBoundingClientRect();
  const lineH = parseFloat(cs.lineHeight), hl = (lineH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
  // r.top carries the fade-in translateY – read the layout offset instead.
  const top = nm.offsetTop;
  return { inkBottom: top + hl + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent, rectInkBottom: r.top + hl + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent };
});
P('greeting bottom edge touches the controller top edge (start position)', Math.abs(ink.inkBottom - ctrlTop0) <= 1.5 && Math.abs(ink.rectInkBottom - ctrlTop0) <= 1.5, JSON.stringify({ ...ink, ctrlTop0 }));
P('"Welcome" greeting is on top, not hidden behind the controller', !g.missing && g.text === 'Welcome' && g.onTop && g.opacity > 0.9, JSON.stringify(g));
// First-run onboarding on a phone: the beat copy scrolls under the pinned
// "Continue without device" – the link carries a fade band that starts below
// the Connect button, so the copy fades out instead of overlapping the link.
const p2 = await b.newPage(); p2.on('pageerror', e => errs.push(String(e)));
await p2.setViewport({ width:390, height:760, isMobile:true, hasTouch:true });
await p2.evaluateOnNewDocument(() => { try { delete Navigator.prototype.serial; } catch {} try { localStorage.removeItem('ff-onboarded'); } catch {} });
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
const o = await p2.evaluate(() => {
  const skip = document.querySelector('.welcome-skip'), cs = getComputedStyle(skip), r = skip.getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { onb: document.getElementById('welcome-text-block').classList.contains('welcome-onboarding'),
    floating: skip.classList.contains('welcome-skip-floating'), fade: cs.backgroundImage.includes('linear-gradient'),
    bandTop: Math.round(r.top), btnBottom: Math.round(btn.bottom) };
});
P('phone onboarding: pinned link fades the copy behind it', o.onb && o.floating && o.fade, JSON.stringify(o));
P('phone onboarding: the fade band starts below the Connect button', o.bandTop >= o.btnBottom, JSON.stringify(o));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
