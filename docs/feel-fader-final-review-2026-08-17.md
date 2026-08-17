# Feel Fader — Finální kontrola kódu (app + firmware): 2026-08-17

> **Vlna 1 a vlna 3 provedeny 2026-08-17 (TDD, viz commit historie).**
> Shrnutí dole pod nadpisy "Stav vlny 1" a "Stav vlny 3". Zbytek dokumentu
> je původní diagnostický audit beze změny.
>
> Diagnostický, read-only re-audit navazující na
> `feel-fader-structure-audit-2026-07-20.md`. Cíl: co nejvíc zjednodušit a
> vyčistit kód při zachování plné funkčnosti a plynulého (seamless) UX.
> Žádné zásahy do kódu v této fázi — o dalších krocích rozhoduje Frank.
>
> Metoda: 4 paralelní subagenti (App dead code + duplicity, App
> doc-vs-kód drift, Firmware struktura, Protokol konzistence +
> bezpečnost + test coverage), každý re-verifikoval příslušné nálezy
> z 07-20 a hledal nové. `feel-fader.html` mezitím narostlo z 5821 na
> 8001 řádků; firmware prošel od 07-20 rozsáhlým refaktorem, který
> přímo cílil na audit nálezy (17 z posledních 20 commitů).

## Executive summary

1. **07-20 audit z velké části zabral.** Firmware: `A-4` (rozlitá hlavní
   smyčka) i `A-5` (duplicitní normalizace bank) jsou vyřešené čistými
   refaktory, `SEC-002`, `D-1` až `D-3`, `D-5` a většina `DOC-*` jsou
   pryč. Testovací pokrytí vzniklo z ničeho: app `npm test` běží 587+
   probes, firmware má 105 pytest testů (`TC-1` až `TC-4` resolved).
2. **Nový P0 nález — stejná třída chyby jako loni, jiná pole.**
   `normalizeFwConfig()` sanitizuje `cc`/`channel`/`uacc_values`/
   `ks_notes`, ale ne `roller_mode`/`ks_channel`/`ks_velocity` — ty
   samé o dva řádky dál padají nesanitizované do `innerHTML`
   (`SEC-004`). Spoofnutá device odpověď nebo JSON import může vložit
   DOM XSS. Oprava je triviální (stejné helpery, `S` náročnost) a
   nedotýká se protokolu — doporučuju vyřešit hned, nezávisle na tom,
   kterou vlnu zvolíš.
