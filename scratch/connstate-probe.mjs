import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// helper: set signals + render, return {state, dotClass, text, noteHidden, live}
async function scenario(midi, ff, serial){
  return await p.evaluate((midi,ff,serial)=>{
    _midiState = midi; _ffConnected = ff; _serialPort = serial ? {} : null;
    const st = connState(); renderConnState();
    const dot = document.getElementById('h-status-dot');
    const txt = document.getElementById('h-status-text');
    const note= document.getElementById('live-note');
    return { st, dotClass: dot.className, text: txt.textContent, noteHidden: note.hidden, live: liveAllowed() };
  }, midi, ff, serial);
}
let r;
r=await scenario('granted', true, false);
P('CONNECTED_LIVE', r.st==='CONNECTED_LIVE' && /\bon\b/.test(r.dotClass) && r.noteHidden===true && r.live===true, JSON.stringify(r));
r=await scenario('pending', false, false);
P('DISCONNECTED (no device, loaded irrelevant)', r.st==='DISCONNECTED' && r.dotClass==='h-status-dot' && r.live===false, JSON.stringify(r));
r=await scenario('denied', false, true);
P('CONNECTED_BLIND (serial-only, midi denied)', r.st==='CONNECTED_BLIND' && /\bwarn\b/.test(r.dotClass) && r.noteHidden===false && r.live===false, JSON.stringify(r));
r=await scenario('denied', false, false);
P('MIDI_BLOCKED (denied, no link)', r.st==='MIDI_BLOCKED' && /\berr\b/.test(r.dotClass), JSON.stringify(r));
r=await scenario('unsupported', false, false);
P('MIDI_BLOCKED (unsupported)', r.st==='MIDI_BLOCKED' && /\berr\b/.test(r.dotClass) && /Chrome|Edge|available/i.test(r.text), JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
