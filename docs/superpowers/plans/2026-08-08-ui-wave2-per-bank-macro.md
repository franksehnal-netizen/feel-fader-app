# UI vlna 2 — BUTTON makro per banka + Global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-press makro tlačítka může mít vlastní hodnotu pro každou banku; checkbox `Global` ho sjednotí napříč všemi bankami.

**Architecture:** Config schéma dostane per-bank `macro_keys` a top-level `macro_global`. Chybějící `macro_global` znamená `true`, takže starý config i starý firmware fungují beze změny. Výběr aktivního makra je čistá funkce v `ff_config.py`, aby byla host-testovatelná bez hardwaru. Webová appka a firmware se mění společně, protože sdílejí wire protokol.

**Tech Stack:** CircuitPython 10 na RP2350 (`code.py`, `ff_config.py`), pytest s hardware fakes na hostu; vanilla JS v single-file `feel-fader.html`; přenos přes Web Serial (`CMD_R` / `CMD_W` / `CMD_INFO`).

**Spec:** `docs/superpowers/specs/2026-08-08-ui-backlog-design.md`, sekce D.

**Prerekvizita:** Vlna 1 (`2026-08-08-ui-wave1-sections-and-signals.md`) je dokončená a zelená. Tento plán staví na `isSectionOpen()` / `toggleSection()` z Tasku A té vlny.

## Global Constraints

- **Dvě oddělená repa, dva oddělené commity.** `feel-fader-app` (`c:\Users\Fanda Borec\Documents\feel-fader-app`) a `feel-fader-firmware` (`c:\Users\Fanda Borec\Documents\feel-fader-firmware`) se nikdy nemergují dohromady a nemají lockstep. Jediná vazba je wire protokol.
- **Veškeré změny appky jdou výhradně do `feel-fader.html`.** `app.js`, `styles.css` a `assets/` v pracovní kopii jsou zastaralé necommitnuté zbytky Codexova refaktoru — neupravovat, necommitovat, nemazat.
- **Odkazy typu `app.js:171` jsou navigační pomůcka**; identický text žije v inline `<script>` bloku `feel-fader.html`.
- **Nikdy `git add -A` ani `git add .`** v `feel-fader-app` — pracovní strom obsahuje nesouvisející necommitnuté změny. Vždy konkrétní cesty.
- **Branch v `feel-fader-app`:** `per-bank-macro-2026-08` (odbočená z `main` po mergi vlny 1). **Branch v `feel-fader-firmware`:** `per-bank-macro-2026-08`, vytvořená z `main` v Tasku 1, Step 0.
- **Zpětná kompatibilita je tvrdý požadavek:** config bez `macro_global` = `true` (dosavadní globální chování); bank bez `macro_keys` = prázdný seznam.
- **Prázdný per-bank seznam znamená „žádná akce", ne fallback na globální makro.** Jinak by nešlo makro pro jednu banku vypnout.
- **`serialize_state()` je jediná kanonická serializace** — používá ji save, `CMD_R` i hash. Její výstup určuje `config_hash`, takže každá změna tvaru se projeví jako jednorázový sync banner „differs" v appce. To je očekávané.
- **Nikdy neposílat SysEx přes MIDI out** — na Windows to zasekne MIDI endpoint a vyžaduje replug (HW nález 2026-07-07). Config jde výhradně přes Web Serial.
- **MCP nikdy nesahá na reálný HW.** Automatizované ověřování běží přes interní-stav-poke jako probes; reálný HW test dělá Frank ručně.
- **Nezapisovat na zařízení bez Frankova pokynu.** Flashování firmwaru a HW test jsou jeho kroky (Task 6).

## Vědomé omezení

**Library setups (uložené sety) nenesou makro.** Ukládání/načítání setupu pracuje s `preset.roller.*`
(`nav_keys_cw`, `nav_keys_ccw`, …) a top-level `macro_keys` do setupu nikdy nepatřilo. Tato vlna to
nemění: načtení setupu nechá makro (globální i per-bank) beze změny. Není to regrese — dnes se
makro do setupu neukládá také — ale je to vědomé rozhodnutí, ne opomenutí. Když to Frank bude chtít,
je to samostatný úkol do backlogu.

---

### Task 1: Firmware — schéma per-bank `macro_keys` a `macro_global`

**Files:**
- Modify: `ff_config.py` — `_normalize_bank_core()`, `_bank_defaults()`, `parse_banks()`, `normalize_web_config()`, `serialize_state()`, `build_info_dict()`
- Test: `tests/test_macro.py`

**Interfaces:**
- Consumes: `parse_macro_keys(raw) -> list[int]` (existuje), `_clamp`, `_json`
- Produces:
  - Interní bank dict má nově klíč `"macro_keys": list[int]`
  - `parse_banks(data) -> {"banks": list, "macro_keys": list[int], "macro_global": bool}`
  - `serialize_state(banks, macro_keys, macro_global=True) -> str`
  - `active_macro_keys(macro_global, macro_keys, bank) -> list[int]`
  - `build_info_dict(..., schema_version=3, ...)`

- [ ] **Step 0: Vytvořit branch**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware"
git checkout -b per-bank-macro-2026-08
```

- [ ] **Step 1: Ověřit zelenou baseline**

Run: `python -m pytest -q`
Expected: všechny testy projdou. Když ne, zastav se a nahlas to.

- [ ] **Step 2: Napsat padající testy**

Do `tests/test_macro.py` přidej na konec:

```python
def test_parse_banks_per_bank_macro_keys():
    out = ff_config.parse_banks({"banks": [{"macro_keys": [0xE0, 0x16]}, {}]})
    assert out["banks"][0]["macro_keys"] == [0xE0, 0x16]
    assert out["banks"][1]["macro_keys"] == []


