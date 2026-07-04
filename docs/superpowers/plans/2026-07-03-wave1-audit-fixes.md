# Feel Fader Wave 1 — Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementovat Vlnu 1 z auditu `docs/feel-fader-product-audit-2026-07-03.md` — 15 nálezů (C2, F1, F2, S5, I5, H5, I7, V8, V9, V11, A7, S7a, C4, I4, S6) napříč app a firmware, bez protokolových změn kromě jednostranně kompatibilního ProgramChange (C2).

**Architecture:** Dva oddělené repy, každý vlastní feature branch. Firmware = 3 chirurgické zásahy (`code.py` ×2, `boot.py` ×1) + protokolová dokumentace. App = série malých úprav jednoho souboru `feel-fader.html` (CSS + JS + HTML), ověřovaných headless Chrome renderem. Žádná změna formátu configu ani serial rámců.

**Tech Stack:** CircuitPython (RP2040), vanilla JS single-file HTML, pytest (jen `ff_config.py`), puppeteer (verifikace renderu, instalovaný ve scratchpadu session).

## Global Constraints

- Repa `feel-fader-app` a `feel-fader-firmware` se NIKDY nemergují společně; commity vždy jen v příslušném repu.
- Drátový protokol: jediná změna = firmware nově POSÍLÁ MIDI Program Change při bank change (app handler už existuje, ř. 2445). Žádná změna `CMD_*` rámců, `enc7/dec7`, formátu configu.
- Každá změna dotýkající se protokolu → aktualizovat protokolovou tabulku v OBOU `CLAUDE.md`.
- Commit message konvence: `feat:` / `fix:` / `docs:` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Firmware pytest suite (`python -m pytest tests/ -q` v repo rootu) musí zůstat zelená po každém firmware tasku.
- App nemá test framework — verifikace = headless Chrome (puppeteer ve scratchpadu: `C:\Users\FANDAB~1\AppData\Local\Temp\claude\g--My-Drive-ACOUSTIC-EMPIRE\364b7dcc-a200-43ad-9d8a-d0e24fc599f6\scratchpad`), nulové console errors po loadu + skipu welcome.
- Deploy na fyzické zařízení (CIRCUITPY) se dělá až po dokončení všech firmware tasků, jedním krokem (Task 14) — pokud zařízení není připojené, krok se odloží a explicitně reportuje jako nehotový.
- Řádková čísla v tomto plánu platí pro stav před začátkem práce; po prvních editech se posunou — hledej podle uvedeného kódu, ne podle čísla.

---

### Task 1: Git branches (oba repy)

**Files:** žádné (git only)

- [ ] **Step 1: Vytvoř branch ve firmware repu**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && git checkout -b wave1-audit-fixes && git status --short
```
Expected: prázdný output (čistý strom), branch `wave1-audit-fixes`.

- [ ] **Step 2: Vytvoř branch v app repu**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git checkout -b wave1-audit-fixes && git status --short
```
Expected: untracked jen `docs/feel-fader-product-audit-2026-07-03.md`, `docs/feel-fader-product-audit-prompt-2026-07-03.md`, `docs/superpowers/plans/2026-07-03-wave1-audit-fixes.md`.

- [ ] **Step 3: Commitni audit dokumenty v app repu**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add docs/feel-fader-product-audit-2026-07-03.md docs/feel-fader-product-audit-prompt-2026-07-03.md docs/superpowers/plans/2026-07-03-wave1-audit-fixes.md && git commit -m "docs: product audit v2 (report + prompt) + wave 1 plan

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: C2 — firmware posílá Program Change při bank change

**Files:**
- Modify: `feel-fader-firmware/code.py` (import blok ř. 9–12; `on_bank_changed()` ř. 470–478)
- Modify: `feel-fader-firmware/CLAUDE.md` (protokolová tabulka)
- Modify: `feel-fader-app/CLAUDE.md` (zmínka protokolu)

**Interfaces:**
- Produces: MIDI `ProgramChange(bank_index)` na kanálu 0 při každém přepnutí banky tlačítkem. App handler `if(type===0xC0)` (feel-fader.html ř. 2445) ho už konzumuje — na app straně se nemění nic.

