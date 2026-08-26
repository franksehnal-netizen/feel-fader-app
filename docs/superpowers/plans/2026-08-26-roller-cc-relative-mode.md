# Roller Relative-CC Mode (Web App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth roller-mode option, "Relative CC" (`cc_relative`), to the encoder/roller section — a bank in this mode shows only its MIDI channel/CC (no articulation list, no keyswitch note list), and the mode survives every reload/import/preset path without silently reverting to `cc`.

**Architecture:** Single-file app (`feel-fader.html` inline `<script>`/`<style>` is the only source of truth — `app.js`/`styles.css`/`assets/` in the repo root are a stale, untracked extract; never edit them). `ROLLER_MODES` is already the single source of truth for the mode list (A-3, 2026-08-17 dedup) — adding one entry there plus its label ripples through the segmented-control UI. Every other touch point is a small, mechanical addition of a fourth branch next to the existing `keyswitch`/`track_nav` branches. Each task ships its own Puppeteer regression probe in `scratch/`, run against a throwaway static server on `:8100` (established pattern, see `scratch/run-all-probes.mjs`).

**Tech Stack:** Vanilla JS/CSS/HTML (no build step), `puppeteer-core` driving local Chrome for regression probes, Node's built-in `http` module for the test server.

**Spec:** `../feel-fader-firmware/docs/superpowers/specs/2026-08-26-roller-cc-relative-design.md` (sibling repo — this feature's spec lives with the firmware repo since `roller_mode` is the firmware-defined protocol concept; this plan implements its web-app half only)

## Global Constraints

- Edit only `feel-fader.html`. Never touch root `app.js`/`styles.css`/`assets/`.
- Every task ships a probe in `scratch/*.mjs` and gets registered in the `PROBES` array in `scratch/run-all-probes.mjs`.
- Chrome path for probes: `C:/Program Files/Google/Chrome/Application/chrome.exe`. Launch with `{ headless:true, pipe:true, args:['--no-sandbox'] }`.
- Probe pattern: `const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);` — every assertion goes through `P(...)`. A probe with zero `PASS`/`FAIL` lines counts as a crash.
- Never call real `navigator.serial.requestPort()` or send real SysEx in a probe — poke internal state directly instead (`skipWelcome()`, `cfg.banks[...]`, `render()`, `renderLiveStrip()`, `validate()`), matching every existing probe in `scratch/`.
- `cc_relative` uses only the bank's existing `encoder` field (`{cc, channel}`) — no new persisted fields, no new validation rules (it has nothing mode-specific to validate).
- Commit after each task with `git add` of the specific files touched (never `-A`).

---

### Task 1: `cc_relative` in the mode list — button exists, labeled, animates

**Files:**
- Modify: `feel-fader.html:2838` (`ROLLER_MODES`)
- Modify: `feel-fader.html:540,547` (`.roller-mode-row` CSS — 3→4 columns)
- Modify: `feel-fader.html:3510-3511` (`rollerModeTitle`)
- Modify: `feel-fader.html:3534` (`labels` map in `encoderPanel`)
- Test: `scratch/cc-relative-mode-selector-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ROLLER_MODES` now includes `'cc_relative'` — every later task's code (Task 2's `rollerModeBodyHtml`, Task 3's `diagnosticRollerMapping`/live HUD, Task 4's whitelist checks) matches against this literal string.

- [ ] **Step 1: Write the failing probe**

Create `scratch/cc-relative-mode-selector-probe.mjs`:

