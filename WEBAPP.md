# Feel Fader — Web App Reference

Interní dokumentace pro Franka a Ivana. Popisuje aktuální stav appky — funkční popis UI i technické detaily implementace.

---

## 1. Přehled

**Soubor:** `feel-fader.html` — jedna HTML stránka (~2 900 řádků), žádný build step, žádné závislosti (fonty z Google Fonts).

**Účel:** Webový konfigurátor pro hardwarový MIDI kontrolér Feel Fader. Umožňuje nastavit MIDI kanál a CC číslo pro každý fader a enkodér, spravovat presets (banky) a synchronizovat konfiguraci se zařízením.

**Technologie:**
| Vrstva | Co se používá |
|---|---|
| UI | Vanilla JS, CSS animace, IBM Plex Mono + Mulish (Google Fonts) |
| MIDI | Web MIDI API (`navigator.requestMIDIAccess`) — vyžaduje povolení v browseru |
| Serial | Web Serial API — fallback/doplněk pro čtení dat ze zařízení |
| Persistence | `localStorage` — klíč `ff-cfg` |
| Transport | SysEx zprávy přes MIDI výstup |

**Kompatibilita:** Chrome / Edge (Web MIDI API není dostupné v Safari ani Firefox bez rozšíření).

---

## 2. Architektura

### Struktura souboru

```
feel-fader.html
├── <style>          CSS (řádky 10–931)
├── <body>
│   ├── <header>     Stavový řádek + dark mode toggle
│   ├── <main>       Hlavní obsah (center-col)
│   ├── #modal       Overlay — Settings (počet banků)
│   ├── #welcome-screen  Uvítací obrazovka (fixed overlay)
│   ├── #icon-picker Overlay — výběr ikony banku
│   └── <script>     Veškerý JS (řádky 1180–2873)
```

### Životní cyklus

```
Načtení stránky
  → cfgLoad() — načte cfg z localStorage (nebo DEFAULT_CFG)
  → initDark() — nastaví tmavý/světlý režim
  → welcomeImg.src = deviceImg.src — zkopíruje PNG zařízení na welcome screen
  → initWelcomeFaderOverlay() — zobrazí animované fadery na welcome screenu
  → render() — vykreslí UI
  → initMidi() — požádá o Web MIDI přístup
  → showWelcome() — zobrazí welcome overlay
```

### Klíčové globální proměnné

| Proměnná | Typ | Popis |
|---|---|---|
| `cfg` | Object | Aktivní konfigurace. Zdrojová pravda pro render. Ukládá se do localStorage po každé změně. |
| `liveValues` | `{f1, f2}` | Aktuální MIDI hodnoty faderů (0–127). Výchozí `{f1:64, f2:64}`. Aktualizuje se při příchozích MIDI CC zprávách. |
| `activeBank` | Number | Index aktuálně zobrazeného banku (0-based). |
| `liveBank` | Number | Index banku aktivního na fyzickém zařízení. |
| `encIndex` | Number | Aktuální pozice enkodéru (index v poli `uacc_values`). |
| `loaded` | Boolean | `true` pokud byla konfigurace načtena ze zařízení nebo z localStorage. |
| `dirty` | Boolean | `true` pokud jsou neuložené změny (konfigurace se liší od stavu v zařízení). |
| `_ffConnected` | Boolean | `true` pokud je Feel Fader MIDI vstup aktivní. |
| `midiAccess` | MIDIAccess | Odkaz na Web MIDI přístupový objekt. |

---

## 3. UI — Sekce po sekcích

### 3.1 Welcome Screen (`#welcome-screen`)

**Co dělá:** Fixed overlay (z-index 200) zobrazený při startu, dokud není zařízení připojeno nebo uživatel neklikne „Continue without device".

**Idle stav:**
- Device image (220 px) s float animací (vertikální houpání, 3s)
- Dva animované fadery: levý (master, ~30% dráha, 5.5s), pravý (slave, ~14% dráha, 5.5s + 0.5s offset) — čistý CSS, stejný směr pohybu
- Text: „Waiting for device" → „Connect Feel Fader" → skip tlačítko

**Connect transition** (spouští se přes `hideWelcome()` → `connectTransitionWelcome()`):
1. Fadery zamrznou na aktuální pozici, pak se plynule přesunou na v=64 (střed)
2. Float animace se zastaví (`animationPlayState: paused`)
3. Green box-shadow glow na device imagu — pomalý náběh (peak na 38 % = ~530 ms), rychlý decay
4. Text „Waiting for device" vyjede nahoru a zmizí
5. Welcome screen se rozplyne; `.hidden` se přidá po 1 350 ms

