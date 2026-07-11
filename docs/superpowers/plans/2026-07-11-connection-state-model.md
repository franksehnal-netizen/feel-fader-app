# Connection State Model (Vlna 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeden kanonický stav připojení (`connState()`) + jedna render funkce (`renderConnState()`) nahradí rozsekané `setBanner`/`updateStatus`/`loaded`-odvození; header nikdy nelže a nedostupnost živého náhledu (serial-only / MIDI-denied) je poctivě přiznaná.

**Architecture:** Vše v `feel-fader.html`. Task 1 přidá machinery (state fn + render + CSS + `#live-note` + i18n) coexistující se starým kódem — testovatelné izolovaně. Task 2 zmigruje všech 18 call sites, přepne dimming na `liveAllowed()`, smaže `setBanner`+`updateStatus`, odstraní duplicitní blind toast. Bez build/test frameworku → headless puppeteer-core.

**Tech Stack:** Vanilla HTML/CSS/JS single-file. Node + puppeteer-core (system Chrome, `pipe:true`). Git.

## Global Constraints

- ONLY `feel-fader.html` (+ probe skripty ve `scratch/`). Žádná změna protokolu/firmwaru.
- Branch `connection-state-model` (z `main`, existuje; spec+evidence commitnuté).
- Soubor velký (~3550 ř.), `device-img` má obří inline data-URI → **NIKDY full-Read**; edituj přes **Grep na lokaci → cílený Edit** s malým unikátním old_string.
- Header dot/text se odvozuje **výhradně** z `connState()`, nikdy z `loaded`. `loaded` zůstává jen pro „neničit UI při odpojení".
- Fadery se hýbají jen z HW cest (netýká se tohoto tasku, nesahat na `applyInfoFaders`/`flushFaderFrame`/`pF`).
- `showSyncBanner`/`hideSyncBanner` (differs/defaults) **beze změny** (jen doprovodné `setBanner('searching','')` → `renderConnState()`).
- `puppeteer-core` NENÍ v repu nainstalovaný: `npm install puppeteer-core --no-save`, spustit probe, pak `rm -rf node_modules package-lock.json` (necommitovat).
- Statický server na `http://localhost:8100/feel-fader.html` (servíruje pracovní strom); když neběží `node scratch/ff-serve.mjs`.
- Čísla řádků jsou vůči `main` (po Tasku 1 se posunou — v Tasku 2 lokalizuj Grepem).

**Kanonická logika (musí sedět v obou taskech):**
```js
let _midiState = 'pending';   // 'pending'|'granted'|'denied'|'unsupported'
function liveAllowed(){ return _midiState === 'granted' && _ffConnected; }
function connState(){
  const linked = _ffConnected || !!_serialPort;
  if (linked) return liveAllowed() ? 'CONNECTED_LIVE' : 'CONNECTED_BLIND';
  if (_midiState === 'denied' || _midiState === 'unsupported') return 'MIDI_BLOCKED';
  return 'DISCONNECTED';
}
```

---

## Task 1: Kanonický stav + renderConnState + surfaces (bez migrace)

**Files:** Modify `feel-fader.html` — state var (u `let _ffConnected` ~ř.1460), nové fce (u `updateStatus` ~ř.3002), CSS (`.h-status-dot` ~ř.629; stage/status CSS), `#live-note` DOM (u `<div class="stage">` ~ř.1104), i18n (`// Status` ~ř.3043). Test: `scratch/connstate-probe.mjs`.

**Interfaces:**
- Consumes: `_ffConnected`, `_serialPort`, `t()`, DOM `#h-status-dot`/`#h-status-text`.
- Produces: `_midiState`, `liveAllowed()`, `connState()`, `renderConnState()`, DOM `#live-note`, CSS `.h-status-dot.warn`/`.live-note`, i18n `status.no_device`/`status.no_live_view`/`live.note_unavailable`. (Task 2 je zapojí a smaže staré.)

- [ ] **Step 1: State var `_midiState` + timer**

Grep `let _ffConnected`. Za jeho řádek (`let _ffConnected = false;   // ...`) přidej:
```js
let _midiState = 'pending';   // 'pending'|'granted'|'denied'|'unsupported' — canonical MIDI health
let _connTextTimer = null;    // auto-hide timer for the "connected" header text
```

