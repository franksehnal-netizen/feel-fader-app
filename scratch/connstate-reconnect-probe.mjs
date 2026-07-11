import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

// Reproduce: reconnect (device found) while there are unsaved edits (dirty=true) and
// navigator.serial reports an already-granted port. onDeviceConnected()'s
// `granted && dirty` branch returns early with NO renderConnState() call — so
// connectInputs() itself must be the one that leaves the header correct.
const r = await p.evaluate(async () => {
  // Stub serial permission as already granted (drives onDeviceConnected's granted=true path).
  navigator.serial = { getPorts: async () => [{}] };
  // Unsaved edits in progress — this is what forces onDeviceConnected's early return.
  dirty = true;
  // Simulate the moment right after physical replug: device was NOT yet marked connected.
  _ffConnected = false;
  _serialPort = null;
  _midiState = 'granted';

  // Minimal MIDI stub: one Feel Fader input, iterated via forEach exactly like connectInputs() does.
  midiAccess = {
    inputs: { forEach(cb) { cb({ name: 'Feel Fader', open: () => Promise.resolve(), onmidimessage: null }); } },
    outputs: { forEach(cb) { cb({ name: 'Feel Fader', open: () => Promise.resolve() }); } }
  };

  connectInputs();
  // Let onDeviceConnected()'s async chain (await navigator.serial.getPorts(), etc.) settle.
  await new Promise(res => setTimeout(res, 50));

  const dot = document.getElementById('h-status-dot');
  const txt = document.getElementById('h-status-text');
  return { state: connState(), dotClass: dot.className, text: txt.textContent, dirty };
});

P('connState() is CONNECTED_LIVE after reconnect-while-dirty', r.state === 'CONNECTED_LIVE', JSON.stringify(r));
P('header dot has "on" class (not bare/warn/err)', /\bon\b/.test(r.dotClass) && !/\bwarn\b/.test(r.dotClass) && !/\berr\b/.test(r.dotClass), r.dotClass);
P('header text is the connected string', r.text === 'device connected', r.text);
P('dirty flag preserved (sanity check on stub)', r.dirty === true, r.dirty);
P('no page errors', errs.length===0, errs.join(' | '));

console.log('RAW:', JSON.stringify(r, null, 2));
await b.close();