def test_parse_banks_macro_global_defaults_true():
    # Starý config bez macro_global = dosavadní globální chování.
    out = ff_config.parse_banks({"banks": [{}], "macro_keys": [0xE0]})
    assert out["macro_global"] is True


def test_parse_banks_macro_global_false_is_honoured():
    out = ff_config.parse_banks({"banks": [{}], "macro_global": False})
    assert out["macro_global"] is False


def test_normalize_web_config_reads_per_bank_macro_keys():
    banks = ff_config.normalize_web_config({"banks": [{"macro_keys": [0x2C, 999]}]})
    assert banks[0]["macro_keys"] == [0x2C]   # 999 je mimo 0..255


def test_active_macro_keys_global_wins():
    bank = {"macro_keys": [0x2C]}
    assert ff_config.active_macro_keys(True, [0xE0, 0x16], bank) == [0xE0, 0x16]


def test_active_macro_keys_per_bank_when_not_global():
    bank = {"macro_keys": [0x2C]}
    assert ff_config.active_macro_keys(False, [0xE0, 0x16], bank) == [0x2C]


def test_active_macro_keys_empty_per_bank_is_no_action():
    # Prázdný per-bank seznam NENÍ fallback na globální — jinak by nešlo
    # makro pro jednu banku vypnout.
    assert ff_config.active_macro_keys(False, [0xE0], {"macro_keys": []}) == []
    assert ff_config.active_macro_keys(False, [0xE0], {}) == []


def test_serialize_state_omits_empty_per_bank_macro():
    banks = ff_config.parse_banks({"banks": [{}]})["banks"]
    assert "macro_keys" not in ff_config.serialize_state(banks, [], True)


def test_serialize_state_includes_macro_global_only_when_false():
    banks = ff_config.parse_banks({"banks": [{}]})["banks"]
    assert "macro_global" not in ff_config.serialize_state(banks, [], True)
    assert '"macro_global":false' in ff_config.serialize_state(banks, [], False)


def test_serialize_state_roundtrips_per_bank_macro():
    import json
    banks = ff_config.parse_banks({"banks": [{"macro_keys": [0x2C]}, {}]})["banks"]
    data = json.loads(ff_config.serialize_state(banks, [], False))
    assert data["banks"][0]["macro_keys"] == [0x2C]
    assert "macro_keys" not in data["banks"][1]
    assert data["macro_global"] is False


def test_info_dict_reports_schema_version_3():
    info = ff_config.build_info_dict("1.0", "FEEL FADER", "abc")
    assert info["schema_version"] == 3
```

- [ ] **Step 3: Spustit testy a ověřit, že padají**

Run: `python -m pytest tests/test_macro.py -q`
Expected: FAIL — `KeyError: 'macro_keys'`, `KeyError: 'macro_global'` a `AttributeError: module 'ff_config' has no attribute 'active_macro_keys'`.

- [ ] **Step 4: Přidat `macro_keys` do interního bank dictu**

V `ff_config.py`, ve funkci `_normalize_bank_core()`, najdi:

```python
        "nav_keys_cw":  nav_cw,
        "nav_keys_ccw": nav_ccw,
        "nav_invert":   nav_invert,
    }
```

a nahraď za:

```python
        "nav_keys_cw":  nav_cw,
        "nav_keys_ccw": nav_ccw,
        "nav_invert":   nav_invert,
        "macro_keys":   parse_macro_keys(raw.get("macro_keys")),
    }
```

Klíč `macro_keys` má v obou vstupních formátech (NVM/JSON i web) stejné jméno, takže ho lze číst z `raw` jako `uacc_values` a `nav_keys_*`.

- [ ] **Step 5: Doplnit default, aby se prázdné makro neserializovalo**

Ve funkci `_bank_defaults()` najdi:

```python
        "nav_keys_cw": [NAV_DEFAULT_CW], "nav_keys_ccw": [NAV_DEFAULT_CCW],
        "nav_invert": False,
    }
```

a nahraď za:

```python
        "nav_keys_cw": [NAV_DEFAULT_CW], "nav_keys_ccw": [NAV_DEFAULT_CCW],
        "nav_invert": False,
        "macro_keys": [],
    }
```

- [ ] **Step 6: Vrátit `macro_global` z `parse_banks()`**

Najdi:

```python
    return {"banks": banks, "macro_keys": parse_macro_keys(data.get("macro_keys"))}
```

a nahraď za:

```python
    return {
        "banks": banks,
        "macro_keys": parse_macro_keys(data.get("macro_keys")),
        # Chybějící macro_global = True: starý config měl jen globální makro.
        "macro_global": bool(data.get("macro_global", True)),
    }
```

- [ ] **Step 7: Přidat výběrovou funkci**

Hned za funkci `parse_macro_keys()` vlož:

```python
def active_macro_keys(macro_global, macro_keys, bank):
    """Které makro odpálit při long-pressu v dané bance.

    Prázdný per-bank seznam znamená "žádná akce", NE fallback na globální —
    jinak by nešlo makro pro jednu banku vypnout (spec 2026-08-08 §D).
    """
    if macro_global:
        return macro_keys or []
    return parse_macro_keys((bank or {}).get("macro_keys"))
```

- [ ] **Step 8: Rozšířit `serialize_state()`**

Najdi:

```python
def serialize_state(banks, macro_keys):
```

a nahraď za:

```python
def serialize_state(banks, macro_keys, macro_global=True):
```

Ve stejné funkci najdi:

```python
    state = {"banks": [_sparse_bank(b) for b in banks]}
    if macro_keys:
        state["macro_keys"] = macro_keys
    return _json.dumps(state, separators=(",", ":"))
```

a nahraď za:

```python
    state = {"banks": [_sparse_bank(b) for b in banks]}
    if macro_keys:
        state["macro_keys"] = macro_keys
    if not macro_global:
        state["macro_global"] = False   # True je default, vynechává se → hash starých configů se nemění
    return _json.dumps(state, separators=(",", ":"))