3. **Přesně ten typ nekonzistence, na který ses ptal (\"seamless\"), pořád existuje — a 08-17o sweep jednu instanci sám vytvořil.** `A-1` (stepper markup 3× duplicitně), `A-2` (`validate()` počítaný 9× na render, bylo 4×) a `A-3`
   (`setRollerMode()` obchází render pipeline) jsou beze změny. K tomu
   nový vizuální nález: `.roller-mode-content` má opacity na tokenu
   (`--dur-fast`, .16s) ale transform pořád na literálu (.22s) —
   `setRollerMode()`'s `setTimeout(...,160)` vymění obsah v půlce
   transformu (`CL-1`). A 3 ze 7 skupin, které 08-17o changelog hlásí
   jako "sjednocené", jsou sjednocené jen hodnotou, ne sdíleným
   tokenem — bez ochrany proti budoucímu re-driftu (`CL-2`).
4. **Dokumentace zaostává za rychlým vývojem, ne za nedbalostí.**
   `WEBAPP.md`'s Motion sekce (§0, samotný "design contract") nezná
   nový tokenový systém, který sama app o pár týdnů později zavedla
   (`DOC-009`); cituje neexistující funkci `initWelcomeFaderOverlay()`
   (`DOC-008`); a tvrdí 3 onboarding slidy místo 4 (`DOC-010`).
   Vlastní datum aktualizace si teď protiřečí (banner 08-16, patička
   07-20 — `DOC-011`).
5. **Mrtvý kód se dál hromadí, ale pomaleji.** CSS kleslo ze 61 na 43
   nepoužitých tříd (~11 %, `D-4`), z toho celá osiřelá komponenta
   `.bank-name-row`/`.bank-name-lbl`/`.bank-name-top` (`D-7`) — živý
   markup používá jen `.bank-name-input` přímo.
6. **Firmwarová strana `SEC-003` (slabá SysEx identifikace) je pořád
   otevřená na obou stranách** — app substring-match (`isFeelFader`)
   i firmware fixed-constant gate. Riziko je nižší než loni (SysEx
   write cesta je pryč), ale ne nulové — spoofnutý `CMD_INFO` pořád
   může zapsat cizí `localStorage` klíč a vynutit `render()`.

## Tabulka nálezů — nové a otevřené

| ID | Osa | Popis | Umístění | Sev/Náročnost | Protokol ⚠️ | Vlna |
|---|---|---|---|---|---|---|
| SEC-004 | Bezpečnost | `roller_mode`/`ks_channel`/`ks_velocity` chybí clamp v `normalizeFwConfig()`, dojde nesanitizované do `innerHTML` | `feel-fader.html:3432,3482,3528,5000-5029,7868` | **P0/S** | | 1 (přednostně) |
| A-1 | Architektura | Stepper markup duplikovaný na 3 místech | `feel-fader.html` `faderSectionContent` L3247, `ccEncoderBody` L3287, `keyswitchBody` L3419 | P2/M | | 3 |
| A-2 | Architektura | `validate()` počítaný redundantně 9× na render (bylo 4×) | `feel-fader.html` 9 call sites (L3248…5347) | P2/M | | 3 |
| A-3 | Architektura | `setRollerMode()` obchází render pipeline, mutuje DOM přímo | `feel-fader.html:3799-3838` | P2/M | | 3 |
| A-6 | Architektura (firmware) | UID→hex string konverze duplikovaná ve 2 funkcích | `code.py:342-347` vs `457-460` | P3/S | | 1 |
| CL-1 | Motion/UX | `.roller-mode-content` opacity na tokenu, transform na literálu (.22s) — `setTimeout(160)` uřízne transform v půlce | `feel-fader.html` CSS L545, JS L3829 | P1/S | | 1 |
| CL-2 | Motion/UX | 3 z 7 "sjednocených" timing skupin (bank-card/name-row, modal overlay/panel, hid-switch) sdílí hodnotu, ne token — bez ochrany proti re-driftu | `feel-fader.html` L488,496,680,1968 · L981,983 · L844-845 | P2/M | | 1 |
| D-4 | Dead code | 43/392 (~11 %) CSS tříd bez výskytu mimo `<style>` (bylo 61) | `feel-fader.html` `<style>` L18-2215 | P2/M | | 1 |
| D-7 | Dead code | Celá osiřelá komponenta `.bank-name-row`/`-lbl`/`-top` + panel-row/btn-group/status-row klastr | `feel-fader.html` L472,515-516,680,688,824,867,943,947,1968,1978 | P2/M | | 1 |
| SEC-003 | Bezpečnost | SysEx "identifikace" zařízení stále substring/fixed-constant match, ne autentizace | app `feel-fader.html:4848-4851`, firmware `code.py:403-411` | P2/M | ⚠️ | 3 |
| DOC-004 | Doc drift | §8 i18n `TRANSLATIONS` řádkový odkaz off by +2868 řádků | `WEBAPP.md` L595 | P2/S | | 1 |
| DOC-005 | Doc drift | Firmware `CLAUDE.md:115` pořád `_parse_banks` (fallback-compat věta, hlavní zmínka už opravená) | firmware `CLAUDE.md:115` | P3/S | ⚠️ | 1 |
| DOC-008 | Doc drift | `WEBAPP.md` 2× cituje neexistující `initWelcomeFaderOverlay()` | `WEBAPP.md` §2 L118, §3.1 L179 | P1/S | | 1 |
| DOC-009 | Doc drift | §0 Motion nezná nový `--dur-*`/`--ease-*` tokenový systém (90+ použití) | `WEBAPP.md` §0 L49-58 | P1/M | | 1 |
| DOC-010 | Doc drift | §3.1 tvrdí 3 onboarding slidy, `_ONB_BEATS` má 4 | `WEBAPP.md` §3.1 L173 | P2/S | | 1 |
| DOC-011 | Doc drift | Banner "Stav (2026-08-16)" vs patička "Naposledy aktualizováno: 2026-07-20" — protiřečí si | `WEBAPP.md` header/footer | P3/S | | 1 |
| DOC-012 | Doc drift (firmware) | `CMD_HID` je reálný handled command, chybí v SysEx tabulce (je jen v serial tabulce) | firmware `CLAUDE.md:83-90` vs `code.py:76,431-436` | P2/S | | 1 |
| PR-003 | Protokol konzistence | `faders` sync-on-connect stále neaplikovaný na SysEx `CMD_INFO` cestě — nyní zdokumentováno jako akceptovaný gap, ne bug | app `feel-fader.html:5069-5085`, firmware `CLAUDE.md:63` | P3/S | ⚠️ | 3 (jen pokud chceš dořešit) |
| TC-5 | Test coverage | ADC čtecí funkce bez testů (uznaný, neopravitelný gap) | firmware `code.py` | P3/S | | — |

**Vyřešeno od 07-20** (re-verifikováno, není nutné dál sledovat): `A-4`,
`A-5`, `DOC-001`, `DOC-002`, `DOC-003`(base), `DOC-006`, `DOC-007`,
`D-1`, `D-2`, `D-3`, `D-5`, `D-6`, `PR-001`, `SEC-001`(hlavní pole),
`SEC-002`, `TC-1`, `TC-2`, `TC-3`, `TC-4`.

## Stav vlny 1 (provedeno 2026-08-17)

Všech 13 položek vlny 1 hotovo, TDD kde šlo o změnu chování:

- **`SEC-004`** (P0) — `normalizeFwConfig()` "already-normalized" větev i
  `applyLibraryPreset()` teď clampují `roller_mode`/`ks_channel`/
  `ks_velocity` stejně jako sousední pole. RED→GREEN ověřeno na dvou
  vektorech (JSON backup import s reálnou DOM XSS exekucí přes
  `<img onerror>` breakout `data-mode` atributu, custom preset).
  Regrese: `scratch/audit/p1-xss-config-import.mjs` (+5 assercí),
  `scratch/validation-clamp-probe.mjs` (+3 assercí).
- **`CL-1`** — `.roller-mode-content` transform sjednocen na `--dur-fast`
  (dřív `.22s` literál vs. opacity na tokenu — `setRollerMode()`'s
  `setTimeout(160)` uřezával posledních 60ms tranzice). Nová regrese:
  `scratch/roller-mode-timing-sync-probe.mjs`.
- **`CL-2`** — 3 nové sdílené tokeny (`--dur-modal`, `--dur-switch`) pro
  modal overlay/panel a hid-switch track/thumb. `--dur-card` (bank-card/
  name-row) zaveden a pak zrušen — ukázalo se, že `.bank-name-row`
  (druhá strana páru) byla mrtvý kód (viz D-7), pár tedy fakticky
  neexistoval; `.bank-card.bank-anim` vrácen na literál `.18s`.
- **`D-4`, `D-7`** — 50 nepoužitých CSS tříd smazáno (ne 43 — nezávislé
  přepočítání script em s opravou dvou chyb v prvním pokusu — komentáře
  v `<style>` a compound selektory — potvrdilo 50, ne 43 ani prvotních
  52). Celá osiřelá `.bank-name-row`/`.bank-name-lbl`/`.bank-name-top`
  komponenta i `.h-badge`/`.dev`/`.prod` (header verze badge), `.advanced-*`
  (staré advanced menu), `.artic-*` (stará articulation display), `.vbar-*`,
  `.s-dot` + osiřelá `@keyframes pg`/`fadeSlideIn` odstraněny. Nezávisle
  ověřeno: 0 zbylých mrtvých tříd po úklidu.
- **`A-6`** — `_device_serial_hex()` sdílený helper ve firmwaru
  (`code.py`), nahrazuje 2 kopie stejné UID→hex konverze.
- **`DOC-004`, `DOC-005`, `DOC-008`, `DOC-009`, `DOC-010`, `DOC-011`,
  `DOC-012`** — opraveno ve `WEBAPP.md` a firmware `CLAUDE.md`.

**Ověření:** app `npm test` 587 passed / 1 pre-existing (nesouvisející,
stejné jako baseline), firmware `pytest tests/` 105 passed — žádná
regrese oproti stavu před vlnou 1.

**Nerozhodnuto / mimo vlnu 1:** `A-1`, `A-2`, `A-3`, `SEC-003`, `PR-003`
čekají na vlnu 3 (Frankovo rozhodnutí).

## Quick wins (vysoký dopad / náročnost S)

- **`SEC-004`** — přidat 3 chybějící `clampChannel`/`clampCc`/enum-check
  řádky do `normalizeFwConfig()` a `applyLibraryPreset()`, mirror
  existujících sousedních polí. Žádná nová sanitizační primitivum.
- **`CL-1`** — sjednotit `.roller-mode-content` transform na
  `--dur-fast`/existující opacity token; `setRollerMode()`'s
  `setTimeout` hodnotu odvodit ze stejného zdroje (ne druhý literál).
- **`DOC-008`, `DOC-010`, `DOC-011`** — 3 drobné textové opravy ve
  `WEBAPP.md`.
- **`A-6`** — sjednotit duplicitní UID→hex helper ve firmwaru.
- **`D-4`, `D-7`** — smazat 43 nepoužitých CSS tříd + osiřelou
  `bank-name-row` komponentu.

## Návrh vln

**Vlna 1 — bezpečné, žádný dotek protokolu (doporučuju spustit celou):**
`SEC-004` (přednostně, je to bezpečnostní díra), `CL-1`, `CL-2`, `D-4`,
`D-7`, `A-6`, `DOC-004`, `DOC-005`, `DOC-008`, `DOC-009`, `DOC-010`,
`DOC-011`, `DOC-012`.

**Vlna 2 — test coverage:** beze zbytku vyřešena minulou vlnou (`TC-1`
až `TC-4` resolved). Jediný zbývající gap (`TC-5`, ADC čtení) je
uznaný jako neopravitelný — nic k naplánování.

**Vlna 3 — strukturální/protokolové (⚠️, chtějí tvé rozhodnutí):**
- `A-1` — sdílený template/helper pro stepper markup (3 místa →
  jedna funkce). Čistě interní refaktor, chování beze změny.
- `A-2` — memoizovat/deduplikovat `validate()` volání na jeden render
  cyklus (9 → ideálně 1).
- `A-3` — přepojit `setRollerMode()` do standardní render pipeline
  místo přímé DOM mutace.
- `SEC-003` — přepracovat SysEx trust model na obou stranách (app
  `isFeelFader`, firmware `handle_sysex` gate). Nejvyšší riziko/dopad
  v této vlně — vyžaduje rozhodnutí o novém trust modelu, ne jen fix.
- `PR-003` — jen pokud chceš doimplementovat `faders` na SysEx cestě;
  jinak nechat jako zdokumentovaný gap (už je).

Test baseline před zahájením jakékoli vlny: app `npm test` 587
passed / 1 pre-existing (nesouvisející, viz `docs/TODO.md` Otevřené),
firmware `pytest tests/` 105 passed.

## Stav vlny 3 (provedeno 2026-08-17)

- **`SEC-003`** — hotovo, oba konce. Firmware `handle_sysex()` zúžen jen na
  `CMD_R`/`CMD_INFO`; `CMD_W`/`CMD_HID` přes SysEx teď ignorovány beze
  změny stavu a beze ACK/ERR odpovědi (žádné orákulum na probing) —
  zavřeno riziko cizí SysEx mutace configu/HID flagu/restartu bez ohledu
  na to, jak dobře sedí veřejné MFR/DEV_ID konstanty. Mrtvý kód po
  zúžení smazán (`apply_hid_request`, `send_ack`, `send_err`). App
  `isFeelFader()` — na Frankovo přání smazán `'circuitpython audio'`
  fallback (produkt ještě nevydán, žádná instalovaná báze starého
  firmwaru, fallback navíc omylem matchoval libovolné cizí CircuitPython
  zařízení). Regrese: `tests/test_sysex_readonly.py` (firmware, 4 nové
  testy), `scratch/is-feel-fader-probe.mjs` (app, nový probe).
- **`A-1`** — hotovo. Sdílený `stepperFieldHtml()` helper nahradil
  duplicitní stepper markup na 6 místech (fader1/fader2 channel+cc,
  encoder channel+cc, keyswitch channel, keyswitch velocity). Ověřeno
  porovnáním vyrenderovaného HTML před/po (identické až na dvě
  `aria-label` velikosti písmen, neškodné).
- **`A-2`** — **vráceno zpět, neprovedeno.** Zkusil jsem mikrotaskovou
  cache pro `validate()` (redukce 9 volání na 1 za render cyklus), ale
  existující regresní test (`validation-clamp-probe.mjs`) přesně
  simuluje bezpečnostně kritický vzor — synchronní `cfg` mutace mezi
  dvěma voláními `validate()` v jednom ticku — a cache to pokazila
  (stará, neplatná chyba přežila i po opravě configu). Skutečný přínos
  (funkce je levná, pár desítek iterací) nestál za riziko stale-cache
  bugu v bezpečnostně citlivé cestě. `validate()` je beze změny.
- **`A-3`** — **doporučeno přeskočit, neprovedeno.** `setRollerMode()`
  obchází `render()` záměrně: kdyby přes něj šel, `.roller-mode-row`
  by se přestavěl jako nový DOM uzel a rozbil by plynulý slide efekt
  přepínacího jezdce (CSS `transform` transition nemá odkud animovat na
  čerstvě vytvořeném elementu). Doslovná realizace nálezu by šla proti
  hlavnímu požadavku na "seamless" UX; skutečná oprava (částečný DOM
  diff v `render()`) je mnohem větší zásah, než na jaký je vlna 3
  dimenzovaná.
- **`PR-003`** — nevyžádáno, zůstává jako zdokumentovaný akceptovaný gap
  (beze změny od 07-20).

**Ověření:** app `npm test` 603 passed / 1 pre-existing (stejné jako
baseline), firmware `pytest tests/` 107 passed. Nic nepushnuto kromě
double-press feature (samostatný, Frankem už otestovaný commit) —
zbytek čeká na review.
