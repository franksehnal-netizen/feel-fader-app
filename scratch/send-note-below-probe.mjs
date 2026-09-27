// Regression probe (minimal hybrid, spec 2026-09-26 §8): on desktop the change
// note reads "N changes · Review" on one line under Send; nothing shifts when it
// appears; the change popover opens below the note; docked Send keeps the
// note on its left.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

const before = await p.evaluate(() => document.querySelector('.bank-card').getBoundingClientRect().top);
await p.evaluate(() => { stepCtrl(0, 'fader1', 'cc', 1); });
await wait(600);
const r = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return {
    text: document.getElementById('send-change-note').textContent.trim(),
    below: note.top >= btn.bottom, centered: Math.abs((note.left + note.right) / 2 - (btn.left + btn.right) / 2) < 2,
    oneLine: note.height < 24, cardTop: document.querySelector('.bank-card').getBoundingClientRect().top,
  };
});
P('note reads "1 change · Review"', r.text === '1 change · Review', r.text);
P('note sits centred under Send on one line', r.below && r.centered && r.oneLine, JSON.stringify(r));
P('showing the note does not shift the page', Math.abs(r.cardTop - before) < 1, `${before} → ${r.cardTop}`);
await p.evaluate(() => toggleChangePopover(true));
await wait(300);
const pop = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const popover = document.getElementById('change-popover').getBoundingClientRect();
  return { gap: popover.top - note.bottom };
});
P('change popover opens below the note, not over it', pop.gap >= 4, JSON.stringify(pop));
await p.evaluate(() => toggleChangePopover(false));
await p.evaluate(() => { document.getElementById('controller-toggle-input').click(); });
await wait(1500);
const docked = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { leftOf: note.right <= btn.left + 1, sameRow: Math.abs((note.top + note.bottom) / 2 - (btn.top + btn.bottom) / 2) < 3 };
});
P('docked Send keeps the note on its left', docked.leftOf && docked.sameRow, JSON.stringify(docked));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
