// Bug: .response-select-menu{display:grid} had no [hidden]/closed-state
// override, so the dropdown was ALWAYS visually rendered regardless of the
// `hidden` attribute the JS toggles — it also pushed .info-row taller,
// which is why the "Fader response" label looked vertically off (centered
// against the whole open menu's height, not just the trigger button).
// Fix: menu defaults to display:none, only .response-select.is-open shows
// it, and it's position:absolute so it never affects row layout. Frank
// report 2026-08-27.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  DEVICE_INFO.fader_response_presets = true;
  updateFaderResponseControl();
  const menu = document.getElementById('fader-response-menu');
  const row = document.querySelector('#fader-response-select').closest('.info-row');
  const label = row.querySelector('.info-lbl');

  const closedVisible = getComputedStyle(menu).display !== 'none';
  const closedRowHeight = row.getBoundingClientRect().height;

  toggleFaderResponseMenu();
  const openVisible = getComputedStyle(menu).display !== 'none';
  const openRowHeight = row.getBoundingClientRect().height;
  const menuPosition = getComputedStyle(menu).position;

  toggleFaderResponseMenu();
  const closedAgainVisible = getComputedStyle(menu).display !== 'none';

  return { closedVisible, closedRowHeight, openVisible, openRowHeight, menuPosition, closedAgainVisible };
});

P('menu is hidden (display:none) while closed', r.closedVisible === false, JSON.stringify(r));
P('menu becomes visible after toggling open', r.openVisible === true, JSON.stringify(r));
P('menu is positioned absolute (does not push row layout)', r.menuPosition === 'absolute', r.menuPosition);
P('opening the menu does not change the row height', Math.abs(r.openRowHeight - r.closedRowHeight) < 0.5, JSON.stringify(r));
P('menu hides again after toggling closed', r.closedAgainVisible === false, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
