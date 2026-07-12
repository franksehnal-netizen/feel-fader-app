# Feel Fader — Web App Reference

Interní dokumentace pro Franka a Ivana. Popisuje aktuální stav appky — funkční popis UI i technické detaily implementace.

> ℹ️ **Stav (2026-07-12):** Všechny odkazy `Lxxxx` srovnané proti aktuálnímu souboru (3 466 řádků). Funkce odstraněné/přejmenované refaktorem od 06-27 jsou označené `⚠` s ukazatelem na náhradu. **§5 (transport) kompletně přepsána** podle reálného kódu — config jde přes line-based serial protokol, ne přes MIDI SysEx. §0 (design contract) je proti driftu imunní (popisuje `:root`, ne řádky).

---

## 0. Design System — Contract

> **Invariant:** Barvy, radii a stíny **jen přes tokeny** (`var(--…)`), nikdy hardcoded hex/rgba v komponentě. Motion drží `ease` a durationy z tabulky níže. Kdo tohle poruší, rozbije vizuální jazyk — i když to lokálně „vypadá OK". Tokeny žijí v `:root` (světlý) + `html.dark` (tmavý) na začátku `<style>`.

### Barvy

| Token | Význam | Light | Dark |
|---|---|---|---|
| `--bg` | Pozadí stránky | `#f5f5f7` | `#0f0f11` |
| `--bg-card` | Karty / panely | `#ffffff` | `#1c1c1e` |
| `--bg-input` | Vstupní pole | `#f0f0f2` | `#2c2c2e` |
| `--border` | Vlásková linka | `rgba(0,0,0,.08)` | `rgba(255,255,255,.08)` |
| `--border-s` | Silnější okraj | `rgba(0,0,0,.12)` | `rgba(255,255,255,.13)` |
| `--t1` | Primární text | `#1d1d1f` | `#f5f5f7` |
| `--t2` | Sekundární text | `#6e6e73` | `#aeaeb2` |
| `--t3` | Terciární / hint | `#aeaeb2` | `#8e8e93` |
| `--red` / `--red2` | Chyba / danger + hover | `#e8503a` / `#d03f2a` | stejné |
| `--green` | Success **fill/tečka** (na neutrálu) | `#34c759` | stejné |
| `--green-text` | Success **text** (na barvě) | `#1e8237` | `#5dd47a` |
| `--green-bg` / `--green-border` | Success plocha / okraj | `rgba(52,199,89,.10)` / `.32` | stejné |
| `--amber` | Warning | `#e6a23c` | stejné |
| `--shadow` / `--shadow-sm` | Elevace | dvouvrstvá | tmavší varianta |

