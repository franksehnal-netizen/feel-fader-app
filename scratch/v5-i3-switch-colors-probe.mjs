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

// HID toggle: check it, then read its track color.
await p.evaluate(() => { const hid = document.getElementById('hid-toggle'); hid.checked = true; hid.dispatchEvent(new Event('change')); });
await new Promise(r => setTimeout(r, 100));
const hidBg = await p.evaluate(() => {
  const track = document.getElementById('hid-toggle').nextElementSibling;
  return getComputedStyle(track).backgroundColor;
});
P('HID toggle track uses --green when on', hidBg.includes('52, 199, 89'), hidBg);

await p.close();
await b.close();
