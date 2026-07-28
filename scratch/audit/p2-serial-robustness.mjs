// Audit probe P2 — serial transaction robustness. Real signatures verified by
// grep against feel-fader.html before writing this probe:
//   serialRequest(cmd, payload, timeoutMs)   feel-fader.html:4393
//   _readReply(port, v2, expect, rid, ms)    feel-fader.html:4414
//   _txnChain = Promise.resolve()            feel-fader.html:4272 (transaction serializer)
//   protocolVersion (1=legacy, 2=rid framing) feel-fader.html:4270
// _readReply's v2 wire format: "TYPE:rid:payload\n", TYPE in CFG|INFO|ACK|ERR;
// a frame whose rid !== the request's rid is discarded (feel-fader.html:4435)
// and the read loop keeps waiting for the next line.
//
// Poke pattern only (`_serialPort = {...}`) — navigator.serial.requestPort() is
// never called. A minimal queue-based fake port drives three fault cases: an
// ERR reply, a stale/foreign rid (followed by the real reply, proving the
// stale frame is discarded rather than mistaken for the answer), and total
// silence (timeout). Each fault case is followed by one well-formed control
// request through the SAME _txnChain to prove the serializer still accepts
// and resolves new work afterward (i.e. is not wedged).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });

const res = await p.evaluate(async ()=>{
  class FakePort {
    constructor(){ this._chunks=[]; this._resolvers=[]; this.onWrite=null; }
    push(str){
      const bytes = new TextEncoder().encode(str);
      if (this._resolvers.length) this._resolvers.shift()({ value: bytes, done:false });
      else this._chunks.push(bytes);
    }
    get readable(){ const self=this; return { getReader(){ return {
      read(){
        if (self._chunks.length) return Promise.resolve({ value: self._chunks.shift(), done:false });
        return new Promise((resolve)=>{ self._resolvers.push(resolve); });
      },
      releaseLock(){}
    };}}; }
    get writable(){ const self=this; return { getWriter(){ return {
      write(chunk){ self.onWrite && self.onWrite(chunk); return Promise.resolve(); },
      releaseLock(){}
    };}}; }
  }
  const ridOf = (chunk) => new TextDecoder().decode(chunk).trim().split(':')[1];

  const out = {};
  protocolVersion = 2; // enables rid framing / ERR / stale-rid handling in _readReply

  // --- Case 1: ERR frame --------------------------------------------------
  let port = new FakePort();
  port.onWrite = (chunk) => port.push(`ERR:${ridOf(chunk)}:boom\n`);
  _serialPort = port;
  try { await serialRequest('CMD_R', null, 500); out.err = 'resolved-unexpected'; }
  catch(e){ out.err = 'rejected: ' + e.message; }
  // control: chain must still accept a fresh request right after
  port = new FakePort();
  port.onWrite = (chunk) => port.push(`CFG:${ridOf(chunk)}:{}\n`);
  _serialPort = port;
  try { const r = await serialRequest('CMD_R', null, 500); out.errChainOk = (r === '{}'); }
  catch(e){ out.errChainOk = false; out.errChainErr = e.message; }

  // --- Case 2: stale/foreign rid, then the real reply ---------------------
  port = new FakePort();
  port.onWrite = (chunk) => {
    const rid = ridOf(chunk);
    port.push(`CFG:${Number(rid) + 999}:stale\n`);              // wrong rid — must be discarded
    setTimeout(() => port.push(`CFG:${rid}:{"ok":1}\n`), 50);   // correct rid follows
  };
  _serialPort = port;
  try { const r = await serialRequest('CMD_R', null, 1000); out.staleRid = (r === '{"ok":1}') ? 'resolved-correctly' : ('resolved-wrong:' + r); }
  catch(e){ out.staleRid = 'rejected: ' + e.message; }

  // --- Case 3: no response at all -> timeout ------------------------------
  port = new FakePort(); // onWrite left null: never replies
  _serialPort = port;
  const t0 = Date.now();
  try { await serialRequest('CMD_R', null, 300); out.timeout = 'resolved-unexpected'; }
  catch(e){ out.timeout = 'rejected: ' + e.message; }
  out.timeoutMs = Date.now() - t0;
  // control: chain must still accept a fresh request right after the timeout
  port = new FakePort();
  port.onWrite = (chunk) => port.push(`CFG:${ridOf(chunk)}:{}\n`);
  _serialPort = port;
  try { const r = await serialRequest('CMD_R', null, 500); out.timeoutChainOk = (r === '{}'); }
  catch(e){ out.timeoutChainOk = false; out.timeoutChainErr = e.message; }

  return out;
});

P('ERR frame -> serialRequest rejectuje', /^rejected/.test(res.err), JSON.stringify(res));
P('po ERR frame _txnChain přijme další request (nezaseknuto)', res.errChainOk===true, JSON.stringify(res));
P('stale/cizí rid je zahozen, korektní rid frame stále resolvne', res.staleRid==='resolved-correctly', JSON.stringify(res));
P('timeout -> serialRequest rejectuje v čase (< 2000ms)', /^rejected/.test(res.timeout) && res.timeoutMs < 2000, JSON.stringify(res));
P('po timeoutu _txnChain přijme další request (nezaseknuto)', res.timeoutChainOk===true, JSON.stringify(res));
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
