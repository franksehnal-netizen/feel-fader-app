import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });

// Wait briefly for the welcome screen to initialize and button to be created
await new Promise(r => setTimeout(r, 500));

// Force dark mode before the welcome screen has closed (skipWelcome not called).
const bg = await p.evaluate(() => {
  document.documentElement.classList.add('dark');
  const inner = document.querySelector('.welcome-inner');
  return getComputedStyle(inner).backgroundColor;
});
P('Welcome box has no background in dark mode', bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent', bg);

// Wordmark and button must still be present and visible (we removed the box, not the content).
const stillThere = await p.evaluate(() => {
  const wordmark = document.querySelector('.welcome-wordmark-text');
  const btn = document.getElementById('send-btn');
  const btnComputed = btn ? getComputedStyle(btn) : null;
  return {
    wordmarkVisible: !!wordmark && wordmark.offsetParent !== null,
    btnVisible: !!btn && btnComputed.display !== 'none' && btnComputed.visibility !== 'hidden' && btnComputed.opacity !== '0'
  };
});
P('Wordmark still renders', stillThere.wordmarkVisible, JSON.stringify(stillThere));
P('Connect button still renders', stillThere.btnVisible, JSON.stringify(stillThere));

await p.close();
await b.close();
