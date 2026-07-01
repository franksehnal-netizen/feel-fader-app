# Feel Fader UX/polish pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikovat 11 UX/polish úprav do `feel-fader.html` (jednosouborový konfigurátor) bez zásahu do drátového protokolu a firmwaru.

**Architecture:** Vše je jeden statický soubor `feel-fader.html` (HTML + CSS v `<style>` + JS v `<script>`). Žádný build step, žádný automatizovaný test runner. Verifikace = otevřít soubor v Chromium prohlížeči (Web Serial), provést akci, sledovat výsledek. Změny jsou lokální edity funkcí/CSS pravidel; `cfg` schéma se nemění.

**Tech Stack:** Vanilla HTML/CSS/JS, single-file. Ověřování v Chrome/Edge.

## Global Constraints

- **Jediný soubor:** všechny změny v `feel-fader.html`. Žádné nové soubory (kromě docs).
- **UI copy je anglicky** (appka je plně EN). Nové stringy anglicky.
- **Neměnit** `cfg` schéma, `CMD_R/W/INFO/HID`, SysEx ani serial JSON cestu, firmware.
- **`MAX_BANKS = 8`** (nová hodnota).
- **Verifikace ruční** v prohlížeči — každý task končí popsanou vizuální kontrolou + commitem.
- Žádná změna se nesmí prát s live update thumbů (`#thumb-l`/`#thumb-r` mají vlastní `transition:top`).

---

### Task 1: Roller panel — mode-aware titul/badge + přejmenování (bod 6 + 7)

**Files:**
- Modify: `feel-fader.html` — `encoderPanel()` (~ř. 1699–1710), roller-mode-row `labels` (~ř. 1713), MIDI handler badge update (~ř. 2395)

**Interfaces:**
- Consumes: `cfg.banks[bi].roller_mode` (`'cc'|'keyswitch'|'track_nav'`), `uaccName(val)`, `setTxt(id,val)`
- Produces: panel s titulem „Roller" a `#enc-artic-badge`, který je neprázdný jen v režimu `cc`

- [ ] **Step 1: Přejmenovat titul a udělat badge mode-aware v `encoderPanel()`**

Najdi:
```js
function encoderPanel(ctrl, bi) {
  const bankUacc = cfg.banks[bi].uacc_values || [];
  const initVal  = bankUacc[0] ?? 0;
  const initName = uaccName(initVal);

  return `
  <div class="panel panel-wide">
    <div class="panel-head">
      <div class="panel-dot solid"></div>
      <span class="panel-name">Articulation Encoder</span>
      <span class="section-live-val" id="enc-artic-badge">${initName}</span>
    </div>