- [ ] **Step 1: Přidej import ProgramChange**

V `code.py` za řádek `from adafruit_midi.note_off import NoteOff`:

```python
from adafruit_midi.program_change import ProgramChange
```

- [ ] **Step 2: Odešli PC v on_bank_changed()**

`on_bank_changed()` — přidej odeslání PC jako PRVNÍ akci (před snapshoty, ať app přepne banku dřív, než dorazí CC nové banky):

```python
def on_bank_changed():
    # Ohlaš novou banku appce (Program Change na ch 0) — app handler 0xC0 přepne UI
    try:
        midi.send(ProgramChange(bank_index), channel=0)
    except Exception:
        pass
    apply_bank_to_controllers()
    if SEND_FADER_SNAPSHOT_ON_BANK_CHANGE:
        f_ch = current_fader_chs()
        fader1_obj.snapshot(midi, f_ch[0])
        fader2_obj.snapshot(midi, f_ch[1])
    if SEND_ENCODER_SNAPSHOT_ON_BANK_CHANGE and banks[bank_index].get("roller_mode", "cc") == "cc":
        encoder_snapshot()
    # Pozice enkodéru se per banku NEresetuje — zůstává zapamatovaná (snapshot i interní stav sedí)
```

- [ ] **Step 3: Syntax check + pytest**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && python -c "import ast; ast.parse(open('code.py', encoding='utf-8').read())" && python -m pytest tests/ -q
```
Expected: žádný SyntaxError, všechny testy PASS. (Pozn.: `adafruit_midi` musí být v `lib/` na CIRCUITPY — standardní bundle `program_change` obsahuje; ověří se při HW deployi v Task 14.)

- [ ] **Step 4: Zdokumentuj v obou CLAUDE.md**

`feel-fader-firmware/CLAUDE.md` — pod protokolovou tabulku (za řádek s CMD_ERR) přidej sekci:

```markdown
### Bank change notifikace (device → app)

Při přepnutí banky tlačítkem firmware odešle MIDI **Program Change** s číslem nové banky
(0-based) na kanálu 0. App handler (`onMidiMsg`, větev `type===0xC0`) na to přepne
`liveBank` + `activeBank` a překreslí UI. Jednostranně kompatibilní — starší app PC ignoruje.
```

`feel-fader-app/CLAUDE.md` — do seznamu funkcí v odrážce **App** doplň zmínku: za `handleSysEx` přidej `, PC handler (0xC0 → bank sync)`.

- [ ] **Step 5: Commit (firmware) + commit (app CLAUDE.md)**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && git add code.py CLAUDE.md && git commit -m "feat: send Program Change on bank switch (audit C2)

App PC handler (0xC0) existoval a čekal marně — liveBank/activeBank se teď
synchronizují při přepnutí banky tlačítkem na zařízení.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add CLAUDE.md && git commit -m "docs: protocol note — device sends Program Change on bank switch (C2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: F1 — long-press bez makra nespolkne bank switch

**Files:**
- Modify: `feel-fader-firmware/code.py` (button state machine, ř. 614–624)

**Interfaces:**
- Produces: dlouhý stisk bez nakonfigurovaného makra (nebo s vypnutým HID) degraduje na bank switch při release — tlačítko vždy něco udělá.

- [ ] **Step 1: Podmiň `button_long_fired` existencí makra**

Nahraď blok:

```python
    elif (state is False) and (not button_long_fired) and ((now_ms - button_pressed_at) >= BUTTON_LONGPRESS_MS):
        # drženo přes práh → odpal makro jednou
        button_long_fired = True
        if hid_enabled and _kbd is not None and button_macro:
            try:
                _kbd.send(*button_macro)
            except Exception:
                try:
                    _kbd.release_all()
                except Exception:
                    pass
```

za:

```python
    elif (state is False) and (not button_long_fired) and ((now_ms - button_pressed_at) >= BUTTON_LONGPRESS_MS):
        # drženo přes práh → odpal makro jednou; bez makra dlouhý stisk
        # degraduje na short-press (bank switch při release) — audit F1
        if hid_enabled and _kbd is not None and button_macro:
            button_long_fired = True
            try:
                _kbd.send(*button_macro)
            except Exception:
                try:
                    _kbd.release_all()
                except Exception:
                    pass
