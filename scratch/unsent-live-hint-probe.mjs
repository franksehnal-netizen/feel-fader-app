// Regression probe (Frank 2026-09-30): with unsent edits on the bank the device is
// on, the device still runs the last sent config, so its live values look wrong
// (reordered roller "skipped" a value until Send). Moving a control then shows one
// toast with a Send action – once per unsent change set, again after a Send.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);

await p.evaluate(() => { skipWelcome(); addBank(); });
await new Promise(r => setTimeout(r, 300));

const r = await p.evaluate(() => {
  _midiState = 'granted'; _ffConnected = true; _serialPort = {};
  activeBank = 0; liveBank = 0; dirty = false; markConfigSynced(); render(); renderConnState();
  const hints = () => [...document.querySelectorAll('#toasts .toast')]
    .filter(t => /last sent settings/i.test(t.querySelector('.toast-message')?.textContent || ''));
  const clear = () => { document.getElementById('toasts').innerHTML = ''; };
  const move = () => {
    const f = cfg.banks[liveBank].fader1;
    onMidiMsg({ data: new Uint8Array([0xB0 | f.channel, f.cc, 64]), timeStamp: performance.now() });
  };
  const edit = bi => { cfg.banks[bi].name = 'Edited ' + Math.random(); dirty = true; render(); };
  const out = {};
  clear(); move(); out.clean = hints().length;
  edit(0); clear(); move(); out.first = hints().length;
  out.action = hints()[0]?.querySelector('.toast-action')?.textContent || '';
  move(); move(); out.repeat = hints().length;
  dirty = false; markConfigSynced(); reflectDirty();            // Send succeeded
  edit(0); clear(); move(); out.afterSend = hints().length;
  dirty = false; markConfigSynced(); reflectDirty();
  edit(1); clear(); move(); out.otherBank = hints().length;     // edits only on a bank the device isn't on
  return out;
});
P('clean config: moving a control shows no hint', r.clean === 0, JSON.stringify(r));
P('unsent edits on the device bank: first move shows the hint', r.first === 1, JSON.stringify(r));
P('hint offers the Send action', r.action === 'Send to device', r.action);
P('further moves do not repeat the hint', r.repeat === 1, JSON.stringify(r));
P('after a Send, new unsent edits show the hint again', r.afterSend === 1, JSON.stringify(r));
P('edits only on another bank: no hint', r.otherBank === 0, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