```
Nahraď:
```js
function encoderPanel(ctrl, bi) {
  const bankUacc = cfg.banks[bi].uacc_values || [];
  const initVal  = bankUacc[0] ?? 0;
  const initName = uaccName(initVal);
  const rmode    = cfg.banks[bi].roller_mode || 'cc';
  const badge    = rmode === 'cc' ? initName : '';

  return `
  <div class="panel panel-wide">
    <div class="panel-head">
      <div class="panel-dot solid"></div>
      <span class="panel-name">Roller</span>
      <span class="section-live-val" id="enc-artic-badge">${badge}</span>
    </div>
```

- [ ] **Step 2: Přejmenovat režim v roller-mode-row**

Najdi:
```js
const labels = {cc:'Articulation (CC)', keyswitch:'Keyswitch', track_nav:'Track nav (HID)'};
```
Nahraď:
```js
const labels = {cc:'Articulation (CC)', keyswitch:'Keyswitch', track_nav:'Navigation (keys)'};
```

- [ ] **Step 3: Guard badge update v MIDI handleru**

Najdi:
```js
      setTxt('enc-artic-name', uaccName(val));
      setTxt('enc-artic-badge', uaccName(val));
```
Nahraď:
```js
      setTxt('enc-artic-name', uaccName(val));
      if((bank.roller_mode||'cc')==='cc') setTxt('enc-artic-badge', uaccName(val));
```

- [ ] **Step 4: Verifikace v prohlížeči**

Otevři `feel-fader.html` v Chrome. Zkontroluj: titul panelu je „Roller". V režimu **Articulation (CC)** badge ukazuje název artikulace. Přepni roller na **Navigation (keys)** (tlačítko třetí) → badge zmizí (prázdný), titul zůstává „Roller". Přepni na **Keyswitch** → badge také prázdný.
Expected: žádné stálé „legato" v Navigation/Keyswitch režimu.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "feat: mode-aware Roller panel title/badge + rename track-nav mode"
```

---

### Task 2: Track-nav labely kapitálkami + INVERT zarovnání + bank cap (bod 5 + 4)

**Files:**
- Modify: `feel-fader.html` — `trackNavBody()` (~ř. 1733–1752), `MAX_BANKS` konstanta (~ř. 1348), a přidat CSS třídu pro INVERT blok

**Interfaces:**
- Consumes: `keyComboLabel()`, `b.nav_invert`
- Produces: nezměněné id `navcap-${bi}-cw` / `-ccw`

- [ ] **Step 1: Snížit strop bank**

Najdi:
```js
const MAX_BANKS = 10;
```
Nahraď:
```js
const MAX_BANKS = 8;
```

- [ ] **Step 2: Kapitálky + zarovnaný INVERT v `trackNavBody()`**

Najdi:
```js
    <div class="section-field-row">
      <div class="field-block">
        <span class="field-label">roll up</span>
        <button class="step-btn" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm)"
          id="navcap-${bi}-cw" onclick="startKeyCapture(${bi},'cw')">${cwLbl}</button>
      </div>
      <div class="field-block">
        <span class="field-label">roll down</span>
        <button class="step-btn" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm)"
          id="navcap-${bi}-ccw" onclick="startKeyCapture(${bi},'ccw')">${ccwLbl}</button>
      </div>
      <div class="field-block">
        <span class="field-label">INVERT</span>
        <input type="checkbox" ${b.nav_invert?'checked':''} onchange="cfg.banks[${bi}].nav_invert=this.checked;dirty=true;render()">
      </div>
    </div>
```
Nahraď:
```js
    <div class="section-field-row">
      <div class="field-block">
        <span class="field-label">ROLL UP</span>
        <button class="step-btn" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm)"
          id="navcap-${bi}-cw" onclick="startKeyCapture(${bi},'cw')">${cwLbl}</button>
      </div>
      <div class="field-block">
        <span class="field-label">ROLL DOWN</span>
        <button class="step-btn" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm)"
          id="navcap-${bi}-ccw" onclick="startKeyCapture(${bi},'ccw')">${ccwLbl}</button>
      </div>
      <div class="field-block field-block-invert">
        <span class="field-label">INVERT</span>
        <input type="checkbox" ${b.nav_invert?'checked':''} onchange="cfg.banks[${bi}].nav_invert=this.checked;dirty=true;render()">
      </div>
    </div>
```

- [ ] **Step 3: CSS — vycentrovat checkbox na výšku capture tlačítek**

Za pravidlo `.info-grid` (nebo kamkoliv do `<style>`) přidej:
```css
.field-block-invert{justify-content:flex-start;}
.field-block-invert input[type=checkbox]{height:32px;margin:0;align-self:flex-start;transform:scale(1.15);transform-origin:left center;}
```
(`32px` = výška `.step-btn`; label tří bloků tak sedí na jedné lince a checkbox lícuje s tlačítky.)

- [ ] **Step 4: Verifikace v prohlížeči**

Otevři appku, přepni roller na **Navigation (keys)**. Zkontroluj: popisky jsou `ROLL UP`, `ROLL DOWN`, `INVERT` (všechny kapitálkami, na stejné lince). Checkbox INVERT je výškově zarovnaný se sousedními tlačítky, ne „plavoucí". Pak v modálu/steppera zkus přidat banky — nejde přes 8 (toast „Maximum 8 banks").
Expected: konzistentní řádek + strop 8.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "feat: uppercase roll labels, align INVERT, lower MAX_BANKS to 8"
```

