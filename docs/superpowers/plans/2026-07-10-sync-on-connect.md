# Sync-on-connect (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Po připojení appka ukáže reálné pozice faderů (ne default 64) — firmware je pošle v CMD_INFO odpovědi, app je při connectu aplikuje. Zabije „skok" faderů při prvním přepnutí banky.

**Architecture:** Cross-repo, **zpětně kompatibilní aditivní** změna. Firmware přidá `faders:[v1,v2]` (0–127) do `build_info_dict` JSON (CMD_INFO odpověď, serial i SysEx). App v `serialReadInfo` přes helper `applyInfoFaders(info)` nastaví `liveValues` (před `render()`) a po `render()` napozicuje palce + hodnoty + `liveOn`. Codex-reviewed (APPROVE WITH CHANGES, 2026-07-10).

**Tech Stack:** Firmware = CircuitPython (`code.py`, `ff_config.py`), má pytest (`tests/`). App = single-file `feel-fader.html` (bez test frameworku; headless puppeteer-core proti systémovému Chrome, `pipe:true`).

## Global Constraints

- **Repa oddělená**, nikdy společný merge. Firmware změny na větvi `sync-on-connect` v `c:/Users/Fanda Borec/Documents/feel-fader-firmware`; app na větvi `sync-on-connect` v `c:/Users/Fanda Borec/Documents/feel-fader-app` (už existuje se specem).
- **Aditivní / zpětně kompatibilní:** žádný bump `schema_version`, žádná změna configu/hashe. Starý FW → chybí `faders` → app fallback. Starý app → extra klíč ignoruje.
- Firmware: fresh read `read_fader_7bit_inverted_filtered(fader*_adc)` (ř.238); `faders` do **obou** CMD_INFO cest (serial ~ř.608, SysEx `send_info_sysex` ~ř.336).
- App: **pořadí vůči `render()`** — `liveValues` nastavit před `render()` (ř.2892), DOM (`setTxt`/`positionThumbs`/`liveOn`) po; defenzivní validace (`Array.isArray` len≥2, `Number`, `isFinite`, `clamp(round,0,127)`); `positionThumbs` best-effort + `requestAnimationFrame` follow-up. Nesahat na `_faderDirty`.
- Spec: `docs/superpowers/specs/2026-07-10-sync-on-connect-design.md`.
- Soubory jsou velké — Grep na lokaci, ne full-file Read.

---

## Task F1 (firmware): `faders` v CMD_INFO odpovědi

**Files:**
- Modify: `feel-fader-firmware/ff_config.py` — `build_info_dict` (~ř.218)
- Modify: `feel-fader-firmware/code.py` — serial CMD_INFO (~ř.608), `send_info_sysex` (~ř.336)
- Test: `feel-fader-firmware/tests/` (vzor `test_wave2_serial_parse.py`)

**Interfaces:**
- Consumes: `read_fader_7bit_inverted_filtered(adc)` (code.py ř.238), `fader1_adc`/`fader2_adc` (ř.196).
- Produces: `build_info_dict(..., faders=[v1,v2])` → dict s `"faders":[v1,v2]` (0–127) když `faders` předán.

- [ ] **Step 1: Rozšířit `build_info_dict` o `faders`**

`ff_config.py`, `build_info_dict` (~ř.218). Přidat parametr a zápis:

```python
def build_info_dict(firmware, model, serial, hid_available=True, hid_enabled=False,
                    supports_14bit=False, supports_macros=False, schema_version=2,
                    config_hash=None, config_source=None, faders=None):
    """Feature-discovery dict pro CMD_INFO (§10.7 + Wave 2 spec §2)."""
    info = {
        "firmware": firmware, "model": model, "schema_version": schema_version,
        "hid_available": bool(hid_available), "hid_enabled": bool(hid_enabled),
        "supports_14bit": bool(supports_14bit), "supports_macros": bool(supports_macros),
    }
    if serial:
        info["serial"] = serial
    if config_hash is not None:
        info["config_hash"] = config_hash
    if config_source is not None:
        info["config_source"] = config_source
    if faders is not None:
        info["faders"] = [int(faders[0]), int(faders[1])]
    return info
```

- [ ] **Step 2: Předat čerstvé fader hodnoty v obou CMD_INFO cestách (`code.py`)**

Serial handler (~ř.608): přidat `faders=` do volání `build_info_dict`:

```python
                    _info = ff_config.build_info_dict(
                        FIRMWARE_VER, MODEL_ID, _uid,
                        hid_available=True, hid_enabled=_hid_flag_read(),
                        supports_14bit=False, supports_macros=False,
                        config_hash=_config_hash, config_source=_config_source,
                        faders=[read_fader_7bit_inverted_filtered(fader1_adc),
                                read_fader_7bit_inverted_filtered(fader2_adc)],
                    )
```

`send_info_sysex` (~ř.336): stejně přidat `faders=[read_fader_7bit_inverted_filtered(fader1_adc), read_fader_7bit_inverted_filtered(fader2_adc)]` do `build_info_dict(...)`.

- [ ] **Step 3: Test — `build_info_dict` s/bez `faders`**

Vytvoř/rozšiř test (vzor `tests/test_wave2_serial_parse.py`):

```python
def test_build_info_dict_faders():
    import ff_config
    d = ff_config.build_info_dict("1.0", "FF", "AB", faders=[100, 20])
    assert d["faders"] == [100, 20]
    d2 = ff_config.build_info_dict("1.0", "FF", "AB")
    assert "faders" not in d2
```