```

- [ ] **Step 2: Syntax check + pytest**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && python -c "import ast; ast.parse(open('code.py', encoding='utf-8').read())" && python -m pytest tests/ -q
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && git add code.py && git commit -m "fix: long-press without macro falls back to bank switch (audit F1)

button_long_fired se nastavuje jen když makro reálně odchází — dlouhý stisk
bez makra/HID už není mrtvá zóna.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: F2 — PROD mód skryje CIRCUITPY disk

**Files:**
- Modify: `feel-fader-firmware/boot.py:60-66`
- Modify: `feel-fader-firmware/CLAUDE.md` (sekce Deployment — už dnes říká „disk není viditelný → PROD", zůstává pravdivá; jen ověřit)

**Interfaces:**
- Produces: PROD boot = žádný USB disk, filesystem zapisovatelný jen firmwarem (`save_presets()` funguje). DEV boot beze změny.

**Rozhodnutí (z auditu, potvrzeno spuštěním Vlny 1):** PROD = disk skrytý (`disable_usb_drive`). NVM je primární persistence, soubor `presets.json` je bonus. Řeší i riziko FAT korupce z `disable_concurrent_write_protection=True`.

- [ ] **Step 1: Uprav boot.py**

Nahraď:

```python
if dev_mode:
    storage.enable_usb_drive()
    print("BOOT: DEV mode (button held) — USB drive enabled, save_presets() inactive")
else:
    storage.enable_usb_drive()
    storage.remount("/", readonly=False, disable_concurrent_write_protection=True)
    print("BOOT: PROD mode — USB drive read-only from PC, save_presets() active")
```

za:

```python
if dev_mode:
    storage.enable_usb_drive()
    print("BOOT: DEV mode (button held) — USB drive enabled, save_presets() inactive")
else:
    # PROD: disk skrytý (audit F2) — žádný souběžný zápis PC↔firmware,
    # filesystem patří firmwaru (save_presets() aktivní)
    storage.disable_usb_drive()
    storage.remount("/", readonly=False)
    print("BOOT: PROD mode — USB drive hidden, save_presets() active")
```

- [ ] **Step 2: Syntax check**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && python -c "import ast; ast.parse(open('boot.py', encoding='utf-8').read())"
```
Expected: bez chyby.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && git add boot.py && git commit -m "fix: PROD mode hides USB drive, firmware-only filesystem writes (audit F2)

disable_usb_drive misto enable+disable_concurrent_write_protection — konec
rizika FAT korupce a viditelneho disku u koncoveho uzivatele. Chovani nove
odpovida dokumentaci (CLAUDE.md, Settings modal byl smazan v app Wave 1).
VYZADUJE HW TEST: remount bez usb drive na aktualnim CircuitPythonu (Task 14).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: S5 — autosave do localStorage + beforeunload

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `cfgSave()` okolí (ř. 1401), `render()` (ř. 1432), `renderBankTabs()` volání není třeba (rename volá `renderBankTabs()` → přidáme autosave i tam), `ksLiveRefresh()` (ř. 2175), `window` listenery (konec `<script>`)

**Interfaces:**
- Produces: `cfgAutosave()` — debounced (400 ms) zápis `cfg` do localStorage. `dirty` nadále znamená „liší se od zařízení", ne „liší se od disku".

- [ ] **Step 1: Přidej debounced autosave za cfgSave()**

Za funkci `cfgSave()` (ř. 1401–1403) vlož:

```js
let _autosaveT = null;
function cfgAutosave() {   // audit S5 — edits přežijí refresh; dirty dál = „liší se od zařízení"
  clearTimeout(_autosaveT);
  _autosaveT = setTimeout(cfgSave, 400);
}
```

- [ ] **Step 2: Volej autosave z render(), renderBankTabs() a ksLiveRefresh()**

V `render()` přidej `cfgAutosave();` jako první řádek těla. V `renderBankTabs()` (ř. 1445) přidej `cfgAutosave();` jako první řádek těla (pokrývá `onBankRename`, který volá jen `renderBankTabs`). V `ksLiveRefresh()` přidej `cfgAutosave();` jako první řádek těla (pokrývá živý drag keyswitch handle).

