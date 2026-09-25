// In-app firmware update — full flow against a simulated device on a fake
// serial port (pattern from scratch/audit/p2-serial-robustness.mjs). Firmware
// files come from request interception. No real serial / HW.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const MAIN = 'x'.repeat(1300);            // 3 chunks (512+512+276)
let fileBody = MAIN;
await p.setRequestInterception(true);
p.on('request', r => {
  if (r.url().endsWith('/firmware/1.3.1/ff_main.py')) return r.respond({ status:200, contentType:'text/plain', body:fileBody });
  r.continue();
});
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const crc = await p.evaluate(() => crc32Hex(new TextEncoder().encode('123456789')));
P('crc32Hex standard check value', crc === 'cbf43926', crc);

// Runs one update against a simulated device. opts.dropAckOnce: swallow the
// first CMD_UC ACK (forces timeout → retransmit → ERR:offset resync);
// opts.errOn: reply ERR to that command; opts.neverAckOffset: swallow every
// CMD_UC ACK at that byte offset (forces retry-exhaustion via repeated
// timeouts); opts.chunkTimeoutMs: overrides FW_CHUNK_TIMEOUT_MS for the run
// so timeout-heavy cases don't need to wait out the real 3000 ms default.
const run = (opts) => p.evaluate(async (MAIN, opts) => {
  skipWelcome(); protocolVersion = 2;
  DEVICE_INFO.firmware = '1.3.0'; DEVICE_INFO.update = { supported:true, slot:'a' };
  FW_MANIFEST = { latest:'1.3.1', notes:'', files:[{ name:'ff_main.py', size:MAIN.length,
    crc: crc32Hex(new TextEncoder().encode(MAIN)) }] };
  FW_CHUNK_TIMEOUT_MS = opts.chunkTimeoutMs || 3000;
  FW_END_TIMEOUT_MS = opts.endTimeoutMs || 10000;
  const dev = { cmds:[], ucOffsets:[], file:'', ended:false, dropped:false };
  class FakePort {
    constructor(){ this._chunks=[]; this._resolvers=[]; }
    push(str){ const v=new TextEncoder().encode(str);
      if (this._resolvers.length) this._resolvers.shift()({ value:v, done:false }); else this._chunks.push(v); }
    get readable(){ const s=this; return { getReader(){ return {
      read(){ return s._chunks.length ? Promise.resolve({ value:s._chunks.shift(), done:false })
        : new Promise(r => s._resolvers.push(r)); },
      releaseLock(){}, cancel(){ s._resolvers.splice(0).forEach(r => r({ value:undefined, done:true })); } }; } }; }
    get writable(){ const s=this; return { getWriter(){ return {
      write(chunk){ s.onLine(new TextDecoder().decode(chunk).trim()); return Promise.resolve(); }, releaseLock(){} }; } }; }
  }
  const port = new FakePort();
  port.onLine = (line) => {
    const [cmd, rid, ...rest] = line.split(':');
    dev.cmds.push(cmd);
    if (opts.errOn === cmd) return port.push(`ERR:${rid}:write\n`);
    if (cmd === 'CMD_UB' || cmd === 'CMD_UA') return port.push(`ACK:${rid}\n`);
    if (cmd === 'CMD_UC') {
      const [name, off, b64] = rest;
      dev.ucOffsets.push(+off);
      if (opts.neverAckOffset != null && +off === opts.neverAckOffset) return;   // always swallow, never respond
      if (+off !== dev.file.length) return port.push(`ERR:${rid}:offset:${dev.file.length}\n`);
      dev.file += atob(b64);
      if (opts.dropAckOnce && !dev.dropped) { dev.dropped = true; return; }
      return port.push(`ACK:${rid}:${dev.file.length}\n`);
    }
    if (cmd === 'CMD_UE') { dev.ended = true; if (opts.swallowUE) return; return port.push(`ACK:${rid}\n`); }
  };
  _serialPort = port;
  _fwUpdateTarget = null;
  const toasts = [];
  const origToast = toast; window.toast = (t, m) => { toasts.push(t + ':' + m); };
  try { await runFirmwareUpdate(FW_MANIFEST); } finally { FW_CHUNK_TIMEOUT_MS = 3000; FW_END_TIMEOUT_MS = 10000; window.toast = origToast; }
  return { cmds: dev.cmds, ucOffsets: dev.ucOffsets, fileOk: dev.file === MAIN, fileLen: dev.file.length, ended: dev.ended,
           target: _fwUpdateTarget, toasts, updating: _fwUpdating };
}, MAIN, opts);

