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

// Controller toggle starts checked by default — read its track color directly.
const controllerBg = await p.evaluate(() => {
  const track = document.querySelector('.controller-switch .hid-switch-track');
  return getComputedStyle(track).backgroundColor;
});
P('Controller-view switch track is NOT green when on', !controllerBg.includes('52, 199, 89') && !controllerBg.includes('34, 199'), controllerBg);

// HID toggle: set checked directly (no 'change' dispatch — onHidToggle() opens
// a confirmation dialog and reverts `checked` until confirmed; we're testing
// the CSS :checked track color, not the enable-HID confirmation flow).
await p.evaluate(() => { document.getElementById('hid-toggle').checked = true; });
const hidBg = await p.evaluate(() => {
  const track = document.getElementById('hid-toggle').nextElementSibling;
  return getComputedStyle(track).backgroundColor;
});
// Check for green color in either rgb(52, 199, 89) format or modern color(srgb ...) format
const isGreen = hidBg.includes('52, 199, 89') || (hidBg.includes('srgb') && (hidBg.includes('0.780392') || hidBg.includes('0.78')));
P('HID toggle track uses --green when on', isGreen, hidBg);

await p.close();
await b.close();