---

### Task 3: Tag návrhy z historie místo fixního seznamu (bod 1)

**Files:**
- Modify: `feel-fader.html` — `renderPanels()` tagSuggestions blok (~ř. 1437–1439)

**Interfaces:**
- Consumes: `cfg.banks[]`, `activeBank`
- Produces: `<datalist>` naplněný sjednocením historických tagů (case-insensitive dedup), bez fixních značek

- [ ] **Step 1: Nahradit statický seznam dynamickým z historie**

Najdi:
```js
  const tagSuggestions = ['SF','EW','OT','NI','VSL','CS','KT','8Dio','BBCSO','CSS','HS','LA',
    'Spitfire','East West','Orchestral Tools','Native Instruments','Vienna',
    'Cinematic Studio','Kontakt','8Dio','Hans Zimmer'].map(s=>`<option value="${s}">`).join('');
```
Nahraď:
```js
  // Návrhy tagů = sjednocení všech tagů napříč bankami, mimo ty už na aktivní bance.
  // Case-insensitive dedup, zobrazí se první výskyt.
  const usedOnBank = new Set((b.tags||[]).map(x=>x.toLowerCase()));
  const seen = new Set();
  const suggestList = [];
  cfg.banks.forEach(bk => (bk.tags||[]).forEach(tg => {
    const k = tg.toLowerCase();
    if (usedOnBank.has(k) || seen.has(k)) return;
    seen.add(k); suggestList.push(tg);
  }));
  const tagSuggestions = suggestList.map(s=>`<option value="${s}">`).join('');
```

- [ ] **Step 2: Verifikace v prohlížeční**

Otevři appku (čistý stav → možná žádné návrhy). Na Bank 1 přidej tagy `Spitfire` a `Strings`. Přepni na Bank 2, klikni do tag inputu → našeptávač nabídne `Spitfire` a `Strings` (z historie). Na Bank 2 přidej `spitfire` (malými) — po přidání se `Spitfire` v návrzích neduplikuje. Fixní značky (`SF`, `EW`, `Kontakt`…) se **nenabízejí**, pokud jsi je nikdy nepoužil.
Expected: návrhy jen z historie, bez duplicit.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html
git commit -m "feat: tag suggestions from history instead of fixed brand list"
```

---

### Task 4: LEFT/RIGHT FADER caption nad sekcí (bod 2)

**Files:**
- Modify: `feel-fader.html` — `faderSectionContent()` section-head (~ř. 1494–1500), + CSS pro caption

**Interfaces:**
- Consumes: `key` (`'fader1'|'fader2'`)
- Produces: needitovatelný caption element `.fader-side-cap` nad názvem; přidává `data-fader` na `.section-head` (využije Task 8)

- [ ] **Step 1: Přidat caption + data-fader do section-head**

Najdi:
```js
  return `
    <div class="section-head">
      <div class="panel-dot"></div>
      <input class="panel-name-input" value="${displayLabel}"
        onchange="onFaderLabel(${bi},'${key}',this.value)" />
      <span class="section-live-val" id="${valId}-val">${lv}</span>
    </div>
```
Nahraď:
```js
  const sideCap = key==='fader1' ? 'LEFT FADER' : 'RIGHT FADER';
  return `
    <div class="fader-side-cap">${sideCap}</div>
    <div class="section-head" data-fader="${key}">
      <div class="panel-dot"></div>
      <input class="panel-name-input" value="${displayLabel}"
        onchange="onFaderLabel(${bi},'${key}',this.value)" />
      <span class="section-live-val" id="${valId}-val">${lv}</span>
    </div>
