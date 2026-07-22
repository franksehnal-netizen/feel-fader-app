import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

// Make a dirty change so the "N unsaved changes" pill + popover exist.
await p.evaluate(() => { cfg.banks[0].fader1.cc = (cfg.banks[0].fader1.cc + 1) % 128; dirty = true; render(); reflectDirty(); });
await p.evaluate(() => toggleChangePopover());
await new Promise(r => setTimeout(r, 300));

const hit = await p.evaluate(() => {
  const btn = document.getElementById('change-undo-btn');
  const r = btn.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return { hitIsButton: el === btn, hitTag: el?.tagName, hitClass: el?.className };
});
P('Undo button is the actual hit target (not occluded)', hit.hitIsButton, JSON.stringify(hit));

await p.evaluate(() => document.getElementById('change-undo-btn').click());
await new Promise(r => setTimeout(r, 200));
const afterUndo = await p.evaluate(() => document.getElementById('change-popover').classList.contains('is-open'));
P('Clicking Undo closes the popover (undoLastConfigChange -> closeChangePopover)', afterUndo === false, `is-open after click: ${afterUndo}`);

await p.close();
await b.close();
