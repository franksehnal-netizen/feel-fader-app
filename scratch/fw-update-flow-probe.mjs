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
    // Chrome nulls port.readable together with erroring the in-flight read on device loss.
    get readable(){ const s=this; if (s.lost) return null; return { getReader(){ return {
      read(){ if (s.unplugged) { s.lost = true; return Promise.reject(new DOMException('The device has been lost.', 'NetworkError')); }
        return s._chunks.length ? Promise.resolve({ value:s._chunks.shift(), done:false })
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
      if (opts.unplugAtOffset != null && +off === opts.unplugAtOffset) {
        // Physical unplug: in-flight read rejects, then Chrome's 'disconnect' task nulls _serialPort.
        port.unplugged = true; setTimeout(() => { _serialPort = null; }, 0); return;
      }
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
  const origToast = toast; window.toast = (t, m, a, o) => { toasts.push(t + ':' + m + (o && o.sticky ? ' [sticky]' : '')); };
  // Unplugged device: nothing re-openable, and requestPort() inside Chrome's 5 s
  // user-activation window opens a chooser whose promise never settles.
  const origGetPorts = navigator.serial.getPorts, origRequestPort = navigator.serial.requestPort;
  let requestPortCalls = 0, hung = false;
  if (opts.unplugAtOffset != null) {
    navigator.serial.getPorts = async () => [];
    navigator.serial.requestPort = () => { requestPortCalls++; return new Promise(() => {}); };
  }
  try {
    const res = await Promise.race([runFirmwareUpdate(FW_MANIFEST).then(() => 'done'),
      new Promise(r => setTimeout(() => r('hung'), opts.hangGuardMs || 60000))]);
    hung = res === 'hung';
  } finally {
    FW_CHUNK_TIMEOUT_MS = 3000; FW_END_TIMEOUT_MS = 10000; window.toast = origToast;
    navigator.serial.getPorts = origGetPorts; navigator.serial.requestPort = origRequestPort;
  }
  const updatingAfter = _fwUpdating;
  if (hung) _fwUpdating = false;   // don't poison later cases
  return { cmds: dev.cmds, ucOffsets: dev.ucOffsets, fileOk: dev.file === MAIN, fileLen: dev.file.length, ended: dev.ended,
           target: _fwUpdateTarget, toasts, updating: updatingAfter, hung, requestPortCalls };
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

r = await run({ unplugAtOffset:512, hangGuardMs:3000 });
P('unplug mid-transfer → run finishes (no hang on a re-open chooser)', !r.hung && r.updating === false, JSON.stringify({ hung: r.hung, updating: r.updating }));
P('unplug mid-transfer → never opens the serial chooser', r.requestPortCalls === 0, `requestPortCalls=${r.requestPortCalls}`);
P('unplug mid-transfer → "device is unchanged" toast, no pending outcome', r.toasts.some(t => t.startsWith('e:') && t.includes('unchanged')) && r.target === null, r.toasts.join(' | '));
P('"device is unchanged" toast is sticky (user is handling the cable, not watching)', r.toasts.some(t => t.includes('unchanged') && t.endsWith('[sticky]')), r.toasts.join(' | '));

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
P('download error toast is sticky', r.toasts.some(t => t.includes('Could not download') && t.endsWith('[sticky]')), r.toasts.join(' | '));
fileBody = MAIN;

const outcome = await p.evaluate(() => {
  const seen = []; const orig = toast; window.toast = (t, m, a, o) => seen.push(t + ':' + m + (o && o.sticky ? ' [sticky]' : ''));
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
P('rolled back toast is sticky, success toast is not', outcome.rb?.endsWith('[sticky]') && !outcome.ok?.endsWith('[sticky]'), JSON.stringify({ ok: outcome.ok, rb: outcome.rb }));

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
  const seen = []; const orig = toast; window.toast = (t, m, a, o) => seen.push(t + ':' + m + (o && o.sticky ? ' [sticky]' : ''));
  await onDeviceConnected();
  window.toast = orig;
  return { toasts: seen, target: _fwUpdateTarget };
});
P('reconnect sync failure with pending fw update → specific recovery toast, target kept',
  reconnectFail.toasts.some(t => t.startsWith('e:') && t.includes("didn't respond after the update")) && reconnectFail.target !== null,
  JSON.stringify(reconnectFail));
P('"didn\'t respond after the update" toast is sticky', reconnectFail.toasts.some(t => t.includes("didn't respond") && t.endsWith('[sticky]')), JSON.stringify(reconnectFail.toasts));

// Real toast(): sticky has no auto-dismiss timer, only the ✕ closes it.
const sticky = await p.evaluate(async () => {
  toast('e', 'probe sticky', null, { sticky: true });
  toast('e', 'probe normal');
  const find = (m) => [...document.querySelectorAll('#toasts .toast')].find(el => el.textContent.includes(m));
  await new Promise(r => setTimeout(r, 5800));
  const s = find('probe sticky'), n = find('probe normal');
  const stickyAlive = !!s && !s.classList.contains('is-leaving');
  const normalGone = !n || n.classList.contains('is-leaving');
  s?.querySelector('.tx')?.click();
  const closable = !s || s.classList.contains('is-leaving') || !s.isConnected;
  return { stickyAlive, normalGone, closable };
});
P('sticky toast survives past the error timeout, normal one auto-dismisses, ✕ closes sticky',
  sticky.stickyAlive && sticky.normalGone && sticky.closable, JSON.stringify(sticky));

const survives = await p.evaluate(async () => {
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  _serialPort = { readable:{ getReader(){ return { read(){ return new Promise(()=>{}); }, releaseLock(){}, cancel(){} }; } },
                  writable:{ getWriter(){ return { write(){ return Promise.resolve(); }, releaseLock(){} }; } },
                  getInfo(){ return { usbProductId: 1 }; } };
  try { await serialReadInfo(); } catch (_) {}
  return _fwUpdateTarget !== null;
});
P('failed CMD_INFO after reset keeps the pending outcome', survives);

// Post-update reset on Windows: the MIDI port often never re-registers, but the
// granted serial port comes back and fires navigator.serial 'connect'.
const serialReconnect = (o) => p.evaluate(async (o) => {
  const infoWrites = []; const seen = [];
  const mkPort = () => {
    let resolvers = [], chunks = [];
    const push = (s) => { const v = new TextEncoder().encode(s); resolvers.length ? resolvers.shift()({ value:v, done:false }) : chunks.push(v); };
    const port = { readable:null, writable:null, getInfo(){ return { usbProductId: 0x000B }; },
      async open(){
        port.readable = { getReader(){ return { read(){ return chunks.length ? Promise.resolve({ value:chunks.shift(), done:false }) : new Promise(r => resolvers.push(r)); },
          releaseLock(){}, cancel(){ resolvers.splice(0).forEach(r => r({ value:undefined, done:true })); } }; } };
        port.writable = { getWriter(){ return { write(c){ const line = new TextDecoder().decode(c).trim();
          if (line.startsWith('CMD_INFO')) { infoWrites.push(line);
            setTimeout(() => push(JSON.stringify({ firmware:o.fw, schema_version:2, config_hash:'h', serial:'S' }) + '\n'), o.replyDelayMs || 0); }
          return Promise.resolve(); }, releaseLock(){} }; } };
      } };
    return port;
  };
  const dev = mkPort();
  const origGetPorts = navigator.serial.getPorts; navigator.serial.getPorts = async () => [dev];
  const origToast = toast; window.toast = (t, m, a, o) => seen.push(t + ':' + m + (o && o.sticky ? ' [sticky]' : ''));
  _serialPort = null; _ffConnected = false; dirty = true;
  _fwUpdateTarget = o.pending ? { from:'1.3.0', to:'1.3.1' } : null;
  FW_SERIAL_RECONNECT_GRACE_MS = 50;
  if (o.midiToo) onDeviceConnected();   // MIDI path already resolving
  navigator.serial.dispatchEvent(new Event('connect'));
  await new Promise(r => setTimeout(r, 600));
  navigator.serial.getPorts = origGetPorts; window.toast = origToast; dirty = false;
  return { infoWrites: infoWrites.length, toasts: seen, target: _fwUpdateTarget };
}, o);

let sr = await serialReconnect({ pending:true, fw:'1.3.1' });
P('serial connect after update (no MIDI) → CMD_INFO + "Firmware updated" toast, outcome cleared',
  sr.infoWrites >= 1 && sr.toasts.some(t => t.startsWith('s:') && t.includes('1.3.1')) && sr.target === null, JSON.stringify(sr));
sr = await serialReconnect({ pending:true, fw:'1.3.0' });
P('serial connect after rolled-back update → rolled back toast', sr.toasts.some(t => t.startsWith('e:') && t.includes('rolled back')), JSON.stringify(sr));
sr = await serialReconnect({ pending:false, fw:'1.3.0' });
P('serial connect with no pending update → no serial traffic', sr.infoWrites === 0, JSON.stringify(sr));
sr = await serialReconnect({ pending:true, fw:'1.3.1', midiToo:true, replyDelayMs:200 });
P('serial connect while MIDI reconnect is already resolving → one CMD_INFO, one outcome toast',
  sr.infoWrites === 1 && sr.toasts.filter(t => t.startsWith('s:')).length === 1, JSON.stringify(sr));

const blocked = await p.evaluate(async () => {
  const seen = []; const orig = toast; window.toast = (t, m, a, o) => seen.push(t + ':' + m + (o && o.sticky ? ' [sticky]' : ''));
  _fwUpdating = true;
  const writes = []; _serialPort = { readable:null, writable:{ getWriter(){ return { write(c){ writes.push(c); return Promise.resolve(); }, releaseLock(){} }; } } };
  await doSend(); await sendHidRequest(true); await syncLoadFromDevice();
  _fwUpdating = false; window.toast = orig;
  return { writes: writes.length, msgs: seen.filter(m => m.includes('Firmware update in progress')).length };
});
P('Send, HID toggle, and syncLoadFromDevice blocked during update', blocked.writes === 0 && blocked.msgs === 3, JSON.stringify(blocked));
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