**Klíčové funkce:** `initWelcomeFaderOverlay()` (L2642), `connectTransitionWelcome()` (L2652), `hideWelcome()` (L2705), `skipWelcome()` (L2709)

---

### 3.2 Header

**Co dělá:** Sticky lišta nahoře. Zobrazuje název „Feel Fader", stav připojení MIDI a dark mode toggle.

**Stav připojení** (`#h-status-dot`, `#h-status-text`):
- Šedý pulzující bod → hledá zařízení
- Zelený bod + „Connected [název portu]" → Feel Fader nalezen
- Červený bod → chyba nebo odpojení

**Dark mode toggle:** Přepíná třídu `.dark` na `<html>`. Stav se ukládá do `localStorage` (klíč `ff-dark`).

**Klíčové funkce:** `updateStatus()` (L2325), `toggleDark()` (L2599), `initDark()` (L2609)

---

### 3.3 Stage — Device + Fadery

**Co dělá:** Vizuální reprezentace fyzického zařízení. PNG obrázek zařízení s překrytými interaktivními fader thumby.

**Fader thumbs:**
- Dva dragovatelné thumby (PNG obrázky) pozicované absolutně na device imagu
- Pozice odpovídají fyzickým drážkám na zařízení (viz Sekce 7 — Fader layout)
- Pohyb myší/dotykem aktualizuje `liveValues` a odesílá MIDI CC
- Pod stage je volitelný `#fader-visual-wrap` s numerickými hodnotami (viditelný jen při připojení)

**Klíčové funkce:** `onImgLoad()` (L1818), `layoutFaders()` (L1819), `pF()` (L1830), `mF()` (L1840), `drag()` / `dragT()` (L1835–36)

---

### 3.4 Send / Load tlačítka

| Tlačítko | Co dělá |
|---|---|
| **load from device** | Přečte konfiguraci ze zařízení přes SysEx CMD_R → přepíše `cfg` → `render()` |
| **send to device** | Zapíše aktuální `cfg` do zařízení přes SysEx CMD_W v chunked formátu |

Obě tlačítka jsou zakázána (`disabled`) pokud `!_ffConnected`.

**Klíčové funkce:** `doLoad()` (L2210), `doSend()` (L2238)

---

### 3.5 Bank Tabs

**Co dělá:** Horizontálně scrollovatelná řada záložek (max. 10 banků). Aktivní banka je zvýrazněná. Tlačítko „+" přidá nový bank.

**Interakce:**
- Klik na záložku → `selectBank(i)` — přepne `activeBank` a překreslí panely
- Tlačítko „+" → `addBank()` — přidá bank s defaultní konfigurací
- Počet banků lze měnit také přes Settings modal (⚙)

**Klíčové funkce:** `renderBankTabs()` (L1352), `selectBank()` (L1614), `addBank()` (L1705), `removeBank()` (L1720), `stepBanks()` (L1726)

---

### 3.6 Bank Name Card

**Co dělá:** Řádek pod záložkami — jméno banku, ikona a tagy (labelky pro vyhledávání/přehlednost).

**Komponenty:**
- **Icon picker:** Emoji nebo barevný badge (výběr z předdefinovaných kategorií — nástroje, styly, barvy). Otevírá overlay `#icon-picker`.
- **Name input:** Inline editovatelné jméno banku.
- **Tags:** Volné textové štítky (stiskni Enter pro přidání). Slouží pro orientaci, neodesílají se do zařízení.
- **Smazat bank (✕):** Viditelné jen pokud je více než 1 bank.

**Klíčové funkce:** `onBankRename()` (L1616), `addTag()` (L1634), `removeTag()` (L1644), `openIconPicker()` (L2807), `closeIconPicker()` (L2843)

---

### 3.7 Fader Sekce (Fader 1 / Fader 2)

**Co dělá:** Každý bank má dvě fader sekce — Expression (Fader 1) a Dynamics (Fader 2). Konfigurují CC číslo a MIDI kanál pro každý fader.

**Pole:**
| Pole | Rozsah | Popis |
|---|---|---|
| MIDI CHANNEL | 1–16 | MIDI kanál (interně ukládáno jako 0–15) |
| MIDI CC | 0–127 | Control Change číslo |
| Label | text | Vlastní popis (zobrazuje se v UI, neodesílá se) |

