// Regression probe (Frank 2026-09-30): after (re)connecting, the app shows the bank
// the device is currently on – not always Bank 1. loadConfigFromDevice() used to
// hard-reset activeBank = 0 right after serialReadInfo() had read the device bank.
// Unsaved edits (dirty) keep the edited bank, same as a hardware bank switch (C10).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

await p.evaluate(() => { skipWelcome(); addBank(); addBank(); });
await new Promise(r => setTimeout(r, 300));

// Load path: Connect & load / page reload / silent reconnect with a matching config.
async function loadScenario(setup) {
  return p.evaluate(async (setup) => {
    const deviceCfg = JSON.stringify(cfg);            // 3 banks
    const orig = { _serialEnsureOpen, serialReadInfo, serialReadConfig, normalizeFwConfig };
    window._serialEnsureOpen = async () => {};
    window.serialReadInfo = async () => { if (setup.infoFails) throw new Error('no info'); liveBank = setup.deviceBank; return {}; };
    window.serialReadConfig = async () => deviceCfg;
    window.normalizeFwConfig = x => x;
    _serialPort = { getInfo: () => ({ usbProductId: 1 }) };
    activeBank = 0; liveBank = setup.staleLiveBank ?? 0; dirty = false;
    await loadConfigFromDevice();
    Object.assign(window, orig);
    const tabs = [...document.querySelectorAll('.bank-block-tab')];
    return { activeBank, activeTab: tabs.findIndex(t => t.classList.contains('active')) };
  }, setup);
}

const onBank3 = await loadScenario({ deviceBank: 2 });
P('load: device on Bank 3 -> app shows Bank 3', onBank3.activeBank === 2 && onBank3.activeTab === 2, JSON.stringify(onBank3));
const outOfRange = await loadScenario({ deviceBank: 5 });
P('load: device bank index out of range -> Bank 1', outOfRange.activeBank === 0 && outOfRange.activeTab === 0, JSON.stringify(outOfRange));
const noInfo = await loadScenario({ infoFails: true, staleLiveBank: 2 });
P('load: CMD_INFO failed -> Bank 1, not a stale liveBank', noInfo.activeBank === 0 && noInfo.activeTab === 0, JSON.stringify(noInfo));

// Banner path: reconnect where the device config differs (no auto-load).
async function reconnectScenario(setup) {
  return p.evaluate(async (setup) => {
    document.getElementById('sync-banner').hidden = true;
    navigator.serial.getPorts = async () => [{}];
    const orig = { serialReadInfo, loadConfigFromDevice };
    window.loadConfigFromDevice = async () => {};
    window.serialReadInfo = async () => {
      protocolVersion = 2; DEVICE_INFO.config_source = 'nvm'; DEVICE_INFO.config_hash = 'device-AAA';
      liveBank = setup.deviceBank; return {};
    };
    localStorage.setItem(LS_HASH_KEY, 'browser-BBB');
    activeBank = 0; render();   // real serialReadInfo() renders; the mock doesn't
    dirty = setup.dirty;        // after render(): it clears dirty when cfg matches the synced snapshot (F-1)
    await onDeviceConnected();
    Object.assign(window, orig);
    const tabs = [...document.querySelectorAll('.bank-block-tab')];
    return { activeBank, activeTab: tabs.findIndex(t => t.classList.contains('active')),
             banner: !document.getElementById('sync-banner').hidden, dirty };
  }, setup);
}

const differs = await reconnectScenario({ dirty: false, deviceBank: 1 });
P('reconnect+differs: app shows the device bank (Bank 2) under the banner', differs.activeBank === 1 && differs.activeTab === 1 && differs.banner, JSON.stringify(differs));
const dirtyEdit = await reconnectScenario({ dirty: true, deviceBank: 2 });
P('reconnect with unsaved edits: edited bank stays (Bank 1)', dirtyEdit.activeBank === 0 && dirtyEdit.activeTab === 0 && dirtyEdit.dirty === true, JSON.stringify(dirtyEdit));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
