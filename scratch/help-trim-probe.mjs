import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
// Macro panel (and its "?" hint) only renders once HID is enabled (pre-existing gate,
// unrelated to Task 2's diff) — flip it on headlessly so both hints are checkable.
await p.evaluate(()=>{ try{ DEVICE_INFO.hid_enabled = true; render&&render(); }catch(e){} });
const r = await p.evaluate(() => {
  const ids=['help-roller','help-macro','help-keyswitch','help-dev'].map(id=>[id,!!document.getElementById(id)]);
  const control=!!document.getElementById('help-control');
  const hints=document.querySelectorAll('.help-hint').length;
  const hasOpen=typeof openHelpAt==='function';
  return {ids,control,hints,hasOpen};
});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
r.ids.forEach(([id,ok])=>P(`#${id} exists`,ok));
P('#help-control REMOVED', r.control===false);
P('inline .help-hint controls remain removed', r.hints===0, String(r.hints));
P('openHelpAt is function', r.hasOpen);
// openHelpAt rozbalí Help + necrashne
const ok = await p.evaluate(()=>{ try{ openHelpAt('help-macro'); return document.getElementById('help-body').style.display!=='none'; }catch(e){ return 'ERR:'+e.message; } });
P('openHelpAt("help-macro") expands help', ok===true, String(ok));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
