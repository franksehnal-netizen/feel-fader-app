import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
let failed = false;
const P=(l,ok,x='')=>{ console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`); if(!ok) failed=true; };

const live = await p.evaluate(async ()=>{
  _midiState='granted'; _ffConnected=true; liveValues.f1=73; liveSeen.f1=true; renderConnState();
  await new Promise(resolve => setTimeout(resolve, 240));
  const strip = document.getElementById('live-strip');
  const item = document.getElementById('live-f1-value').closest('.live-hud-item');
  return {
    state: strip.dataset.state,
    value: document.getElementById('live-f1-value').textContent,
    opacity: getComputedStyle(strip).opacity,
    visibility: getComputedStyle(strip).visibility,
    stateMarkers: strip.querySelectorAll('.live-hud-dot, .live-hud-state, #live-strip-state-label').length
  };
});
P('live strip exposes received hardware value', live.state==='CONNECTED_LIVE' && live.value==='73', JSON.stringify(live));
P('live HUD is visible without duplicate state markers', Number(live.opacity)>.85 && live.visibility==='visible' && live.stateMarkers===0, JSON.stringify(live));

const notLive = await p.evaluate(async ()=>{
  _midiState='denied'; _ffConnected=false; renderConnState();
  await new Promise(resolve => setTimeout(resolve, 340));
  const strip = document.getElementById('live-strip');
  return {state:strip.dataset.state,value:document.getElementById('live-f1-value').textContent,opacity:getComputedStyle(strip).opacity,visibility:getComputedStyle(strip).visibility};
});
P('not-live strip hides stale hardware value', notLive.state!=='CONNECTED_LIVE' && notLive.value==='—', JSON.stringify(notLive));
P('not-live HUD remains visible but subdued', Number(notLive.opacity)>.5 && Number(notLive.opacity)<.8 && notLive.visibility==='visible', JSON.stringify(notLive));
P('no page errors', errs.length===0, errs.join(' | '));

await b.close();
if(failed) process.exitCode=1;