```js
// New 4th roller mode "Relative CC" (cc_relative): the segmented control
// must offer it, activate it, and lay out 4 equal columns without breaking
// the existing 3-column CSS math. Spec: feel-fader-firmware
// docs/superpowers/specs/2026-08-26-roller-cc-relative-design.md §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  activeBank = 0;
  render();
  setRollerMode(0, 'cc_relative');
  const btn = document.querySelector('[data-roller-mode="cc_relative"]');
  const row = document.querySelector('.bank-section-encoder .roller-mode-row');
  const cols = row ? getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length : null;
  return {
    modeSet: cfg.banks[0].roller_mode,
    btnText: btn ? btn.textContent : null,
    btnActive: btn ? btn.classList.contains('active') : null,
    btnAriaPressed: btn ? btn.getAttribute('aria-pressed') : null,
    columns: cols,
  };
});

P('setRollerMode(0,"cc_relative") persists on the bank', r.modeSet === 'cc_relative', JSON.stringify(r));
P('a button for cc_relative exists and is labeled "Relative CC"', r.btnText === 'Relative CC', JSON.stringify(r));
P('the Relative CC button becomes active', r.btnActive === true, JSON.stringify(r));
P('the Relative CC button reports aria-pressed=true', r.btnAriaPressed === 'true', JSON.stringify(r));
P('the segmented control lays out 4 columns', r.columns === 4, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- cc-relative-mode-selector-probe.mjs`
Expected: multiple FAIL — `ROLLER_MODES` doesn't include `'cc_relative'` yet, so `setRollerMode` rejects it (`!modes.includes(mode)` guard) and the button never appears.

- [ ] **Step 3: Add `cc_relative` to `ROLLER_MODES`**

In `feel-fader.html`, line 2838, change:

```javascript
const ROLLER_MODES = ['cc','keyswitch','track_nav'];
```

to:

```javascript
const ROLLER_MODES = ['cc','keyswitch','track_nav','cc_relative'];
```

- [ ] **Step 4: Add the button label**

Line 3534, change:

```javascript
          const labels = {cc:'Articulation (CC)', keyswitch:'Keyswitch', track_nav:'Navigation (keys)'};
```

to:

```javascript
          const labels = {cc:'Articulation (CC)', keyswitch:'Keyswitch', track_nav:'Navigation (keys)', cc_relative:'Relative CC'};
```

- [ ] **Step 5: Add the section title**

Lines 3510-3512, change:

```javascript
function rollerModeTitle(mode) {
  return mode === 'keyswitch' ? 'Keyswitch' : mode === 'track_nav' ? 'Navigation' : 'Articulation';
}
```

to:

```javascript
function rollerModeTitle(mode) {
  return mode === 'keyswitch' ? 'Keyswitch' : mode === 'track_nav' ? 'Navigation' : mode === 'cc_relative' ? 'Relative CC' : 'Articulation';
}
```

- [ ] **Step 6: Widen the segmented-control CSS from 3 to 4 columns**

Line 540, change:

```css
  position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;
```

to:

```css
  position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;
```

Line 547, change:

```css
  width:calc((100% - 10px)/3);border:1px solid var(--control-glass-border);border-radius:var(--r-pill);background:var(--control-glass-bg);
```

to:

```css
  width:calc((100% - 12px)/4);border:1px solid var(--control-glass-border);border-radius:var(--r-pill);background:var(--control-glass-bg);
```

(`10px`→`12px`: padding 3px×2 + gap 2px×(N-1) — was 6+4=10 for N=3, now 6+6=12 for N=4. The `translateX(calc(var(--roller-index) * (100% + 2px)))` step formula on the next line is unchanged — the `%` there resolves against the pill's own width, which the corrected divisor above already fixes, so it's N-agnostic.)

- [ ] **Step 7: Run the probe to confirm it passes**

Run: `npm test -- cc-relative-mode-selector-probe.mjs`
Expected: all PASS

- [ ] **Step 8: Register the probe and commit**

In `scratch/run-all-probes.mjs`, add `'cc-relative-mode-selector-probe.mjs',` to the `PROBES` array (near `roller-mode-timing-sync-probe.mjs`).

```bash
git add feel-fader.html scratch/cc-relative-mode-selector-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: add cc_relative to the roller mode selector (button, title, 4-col layout)"
```

---

### Task 2: `cc_relative` panel content