let r = await run({});
P('happy path: UB → UC×3 → UE', r.cmds.join(',') === 'CMD_UB,CMD_UC,CMD_UC,CMD_UC,CMD_UE', r.cmds.join(','));
P('device received byte-identical file', r.fileOk, String(r.fileLen));
P('outcome pending until reconnect', r.target && r.target.from === '1.3.0' && r.target.to === '1.3.1', JSON.stringify(r.target));
P('flag cleared after run', r.updating === false);

const offerWhilePending = await p.evaluate(() => {
  renderFirmwareOffer();
  return { avail: firmwareUpdateAvailable(), rowHidden: document.getElementById('fw-update-row').hidden };
});
P('offer hidden while update outcome is still pending', offerWhilePending.avail === false && offerWhilePending.rowHidden === true, JSON.stringify(offerWhilePending));

r = await run({ dropAckOnce:true });
P('lost ACK → retransmit → offset resync, no duplicate bytes', r.fileOk && r.ended, `${r.fileLen} ${r.cmds.join(',')}`);

r = await run({ dropAckOnce:true, neverAckOffset:512, chunkTimeoutMs:50 });
const chunk2Sends = r.ucOffsets.filter(o => o === 512).length;
P('retries reset after resync: next chunk still gets a full 1+3 retry budget',
  chunk2Sends === 4 && r.cmds.includes('CMD_UA') && !r.ended, `chunk2Sends=${chunk2Sends} cmds=${r.cmds.join(',')}`);
P('retry exhaustion after resync → "device is unchanged" toast', r.toasts.some(t => t.startsWith('e:') && t.includes('unchanged')), r.toasts.join(' | '));

r = await run({ errOn:'CMD_UC' });
P('ERR mid-transfer → CMD_UA sent, no UE', r.cmds.includes('CMD_UA') && !r.ended, r.cmds.join(','));
P('ERR mid-transfer → "device is unchanged" toast, no pending outcome', r.toasts.some(t => t.startsWith('e:') && t.includes('unchanged')) && r.target === null, r.toasts.join(' | '));

r = await run({ swallowUE:true, endTimeoutMs:50 });
P('CMD_UE ack lost (timeout, non-ERR) → no CMD_UA, outcome left pending for reconnect to resolve',
  !r.cmds.includes('CMD_UA') && r.target && r.target.from === '1.3.0' && r.target.to === '1.3.1',
  JSON.stringify({ cmds: r.cmds, target: r.target }));
P('CMD_UE ack lost → "restarting — checking the result" info toast', r.toasts.some(t => t.startsWith('i:') && t.includes('restarting')), r.toasts.join(' | '));

r = await run({ errOn:'CMD_UE' });
P('CMD_UE ERR response keeps today\'s behavior: CMD_UA sent, "unchanged" toast, no pending outcome',
  r.cmds.includes('CMD_UA') && r.toasts.some(t => t.startsWith('e:') && t.includes('unchanged')) && r.target === null,
  JSON.stringify({ cmds: r.cmds, toasts: r.toasts, target: r.target }));

fileBody = MAIN.slice(0, -1) + 'y';   // same size, wrong CRC
r = await run({});
P('bad download → nothing sent to device', r.cmds.length === 0, r.cmds.join(','));
P('bad download → download error toast', r.toasts.some(t => t.includes('Could not download')), r.toasts.join(' | '));
fileBody = MAIN;

