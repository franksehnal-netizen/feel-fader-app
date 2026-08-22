// Regression probe: editing context belongs to the selected bank pill, while
// physical-device context belongs to the connected Live HUD. No second marker
// may remain in the bank tab strip; the HUD maps banks with dots instead.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const result = await p.evaluate(() => {
  addBank(); addBank();
  activeBank = 2;
  liveBank = 0;
  _midiState = 'granted';
  _ffConnected = true;
  render();
  renderConnState();
  const tabs = [...document.querySelectorAll('.bank-block-tab')];
  const active = tabs[2];
  const bank = document.getElementById('live-hud-bank');
  const hud = document.getElementById('live-strip');
  return {
    activeIsSelected: active.classList.contains('active'),
    activeShadow: getComputedStyle(active).boxShadow,
    anyDeviceMarkerInTabs: !!document.querySelector('.bank-tab-live-rail, .bank-tab-live-dot, .bank-block-tab.is-live'),
    hudDotCount: bank.querySelectorAll('.live-hud-bank-dot').length,
    hudActiveDot: bank.querySelectorAll('.live-hud-bank-dot.is-active').length,
    hudLabel: bank.getAttribute('aria-label'),
    bankCount: cfg.banks.length,
    hudBankDisplay: getComputedStyle(bank).display,
    hudVisible: hud.classList.contains('is-contextual-visible'),
    hudState: hud.dataset.state,
  };
});
P('editing bank remains the selected glass-pill context', result.activeIsSelected && result.activeShadow !== 'none', JSON.stringify(result));
P('bank tabs contain no device-live marker', !result.anyDeviceMarkerInTabs, JSON.stringify(result));
P('Live HUD maps the active physical bank immediately on connection', result.hudVisible && result.hudState === 'CONNECTED_LIVE' && result.hudBankDisplay === 'flex' && result.hudDotCount === result.bankCount && result.hudActiveDot === 1 && result.hudLabel === `Active device bank: 1 of ${result.bankCount}`, JSON.stringify(result));
await p.close();
await b.close();