```

- [ ] **Step 9: Bump `schema_version`**

Najdi:

```python
                    supports_14bit=False, supports_macros=False, schema_version=2,
```

a nahraď za:

```python
                    supports_14bit=False, supports_macros=False, schema_version=3,
```

- [ ] **Step 10: Spustit testy**

Run: `python -m pytest tests/test_macro.py -q`
Expected: PASS, všechny.

- [ ] **Step 11: Spustit celou sadu**

Run: `python -m pytest -q`
Expected: PASS. Zvláštní pozor na `tests/test_wave2_hash.py` a `tests/test_wave2_meta.py` — volají `serialize_state(banks, [])` se dvěma argumenty, což default `macro_global=True` pokrývá.

Pokud některý hash test fixuje konkrétní hodnotu hashe a ta se změnila, **ověř nejdřív proč**: při `macro_global=True` a prázdných per-bank makrech musí být serializace bajt v bajt stejná jako předtím. Když není, chyba je ve Stepu 5 (chybějící default) nebo Stepu 8.

- [ ] **Step 12: Commit**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware"
git add ff_config.py tests/test_macro.py
git commit -m "feat(config): per-bank macro_keys + macro_global, schema_version 3

Bank dict ma novy klic macro_keys; parse_banks vraci macro_global
(chybejici = True = dosavadni chovani). active_macro_keys() je cista
vyberova funkce — prazdny per-bank seznam znamena zadna akce, ne
fallback na globalni. Serializace vynechava oboji, kdyz sedi default,
takze hash starych configu se nemeni."
```

---

### Task 2: Firmware — long-press bere makro podle aktivní banky

**Files:**
- Modify: `code.py` — `save_presets()`, `apply_web_config()`, `_recompute_hash()`, `apply_and_save_json()`, `build_info_dict()` volání, long-press větev hlavní smyčky
- Test: `tests/test_macro.py`

**Interfaces:**
- Consumes: `ff_config.active_macro_keys()`, `ff_config.serialize_state(banks, macro_keys, macro_global)`, `ff_config.parse_banks()` z Tasku 1
- Produces: globální `macro_global: bool` v `code.py`; long-press odpaluje `ff_config.active_macro_keys(macro_global, button_macro, banks[bank_index])`

- [ ] **Step 1: Napsat padající test**

Do `tests/test_macro.py` přidej na konec:

`code.py` se v testech importuje jednou přes `conftest.CODE_MODULE` (`tests/conftest.py:251`, hardware fakes uvnitř). Přidej proto **na začátek** `tests/test_macro.py`, hned pod `import ff_config`:

```python
from conftest import CODE_MODULE as code
```

a na konec souboru:

```python
def test_code_module_exposes_macro_global():
    # code.py musí mít runtime kopii flagu, ne jen banks/button_macro.
    assert hasattr(code, "macro_global")
    assert code.macro_global is True   # DEFAULT_PRESETS nemá macro_global


def test_apply_web_config_sets_macro_global_and_per_bank():
    ok = code.apply_web_config({
        "macro_global": False,
        "macro_keys": [0xE0],
        "banks": [
            {"fader1": {"cc": 11, "channel": 0}, "fader2": {"cc": 1, "channel": 0},
             "encoder": {"cc": 32, "channel": 0}, "macro_keys": [0x2C]},
        ],
    })
    assert ok is True
    assert code.macro_global is False
    assert code.banks[0]["macro_keys"] == [0x2C]
    assert code.button_macro == [0xE0]


def test_active_macro_keys_follows_bank_index():
    code.apply_web_config({
        "macro_global": False,
        "banks": [
            {"fader1": {"cc": 11, "channel": 0}, "fader2": {"cc": 1, "channel": 0},
             "encoder": {"cc": 32, "channel": 0}, "macro_keys": [0x2C]},
            {"fader1": {"cc": 12, "channel": 0}, "fader2": {"cc": 2, "channel": 0},
             "encoder": {"cc": 32, "channel": 0}, "macro_keys": [0x28]},
        ],
    })
    assert ff_config.active_macro_keys(code.macro_global, code.button_macro, code.banks[0]) == [0x2C]
    assert ff_config.active_macro_keys(code.macro_global, code.button_macro, code.banks[1]) == [0x28]
```

⚠️ `CODE_MODULE` je sdílený singleton — tyto testy mutují jeho globální stav (`banks`, `macro_global`). Drž je na konci souboru a nespoléhej na pořadí vůči testům v jiných souborech.

- [ ] **Step 2: Spustit testy a ověřit, že padají**

Run: `python -m pytest tests/test_macro.py -q`
Expected: FAIL — `code.py` nemá `macro_global`.

- [ ] **Step 3: Zavést runtime flag**

V `code.py` najdi:

```python
button_macro = PRESETS.get("macro_keys", [])   # globální long-press makro (HID usage IDy)
```

a nahraď za:

```python
button_macro = PRESETS.get("macro_keys", [])   # globální long-press makro (HID usage IDy)
macro_global = PRESETS.get("macro_global", True)   # False = makro se bere z aktivní banky
```

- [ ] **Step 4: Předat flag do serializace**

Najdi:

```python
    data = ff_config.serialize_state(banks, button_macro)
```

a nahraď za:

```python
    data = ff_config.serialize_state(banks, button_macro, macro_global)
```

Najdi:

```python
    _config_hash = ff_config.state_hash(ff_config.serialize_state(banks, button_macro))
```

a nahraď za:

```python
    _config_hash = ff_config.state_hash(ff_config.serialize_state(banks, button_macro, macro_global))
```

- [ ] **Step 5: Aktualizovat `apply_web_config()`**

