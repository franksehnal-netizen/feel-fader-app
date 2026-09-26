// Regression probe (minimal hybrid, spec 2026-09-26 §2/§4): the edited bank is
// the flat selected pill; the bank the device is on carries a green dot in its
// tab and "· active on device" in the card eyebrow. The HUD keeps its bank dots.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
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
  const bank = document.getElementById('live-hud-bank');
  const hud = document.getElementById('live-strip');
  const dot = tabs[0].querySelector('.bank-tab-device-dot');
  const out = {
    activeIsSelected: tabs[2].classList.contains('active'),
    activeShadow: getComputedStyle(tabs[2]).boxShadow,
    activeBf: getComputedStyle(tabs[2]).backdropFilter,
    deviceTabs: tabs.map(t => t.classList.contains('is-on-device')),
    dotVisible: !!dot && getComputedStyle(dot).display !== 'none',
    dotColor: dot && getComputedStyle(dot).backgroundColor,
    deviceAria: tabs[0].getAttribute('aria-label'),
    hudDotCount: bank.querySelectorAll('.live-hud-bank-dot').length,
    hudActiveDot: bank.querySelectorAll('.live-hud-bank-dot.is-active').length,
    hudLabel: bank.getAttribute('aria-label'),
    bankCount: cfg.banks.length,
    hudBankDisplay: getComputedStyle(bank).display,
    hudVisible: hud.classList.contains('is-contextual-visible'),
    hudState: hud.dataset.state,
  };
  const probe = document.createElement('span'); probe.style.color = 'var(--green)'; document.body.appendChild(probe);
  out.green = getComputedStyle(probe).color; probe.remove();
  // Device follows a Program Change to the edited bank while the config is dirty.
  dirty = true; liveBank = 2; renderLiveStrip();
  out.afterPc = [...document.querySelectorAll('.bank-block-tab')].map(t => t.classList.contains('is-on-device'));
  out.eyebrowShown = !document.getElementById('bank-eyebrow-device')?.hidden;
  // Disconnect clears the marker.
  _ffConnected = false; _serialPort = null; renderConnState();
  out.afterDisconnect = [...document.querySelectorAll('.bank-block-tab')].some(t => t.classList.contains('is-on-device'));
  return out;
});
P('editing bank is the flat selected pill (hairline, no glass)', result.activeIsSelected && result.activeShadow !== 'none' && result.activeBf === 'none', JSON.stringify(result));
P('only the device bank tab carries the green device dot', result.deviceTabs.every((v,i)=>v===(i===0)) && result.dotVisible && result.dotColor === result.green, JSON.stringify(result));
P('device tab says "active on device" to assistive tech', /active on device/i.test(result.deviceAria || ''), result.deviceAria);
P('device dot follows a Program Change without a full render', result.afterPc.every((v,i)=>v===(i===2)), JSON.stringify(result.afterPc));
P('card eyebrow shows "active on device" for the device bank', result.eyebrowShown === true, String(result.eyebrowShown));
P('disconnect clears the device dot', result.afterDisconnect === false);
P('Live HUD maps the active physical bank immediately on connection', result.hudVisible && result.hudState === 'CONNECTED_LIVE' && result.hudBankDisplay === 'flex' && result.hudDotCount === result.bankCount && result.hudActiveDot === 1 && result.hudLabel === `Active device bank: 1 of ${result.bankCount}`, JSON.stringify(result));
await p.close();
await b.close();
