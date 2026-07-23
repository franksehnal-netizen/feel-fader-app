import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// Exact px-string equality on a value coming out of a live CSS transition is
// fragile: under load (e.g. deep in the full batch run) the 450ms wait can
// still land a hair before the .4s transition's asymptotic tail fully
// settles, reading e.g. "0.03px" instead of "0px" — a real, harmless
// sub-pixel remnant, not a functional failure. Compare numerically with a
// tolerance instead (discovered 2026-07-23 investigating an unrelated fix,
// reproduced 2/3 runs outside the batch too).
const near = (px, target, tol = 0.5) => Math.abs(parseFloat(px) - target) <= tol;

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

// CONNECTED_LIVE: text collapsed by default, has reveal-on-interact.
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 450)); // Wait for 0.4s transition to settle
const liveState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('CONNECTED_LIVE gets reveal-on-interact, text collapsed by default', liveState.hasClass && near(liveState.maxWidth, 0), JSON.stringify(liveState));

// Click reveals it.
await p.evaluate(() => document.getElementById('h-status').click());
await new Promise(r => setTimeout(r, 450)); // Wait for 0.4s transition to settle
const afterClick = await p.evaluate(() => {
  const txt = document.getElementById('h-status-text');
  return { maxWidth: getComputedStyle(txt).maxWidth, ariaExpanded: document.getElementById('h-status').getAttribute('aria-expanded') };
});
P('Click reveals the text', near(afterClick.maxWidth, 132) && afterClick.ariaExpanded === 'true', JSON.stringify(afterClick));

// Outside click closes it again.
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})));
await new Promise(r => setTimeout(r, 450)); // Wait for 0.4s transition to settle
const afterOutside = await p.evaluate(() => getComputedStyle(document.getElementById('h-status-text')).maxWidth);
P('Outside click collapses it back', near(afterOutside, 0), afterOutside);

// DISCONNECTED: no reveal-on-interact, text always visible.
await p.evaluate(() => { _ffConnected=false; _serialPort=null; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 450)); // Wait for 0.4s transition to settle
const disconnectedState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('DISCONNECTED has no reveal-on-interact, text stays visible', !disconnectedState.hasClass && near(disconnectedState.maxWidth, 132), JSON.stringify(disconnectedState));

await p.close();
await b.close();