```

- [ ] **Step 2: CSS pro caption**

Do `<style>` přidej:
```css
.fader-side-cap{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:4px;}
```

- [ ] **Step 3: Verifikace v prohlížeči**

Otevři appku. Nad levou fader sekcí je šedý nadpis `LEFT FADER`, nad prostřední/pravou `RIGHT FADER`. Přejmenuj editovatelný název sekce (např. „Expression" → „CC11") → caption `LEFT FADER` zůstává.
Expected: fixní L/R caption nezávislý na editovatelném názvu.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "feat: fixed LEFT/RIGHT FADER caption above fader sections"
```

---

### Task 5: Sloučit Device Info + Advanced → „Device & Settings" + zarovnání řádků (bod 10 + 3)

> Bod 3 (zarovnání macro/HID řádku) je složen sem, protože sloučení přepisuje přesně ten markup — zarovnání se řeší rovnou v novém markupu + jedním CSS pravidlem.

**Files:**
- Modify: `feel-fader.html` — device-info panel markup (~ř. 1061–1090), advanced-wrap markup (~ř. 1092–1140), `toggleDeviceInfo()`/`toggleAdvanced()` (~ř. 2809–2829), `.info-row` CSS (~ř. 416)

**Interfaces:**
- Consumes: `toggleAdvanced` (přejmenováno), obsah `device-info-body` + `advanced-body`
- Produces: jeden panel `#device-settings`, jeden toggle `toggleDeviceSettings()`, zachovaná id `#macro-capture`, `#hid-toggle`, `#di-firmware`, `#di-serial`, `#json-pre`, `#advanced-body` obsah

- [ ] **Step 0: Přidat CSS pro zarovnané interaktivní řádky (bod 3)**

Najdi:
```css
.info-row{display:flex;flex-direction:row;align-items:baseline;gap:8px;}
```
Nahraď:
```css
.info-row{display:flex;flex-direction:row;align-items:baseline;gap:8px;}
.info-row.info-row-action{align-items:center;justify-content:space-between;}
.info-row.info-row-action .info-lbl{min-width:0;}
```

- [ ] **Step 1: Nahradit oba panely jedním sloučeným**

