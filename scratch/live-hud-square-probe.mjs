import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 800 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 500)); // let the position/visibility transition settle

const shape = await p.evaluate(() => {
  const strip = document.getElementById('live-strip');
  const cs = getComputedStyle(strip);
  return { hasCompact: strip.classList.contains('is-compact'), width: cs.width, height: cs.height, borderRadius: cs.borderRadius };
});
P('is-compact never gets added', !shape.hasCompact, JSON.stringify(shape));
P('Renders as a 112x112 square, not a pill', shape.width === '112px' && shape.height === '112px' && shape.borderRadius === '18px', JSON.stringify(shape));

const gap = await p.evaluate(() => {
  const strip = document.getElementById('live-strip');
  const header = document.querySelector('.top-sticky') || document.querySelector('header');
  return Math.round(strip.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
});
P('Position gap under header is still 12px (unchanged by the shape fix)', gap === 12, `gap=${gap}px`);

// Long articulation name still truncates gracefully instead of overflowing the card.
const longName = await p.evaluate(() => {
  const val = document.getElementById('live-roller-value');
  val.textContent = 'Sul Tasto Tremolo Long';
  val.classList.add('is-very-long');
  const rect = val.getBoundingClientRect();
  const cardRect = document.getElementById('live-strip').getBoundingClientRect();
  return { valueRight: rect.right, cardRight: cardRect.right, overflowsCard: rect.right > cardRect.right + 1 };
});
P('Long articulation name does not overflow the card', !longName.overflowsCard, JSON.stringify(longName));

await p.close();
await b.close();