Najdi:

```python
    global banks, bank_index, encoder_state, button_macro
```

a nahraď za:

```python
    global banks, bank_index, encoder_state, button_macro, macro_global
```

Ve stejné funkci najdi:

```python
    button_macro = ff_config.parse_macro_keys(web_cfg.get("macro_keys"))
```

a nahraď za:

```python
    button_macro = ff_config.parse_macro_keys(web_cfg.get("macro_keys"))
    macro_global = bool(web_cfg.get("macro_global", True))
```

- [ ] **Step 6: Aktualizovat `apply_and_save_json()`**

Najdi:

```python
        new_macro = ff_config.parse_macro_keys(web_cfg.get("macro_keys"))
        data = ff_config.serialize_state(new_banks, new_macro)
```

a nahraď za:

```python
        new_macro = ff_config.parse_macro_keys(web_cfg.get("macro_keys"))
        new_macro_global = bool(web_cfg.get("macro_global", True))
        data = ff_config.serialize_state(new_banks, new_macro, new_macro_global)
```

- [ ] **Step 7: Aktualizovat druhé volání `serialize_state` v serial handleru**

Najdi:

```python
        body = ff_config.serialize_state(banks, button_macro)
```

a nahraď za:

```python
        body = ff_config.serialize_state(banks, button_macro, macro_global)
```

- [ ] **Step 8: Vybrat makro podle banky při long-pressu**

Najdi:

```python
        if hid_enabled and _kbd is not None and button_macro:
            button_long_fired = True
            try:
                _kbd.send(*button_macro)
```

a nahraď za:

```python
        _macro = ff_config.active_macro_keys(macro_global, button_macro, banks[bank_index])
        if hid_enabled and _kbd is not None and _macro:
            button_long_fired = True
            try:
                _kbd.send(*_macro)
```

- [ ] **Step 9: Spustit testy**

Run: `python -m pytest -q`
Expected: PASS, všechny.

- [ ] **Step 10: Zkontrolovat, že nezůstalo staré dvouargumentové volání**

Run: `rg -n "serialize_state\(" code.py ff_config.py`
Expected: každé volání v `code.py` má tři argumenty; v `ff_config.py` je jen definice.

- [ ] **Step 11: Commit**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware"
git add code.py tests/test_macro.py
git commit -m "feat(macro): long-press bere makro podle aktivni banky

macro_global je runtime flag vedle button_macro; kdyz je False, makro
se cte z banks[bank_index]['macro_keys']. Prazdny per-bank seznam =
zadna akce. serialize_state dostava flag na vsech tech mistech, aby
config_hash odpovidal skutecnemu stavu."
```

---

### Task 3: Appka — schéma a přechodová pravidla

**Files:**
- Modify: `feel-fader.html` — `DEFAULT_CFG` (`app.js:170–177`), `normalizeFwConfig` clamp větev (`app.js:2235–2239`), `configChangeItems()` (`app.js:294`)
- Create: `scratch/per-bank-macro-probe.mjs`
- Modify: `scratch/run-all-probes.mjs` (registrace probe)

**Interfaces:**
- Consumes: `cfg`, `cfg.banks`, `clampHidList(list)`, `activeBank`, `dirty`, `renderPanels()`, `runValidation()`
- Produces:
  - `cfg.macro_global: boolean` (default `true`), `cfg.banks[i].macro_keys: number[]`
  - `activeMacroKeys(bi = activeBank) -> number[]` — co appka zobrazuje/edituje pro danou banku
  - `setMacroGlobal(on: boolean) -> void` — přepínač s přechodovými pravidly
  - `setActiveMacroKeys(bi: number, keys: number[]) -> void` — zápis do správného cíle

- [ ] **Step 1: Napsat padající probe**

Create `scratch/per-bank-macro-probe.mjs`:

```js
// Regression probe: the BUTTON long-press macro can be per-bank, with a
// "Global" checkbox collapsing all banks to one shared value. Transition
// rules matter more than the storage: turning Global ON adopts the currently
// displayed bank's macro (what you see stays), turning it OFF seeds every
// bank from the global value (nothing changes until you edit something).
// Spec: 2026-08-08-ui-backlog-design.md §D.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const dflt = await p.evaluate(() => ({ global: cfg.macro_global, perBank: cfg.banks.map(x => x.macro_keys) }));
P('macro_global defaults to true', dflt.global === true, String(dflt.global));
P('every bank has a macro_keys array', dflt.perBank.every(Array.isArray), JSON.stringify(dflt.perBank));

