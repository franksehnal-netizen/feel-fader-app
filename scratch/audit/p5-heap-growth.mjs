// Regression probe: JS heap / DOM node growth across a long session's worth
// of render/bank-switch/MIDI churn — proxy for leaked listeners or detached
// nodes accumulating in render() (feel-fader.html:2513), selectBank()
// (feel-fader.html:3276), and onMidiMsg() (feel-fader.html:4182).
//
// Signature check (grep, feel-fader.html):
//  - `function render() {` (2513) — no args.
//  - `function selectBank(i){ activeBank=i; renderPanels(); renderUacc();
//     runValidation(); setActiveTab(i); }` (3276) — takes a bank index.
//  - `function onMidiMsg(event){ const data=event.data, st=data[0]; ...`
//    (4182) — reads `event.data` as a byte array: data[0]=status byte,
//    data[1]=cc, data[2]=value (e.g. `if(cc===bank.fader1.cc && ...)` at
//    4193). This EXACTLY matches the skeleton's synthetic event
//    `{data:new Uint8Array([0xB0,11,i%127])}` (0xB0 = Control Change on
//    channel 0, cc=11, val=i%127) — no adaptation needed.
//  - `let cfg = _savedCfg || JSON.parse(...)` (2301), `let liveBank = 0`
//    (2303) — cfg.banks[liveBank] (used inside onMidiMsg, 4189) resolves to
//    cfg.banks[0], which exists in both the default and welcome-skipped demo
//    config, so onMidiMsg never hits its `if(!bank)return;` early-out.
//
// --js-flags=--expose-gc lets window.gc() force a collection right before
// each measurement, so the heap delta reflects retained (leaked) memory,
// not just garbage awaiting a GC pass.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox','--js-flags=--expose-gc'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });

const measure = async ()=>{ await p.evaluate(()=>{ if(window.gc) window.gc(); }); const m = await p.metrics(); return m.JSHeapUsedSize; };
const before = await measure();
const nodesBefore = await p.evaluate(()=>document.querySelectorAll('*').length);

await p.evaluate(async ()=>{
  for (let i=0;i<300;i++){
    render();
    if (typeof selectBank==='function') selectBank(i % (cfg.banks.length||1));
    if (typeof onMidiMsg==='function') onMidiMsg({ data:new Uint8Array([0xB0, 11, i%127]) });
  }
});
await new Promise(r=>setTimeout(r,300));

const after = await measure();
const nodesAfter = await p.evaluate(()=>document.querySelectorAll('*').length);
const growthMB = (after-before)/1048576;
const nodeGrowth = nodesAfter - nodesBefore;

console.log(`HEAP before=${(before/1048576).toFixed(1)}MB after=${(after/1048576).toFixed(1)}MB Δ=${growthMB.toFixed(1)}MB; DOM nodes Δ=${nodeGrowth}`);
P('heap po 300 cyklech neroste přes 10 MB', growthMB < 10, `Δ=${growthMB.toFixed(1)}MB`);
P('DOM nodes po 300 render cyklech nerostou (< 200)', nodeGrowth < 200, `Δ=${nodeGrowth} (before=${nodesBefore}, after=${nodesAfter})`);
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));

await b.close();
