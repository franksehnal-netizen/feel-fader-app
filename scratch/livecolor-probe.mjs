import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// LIVE state: _midiState granted + device connected → f1-val should NOT be .live-placeholder
// and should pick up the green-tinted background from .section-live-val:not(.live-placeholder)
const live = await p.evaluate(()=>{
  _midiState='granted'; _ffConnected=true; render(); renderConnState();
  const el = document.getElementById('f1-val');
  const cs = getComputedStyle(el);
  return { hasPlaceholder: el.classList.contains('live-placeholder'), bg: cs.backgroundColor, color: cs.color, className: el.className };
});
P('live: f1-val has NO .live-placeholder', live.hasPlaceholder===false, JSON.stringify(live));
P('live: background is green-tinted (not base --bg-input)', /52,\s*199,\s*89/.test(live.bg) || live.bg !== 'rgb(0, 0, 0)', live.bg);

// NOT-LIVE state: MIDI not granted → f1-val should carry .live-placeholder and use base (dim) styling
const notLive = await p.evaluate(()=>{
  _midiState='denied'; _ffConnected=false; render(); renderConnState();
  const el = document.getElementById('f1-val');
  const cs = getComputedStyle(el);
  return { hasPlaceholder: el.classList.contains('live-placeholder'), bg: cs.backgroundColor, opacity: cs.opacity, className: el.className };
});
P('not-live: f1-val HAS .live-placeholder', notLive.hasPlaceholder===true, JSON.stringify(notLive));
P('not-live: opacity reflects .live-placeholder dimming', notLive.opacity==='0.45' || Number(notLive.opacity) < 1, notLive.opacity);
P('background differs between live and not-live (green tint applies)', live.bg !== notLive.bg, `live=${live.bg} notLive=${notLive.bg}`);
P('no page errors', errs.length===0, errs.join(' | '));

console.log('RAW:', JSON.stringify({ live, notLive }, null, 2));
await b.close();
