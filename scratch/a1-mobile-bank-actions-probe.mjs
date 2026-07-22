import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

const r = await p.evaluate(() => {
  const wrap = document.querySelector('.bank-actions');
  const btn = document.querySelector('.btn-remove-bank');
  const wrapRect = wrap.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return {
    viewportWidth: window.innerWidth,
    btnRight: btnRect.right, wrapRight: wrapRect.right,
    scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth
  };
});
P('Remove-bank button stays within its container', r.btnRight <= r.wrapRight + 1, JSON.stringify(r));
P('Remove-bank button stays within the viewport', r.btnRight <= r.viewportWidth, JSON.stringify(r));
P('.bank-actions has no horizontal overflow', r.scrollWidth <= r.clientWidth + 1, JSON.stringify(r));

await p.close();
await b.close();
