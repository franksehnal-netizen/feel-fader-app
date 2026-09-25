// FEATURE_MIN_FW: cc_relative on firmware < 1.3.0 shows an inline note.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const noteFor = (fw) => p.evaluate((fw) => {
  skipWelcome(); activeBank = 0;
  DEVICE_INFO.firmware = fw;
  render();
  setRollerMode(0, 'cc_relative');   // same entry point as cc-relative-mode-selector-probe.mjs
  _openSections.add('roller');
  render();
  const n = document.querySelector('.fw-min-note');
  return n ? n.textContent : null;
}, fw);

let t = await noteFor('1.2.0');
P('cc_relative on 1.2.0 → note shown', !!t && t.includes('1.3.0') && t.includes('1.2.0'), t);
const radius = await p.evaluate(() => {
  const n = document.querySelector('.fw-min-note');
  return { note: getComputedStyle(n).borderRadius, token: getComputedStyle(document.documentElement).getPropertyValue('--r-sm').trim() };
});
P('.fw-min-note uses the --r-sm radius token, not a hardcoded value', radius.note === radius.token, JSON.stringify(radius));
t = await noteFor('1.3.0');
P('cc_relative on 1.3.0 → no note', t === null, t);
t = await noteFor(null);
P('unknown firmware (never connected) → no note', t === null, t);
t = await p.evaluate(() => { DEVICE_INFO.firmware = '<b>x</b>'; return featureFwWarning('cc_relative'); });
P('firmware string is escaped', !t.includes('<b>') && t.includes('&lt;b&gt;'), t);

const noUpdateAvailable = await p.evaluate(() => {
  FW_MANIFEST = null; DEVICE_INFO.update = null; protocolVersion = 1;
  DEVICE_INFO.firmware = '1.2.0';
  return featureFwWarning('cc_relative');
});
P('no available update → text only, no link', noUpdateAvailable.includes('Requires firmware') && !noUpdateAvailable.includes('<a '), noUpdateAvailable);

const opened = await p.evaluate(() => {
  DEVICE_INFO.firmware = '1.2.0';
  FW_MANIFEST = { latest: '1.3.1', notes: '', files: [] };
  DEVICE_INFO.update = { supported: true, slot: 'a' };
  protocolVersion = 2;
  render();
  document.querySelector('.fw-min-note a').click();
  return document.getElementById('device-settings-body').style.display !== 'none';
});
P('note link opens Device & Settings when an update is available', opened);
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
