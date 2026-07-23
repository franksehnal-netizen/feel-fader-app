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

// CONNECTED_LIVE: text collapsed by default, has reveal-on-interact.
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
const liveState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('CONNECTED_LIVE gets reveal-on-interact, text collapsed by default', liveState.hasClass && liveState.maxWidth === '0px', JSON.stringify(liveState));

// Click reveals it.
await p.evaluate(() => document.getElementById('h-status').click());
const afterClick = await p.evaluate(() => {
  const txt = document.getElementById('h-status-text');
  return { maxWidth: getComputedStyle(txt).maxWidth, ariaExpanded: document.getElementById('h-status').getAttribute('aria-expanded') };
});
P('Click reveals the text', afterClick.maxWidth === '132px' && afterClick.ariaExpanded === 'true', JSON.stringify(afterClick));

// Outside click closes it again.
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})));
const afterOutside = await p.evaluate(() => getComputedStyle(document.getElementById('h-status-text')).maxWidth);
P('Outside click collapses it back', afterOutside === '0px', afterOutside);

// DISCONNECTED: no reveal-on-interact, text always visible.
await p.evaluate(() => { _ffConnected=false; _serialPort=null; connState(); renderConnState(); });
const disconnectedState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('DISCONNECTED has no reveal-on-interact, text stays visible', !disconnectedState.hasClass && disconnectedState.maxWidth === '132px', JSON.stringify(disconnectedState));

await p.close();
await b.close();