**Files:**
- Modify: `feel-fader.html:3513-3517` (`rollerModeBodyHtml`)
- Modify: `feel-fader.html` — new `ccRelativeBody(ctrl, bi, errs)` function, inserted after `trackNavBody` (currently ends line 3580, before `function macroSectionContent` at 3582)
- Test: `scratch/cc-relative-panel-content-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Consumes: `ROLLER_MODES` (Task 1), `stepperFieldHtml(...)`, `stepCtrl(bi,key,field,delta)`, `onCtrl(bi,key,field,val)` (all existing, already used identically by `ccEncoderBody` for the `'encoder'` key).
- Produces: `ccRelativeBody(ctrl, bi, errs)` — called only from `rollerModeBodyHtml`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/cc-relative-panel-content-probe.mjs`:

```js
// cc_relative's panel must show only channel/CC controls (like the left
// half of the Articulation panel) — no articulation list, no keyswitch
// note editor. Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  activeBank = 0;
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].encoder = { cc: 40, channel: 2 };
  render();
  const content = document.getElementById('roller-mode-content-0');
  return {
    hasUaccGrid: !!content.querySelector('#uacc-grid'),
    hasKsInput: !!content.querySelector('[id^="ks-note-input-"]'),
    chValue: document.getElementById('b0-encoder-ch')?.value,
    ccValue: document.getElementById('b0-encoder-cc')?.value,
    mentionsStepper: /Keyswitch Stepper/.test(content.textContent),
  };
});
P('cc_relative panel has no articulation list', r.hasUaccGrid === false, JSON.stringify(r));
P('cc_relative panel has no keyswitch note input', r.hasKsInput === false, JSON.stringify(r));
P('cc_relative panel shows the configured channel (2 -> displayed 3)', r.chValue === '3', JSON.stringify(r));
P('cc_relative panel shows the configured CC (40)', r.ccValue === '40', JSON.stringify(r));
P('cc_relative panel explains where the note list lives', r.mentionsStepper === true, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- cc-relative-panel-content-probe.mjs`
Expected: FAIL — `roller-mode-content-0` still renders `ccEncoderBody` (the `cc` mode fallback in `rollerModeBodyHtml`), so `#uacc-grid` exists and `#b0-encoder-ch`/`#b0-encoder-cc` are absent (they're `ctrl.channel`/`ctrl.cc` but `ccEncoderBody`'s stepper IDs match — check actual failure is on `hasUaccGrid`/`mentionsStepper`).

- [ ] **Step 3: Add `ccRelativeBody` and wire it into `rollerModeBodyHtml`**

In `feel-fader.html`, lines 3513-3517, change:

```javascript
function rollerModeBodyHtml(ctrl, bi, mode = cfg.banks[bi].roller_mode || 'cc', errs = validate()) {
  return mode === 'keyswitch' ? keyswitchBody(bi)
       : mode === 'track_nav' ? trackNavBody(bi)
       : ccEncoderBody(ctrl, bi, errs);
}
```

to:

```javascript
function rollerModeBodyHtml(ctrl, bi, mode = cfg.banks[bi].roller_mode || 'cc', errs = validate()) {
  return mode === 'keyswitch' ? keyswitchBody(bi)
       : mode === 'track_nav' ? trackNavBody(bi)
       : mode === 'cc_relative' ? ccRelativeBody(ctrl, bi, errs)
       : ccEncoderBody(ctrl, bi, errs);
}
```

Then, right after `trackNavBody`'s closing (currently the blank line before `function macroSectionContent` at line 3582), insert:

```javascript
function ccRelativeBody(ctrl, bi, errs = validate()) {
  const encErr = errs.find(e => e.field === `b${bi}.encoder`)?.msg || '';
  return `
  <div class="enc-unified-body">
    <div class="uacc-note" style="margin:8px 0">Rotating the roller sends a relative CC (1 = step up, 127 = step down) on this CC/channel. The keyswitch note list lives in the Keyswitch Stepper Max for Live device on the track, not here.</div>
    <div class="section-field-row" style="margin-top:10px">
      ${stepperFieldHtml(`b${bi}-encoder-ch`, 'MIDI CHANNEL', ctrl.channel+1, 1, 16,
        `stepCtrl(${bi},'encoder','channel',-1)`, `stepCtrl(${bi},'encoder','channel',1)`,
        `onCtrl(${bi},'encoder','channel',+this.value-1)`, 'Roller MIDI channel',
        `\n                aria-invalid="${encErr?'true':'false'}" aria-describedby="err-b${bi}-roller"`)}
      ${stepperFieldHtml(`b${bi}-encoder-cc`, 'MIDI CC', ctrl.cc, 0, 127,
        `stepCtrl(${bi},'encoder','cc',-1)`, `stepCtrl(${bi},'encoder','cc',1)`,
        `onCtrl(${bi},'encoder','cc',+this.value)`, 'Roller MIDI CC',
        `\n                aria-invalid="${encErr?'true':'false'}" aria-describedby="err-b${bi}-roller"`)}
    </div>
  </div>`;
}
```

- [ ] **Step 4: Run the probe to confirm it passes**

Run: `npm test -- cc-relative-panel-content-probe.mjs`
Expected: all PASS

- [ ] **Step 5: Register the probe and commit**

Add `'cc-relative-panel-content-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/cc-relative-panel-content-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: add ccRelativeBody panel (channel/CC only, no note list)"
```

---

### Task 3: Diagnostics + live HUD labels

**Files:**
- Modify: `feel-fader.html:4815-4824` (`diagnosticRollerMapping`)
- Modify: `feel-fader.html:5970-5971` (`renderLiveStrip` label/label-short)
- Test: `scratch/cc-relative-diagnostics-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Consumes: `ROLLER_MODES`/mode string from Task 1.
- Produces: nothing new consumed elsewhere — both are leaf display functions.

- [ ] **Step 1: Write the failing probe**

Create `scratch/cc-relative-diagnostics-probe.mjs`:

```js
// Without an explicit cc_relative branch, both diagnosticRollerMapping and
// the live HUD roller label fall through to the generic "Articulation"
// wording — technically the same CC/channel numbers, but a misleading label.
// Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].encoder = { cc: 40, channel: 2 };
  const diag = diagnosticRollerMapping(cfg.banks[0]);
  _ffConnected = true; _midiState = 'granted'; liveBank = 0;
  renderLiveStrip();
  return {
    diag,
    label: document.getElementById('live-roller-label')?.textContent,
    labelShort: document.getElementById('live-roller-label-short')?.textContent,
  };
});
P('diagnosticRollerMapping reports "Relative CC · Ch3 · CC40"', r.diag === 'Relative CC · Ch 3 · CC 40', r.diag);
P('live HUD label says ROLLER · RELATIVE CC, not ARTICULATION', r.label === 'ROLLER · RELATIVE CC', r.label);
P('live HUD short label is REL', r.labelShort === 'REL', r.labelShort);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- cc-relative-diagnostics-probe.mjs`
Expected: FAIL on all three content checks — both functions currently fall through to the `cc`/`'ROLLER · ARTICULATION'` branch for any unrecognized mode.

- [ ] **Step 3: Add the `diagnosticRollerMapping` branch**

In `feel-fader.html`, in `diagnosticRollerMapping` (lines 4815-4824), insert a new line right before the final `return`:

```javascript
  if (mode === 'track_nav') return `Navigation · ${keyComboLabel(bank.nav_keys_cw || [0x52])} / ${keyComboLabel(bank.nav_keys_ccw || [0x51])} · HID ${DEVICE_INFO.hid_enabled?'on':'off'}`;
  if (mode === 'cc_relative') return `Relative CC · Ch ${(bank.encoder?.channel ?? 0)+1} · CC ${bank.encoder?.cc ?? 32}`;
  return `Articulation · Ch ${(bank.encoder?.channel ?? 0)+1} · CC ${bank.encoder?.cc ?? 32}`;
