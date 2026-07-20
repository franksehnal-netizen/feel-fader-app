// Regression probe: physical device disconnect must clear _serialPort so
// connState() doesn't keep reporting CONNECTED_BLIND forever (C7,
// functional-audit finding 2026-07-20). connState()'s `linked` check treats
// ANY truthy _serialPort as "linked" — but nothing cleared it on a real
// disconnect (only a failed serial write's catch block did, eventually).
// initSerialDisconnectWatch() wires the Web Serial 'disconnect' event, the
// authoritative signal a port is actually gone.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const result = await p.evaluate(() => {
  if (!navigator.serial) return { skipped: true };
  _ffConnected = false;
  const fakePort = {};
  _serialPort = fakePort;
  const stateBefore = connState();
  const ev = new Event('disconnect');
  Object.defineProperty(ev, 'target', { value: fakePort });
  navigator.serial.dispatchEvent(ev);
  return { skipped: false, stateBefore, stateAfter: connState(), serialPortAfter: _serialPort };
});

if (result.skipped) {
  console.log('SKIP  navigator.serial unavailable in this browser — cannot test');
} else {
  P('stale _serialPort falsely reports CONNECTED_BLIND before disconnect fires', result.stateBefore === 'CONNECTED_BLIND', result.stateBefore);
  P('disconnect event clears _serialPort', result.serialPortAfter === null, String(result.serialPortAfter));
  P('connState() no longer reports linked after disconnect', result.stateAfter !== 'CONNECTED_BLIND' && result.stateAfter !== 'CONNECTED_LIVE', result.stateAfter);
}
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
