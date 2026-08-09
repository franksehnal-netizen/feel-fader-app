// Regression probe: one validation error produces exactly ONE visible
// message, and showing it does not move anything on the page. Before
// 2026-08-08 a duplicate CC raised four signals at once (the #vbar banner,
// "1 issue to fix" next to the send button, a "Show error" relabel of the
// button itself, and the inline red line) and #vbar, as the first child of
// .center-col, pushed the whole page down so the cursor was no longer over
// the +/- stepper being clicked.
// Grows across three tasks: C1 inline height, C2 single signal, C3 dots.
// Spec: 2026-08-08-ui-backlog-design.md §C.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); toggleSection('fader1'); });
await new Promise(r => setTimeout(r, 300));

// Výška sekce se nesmí měnit tím, že se v ní objeví chyba. Měří se sekce
// samotná, ne pozice na stránce — tu v tuhle chvíli pořád posouvá #vbar
// (řeší Task C2).
const sectionH = () => p.evaluate(() =>
  document.querySelector('.bank-section[data-fader="fader1"]').getBoundingClientRect().height);

const heightBefore = await sectionH();

await p.evaluate(() => {
  cfg.banks[0].fader2.cc      = cfg.banks[0].fader1.cc;
  cfg.banks[0].fader2.channel = cfg.banks[0].fader1.channel;
  renderPanels(); runValidation();
});
await new Promise(r => setTimeout(r, 150));

const heightAfter = await sectionH();
P('section height is unchanged when the error appears', Math.abs(heightAfter - heightBefore) < 1,
  `before ${heightBefore.toFixed(1)} / after ${heightAfter.toFixed(1)}`);

const inline = await p.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const shown = [...document.querySelectorAll('.section-error')].filter(el => el.textContent.trim() && vis(el));
  return { count: shown.length, text: shown[0]?.textContent.trim() || '' };
});
P('exactly one visible inline error', inline.count === 1, `${inline.count}: ${inline.text}`);

const cleared = await p.evaluate(() => {
  cfg.banks[0].fader2.cc = (cfg.banks[0].fader1.cc + 1) % 128;
  renderPanels(); runValidation();
  return [...document.querySelectorAll('.section-error')].filter(el => el.textContent.trim()).length;
});
P('inline error clears when the conflict is fixed', cleared === 0, String(cleared));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