> 🪤 **Past — `--green` vs `--green-text`:** `--green` (#34c759) je jasná zelená pro **fill/tečku** na neutrálním pozadí. Pro **text** (hlavně na `--green-bg`) použij VŽDY `--green-text`, které je ztmavené (light) / zesvětlené (dark) kvůli kontrastu. `--green` jako barva textu = nečitelné na světlém, špatný kontrast — nedělat.

### Radii

`--r-sm: 6px` (badge, malé prvky) · `--r: 12px` (karty, inputy) · `--r-lg: 18px` (velké kontejnery) · `--r-pill: 999px` (tečky, scrollbar, pills). Žádná jiná hodnota.

### Motion

Všechny transice: **`ease`** (default), duration **.06s–.45s**. Bez výjimky — v celém souboru není jediný `cubic-bezier`, bounce ani overshoot, a to je záměr.

- **Micro-interakce** (hover, stepper, drag): `.12–.15s`
- **Větší přechody** (welcome transition, theme switch, glow): `.3–.45s`

Nepřidávat spring/bounce easing ani durationy > .5s pro UI feedback — láme to „klidný, přesný" charakter appky.

### Typografie

- **Mulish** — veškeré UI (base `13px`).
- **IBM Plex Mono** — technické/číselné: verze, badges (`dev`/`prod`), JSON inspector, monospace hodnoty.
- Velikosti jsou **raw px**, clusterují na `10 / 11 / 12 / 13 / 14 / 16 / 22`. Nejsou tokenizované (viz gapy níže).

### Známé gapy (netokenizované — pozor při rozšiřování)

- **Spacing** — gapy/paddingy jsou raw px (`8 / 12 / 16 / 28`), žádný `--space-*` token.
- **Font-size** — raw px, žádný `--fs-*` token.
- **Jednorázové hex mimo tokeny** — `h-badge.dev/.prod` (zlaté/zelené `#b07d00`, `#2e7d32`…), dark overrides (`#111115`, `#1a1a1e` pro JSON/artic display). Legit výjimky, ale při přidávání podobného prvku sáhni po existující variabli, ne po nové konstantě.

---

## 1. Přehled

**Soubor:** `feel-fader.html` — jedna HTML stránka (~3 466 řádků), žádný build step, žádné závislosti (fonty z Google Fonts).

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
├── <style>          CSS (řádky 10–1071)
├── <body>
│   ├── <header>     Stavový řádek + dark mode toggle
│   ├── <main>       Hlavní obsah (center-col)
│   ├── #modal       Overlay — Settings (počet banků)
│   ├── #welcome-screen  Uvítací obrazovka (fixed overlay)
│   ├── #icon-picker Overlay — výběr ikony banku
│   └── <script>     Veškerý JS (řádky 1325–3465)
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
  → showWelcome() — zobrazí welcome overlay (+ fallback timer pro Start, viz §3.1)
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

**„Start" tlačítko (`#welcome-start`):** Welcome je jediná plocha, kde se uděluje serial port (Web Serial vyžaduje uživatelské gesto). Logika v `onDeviceConnected()` + fallback timer v `showWelcome()`:
- **Zařízení detekováno + port už schválený** (vracející se uživatel) → žádný Start, `loadConfigFromDevice()` proběhne tiše a spustí se transition (plně automatický vstup).
- **Zařízení detekováno + port neschválený** (první připojení) → zobrazí se **Start**. Klik (`doStart()`) = grant + load + transition.
- **MIDI detekce neproběhne** (port quirk) → po ~3,5 s (`_welcomeStartTimer`) se Start ukáže i tak; klik obejde MIDI přes serial picker.
- **Skip → pak připojíš zařízení** → `onDeviceConnected()` znovu vyjede welcome se Startem.
- Při zrušení pickeru / chybě / timeoutu → zůstane na welcome + hláška (`#welcome-start-msg`), Start zůstává.

**Connect transition** (spouští se přes `hideWelcome()` → `connectTransitionWelcome()`):
1. Fadery zamrznou na aktuální pozici, pak se plynule přesunou na v=64 (střed)
2. Float animace se zastaví (`animationPlayState: paused`)
3. Green box-shadow glow na device imagu — pomalý náběh (peak na 38 % = ~530 ms), rychlý decay
4. Text „Waiting for device" vyjede nahoru a zmizí
5. Welcome screen se rozplyne; `.hidden` se přidá po 1 350 ms

**Klíčové funkce:** `initWelcomeFaderOverlay()` (L3144), `connectTransitionWelcome()` (L3154), `hideWelcome()` (L3207), `skipWelcome()` (L3211)

---

### 3.2 Header

**Co dělá:** Sticky lišta nahoře. Zobrazuje název „Feel Fader", stav připojení MIDI a dark mode toggle.

**Stav připojení** (`#h-status-dot`, `#h-status-text`):
- Šedý pulzující bod → hledá zařízení
- Zelený bod + „Connected [název portu]" → Feel Fader nalezen
- Červený bod → chyba nebo odpojení

**Dark mode toggle:** Přepíná třídu `.dark` na `<html>`. Stav se ukládá do `localStorage` (klíč `ff-dark`).

**Klíčové funkce:** `renderConnState()` (L2976, dřív `updateStatus`), `toggleDark()` (L3090), `initDark()` (L3104)

---

### 3.3 Stage — Device + Fadery

**Co dělá:** Vizuální reprezentace fyzického zařízení. PNG obrázek zařízení s překrytými interaktivními fader thumby.

**Fader thumbs:**
- Dva dragovatelné thumby (PNG obrázky) pozicované absolutně na device imagu
- Pozice odpovídají fyzickým drážkám na zařízení (viz Sekce 7 — Fader layout)
- Pohyb myší/dotykem aktualizuje `liveValues` a odesílá MIDI CC
- Pod stage je volitelný `#fader-visual-wrap` s numerickými hodnotami (viditelný jen při připojení)

**Klíčové funkce:** `onImgLoad()` (L2386), `layoutFaders()` (L2387), `pF()` (L2424), `positionThumbs()` (L2403). ⚠ `mF()` / `drag()` / `dragT()` **odstraněny** — drag path je teď `scheduleFaderFrame()` (L2414) + `flushFaderFrame()` (L2419) + `applyInfoFaders()` (L2406).

---

### 3.4 Načítání configu (Start) + Send

**Načítání ze zařízení už nemá tlačítko na hlavní stránce** — nahradil ho **„Start" na welcome screenu** (viz §3.1). Load proběhne přes sdílené `loadConfigFromDevice()` (otevře port → `serialReadInfo` → `CMD_R` → `cfg` → `render()`), volané buď ze Startu (první gesto), nebo automaticky při reconnectu.

| Akce | Co dělá |
|---|---|
| **Start** (welcome) | `doStart()` → grant serial portu + `loadConfigFromDevice()` → transition na hlavní stránku s reálnými hodnotami |
| **send to device** | `doSend()` → zapíše `cfg` do zařízení přes Web Serial (`CMD_W`) |

**Klíčové funkce:** `loadConfigFromDevice()`, `doStart()`, `onDeviceConnected()`, `showStartBtn()`, `doSend()`

---

### 3.5 Bank Tabs

**Co dělá:** Horizontálně scrollovatelná řada záložek (max. 10 banků). Aktivní banka je zvýrazněná. Tlačítko „+" přidá nový bank.

**Interakce:**
- Klik na záložku → `selectBank(i)` — přepne `activeBank` a překreslí panely
- Tlačítko „+" → `addBank()` — přidá bank s defaultní konfigurací
- Počet banků lze měnit také přes Settings modal (⚙)

**Klíčové funkce:** `renderBankTabs()` (L1487), `selectBank()` (L2065), `addBank()` (L2151), `removeBank()` (L2173). ⚠ `stepBanks()` **odstraněno.**

---

### 3.6 Bank Name Card

**Co dělá:** Řádek pod záložkami — jméno banku, ikona a tagy (labelky pro vyhledávání/přehlednost).

**Komponenty:**
- **Icon picker:** Emoji nebo barevný badge (výběr z předdefinovaných kategorií — nástroje, styly, barvy). Otevírá overlay `#icon-picker`.
- **Name input:** Inline editovatelné jméno banku.
- **Tags:** Volné textové štítky (stiskni Enter pro přidání). Slouží pro orientaci, neodesílají se do zařízení.
- **Smazat bank (✕):** Viditelné jen pokud je více než 1 bank.

**Klíčové funkce:** `onBankRename()` (L2067), `addTag()` (L2085), `removeTag()` (L2095), `openIconPicker()` (L3262), `closeIconPicker()` (L3298)

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

**Klíčové funkce:** `faderSectionContent()` (L1604), `stepCtrl()` (L1986), `onCtrl()` (L1996). ⚠ `onFaderLabel()` **odstraněno.**

---

### 3.8 Encoder Sekce (Articulation Encoder)

**Co dělá:** Otočný enkodér na fyzickém zařízení prochází seznam artikulací (UACC hodnoty). Sekce konfiguruje CC číslo, MIDI kanál a seznam dostupných artikulací.

**UACC (Universal Articulation Control Code):**
Standard pro pojmenování CC hodnot používaný u Spitfire Audio, East West, Orchestral Tools atd. CC 32 je standardní UACC kanál.

Každá artikulace je CC hodnota (0–127) s volitelným pojmenováním (interní slovník `UACC_NAMES`).

**Správa seznamu artikulací:**
- Přidat jednotlivé hodnoty nebo aplikovat přednastavené šablony (Strings, Woodwinds, Brass, atd.)
- Enkodér na zařízení přechází na další/předchozí hodnotu v seznamu

**Klíčové funkce:** `encoderSectionContent()` (L1897), `addUacc()` (L2180), `removeUacc()` (L2191), `addUaccFromPreset()` (L2197), `renderUacc()` (L1916), `uaccName()` (L1361)

---

### 3.9 Advanced Settings (Modal)

Dostupné přes ikonu ⚙ v headeru. Obsahuje:
- **Počet banků** — nastaví počet (1–10), přidá nebo odebere banky
- **Factory reset** — obnoví `DEFAULT_CFG`, vymaže localStorage

**Klíčové funkce:** ⚠ `openModal()` / `closeModal()` / `onBankCount()` **odstraněny** — device/advanced settings teď přes `toggleDeviceSettings()` (L2934).

---

### 3.10 JSON Inspector

Rozbalovací sekce pod hlavním obsahem. Zobrazuje aktuální `cfg` jako formátovaný JSON — užitečné pro debug. Tlačítko Copy zkopíruje JSON do schránky.

Aktivní import/export:
- **Export:** Stáhne `feel-fader-config.json`
- **Import:** Načte `.json` soubor, přepíše `cfg`, překreslí UI

**Klíčová funkce:** `refreshJson()` (L2965), `onImport()` (L2902)

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

Definován na řádku 1412. Obsahuje 3 předdefinované banky (Bank 1–3) s různými CC čísly a kanály. Použije se při prvním spuštění nebo po factory resetu.

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
- Příchozích MIDI CC zprávách ze zařízení (`onMidiMsg()` L2512)
- Draggování fader thumbů v UI (viz `scheduleFaderFrame()` L2414)

---

## 5. Transport (MIDI + Serial)

> Přepsáno 2026-07-12 podle reálného kódu. **Klíčová změna oproti staré verzi doc:** config se **nepřenáší přes MIDI SysEx**. Čtení/zápis konfigurace jde přes **line-based textový protokol po Web Serial**. MIDI slouží už jen k detekci zařízení a k příjmu live hodnot (CC/PC/NoteOn). Starý chunkovaný SysEx (`CMD_CHUNK`/`CMD_ACK`/`enc7`/`sysexWriteConfig`/`sysexReadConfig`) je pryč.

### 5.1 Dvě roviny — kdo co dělá

| Rovina | API | K čemu | Klíčové funkce |
|---|---|---|---|
| **MIDI** | Web MIDI (`requestMIDIAccess({sysex:true})`) | Detekce Feel Faderu; příjem live hodnot (fader CC, encoder CC, bank Program Change, keyswitch NoteOn) | `initMidi` (L2442), `connectInputs` (L2471), `onMidiMsg` (L2512) |
| **Serial** | Web Serial (115200 baud, vendor `0x2E8A` = RP Pico) | **Veškerý přenos configu** — read i write, + device info | `serialRequest` (L2696), `serialReadConfig` (L2749), `serialReadInfo` (L2755), `_serialEnsureOpen` (L2668) |

### 5.2 Detekce a vstup do appky

```
initMidi() (L2442)
  → requestMIDIAccess({sysex:true})  → onstatechange (debounce 400 ms, ignoruje CC churn)
  → connectInputs() (L2471)
      → isFeelFader(name) (L2466): match "feel fader" | "circuitpython audio"
      → inp.onmidimessage = onMidiMsg;  _ffConnected = true
      → onDeviceConnected() (L2828) — rozhodne vstup:
          • serial port už schválený + !dirty → tichý load / sync banner (viz 5.4)
          • port neschválený → ukázat „Start" na welcome (gesto nutné pro requestPort)
          • po skipu → re-welcome
```

> ⚠️ **Neposílat SysEx při detekci.** Původní `_requestDeviceInfoSysex()` byl odstraněn (HW test 2026-07-07): SysEx write přes Chrome/Windows MIDI Services **zasekne MIDI endpoint až do replugu**. Device info se čte serialem (`CMD_INFO`), ne MIDI. Nikdy nevracet SysEx-write do detekce — viz memory `project_feelfader_web_uses_serial`.

### 5.3 Serial protokol (line-based text)

Ne SysEx — prosté textové řádky ukončené `\n`. `serialRequest(cmd, payload, timeoutMs)` (L2696) je **jediné místo, které serial zapisuje**; transakce jsou serializované přes `_txnChain` (jedna naráz).

**Dvě verze rámování** (`protocolVersion`, bootstrapuje `serialReadInfo`):

| Verze | Odchozí řádek | Příchozí odpověď | Párování |
|---|---|---|---|
| **v1** (legacy) | `CMD` nebo `CMD:payload` | první řádek vyhrává | žádné (fire-first) |
| **v2** (rid framing) | `CMD:rid:payload` | `TYP:rid:payload`, `TYP ∈ {CFG,INFO,ACK,ERR}` | podle `rid` (stale/cizí řádky se zahazují) |

- **Command jména** (řetězce, ne byty): `CMD_R`, `CMD_INFO`, `CMD_W`, `CMD_HID`. Konstanty `MFR/DEV_ID/CMD_*` (L2584) drží **jen** MIDI-SysEx vrstva (`handleSysEx`), serial používá stringy.
- **Expect-mapa** (L2709): `{CMD_R:'CFG', CMD_INFO:'INFO', CMD_W:'ACK', CMD_HID:'ACK'}`. `_readReply` (L2717) čeká na řádek typu = expect se správným `rid`; `ERR:*` → reject, timeout → reject.
- **v1 fire-and-forget:** `CMD_W`/`CMD_HID` ve v1 nevrací nic (`serialRequest` vrátí `''`).
- **Port:** `_serialEnsureOpen` (L2668) recykluje session port; auto-connect na dřív schválený port (řadí podle uloženého `usbProductId`, klíč `ff-serial-pid`), jinak `requestPort` filtrovaný na vendor `0x2E8A`. „Busy" chyba = port drží jiný tab/aplikace (viz memory `project_feelfader_serial_port_exclusive`).

### 5.4 CMD_INFO bootstrap + sync detekce

`serialReadInfo()` (L2755): pošle `CMD_INFO` **vždy nejdřív v1 rámcem** (odpoví starý i nový firmware), pak z odpovědi:

- `schema_version >= 2 && config_hash:string` → `protocolVersion = 2`, jinak `1`.
- Uloží `DEVICE_INFO.{firmware, serial, hid_available, hid_enabled, config_hash, config_source}`.
- `applyInfoFaders(info)` nastaví `liveValues` **před** renderem.

Při reconnectu (`onDeviceConnected`, v2) se porovná uložený hash (`ff-last-hash`) s `config_hash` zařízení:

| Stav zařízení | Akce |
|---|---|
| `config_source === 'defaults'` | `showSyncBanner('defaults')` (L2564) — nabídnout push mé konfigurace |
| uložený hash ≠ `config_hash` | `showSyncBanner('differs')` — konfigurace se rozešly |
| shodné / bez hashe | tichý `loadConfigFromDevice()` |

### 5.5 Zápis konfigurace — `doSend()` (L2862)

1. `validate()` (L2330); při chybě stop.
2. `serialRequest('CMD_W', JSON.stringify(cfg), 5000)` (L2868) — celý `cfg` jako JSON, jeden řádek.
3. **v2:** zařízení vrátí `ACK` s novým **config hashem** → uloží se do `ff-last-hash` + `DEVICE_INFO.config_hash`. **v1:** ACK prázdný (fire-and-forget).
4. `cfgSave()`, `dirty=false`, toast „sent".
5. Chyby: `ERR:<reason>` → „Device rejected config" (drží jako unsaved); `timeout` → „No confirmation" (retry); jinak zavře port.

### 5.6 Čtení konfigurace — `loadConfigFromDevice()` (L2781)

`_serialEnsureOpen` → `serialReadInfo` (best-effort) → `serialReadConfig()` (L2749 = `serialRequest('CMD_R', null, 5000)`) → `JSON.parse` → `normalizeFwConfig` → `cfg`, `loaded=true`, `dirty=false`, `cfgSave`, `render`. Volané z `doStart` (welcome gesto, L2808) i tichého reconnectu.

### 5.7 MIDI příjem — `onMidiMsg()` (L2512)

- **CC (0xB0):** porovná s `fader1/2.cc+channel` → `liveValues` + `scheduleFaderFrame`; encoder CC → artikulace/UACC.
- **NoteOn (0x90) na `ks_channel`:** live keyswitch pozice (roller_mode `keyswitch`).
- **Program Change (0xC0):** hardware bank switch → `liveBank`+`activeBank`.
- **SysEx (0xF0):** `handleSysEx` (L2624) — dekóduje `dec7()` (L2590), reaguje jen na příchozí `CMD_W` (config push) a `CMD_INFO`. Toto je jediné zbylé využití SysEx a je pouze **příjem**; app SysEx nikdy neposílá (viz 5.2).

### 5.8 Formát konfigurace: app vs. device

App drží **web formát** (`cfg` — per-control, viz §4), device posílá **interní kompaktní formát**; převod `normalizeFwConfig()` (L2593):

```js
// Device (banks[i]) — interní tvar z CMD_R
{ fader_cc:[cc1,cc2], fader_ch:[ch1,ch2], encoder:cc, encoder_ch:ch,
  uacc_values:[...], roller_mode, ks_notes, ks_channel, nav_keys_cw/ccw,
  m:{ n:name, i:icon, t:tags, l:[label1,label2] } }   // m = prezentační meta
```

- **Prezentační pole** (name/icon/tags/label) čte device z `m{}`; když chybí, `normalizeFwConfig` je drží z dosavadního `cfg` (localStorage) — funkční data ale vždy ze zařízení.
- **Každý ovladač má vlastní MIDI kanál** (`fader_ch[0/1]`, `encoder_ch`); fallback na starý jednokanálový `channel`.
- ⚠️ Tento formát musí zůstat v synchronu s firmwarem — viz `CLAUDE.md` (pravidlo app↔firmware, nikdy společný merge).

---

## 6. Klíčové funkce

> Čísla řádků ověřena proti aktuálnímu souboru 2026-07-12. ⚠ = funkce od 06-27 odstraněna/přejmenována refaktorem (SysEx-chunking → serial request/reply, value bar zrušen) — viz náhrada.

| Funkce | Řádek | Popis |
|---|---|---|
| `render()` | 1473 | Překreslí celé UI podle aktuálního `cfg`. Volá `renderBankTabs()` + `renderPanels()`. |
| `renderBankTabs()` | 1487 | Vykreslí záložky banků. |
| `renderPanels()` | 1525 | Vykreslí sekce aktivního banku (fader1, fader2, encoder). |
| `selectBank(i)` | 2065 | Přepne aktivní bank, překreslí UI. |
| `stepCtrl(bi,key,field,delta)` | 1986 | Změní hodnotu pole (CC/channel) o delta (±1) přes stepper tlačítka. |
| `onCtrl(bi,key,field,val)` | 1996 | Zapíše novou hodnotu do `cfg`, uloží do localStorage. |
| `layoutFaders()` | 2387 | Pozicuje fader tracky na device imagu podle layout konstant. |
| `pF(tid,thid,v)` | 2424 | Pozicuje fader thumb na pixel pozici odpovídající MIDI hodnotě v (0–127). |
| ⚠ `mF()` | — | **Odstraněno.** Drag path refaktorován → `scheduleFaderFrame()` (2414) + `flushFaderFrame()` (2419) + `applyInfoFaders()` (2406). |
| `connectInputs()` | 2471 | Připojí MIDI vstup/výstup Feel Faderu, spustí connect sekvenci. |
| `onMidiMsg(event)` | 2512 | Zpracuje příchozí MIDI zprávy (CC → liveValues, SysEx → handleSysEx). |
| `handleSysEx(data)` | 2624 | Zpracuje příchozí SysEx. |
| ⚠ `sysexWriteConfig(cfg)` | — | **Odstraněno.** Zápis teď `serialRequest('CMD_W', …)` (`serialRequest` 2696, volané z `doSend` 2868). |
| ⚠ `sysexReadConfig()` | — | **Odstraněno.** Nahrazeno `serialReadConfig()` (2749). |
| `doSend()` | 2862 | UI handler pro „send to device" — validuje, pak `serialRequest('CMD_W', …)`. |
| `doStart()` | 2808 | Welcome „Start": grant serial portu + `loadConfigFromDevice()` + transition. |
| `loadConfigFromDevice()` | 2781 | Sdílené: otevře port → `serialReadInfo` → `serialReadConfig` → `cfg` → `render()`. |
| `onDeviceConnected()` | 2828 | Po detekci zařízení: auto-vstup (port schválený) vs Start vs re-welcome. |
| ⚠ `updateStatus()` | — | **Odstraněno.** Nahrazeno `renderConnState()` (2976). |
| `connectTransitionWelcome()` | 3154 | Animovaný přechod welcome screenu při připojení zařízení. |
| `hideWelcome()` | 3207 | Spustí connect transition. Volá `connectTransitionWelcome()`. |
| `skipWelcome()` | 3211 | Okamžitě skryje welcome screen bez animace. |
| `initWelcomeFaderOverlay()` | 3144 | Zkopíruje PNG thumby z hlavního stage na welcome screen overlay. |
| ⚠ `renderFaderVisual()` | — | **Odstraněno** (value bar zrušen — viz komentář na L3007 `setBar`). |
| ⚠ `updateFaderVisual()` | — | **Odstraněno** (dtto). |
| `toggleDark()` | 3090 | Přepne dark/light mode + uloží do localStorage. |
| `initDark()` | 3104 | Načte preferenci dark mode při startu. |
| `applyLang()` | 3076 | Aplikuje překlady (data-i18n atributy). Aktuálně pouze EN. |
| `validate()` | 2330 | Validuje `cfg` — kontroluje duplicitní CC/kanál kombinace. |
| `openIconPicker(bi, mode)` | 3262 | Otevře overlay pro výběr ikony banku. |
| `onImport(e)` | 2902 | Importuje JSON konfiguraci ze souboru. |
| `refreshJson()` | 2965 | Aktualizuje JSON inspector. |
| `toast(t, m)` | 3008 | Zobrazí dočasné notifikační hlášení (success/error/info). |
| `cfgSave()` | 1432 | Uloží `cfg` do localStorage. |
| `cfgLoad()` | 1440 | Načte `cfg` z localStorage, vrátí null pokud neexistuje. |

---

## 7. Fader Layout — Konstanty

Definovány na řádku 2385:

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

Překlady jsou definovány v JS objektu `TRANSLATIONS` (řádek 3018; dřív dokumentováno jako `STRINGS`) a aplikovány přes `t(key)` (L3071) + `applyLang()` (L3076) na elementy s atributem `data-i18n="key"`. `currentLang` (L3069) je natvrdo `'en'`.

Aktuálně podporován pouze **anglický jazyk**. Česká lokalizace není implementována — appka je primárně pro mezinárodní uživatele.

---

*Naposledy aktualizováno: 2026-07-12 (přidána §0 Design System Contract; čísla řádků srovnaná proti 3 466ř. souboru; odstraněné funkce označeny ⚠; §5 Transport kompletně přepsána podle reálného serial protokolu)*