Nahraď celý blok od `<!-- DEVICE INFO -->` (ř. ~1061) po konec `advanced-wrap` `</div>` (ř. ~1140) tímto:
```html
  <!-- DEVICE & SETTINGS (sloučené Device Info + Advanced) -->
  <div class="panel panel-wide" style="padding:0;overflow:hidden;width:100%">
    <button class="advanced-toggle-btn" onclick="toggleDeviceSettings()" id="device-settings-toggle-btn">
      <div style="display:flex;align-items:center;gap:7px">
        <div class="panel-dot"></div>
        <span class="panel-name" style="margin:0">Device &amp; Settings</span>
      </div>
      <span id="device-settings-chevron" style="font-size:11px;color:var(--t3)">▼</span>
    </button>
    <div id="device-settings-body" style="display:none;padding:12px 16px 16px;border-top:1px solid var(--border)">

      <!-- Subsekce: Device -->
      <div class="settings-subhead">Device</div>
      <div class="info-grid">
        <div class="info-row"><span class="info-lbl"><span data-i18n="device.product">Product</span></span><span class="info-val">Feel Fader</span></div>
        <div class="info-row"><span class="info-lbl">Manufacturer</span><span class="info-val">Acoustic Empire</span></div>
        <div class="info-row"><span class="info-lbl">Firmware</span><span class="info-val" id="di-firmware" style="color:var(--t2)">—</span></div>
        <div class="info-row"><span class="info-lbl">Serial</span><span class="info-val" id="di-serial" style="color:var(--t2)">—</span></div>
        <div class="info-row info-row-action">
          <span class="info-lbl">Keyboard (HID)</span>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="hid-toggle" onchange="onHidToggle(this.checked)">
            <span class="info-val" id="hid-state">—</span>
          </label>
        </div>
        <div class="info-row info-row-action">
          <span class="info-lbl">Button macro (long-press)</span>
          <button id="macro-capture" class="step-btn" style="width:auto;padding:4px 12px;border:1px solid var(--border-s);border-radius:var(--r-sm)"
            onclick="startMacroCapture()">—</button>
        </div>
      </div>

      <div class="settings-divider"></div>

      <!-- Subsekce: Preset & data -->
      <div class="settings-subhead">Preset &amp; data</div>
      <div class="advanced-inner">
        <div class="advanced-item">
          <div class="advanced-item-info">
            <span class="advanced-item-title" data-i18n="btn.export">↓ Export preset</span>
            <span class="advanced-item-desc" data-i18n="advanced.export_desc">Save current configuration as a JSON file.</span>
          </div>
          <button class="btn btn-ghost" onclick="exportP()" data-i18n="btn.export">↓ Export preset</button>
        </div>
        <div class="advanced-item">
          <div class="advanced-item-info">
            <span class="advanced-item-title" data-i18n="btn.import">↑ Import preset</span>
            <span class="advanced-item-desc" data-i18n="advanced.import_desc">Load a previously saved preset.</span>
          </div>
          <button class="btn btn-ghost" onclick="importP()" data-i18n="btn.import">↑ Import preset</button>
        </div>
        <div class="advanced-item">
          <div class="advanced-item-info">
            <span class="advanced-item-title" data-i18n="btn.reset">Reset</span>
            <span class="advanced-item-desc" data-i18n="advanced.reset_desc">Reset all settings to factory defaults.</span>
          </div>
          <button class="btn btn-del" onclick="doReset()" data-i18n="btn.reset">Reset</button>
        </div>
        <div class="advanced-item" style="flex-direction:column;align-items:stretch">
          <div class="json-toggle" onclick="toggleJson()" style="border-radius:8px;border:1px solid var(--border);padding:10px 14px">
            <span style="font-size:12px;color:var(--t2)">presets.json</span>
            <span id="json-lbl" style="font-size:11px;color:var(--t3)">▼ show</span>
          </div>
          <div class="json-body" id="json-body" style="display:none;border-radius:0 0 8px 8px">
            <pre class="json-pre" id="json-pre"></pre>
            <button class="json-copy-btn" onclick="copyJson()" data-i18n="btn.copy">Copy to clipboard</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div id="json-sec" style="display:none"></div>
```

- [ ] **Step 2: CSS pro subheady/divider**

Do `<style>` přidej:
```css
.settings-subhead{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin:0 0 8px;}
.settings-divider{height:1px;background:var(--border);margin:16px 0;}
```

- [ ] **Step 3: Nahradit toggle funkce jednou**

Najdi `toggleDeviceInfo()` (~ř. 2823) a `toggleAdvanced()` (~ř. 2809). Nahraď obě tělo jedinou funkcí — smaž `toggleDeviceInfo` a `toggleAdvanced`, přidej:
```js
function toggleDeviceSettings(){
  const body    = document.getElementById('device-settings-body');
  const chevron = document.getElementById('device-settings-chevron');
  const btn     = document.getElementById('device-settings-toggle-btn');
  const open    = body.style.display !== 'none';
  body.style.display  = open ? 'none' : 'block';
  chevron.textContent = open ? '▼' : '▲';
  btn && btn.classList.toggle('is-open', !open);
  btn && btn.blur && btn.blur();
}
```
Pokud je `toggleAdvanced` nebo `toggleDeviceInfo` navázaná na `window.` (grep `window.toggleAdvanced`, `window.toggleDeviceInfo`), tyto řádky odstraň a přidej `window.toggleDeviceSettings = toggleDeviceSettings;` na stejné místo. Zkontroluj, že žádný jiný kód nevolá `toggleAdvanced`/`toggleDeviceInfo` (grep) — pokud ano, přesměruj na `toggleDeviceSettings`.

- [ ] **Step 4: Verifikace v prohlížeči**

