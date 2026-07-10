# Control mód (v1: fadery/CC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bez připojeného HW umožnit používat web appku jako softwarový MIDI kontroler — tah faderů na obrazovce posílá CC (z aktivní banky) na uživatelem vybraný MIDI výstup.

**Architecture:** Vše v `feel-fader.html`. Dva módy: Display (default, dnešek — zrcadlí HW) vs Control (interaktivní, posílá CC). Control dostupný **jen když není HW** (`_ffConnected || _serialPort`). In-app toggle v headeru; welcome beze změny. Enabling → výběr MIDI výstupu (zapamatuje se). Fadery přes `mF` posílají CC, throttle přes rAF (jako T4, ale ven). HW connect během control módu → auto-přepnutí na display.

**Tech Stack:** Vanilla JS/CSS single-file. Web MIDI (`midiAccess` už z `initMidi`, `sysex:true`). Bez test frameworku → headless puppeteer-core (system Chrome, `pipe:true`), MIDI outputs + `output.send` stubovat.

## Global Constraints

- ONLY `feel-fader.html`. App-only, **žádná změna protokolu/firmwaru**.
- Posílá se **výhradně CC (0xB0)** na vybraný výstup. **NIKDY SysEx přes MIDI out** (endpoint wedge, 2026-07-07).
- Control mód **striktně vázán na „bez HW"** — s HW se nenabízí a auto-vypne (žádné zdvojení CC).
- `mF` (~ř.2432) je fader drag; CC/kanál z **aktivní banky** (`cfg.banks[activeBank].fader1/2.cc/channel`).
- Spec: `docs/superpowers/specs/2026-07-09-control-mode-design.md`. v1 = **jen fadery**; roller/keyswitch/tlačítko mimo.
- Soubor velký — Grep na lokaci, ne full-file Read.

---

## Task C1: Mode state + header toggle (no-HW gated) + auto-switch

**Files:** Modify `feel-fader.html` — stavové vary (~ř.1455 u `_ffConnected`), header (~ř.1081 `.h-right`), `connectInputs` (~ř.2500, kde se `_ffConnected=true`), serial connect (~ř.2823 `_serialPort=port`).

**Interfaces:**
- Consumes: `_ffConnected`, `_serialPort`.
- Produces: `controlMode` (bool), `hwPresent()` (→ `_ffConnected || !!_serialPort`), `setControlMode(on)`, `refreshControlToggle()`.

- [ ] **Step 1: Stav + helpery**

Přidat u `_ffConnected` (~ř.1455):
```javascript
let controlMode = false;
function hwPresent(){ return _ffConnected || !!_serialPort; }
```

- [ ] **Step 2: Header toggle**

Do `.h-right` (~ř.1081, vedle `dark-toggle`) přidat tlačítko (skryté defaultně):
```html
    <button class="ctrl-mode-toggle" id="ctrl-mode-toggle" onclick="toggleControlMode()" hidden>Control mode: off</button>
```
CSS (blízko `.dark-toggle`):
```css
.ctrl-mode-toggle{display:flex;align-items:center;gap:6px;background:none;border:1px solid var(--border-s);border-radius:var(--r-sm);padding:4px 10px;cursor:pointer;font-family:'Mulish',sans-serif;font-size:12px;color:var(--t2);transition:all .14s;}
.ctrl-mode-toggle.on{background:var(--red);border-color:var(--red);color:#fff;}
.ctrl-mode-toggle:hover{color:var(--t1);}
```

- [ ] **Step 3: setControlMode + refresh + toggle handler**

```javascript
function refreshControlToggle(){
  const btn=document.getElementById('ctrl-mode-toggle'); if(!btn)return;
  btn.hidden = hwPresent();               // nabízí se jen bez HW
  if(hwPresent() && controlMode) setControlMode(false);   // HW převzalo → auto-off
  btn.classList.toggle('on', controlMode);
  btn.textContent = 'Control mode: ' + (controlMode ? 'on' : 'off');
}
function setControlMode(on){
  if(on && hwPresent()){ toast('i','Odpoj Feel Fader pro control mód.'); return; }
  if(on && !ensureControlOutput()){ return; }   // C2: vybrat port; když se nepovede, nezapínat
  controlMode = !!on;
  document.body.classList.toggle('control-mode', controlMode);   // C4 vizuál
  refreshControlToggle(); renderControlIndicator();              // C4
}
function toggleControlMode(){ setControlMode(!controlMode); }
```

- [ ] **Step 4: Auto-off + refresh při změně HW stavu**