- [ ] **Step 3: beforeunload guard při dirty**

Na konec `<script>` (k ostatním `window.addEventListener`, resp. za `window.stepBanks` exporty) přidej:

```js
window.addEventListener('beforeunload', e => {   // audit S5 — druhá síť
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
```

- [ ] **Step 4: Ověř renderem (autosave po editaci)**

Ve scratchpadu spusť:

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  await p.evaluate(() => onBankRename(0, 'AUTOSAVE-TEST'));
  await new Promise(r => setTimeout(r, 700));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ff-cfg')).banks[0].name);
  console.log('saved name:', saved, '| pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();"
```
(`$SCRATCHPAD` = scratchpad adresář session s nainstalovaným puppeteerem.)
Expected: `saved name: AUTOSAVE-TEST | pageerrors: none`

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: debounced autosave to localStorage + beforeunload guard (audit S5)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: I5 + H5 — falešné dirty z fader dragu, mrtvý midi-text

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `mF()` (ř. 2313–2320), SysEx error větev (ř. 2548)

- [ ] **Step 1: Odstraň dirty z mF()**

V `mF()` nahraď poslední řádek těla:

```js
  dirty=true; if(jsonOpen)refreshJson();
```

za:

```js
  if(jsonOpen)refreshJson();   // drag = jen vizualizace, nemění config (audit I5)
```

- [ ] **Step 2: Oprav midi-text TypeError (H5)**

Řádek

```js
      setBanner('connected', document.getElementById('midi-text').textContent.replace(t('midi.loading'),''));
```

nahraď za:

```js
      setBanner('connected', '');
```

(`setBanner('connected', …)` parametr `m` stejně nepoužívá; `#midi-text` neexistuje → latentní TypeError.)

- [ ] **Step 3: Ověř renderem**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  const d = await p.evaluate(() => { mF('l', 300); return dirty; });
  console.log('dirty after drag:', d, '| pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();"
```
Expected: `dirty after drag: false | pageerrors: none`

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: fader thumb drag no longer sets dirty; remove dead midi-text ref (audit I5, H5)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: I7 + V8 + V9 — textové opravy

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `setRollerMode()` (ř. 1904), `startMacroCapture()` (ř. 1921), roller-mode-btn `title` (ř. 1759), `ksLiveRefresh()` (ř. 2184), `validate()` (ř. 2246, 2248)

- [ ] **Step 1: Stale názvy (I7) — 3 místa**

1. `setRollerMode`: `'Track-nav requires HID enabled (Device Info → Keyboard)'` → `'Navigation requires Keyboard (HID) — enable it in Device & Settings'`
2. `startMacroCapture`: `'Macro requires HID enabled (Device Info → Keyboard)'` → `'Macro requires Keyboard (HID) — enable it in Device & Settings'`
3. `encoderPanel` title atribut: `title="Requires HID enabled (Device Info → Keyboard)"` → `title="Requires Keyboard (HID) — enable it in Device & Settings"`

- [ ] **Step 2: „12 not" (V8)**

V `ksLiveRefresh()`: `el.textContent = '= ' + n.length + ' not'` → `el.textContent = '= ' + n.length + ' notes'`

- [ ] **Step 3: „Bank Bank 1" (V9) — 2 místa ve validate()**

```js
        errs.push({ field:`b${i}.uacc`, msg:`Bank ${b.name||i+1}: keyswitch mode needs at least one note` });
```
→
```js
        errs.push({ field:`b${i}.uacc`, msg:`${b.name || 'Bank ' + (i+1)}: keyswitch mode needs at least one note` });
```
a
```js
        errs.push({ field:`b${i}.uacc`, msg:`Bank ${b.name||i+1}: note out of 0–127` });
```
→
```js
        errs.push({ field:`b${i}.uacc`, msg:`${b.name || 'Bank ' + (i+1)}: note out of 0–127` });
```

- [ ] **Step 4: Ověř grep-em (žádný výskyt starých řetězců)**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && grep -cE "Device Info" feel-fader.html; grep -cE "not'" feel-fader.html; grep -cF 'Bank ${b.name' feel-fader.html
```
Expected: třikrát `0` (pozn.: `not'` nematchuje `notes'` — apostrof ukončuje).

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: stale panel names in toasts/tooltips, 'not'->'notes', 'Bank Bank N' (audit I7, V8, V9)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: V11 + A7 — CSS: subhead kontrast, touch targety nových komponent

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `.settings-subhead` (ř. 432), `@media(pointer:coarse)` blok (ř. 548–555)

- [ ] **Step 1: Subhead na --t2 (V11)**

```css
.settings-subhead{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin:0 0 8px;}
```
→
```css
.settings-subhead{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2);margin:0 0 8px;}
```

- [ ] **Step 2: Doplň nové komponenty do pointer:coarse (A7)**

Do bloku `@media(pointer:coarse){…}` přidej před uzavírací `}`:

```css
  .ks-handle{width:44px;height:44px;margin-left:-22px;top:-7px}
  .roller-mode-btn{min-height:44px}
  [id^=navcap-],#macro-capture{min-height:44px}
```

(`top:-7px` drží 44px handle opticky centrovaný na 14px tracku: `8 + 7 − 22 = −7`.)

- [ ] **Step 3: Ověř renderem s emulací touch**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  await p.emulate({ viewport: { width: 390, height: 844, hasTouch: true, isMobile: true }, userAgent: 'Mozilla/5.0 (iPhone)' });
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => { skipWelcome(); setRollerMode(0, 'keyswitch'); });
  const h = await p.evaluate(() => { const el = document.querySelector('.ks-handle'); return el ? el.getBoundingClientRect().height : 'missing'; });
  console.log('ks-handle height (touch):', h);
  await b.close();
})();"
```
Expected: `ks-handle height (touch): 44`

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: settings-subhead AA contrast, 44px touch targets for ks-handle/capture buttons (audit V11, A7)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: S7a — nerenderovat prázdnou badge pilulku

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `encoderPanel()` (ř. 1745–1752)

- [ ] **Step 1: Podmíněný span**

V `encoderPanel()` nahraď řádek:

```js
      <span class="section-live-val" id="enc-artic-badge">${badge}</span>
