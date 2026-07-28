// P1 Security — prototype-pollution via config import (launch audit 2026-07-28, Task 3).
// Asserts SAFE behavior: a device-backup JSON containing a "__proto__" key
// must not pollute Object.prototype when parsed and normalized through the
// app's real import path (JSON.parse -> normalizeFwConfig), the same two
// calls onImport(e) makes at line ~4633/4635.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
const res = await p.evaluate(()=>{
  const evil = '{"__proto__":{"polluted":true},"banks":[{"__proto__":{"polluted2":true},"fader1":{"cc":1,"channel":0,"__proto__":{"polluted3":true}},"fader2":{"cc":2,"channel":0},"encoder":{"cc":32,"channel":0},"uacc_values":[1]}]}';
  const parsed = JSON.parse(evil);   // same call as onImport: JSON.parse(ev.target.result)
  let normalized;
  try { normalized = normalizeFwConfig ? normalizeFwConfig(parsed) : parsed; } catch(e){}
  return {
    polluted: ({}).polluted === true,
    polluted2: ({}).polluted2 === true,
    polluted3: ({}).polluted3 === true,
    objProtoKeys: Object.keys(Object.prototype),
  };
});
P('Object.prototype není znečištěn top-level __proto__ klíčem', res.polluted===false, JSON.stringify(res));
P('Object.prototype není znečištěn __proto__ v banks[i]', res.polluted2===false, JSON.stringify(res));
P('Object.prototype není znečištěn __proto__ v banks[i].fader1', res.polluted3===false, JSON.stringify(res));
P('Object.prototype nemá žádné nové vlastní klíče', res.objProtoKeys.length===0, JSON.stringify(res.objProtoKeys));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
