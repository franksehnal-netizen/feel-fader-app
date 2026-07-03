# Feel Fader — UX/polish pass (design)

**Datum:** 2026-07-01
**Soubor, kterého se to týká:** `feel-fader.html` (single-file HTML/JS konfigurátor)
**Rozsah:** 11 dílčích UX/polish úprav z jednoho review. Žádná změna drátového protokolu ani firmwaru.

---

## Kontext

`feel-fader.html` je jednosouborový konfigurátor MIDI controlleru. Config (`cfg`) drží pole `banks[]`;
každá banka má `name`, `icon`, `tags[]`, `fader1`, `fader2`, `encoder`, `roller_mode`
(`cc` / `keyswitch` / `track_nav`) a navigační klávesy. `cfg` se ukládá do `localStorage`
(`LS_CFG_KEY`) **a** posílá celý jako JSON do zařízení (`CMD_W`), takže `name`/`icon`/`tags`
persistují na obou místech. Přepínání bank na HW je **tlačítkem cyklením**.

Tento pass je čistě prezentační/UX vrstva — data model ani protokol se nemění (jediná výjimka:
snížení konstanty `MAX_BANKS`).

---

## Rozhodnutí (11 bodů)

### 1. Tagy — návrhy z historie místo fixního seznamu
- **Teď:** `renderPanels()` má natvrdo `tagSuggestions` (SF, EW, Spitfire, Kontakt…) v `<datalist>`.
- **Cíl:** `datalist` plnit dynamicky — sjednocení všech `tags` napříč `cfg.banks[]`, minus tagy
  už přítomné na aktivní bance. Prázdné pole = žádné návrhy (žádný fallback na značky).
- Tag input zůstává volný text (beze změny mechaniky zadávání).
- **Poznámka:** persistence potvrzena, ikona zůstává.

### 2. L/R fader caption
- **Teď:** `faderSectionContent()` má editovatelný `panel-name-input` (default Expression/Dynamics),
  ale nic neoznačuje fyzický levý/pravý fader.
- **Cíl:** fixní, needitovatelný nadpis nad názvem sekce: `LEFT FADER` pro `fader1`,
  `RIGHT FADER` pro `fader2`. Malý, `--t3`/muted, uppercase. Slouží zároveň jako kotva pro bod 9.

### 3. Zarovnání macro long-press tlačítka
- **Teď:** „Button macro (long-press)" řádek je v `info-grid`; tlačítko `#macro-capture` má vlastní
  inline padding/border → nesedí s ostatními `info-val`.
- **Cíl:** CSS úprava tak, aby tlačítko lícovalo na stejnou pravou hranu / baseline jako ostatní
  `info-row` hodnoty. Čistě vizuální.

### 4. Snížení stropu bank
- **Teď:** `const MAX_BANKS = 10;`
- **Cíl:** `MAX_BANKS = 8`. Přepínání tlačítkem cyklením → víc než ~8 je nepohodlné. Žádná další
  logika se nemění (guardy `addBank`, `setBanks`, `stepBanks` čtou konstantu).

### 5. Roll up/down kapitálky + zarovnání INVERT
- **Teď:** v `trackNavBody()` jsou `field-label` „roll up"/„roll down" malými písmeny; `INVERT` je
  holý checkbox mezi dvěma paddovanými tlačítky → „plave".
- **Cíl:**
  - Popisky → `ROLL UP` / `ROLL DOWN` (konzistence s `MIDI CHANNEL`, `INVERT`).
  - `INVERT` field-block srovnat: label na stejný řádek jako u ostatních, checkbox vycentrovat na
    výšku capture tlačítek (aby nadpisy tří bloků byly na jedné lince).