```

za:

```js
      ${badge ? `<span class="section-live-val" id="enc-artic-badge">${badge}</span>` : ''}
```

(Živý update `setTxt('enc-artic-badge', …)` v `onMidiMsg` je už gated na `roller_mode==='cc'` (ř. 2438) a `setTxt` na chybějící element nespadne — v keyswitch/nav módu se badge prostě nevykreslí.)

- [ ] **Step 2: Ověř renderem**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  const cc = await p.evaluate(() => !!document.getElementById('enc-artic-badge'));
  await p.evaluate(() => setRollerMode(0, 'keyswitch'));
  const ks = await p.evaluate(() => !!document.getElementById('enc-artic-badge'));
  console.log('badge in cc mode:', cc, '| badge in keyswitch mode:', ks);
  await b.close();
})();"
```
Expected: `badge in cc mode: true | badge in keyswitch mode: false`

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: hide empty Roller badge pill outside CC mode (audit S7a)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: C4 — selhání tichého auto-loadu už není němé

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `onDeviceConnected()` (ř. 2772–2778)

- [ ] **Step 1: Nahraď prázdný catch**

```js
  if (granted) {
    // Returning user / in-app reconnect: load silently (skip if unsaved edits), no gesture needed.
    if (!dirty) {
      try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); } catch(e) {}
    }
    if (onWelcome) hideWelcome();               // auto-transition into main page
    return;
  }
```
→
```js
  if (granted) {
    // Returning user / in-app reconnect: load silently (skip if unsaved edits), no gesture needed.
    if (!dirty) {
      try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
      catch(e) {   // audit C4 — desync musí být vidět; header zůstává v „searching"
        toast('e', "Couldn't sync with device — showing local config");
        setBanner('searching', '');
      }
    }
    if (onWelcome) hideWelcome();               // auto-transition into main page
    return;
  }
```

