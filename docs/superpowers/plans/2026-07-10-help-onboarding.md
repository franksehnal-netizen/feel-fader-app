# Help & Guide onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rozšířit Help & Guide o mini-guides power featur (roller/macro/keyswitch/control mód/DEV-PROD) s `id` kotvami, a přidat kontextové „?" ikonky u panelů, co otevřou Help a odscrollují na příslušnou sekci.

**Architecture:** Vše v `feel-fader.html`. H1 = přepis `#help-body` obsahu (sekce s `id`) + helper `openHelpAt(id)` + CSS `.help-hint`. H2 = „?" ikonky v hlavičkách Roller a Button Macro sekcí volající `openHelpAt`.

**Tech Stack:** Vanilla HTML/CSS/JS single-file. Bez test frameworku → headless puppeteer-core (system Chrome, `pipe:true`).

## Global Constraints

- ONLY `feel-fader.html`. App-only, žádná změna protokolu/firmwaru.
- Styl Help beze změny (`.settings-subhead` + odstavce); jen nový obsah + `id` na subheady.
- Spec: `docs/superpowers/specs/2026-07-10-help-onboarding-design.md`.
- Branch `help-onboarding` (z `control-mode`, už existuje). Soubor velký → Grep na lokaci.
- Bank name/text v Helpu je statický (žádná user-data interpolace) → escaping neřešit.

---

## Task H1: Help obsah (sekce + id) + `openHelpAt` + CSS

**Files:** Modify `feel-fader.html` — `#help-body` (~ř.1206-1219), `toggleHelp` (~ř.2984), CSS (u `.advanced-toggle-btn` ~ř.1034).

**Interfaces:**
- Consumes: `toggleHelp()`, `#help-body`.
- Produces: `openHelpAt(id)` (rozbalí Help + scroll na `#id`); Help sekce s `id` `help-roller`/`help-macro`/`help-keyswitch`/`help-control`/`help-dev`.

- [ ] **Step 1: Přepsat `#help-body` obsah (sekce s `id` + nový obsah)**

Najdi `<div id="help-body" ...>` (~ř.1206) a nahraď jeho vnitřek. Zachovej *Getting started* a *Switching banks*, do *Banks & tags* přidej větu o sticky liště, a přidej/uprav sekce s `id` (styl `<div class="settings-subhead" id="…">`):

```html
      <div class="settings-subhead">Getting started</div>
      <p style="margin:0 0 12px">Connect your Feel Fader via USB and click <b>Start</b>. The configurator reads the device config; edits are sent back automatically.</p>
      <div class="settings-subhead">Banks &amp; tags</div>
      <p style="margin:0 0 12px">Names, icons and tags are saved in this browser and — with firmware 1.1.0+ — also on the device, so they follow it between computers. The sticky bar under the header always shows which bank you're editing.</p>
      <div class="settings-subhead" id="help-roller">Roller modes</div>
      <p style="margin:0 0 12px"><b>Articulation (CC)</b> — the roller steps through articulations (UACC). <b>Keyswitch</b> — the roller sends note keyswitches (see below). <b>Navigation (keys)</b> — the roller sends a keyboard key per detent (e.g. arrows) to navigate your DAW; requires Keyboard (HID).</p>
      <div class="settings-subhead" id="help-keyswitch">Keyswitch mode</div>
      <p style="margin:0 0 12px">In Keyswitch mode the roller sends MIDI note keyswitches on the configured channel. Set the notes and channel in the Roller panel; rotating steps through them.</p>
      <div class="settings-subhead" id="help-macro">Button macro (long-press)</div>
      <p style="margin:0 0 12px">A <b>long-press</b> (≥ 0.5 s) of the device button sends a defined key combo — e.g. play/stop or a DAW shortcut. Requires Keyboard (HID). A <b>short press</b> still cycles banks. The Button Macro panel appears once HID is enabled.</p>
      <div class="settings-subhead" id="help-control">Control mode (no device)</div>
      <p style="margin:0 0 12px">With <b>no Feel Fader connected</b>, the app can act as a software MIDI controller: turn on <b>Control mode</b> (top-right; only offered without a device), pick a MIDI output port (a virtual port such as loopMIDI / IAC routed to your DAW), then drag the on-screen faders to send CC from the active bank. Connecting a device switches back to mirroring.</p>
      <div class="settings-subhead">Keyboard (HID)</div>
      <p style="margin:0 0 12px">Enable HID (in Device &amp; Settings) to let the device send keystrokes — required for the Navigation roller mode and the button long-press macro.</p>
      <div class="settings-subhead" id="help-dev">Service: DEV / PROD mode</div>
      <p style="margin:0 0 12px">Hold the bank button while plugging in USB to boot <b>DEV mode</b> — the FEELFADER drive becomes visible for firmware updates. Plug in normally (button not held) for <b>PROD</b> — the drive stays hidden. Recovery: hold BOOTSEL while plugging USB → RPI-RP2 drive appears.</p>
      <div class="settings-subhead">Switching banks</div>
      <p style="margin:0">On the hardware, the button cycles through your banks. You can define up to 8 banks.</p>
```

