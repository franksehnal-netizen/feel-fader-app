// Regression probe (spec 2026-09-30, firmware repo): CMD_EVT 0x01 (button macro
// fired) lights the Button ring (.is-held) for 350 ms on the controller-glow timing.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  – '+x:''}`);
await p.evaluate(() => { skipWelcome(); addBank(); });
await new Promise(r => setTimeout(r, 300));

const r = await p.evaluate(async () => {
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  _midiState = 'granted'; _ffConnected = true; _serialPort = {};
  activeBank = 0; liveBank = 0; render(); renderConnState();
  const ring = () => document.getElementById('section-live-macro');
  const held = () => !!ring()?.classList.contains('is-held');
  const evt = (bytes) => onMidiMsg({ data: new Uint8Array(bytes), timeStamp: performance.now() });
  const out = { exists: !!ring() };
  evt([0xF0,0x7D,0x01,0x08,0x01,0xF7]); out.lit = held();
  const dot = ring()?.querySelector('.section-live-dot');
  out.shadow = dot ? getComputedStyle(dot).boxShadow : '';
  out.transition = dot ? getComputedStyle(dot).transitionDuration : '';
  await sleep(250); evt([0xF0,0x7D,0x01,0x08,0x01,0xF7]);   // second press before the first expires
  await sleep(200); out.stillLit = held();                      // 450 ms after the first, 200 after the second
  await sleep(250); out.off = !held();
  evt([0xF0,0x7D,0x01,0x08,0x02,0xF7]); out.unknownEvt = held();
  evt([0xF0,0x7E,0x01,0x08,0x01,0xF7]); out.foreignMfr = held();
  activeBank = 1; render();
  evt([0xF0,0x7D,0x01,0x08,0x01,0xF7]); out.otherBank = held();
  return out;
});
P('CMD_EVT 0x01 lights the Button ring', r.lit === true, JSON.stringify(r));
P('ring carries a glow (box-shadow) on the link timing', r.shadow !== 'none' && r.transition.split(',').some(d => d.trim() === '1.3s'), `${r.shadow} | ${r.transition}`);
P('a second press keeps it lit (timer restarts, no flicker)', r.stillLit === true, JSON.stringify(r));
P('ring clears 350 ms after the last event', r.off === true, JSON.stringify(r));
P('unknown event byte is ignored', r.unknownEvt === false, JSON.stringify(r));
P('foreign manufacturer id is ignored', r.foreignMfr === false, JSON.stringify(r));
P('not on the device bank: no ring', r.otherBank === false, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