const outcome = await p.evaluate(() => {
  const seen = []; const orig = toast; window.toast = (t, m) => seen.push(t + ':' + m);
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  DEVICE_INFO.firmware = '1.3.1'; checkFirmwareUpdateOutcome();
  const ok = seen.pop(); const cleared = _fwUpdateTarget === null;
  renderFirmwareOffer();
  const availAfter = firmwareUpdateAvailable();
  const rowHiddenAfter = document.getElementById('fw-update-row').hidden;
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  DEVICE_INFO.firmware = '1.3.0'; checkFirmwareUpdateOutcome();
  const rb = seen.pop();
  window.toast = orig;
  return { ok, rb, cleared, availAfter, rowHiddenAfter };
});
P('reconnect on new version → success toast', outcome.ok?.startsWith('s:') && outcome.ok.includes('1.3.1') && outcome.cleared, outcome.ok);
P('offer stays hidden after outcome resolves (device already on latest)', outcome.availAfter === false && outcome.rowHiddenAfter === true, JSON.stringify(outcome));
P('reconnect on old version → rolled back toast', outcome.rb?.startsWith('e:') && outcome.rb.includes('rolled back'), outcome.rb);

const rollbackAction = await p.evaluate(() => {
  let openedUrl = null; const origOpen = window.open; window.open = (u) => { openedUrl = u; };
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  DEVICE_INFO.firmware = '1.3.0';
  checkFirmwareUpdateOutcome();
  const btn = [...document.querySelectorAll('.toast.e .toast-action')].pop();
  const label = btn ? btn.textContent : null;
  btn?.click();
  window.open = origOpen;
  return { label, openedUrl };
});
P('rollback toast offers a Contact support action that opens mailto',
  rollbackAction.label === 'Contact support' && rollbackAction.openedUrl === 'mailto:support@acoustic-empire.cz',
  JSON.stringify(rollbackAction));

const reconnectFail = await p.evaluate(async () => {
  navigator.serial.getPorts = async () => [{}];   // granted=true path in onDeviceConnected
  _fwUpdateTarget = { from: '1.3.0', to: '1.3.1' };
  dirty = false;
  // CMD_INFO write rejects immediately (fast, no need to wait out a real timeout) —
  // simulates the reconnect sync failing while an update outcome is still pending.
  _serialPort = { readable: {}, writable: { getWriter(){ return { write(){ return Promise.reject(new Error('write failed')); }, releaseLock(){} }; } } };
  const seen = []; const orig = toast; window.toast = (t, m) => seen.push(t + ':' + m);
  await onDeviceConnected();
  window.toast = orig;
  return { toasts: seen, target: _fwUpdateTarget };
});
P('reconnect sync failure with pending fw update → specific recovery toast, target kept',
  reconnectFail.toasts.some(t => t.startsWith('e:') && t.includes("didn't respond after the update")) && reconnectFail.target !== null,
  JSON.stringify(reconnectFail));

const survives = await p.evaluate(async () => {
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  _serialPort = { readable:{ getReader(){ return { read(){ return new Promise(()=>{}); }, releaseLock(){}, cancel(){} }; } },
                  writable:{ getWriter(){ return { write(){ return Promise.resolve(); }, releaseLock(){} }; } },
                  getInfo(){ return { usbProductId: 1 }; } };
  try { await serialReadInfo(); } catch (_) {}
  return _fwUpdateTarget !== null;
});
P('failed CMD_INFO after reset keeps the pending outcome', survives);

const blocked = await p.evaluate(async () => {
  const seen = []; const orig = toast; window.toast = (t, m) => seen.push(t + ':' + m);
  _fwUpdating = true;
  const writes = []; _serialPort = { readable:null, writable:{ getWriter(){ return { write(c){ writes.push(c); return Promise.resolve(); }, releaseLock(){} }; } } };
  await doSend(); await sendHidRequest(true); await syncLoadFromDevice();
  _fwUpdating = false; window.toast = orig;
  return { writes: writes.length, msgs: seen.filter(m => m.includes('Firmware update in progress')).length };
});
P('Send, HID toggle, and syncLoadFromDevice blocked during update', blocked.writes === 0 && blocked.msgs === 3, JSON.stringify(blocked));
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