### 6. Roller status/titul mode-aware
- **Teď:** `encoderPanel()` má napevno titul „Articulation Encoder" a `enc-artic-badge` ukazuje
  `uaccName(bankUacc[0])` (např. „legato") ve **všech** režimech, i v Track nav.
- **Cíl:** badge i titul reflektují `roller_mode`:
  - `cc` → název artikulace (jako dnes),
  - `keyswitch` → nic / relevantní popisek (ne artikulace),
  - `track_nav` (nově „Navigation") → nic.
- Řeší stálé „legato" v jiných režimech. (Provázáno s bodem 7.)

### 7. Přejmenování
- Režim `track_nav`: label „Track nav (HID)" → **„Navigation (keys)"** (v `labels` mapě v
  roller-mode-row). `roller_mode` klíč `track_nav` v datech **zůstává** (jen UI label).
- Titul panelu „Articulation Encoder" → **„Roller"** (mode-neutrální; režim určují tlačítka pod ním).

### 8. Help / Guide sekce
- **Cíl:** nová collapsible sekce **pod** panelem „Device & Settings" (bod 10), stejný vzor jako
  stávající `advanced-wrap` (toggle + collapsible body).
- Obsah (statický text): Getting started, Banks & tags, Roller modes (Articulation / Keyswitch /
  Navigation), Keyboard (HID), přepínání bank na zařízení.

### 9. Obousměrné hover propojení fader ↔ sekce
- **Cíl:** hover nad levým faderem ve živé vizualizaci (`track-l`/`thumb-l`) zvýrazní sekci
  `LEFT FADER` (fader1) a naopak; totéž pro pravý. Zvýraznění = jemný `--red` accent
  (border/glow) na kartě sekce.
- **Obousměrně:** hover nad sekcí zvýrazní i odpovídající fader ve vizualizaci.
- Implementace přes CSS třídu/`data-` atribut spárovaný mezi vizuálem a sekcí; přežije `render()`.

### 10. Sloučení Device Info + Advanced → „Device & Settings"
- **Teď:** dva sousední collapsible panely.
- **Cíl:** jeden collapsible panel **„Device & Settings"** se dvěma vizuálně oddělenými
  podskupinami (divider + malý nadpis):
  - **Device:** Product / Manufacturer / Firmware / Serial + HID toggle + Button macro.
  - **Preset & data:** Export / Import / Reset + JSON preview.
- Jeden toggle. Pořadí: identita → nastavení → operace s daty.

### 11. Plynulé přechody
- **Teď:** přepnutí tématu překlápí CSS proměnné skokem (žádná transition na barvě); `render()`
  přestaví `innerHTML` → nové uzly problikávají.
- **Cíl:**
  - **Theme toggle:** při přepnutí přidat na `<html>` dočasnou třídu (`.theming`), pod kterou se
    aplikuje cross-fade `background-color` / `color` / `border-color` (~0.45s ease), a po
    doběhnutí třídu odebrat. Mimo přepnutí se běžné interakce nezpomalují.
  - **Změna banky:** jemná fade-in animace na `.bank-card` (a `bank-name-area`), aby re-render
    nebliknul. Krátká (~0.15–0.2s), automaticky se přehraje při každém `render()`.

---

## Co se NEmění

- Drátový protokol (`CMD_R/W/INFO/HID`, SysEx i serial JSON cesta), `cfg` schéma, firmware.
- Chování persistence (localStorage + device write) — jen se potvrzuje.
- Logika přidávání/mazání bank (mimo číselnou konstantu stropu).

## Rizika / okrajové případy

- **Bod 11 fade na theme:** transition na `color`/`background` nesmí nechtěně zpomalit hover stavy —
  proto scoped `.theming` třída jen po dobu přepnutí, ne trvalá globální transition.
- **Bod 11 bank fade:** animace na `.bank-card` se nesmí prát s live update thumbů (fadery mají
  vlastní `transition:top`); animujeme jen opacity karty, ne vnitřní pohyblivé prvky.
- **Bod 6/7 mode-aware titul:** badge se aktualizuje i z příchozího MIDI (`setTxt('enc-artic-badge')`)
  — v ne-CC režimech tuto aktualizaci potlačit, ať se badge nevrátí.
- **Bod 9 hover link:** párování musí přežít `render()` (rebuild innerHTML) — vázat přes stabilní
  selektory/`data-fader` atributy, ne přes JS reference na staré uzly.
- **Bod 1 tagy:** deduplikace (case-insensitive?) — návrhy sjednotit bez duplicit; rozhodnout, zda
  porovnávat case-insensitive (doporučeno ano, zobrazit první výskyt).
