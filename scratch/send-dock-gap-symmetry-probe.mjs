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
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });

// Hide the controller and let the .9s collapse transition finish (Task 6 slows this
// to 900ms — wait long enough to cover either the old 420ms or the new 900ms value).
await p.evaluate(() => toggleControllerVisibility(false));
await new Promise(r => setTimeout(r, 1000));

const gaps = await p.evaluate(() => {
  const header = document.querySelector('header');
  const callout = document.querySelector('.send-callout');
  const bankCard = document.querySelector('.bank-card');
  const hRect = header.getBoundingClientRect();
  const cRect = callout.getBoundingClientRect();
  const bRect = bankCard.getBoundingClientRect();
  return {
    above: Math.round(cRect.top - hRect.bottom),
    below: Math.round(bRect.top - cRect.bottom),
  };
});
P('Gap above and below the docked Send button match', gaps.above === gaps.below, JSON.stringify(gaps));
P('Gap is 32px on both sides', gaps.above === 32 && gaps.below === 32, JSON.stringify(gaps));

await p.close();
await b.close();