- [ ] **Step 2: Ověř smoke renderem (bez HW jen no-regression)**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  console.log('pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();"
```
Expected: `pageerrors: none`. (Reálná cesta selhání = HW test v Task 14: připojit zařízení, vytáhnout uprostřed loadu.)

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: surface silent auto-load failure as toast + searching state (audit C4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: I4 — key-capture: zrušitelný, navržený stav

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — CSS (za `.step-btn.active`, ř. 197), `startKeyCapture()`/`startMacroCapture()`/keydown listener (ř. 1913–1947)

**Chování (z auditu):** Esc = zrušit (vrátit původní label) · klik mimo / blur okna = zrušit · nenamapovaná klávesa = hint „unsupported key", capture pokračuje · capture stav má vizuální třídu. Přiřazení Escape jako HID hodnoty se vzdáváme (Esc je exit — konzistentní s celým OS).

- [ ] **Step 1: CSS třída capturing**

Za řádek `.step-btn.active{background:var(--red);color:#fff;}` přidej:

```css
.step-btn.capturing{border-color:var(--red)!important;color:var(--red);animation:cap-pulse 1.2s ease-in-out infinite}
@keyframes cap-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,.35)}50%{box-shadow:0 0 0 4px rgba(255,59,48,0)}}
```

- [ ] **Step 2: Refactor capture start/cancel**

Nahraď blok `let _keyCapture = null;` … až po konec `window.addEventListener('keydown', …)` (ř. 1914–1947) za:

```js
let _keyCapture = null;   // { bi, which } | { macro:true }
function _captureEl(){
  if (!_keyCapture) return null;
  return document.getElementById(_keyCapture.macro ? 'macro-capture' : `navcap-${_keyCapture.bi}-${_keyCapture.which}`);
}
function _captureBegin(target){
  _keyCapture = target;
  const el = _captureEl();
  if (el) { el.textContent = 'press a key…'; el.classList.add('capturing'); }
}
function cancelKeyCapture(){   // Esc / klik mimo / blur (audit I4)
  if (!_keyCapture) return;
  _keyCapture = null;
  render();   // vrátí původní label z cfg
}
function startKeyCapture(bi, which){ _captureBegin({ bi, which }); }
function startMacroCapture(){
  if (!DEVICE_INFO.hid_enabled) { toast('i','Macro requires Keyboard (HID) — enable it in Device & Settings'); return; }
  _captureBegin({ macro: true });
}
window.addEventListener('keydown', e => {
  if (!_keyCapture) return;
  e.preventDefault();
  if (e.code === 'Escape') { cancelKeyCapture(); return; }   // Esc = zrušit, ne přiřadit
  const main = HID_CODES[e.code];
  if (main === undefined) {   // nenamapovaná klávesa → hint, capture běží dál
    const el = _captureEl();
    if (el) { el.textContent = 'unsupported key — try another'; setTimeout(() => { if (_keyCapture && el.isConnected) el.textContent = 'press a key…'; }, 900); }
    return;
  }
  const mods = [];
  if (e.ctrlKey)  mods.push(0xE0);
  if (e.shiftKey) mods.push(0xE1);
  if (e.altKey)   mods.push(0xE2);
  if (e.metaKey)  mods.push(0xE3);
  // if the user pressed only a modifier, wait for the main key
  if (main >= 0xE0 && main <= 0xE3) return;
  const keys = [...mods, main];
  if (_keyCapture.macro) {
    cfg.macro_keys = keys;
  } else {
    const { bi, which } = _keyCapture;
    cfg.banks[bi][which === 'cw' ? 'nav_keys_cw' : 'nav_keys_ccw'] = keys;
  }
  _keyCapture = null;
  dirty = true; render();
});
window.addEventListener('pointerdown', e => {   // klik mimo capture tlačítko = zrušit
  if (_keyCapture && e.target !== _captureEl()) cancelKeyCapture();
});
window.addEventListener('blur', () => cancelKeyCapture());
```

Pozn.: `HID_CODES` obsahuje `Escape:0x29` — mapu NEměníme (import/starší configy s 0x29 zůstávají validní), jen capture Esc interpretuje jako zrušení.

- [ ] **Step 3: Ověř renderem (Esc ruší, unsupported hintuje)**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => { skipWelcome(); DEVICE_INFO.hid_enabled = true; render(); setRollerMode(0, 'track_nav'); });
  await p.evaluate(() => startKeyCapture(0, 'cw'));
  await p.keyboard.press('Escape');
  const afterEsc = await p.evaluate(() => ({ cap: _keyCapture, keys: cfg.banks[0].nav_keys_cw || [0x52] }));
  await p.evaluate(() => startKeyCapture(0, 'cw'));
  await p.keyboard.press('MediaTrackNext').catch(() => {});
  const hint = await p.evaluate(() => document.getElementById('navcap-0-cw').textContent);
  console.log('after Esc:', JSON.stringify(afterEsc), '| hint state:', JSON.stringify(hint));
  await b.close();
})();"
```
Expected: `after Esc: {"cap":null,"keys":[82]}` (0x52=82, žádné přiřazení Escape) a hint state je `"press a key…"` nebo `"unsupported key — try another"`.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "feat: cancellable key capture — Esc/blur/click-outside, unsupported-key hint, capturing style (audit I4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: S6 — smazat osiřelý Settings modal, korektní DEV/PROD do Helpu

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — modal HTML (ř. 1213–1240), `stepBanks()`/`onBankCount()` (ř. 2069–2082), `openModal()`/`closeModal()` (ř. 2880–2881), window exporty (ř. 3358, 3363–3364), STRINGS `modal.*` (ř. 2971–2979, 3021–3022), Help & Guide sekce (ř. ~1161–1180)

- [ ] **Step 1: Smaž modal HTML**

Smaž celý blok od `<!-- SETTINGS MODAL -->` po uzavírací `</div>` modalu (ř. 1212–1240 včetně komentáře).

- [ ] **Step 2: Smaž mrtvé JS**

- funkce `stepBanks(delta)` a `onBankCount(val)` (ř. 2069–2082) — volali je jen modal; počet bank řeší `+`/`✕` v tabech,
- funkce `openModal()` a `closeModal()` (ř. 2880–2881),
- exporty `window.openModal = openModal;`, `window.stepBanks = stepBanks;`, `window.onBankCount = onBankCount;` (ř. 3358, 3363–3364).

- [ ] **Step 3: Smaž STRINGS klíče `modal.*`**

Smaž řádky s klíči `modal.title`, `modal.banks`, `modal.mode`, `modal.dev_mode`, `modal.prod_mode`, `modal.switch_mode`, `modal.recovery`, `modal.recovery_desc`, `modal.close`, `modal.banks.title`, `modal.banks.desc` (ř. 2971–2979, 3021–3022).

- [ ] **Step 4: Korektní DEV/PROD odstavec do Help & Guide**

Do Help & Guide (collapsible sekce, obsahové `<p>`/`<div>` bloky okolo ř. 1161–1180 — najdi nadpis „Keyboard (HID)" a vlož ZA jeho odstavec) přidej:

```html
      <div class="settings-subhead" style="margin-top:12px">Service: DEV mode</div>
      <p class="uacc-note">Hold the bank button while plugging in USB to boot in DEV mode — the FEELFADER
      drive becomes visible for firmware updates. Unplug and reconnect normally to return to regular use.
      Recovery: hold BOOTSEL while plugging USB → RPI-RP2 drive appears.</p>