V `connectInputs` tam, kde `_ffConnected = true` (~ř.2501) a kde `_ffConnected=false` (~ř.2510), a v serial connect (~ř.2823 po `_serialPort=port`) přidat volání `refreshControlToggle();`. Když se HW připojí a byl control mód → `refreshControlToggle` ho vypne; přidat toast tam, kde se připojí HW: `if(controlMode) toast('i','Feel Fader připojen — přepínám na Display.');` PŘED `setControlMode(false)` (nebo uvnitř refresh). Také zavolat `refreshControlToggle()` jednou po `initMidi`/startu (aby toggle měl správný stav).

- [ ] **Step 5: Ověřit headless**

Probe (`scratch/cm-probe.mjs`): load, `skipWelcome();render()`. Stubuj stav: `_ffConnected=false;_serialPort=null;refreshControlToggle()` → `#ctrl-mode-toggle` NOT hidden. `_ffConnected=true;refreshControlToggle()` → hidden a `controlMode===false`. `controlMode=true;_ffConnected=true;refreshControlToggle()` → controlMode false (auto-off). Report.

- [ ] **Step 6: Commit** — `feat: control mode state + header toggle gated on no-HW + auto-switch`

---

## Task C2: Výběr MIDI výstupního portu + persistence

**Files:** Modify `feel-fader.html` — nové funkce; localStorage klíč.

**Interfaces:**
- Consumes: `midiAccess.outputs` (~ř.2503 vzor), `isFeelFader` (~ř.2472).
- Produces: `getControlOutput()` (→ MIDIOutput|null), `ensureControlOutput()` (→ bool; vybere/potvrdí port, uloží), `pickControlOutput()` (UI výběr). Klíč `LS_CTRL_OUT='ff-ctrl-out'`.

- [ ] **Step 1: Enumerace + uložení**

```javascript
const LS_CTRL_OUT='ff-ctrl-out';
function controlOutputs(){   // MIDI výstupy mimo samotný Feel Fader
  const outs=[]; if(midiAccess) midiAccess.outputs.forEach(o=>{ if(!isFeelFader(o.name)) outs.push(o); }); return outs;
}
function getControlOutput(){
  const id=localStorage.getItem(LS_CTRL_OUT); if(!id||!midiAccess) return null;
  const o=midiAccess.outputs.get(id); return (o && !isFeelFader(o.name)) ? o : null;
}
```

- [ ] **Step 2: ensureControlOutput + picker**

```javascript
function ensureControlOutput(){
  let o=getControlOutput(); if(o){ o.open().catch(()=>{}); return true; }
  const outs=controlOutputs();
  if(outs.length===0){ toast('e','Žádný MIDI výstup. Zapni virtuální port (loopMIDI/IAC) a zkus znovu.'); return false; }
  return pickControlOutput(outs);   // vybere; uloží LS_CTRL_OUT; open(); vrátí true/false
}
```
`pickControlOutput(outs)` — jednoduchý výběr: když je 1 výstup, vzít ho; víc → malý modal/prompt se seznamem názvů (reuse existující modal/toast vzor v souboru — Grep `function toast`/existující modal). Uložit `localStorage.setItem(LS_CTRL_OUT, chosen.id)`, `chosen.open()`, vrátit true. Zrušení → false. (Detail UI dolaď dle existujících komponent; drž se jednoduchosti.)

- [ ] **Step 3: Ověřit headless (stub outputs)**

Probe: stubni `midiAccess={outputs:new Map([['x',{id:'x',name:'loopMIDI Port',open:()=>Promise.resolve(),send(){}}]])}`. `controlOutputs()` → 1 (mimo FF). `ensureControlOutput()` s 1 výstupem → true + `localStorage['ff-ctrl-out']==='x'`. Prázdné outputs → false + toast. `getControlOutput()` po uložení → vrátí ten output. Report.

- [ ] **Step 4: Commit** — `feat: control-mode MIDI output selection + persistence`

---

## Task C3: Fadery posílají CC v control módu (throttle)

**Files:** Modify `feel-fader.html` — `mF` (~ř.2432), nové rAF-outbound vary.

**Interfaces:**
- Consumes: `controlMode`, `getControlOutput()`, `cfg.banks[activeBank].fader1/2`, `liveValues`.
- Produces: `_ctrlOutDirty`/`_ctrlRaf`, `scheduleControlSend()`, `flushControlSend()`.

- [ ] **Step 1: rAF-outbound sender**