- [ ] **Step 2: `liveAllowed` / `connState` / `renderConnState`**

Grep `function updateStatus`. **Bezprostředně nad** `function updateStatus(){` přidej blok:
```js
// ── Connection state — single source of truth (Vlna 3) ──
function liveAllowed(){ return _midiState === 'granted' && _ffConnected; }
function connState(){
  const linked = _ffConnected || !!_serialPort;
  if (linked) return liveAllowed() ? 'CONNECTED_LIVE' : 'CONNECTED_BLIND';
  if (_midiState === 'denied' || _midiState === 'unsupported') return 'MIDI_BLOCKED';
  return 'DISCONNECTED';
}
function renderConnState(){
  const dot  = document.getElementById('h-status-dot');
  const txt  = document.getElementById('h-status-text');
  const note = document.getElementById('live-note');
  if (!dot || !txt) return;
  const s = connState();
  if (s === 'CONNECTED_LIVE'){
    dot.className = 'h-status-dot on';
    txt.classList.remove('hidden'); txt.textContent = t('status.connected');
    clearTimeout(_connTextTimer); _connTextTimer = setTimeout(() => txt.classList.add('hidden'), 3000);
  } else if (s === 'CONNECTED_BLIND'){
    clearTimeout(_connTextTimer);
    dot.className = 'h-status-dot warn';
    txt.classList.remove('hidden'); txt.textContent = t('status.no_live_view');
  } else if (s === 'MIDI_BLOCKED'){
    clearTimeout(_connTextTimer);
    dot.className = 'h-status-dot err';
    txt.classList.remove('hidden');
    txt.textContent = _midiState === 'unsupported' ? t('midi.unavailable') : t('midi.denied');
  } else { // DISCONNECTED
    clearTimeout(_connTextTimer);
    dot.className = 'h-status-dot';
    txt.classList.remove('hidden'); txt.textContent = t('status.no_device');
  }
  if (note) note.hidden = (s !== 'CONNECTED_BLIND');
}
```

- [ ] **Step 3: CSS `.h-status-dot.warn` + `.live-note`**

Grep `.h-status-dot.err` (~ř.633). Za jeho řádek přidej:
```css
.h-status-dot.warn{background:#e6a23c}
```
Grep `.send-callout{` (~ř.134). **Nad** něj přidej:
```css
.live-note{margin:6px 0 0;font-size:11px;color:var(--t3);text-align:center;line-height:1.4;}
.live-note[hidden]{display:none;}
```

- [ ] **Step 4: `#live-note` DOM**

Grep `<div class="stage">` (unikátní). Nahraď ten jeden řádek za:
```html
  <div class="stage">
    <div id="live-note" class="live-note" hidden>Live positions unavailable — MIDI not connected.</div>
```
(vloží note jako první dítě `.stage`, nad zařízení; text je statický, řídí ho `renderConnState`.)

- [ ] **Step 5: i18n klíče**

Grep `'status.connected': 'device connected',`. Za jeho řádek (pod `'status.disconnected'`) přidej:
```js
    'status.no_device': 'no device',
    'status.no_live_view': 'connected · no live view',
    'live.note_unavailable': 'Live positions unavailable — MIDI not connected.',
```
(`status.disconnected` zatím NEmaž — smaže se v Tasku 2 po odpojení posledního uživatele.)

- [ ] **Step 6: Headless probe**

Vytvoř `scratch/connstate-probe.mjs` (pattern: system Chrome, `pipe:true`, `createRequire`):
```js
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
```

- [ ] **Step 7: Spustit probe**

