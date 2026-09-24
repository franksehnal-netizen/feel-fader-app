# In-App Firmware Update (Web App Half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer and run firmware updates from the app: read `./firmware/manifest.json`, show a quiet offer in Device & Settings, warn on features the connected firmware lacks, and stream the bundle over Web Serial with `CMD_UB/UC/UE/UA`.

**Architecture:** All code stays inline in `feel-fader.html` (single source of truth, no build step). A small block of pure helpers (`cmpFwVersion`, `crc32Hex`, manifest validation) feeds three UI entry points: the offer row + dot (`renderFirmwareOffer`), the per-feature note (`featureFwWarning`), and the update runner (`runFirmwareUpdate`) that reuses the existing serialized `serialRequest` transport. The update outcome is resolved in `serialReadInfo` after the device reconnects through the existing auto-reconnect path.

**Tech Stack:** Vanilla JS/CSS/HTML, Web Serial, `fetch` (same-origin), `puppeteer-core` probes in `scratch/`.

**Spec:** `../feel-fader-firmware/docs/superpowers/specs/2026-09-24-in-app-firmware-update-design.md` (sibling repo — protocol spec lives with the firmware). Firmware half: `../feel-fader-firmware/docs/superpowers/plans/2026-09-24-in-app-firmware-update.md`.

## Global Constraints

- Edit only `feel-fader.html` (+ probes in `scratch/`, registered in `scratch/run-all-probes.mjs` `PROBES`). Read only the target slice (`rg -n` first), never the whole file.
- Manifest URL: `./firmware/manifest.json`; files: `./firmware/<latest>/<name>`. Fetch with `{cache:'no-cache'}`. Failure → silently no offer.
- Manifest shape: `{latest:"X.Y.Z", notes:string, files:[{name,size,crc}], rescue_uf2:string}`; `name` matches `^[a-z0-9_]+\.py$`, `crc` = 8 lowercase hex (CRC32).
- Offer only when: device reports `update.supported === true`, `protocolVersion === 2`, `DEVICE_INFO.firmware < manifest.latest` (numeric semver compare), and no update is running.
- Wire format (from the firmware plan, exact): `CMD_UB:<rid>:<json {version,files}>` → `ACK:<rid>`; `CMD_UC:<rid>:<name>:<offset>:<base64>` → `ACK:<rid>:<next_offset>`; `CMD_UE:<rid>` → `ACK:<rid>` then device resets; `CMD_UA:<rid>` → `ACK:<rid>`; errors `ERR:<rid>:<code>` with codes `dev_mode|invalid|space|offset:<N>|write|state|crc:<name>|unsupported`.
- Chunk size: 512 raw bytes (≈ 684 base64 chars). Chunk timeout 3000 ms, max 3 retries per chunk on `timeout`; `ERR:offset:<N>` resyncs to `N`.
- `FEATURE_MIN_FW = { cc_relative: '1.3.0' }`.
- UI copy is English (app language). Never call real `navigator.serial.requestPort()` or send real SysEx in probes — poke internal state / fake ports (existing probe pattern, see `scratch/audit/p2-serial-robustness.mjs`).
- CSP already contains `connect-src 'self'` (line 5) — verify, do not change.
- Chrome path for probes: `C:/Program Files/Google/Chrome/Application/chrome.exe`; server `:8100` is started by `npm test`.
- Commit with explicit `git add <files>`. Never deploy the demo without Frank's explicit instruction.

## Review Focus

1. **Device reconnects while still crashing/booting after `CMD_UE`** (first `CMD_INFO` times out) — expected: outcome message waits for the first *successful* `serialReadInfo`, `_fwUpdateTarget` survives failed attempts (test in Task 3).
2. **Lost ACK → timeout → retransmit of an already-written chunk** — expected: device answers `ERR:offset:<N>`, app resyncs and the file is byte-identical, no duplicated bytes (test in Task 3).
3. **Tampered/partial download (size or CRC mismatch vs manifest)** — expected: nothing is sent to the device (no `CMD_UB`), error toast „Could not download…“ (test in Task 3).
4. **Malformed or hostile manifest** (`latest` with HTML, `../` names, missing fields) — expected: treated as no manifest, nothing rendered via `innerHTML` (test in Task 1).
5. **User clicks Send / toggles HID during an update** — expected: blocked with an info toast, no interleaved serial writes (test in Task 3).