```

(replaces the existing two-line `if (mode === 'track_nav') ...` / `return \`Articulation...\`` pair — same lines, one new line inserted between them)

- [ ] **Step 4: Add the live HUD label branches**

Lines 5970-5971, change:

```javascript
  setTxt('live-roller-label', mode === 'keyswitch' ? 'ROLLER · KEYSWITCH' : mode === 'track_nav' ? 'ROLLER · NAVIGATION' : 'ROLLER · ARTICULATION');
  setTxt('live-roller-label-short', mode === 'keyswitch' ? 'KS' : mode === 'track_nav' ? 'NAV' : 'ART');
```

to:

```javascript
  setTxt('live-roller-label', mode === 'keyswitch' ? 'ROLLER · KEYSWITCH' : mode === 'track_nav' ? 'ROLLER · NAVIGATION' : mode === 'cc_relative' ? 'ROLLER · RELATIVE CC' : 'ROLLER · ARTICULATION');
  setTxt('live-roller-label-short', mode === 'keyswitch' ? 'KS' : mode === 'track_nav' ? 'NAV' : mode === 'cc_relative' ? 'REL' : 'ART');
```

- [ ] **Step 5: Run the probe to confirm it passes**

Run: `npm test -- cc-relative-diagnostics-probe.mjs`
Expected: all PASS

- [ ] **Step 6: Register the probe and commit**

Add `'cc-relative-diagnostics-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/cc-relative-diagnostics-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat: label cc_relative correctly in diagnostics and the live HUD"
```

---

### Task 4: Whitelist `cc_relative` on every normalize/import path (data-integrity)

**Files:**
- Modify: `feel-fader.html:5124` (`normalizeFwConfig`, app-shape/backup-import branch)
- Modify: `feel-fader.html:5158` (`normalizeFwConfig`, device/NVM-shape branch)
- Modify: `feel-fader.html:8179` (`applyLibraryPreset`, custom-preset-import branch)
- Test: `scratch/cc-relative-whitelist-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Consumes: `normalizeFwConfig(p)`, `applyLibraryPreset(name, scope)`, `validate()` (all existing).
- Produces: nothing new consumed elsewhere.

This is the same class of bug flagged as SEC-004 in the final 2026-08-17 review: `roller_mode` is checked against an explicit whitelist (defense against a hostile/malformed JSON import setting an arbitrary string) at 3 separate call sites — a JSON backup import, a live device read (SysEx/serial), and a custom preset apply. Missing `cc_relative` from any one of them means a bank saved in that mode silently reverts to `cc` the next time that path runs, without any error shown.

- [ ] **Step 1: Write the failing probe**

Create `scratch/cc-relative-whitelist-probe.mjs`:

```js
// SEC-004-class regression guard: roller_mode='cc_relative' must survive
// all 3 places that whitelist-check it, or it silently reverts to 'cc' on
// reload/import/preset-apply with no error shown. Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();

  // Path 1: JSON backup import (app-shape banks, normalizeFwConfig branch A)
  const appShape = normalizeFwConfig({banks:[{
    fader1:{cc:11,channel:0}, fader2:{cc:1,channel:0}, encoder:{cc:40,channel:2},
    roller_mode:'cc_relative',
  }]});

  // Path 2: live device read (SysEx/serial, flat NVM shape, branch B)
  const deviceShape = normalizeFwConfig({banks:[{
    fader_cc:[11,1], fader_ch:[0,0], encoder:40, encoder_ch:2,
    roller_mode:'cc_relative',
  }]});

  // Path 3: custom preset apply (applyLibraryPreset, 'custom' branch)
  activeBank = 0;
  cfg.banks[0].roller_mode = 'cc';
  customLibraryPresets['__probe_cc_relative__'] = { custom:true, roller:{ roller_mode:'cc_relative' } };
  applyLibraryPreset('__probe_cc_relative__', 'all');
  const presetResult = cfg.banks[0].roller_mode;
  delete customLibraryPresets['__probe_cc_relative__'];

  // Bonus: cc_relative has nothing mode-specific to validate — an empty
  // uacc_values/ks_notes on a cc_relative bank must not raise a b0.uacc error.
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].uacc_values = [];
  cfg.banks[0].ks_notes = [];
  const hasUaccError = validate().some(e => e.field === 'b0.uacc');

  return {
    appShapeMode: appShape.banks[0].roller_mode,
    deviceShapeMode: deviceShape.banks[0].roller_mode,
    presetResult,
    hasUaccError,
  };
});