**Live value bar:** Malý progress bar + číslo ukazuje aktuální hodnotu přijatou ze zařízení.

**Klíčové funkce:** `faderSectionContent()` (L1426), `stepCtrl()` (L1596), `onCtrl()` (L1606), `onFaderLabel()` (L1651)

---

### 3.8 Encoder Sekce (Articulation Encoder)

**Co dělá:** Otočný enkodér na fyzickém zařízení prochází seznam artikulací (UACC hodnoty). Sekce konfiguruje CC číslo, MIDI kanál a seznam dostupných artikulací.

**UACC (Universal Articulation Control Code):**
Standard pro pojmenování CC hodnot používaný u Spitfire Audio, East West, Orchestral Tools atd. CC 32 je standardní UACC kanál.

Každá artikulace je CC hodnota (0–127) s volitelným pojmenováním (interní slovník `UACC_NAMES`).

**Správa seznamu artikulací:**
- Přidat jednotlivé hodnoty nebo aplikovat přednastavené šablony (Strings, Woodwinds, Brass, atd.)
- Enkodér na zařízení přechází na další/předchozí hodnotu v seznamu

**Klíčové funkce:** `encoderSectionContent()` (L1555), `addUacc()` (L1743), `removeUacc()` (L1754), `addUaccFromPreset()` (L1760), `renderUacc()` (L1574), `uaccName()` (L1290)

---

### 3.9 Advanced Settings (Modal)

Dostupné přes ikonu ⚙ v headeru. Obsahuje:
- **Počet banků** — nastaví počet (1–10), přidá nebo odebere banky
- **Factory reset** — obnoví `DEFAULT_CFG`, vymaže localStorage

**Klíčové funkce:** `openModal()` (L2315), `closeModal()` (L2316), `onBankCount()` (L1733)

---

### 3.10 JSON Inspector

Rozbalovací sekce pod hlavním obsahem. Zobrazuje aktuální `cfg` jako formátovaný JSON — užitečné pro debug. Tlačítko Copy zkopíruje JSON do schránky.

Aktivní import/export:
- **Export:** Stáhne `feel-fader-config.json`
- **Import:** Načte `.json` soubor, přepíše `cfg`, překreslí UI

**Klíčová funkce:** `refreshJson()` (L2313), `onImport()` (L2271)

---

## 4. Datové struktury

### `cfg` objekt

```js
{
  banks: [
    {
      name: "Bank 1",          // string — zobrazované jméno
      icon: "🎻",              // string — emoji nebo barevný badge kód, nebo ""
      tags: ["strings"],       // string[] — volné štítky
      fader1: {
        cc: 11,                // 0–127 — MIDI CC číslo
        channel: 0,            // 0–15 (zobrazuje se jako 1–16)
        label: "Expression"    // string — vlastní popis
      },
      fader2: {
        cc: 1,
        channel: 0,
        label: "Dynamics"
      },
      encoder: {
        cc: 32,
        channel: 0
      },
      uacc_values: [1, 2, 3, 20, 21, ...]  // number[] — seznam UACC hodnot
    },
    // ... další banky
  ]
}
```

### `DEFAULT_CFG`

Definován na řádku 1297. Obsahuje 3 předdefinované banky (Bank 1–3) s různými CC čísly a kanály. Použije se při prvním spuštění nebo po factory resetu.

### localStorage

| Klíč | Obsah |
|---|---|
| `ff-cfg` | Serializovaný `cfg` objekt (JSON string) |
| `ff-dark` | `"1"` pokud je aktivní dark mode |
| `ff-serial-pid` | PID posledního úspěšného Serial portu (pro auto-reconnect) |

### `liveValues`

```js
{ f1: 64, f2: 64 }   // výchozí — střed faderů (MIDI 64/127)
```

Aktualizuje se při:
- Příchozích MIDI CC zprávách ze zařízení (`onMidiMsg()`)
- Draggování fader thumbů v UI (`mF()`)

---

## 5. MIDI / Serial Transport

### Connect flow

```
initMidi()
  → navigator.requestMIDIAccess({sysex: true})
  → onstatechange / enumerate ports
  → isFeelFader(portName) — hledá port obsahující "Feel Fader"
  → connectInputs()
    → inp.onmidimessage = onMidiMsg
    → _requestDeviceInfoSysex() — odešle CMD_INFO
    → setTimeout(hideWelcome, 600) — spustí connect transition
```

### SysEx konstanty (řádek 2011)