```javascript
let _ctrlOutDirty={l:false,r:false}, _ctrlRaf=false;
function scheduleControlSend(k){ _ctrlOutDirty[k]=true; if(_ctrlRaf)return; _ctrlRaf=true; requestAnimationFrame(flushControlSend); }
function flushControlSend(){
  _ctrlRaf=false; const out=getControlOutput(); if(!out) return;
  const b=cfg.banks[activeBank];
  if(_ctrlOutDirty.l){ _ctrlOutDirty.l=false; out.send([0xB0|(b.fader1.channel&0x0F), b.fader1.cc&0x7F, liveValues.f1&0x7F]); }
  if(_ctrlOutDirty.r){ _ctrlOutDirty.r=false; out.send([0xB0|(b.fader2.channel&0x0F), b.fader2.cc&0x7F, liveValues.f2&0x7F]); }
}
```

- [ ] **Step 2: mF pošle CC v control módu**

V `mF` (~ř.2432), kde se nastaví `liveValues.f1`/`f2` (větve `if(k==='l')`/`else`), přidat na konec každé větve:
```javascript
    if(controlMode) scheduleControlSend(k);
```
(Value drží, žádný snap-back — beze změny.)

- [ ] **Step 3: Ověřit headless (zachytit send)**

Probe: stub output se `send=(a)=>captured.push(a)`, ulož ho jako control output, `controlMode=true`, `activeBank=0`. Zavolej `mF('l', <clientY>)` několikrát rychle → po rAF flush je zachyceno **max ~1 CC na frame** (coalesced), poslední hodnota, rámec `[0xB0|ch, cc, val]` s `cc/ch` z `cfg.banks[0].fader1`. `controlMode=false` → `mF` nic nepošle. Report.

- [ ] **Step 4: Commit** — `feat: on-screen faders send CC in control mode (rAF-throttled, from active bank)`

---

## Task C4: „CONTROL MODE" indikátor + aktivní fadery

**Files:** Modify `feel-fader.html` — indikátor (blízko stage/header), CSS.

**Interfaces:** Consumes: `controlMode`, `getControlOutput()`. Produces: `renderControlIndicator()`.

- [ ] **Step 1: Indikátor**

`renderControlIndicator()` — když `controlMode`, zobrazit pruh/badge „CONTROL MODE → <název portu>" (getControlOutput().name); jinak skrýt. Umístit nenápadně (např. pod header/nad stage). Volat z `setControlMode`.

- [ ] **Step 2: Aktivní fadery (vizuál)**

CSS `body.control-mode .fader-track{cursor:grab}` (+ jemný akcent na palcích, např. `body.control-mode .fader-thumb img{filter:drop-shadow(...) saturate(1.1)}` nebo tint) — odliší „živý kontroler" od read-only zrcadla (à la S8). Drž jemné.

- [ ] **Step 3: Ověřit headless + screenshot**

Probe: `controlMode=true` + stub output → indikátor viditelný s názvem portu; `body.control-mode` třída je. Screenshot. `controlMode=false` → indikátor skrytý. Report + mrkni na screenshot.

- [ ] **Step 4: Commit** — `feat: CONTROL MODE indicator + active fader styling`

---

## Závěrečné ověření

- **Bez HW** (localhost/demo, žádné zařízení): toggle se objeví → zapnout → vybrat výstupní port (a ověřit chování při 0 výstupech) → tah faderem → CC dorazí na port (MIDI monitor / DAW) se správným CC#/kanálem/hodnotou; rychlý tah = rozumná frekvence; přepnutí banky mění CC/kanál.
- **HW connect**: připojit Feel Fader během control módu → auto-přepnutí na Display + toast; toggle zmizí.
- **Regrese Display**: s HW se nic nezměnilo (fadery zrcadlí, nic neposílají).
- **Bezpečnost**: nikdy se neposílá SysEx přes výstup; jen CC.

## Self-review (autor plánu)

- **Spec coverage:** dva módy + no-HW gating + in-app toggle + auto-switch → C1; výběr portu + persistence + no-output → C2; fadery CC z aktivní banky + throttle → C3; indikátor + aktivní vizuál → C4; jen CC/nikdy SysEx, app-only → Global. ✓
- **Placeholdery:** picker UI (C2 Step 2) záměrně „dle existujících komponent" — implementer dohledá modal/toast vzor; zbytek konkrétní kód. ✓
- **Konzistence:** `controlMode`/`hwPresent` (C1) použity v C3/C4; `ensureControlOutput`/`getControlOutput` (C2) v C1/C3; `scheduleControlSend` (C3 Step1) v mF (Step2). ✓
- **Riziko:** nízké (app-only, gated na no-HW). Hlavní ověření = bez-HW round-trip do DAWu (Frank).