Ověř server (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/feel-fader.html` → 200; jinak `node scratch/ff-serve.mjs` na pozadí). Pak:
Run: `npm install puppeteer-core --no-save && node scratch/connstate-probe.mjs; rm -rf node_modules package-lock.json`
Expected: **všech 6 PASS**. Když FAIL → oprav odpovídající Step.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/connstate-probe.mjs
git commit -m "feat: canonical connection state (connState/liveAllowed/renderConnState) + live-note surface (not yet wired)"
```

---

## Task 2: Migrace call sites + přepnutí dimming + smazání starého

**Files:** Modify `feel-fader.html` — 18 call sites `setBanner`/`updateStatus`, dva `.live-placeholder` render sinky, def `setBanner`+`updateStatus`, blind toast (2828). Test: rozšířit `scratch/connstate-probe.mjs` o reálné toky nebo nový `scratch/connstate-flow-probe.mjs`.

**Interfaces:** Consumes: `renderConnState`/`liveAllowed`/`_midiState` z Tasku 1. Produces: appka řízená výhradně `connState()`; `setBanner`/`updateStatus` neexistují.

- [ ] **Step 1: `initMidi` — nastavit `_midiState` + renderConnState**

Grep `if(!navigator.requestMIDIAccess){setBanner('error','');return;}`. Nahraď za:
```js
  if(!navigator.requestMIDIAccess){ _midiState='unsupported'; renderConnState(); return; }
```
Grep `setBanner('searching','');` uvnitř `initMidi` (řádek hned pod tím, před `navigator.requestMIDIAccess({sysex:true})`). Nahraď za:
```js
  renderConnState();
```
Grep `},()=>setBanner('error',t('midi.denied')));`. Nahraď za:
```js
  },()=>{ _midiState='denied'; renderConnState(); });
```
Pozor: v `then(acc=>{ ... })` je `midiAccess=acc;` — hned za něj přidej `_midiState='granted';`. (Grep `midiAccess=acc;`.)

- [ ] **Step 2: `connectInputs` — found/not-found**

Grep `setBanner('connected',names.join(', '));`. Nahraď za:
```js
    renderConnState();
```
Grep `setBanner('searching', t('midi.not_feel_fader'));` a `setBanner('searching', t('midi.none'));` — oba nahraď za `renderConnState();` (F3: sjednoceno na „no device"; `_midiState` už 'granted' z then). Následující `updateStatus();` (Grep, v not-found větvi) → smaž (renderConnState už zavoláno).

- [ ] **Step 3: handleSysEx CMD_W apply (2660-2669)**

Grep `setBanner('connected',t('midi.synced'));` (v bloku s `cfg=p;loaded=true;`). Nad ním je `render();`. Nahraď dvojici:
```js
      setBanner('connected',t('midi.synced'));
      updateStatus();
```
za:
```js
      renderConnState();
```
(toast `config_loaded` hned pod tím ponech.) Dále Grep `setBanner('connected', '');` (v catch pod `toast('e', t('toast.config_error')...`). Nahraď za `renderConnState();`.

- [ ] **Step 4: serial load path (2827) + F2 blind toast**

Grep `updateStatus();` následované `if (!midiAccess) {`. Nahraď `updateStatus();` za `renderConnState();`. Pak **smaž celý blok** (F2 — perzistentní CONNECTED_BLIND ho nahrazuje):
```js
  if (!midiAccess) {   // serial OK, ale MIDI zamítnuté/nedostupné → live fadery nepojedou
    toast('i', "Loaded over USB serial, but MIDI is blocked — live fader display won't update. Allow MIDI in the browser's site settings and reload.");
  }
```

- [ ] **Step 5: welcome Start load (2849) + sync banner adjacents (2875-2885)**

Grep `setBanner('connected', t('midi.synced'));` (v `try{ await loadConfigFromDevice(); ...` welcome bloku, vedle `toast('s', t('toast.config_loaded'));`). Nahraď za `renderConnState();`.
Grep `showSyncBanner('defaults'); setBanner('searching', '');` → `showSyncBanner('defaults'); renderConnState();`.
Grep `showSyncBanner('differs'); setBanner('searching', '');` → `showSyncBanner('differs'); renderConnState();`.
Grep `setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded'));` → `renderConnState(); toast('s', t('toast.config_loaded'));`.
Grep zbylý samotný `setBanner('searching', '');` (poslední, ~2885) → `renderConnState();`.

- [ ] **Step 6: Přepnout dimming na `liveAllowed()`**

Grep `section-live-val${_ffConnected ? '' : ' live-placeholder'}` (dvě místa: fader val span + enc badge). Oba `_ffConnected` v této podmínce nahraď za `liveAllowed()`:
```
`<span class="section-live-val${liveAllowed() ? '' : ' live-placeholder'}" ...`
```
(replace_all na řetězci `section-live-val${_ffConnected ? '' : ' live-placeholder'}` → `section-live-val${liveAllowed() ? '' : ' live-placeholder'}`.)

- [ ] **Step 7: Smazat `updateStatus` + `setBanner` + osiřelý i18n**

Grep `function updateStatus(){` → smaž **celou** funkci (`3002`-tělo až po uzavírací `}`; end větev `else{...}` + `document.body.classList` řádky). Ověř Grepem, že `updateStatus(` má 0 zbylých volání.
Grep `function setBanner(type, m){` → smaž **celou** funkci (`2573`-tělo). Ověř `setBanner(` = 0 volání.
Grep `'status.disconnected':` → pokud `t('status.disconnected')` má 0 zbylých použití (Grep), smaž ten i18n řádek + osiřelý HTML default `t('status.disconnected')` v `#h-status-text` (Grep `id="h-status-text">t('status.disconnected')` → nahraď obsah za prázdný nebo `t('status.no_device')`).

- [ ] **Step 8: Headless flow probe**

Vytvoř `scratch/connstate-flow-probe.mjs` (stejný launch pattern). Ověř reálné chování + čistotu:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
// simulate "loaded config but device unplugged" — header must NOT say connected
const r = await p.evaluate(()=>{
  loaded = true; _ffConnected=false; _serialPort=null; _midiState='granted';
  renderConnState();
  const txt=document.getElementById('h-status-text').textContent;
  const dot=document.getElementById('h-status-dot').className;
  return { txt, dot, noConnected: !/connected/i.test(txt) || /no/i.test(txt) };
});
P('loaded+unplugged → not "connected"', r.dot==='h-status-dot' && /no device/i.test(r.txt), JSON.stringify(r));
// gone functions
const g = await p.evaluate(()=>({ setBanner: typeof setBanner, updateStatus: typeof updateStatus }));
P('setBanner removed', g.setBanner==='undefined', g.setBanner);
P('updateStatus removed', g.updateStatus==='undefined', g.updateStatus);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```
Run: `npm install puppeteer-core --no-save && node scratch/connstate-probe.mjs && node scratch/connstate-flow-probe.mjs; rm -rf node_modules package-lock.json`
Expected: Task-1 probe 6/6 PASS + flow probe všechny PASS.

- [ ] **Step 9: Grep čistota**

Run: `grep -nE "setBanner|updateStatus" feel-fader.html`
Expected: **0** (ani def, ani volání).
Run: `grep -nE "_ffConnected \? '' : ' live-placeholder'" feel-fader.html` → **0** (vše přepnuto na `liveAllowed()`).

- [ ] **Step 10: Commit**

```bash
git add feel-fader.html scratch/connstate-flow-probe.mjs
git commit -m "feat: wire connection state model — migrate all call sites, dim via liveAllowed, drop setBanner/updateStatus"
```

---

## Závěrečné ověření

- Oba proby PASS (`connstate-probe.mjs` 6/6 + `connstate-flow-probe.mjs`).
- `grep -nE "setBanner|updateStatus|_ffConnected \? '' : ' live-placeholder'" feel-fader.html` → 0.
- Manuální smoke (Frank): načíst config offline (bez zařízení) → header „no device" (ne connected); odpojit zařízení → header přepne na „no device"; (serial-only/MIDI-denied scénář dle možností) → amber „no live view" + pozn. u faderů.
- Light+dark: amber dot + `.live-note` čitelné v obou.

## Self-review (autor plánu)

- **Spec coverage:** `connState`/`liveAllowed` (T1 S2) · renderConnState surfaces incl. `#live-note` (T1 S2/S4) · amber CSS (T1 S3) · i18n (T1 S5) · retire všech 18 sites dle mapy (T2 S1-S5) · dimming→liveAllowed (T2 S6) · smazání starého + F2 blind toast + F3 sjednocení (T2 S4/S7) · init `_midiState='pending'` F1 (T1 S1). ✓
- **Placeholdery:** žádné — každý Edit konkrétní; proby plný kód. ✓
- **Konzistence:** `connState`/`liveAllowed`/`renderConnState` identické v Global Constraints i T1 S2; i18n klíče (`status.no_device`/`status.no_live_view`/`midi.unavailable`/`midi.denied`) použité v renderConnState = definované v T1 S5 / existující. ✓
- **Riziko:** střední (18 call sites) — proto T2 má grep-čistotu (S9) + flow probe (S8) jako gate; T1 machinery ověřená izolovaně před zapojením.
