import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 3500)); // past the old 3000ms collapse window

const r = await p.evaluate(() => {
  const txt = document.getElementById('h-status-text');
  return { hidden: txt.classList.contains('hidden'), text: txt.textContent, visible: txt.getBoundingClientRect().width > 0 };
});
P('Desktop "Connected" text is still visible 3.5s after connecting', !r.hidden && r.visible, JSON.stringify(r));

await p.close();
await b.close();
