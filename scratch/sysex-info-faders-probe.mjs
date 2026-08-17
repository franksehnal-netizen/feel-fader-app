// PR-003 (final review 2026-08-17): firmware sends sync-on-connect `faders`
// on both CMD_INFO paths (serial + SysEx), but handleSysEx() ignored it —
// only serialReadInfo applied it via applyInfoFaders(). Now both do.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const r = await p.evaluate(async () => {
  skipWelcome();
  liveValues.f1 = 0; liveValues.f2 = 0; liveSeen.f1 = false; liveSeen.f2 = false;
  const enc7 = (bytes) => { const out = []; for (const b of bytes) { out.push((b >> 7) & 1); out.push(b & 0x7F); } return out; };
  const info = { schema_version: 3, bank: 0, faders: [64, 90] };
  const payload = enc7(Array.from(new TextEncoder().encode(JSON.stringify(info))));
  const sysex = [0xF0, MFR, DEV_ID, CMD_INFO, ...payload, 0xF7];
  handleSysEx(sysex);
  await new Promise(r => setTimeout(r, 50));
  return { f1: liveValues.f1, f2: liveValues.f2, seen1: liveSeen.f1, seen2: liveSeen.f2 };
});
P('handleSysEx CMD_INFO applies faders[0] to liveValues.f1', r.f1 === 64, JSON.stringify(r));
P('handleSysEx CMD_INFO applies faders[1] to liveValues.f2', r.f2 === 90, JSON.stringify(r));
P('handleSysEx CMD_INFO marks both faders as seen (live)', r.seen1 === true && r.seen2 === true, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