- [ ] **Step 2: `openHelpAt(id)` helper**

Přidej u `toggleHelp` (~ř.2984):

```javascript
function openHelpAt(id){
  const body = document.getElementById('help-body');
  if (body && body.style.display === 'none') toggleHelp();   // rozbalit, když sbalený
  requestAnimationFrame(() => {                              // po rozbalení je layout hotový
    const el = document.getElementById(id);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' });
  });
}
```

(Ověř, jak `toggleHelp` přepíná — jestli řídí `#help-body.style.display` a chevron; `openHelpAt` musí rozbalit jen když je sbalený.)

- [ ] **Step 3: CSS `.help-hint`**

Přidej (u `.advanced-toggle-btn` ~ř.1034):

```css
.help-hint{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--border-s);background:none;color:var(--t3);font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;transition:all .13s;font-family:'Mulish',sans-serif;line-height:1;}
.help-hint:hover{color:var(--t1);border-color:var(--t2);}
```

- [ ] **Step 4: Ověřit headless**

Probe (`scratch/help-probe.mjs`, puppeteer-core): load, `skipWelcome();render()`. Ověř: `openHelpAt('help-macro')` → `#help-body` viditelný (display != none) a `#help-macro` existuje; sekce `help-roller/help-macro/help-keyswitch/help-control/help-dev` existují a obsahují klíčový text (`grep` v `#help-body.innerHTML`: „long-press", „Control mode", „DEV mode"). Žádné page errors. Report.

- [ ] **Step 5: Commit** — `feat: Help & Guide onboarding content (mini-guides + section ids) + openHelpAt`

---

## Task H2: Kontextové „?" ikonky u panelů

**Files:** Modify `feel-fader.html` — roller section head (Grep `encoderSectionContent` / `trackNavBody` + `.section-head`), macro section head (Grep `macroSectionContent`).

**Interfaces:** Consumes: `openHelpAt(id)` (H1). Produces: „?" tlačítka volající `openHelpAt`.

- [ ] **Step 1: „?" u Roller sekce**

Najdi hlavičku Roller sekce (`.section-head` uvnitř `encoderSectionContent` — Grep `ROLLER` / eyebrow titulek). Přidej vedle titulku (ne přes live-val badge):

```html
<button class="help-hint" title="Roller modes — help" onclick="openHelpAt('help-roller')">?</button>
```

- [ ] **Step 2: „?" u Button Macro sekce**

Najdi hlavičku Button Macro sekce (`macroSectionContent`, Grep `BUTTON` / `Macro`). Přidej:

```html
<button class="help-hint" title="Button macro — help" onclick="openHelpAt('help-macro')">?</button>
```

- [ ] **Step 3: Ověřit headless + screenshot**

Probe: `skipWelcome()`; nastav `DEVICE_INFO.hid_enabled=true; cfg.banks[0].roller_mode='track_nav'; render()` (ať jsou roller i macro sekce viditelné). Ověř: `.help-hint` tlačítka existují u roller i macro hlaviček; klik na „?" u roller → `#help-body` se rozbalí a scroll (nebo aspoň `openHelpAt` je onclick s `help-roller`). Screenshot roller+macro hlaviček (mrkni: „?" nenápadné, nekoliduje). Žádné errors. Report + screenshot.

- [ ] **Step 4: Commit** — `feat: contextual ? help hints on Roller and Button Macro panels`

---

## Závěrečné ověření

- Rozbalený Help: všechny sekce + `id`; obsah čitelný light+dark (screenshot).
- „?" u Roller → otevře Help + scroll na Roller modes; „?" u Macro → scroll na Button macro.
- Regrese: `toggleHelp` (rozbalení/sbalení Helpu) funguje dál; žádný layout jump.

## Self-review (autor plánu)

- **Spec coverage:** obsah sekce + id → H1; openHelpAt + CSS → H1; „?" ikonky Roller+Macro → H2; ověření → kroky. Control mode sekce v obsahu (větev má control mód). ✓
- **Placeholdery:** „?" umístění „Grep to locate" — implementer dohledá přesnou hlavičku; obsah H1 je konkrétní HTML. ✓
- **Konzistence:** `openHelpAt` def H1 Step2, volán H2; id v obsahu H1 = id v openHelpAt callech. ✓
- **Riziko:** nízké (obsah + drobná UI). Merge až po `control-mode`.
