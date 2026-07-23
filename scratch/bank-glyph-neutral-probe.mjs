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

// Mark bank 0 as live-on-device so its glyph renders, then read computed style.
const result = await p.evaluate(() => {
  _ffConnected = true; liveBank = 0; renderBankTabs();
  const glyph = document.querySelector('.bank-tab-device');
  if (!glyph) return { found: false };
  const cs = getComputedStyle(glyph);
  return { found: true, color: cs.color, opacity: cs.opacity };
});
P('Glyph renders when a bank is live-on-device', result.found, JSON.stringify(result));
P('Glyph is NOT green', result.found && !result.color.includes('52, 199') && !result.color.includes('96, 155'), result.color);
P('Glyph uses --t2 opacity .78 (not the old fully-opaque green)', result.found && Math.abs(parseFloat(result.opacity) - 0.78) < 0.01, result.opacity);

await p.close();
await b.close();