```

- [ ] **Step 5: Ověř renderem**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  const modal = await p.evaluate(() => !!document.getElementById('modal'));
  const helpHasDev = await p.evaluate(() => document.body.innerHTML.includes('Hold the bank button while plugging in USB'));
  console.log('modal exists:', modal, '| help has DEV info:', helpHasDev, '| pageerrors:', errs.length ? errs : 'none');
  await b.close();
})();"
```
Expected: `modal exists: false | help has DEV info: true | pageerrors: none`

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "fix: remove orphaned Settings modal with stale instructions; correct DEV-mode steps in Help (audit S6)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Závěrečná verifikace app (full render pass)

**Files:** žádné (verifikace)

- [ ] **Step 1: Full smoke — všechny hlavní stavy bez console errors**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  await p.evaluate(() => { setRollerMode(0, 'keyswitch'); });
  await p.evaluate(() => { DEVICE_INFO.hid_enabled = true; render(); setRollerMode(0, 'track_nav'); });
  await p.evaluate(() => { setRollerMode(0, 'cc'); toggleDark(); render(); toggleDark(); });
  await p.evaluate(() => { addBank(); removeBank(cfg.banks.length - 1); });
  console.log('pageerrors after full pass:', errs.length ? errs : 'none');
  await b.close();
})();"
```
Expected: `pageerrors after full pass: none`

- [ ] **Step 2: Screenshot pro vizuální kontrolu (light + dark)**

```bash
cd "$SCRATCHPAD" && node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch(); const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto('file:///C:/Users/Fanda%20Borec/Documents/feel-fader-app/feel-fader.html');
  await p.evaluate(() => skipWelcome());
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: 'shots/wave1-light.png', fullPage: true });
  await p.evaluate(() => toggleDark());
  await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: 'shots/wave1-dark.png', fullPage: true });
  console.log('screenshots saved');
  await b.close();
})();"
```
Prohlédni oba screenshoty (Read tool) — žádný rozbitý layout, subheady čitelné, žádná prázdná pilulka u Roller.

- [ ] **Step 3: Firmware pytest naposledy**

```bash
cd "/c/Users/Fanda Borec/Documents/feel-fader-firmware" && python -m pytest tests/ -q
```
Expected: PASS.

---

### Task 14: HW deploy + integrační test (vyžaduje připojené zařízení)

**Files:** žádné (deploy `code.py` + `boot.py` na CIRCUITPY dle firmware CLAUDE.md)

**Pokud zařízení není připojené: krok PŘESKOČ a explicitně reportuj jako nehotový — nevymýšlej si výsledky.**

- [ ] **Step 1: Najdi CIRCUITPY disk** — `wmic logicaldisk get DeviceID,VolumeName`, hledej CIRCUITPY. Není-li vidět → zařízení odpojené nebo PROD mód (drž tlačítko při připojení USB pro DEV).
- [ ] **Step 2: Zkopíruj `code.py` a `boot.py`** na CIRCUITPY, počkej ~3 s na restart. `boot.py` se projeví až po plném power-cycle (odpojit/připojit USB).
- [ ] **Step 3: Ověř C2** — otevři appku, připoj zařízení, stiskni tlačítko banky → v appce se přepne aktivní tab. (PC handler 0xC0.)
- [ ] **Step 4: Ověř F1** — podrž tlačítko ~1 s bez nakonfigurovaného makra → po puštění se přepne banka (dřív: nic).
- [ ] **Step 5: Ověř F2** — normální power-cycle (bez drženého tlačítka) → CIRCUITPY disk se NEobjeví; MIDI + serial port fungují; send configu z appky projde a přežije restart (`save_presets()`). DEV boot (držené tlačítko) → disk viditelný.
- [x] **Step 6: Ověř C4** — ověřeno 2026-07-04 variantou „port drží jiná aplikace" (rejectne tentýž await jako USB unplug): toast „Couldn't sync with device — showing local config" + header pulse (searching), ne zeleně. Detail v auditu, sekce Status.

---

### Task 15: Merge + wrap-up

- [ ] **Step 1: Review diff obou rep** (`git diff main...wave1-audit-fixes --stat`), projdi finálně.
- [ ] **Step 2: Merge do main v obou repech** (fast-forward/`--no-ff` dle konvence repa; firmware historie používá merge commity pro větší celky — zde stačí prostý merge).
- [ ] **Step 3: Aktualizuj audit report** — do `docs/feel-fader-product-audit-2026-07-03.md` přidej pod hlavičku status blok (vzor z auditu 2026-06-27): `## Status: Vlna 1 implementována YYYY-MM-DD` + seznam ID + poznámka o odloženém HW testu, pokud Task 14 neproběhl.
- [ ] **Step 4: Připomeň Frankovi demo deploy** — po nové verzi app se vždy proaktivně nabízí GitHub Pages snapshot (memory `reference_feelfader_demo_deploy`). Push na GitHub jen po Frankově potvrzení.