Otevři appku. Místo dvou panelů je jeden „Device & Settings". Rozbalí se jedním klikem. Uvnitř nahoře subsekce **Device** (Product/Manufacturer/Firmware/Serial/HID/Macro), pod divider subsekce **Preset & data** (Export/Import/Reset/presets.json). Export/Import/Reset i JSON preview fungují. HID toggle a macro capture fungují. **Zarovnání (bod 3):** řádky „Keyboard (HID)" a „Button macro (long-press)" mají interaktivní prvek zarovnaný na pravou hranu, konzistentně mezi sebou; textové řádky (Firmware, Serial) beze změny.
Expected: jeden funkční sloučený panel, řádky zarovnané, žádná JS chyba v konzoli.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "feat: merge Device Info + Advanced into Device & Settings panel, align rows"
```

---

### Task 6: Help / Guide collapsible sekce (bod 8)

**Files:**
- Modify: `feel-fader.html` — přidat sekci za panel „Device & Settings" (za `<div id="json-sec">`, ~ř. 1141), přidat `toggleHelp()` k toggle funkcím

**Interfaces:**
- Consumes: `.advanced-toggle-btn` styl (reuse)
- Produces: `#help-body`, `toggleHelp()`

- [ ] **Step 1: Přidat markup Help sekce**

Za řádek `<div id="json-sec" style="display:none"></div>` (a před `<!-- FOOTER -->`) vlož:
```html
  <!-- HELP / GUIDE -->
  <div class="panel panel-wide" style="padding:0;overflow:hidden;width:100%">
    <button class="advanced-toggle-btn" onclick="toggleHelp()" id="help-toggle-btn">
      <div style="display:flex;align-items:center;gap:7px">
        <div class="panel-dot"></div>
        <span class="panel-name" style="margin:0">Help &amp; Guide</span>
      </div>
      <span id="help-chevron" style="font-size:11px;color:var(--t3)">▼</span>
    </button>
    <div id="help-body" style="display:none;padding:12px 16px 16px;border-top:1px solid var(--border);font-size:12px;line-height:1.6;color:var(--t2)">
      <div class="settings-subhead">Getting started</div>
      <p style="margin:0 0 12px">Connect your Feel Fader via USB and click <b>Start</b>. The configurator reads the device config; edits are sent back automatically.</p>
      <div class="settings-subhead">Banks &amp; tags</div>
      <p style="margin:0 0 12px">Each bank stores fader/roller assignments, a name, an icon and free-text tags. Names, icons and tags are saved both in this browser and on the device. Tag suggestions come from tags you have used before.</p>
      <div class="settings-subhead">Roller modes</div>
      <p style="margin:0 0 12px"><b>Articulation (CC)</b> — the roller steps through articulations (UACC). <b>Keyswitch</b> — the roller sends note keyswitches. <b>Navigation (keys)</b> — the roller sends a keyboard key per detent (e.g. arrows) to navigate your DAW. Navigation requires Keyboard (HID) enabled.</p>
      <div class="settings-subhead">Keyboard (HID)</div>
      <p style="margin:0 0 12px">Enable HID (in Device &amp; Settings) to let the device send keystrokes — required for the Navigation roller mode and the button long-press macro.</p>
      <div class="settings-subhead">Switching banks</div>
      <p style="margin:0">On the hardware, the button cycles through your banks. You can define up to 8 banks.</p>
    </div>
  </div>
```

- [ ] **Step 2: Přidat `toggleHelp()`**

Vedle `toggleDeviceSettings()` přidej:
```js
function toggleHelp(){
  const body    = document.getElementById('help-body');
  const chevron = document.getElementById('help-chevron');
  const btn     = document.getElementById('help-toggle-btn');
  const open    = body.style.display !== 'none';
  body.style.display  = open ? 'none' : 'block';
  chevron.textContent = open ? '▼' : '▲';
  btn && btn.classList.toggle('is-open', !open);
  btn && btn.blur && btn.blur();
}
```
Pokud se toggle funkce exportují na `window.` (grep `window.toggleDeviceSettings`), přidej i `window.toggleHelp = toggleHelp;`.