```js
const MFR     = 0x7D;  // Manufacturer ID (non-commercial)
const DEV_ID  = 0x01;  // Device ID
const CMD_W   = 0x01;  // Zápis konfigurace do zařízení
const CMD_R   = 0x02;  // Čtení konfigurace ze zařízení
const CMD_INFO= 0x03;  // Dotaz na info o zařízení (firmware, serial)
const CMD_CHUNK = 0x04;// Chunk dat při přenosu velké konfigurace
const CMD_ACK = 0x05;  // Potvrzení přijetí chunku
const CMD_ERR = 0x06;  // Chyba přenosu
```

### SysEx formát zprávy

```
[0xF0, MFR, DEV_ID, CMD_*, ...data..., 0xF7]
```

Data jsou 7-bit enkódovaná (`enc7()` / `dec7()`) — každý byte rozdělen na 2 SysEx byty (MSB + 7 bitů).

### Zápis konfigurace (CMD_W)

`sysexWriteConfig(cfg)` (L2133):
1. Serializuje `cfg` → JSON → UTF-8 bytes
2. Rozdělí na chunky (po 32 bytech)
3. Odešle každý chunk jako SysEx CMD_CHUNK
4. Čeká na CMD_ACK od zařízení před odesláním dalšího chunku
5. Timeout 2 000 ms na každý ACK

### Čtení konfigurace (CMD_R)

`sysexReadConfig()` (L2117):
1. Odešle CMD_R SysEx
2. Čeká na příchozí CMD_CHUNK zprávy
3. Sestaví buffer, dekóduje JSON
4. `normalizeFwConfig()` mapuje device formát → web formát, pak `cfg` + `render()`

### Formát konfigurace: app vs. device

App drží **web formát** (`cfg` — per-control, viz §4), device drží **interní kompaktní formát**:

```js
// Device (banks[i]) — co posílá v CMD_R/CMD_CHUNK
{ fader_cc:[cc1,cc2], fader_ch:[ch1,ch2], encoder:cc, encoder_ch:ch, uacc_values:[...] }
```

- **App → device** (CMD_W): posílá celý `cfg`; firmware `apply_web_config()` si vezme `fader1/2/encoder.cc` + `.channel`.
- **Device → app** (CMD_R): device posílá interní formát; `normalizeFwConfig()` (L2035) ho převede zpět na web formát.
- **Každý ovladač má vlastní MIDI kanál** (fader1, fader2, encoder samostatně). `normalizeFwConfig` čte `fader_ch[0/1]` a `encoder_ch`; pro starý formát (jeden `channel` na banku) má fallback.
- ⚠️ Tento formát musí zůstat v synchronu s firmwarem — viz `CLAUDE.md` (pravidlo app↔firmware).

### Serial (backup transport)

Používá se pro `doSend()` přes CMD_W — při připojení přes USB-C je Serial kanál rychlejší pro zápis velké konfigurace. `getOut()` (L1934) vrací aktivní výstupní port (MIDI nebo Serial).

---

## 6. Klíčové funkce

