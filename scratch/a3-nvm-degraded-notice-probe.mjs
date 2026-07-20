// Regression probe: A3 (functional audit 2026-07-20) — when both firmware
// NVM slots fail, the device silently falls back to a bundled file-backed
// preset (config_source==='file'). Before this fix the app treated that
// exactly like a healthy 'nvm' state — no indication that persisted writes
// might not survive a power cycle, one step closer to a silent factory
// reset. updateNvmDegradedNotice() shows a gentle, non-blocking notice
// (distinct from the destructive-action sync banner used for 'defaults')
// whenever connected and config_source === 'file'.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const fileWhileConnected = await p.evaluate(() => {
  _serialPort = {};
  DEVICE_INFO.config_source = 'file';
  renderConnState();
  return { hidden: document.getElementById('nvm-degraded-notice').hidden };
});
P('config_source=file + connected: notice is shown', fileWhileConnected.hidden === false, JSON.stringify(fileWhileConnected));

const nvmWhileConnected = await p.evaluate(() => {
  DEVICE_INFO.config_source = 'nvm';
  renderConnState();
  return { hidden: document.getElementById('nvm-degraded-notice').hidden };
});
P('config_source=nvm + connected: notice stays hidden', nvmWhileConnected.hidden === true, JSON.stringify(nvmWhileConnected));

const defaultsWhileConnected = await p.evaluate(() => {
  DEVICE_INFO.config_source = 'defaults';
  renderConnState();
  return { hidden: document.getElementById('nvm-degraded-notice').hidden };
});
P('config_source=defaults + connected: notice stays hidden (distinct from sync banner)', defaultsWhileConnected.hidden === true, JSON.stringify(defaultsWhileConnected));

const fileWhileDisconnected = await p.evaluate(() => {
  DEVICE_INFO.config_source = 'file';
  _serialPort = null;
  _ffConnected = false;
  renderConnState();
  return { hidden: document.getElementById('nvm-degraded-notice').hidden };
});
P('config_source=file but disconnected: notice hides (stale state not shown)', fileWhileDisconnected.hidden === true, JSON.stringify(fileWhileDisconnected));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
