import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

const r = await p.evaluate(() => {
  addBank(); render();   // Delete row only exists with > 1 bank
  const wrap = document.querySelector('.settings-group[data-group="bank"]');
  const btn = document.querySelector('.group-row[data-bank-action="delete"]');
  const wrapRect = wrap.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return {
    viewportWidth: window.innerWidth,
    btnRight: btnRect.right, wrapRight: wrapRect.right,
    scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth
  };
});
P('Delete bank row stays within its group', r.btnRight <= r.wrapRight + 1, JSON.stringify(r));
P('Delete bank row stays within the viewport', r.btnRight <= r.viewportWidth, JSON.stringify(r));
P('Bank group has no horizontal overflow', r.scrollWidth <= r.clientWidth + 1, JSON.stringify(r));

await p.close();
await b.close();