- [ ] **Step 3: Verifikace v prohlížeči**

Otevři appku. Pod „Device & Settings" je sekce „Help & Guide", rozbaluje/sbaluje se, obsahuje sekce Getting started / Banks & tags / Roller modes / Keyboard (HID) / Switching banks. „up to 8 banks" odpovídá MAX_BANKS.
Expected: funkční collapsible s obsahem.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "feat: add collapsible Help & Guide section"
```

---

### Task 7: Obousměrné hover propojení fader ↔ sekce (bod 9)

**Files:**
- Modify: `feel-fader.html` — live fader tracks `#track-l`/`#track-r` (~ř. 1034/1037), hover CSS, hover JS handlery + `data-fader` (section-head už má z Tasku 4)

**Interfaces:**
- Consumes: `#track-l`/`#track-r`, `.section-head[data-fader]` (z Tasku 4)
- Produces: třída `.fader-linked` na obou stranách při hoveru

- [ ] **Step 1: CSS pro zvýraznění + přidat data-fader na fader tracks**

Do `<style>` přidej:
```css
.section-head.fader-linked{position:relative;}
.bank-section.fader-linked{box-shadow:inset 0 0 0 2px var(--red);border-radius:var(--r);transition:box-shadow .15s;}
.fader-track.fader-linked{outline:2px solid var(--red);outline-offset:2px;border-radius:4px;}
```

Přidej `data-fader` na oba live fader tracky. Najdi:
```html
        <div class="fader-track" id="track-l" onmousedown="drag(event,'l')" ontouchstart="dragT(event,'l')">
```
Nahraď:
```html
        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)" onmousedown="drag(event,'l')" ontouchstart="dragT(event,'l')">
```
Najdi:
```html
        <div class="fader-track" id="track-r" onmousedown="drag(event,'r')" ontouchstart="dragT(event,'r')">
```
Nahraď:
```html
        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)" onmousedown="drag(event,'r')" ontouchstart="dragT(event,'r')">
```

- [ ] **Step 2: Přidat `data-fader` a hover handlery na config sekci**

`.section-head` už nese `data-fader` (Task 4). Ale zvýraznit chceme celou `.bank-section` kartu. V `renderPanels()` najdi:
```js
      <div class="bank-section">
        ${faderSectionContent('fader1', b.fader1, bi)}
      </div>
      <div class="bank-section-divider"></div>
      <div class="bank-section">
        ${faderSectionContent('fader2', b.fader2, bi)}
      </div>
```
Nahraď:
```js
      <div class="bank-section" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)">
        ${faderSectionContent('fader1', b.fader1, bi)}
      </div>
      <div class="bank-section-divider"></div>
      <div class="bank-section" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)">
        ${faderSectionContent('fader2', b.fader2, bi)}
      </div>
```

- [ ] **Step 3: Přidat `hoverFaderLink()`**

Vedle ostatních render/JS funkcí přidej:
```js
function hoverFaderLink(faderKey, on){
  const track   = document.querySelector(`.fader-track[data-fader="${faderKey}"]`);
  const section = document.querySelector(`.bank-section[data-fader="${faderKey}"]`);
  track   && track.classList.toggle('fader-linked', on);
  section && section.classList.toggle('fader-linked', on);
}
```
Pokud se funkce exportují na `window.` pattern, přidej `window.hoverFaderLink = hoverFaderLink;`.

- [ ] **Step 4: Verifikace v prohlížeči**

