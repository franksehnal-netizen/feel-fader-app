import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
// simulate "loaded config but device unplugged" — header must NOT say connected
const r = await p.evaluate(()=>{
  loaded = true; _ffConnected=false; _serialPort=null; _midiState='granted';
  renderConnState();
  const txt=document.getElementById('h-status-text').textContent;
  const dot=document.getElementById('h-status-dot').className;
  return { txt, dot, noConnected: !/connected/i.test(txt) || /no/i.test(txt) };
});
P('loaded+unplugged → not "connected"', r.dot==='h-status-dot' && /no device/i.test(r.txt), JSON.stringify(r));
// gone functions
const g = await p.evaluate(()=>({ setBanner: typeof setBanner, updateStatus: typeof updateStatus }));
P('setBanner removed', g.setBanner==='undefined', g.setBanner);
P('updateStatus removed', g.updateStatus==='undefined', g.updateStatus);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