- [ ] **Step 4: Spustit test**

Run: `cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware" && python -m pytest tests/ -q`
Expected: PASS (nový test + stávající).

- [ ] **Step 5: Commit (firmware repo)**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-firmware" && git add ff_config.py code.py tests/ && git commit -m "feat: report current fader positions in CMD_INFO (faders[]) for sync-on-connect

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A1 (app): `applyInfoFaders` + wire do `serialReadInfo`

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — nový helper + `serialReadInfo` (~ř.2878–2894)

**Interfaces:**
- Consumes: `info.faders` z `serialReadInfo`; `liveValues` (~ř.1441), `positionThumbs`/`pF`, `setTxt`, `liveOn`, `render`.
- Produces: `applyInfoFaders(info)` → nastaví `liveValues.f1/f2`, vrátí `true` když aplikováno.

- [ ] **Step 1: Helper `applyInfoFaders(info)`**

Přidat blízko `positionThumbs`/`liveOn` (nová funkce). Nastaví jen stav (`liveValues`), defenzivně:

```javascript
function applyInfoFaders(info){
  if(!info || !Array.isArray(info.faders) || info.faders.length < 2) return false;
  const a = Number(info.faders[0]), b = Number(info.faders[1]);
  if(!isFinite(a) || !isFinite(b)) return false;
  const clamp7 = v => Math.max(0, Math.min(127, Math.round(v)));
  liveValues.f1 = clamp7(a); liveValues.f2 = clamp7(b);
  return true;
}
```

- [ ] **Step 2: Zapojit do `serialReadInfo` se správným pořadím vůči `render()`**

`serialReadInfo` (~ř.2878). `liveValues` nastavit **před** `render()` (ř.2892), DOM po. Uprav konec funkce:

```javascript
  DEVICE_INFO.config_hash   = info.config_hash   || null;
  DEVICE_INFO.config_source = info.config_source || null;
  try { localStorage.setItem(LS_SERIAL_PID_KEY, _serialPort.getInfo().usbProductId); } catch(e) {}
  const _faders = applyInfoFaders(info);   // set liveValues BEFORE render (render recreates value spans)
  updateDeviceInfo(); updateHidToggle();
  render();   // re-render roller selector — track_nav gating depends on hid_enabled
  if (_faders) {
    positionThumbs();                       // thumbs live in the (persistent) stage, not rebuilt by render
    setTxt('f1-val', liveValues.f1); setTxt('f2-val', liveValues.f2);
    liveOn('f1-val'); liveOn('f2-val');
    requestAnimationFrame(positionThumbs);  // best-effort follow-up if geometry wasn't ready yet
  }
  return info;
```

- [ ] **Step 3: Ověřit headless (stub info.faders)**

Probe (`scratch/soc-probe.mjs`, puppeteer-core, `npm i puppeteer-core --no-save --silent`): load app, `skipWelcome();render();layoutFaders()`. Protože connect chce HW, testuj **helper přímo** v prohlížeči:
- `applyInfoFaders({faders:[100,20]})` → true, `liveValues.f1===100 && liveValues.f2===20`; po `positionThumbs()` thumb-l/thumb-r `style.transform` odpovídá (v=100 → menší Y než v=20). 
- `applyInfoFaders({faders:[64]})` → false; `applyInfoFaders({faders:[NaN,5]})` → false; `applyInfoFaders({})` → false (liveValues beze změny).
- Simuluj pořadí: nastav `liveValues`, zavolej `render()`, pak `setTxt('f1-val',liveValues.f1)` → `#f1-val` textContent = '100' (render ho nepřepsal, protože setTxt je po něm).
- Žádné page errors. Report + screenshot faderů.
Po ověření `rm -rf node_modules`.

- [ ] **Step 4: Commit (app repo)**

```bash
cd "c:/Users/Fanda Borec/Documents/feel-fader-app" && git add feel-fader.html && git commit -m "feat: sync fader positions on connect from CMD_INFO faders[] (applyInfoFaders)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task DOC: protokolové tabulky

- [ ] **Step 1:** Doplnit `faders` (volitelné pole v CMD_INFO odpovědi, 0–127 ×2) do protokolové tabulky v `feel-fader-firmware/CLAUDE.md` a zmínku v `feel-fader-app/CLAUDE.md` (App sekce). Commit v příslušných repech.

---

## Závěrečné ověření (HW test, obě strany nasazené)

1. Fyzicky nastav fadery mimo default → připoj → on-screen fadery **hned sedí** na reálných pozicích (ne 64).
2. Stiskni HW tlačítko (přepnutí banky) → fadery se **viditelně nepohnou** (už sync). Levý ADC jitter ±1 OK.
3. Zpětná kompat: (pokud dostupné) nová app + starý FW → fallback na 64, žádná chyba.

## Self-review (autor plánu)

- **Spec coverage:** firmware `faders` obě cesty → F1; app `applyInfoFaders` + pořadí vůči render + best-effort positionThumbs + validace → A1; protokol tabulky → DOC; HW test → závěr. Codex 4 úpravy pokryté (helper, render pořadí, best-effort follow-up, obě CMD_INFO cesty). ✓
- **Placeholdery:** žádné — konkrétní kód firmware i app. ✓
- **Konzistence:** `applyInfoFaders` def A1 Step1, volán A1 Step2; `faders` param def F1 Step1, předán F1 Step2. ✓
- **Riziko:** nízké (aditivní, zpětně kompat). Hlavní ověření = HW test round-trip.
