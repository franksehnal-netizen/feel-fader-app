// Regression: onDeviceConnected()'s auto-reconnect path (already-granted
// port, e.g. right after a page reload) retries serialReadInfo() once
// before showing "Couldn't sync with device" — a transient first-attempt
// failure (OS/browser still tearing down the previous page's serial reader)
// must not flash a scary red error on a device that's actually fine (Frank,
// 2026-08-10 HW test: "je to dobrý, jen na začátku mi to píše tuhle
// zprávu"). A PERSISTENT failure (both attempts reject) must still surface
// the toast — this isn't allowed to silently swallow a real disconnect.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });

// Case 1: first call rejects, second (the retry) resolves -> no toast, and
// the successful bootstrap's normal follow-through still runs.
const recovered = await p.evaluate(async () => {
  dirty = false;
  // navigator.serial is a native getter-only accessor — plain assignment
  // silently no-ops (sloppy-mode write to a non-writable property), leaving
  // the real (unavailable-in-headless) Serial object in place. defineProperty
  // shadows it with an own, configurable data property instead.
  Object.defineProperty(navigator, 'serial', { value: { getPorts: async () => [{}] }, configurable: true });
  let calls = 0;
  const origInfo = serialReadInfo;
  window.serialReadInfo = async () => {
    calls++;
    if (calls === 1) throw new Error('transient');
    // protocolVersion=2 + config_source='defaults' takes the showSyncBanner()
    // branch below, not the loadConfigFromDevice() one — this probe is only
    // about serialReadInfo()'s own retry, not the unstubbed real-port config
    // read loadConfigFromDevice() would otherwise reach for and fail on.
    DEVICE_INFO.config_source = 'defaults'; DEVICE_INFO.config_hash = null;
    protocolVersion = 2;
    return {};
  };
  document.getElementById('toasts').innerHTML = '';
  await onDeviceConnected();
  const toastCount = document.querySelectorAll('#toasts .toast.e').length;
  window.serialReadInfo = origInfo;
  return { calls, toastCount };
});
P('a transient first failure is retried (serialReadInfo called twice)', recovered.calls === 2, `calls=${recovered.calls}`);
P('no error toast when the retry succeeds', recovered.toastCount === 0, `toastCount=${recovered.toastCount}`);

// Case 2: both attempts reject -> the error toast still appears (real
// disconnect must not go silent).
const stillFails = await p.evaluate(async () => {
  dirty = false;
  // navigator.serial is a native getter-only accessor — plain assignment
  // silently no-ops (sloppy-mode write to a non-writable property), leaving
  // the real (unavailable-in-headless) Serial object in place. defineProperty
  // shadows it with an own, configurable data property instead.
  Object.defineProperty(navigator, 'serial', { value: { getPorts: async () => [{}] }, configurable: true });
  let calls = 0;
  const origInfo = serialReadInfo;
  window.serialReadInfo = async () => { calls++; throw new Error('persistent'); };
  document.getElementById('toasts').innerHTML = '';
  await onDeviceConnected();
  const toastEl = document.querySelector('#toasts .toast.e .toast-message');
  window.serialReadInfo = origInfo;
  return { calls, toastText: toastEl?.textContent || null };
});
P('a persistent failure still retries once then gives up (calls=2)', stillFails.calls === 2, `calls=${stillFails.calls}`);
P('a persistent failure still shows the "Couldn\'t sync" toast', stillFails.toastText === "Couldn't sync with device — showing local config", stillFails.toastText);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