P('normalizeFwConfig preserves cc_relative on app-shape (backup import) input', r.appShapeMode === 'cc_relative', JSON.stringify(r));
P('normalizeFwConfig preserves cc_relative on device-shape (SysEx/serial) input', r.deviceShapeMode === 'cc_relative', JSON.stringify(r));
P('applyLibraryPreset preserves cc_relative from a custom preset', r.presetResult === 'cc_relative', JSON.stringify(r));
P('an empty-list cc_relative bank raises no validation error', r.hasUaccError === false, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- cc-relative-whitelist-probe.mjs`
Expected: FAIL on the first three checks (all silently coerce to `'cc'`); the validation check should already PASS (confirms the "no mode-specific validation needed" design decision needs no code change).

- [ ] **Step 3: Extend the three whitelists**

Line 5124, change:

```javascript
      bank.roller_mode = (bank.roller_mode === 'keyswitch' || bank.roller_mode === 'track_nav') ? bank.roller_mode : 'cc';
```

to:

```javascript
      bank.roller_mode = (bank.roller_mode === 'keyswitch' || bank.roller_mode === 'track_nav' || bank.roller_mode === 'cc_relative') ? bank.roller_mode : 'cc';
```

Line 5158, change:

```javascript
      roller_mode: (b.roller_mode === 'keyswitch' || b.roller_mode === 'track_nav') ? b.roller_mode : 'cc',
```

to:

```javascript
      roller_mode: (b.roller_mode === 'keyswitch' || b.roller_mode === 'track_nav' || b.roller_mode === 'cc_relative') ? b.roller_mode : 'cc',
```

Line 8179, change:

```javascript
      bank.roller_mode = (preset.roller.roller_mode === 'keyswitch' || preset.roller.roller_mode === 'track_nav') ? preset.roller.roller_mode : 'cc';
```

to:

```javascript
      bank.roller_mode = (preset.roller.roller_mode === 'keyswitch' || preset.roller.roller_mode === 'track_nav' || preset.roller.roller_mode === 'cc_relative') ? preset.roller.roller_mode : 'cc';
```

- [ ] **Step 4: Run the probe to confirm it passes**

Run: `npm test -- cc-relative-whitelist-probe.mjs`
Expected: all PASS

- [ ] **Step 5: Register the probe and commit**

Add `'cc-relative-whitelist-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/cc-relative-whitelist-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix: whitelist cc_relative on all 3 roller_mode normalize/import paths"
```

---

### Task 5: Full regression + push

- [ ] **Step 1: Run the entire probe suite**

Run: `npm test`
Expected: `0 failed, 0 crashed` (all probes, including the 4 new ones from this plan and every pre-existing probe — this change touches shared functions like `normalizeFwConfig`, `validate`, and `renderLiveStrip` that many other probes also exercise)

- [ ] **Step 2: Manual browser check (mirrors HW checklist style from the firmware plan)**

Open `feel-fader.html` in Chrome via `npm test`'s server (or any static server), connect a bank, switch its roller to "Relative CC", confirm: panel shows only channel/CC steppers, live HUD (once connected to real hardware running the Task-1-of-firmware-plan build) shows "ROLLER · RELATIVE CC", and switching back to Articulation/Keyswitch/Navigation still works exactly as before (regression check).

- [ ] **Step 3: Push**

```bash
git push
```
