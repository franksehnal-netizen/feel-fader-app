// Regression probe: C10 (functional audit 2026-07-20) — a hardware Program
// Change (bank-switch button on the device) used to unconditionally set
// activeBank = pc in onMidiMsg(), yanking the user's currently-open/edited
// bank out from under them mid-edit. Fix: liveBank always tracks hardware,
// activeBank only follows when the app has no unsaved edits (!dirty).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const whileDirty = await p.evaluate(() => {
  activeBank = 0;
  dirty = true;
  onMidiMsg({ data: [0xC0, 1, 0] });
  return { liveBank, activeBank, dirty };
});
P('PC while dirty: liveBank follows hardware', whileDirty.liveBank === 1, JSON.stringify(whileDirty));
P('PC while dirty: activeBank stays put (edit not interrupted)', whileDirty.activeBank === 0, JSON.stringify(whileDirty));

const whileClean = await p.evaluate(() => {
  dirty = false;
  onMidiMsg({ data: [0xC0, 2, 0] });
  return { liveBank, activeBank, dirty };
});
P('PC while clean: liveBank follows hardware', whileClean.liveBank === 2, JSON.stringify(whileClean));
P('PC while clean: activeBank syncs to hardware', whileClean.activeBank === 2, JSON.stringify(whileClean));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