---

### Task 1: Version helpers, manifest fetch, quiet offer in Device & Settings

**Files:**
- Modify: `feel-fader.html` — `DEVICE_INFO` (~2853), Device & Settings markup (~2321 toggle button, ~2335 Firmware row), CSS near `.info-row` (~833), `serialReadInfo` (~5352), disconnect branch in `connectInputs` (`DEVICE_INFO.schema_version = null;` ~4996), new helper block right after `updateDeviceInfo()` (~3842)
- Create: `scratch/fw-update-offer-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Produces: `FW_MANIFEST_URL`, `FW_MANIFEST` (validated object | null), `_fwUpdating: boolean`, `cmpFwVersion(a, b) -> -1|0|1`, `isValidFwManifest(m) -> boolean`, `fetchFirmwareManifest() -> Promise<void>`, `firmwareUpdateAvailable() -> boolean`, `renderFirmwareOffer() -> void`, `DEVICE_INFO.update: {supported:boolean, slot:string} | null`. DOM ids: `fw-update-dot`, `fw-update-row`, `fw-update-label`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/fw-update-offer-probe.mjs`:

```js
// In-app firmware update — offer (spec 2026-09-24 §6). Manifest is served by
// request interception; no real serial/HW.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

let manifest = { latest:'1.3.1', notes:'n', rescue_uf2:'x.uf2',
  files:[{ name:'ff_main.py', size:5, crc:'3610a686' }] };
let manifestStatus = 200;
await p.setRequestInterception(true);
p.on('request', r => {
  if (r.url().endsWith('/firmware/manifest.json')) {
    return r.respond({ status: manifestStatus, contentType:'application/json', body: JSON.stringify(manifest) });
  }
  r.continue();
});
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const state = () => p.evaluate(() => ({
  dot: !document.getElementById('fw-update-dot').hidden,
  row: !document.getElementById('fw-update-row').hidden,
  label: document.getElementById('fw-update-label').textContent,
}));
const setup = (fw, supported) => p.evaluate(async (fw, supported) => {
  skipWelcome(); protocolVersion = 2;
  DEVICE_INFO.firmware = fw; DEVICE_INFO.update = { supported, slot:'a' };
  await fetchFirmwareManifest();
}, fw, supported);

const cmp = await p.evaluate(() => [
  cmpFwVersion('1.3.0','1.3.1'), cmpFwVersion('1.10.0','1.9.9'), cmpFwVersion('1.3.0','1.3.0'), cmpFwVersion('2.0.0','1.99.99')]);
P('cmpFwVersion is numeric, not lexicographic', JSON.stringify(cmp) === '[-1,1,0,1]', JSON.stringify(cmp));

await setup('1.3.0', true);
let s = await state();
P('older firmware + supported → dot and row shown', s.dot && s.row, JSON.stringify(s));
P('row names the new version', s.label === 'Firmware 1.3.1 available', s.label);

await setup('1.3.1', true); s = await state();
P('same version → no offer', !s.dot && !s.row, JSON.stringify(s));

await setup('1.3.0', false); s = await state();
P('update.supported false → no offer', !s.dot && !s.row, JSON.stringify(s));

await setup('1.3.0', true);   // offer visible under v2 …
const legacy = await p.evaluate(async () => { protocolVersion = 1; renderFirmwareOffer(); return !document.getElementById('fw-update-row').hidden; });
P('legacy protocol (v1) → no offer', legacy === false);

manifestStatus = 404; await setup('1.3.0', true); s = await state();
P('manifest 404 → no offer, no error', !s.dot && !s.row && errs.length === 0, JSON.stringify(s));

manifestStatus = 200;
for (const bad of [
  { ...manifest, latest:'<img src=x onerror=alert(1)>' },
  { ...manifest, files:[{ name:'../code.py', size:5, crc:'3610a686' }] },
  { ...manifest, files:[] },
  { latest:'1.3.1' },
]) {
  manifest = bad; await setup('1.3.0', true); s = await state();
  P('invalid manifest rejected: ' + JSON.stringify(bad).slice(0, 50), !s.dot && !s.row, JSON.stringify(s));
}
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
```