const globalRead = await p.evaluate(() => {
  cfg.macro_global = true; cfg.macro_keys = [0xE0, 0x16];
  cfg.banks[0].macro_keys = [0x2C];
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('Global on: every bank reads the shared value',
  JSON.stringify(globalRead.b0) === JSON.stringify([224,22]) && JSON.stringify(globalRead.b1) === JSON.stringify([224,22]),
  JSON.stringify(globalRead));

const seeded = await p.evaluate(() => { selectBank(0); setMacroGlobal(false); return cfg.banks.map(x => x.macro_keys); });
P('Global off seeds every bank from the global value',
  seeded.every(k => JSON.stringify(k) === JSON.stringify([224,22])), JSON.stringify(seeded));

const perBank = await p.evaluate(() => {
  setActiveMacroKeys(1, [0x2C]);
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('per-bank edit touches only that bank',
  JSON.stringify(perBank.b0) === JSON.stringify([224,22]) && JSON.stringify(perBank.b1) === JSON.stringify([44]),
  JSON.stringify(perBank));

const adopted = await p.evaluate(() => { selectBank(1); setMacroGlobal(true); return { keys: cfg.macro_keys, shown: activeMacroKeys(1) }; });
P('Global on adopts the displayed bank\'s macro',
  JSON.stringify(adopted.keys) === JSON.stringify([44]) && JSON.stringify(adopted.shown) === JSON.stringify([44]),
  JSON.stringify(adopted));

const empty = await p.evaluate(() => { setMacroGlobal(false); setActiveMacroKeys(0, []); return activeMacroKeys(0); });
P('empty per-bank macro stays empty (no fallback to global)', empty.length === 0, JSON.stringify(empty));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Zaregistrovat probe v runneru**

V `scratch/run-all-probes.mjs` přidej do `PROBES` za `'validation-single-signal-probe.mjs',`:

```js
  'per-bank-macro-probe.mjs',
```

- [ ] **Step 3: Spustit probe a ověřit, že padá**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: FAIL — `macro_global defaults to true` (klíč neexistuje) a `ReferenceError: activeMacroKeys is not defined`.

- [ ] **Step 4: Rozšířit `DEFAULT_CFG`**

V `feel-fader.html` najdi:

```js
const DEFAULT_CFG = {
  macro_keys: [],
```

a nahraď za:

```js
const DEFAULT_CFG = {
  macro_keys: [],
  macro_global: true,   // false = každá banka má vlastní macro_keys
```

Ve stejném objektu doplň `macro_keys:[]` do každé ze tří bank — u každé najdi `nav_invert:false }` a nahraď za `nav_invert:false, macro_keys:[] }`. Použij `replace_all`, všechny tři výskyty jsou identické.

- [ ] **Step 5: Přidat přístupové funkce**

V `feel-fader.html` najdi:

```js
function keyComboLabel(keys){ return (keys&&keys.length) ? keys.map(hidLabel).join('+') : '—'; }
```

a hned **za** něj vlož:

```js
// Long-press makro: buď jedna globální hodnota (cfg.macro_keys), nebo vlastní
// pro každou banku (cfg.banks[i].macro_keys). Přechodová pravidla jsou
// záměrně "co vidíš, to zůstane" — přepnutí checkboxu nikdy tiše nezmění,
// co zařízení udělá (spec 2026-08-08 §D).
function activeMacroKeys(bi = activeBank) {
  if (cfg.macro_global !== false) return cfg.macro_keys || [];
  return (cfg.banks[bi] && cfg.banks[bi].macro_keys) || [];
}
function setActiveMacroKeys(bi, keys) {
  const list = clampHidList(keys);
  if (cfg.macro_global !== false) cfg.macro_keys = list;
  else cfg.banks[bi].macro_keys = list;
}
function setMacroGlobal(on) {
  if (on) {
    // Zapnutí: globální hodnotou se stane makro právě zobrazené banky.
    cfg.macro_keys = clampHidList((cfg.banks[activeBank] && cfg.banks[activeBank].macro_keys) || []);
    cfg.macro_global = true;
  } else {
    // Vypnutí: každá banka dostane dosavadní globální hodnotu, takže se
    // chování nezmění, dokud uživatel něco nepřepíše.
    const seed = clampHidList(cfg.macro_keys || []);
    cfg.banks.forEach(b => { b.macro_keys = seed.slice(); });
    cfg.macro_global = false;
  }
  dirty = true;
  renderPanels();
  runValidation();
}
```

- [ ] **Step 6: Rozšířit clamp/normalizaci importu**

Najdi blok kolem `p.macro_keys = clampHidList(p.macro_keys);` a doplň per-bank clamp. Najdi:

```js
    p.macro_keys = clampHidList(p.macro_keys);
```

a nahraď za:

```js
    p.macro_keys = clampHidList(p.macro_keys);
    p.macro_global = p.macro_global !== false;   // chybí = true (starý config)
```

Dál najdi:

```js
    macro_keys: clampHidList(p.macro_keys),
```

a nahraď za:

```js
    macro_keys: clampHidList(p.macro_keys),
    macro_global: p.macro_global !== false,
```

Dál doplň per-bank clamp na **obou** místech, kde se klampují `nav_keys_*`. Najdi:

```js
      bank.nav_keys_ccw = clampHidList(bank.nav_keys_ccw).length ? clampHidList(bank.nav_keys_ccw) : [0x51];
```

a nahraď za:

```js
      bank.nav_keys_ccw = clampHidList(bank.nav_keys_ccw).length ? clampHidList(bank.nav_keys_ccw) : [0x51];
      bank.macro_keys = clampHidList(bank.macro_keys);   // prázdné je platné = "žádné makro pro tuhle banku"
```

a najdi:

```js
      nav_keys_ccw: (clampHidList(b.nav_keys_ccw).length ? clampHidList(b.nav_keys_ccw) : [0x51]),
      nav_invert:   !!b.nav_invert,
```

a nahraď za:

```js
      nav_keys_ccw: (clampHidList(b.nav_keys_ccw).length ? clampHidList(b.nav_keys_ccw) : [0x51]),
      nav_invert:   !!b.nav_invert,
      macro_keys:   clampHidList(b.macro_keys),
```

Nakonec doplň pole i nově přidávaným bankám. Najdi:

```js
    nav_keys_cw:  [0x52],
```

a v témže objektu (default nové banky v `addBank()`) přidej za řádek s `nav_invert`:

```js
    macro_keys:   [],
```

- [ ] **Step 7: Aktualizovat shrnutí změn**

Najdi:

```js
  if (!same(base?.macro_keys || [],current?.macro_keys || [])) items.push('Button macro');
```

a nahraď za:

```js
  if (!same(base?.macro_keys || [],current?.macro_keys || [])) items.push('Button macro');
  if ((base?.macro_global !== false) !== (current?.macro_global !== false)) items.push('Button macro scope');
  (current?.banks || []).forEach((b,i) => {
    if (!same(base?.banks?.[i]?.macro_keys || [], b.macro_keys || []))
      items.push(`${b.name || 'Bank '+(i+1)}: button macro`);
  });
```

- [ ] **Step 8: Spustit probe**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: všechny řádky `PASS`.

- [ ] **Step 9: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0. Zvláštní pozor na `audit/p1-macro-nav-xss.mjs` — testuje clamp HID seznamů, který jsi právě rozšířil o per-bank cestu.

- [ ] **Step 10: Commit**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-app"
git add feel-fader.html scratch/per-bank-macro-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(config): per-bank macro_keys + macro_global v appce

activeMacroKeys/setActiveMacroKeys/setMacroGlobal drzi prechodova
pravidla: Global ON prevezme makro zobrazene banky, Global OFF nasejde
globalni hodnotu do vsech bank. Prazdny per-bank seznam zustava prazdny.
Import klampuje HID seznamy i per banku."
```

---

### Task 4: Appka — UI checkboxu `Global` a cílený key-capture

**Files:**
- Modify: `feel-fader.html` — `macroSectionContent()` (`app.js:917–933`), `startMacroCapture()` / `_keyCapture` (`app.js:1146–1190`), `_captureTargetEl()` (`app.js:1149`), refresh po capture (`app.js:1046–1048`)
- Modify: `scratch/per-bank-macro-probe.mjs` (rozšíření o UI)

**Interfaces:**
- Consumes: `activeMacroKeys(bi)`, `setActiveMacroKeys(bi, keys)`, `setMacroGlobal(on)` z Tasku 3; `keyComboLabel(keys)`, `isSectionOpen('macro')`, `sectionHeaderHtml()`, `hidEnableNotice()`
- Produces: `#macro-global-toggle` (checkbox), `#macro-capture` nese `data-bank` s indexem banky

- [ ] **Step 1: Rozšířit probe o UI kontrolu**

Do `scratch/per-bank-macro-probe.mjs` přidej před řádek `P('no page errors', ...)`:

```js
await p.evaluate(() => { toggleSection('macro'); });
await new Promise(r => setTimeout(r, 200));

const ui = await p.evaluate(() => {
  const box = document.getElementById('macro-global-toggle');
  const cap = document.getElementById('macro-capture');
  return { hasBox: !!box, checked: box ? box.checked : null,
           capLabel: cap ? cap.textContent.trim() : null,
           capBank: cap ? cap.getAttribute('data-bank') : null };
});
P('BUTTON section has a Global checkbox', ui.hasBox, String(ui.hasBox));
P('checkbox reflects cfg.macro_global (currently false)', ui.checked === false, String(ui.checked));
P('capture button is bound to the displayed bank', ui.capBank === String(await p.evaluate(() => activeBank)), ui.capBank);

await p.evaluate(() => { document.getElementById('macro-global-toggle').click(); });
await new Promise(r => setTimeout(r, 200));
const afterToggle = await p.evaluate(() => ({ flag: cfg.macro_global, checked: document.getElementById('macro-global-toggle').checked }));
P('clicking the checkbox flips cfg.macro_global', afterToggle.flag === true && afterToggle.checked === true, JSON.stringify(afterToggle));
```

- [ ] **Step 2: Spustit probe a ověřit, že nové řádky padají**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: FAIL na `BUTTON section has a Global checkbox`.

- [ ] **Step 3: Přepsat `macroSectionContent()`**

V `feel-fader.html` najdi celou funkci:

```js
function macroSectionContent(bi = activeBank) {   // global long-press macro; always visible, HID gates only runtime
  const open = isSectionOpen('macro');
  const combo = keyComboLabel(cfg.macro_keys || []);
  const summary = DEVICE_INFO.hid_enabled ? (combo === '—' ? {label:'Not assigned'} : {meta:combo}) : {label:'Keyboard off'};
  return `
    ${sectionHeaderHtml(bi,'macro','BUTTON','Macro',summary)}
    <div class="section-collapse-body" id="section-body-${bi}-macro" ${open?'':'hidden'}>
    <div class="section-fields">
      ${hidEnableNotice('Button Macro')}
      <div class="uacc-note" style="margin:0 0 8px">Long-press the device button (≥0.5 s) to send this key combo — e.g. play/stop or a DAW shortcut. Applies to all banks; a short press still switches banks.</div>
      <div class="field-block">
        <span class="field-label">LONG-PRESS KEY</span>
        <button id="macro-capture" class="step-btn" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm);align-self:flex-start"
          onclick="startMacroCapture()">${keyComboLabel(cfg.macro_keys || [])}</button>
      </div>
    </div></div>`;
}
```

a nahraď za:

```js
function macroSectionContent(bi = activeBank) {   // long-press macro; per bank or shared, HID gates only runtime
  const open = isSectionOpen('macro');
  const isGlobal = cfg.macro_global !== false;
  const combo = keyComboLabel(activeMacroKeys(bi));
  const summary = DEVICE_INFO.hid_enabled
    ? (combo === '—' ? {label:'Not assigned'} : {label: isGlobal ? 'All banks' : 'This bank', meta: combo})
    : {label:'Keyboard off'};
  const scopeNote = isGlobal
    ? 'One key combo shared by every bank.'
    : 'This bank has its own key combo; other banks keep theirs.';
  return `
    ${sectionHeaderHtml(bi,'macro','BUTTON','Macro',summary)}
    <div class="section-collapse-body" id="section-body-${bi}-macro" ${open?'':'hidden'}>
    <div class="section-fields">
      ${hidEnableNotice('Button Macro')}
      <div class="uacc-note" style="margin:0 0 8px">Long-press the device button (≥0.5 s) to send this key combo — e.g. play/stop or a DAW shortcut. A short press still switches banks. ${escHtml(scopeNote)}</div>
      <div class="field-block">
        <span class="field-label">LONG-PRESS KEY</span>
        <button id="macro-capture" class="step-btn" data-bank="${bi}" style="width:auto;padding:6px 16px;border:1px solid var(--border-s);border-radius:var(--r-sm);align-self:flex-start"
          onclick="startMacroCapture(${bi})">${escHtml(combo)}</button>
      </div>
      <label class="uacc-note" style="display:flex;align-items:center;gap:8px;margin:10px 0 0;cursor:pointer">
        <input type="checkbox" id="macro-global-toggle" ${isGlobal?'checked':''} onchange="setMacroGlobal(this.checked)"/>
        <span>Global — same macro for all banks</span>
      </label>
    </div></div>`;
}
```

- [ ] **Step 4: Nasměrovat key-capture na správnou banku**

Najdi:

```js
function startMacroCapture(){
  if (!DEVICE_INFO.hid_enabled) { toast('i','Macro requires Keyboard (HID) — enable it in Device & Settings'); return; }
  _captureBegin({ macro: true });
}
```

a nahraď za:

```js
function startMacroCapture(bi = activeBank){
  if (!DEVICE_INFO.hid_enabled) { toast('i','Macro requires Keyboard (HID) — enable it in Device & Settings'); return; }
  _captureBegin({ macro: true, bi });
}
```

- [ ] **Step 5: Zapsat zachycené klávesy do správného cíle**

Najdi:

```js
  if (_keyCapture.macro) {
    cfg.macro_keys = keys;
```

a nahraď za:

```js
  if (_keyCapture.macro) {
    setActiveMacroKeys(_keyCapture.bi ?? activeBank, keys);
```

- [ ] **Step 6: Aktualizovat popisek tlačítka po capture**

Najdi:

```js
  el.textContent = keyComboLabel(cfg.macro_keys || []);
```

a nahraď za:

```js
  el.textContent = keyComboLabel(activeMacroKeys(Number(el.getAttribute('data-bank')) || activeBank));
```

- [ ] **Step 7: Spustit probe**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: všechny řádky `PASS`.

- [ ] **Step 8: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0. `audit/p1-macro-nav-xss.mjs` musí projít — popisek makra jde nově přes `escHtml(combo)`.

- [ ] **Step 9: Commit**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-app"
git add feel-fader.html scratch/per-bank-macro-probe.mjs
git commit -m "feat(ui): BUTTON sekce ma checkbox Global a edituje makro sve banky

Souhrn v hlavicce rika 'All banks' vs 'This bank'. Key-capture nese
index banky, takze zapisuje do spravneho cile i kdyz uzivatel mezitim
prepne banku."
```

---

### Task 5: Appka — upozornění na starý firmware

Bez tohoto by si uživatel nastavil per-bank makra a firmware se `schema_version < 3` by je tiše ignoroval.

**Files:**
- Modify: `feel-fader.html` — `macroSectionContent()`, `DEVICE_INFO`
- Modify: `scratch/per-bank-macro-probe.mjs`

**Interfaces:**
- Consumes: `DEVICE_INFO.schema_version` (plněno z `CMD_INFO`), `_ffConnected`, `cfg.macro_global`
- Produces: `#macro-schema-notice` — varovný řádek, jen když je zařízení připojené, `macro_global === false` a `schema_version < 3`

- [ ] **Step 1: Rozšířit probe**

Do `scratch/per-bank-macro-probe.mjs` přidej před řádek `P('no page errors', ...)`:

```js
const notice = await p.evaluate(() => {
  _ffConnected = true; DEVICE_INFO.schema_version = 2;
  cfg.macro_global = false; renderPanels();
  const n = document.getElementById('macro-schema-notice');
  return { shown: !!n, text: n ? n.textContent.trim() : '' };
});
P('old firmware warning shows for per-bank macros', notice.shown, notice.text);

const noNotice = await p.evaluate(() => {
  DEVICE_INFO.schema_version = 3; renderPanels();
  const a = !!document.getElementById('macro-schema-notice');
  DEVICE_INFO.schema_version = 2; cfg.macro_global = true; renderPanels();
  const b = !!document.getElementById('macro-schema-notice');
  return { onNewFw: a, onGlobal: b };
});
P('no warning on schema_version 3', !noNotice.onNewFw, String(noNotice.onNewFw));
P('no warning while Global is on', !noNotice.onGlobal, String(noNotice.onGlobal));
```

- [ ] **Step 2: Spustit probe a ověřit, že nové řádky padají**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: FAIL na `old firmware warning shows for per-bank macros`.

- [ ] **Step 3: Doplnit `schema_version` do `DEVICE_INFO`**

V `feel-fader.html` najdi:

```js
const DEVICE_INFO = {
  serial:        null,
  firmware:      null,
  mode:          null,
  hid_available: false,
  hid_enabled:   false,
};
```

a nahraď za:

```js
const DEVICE_INFO = {
  serial:        null,
  firmware:      null,
  mode:          null,
  hid_available: false,
  hid_enabled:   false,
  schema_version: null,   // z CMD_INFO; < 3 = firmware neumí per-bank makra
};
```

Pak doplň plnění na **obou** místech, kde se `DEVICE_INFO` čte z `CMD_INFO`.

Serial cesta (`serialReadInfo()`) — najdi:

```js
  if (typeof info.hid_enabled   === 'boolean') DEVICE_INFO.hid_enabled   = info.hid_enabled;
```

a nahraď za:

```js
  if (typeof info.hid_enabled   === 'boolean') DEVICE_INFO.hid_enabled   = info.hid_enabled;
  DEVICE_INFO.schema_version = Number(info.schema_version) || null;
```

SysEx receive cesta (`handleSysEx()`) — najdi:

```js
      if(typeof info.hid_available==='boolean') DEVICE_INFO.hid_available=info.hid_available;
```

a nahraď za:

```js
      if(typeof info.hid_available==='boolean') DEVICE_INFO.hid_available=info.hid_available;
      DEVICE_INFO.schema_version = Number(info.schema_version) || null;
```

- [ ] **Step 4: Vykreslit varování**

V `macroSectionContent()` najdi:

```js
      <label class="uacc-note" style="display:flex;align-items:center;gap:8px;margin:10px 0 0;cursor:pointer">
```

a **před** tento řádek vlož:

```js
      ${(!isGlobal && _ffConnected && DEVICE_INFO.schema_version !== null && DEVICE_INFO.schema_version < 3)
        ? `<div id="macro-schema-notice" class="section-error" style="min-height:auto">Connected device runs an older firmware (schema ${escHtml(String(DEVICE_INFO.schema_version))}) that only supports one macro for all banks — per-bank macros will be ignored until you update it.</div>`
        : ''}
```

- [ ] **Step 5: Spustit probe**

Run: `npm test -- per-bank-macro-probe.mjs`
Expected: všechny řádky `PASS`.

- [ ] **Step 6: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-app"
git add feel-fader.html scratch/per-bank-macro-probe.mjs
git commit -m "feat(ui): varovani, kdyz pripojeny firmware neumi per-bank makra

DEVICE_INFO nese schema_version z CMD_INFO. Pri macro_global=false a
schema_version < 3 rekne BUTTON sekce nahlas, ze zarizeni per-bank
makra ignoruje — misto tiche neshody."
```

---

### Task 6: Dokumentace a ruční HW ověření

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-firmware\CLAUDE.md` — protokolová sekce
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\WEBAPP.md` — §5 (transport) nebo sekce o config formátu

**Interfaces:**
- Consumes: hotové Tasky 1–5
- Produces: zdokumentované schéma pro příští session obou repozitářů

- [ ] **Step 1: Zdokumentovat schéma ve firmware `CLAUDE.md`**

Do protokolové sekce `c:\Users\Fanda Borec\Documents\feel-fader-firmware\CLAUDE.md` přidej:

```markdown
### Long-press makro — per banka nebo globální (schema_version 3, 2026-08-08)

```json
{ "macro_global": true, "macro_keys": [224,22],
  "banks": [ { "…": "…", "macro_keys": [44] } ] }
```

- `macro_global` chybí → `True` = dosavadní globální chování (zpětná kompatibilita).
- `macro_global: false` → long-press bere `banks[bank_index]["macro_keys"]`.
- **Prázdný per-bank seznam = žádná akce**, ne fallback na globální makro (jinak by nešlo
  makro pro jednu banku vypnout).
- Výběr je čistá funkce `ff_config.active_macro_keys(macro_global, macro_keys, bank)`.
- `serialize_state()` vynechává `macro_global`, když je `True`, a prázdné per-bank `macro_keys` —
  takže `config_hash` configů, které per-bank makra nepoužívají, se nemění.
```

- [ ] **Step 2: Zdokumentovat totéž v `WEBAPP.md`**

Do `c:\Users\Fanda Borec\Documents\feel-fader-app\WEBAPP.md`, do sekce o config formátu, přidej stejné schéma plus:

```markdown
Appka drží stav v `cfg.macro_global` a `cfg.banks[i].macro_keys`. Přístup jde přes
`activeMacroKeys(bi)` / `setActiveMacroKeys(bi, keys)`; checkbox volá `setMacroGlobal(on)`.
Přechodová pravidla: zapnutí Global převezme makro právě zobrazené banky, vypnutí naseje
globální hodnotu do všech bank. Když je zařízení připojené s `schema_version < 3` a Global
je vypnutý, BUTTON sekce ukáže `#macro-schema-notice`.
```

- [ ] **Step 3: Commitnout dokumentaci v obou repech**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware"
git add CLAUDE.md
git commit -m "docs: schema per-bank makra + macro_global (schema_version 3)"
```

⚠️ `WEBAPP.md` má v pracovní kopii **necommitnuté** změny z Codexova refaktoru. Než ho commituješ, zkontroluj `git diff WEBAPP.md` a commitni **jen** svůj přírůstek — pokud to nejde oddělit, nech `WEBAPP.md` nezměněný a nahlas to Frankovi místo commitování cizích změn.

- [ ] **Step 4: Poslední plný běh obou sad**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware" && python -m pytest -q
cd "c:/Users/Fanda Borec/Documents/feel-fader-app" && npm test
```

Expected: obojí exit 0.

- [ ] **Step 5: Předat Frankovi k HW testu**

Automatizace končí tady. Nahlas Frankovi, že je vlna připravená, a předej mu tento checklist — **firmware neflashuj a na zařízení nezapisuj sám**:

1. Flashnout `code.py` + `ff_config.py` na CIRCUITPY (byte-exact, `ff_config` před `code.py`), `Write-VolumeCache` + Eject, power-cycle.
2. Připojit appku → očekávej **jednorázový** sync banner „differs" (mění se tvar `config_hash`). Potvrdit načtení ze zařízení.
3. `Global` nechat zapnutý → long-press v Bank 1 i Bank 3 pošle stejnou kombinaci.
4. Vypnout `Global`, nastavit Bank 2 jiné makro než Bank 3, Send → long-press v Bank 2 a Bank 3 pošle různé kombinace.
5. Bank 2 makro vymazat → long-press v Bank 2 nepošle nic, Bank 3 pořád funguje.
6. Reboot zařízení → nastavení přežije (NVM).
7. Se **starým** firmwarem a vypnutým `Global` appka ukáže upozornění na starou schema verzi.

- [ ] **Step 6: Zeptat se na redeploy dema**

Po Frankově potvrzení HW testu se **zeptej na redeploy `feel-fader-demo`** (pravidlo z `[[feel-fader]]`). Neredeployuj bez jeho „ano".
