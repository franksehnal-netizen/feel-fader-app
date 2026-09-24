// In-app firmware update — offer (spec 2026-09-24 §6). Manifest is served by
// request interception; no real serial/HW.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

let manifest = { latest:'1.3.1', notes:'n', rescue_uf2:'x.uf2',
  files:[{ name:'ff_main.py', size:5, crc:'3610a686' }] };
let manifestStatus = 200;
await p.setRequestInterception(true);
p.on('request', r => {
  if (r.url().endsWith('/firmware/manifest.json')) {
    return r.respond({ status: manifestStatus, contentType:'application/json', body: JSON.stringify(manifest) });
  }
  r.continue();
});
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const state = () => p.evaluate(() => ({
  dot: !document.getElementById('fw-update-dot').hidden,
  row: !document.getElementById('fw-update-row').hidden,
  label: document.getElementById('fw-update-label').textContent,
}));
const setup = (fw, supported) => p.evaluate(async (fw, supported) => {
  skipWelcome(); protocolVersion = 2;
  DEVICE_INFO.firmware = fw; DEVICE_INFO.update = { supported, slot:'a' };
  await fetchFirmwareManifest();
}, fw, supported);

const cmp = await p.evaluate(() => [
  cmpFwVersion('1.3.0','1.3.1'), cmpFwVersion('1.10.0','1.9.9'), cmpFwVersion('1.3.0','1.3.0'), cmpFwVersion('2.0.0','1.99.99')]);
P('cmpFwVersion is numeric, not lexicographic', JSON.stringify(cmp) === '[-1,1,0,1]', JSON.stringify(cmp));

await setup('1.3.0', true);
let s = await state();
P('older firmware + supported → dot and row shown', s.dot && s.row, JSON.stringify(s));
P('row names the new version', s.label === 'Firmware 1.3.1 available', s.label);

await setup('1.3.1', true); s = await state();
P('same version → no offer', !s.dot && !s.row, JSON.stringify(s));

await setup('1.3.0', false); s = await state();
P('update.supported false → no offer', !s.dot && !s.row, JSON.stringify(s));

await setup('1.3.0', true);   // offer visible under v2 …
const legacy = await p.evaluate(async () => { protocolVersion = 1; renderFirmwareOffer(); return !document.getElementById('fw-update-row').hidden; });
P('legacy protocol (v1) → no offer', legacy === false);

manifestStatus = 404; await setup('1.3.0', true); s = await state();
P('manifest 404 → no offer, no error', !s.dot && !s.row && errs.length === 0, JSON.stringify(s));

manifestStatus = 200;
for (const bad of [
  { ...manifest, latest:'<img src=x onerror=alert(1)>' },
  { ...manifest, files:[{ name:'../code.py', size:5, crc:'3610a686' }] },
  { ...manifest, files:[] },
  { latest:'1.3.1' },
]) {
  manifest = bad; await setup('1.3.0', true); s = await state();
  P('invalid manifest rejected: ' + JSON.stringify(bad).slice(0, 50), !s.dot && !s.row, JSON.stringify(s));
}
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