Register it: add `'fw-update-offer-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs` directly before the first `'audit/…'` entry.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- fw-update-offer-probe.mjs`
Expected: FAIL/crash — `cmpFwVersion is not defined`.

- [ ] **Step 3: Add state + helpers**

In `DEVICE_INFO` add after `fader_response: null,`:

```js
  update: null,           // z CMD_INFO: {supported, slot} — firmware umí in-app update (fw ≥ 1.3.0)
```

Directly after the closing `}` of `function updateDeviceInfo()` insert:

```js
// ─── In-app firmware update ─────────────────────────────────────────────────
// Spec: feel-fader-firmware docs/superpowers/specs/2026-09-24-in-app-firmware-update-design.md
const FW_MANIFEST_URL = './firmware/manifest.json';
let FW_MANIFEST = null;     // validovaný manifest | null (offline/404/invalid → žádná nabídka)
let _fwUpdating = false;
function cmpFwVersion(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
function isValidFwManifest(m) {
  return !!m && typeof m.latest === 'string' && /^\d+\.\d+\.\d+$/.test(m.latest)
    && Array.isArray(m.files) && m.files.length > 0 && m.files.length <= 8
    && m.files.every(f => f && typeof f.name === 'string' && /^[a-z0-9_]+\.py$/.test(f.name)
      && Number.isInteger(f.size) && f.size > 0 && typeof f.crc === 'string' && /^[0-9a-f]{8}$/.test(f.crc));
}
async function fetchFirmwareManifest() {
  try {
    const r = await fetch(FW_MANIFEST_URL, { cache: 'no-cache' });
    const m = r.ok ? await r.json() : null;
    FW_MANIFEST = isValidFwManifest(m) ? m : null;
  } catch (_) {
    FW_MANIFEST = null;
  }
  renderFirmwareOffer();
}
function firmwareUpdateAvailable() {
  return !!(FW_MANIFEST && protocolVersion === 2 && DEVICE_INFO.update?.supported === true
    && DEVICE_INFO.firmware && cmpFwVersion(DEVICE_INFO.firmware, FW_MANIFEST.latest) < 0);
}
function renderFirmwareOffer() {
  const avail = firmwareUpdateAvailable();
  const dot = document.getElementById('fw-update-dot');
  if (dot) dot.hidden = !avail || _fwUpdating;
  const row = document.getElementById('fw-update-row');
  if (row) row.hidden = !(avail || _fwUpdating);
  const lbl = document.getElementById('fw-update-label');
  if (lbl && FW_MANIFEST) lbl.textContent = `Firmware ${FW_MANIFEST.latest} available`;
}
```

- [ ] **Step 4: Markup + CSS**

In `#device-settings-toggle-btn`, after `<span class="panel-name" style="margin:0">Device &amp; Settings</span>` add:

```html
        <span class="fw-update-dot" id="fw-update-dot" hidden title="Firmware update available"></span>
```

After the Firmware row (`<div class="info-row"><span class="info-lbl">Firmware</span>…id="di-firmware"…</div>`) add:

```html
        <div class="info-row info-row-action" id="fw-update-row" hidden>
          <span class="info-lbl" id="fw-update-label">Firmware update available</span>
        </div>
```

After `.info-row.info-row-action .info-lbl{min-width:100px;}` add:

```css
.fw-update-dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block}
.fw-update-dot[hidden],#fw-update-row[hidden]{display:none}
```

- [ ] **Step 5: Wire into `serialReadInfo` and disconnect**

In `serialReadInfo()` after `DEVICE_INFO.schema_version = Number(info.schema_version) || null;` add:

```js
  DEVICE_INFO.update = (info.update && typeof info.update === 'object')
    ? { supported: info.update.supported === true, slot: String(info.update.slot || '') }
    : null;
```

and after the line `updateDeviceInfo(); updateHidToggle();` add:

```js
  fetchFirmwareManifest();   // best effort, bez await — nabídka se dorenderuje sama
```

In `connectInputs()` disconnect branch, after `DEVICE_INFO.schema_version = null;` add:

```js
    DEVICE_INFO.update = null; renderFirmwareOffer();
```

- [ ] **Step 6: Run the probe, then the full suite**

Run: `npm test -- fw-update-offer-probe.mjs` → Expected: all PASS.
Run: `npm test` → Expected: `0 failed`.

- [ ] **Step 7: Commit**

```bash
git add feel-fader.html scratch/fw-update-offer-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: firmware update offer in Device & Settings (manifest + version check)"
```

---

### Task 2: Feature minimum-firmware note (`FEATURE_MIN_FW`)

**Files:**
- Modify: `feel-fader.html` — helper block from Task 1, `ccRelativeBody` (~3584), after `openDeviceSettingsAtHid` (~3768), CSS next to `.uacc-note` (~678)
- Create: `scratch/fw-feature-min-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Consumes: `cmpFwVersion` (Task 1), `escHtml` (existing).
- Produces: `FEATURE_MIN_FW`, `featureFwWarning(feature) -> string` (HTML, empty when OK/unknown), `openDeviceSettingsAtFirmware() -> void`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/fw-feature-min-probe.mjs`:

```js
// FEATURE_MIN_FW: cc_relative on firmware < 1.3.0 shows an inline note.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });

const noteFor = (fw) => p.evaluate((fw) => {
  skipWelcome(); activeBank = 0;
  DEVICE_INFO.firmware = fw;
  render();
  setRollerMode(0, 'cc_relative');   // same entry point as cc-relative-mode-selector-probe.mjs
  _openSections.add('roller');
  render();
  const n = document.querySelector('.fw-min-note');
  return n ? n.textContent : null;
}, fw);

let t = await noteFor('1.2.0');
P('cc_relative on 1.2.0 → note shown', !!t && t.includes('1.3.0') && t.includes('1.2.0'), t);
t = await noteFor('1.3.0');
P('cc_relative on 1.3.0 → no note', t === null, t);
t = await noteFor(null);
P('unknown firmware (never connected) → no note', t === null, t);
t = await p.evaluate(() => { DEVICE_INFO.firmware = '<b>x</b>'; return featureFwWarning('cc_relative'); });
P('firmware string is escaped', !t.includes('<b>') && t.includes('&lt;b&gt;'), t);
const opened = await p.evaluate(() => {
  DEVICE_INFO.firmware = '1.2.0'; render();
  document.querySelector('.fw-min-note a').click();
  return document.getElementById('device-settings-body').style.display !== 'none';
});
P('note link opens Device & Settings', opened);
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
```

Before writing, confirm the roller section key and open-set names with `rg -n "_openSections|isSectionOpen\('roller" feel-fader.html`; if the roller section key differs from `'roller'`, use the real key in the probe. Register `'fw-feature-min-probe.mjs',` in `PROBES` before the first `'audit/…'` entry.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- fw-feature-min-probe.mjs`
Expected: FAIL — no `.fw-min-note`, `featureFwWarning is not defined`.

- [ ] **Step 3: Implement**

Append to the firmware-update helper block (Task 1):

```js
const FEATURE_MIN_FW = { cc_relative: '1.3.0' };
function featureFwWarning(feature) {
  const min = FEATURE_MIN_FW[feature];
  const fw = DEVICE_INFO.firmware;
  if (!min || !fw || cmpFwVersion(fw, min) >= 0) return '';
  return `<div class="fw-min-note" role="note">Requires firmware ${escHtml(min)} — this device runs ${escHtml(fw)}. `
    + `<a href="#" onclick="openDeviceSettingsAtFirmware();return false">Update firmware</a></div>`;
}
```

After `openDeviceSettingsAtHid()` add:

```js
function openDeviceSettingsAtFirmware() {
  const body = document.getElementById('device-settings-body');
  if (body?.style.display === 'none') toggleDeviceSettings();
  requestAnimationFrame(() => {
    const row = document.getElementById('di-firmware')?.closest('.info-row');
    row?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  });
}
```

In `ccRelativeBody`, directly after `<div class="enc-unified-body">` insert `${featureFwWarning('cc_relative')}`.

After `.uacc-note{…}` add:

```css
.fw-min-note{font-size:12px;color:var(--t1);background:color-mix(in srgb,var(--amber) 14%,transparent);border-radius:8px;padding:8px 10px;margin:8px 0}
.fw-min-note a{color:inherit;font-weight:600}
```

- [ ] **Step 4: Run probe + full suite**

Run: `npm test -- fw-feature-min-probe.mjs` → all PASS. Run: `npm test` → `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html scratch/fw-feature-min-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: inline note when a feature needs newer firmware (FEATURE_MIN_FW)"
```

---

### Task 3: Update runner (download → verify → stream → outcome)

**Files:**
- Modify: `feel-fader.html` — `serialRequest` expect map (~5294), helper block (Task 1), `#fw-update-row` markup (Task 1), `serialReadInfo` (~5352), `doSend` (~5514), `sendHidRequest` (~3800), CSS next to `.fw-update-dot`
- Create: `scratch/fw-update-flow-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Consumes: `FW_MANIFEST`, `_fwUpdating`, `renderFirmwareOffer`, `firmwareUpdateAvailable` (Task 1); `serialRequest(cmd, payload, timeoutMs)`, `openConfirm({title,message,confirmLabel,onConfirm,tone})`, `toast(type,msg)` (existing).
- Produces: `crc32Hex(Uint8Array) -> string`, `bytesToB64(Uint8Array) -> string`, `downloadFirmwareFiles(m) -> Promise<Array<{name,size,crc,bytes}>>`, `uploadFirmware(m, files, onProgress) -> Promise<void>`, `startFirmwareUpdate()`, `runFirmwareUpdate(m) -> Promise<void>`, `checkFirmwareUpdateOutcome()`, `_fwUpdateTarget: {from,to}|null`. DOM ids: `fw-update-btn`, `fw-update-progress`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/fw-update-flow-probe.mjs`:

```js
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
// opts.errOn: reply ERR to that command.
const run = (opts) => p.evaluate(async (MAIN, opts) => {
  skipWelcome(); protocolVersion = 2;
  DEVICE_INFO.firmware = '1.3.0'; DEVICE_INFO.update = { supported:true, slot:'a' };
  FW_MANIFEST = { latest:'1.3.1', notes:'', files:[{ name:'ff_main.py', size:MAIN.length,
    crc: crc32Hex(new TextEncoder().encode(MAIN)) }] };
  const dev = { cmds:[], file:'', ended:false, dropped:false };
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
      if (+off !== dev.file.length) return port.push(`ERR:${rid}:offset:${dev.file.length}\n`);
      dev.file += atob(b64);
      if (opts.dropAckOnce && !dev.dropped) { dev.dropped = true; return; }
      return port.push(`ACK:${rid}:${dev.file.length}\n`);
    }
    if (cmd === 'CMD_UE') { dev.ended = true; return port.push(`ACK:${rid}\n`); }
  };
  _serialPort = port;
  _fwUpdateTarget = null;
  const toasts = [];
  const origToast = toast; window.toast = (t, m) => { toasts.push(t + ':' + m); };
  try { await runFirmwareUpdate(FW_MANIFEST); } finally { window.toast = origToast; }
  return { cmds: dev.cmds, fileOk: dev.file === MAIN, fileLen: dev.file.length, ended: dev.ended,
           target: _fwUpdateTarget, toasts, updating: _fwUpdating };
}, MAIN, opts);

let r = await run({});
P('happy path: UB → UC×3 → UE', r.cmds.join(',') === 'CMD_UB,CMD_UC,CMD_UC,CMD_UC,CMD_UE', r.cmds.join(','));
P('device received byte-identical file', r.fileOk, String(r.fileLen));
P('outcome pending until reconnect', r.target && r.target.from === '1.3.0' && r.target.to === '1.3.1', JSON.stringify(r.target));
P('flag cleared after run', r.updating === false);

r = await run({ dropAckOnce:true });
P('lost ACK → retransmit → offset resync, no duplicate bytes', r.fileOk && r.ended, `${r.fileLen} ${r.cmds.join(',')}`);

r = await run({ errOn:'CMD_UC' });
P('ERR mid-transfer → CMD_UA sent, no UE', r.cmds.includes('CMD_UA') && !r.ended, r.cmds.join(','));
P('ERR mid-transfer → "device is unchanged" toast, no pending outcome', r.toasts.some(t => t.startsWith('e:') && t.includes('unchanged')) && r.target === null, r.toasts.join(' | '));

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
  _fwUpdateTarget = { from:'1.3.0', to:'1.3.1' };
  DEVICE_INFO.firmware = '1.3.0'; checkFirmwareUpdateOutcome();
  const rb = seen.pop();
  window.toast = orig;
  return { ok, rb, cleared };
});
P('reconnect on new version → success toast', outcome.ok?.startsWith('s:') && outcome.ok.includes('1.3.1') && outcome.cleared, outcome.ok);
P('reconnect on old version → rolled back toast', outcome.rb?.startsWith('e:') && outcome.rb.includes('rolled back'), outcome.rb);

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
  await doSend(); await sendHidRequest(true);
  _fwUpdating = false; window.toast = orig;
  return { writes: writes.length, msgs: seen.filter(m => m.includes('Firmware update in progress')).length };
});
P('Send and HID toggle blocked during update', blocked.writes === 0 && blocked.msgs === 2, JSON.stringify(blocked));
P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
```

Register `'fw-update-flow-probe.mjs',` in `PROBES` before the first `'audit/…'` entry.

Note on the `toast` override: `toast` is a top-level `function` declaration in a classic (non-module) script, so it is a property of `window`; assigning `window.toast = …` rebinds the global that every caller resolves at call time.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- fw-update-flow-probe.mjs`
Expected: FAIL/crash — `crc32Hex is not defined`.

- [ ] **Step 3: Extend `serialRequest` expect map**

Replace:

```js
    const expect = { CMD_R: 'CFG', CMD_INFO: 'INFO', CMD_W: 'ACK', CMD_HID: 'ACK' }[cmd];
```

with:

```js
    const expect = { CMD_R: 'CFG', CMD_INFO: 'INFO', CMD_W: 'ACK', CMD_HID: 'ACK',
                     CMD_UB: 'ACK', CMD_UC: 'ACK', CMD_UE: 'ACK', CMD_UA: 'ACK' }[cmd];
```

- [ ] **Step 4: Implement the runner (append to the firmware-update helper block)**

```js
const FW_CHUNK = 512;
let _fwUpdateTarget = null;   // {from,to} po CMD_UE; vyhodnotí se při prvním úspěšném CMD_INFO
const _FW_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32Hex(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _FW_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
async function downloadFirmwareFiles(m) {
  const out = [];
  for (const f of m.files) {
    let bytes;
    try {
      const r = await fetch(`./firmware/${encodeURIComponent(m.latest)}/${encodeURIComponent(f.name)}`, { cache: 'no-cache' });
      if (!r.ok) throw 0;
      bytes = new Uint8Array(await r.arrayBuffer());
    } catch (_) { throw new Error('download'); }
    if (bytes.length !== f.size || crc32Hex(bytes) !== f.crc) throw new Error('download');
    out.push({ name: f.name, size: f.size, crc: f.crc, bytes });
  }
  return out;
}
async function uploadFirmware(m, files, onProgress) {
  const meta = { version: m.latest, files: files.map(({ name, size, crc }) => ({ name, size, crc })) };
  await serialRequest('CMD_UB', JSON.stringify(meta), 5000);
  const total = files.reduce((s, f) => s + f.size, 0);
  let done = 0;
  for (const f of files) {
    let off = 0, retries = 0;
    while (off < f.size) {
      const chunk = f.bytes.subarray(off, off + FW_CHUNK);
      try {
        const next = Number(await serialRequest('CMD_UC', `${f.name}:${off}:${bytesToB64(chunk)}`, 3000));
        if (!Number.isInteger(next) || next <= off || next > f.size) throw new Error('ERR:protocol');
        done += next - off; off = next; retries = 0;
      } catch (e) {
        const resync = /^ERR:offset:(\d+)$/.exec(e.message || '');
        if (resync) { const exp = +resync[1]; done += exp - off; off = exp; continue; }
        if (e.message === 'timeout' && ++retries <= 3) continue;
        throw e;
      }
      onProgress(done / total);
    }
  }
  await serialRequest('CMD_UE', null, 10000);
}
function setFwProgress(v) {
  const el = document.getElementById('fw-update-progress');
  const btn = document.getElementById('fw-update-btn');
  if (el) { el.hidden = v == null; el.value = Math.round((v || 0) * 100); }
  if (btn) btn.hidden = v != null;
}
function startFirmwareUpdate() {
  if (!firmwareUpdateAvailable() || _fwUpdating) return;
  const m = FW_MANIFEST;
  openConfirm({
    title: `Update firmware to ${m.latest}?`,
    message: `${m.notes ? m.notes + ' ' : ''}Keep the device connected until it restarts (about 20 seconds). Your settings stay on the device.`,
    confirmLabel: 'Update',
    tone: 'primary',
    onConfirm: () => runFirmwareUpdate(m),
  });
}
async function runFirmwareUpdate(m) {
  if (_fwUpdating) return;
  _fwUpdating = true; setFwProgress(0); renderFirmwareOffer();
  const from = DEVICE_INFO.firmware;
  try {
    const files = await downloadFirmwareFiles(m);
    await uploadFirmware(m, files, setFwProgress);
    _fwUpdateTarget = { from, to: m.latest };
    toast('i', 'Device is restarting with the new firmware…');
  } catch (e) {
    if (e.message === 'download') {
      toast('e', 'Could not download the firmware. Check your connection and try again.');
    } else {
      try { await serialRequest('CMD_UA', null, 2000); } catch (_) {}
      toast('e', 'Update failed — the device is unchanged.');
    }
  } finally {
    _fwUpdating = false; setFwProgress(null); renderFirmwareOffer();
  }
}
function checkFirmwareUpdateOutcome() {
  if (!_fwUpdateTarget) return;
  const { from, to } = _fwUpdateTarget;
  _fwUpdateTarget = null;
  if (DEVICE_INFO.firmware === to) toast('s', `Firmware updated to ${to}`);
  else toast('e', `Update was rolled back — device runs ${DEVICE_INFO.firmware || from}. Contact support@acoustic-empire.cz.`);
}
```

Note: the download-error branch deliberately sends **no** `CMD_UA` (nothing was sent to the device) — the probe asserts `CMD_UB` is absent.

- [ ] **Step 5: Markup + CSS for button/progress**

Replace the `#fw-update-row` added in Task 1 with:

```html
        <div class="info-row info-row-action" id="fw-update-row" hidden>
          <span class="info-lbl" id="fw-update-label">Firmware update available</span>
          <button class="btn btn-ghost" id="fw-update-btn" onclick="startFirmwareUpdate()">Update</button>
          <progress id="fw-update-progress" max="100" value="0" hidden aria-label="Firmware update progress"></progress>
        </div>
```

Add after the `.fw-update-dot` rules:

```css
#fw-update-progress{width:120px;height:6px;accent-color:var(--green)}
#fw-update-progress[hidden],#fw-update-btn[hidden]{display:none}
```

- [ ] **Step 6: Outcome on reconnect + guards**

In `serialReadInfo()` directly after `if (info.firmware) DEVICE_INFO.firmware = info.firmware;` add:

```js
  checkFirmwareUpdateOutcome();   // po restartu zařízení z CMD_UE (jen první úspěšný CMD_INFO)
```

First line inside `async function doSend() {`:

```js
  if (_fwUpdating) { toast('i', 'Firmware update in progress — wait until the device restarts.'); return; }
```

First line inside `async function sendHidRequest(enabled){`:

```js
  if (_fwUpdating) { toast('i', 'Firmware update in progress — wait until the device restarts.'); updateHidToggle(); return; }
```

- [ ] **Step 7: Run probe + full suite**

Run: `npm test -- fw-update-flow-probe.mjs` → all PASS. Run: `npm test` → `0 failed`.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/fw-update-flow-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: in-app firmware update runner (CMD_UB/UC/UE/UA, CRC-verified download, outcome on reconnect)"
```

---

### Task 4: Publish the firmware bundle next to the demo (script only — run on Frank's go)

**Files:**
- Create: `G:\My Drive\ACOUSTIC EMPIRE\scripts\publish-ff-firmware.ps1` (outside git; Drive-synced like `deploy-ff-demo.ps1`)

**Interfaces:**
- Consumes: `feel-fader-firmware/scripts/build_release.py` (firmware plan Task 6) → `firmware/manifest.json` + `firmware/<version>/*`.
- Produces: `firmware/` in the demo repo (`c:\Users\Fanda Borec\Documents\feel-fader-demo\`), served at `https://franksehnal-netizen.github.io/feel-fader-demo/firmware/manifest.json`. Final output line `FF_FW_OK | <version> | <demo sha>`; non-zero exit on any failure.

- [ ] **Step 1: Write the script**

```powershell
<#
Publikuje firmware balíček (manifest + soubory) do feel-fader-demo vedle index.html.
Nezávislé na deploy appky (firmware se vydává samostatně). Záchranný UF2 se kopíruje
ručně do firmware\ PŘED spuštěním, pokud existuje (feel-fader-<ver>.uf2).
#>
param(
  [string]$FwRepo   = 'C:\Users\Fanda Borec\Documents\feel-fader-firmware',
  [string]$DemoRepo = 'C:\Users\Fanda Borec\Documents\feel-fader-demo',
  [string]$Notes    = '',
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
function Fail([string]$m) { Write-Output "FF_FW_FAIL | $m"; exit 1 }
function Step([string]$m) { Write-Output "FF_FW | $m" }

$version = (Get-Content -LiteralPath (Join-Path $FwRepo 'app\VERSION') -Raw).Trim()
if (-not $VerifyOnly) {
  $dirty = (& git -C $FwRepo status --porcelain -- app) | Where-Object { $_ }
  if ($dirty) { Fail "firmware app/ has uncommitted changes" }
  & python (Join-Path $FwRepo 'scripts\build_release.py') $DemoRepo --notes $Notes
  if ($LASTEXITCODE -ne 0) { Fail "build_release.py exit $LASTEXITCODE" }
  & git -C $DemoRepo add firmware
  & git -C $DemoRepo commit -q -m "firmware $version (fw $((& git -C $FwRepo rev-parse --short HEAD).Trim()))"
  if ($LASTEXITCODE -ne 0) { Fail "commit failed (nothing changed?)" }
  & git -C $DemoRepo push -q origin main
  if ($LASTEXITCODE -ne 0) { Fail "push failed" }
  Step "pushed"
}
$local = Get-Content -LiteralPath (Join-Path $DemoRepo 'firmware\manifest.json') -Raw | ConvertFrom-Json
$url = 'https://franksehnal-netizen.github.io/feel-fader-demo/firmware/manifest.json'
$deadline = (Get-Date).AddMinutes(5)
do {
  try { $live = Invoke-RestMethod -Uri "$url?t=$([DateTime]::UtcNow.Ticks)" -Headers @{ 'Cache-Control'='no-cache' } } catch { $live = $null }
  if ($live -and $live.latest -eq $local.latest -and (($live.files | ForEach-Object crc) -join ',') -eq (($local.files | ForEach-Object crc) -join ',')) { break }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)
if (-not $live -or $live.latest -ne $local.latest) { Fail "live manifest != local ($($live.latest) vs $($local.latest))" }
Write-Output "FF_FW_OK | $version | $((& git -C $DemoRepo rev-parse --short HEAD).Trim())"
```

Save as UTF-8 **with BOM** (PowerShell 5.1 reads BOM-less files as ANSI — see memory `reference_powershell_gotchas`).

- [ ] **Step 2: Verify without publishing**

Run: `powershell -File "G:\My Drive\ACOUSTIC EMPIRE\scripts\publish-ff-firmware.ps1" -VerifyOnly`
Expected before the first publish: `FF_FW_FAIL | …` (no local manifest yet) — proves the failure path exits non-zero. Do **not** run without `-VerifyOnly` until Frank explicitly says to publish.

- [ ] **Step 3: Record the procedure**

Append to memory `reference_feelfader_demo_deploy.md` (AE project memory) one section: „Firmware balíček: `publish-ff-firmware.ps1 [-Notes …]` / `-VerifyOnly`; výstup `FF_FW_OK | <ver> | <sha>`; UF2 kopírovat ručně do `feel-fader-demo\firmware\` před během.“

---

## After both plans

Frank's manual HW checklist lives at the end of the firmware plan. Production-domain deploy (when decided) must ship `firmware/` alongside `feel-fader.html` the same way as the demo.