Otevři appku a připoj zařízení (nebo dočasně zobraz `#fader-tracks` odstraněním `display:none`, pak vrať). Najeď myší na levý fader → sekce LEFT FADER dostane červený rámeček; najeď na sekci LEFT FADER → levý fader dostane červený outline. Totéž pravý. Přepni banku a zopakuj — funguje i po `render()`.
Expected: obousměrné zvýraznění, přežije re-render.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "feat: bidirectional hover link between faders and sections"
```

---

### Task 8: Plynulé přechody theme + změna banky (bod 11)

**Files:**
- Modify: `feel-fader.html` — CSS transitions + `@keyframes`, `toggleDark()` (~ř. 2995), `.bank-card`/`bank-name-area` render

**Interfaces:**
- Consumes: `toggleDark()`, `.bank-card`
- Produces: dočasná třída `.theming` na `<html>` během přepnutí; fade-in animace `.bank-card`

- [ ] **Step 1: CSS — scoped theme cross-fade + bank fade-in**

Do `<style>` přidej:
```css
html.theming, html.theming body,
html.theming .panel, html.theming .bank-card, html.theming .bank-section,
html.theming input, html.theming .stepper, html.theming .step-btn,
html.theming .advanced-toggle-btn, html.theming .bank-block, html.theming header{
  transition:background-color .45s ease,color .45s ease,border-color .45s ease !important;
}
@keyframes bankIn{from{opacity:0}to{opacity:1}}
.bank-card{animation:bankIn .18s ease}
```

- [ ] **Step 2: Zapnout `.theming` třídu při přepnutí tématu**

Najdi:
```js
function toggleDark() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('ff-dark', isDark ? '1' : '0');
```
Nahraď:
```js
let _themingTimer = null;
function toggleDark() {
  const root = document.documentElement;
  root.classList.add('theming');
  clearTimeout(_themingTimer);
  _themingTimer = setTimeout(() => root.classList.remove('theming'), 500);
  const isDark = root.classList.toggle('dark');
  localStorage.setItem('ff-dark', isDark ? '1' : '0');
```
(Zbytek funkce ponech beze změny.)

- [ ] **Step 3: Verifikace v prohlížeči**

Otevři appku. Přepni light/dark → barvy plynule přecházejí ~0.45s, ne skokem. Přepni banku → karta jemně nafade-inne, žádné tvrdé bliknutí. Rychlé klikání mezi bankami nezpomaluje hover interakce (transition je aktivní jen během theme přepnutí).
Expected: hladké téma i změna banky, bez lagu na běžných interakcích.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "feat: smooth theme cross-fade and bank-switch fade-in"
```

---

## Self-Review

**Spec coverage:**
- Bod 1 (tagy z historie) → Task 3 ✅
- Bod 2 (L/R caption) → Task 4 ✅
- Bod 3 (macro align) → Task 5 (složeno do merge) ✅
- Bod 4 (MAX_BANKS=8) → Task 2 ✅
- Bod 5 (roll labels + INVERT) → Task 2 ✅
- Bod 6 (mode-aware status) → Task 1 ✅
- Bod 7 (renames) → Task 1 ✅
- Bod 8 (Help) → Task 6 ✅
- Bod 9 (hover link) → Task 7 ✅
- Bod 10 (merge panel) → Task 5 ✅
- Bod 11 (transitions) → Task 8 ✅

**Type/name consistency:**
- `data-fader="fader1"/"fader2"` použito konzistentně (Task 4 section-head, Task 7 bank-section + fader-track).
- `hoverFaderLink(faderKey,on)` definováno v Tasku 7, voláno tamtéž.
- `toggleDeviceSettings()` definováno v Tasku 5, markup v Tasku 5; `toggleHelp()` v Tasku 6.
- Task 4 přidává caption + `data-fader` na `.section-head`; Task 7 zvýrazňuje `.bank-section` (vnější wrapper) — obojí nese `data-fader`, selektory se nekryjí (`.bank-section` vs `.section-head`).
- Bod 3 (`.info-row-action`) žije v Tasku 5, kde ho markup rovnou používá — žádný přepis mezi tasky.

**Dependency order:** Task 4 před Task 7 (data-fader), Task 5 před Task 6 (Help pod Device & Settings). Pořadí v plánu to respektuje.

**Placeholder scan:** žádné TBD/TODO; každý krok má konkrétní kód a ruční verifikaci.