| Funkce | Řádek | Popis |
|---|---|---|
| `render()` | 1339 | Překreslí celé UI podle aktuálního `cfg`. Volá `renderBankTabs()` + `renderPanels()`. |
| `renderBankTabs()` | 1352 | Vykreslí záložky banků. |
| `renderPanels()` | 1365 | Vykreslí sekce aktivního banku (fader1, fader2, encoder). |
| `selectBank(i)` | 1614 | Přepne aktivní bank, překreslí UI. |
| `stepCtrl(bi,key,field,delta)` | 1596 | Změní hodnotu pole (CC/channel) o delta (±1) přes stepper tlačítka. |
| `onCtrl(bi,key,field,val)` | 1606 | Zapíše novou hodnotu do `cfg`, uloží do localStorage. |
| `layoutFaders()` | 1819 | Pozicuje fader tracky na device imagu podle layout konstant. |
| `pF(tid,thid,v)` | 1830 | Pozicuje fader thumb na pixel pozici odpovídající MIDI hodnotě v (0–127). |
| `mF(k,cy)` | 1840 | Zpracuje drag fader thumbu — přepočítá na MIDI hodnotu, odešle CC. |
| `connectInputs()` | 1885 | Připojí MIDI vstup/výstup Feel Faderu, spustí connect sekvenci. |
| `onMidiMsg(event)` | 1945 | Zpracuje příchozí MIDI zprávy (CC → liveValues, SysEx → handleSysEx). |
| `handleSysEx(data)` | 2051 | Zpracuje příchozí SysEx (CMD_INFO, CMD_CHUNK, CMD_ACK, CMD_ERR). |
| `sysexWriteConfig(cfg)` | 2133 | Async. Zapíše celý cfg do zařízení přes chunked SysEx. |
| `sysexReadConfig()` | 2117 | Async. Načte cfg ze zařízení přes SysEx. |
| `doSend()` | 2238 | UI handler pro „send to device" — validuje, pak volá `sysexWriteConfig`. |
| `doLoad()` | 2210 | UI handler pro „load from device" — volá `sysexReadConfig`. |
| `updateStatus()` | 2325 | Aktualizuje MIDI banner a header status dot. |
| `connectTransitionWelcome()` | 2652 | Animovaný přechod welcome screenu při připojení zařízení. |
| `hideWelcome()` | 2705 | Spustí connect transition. Volá `connectTransitionWelcome()`. |
| `skipWelcome()` | 2709 | Okamžitě skryje welcome screen bez animace. |
| `initWelcomeFaderOverlay()` | 2642 | Zkopíruje PNG thumby z hlavního stage na welcome screen overlay. |
| `renderFaderVisual()` | 2718 | Vykreslí live fader vizualizaci (numerické hodnoty) pod stage. |
| `updateFaderVisual()` | 2742 | Aktualizuje live vizualizaci při změně `liveValues`. |
| `toggleDark()` | 2599 | Přepne dark/light mode + uloží do localStorage. |
| `initDark()` | 2609 | Načte preferenci dark mode při startu. |
| `applyLang()` | 2586 | Aplikuje překlady (data-i18n atributy). Aktuálně pouze EN. |
| `validate()` | 1771 | Validuje `cfg` — kontroluje duplicitní CC/kanál kombinace. |
| `openIconPicker(bi)` | 2807 | Otevře overlay pro výběr ikony banku. |
| `onImport(e)` | 2271 | Importuje JSON konfiguraci ze souboru. |
| `refreshJson()` | 2313 | Aktualizuje JSON inspector. |
| `toast(type, msg)` | 2343 | Zobrazí dočasné notifikační hlášení (success/error/info). |
| `cfgSave()` | 1314 | Uloží `cfg` do localStorage. |
| `cfgLoad()` | 1317 | Načte `cfg` z localStorage, vrátí null pokud neexistuje. |

---

## 7. Fader Layout — Konstanty

Definovány na řádku 1817:

```js
const FLX = 0.2289;  // X střed levého faderu (podíl šířky device image)
const FRX = 0.7684;  // X střed pravého faderu
const FTY = 0.1164;  // Y horní okraj fader tracku (podíl výšky)
const FBY = 0.7974;  // Y dolní okraj fader tracku
const FTW = 0.22;    // Šířka fader thumbu (podíl šířky device image)
```

**Výpočet pozice tracku** (`layoutFaders()`):

```js
const W = img.offsetWidth;          // šířka device image v px (typicky 220px)
const H = img.offsetHeight;         // výška (tipicky 497px při 220px šířce)
const tw = Math.round(W * FTW);     // šířka thumbu ≈ 48px
const th = Math.round(tw * 1.506);  // výška thumbu ≈ 72px (poměr PNG)
const tH = Math.round((FBY - FTY) * H);  // výška tracku ≈ 338px
const tT = Math.round(FTY * H);          // horní offset tracku ≈ 58px
```

**Přepočet MIDI hodnoty na pixel pozici** (`pF()`):

```js
top = Math.round((1 - v/127) * (trackHeight - thumbHeight))
// v=0   → top=0    (fader nahoře)
// v=64  → top≈47%  (střed — výchozí pozice)
// v=127 → top=0+thumbH ≈ spodek
```

**Welcome screen fader overlay** používá stejné proporce jako hardcoded CSS procenta:
- Levý track: `left: 11.89%`, `top: 11.64%`, `height: 68.10%`, `width: 22%`
- Pravý track: `left: 65.84%`, `top: 11.64%`, `height: 68.10%`, `width: 22%`

---

## 8. i18n

Překlady jsou definovány v JS objektu `STRINGS` (řádek ~2370) a aplikovány přes `applyLang()` na elementy s atributem `data-i18n="key"`.

Aktuálně podporován pouze **anglický jazyk**. Česká lokalizace není implementována — appka je primárně pro mezinárodní uživatele.

---

*Naposledy aktualizováno: 2026-05-31*
