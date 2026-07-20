// Regression probe: C11 (functional audit 2026-07-20) — onDeviceConnected()
// used to gate ALL hash comparison behind `if (!dirty)`, so the typical
// "skip -> local edits -> plug in real hardware" flow never told the user
// the device might hold a different config. Fix: serialReadInfo() now runs
// unconditionally; while dirty it never auto-loads/overwrites (no
// showSyncBanner), it only surfaces a non-intrusive toast.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

async function runScenario(setup) {
  return p.evaluate(async (setup) => {
    document.getElementById('toasts').innerHTML = '';
    document.getElementById('sync-banner').hidden = true;
    navigator.serial.getPorts = async () => [{}];
    let loadCalled = false;
    window._origLoadConfigFromDevice = window.loadConfigFromDevice;
    window.loadConfigFromDevice = async () => { loadCalled = true; };
    const cfgBefore = JSON.stringify(cfg);
    window.serialReadInfo = async () => {
      protocolVersion = 2;
      DEVICE_INFO.config_source = setup.configSource;
      DEVICE_INFO.config_hash = setup.deviceHash;
      return {};
    };
    if (setup.storedHash === null) localStorage.removeItem(LS_HASH_KEY);
    else localStorage.setItem(LS_HASH_KEY, setup.storedHash);
    dirty = setup.dirty;
    await onDeviceConnected();
    const toastMsg = document.querySelector('#toasts .toast-message')?.textContent || '';
    const syncBannerShown = !document.getElementById('sync-banner').hidden;
    window.loadConfigFromDevice = window._origLoadConfigFromDevice;
    return { toastMsg, syncBannerShown, loadCalled, dirtyAfter: dirty, cfgUnchanged: JSON.stringify(cfg) === cfgBefore };
  }, setup);
}

// Scenario 1: dirty=true, device config_hash differs from last-known-sent hash.
const differsWhileDirty = await runScenario({ dirty: true, configSource: 'nvm', deviceHash: 'device-hash-AAA', storedHash: 'browser-hash-BBB' });
P('C11: dirty+differs never calls loadConfigFromDevice', differsWhileDirty.loadCalled === false, JSON.stringify(differsWhileDirty));
P('C11: dirty+differs never shows the destructive sync banner', differsWhileDirty.syncBannerShown === false, JSON.stringify(differsWhileDirty));
P('C11: dirty+differs shows a non-intrusive toast about the mismatch', /different saved configuration/i.test(differsWhileDirty.toastMsg), differsWhileDirty.toastMsg);
P('C11: dirty+differs leaves local edits (dirty) untouched', differsWhileDirty.dirtyAfter === true, String(differsWhileDirty.dirtyAfter));
P('C11: dirty+differs leaves cfg untouched', differsWhileDirty.cfgUnchanged === true, String(differsWhileDirty.cfgUnchanged));

// Scenario 2: dirty=true, device is still on factory defaults.
const defaultsWhileDirty = await runScenario({ dirty: true, configSource: 'defaults', deviceHash: null, storedHash: null });
P('C11: dirty+factory-defaults shows a distinct toast, not the sync banner', /factory settings/i.test(defaultsWhileDirty.toastMsg) && defaultsWhileDirty.syncBannerShown === false, JSON.stringify(defaultsWhileDirty));

// Scenario 3 (no regression): !dirty + differs still uses the existing sync banner, not a toast.
const differsWhileClean = await runScenario({ dirty: false, configSource: 'nvm', deviceHash: 'device-hash-AAA', storedHash: 'browser-hash-BBB' });
P('C11 no-regression: clean+differs still shows the sync banner (unchanged behavior)', differsWhileClean.syncBannerShown === true, JSON.stringify(differsWhileClean));
P('C11 no-regression: clean+differs does not also toast', differsWhileClean.toastMsg === '', differsWhileClean.toastMsg);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
