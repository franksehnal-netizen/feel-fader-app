# Feel Fader — Web App Reference

Interní dokumentace pro Franka a Ivana. Popisuje aktuální stav appky — funkční popis UI i technické detaily implementace.

> ℹ️ **Stav (2026-08-17):** `feel-fader.html` je jediný zdroj pravdy a nemá
> build krok. CSS, JS, fonty i obrázky jsou vložené přímo v něm. Odkazy používají
> jména funkcí a selektorů, ne čísla řádků. **§5 (transport)** popisuje reálný
> line-based serial protokol, ne historickou MIDI SysEx cestu.

---

## 0. Design System — Contract

> **Invariant:** Barvy, radii a stíny **jen přes tokeny** (`var(--…)`), nikdy hardcoded hex/rgba v komponentě. Motion drží `ease` a durationy z tabulky níže. Kdo tohle poruší, rozbije vizuální jazyk — i když to lokálně „vypadá OK". Tokeny žijí v `:root` (světlý) + `html.dark` (tmavý) na začátku inline `<style>`.

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
| `--red` / `--red2` | **Brand / primary** – hlavní CTA (Send, Apply), výběr (klaviatura, aktivní stepper), capture stav + hover | `#e45745` / `#d44736` | stejné |
| `--danger` / `--danger-bg` | Chyba, validace, **destruktivní akce** (Reset = outline + `--danger` text přes `.ui-danger`) | `#b42318` / `.08` | `#ff7566` / `.10` |
| `--focus` | Viditelný keyboard focus ring | `#4f7cff` | `#7d9cff` |
| `--control-glass-bg` / `--control-glass-border` | Plochá výplň kompaktních controls (od 2026-09-26 = `--bg-input`, bez okraje) | `var(--bg-input)` / `transparent` | `var(--bg-input)` / `transparent` |
| `--control-glass-shadow` / `--control-glass-shadow-hover` | `none` (plochý styl) | `none` | `none` |
| `--green` | Success **fill/tečka** (na neutrálu) | `#34c759` | stejné |
| `--green-text` | Success **text** (na barvě) | `#1e8237` | `#5dd47a` |
| `--green-bg` / `--green-border` | Success plocha / okraj | `rgba(52,199,89,.10)` / `.32` | stejné |
| `--amber` | Warning | `#e6a23c` | stejné |
| `--piano-white` / `--piano-black` | Klávesy keyswitch klaviatury | `#fbfbfd` / `#303036` | `#d8d8dc` / `#202024` |
| `--shadow` / `--shadow-sm` | Elevace | dvouvrstvá | tmavší varianta |
| `--shadow-hud` | Jemné zvednutí plovoucího HUD – jediný stín na ploché ploše | `0 8px 24px rgba(0,0,0,.06)` | `0 8px 24px rgba(0,0,0,.35)` |
| `--highlight-section-fill` | Neutrální tónování sekce propojené s ovladačem na fotce – zelená je jen live | `color-mix(in srgb,var(--t1) 4%,transparent)` | `color-mix(in srgb,var(--t1) 6%,transparent)` |

> 🪤 **Past — `--green` vs `--green-text`:** `--green` (#34c759) je jasná zelená pro **fill/tečku** na neutrálním pozadí. Pro **text** (hlavně na `--green-bg`) použij VŽDY `--green-text`, které je ztmavené (light) / zesvětlené (dark) kvůli kontrastu. `--green` jako barva textu = nečitelné na světlém, špatný kontrast — nedělat.

### Sdílené control primitivy

Kompaktní interaktivní prvky skládají tři znovupoužitelné třídy: `.ui-control` sjednocuje hover/active/disabled chování, `.ui-pill` tvar a `.ui-glass` theme-aware povrch – od 2026-09-26 plochá výplň (`--bg-input`, bez filtru/okraje/stínu), ne frosty glass. Skutečný `backdrop-filter` (glass) zůstal jen v hlavičce (`header`/`.top-sticky` chrome) a v overlays/dialozích (`.modal`, `.icon-picker-*`, `.change-popover`, `.quick-setup-menu` pro RANGE PRESET, toasty, sync banner, welcome/onboarding). `.ui-danger` je destruktivní varianta: plochá výplň, `--danger` text a obrys, nikdy červená výplň jako CTA (UX audit 2026-09-25, K-4; `.ui-primary` byla odstraněna strukturním auditem 2026-07-20, D-5). **Boolean nastavení** jsou vždy switch `.hid-switch` (label > skrytý `input[type=checkbox]` + `.hid-switch-track`); nativní checkbox se nepoužívá (K-1). **Zachytávání kláves** (Navigation, Button macro) je `.ui-keycap ui-control ui-pill ui-glass` se stavy `.is-empty` („Not assigned") a `.capturing` („Press keys…") (K-2). Tento kontrakt používají quick actions, onboarding, change history, bank actions, icon picker a kontextová nápověda. Stepper values, keyswitch bounds, roller segment, HID toggle, aktivní bank fill a sequence chipy používají stejné `--control-glass-*` tokeny i tam, kde kvůli vlastní struktuře nepoužívají utility třídy – jména tokenů zůstala, jen jejich hodnota je teď plochá. Aktivní plochy, které by na `--bg-input` zmizely (roller segmented thumb, C-2/C-1 aktivní, editovaný bank tab), mají explicitní `--bg-card` pill s hairline. Globální `:focus-visible` používá výhradně `--focus`; starý mouse-focus reset backgroundu byl odstraněn. Zelená jen pro live signál (glow na fotce, tečka banku na zařízení, live řádek roller order) a success stavy. Výslovná výjimka: zapnutý (checked) track `.hid-switch` zůstává zelený i mimo live/success – zavedená konvence „enabled toggle = acknowledged" (controller ruling, final review 2026-09-26).

### Radii

`--r-sm: 6px` (badge, malé prvky) · `--r: 12px` (karty, inputy) · `--r-lg: 18px` (velké kontejnery) · `--r-pill: 999px` (tečky, scrollbar, pills). Žádná jiná hodnota v UI; výjimkou je jen geometrie hardwaru (`.ctrl-zone`, `#zone-roller` glow, `.welcome-flash`, spodní rohy černých kláves), která kopíruje fyzický tvar zařízení. Hlídá `scratch/design-consistency-probe.mjs`.

### Motion

Sdílené CSS custom properties (`:root`, feel-fader.html ~87-106) — **kdykoliv
se na jednu akci mění víc věcí současně, musí sdílet stejný token**, jinak
vznikne nekonzistence (viz `docs/feel-fader-final-review-2026-08-17.md` CL-1/CL-2).

**Křivky:**
- `--ease-out` — `cubic-bezier(.16,1,.3,1)` — house ease-out, panel/strukturální pohyb
- `--ease-hero` — `cubic-bezier(.22,1,.36,1)` — success/glow momenty
- `--ease-settle` — `cubic-bezier(.22,.8,.2,1)` — snap-into-place dosednutí

**Délky:**
- `--dur-press` `.1s` — stisk/scale feedback
- `--dur-fast` `.16s` — malé state/visibility přepínače
- `--dur-base` `.3s` — výchozí cross-fade
- `--dur-glow` `.46s` — hero glow/success
- `--dur-settle` `.72s` — settle/shimmer
- `--dur-stage` `1.1s` — velká panelová choreografie
- `--dur-reveal` `.6s` — post-connect Send button + live HUD reveal (musí dosednout spolu)
- `--dur-modal` `.18s` — modal overlay fade-in + panel slide-up
- `--dur-switch` `.22s` — hid-switch track + thumb

Jednorázové dekorativní rytmy (idle fader dýchání, status pulse, capture
pulse, setup cue) zůstávají literály — nejsou součástí žádné souběžné
skupiny, tokenizace by tam nic nesjednotila.

Žádný spring/bounce/overshoot mimo tuto rodinu. Nepřidávat spring/bounce
easing ani durationy > `--dur-stage` pro UI feedback — láme to „klidný,
přesný" charakter appky.

### Typografie

- **Mulish** — veškeré UI (base `13px`).
- **Technické tokeny** – Ch/CC a noty v souhrnech sekcí (`.section-summary-meta`), značky L/R, HUD a diagnostika – jsou od 2026-09-29 **Mulish 600** s `tabular-nums` (čísla HUD 700); od prózy souhrnů (`.section-summary-label`, „17 articulations“, Mulish 400) je odlišuje jen tloušťka. Monospace (2026-09-28 DM Mono místo IBM Plex Mono) Frank zrušil kvůli zakroucenému „f“ v DM Mono; běžná čísla (ROLLER ORDER, klaviatura, FROM/TO, steppery) byla v Mulish už od N-9. Jednotný formát tokenů je „Ch 1 · CC11“ (bez mezery v „CC11“); jen 144px HUD používá úsporné „Ch1·CC11“. Rozsah not se píše „C0 → G0“ (v HUD „C0→G0“), nikdy s en-dash, který v monospace splýval s mínusem u záporné oktávy (N-8). CSP povoluje jen `data:` fonty – jediný vložený font je Mulish.
- Velikosti jen přes tokeny (K-3, 2026-09-25): `--fs-xs 10` · `--fs-sm 11` · `--fs-md 12` · `--fs-base 13` · `--fs-lg 14` · `--fs-xl 16` · `--fs-2xl 20` · `--fs-3xl 22` · `--fs-display 20` (jen název banky v hlavičce karty, `.bank-title-input`; 32 → 20 px 2026-09-28). Kompromis velikostí 2026-09-28 (redesign zvětšil text proti `main`): názvy sekcí a `group-row` 14 px (`--fs-lg`), hodnota `group-row`, Library setup a pod-řádky 13 px (`--fs-base`), souhrny sekcí 11 px (`--fs-sm`). `--fs-hud-sm 8` existuje jen pro řádek `Ch·CC` v 112px mobilním Live HUD. Raw `px` ve `font-size` / `font` hlídá `design-consistency-probe`.
- Váhy: Mulish **400 / 600 / 700**. Wordmark „Feel Fader" v hlavičce je normal case Mulish **700** – embedded Mulish je variabilní řez 300–700, váha **800 není k dispozici** a nikde se nepoužívá.
- Štítky polí (`.field-label`) jsou všude stejné: 11 px, `--t2`, `text-transform:uppercase`.
- Pomlčka v textech pro uživatele je vždy krátká `–` (Alt+0150), nikdy dlouhá `—`, i jako zástupný znak prázdné hodnoty (2026-09-26). Hlídá `design-consistency-probe` (stránka, title, tooltipy/ARIA, `TRANSLATIONS`, `UACC_NAMES`, názvy presetů).
- Podtitulky onboardingu (`.onb-beat-sub`) jsou zarovnané do bloku, poslední řádek vlevo, s dělením slov (2026-09-26).

### Známé gapy (netokenizované — pozor při rozšiřování)

- **Spacing** — `gap` na škále používá `--space-1 4` · `--space-2 8` · `--space-3 12` · `--space-4 16` · `--space-6 24`; půlkroky (2/6/10 px) a paddingy zůstávají raw kvůli optickému zarovnání. Nový kód bere tokeny.
- **Jednorázové hex mimo tokeny** — `h-badge.dev/.prod` (zlaté/zelené `#b07d00`, `#2e7d32`…), dark overrides (`#111115`, `#1a1a1e` pro JSON/artic display), `html.dark .lib-badge-sm{background:#555}` (viditelnější chip než `--bg-input` dark by dal). Legit výjimky, ale při přidávání podobného prvku sáhni po existující variabli, ne po nové konstantě.

### Minimal hybrid (2026-09-26)

Restyl zavedl čtyři opakující se struktury: **hlavička bank karty** (eyebrow „Bank N of M · active on device" · display název `.bank-title-input` · „Library setup · Browse…" otevírající nezměněný picker v `.library-popover`), **anatomie hlavičky sekce** (`.section-mark` – `L` / `R` u faderů, u rolleru šipky nahoru/dolů, u tlačítka plná tečka (2026-09-29, `SECTION_MARKS`) · titulek · souhrn pod titulkem · chevron `›` rotující o 90°), **seznam roller order** (`.seq-row`: index · název · hodnota · `≡`, Move/× na hover/focus-within), a **settings group** (`.group-cap` + `.settings-group` + `.group-row`, jediná skupina Feel Fader – viz §3.9).

**Dvousloupcový desktop (2026-09-28):** od šířky 900 px (UX audit 2026-09-28 N-4, dříve 1100 px; a až po zavření welcome) je `.center-col` grid: vlevo sticky `#stage-collapse` (controller + Send, sloupec `--stage-col` 420 px, pod hlavičkou `top:40px`), vpravo scrollující `#settings-col` (karta banky, skupina Feel Fader, patička). Důvod: na monitoru se muselo hodně scrollovat a controller zmizel z očí. Welcome zůstává jednosloupcový, protože sticky sloupec je stacking context a sdílený controller (z-index 205) by skončil pod welcome overlayem; po připojení `glideStageIntoColumn()` controller plynule odveze (FLIP podle `#device-home` – posun i měřítko, protože 900–1099 px controller zmenší), cesta „Continue without device" přepne okamžitě. Stage má vždy rezervovaný 160px slot vlevo pro výchozí pozici HUD (§3.2), takže se controller nehýbe, ať je HUD zobrazený, vypnutý, nebo přetažený; 40 px vpravo drží místo pro stín controlleru, protože `.stage` ořezává přetečení. Skrytí controlleru přepínačem v liště animuje `--stage-col` na 0 (třída `.stage-col-anim` jen po dobu přepnutí) a editor se vycentruje. Mezi 900 a 1099 px (monitor 1920 px dělený s DAW = 960) má sloupec `--stage-col` 366 px, mezeru 28 px a controller max. 166 px. Pod 900 px platí původní jeden sloupec.

**Sjednocené ovládací povrchy (2026-09-28):** MIDI diagnostics a Device backup používají stejný povrch jako pole Fader response (`--control-glass-*`, zaoblení `--r`, 14px SVG šipka); tlačítka na těchto kartách mají výplň `--bg-card`, aby na nich byla čitelná jako tlačítka.

---

## 1. Přehled

**Soubor:** `feel-fader.html` — jediná samostatná HTML stránka bez build kroku.
Obsahuje strukturu, vzhled, chování i vložené self-hosted fonty a obrázky.

**Účel:** Webový konfigurátor pro hardwarový MIDI kontrolér Feel Fader. Umožňuje nastavit MIDI kanál a CC číslo pro každý fader a enkodér, spravovat presets (banky) a synchronizovat konfiguraci se zařízením.

**Technologie:**
| Vrstva | Co se používá |
|---|---|
| UI | Vanilla JS, CSS animace, self-hosted Mulish |
| MIDI | Web MIDI API (`navigator.requestMIDIAccess`) — detekce zařízení + příjem live hodnot (fader/encoder CC, bank Program Change, keyswitch NoteOn) |
| Serial | Web Serial API — **jediný transport configu** (read i write); viz §5 |
| Persistence | `localStorage` — klíč `ff-cfg` |
| Transport | Line-based textový protokol po Web Serial; MIDI SysEx je jen vedlejší příjmový kanál, appka SysEx nikdy neposílá |

**Kompatibilita:** Chrome / Edge (Web MIDI API není dostupné v Safari ani Firefox bez rozšíření).

---

## 2. Architektura

### Struktura souboru

```
feel-fader.html
├── <style>          CSS, design tokeny, layout a vložené fonty/obrázky
├── <body>
│   ├── <header>     Stavový řádek + dark mode toggle
│   ├── <main>       Hlavní obsah (center-col)
│   ├── #welcome-screen  Uvítací obrazovka (fixed overlay)
│   ├── #icon-picker Overlay — výběr ikony banku
│   └── <script>     Stav, render, MIDI/Serial a interakce
```

(Poznámka: starší verze tohoto diagramu uváděla `#modal` — Settings modal byl nahrazen `toggleDeviceSettings()` sekcí, viz §3.9, a `#modal` element v HTML už neexistuje.)

### Životní cyklus

```
Načtení stránky
  → cfgLoad() — načte cfg z localStorage (nebo DEFAULT_CFG)
  → initDark() — nastaví tmavý/světlý režim
  → render() — vykreslí UI (welcome screen sdílí stejný `#device-home` DOM uzel
    se stage, viz §3.1 bod 7 — žádná samostatná overlay kopie faderů)
  → initMidi() — požádá o Web MIDI přístup
  → showWelcome() — zobrazí welcome overlay s okamžitě dostupným Connect & load, viz §3.1
```

### Klíčové globální proměnné

| Proměnná | Typ | Popis |
|---|---|---|
| `cfg` | Object | Aktivní konfigurace. Zdrojová pravda pro render. Ukládá se do localStorage po každé změně. |
| `liveValues` | `{f1, f2}` | Aktuální MIDI hodnoty faderů (0–127). Výchozí `{f1:64, f2:64}`. Aktualizuje se při příchozích MIDI CC zprávách. |
| `liveSeen` | `{f1, f2}` | Příznaky, že hodnota byla skutečně přijata z hardware; sticky Live bar bez nich zobrazí `—`. |
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

**Demo bez zařízení:** `Continue without device` vždy načte čistou výchozí konfiguraci
se třemi bankami `Bank 1–3`. Historická konfigurace z browserového `localStorage`
se v demo režimu nepoužívá.

**Co dělá:** Fixed overlay (z-index 200) zobrazený při startu, dokud není zařízení připojeno nebo uživatel neklikne „Continue without device".

**Idle stav:**
- Na desktopu začíná welcome obsah v horní, výškově omezené zóně (`clamp(42px, 7vh, 80px)`) místo vertikálního centrování celé sestavy. Stejná pozice se při handoffu přenese do aplikace, takže zůstává pixelově seamless bez velké prázdné hero plochy. Mezera kolem společného tlačítka je na desktopu symetrických 50 px; mobilní geometrie zůstává beze změny.
- Device image je statický a má stejnou responzivní velikost jako controller v aplikaci
- Dva animované fadery: levý (master, ~30% dráha, 5.5s), pravý (slave, ~14% dráha, 5.5s + 0.5s offset) — čistý CSS, stejný směr pohybu
- Běžný welcome obsahuje statický wordmark **Feel Fader**, primární **Connect & load** a sekundární **Continue without device**. Popisný nadpis „Connect Feel Fader", duplicitní „Waiting for device" i vysvětlující podtitulek zůstávají odstraněné. Wordmark využívá původní rezervovaný 50px obsahový slot, takže nepřidává výšku ani neposouvá primární tlačítko. První intro slide používá stejný statický wordmark místo duplicitního titulku.

**„Connect & load" tlačítko (`#send-btn` ve welcome režimu):** Welcome je jediná plocha, kde se uděluje serial port (Web Serial vyžaduje uživatelské gesto). Primární akce i **Continue without device** jsou dostupné okamžitě, také během tří volitelných intro slidů. Logika v `onDeviceConnected()` + `showWelcome()`:
- **Zařízení detekováno + port už schválený** (vracející se uživatel) → `loadConfigFromDevice()` proběhne tiše a spustí se transition (plně automatický vstup); viditelná akce tomu nebrání.
- **Zařízení detekováno + port neschválený** (první připojení) → klik na **Connect & load** (`doStart()`) = grant + load + transition.
- **MIDI detekce neproběhne** (port quirk) → stejné tlačítko obejde MIDI přes serial picker bez čekání na timeout.
- **Continue without device → pak připojíš zařízení** → `onDeviceConnected()` znovu vyjede welcome se Startem.
- Zrušení pickeru je tiché. Při skutečné chybě / timeoutu zůstane welcome beze změny výšky, tlačítko přejde na **Try again** a pevný jednořádkový stav ukáže pouze **Connection failed**.

**Connect transition** (spouští se přes `hideWelcome()` → `connectTransitionWelcome()`):
1. Podkladová appka se vždy synchronně vrátí na `scrollTop=0` (`history.scrollRestoration='manual'`), takže welcome nikdy neodhalí starou pozici u spodku stránky.
2. Welcome i aplikace používají jediný `#device-wrap` se stejným obrázkem, tracky a fadery; welcome nemá žádnou vizuální kopii controlleru.
3. Controller je na welcome screenu statický, zatímco stejné skutečné fadery animuje třída `.welcome-mode`.
4. Při připojení fadery zamrznou na aktuálním snímku a plynule dojedou na snapshot `info.faders` z `CMD_INFO`.
5. Prázdný app slot `#device-home` se přes `--stage-entry-offset` zarovná na aktuální pixely controlleru; žádná další onboarding karta přechod ani následný layout neposouvá.
6. Pozadí a text welcome vrstvy se rozpustí, ale sdílený controller zůstává plně neprůhledný.
7. Tentýž DOM uzel se přesune z `#welcome-controller-slot` do `#device-home`; obrázek ani fadery se znovu nenačítají nebo nepřekreslují jako druhá kopie.

**Welcome intro:** Čtyři stručné slidy (`_ONB_BEATS`: faders, roller, button, configure) se automaticky střídají, ale neblokují připojení ani demo. Indikátory jsou skutečná tlačítka s `aria-label` a přímou volbou slidu. Samostatné **Skip intro** bylo odstraněno jako redundantní; primární akce je dostupná stále. Intro používá pevný 142px obsahový slot a na mobilu rezervuje popisu tři řádky, takže tečky ani tlačítka pod nimi nemění pozici.

**Mobilní ukotvení akcí:** **Continue without device** je fixované 8 px nad spodní safe-area prohlížeče. **Connect & load** a **Send to device** jsou jeden sdílený `#send-btn`: welcome jej vloží do rezervovaného `.welcome-action-slot`, při zahájení přechodu se tentýž uzel přesune do `.send-callout` a po načtení pouze změní popisek a funkci. Skutečná vzdálenost od controlleru se zachová přes `--send-entry-gap`, takže se tlačítko nepřekreslí ani nepohne také po intro slidu s vyšším textovým slotem.

**První krok v appce:** Po prvním vstupu se nezobrazuje žádná další karta ani povinné odkliknutí. Jakmile uživatel poprvé doscrolluje k **Library setup**, picker se jednou jemně zvýrazní bez změny layoutu, automatického scrollu nebo otevření nabídky. Demo bez zařízení má samostatný čitelný badge; fadery zůstávají stabilní a nikdy nepředstírají periodická live data. **Show intro again** v Help & Guide znovu otevře skutečný welcome intro.

**Klíčové funkce:** `connectTransitionWelcome()`, `hideWelcome()`, `skipWelcome()`

---

### 3.2 Header

**Co dělá:** Sticky lišta nahoře. Zobrazuje název „Feel Fader", stav připojení MIDI a dark mode toggle.

**Stav připojení** (`#h-status-dot`, `#h-status-text`):
- Šedý pulzující bod → hledá zařízení
- Zelený bod + „Connected [název portu]" → Feel Fader nalezen
- Červený bod + „MIDI unavailable/blocked" → jediná viditelná informace o nedostupném Web MIDI; duplicitní obsahový banner byl odstraněn, podrobnost zůstává v tooltipu a MIDI diagnostics
- Na mobilu zůstává v liště pouze barevný bod. Text stavu je vizuálně skrytý, ale zachovaný pro čtečky obrazovky přes `aria-label` a pro tooltip; hlavička se proto nikdy nezalomí kvůli „MIDI unavailable".

Na desktopu je stav připojení trvale čitelný text vedle bodu — jakmile se jednou zobrazí „Connected", zůstává viditelný, dokud se stav nezmění (dřív se po 3 s automaticky sbalil zpět na holý bod bez popisku; tohle chování bylo odstraněno). Stav nefunguje jako tlačítko a neotevírá žádný popover — jde o prostý statický text.

**Banky na mobilu:** Aktivní bank zachová svůj název, neaktivní banky se zkomprimují na minimalistické indexy `2`, `3` atd. Výchozí banky 1–3 tak zůstávají současně viditelné bez horizontálního posunu lišty.

**Dark mode toggle:** Kompaktní kruhové glass tlačítko (jediný skutečný `backdrop-filter` mimo overlays, jako součást header chrome) se plynule mění mezi ikonou slunce a měsíce. Přepnutí používá View Transitions API jako jednotný 360ms crossfade celého vykresleného UI, takže plochy, text i okraje mění motiv současně; fallback (a `prefers-reduced-motion`, např. Windows s vypnutými animacemi) přepne motiv okamžitě pod `.theme-snapshot`, takže ani `.ui-control` tlačítka nedobíhají vlastní barevnou transition (2026-09-29). Stav se ukládá do `localStorage` (klíč `ff-dark`).

**Adaptivní hardware monitor (HUD):** Plovoucí `.live-hud` s aktuálními hodnotami zůstává v aplikaci připnutý vlevo pod sticky headerem – od 2026-09-26 je to plochá `--bg-card` karta s `--border` vláskovou linkou a jediným jemným `--shadow-hud` zvednutím, bez blur/saturace; s horní lištou už sdílí jen umístění, ne glass efekt. Dokud je controller viditelný, monitor má čtvercový tvar a symetricky kopíruje hardware: označení `L` a `R` je nad svislým mikro-metrem, pod live hodnotou je jemný technický popis `Ch·CC` a spodní řádek patří rolleru včetně jeho mapování. Sbalené hlavičky faderů a rolleru přesto nesou kompaktní souhrn mapování (`Ch 1 · CC11`, `15 articulations · Ch 1 · CC32`, `8 keyswitches · Ch 1 · C0–G0`) stejně jako BUTTON, protože monitor ukazuje jen aktivní banku (UX audit 2026-09-25 C‑5); editovatelná pole zůstávají uvnitř rozbalených sekcí. Jakmile controller odscrolluje nad lištu, monitor se plynule promění v dvouřádkovou kapsli s live hodnotami a mapováním aktuální banky. Při návratu ke controlleru se stejně plynule rozbalí zpět. Během welcome je skrytý; bez skutečně přijatých live dat zůstává na místě v utlumeném stavu s pomlčkami. Čtverec má na desktopu `144 × 144 px` s typem „metru“ (hodnota 20 px, roller 14 px, popisek i `Ch·CC` 10 px v `--t2`; UX audit 2026-09-25 C‑2, varianta C), pod 900 px má `112 × 112 px` (do 2026-09-28 pod 980 px; dvousloupcový desktop drží 144 px) (M-1, 2026-09-26: 96 px s řádkem teček banků překrýval L/R, hodnotu a `Ch·CC`; 120 px by zakryl levý fader), popisek 10 px, hodnota 12 px, `Ch·CC` 8 px; kompaktní kapsle `202 × 46 px`, respektive `190 × 44 px`. Nemá vlastní stavovou tečku ani text `LIVE/OFFLINE`; roller se označuje podle režimu jako `ART`, `KS` nebo `NAV`. **Od 2026-09-28:** v dvousloupcovém layoutu (≥ 900 px) se výchozí (nepřetažený, 1×) HUD ukotví do rezervovaného slotu vlevo od sticky controlleru, zarovnaný s jeho horní hranou (`body.hud-docked`, pozici počítá `updateContextualLiveStrip()` bez vlivu běžící FLIP transformace). Vlastní pozice z přetažení a 2× fungují beze změny; dvojklik (i klávesa Home) vrátí HUD v 1× do levého horního rohu pod hlavičkou (explicitní pozice, ne dokovaný slot; 2026-09-29). HUD lze vypnout přepínačem **Live monitor** v hlavičce.

**Plochý povrch, glass jen v hlavičce a overlays:** Od minimal hybrid restylu (2026-09-26) je skutečný glass (`backdrop-filter`) jen v headeru/`.top-sticky` liště a v overlays/dialozích (modaly, icon picker, change popover, RANGE PRESET menu, toasty, sync banner, welcome/onboarding) – bank karta, HUD, section hlavičky a settings groups jsou ploché `--bg-card` s `--border` vláskovou linkou, bez blur/saturace. Globální notifikace jsou kompaktní glass kapsle: typ zprávy rozlišuje jen malý barevný stavový symbol, nikoli celá barevná plocha; plynule se objeví i zavřou a na mobilu se centrují nad safe-area. Zbytečná notifikace při přepnutí motivu se nezobrazuje. Dialogy a stavové bannery mají vlastní výraznější glass vrstvu. Žádné ambientní gradients na `body` – plochý `--bg`. Na mobilu se blur v headeru/overlays snižuje a pro prohlížeče bez `backdrop-filter` existuje neprůhledný fallback.

**Klíčové funkce:** `renderConnState()` (dřív `updateStatus`), `toggleDark()`, `initDark()`

---

### 3.3 Stage — Device + Fadery

**Co dělá:** Vizuální reprezentace fyzického zařízení. PNG obrázek zařízení s překrytými interaktivními fader thumby.

**Chování při scrollu:** Od 900 px je controller se Send sticky v levém sloupci a nescrolluje (§0 „Dvousloupcový desktop"). Pod 900 px je součást běžného toku stránky, není sticky ani fixed; při scrollování přirozeně odjede nad viewport a nikdy se neparkuje nad Library setup nebo ovládacími sekcemi banku. Stage rezervuje také celou dynamickou mezeru a výšku `Send to device` přes `--send-entry-gap`, takže tlačítko nepřekrývá následující obsah ani po seamless přechodu z welcome screenu. Na desktopu používá stejnou optickou mezeru nad i pod tlačítkem, takže hlavní akce leží přesně mezi controllerem a kartou banky.

**Fader thumbs:**
- Dva dragovatelné thumby (PNG obrázky) pozicované absolutně na device imagu
- Pozice odpovídají fyzickým drážkám na zařízení (viz Sekce 7 — Fader layout)
- Pohyb myší/dotykem aktualizuje `liveValues` a odesílá MIDI CC
- Pod stage je volitelný `#fader-visual-wrap` s numerickými hodnotami (viditelný jen při připojení)

**Klíčové funkce:** `onImgLoad()`, `layoutFaders()`, `pF()`, `positionThumbs()`. ⚠ `mF()` / `drag()` / `dragT()` **odstraněny** — drag path je teď `scheduleFaderFrame()` + `flushFaderFrame()` + `applyInfoFaders()`.

---

### 3.4 Načítání configu (Start) + Send

**Načítání ze zařízení už nemá tlačítko na hlavní stránce** — nahradilo ho **„Connect & load" na welcome screenu** (viz §3.1). Load proběhne přes sdílené `loadConfigFromDevice()` (otevře port → `serialReadInfo` → `CMD_R` → `cfg` → `render()`), volané buď z této akce (první gesto), nebo automaticky při reconnectu.

| Akce | Co dělá |
|---|---|
| **Connect & load** (welcome) | `doStart()` → grant serial portu + `loadConfigFromDevice()` → transition na hlavní stránku s reálnými hodnotami |
| **send to device** | `doSend()` → zapíše `cfg` do zařízení přes Web Serial (`CMD_W`) |

**Stav synchronizace u hlavní akce:** Aplikace má jediné tlačítko **Send to device**, umístěné přímo pod vizualizací controlleru. Má pevnou šířku, takže změny textu neposouvají okolní feedback. Barva, stín a opacity tlačítka mezi červeným pracovním a zeleným potvrzeným stavem plynule přecházejí. Automatické načtení při startu komunikuje pouze stav **Device connected** v horní liště, aby se informace neduplikovala. **✓ Device loaded** se vedle stále dostupného **Send to device** ukáže jen po explicitní ruční volbě **Use device version**. Po úspěšném odeslání zůstane tlačítko neaktivní v zeleném stavu **✓ Sent**, dokud uživatel znovu nezmění konfiguraci. Potvrzení se místo globálního toastu plynule ukáže přímo vedle tlačítka jako **✓ Configuration sent to device**; všechny textové stavy na tomto místě používají stejné jemné zasunutí, rozostření a vzájemný crossfade. Chybové toasty zůstávají globální. Jakmile je `dirty=true`, stejné místo vedle tlačítka ukazuje počet sémantických změn a hlavní akce se vrátí na **Send to device**. Klik na počet změn otevře kompaktní přehled změněných banků/ovladačů, historii posledních deseti checkpointů přes **Undo (n)** a přímé **Restore last sent**. Historie pokrývá mapování, setupy, banky, artikulace i reset; po načtení nebo potvrzeném odeslání se nastaví nový synchronizovaný snapshot. Pokud validace najde chybu, text ukáže počet problémů a stejné tlačítko se dočasně změní na **Show error**.

**Pravidla inline notifikací:** Dočasná potvrzení (`Device loaded`, `Configuration sent`) sdílejí jednotnou dobu 2,2 s. Stavové zprávy (`unsaved changes`, validační problém) zůstávají viditelné do vyřešení stavu. Všechny varianty používají stejné plynulé objevení a zmizení, 180ms crossfade při změně obsahu a stejný motion pattern na desktopu i v mobilním docku; při `prefers-reduced-motion` se animace vypnou.

**Mobil:** Po odscrollování původní pozice se toto stejné jediné tlačítko — pouze pokud existují neodeslané změny — přepne do kompaktního fixed liquid-glass calloutu nad safe area. Tentýž callout se při dockování dočasně přesune mimo transformovaný stage přímo pod `body`, aby jej prohlížeč skutečně kotvil k viewportu; po návratu nahoru nebo odeslání se synchronně vrátí do původního `#send-anchor`. Druhá akce se nevytváří.

**Navigace validace:** Chybový banner i **Show error** pod controllerem přepnou na první problematický bank, otevřou odpovídající akordeonovou sekci, plynule doscrollují ke konkrétnímu CC/channel/articulation poli a zaměří jej. Po opravě se další chyba stane novým cílem.

**Klíčové funkce:** `loadConfigFromDevice()`, `doStart()`, `onDeviceConnected()`, `showStartBtn()`, `doSend()`, `reflectDirty()`, `configChangeItems()`, `undoLastConfigChange()`, `restoreSyncedConfig()`, `updateMobileSendDock()`, `focusValidationError()`

---

### 3.5 Bank Tabs

**Co dělá:** Horizontálně scrollovatelná řada záložek (max. 8 banků). Bank editovaný v appce označuje plochý `--bg-card` pill s vláskovým `--border` okrajem, bez shadow efektu (od 2026-09-26 – dřív frosty glass výplň). Fyzicky aktivní bank zařízení nese navíc malou zelenou tečku `.bank-tab-device-dot` přímo na záložce (`deviceBankIndex()`, `syncDeviceBankMarkers()`) – rozhodnutí z 2026-09-26 obrátilo dřívější pravidlo „žádný device marker v tabech“; desktopový Live HUD si svoje tečky banků (`.live-hud-bank-dot`) ponechává souběžně. Editovaný a fyzicky aktivní stav tak zůstávají vizuálně odlišitelné (pill vs. tečka) a nemohou se číst jako dvě totožné selekce. Stejný stav je navíc čitelný v eyebrow bank karty jako „· active on device“ (§3.6). Význam tečky vysvětluje první in-app krok, `title="Active on device"`, `aria-label` tabu a kontextová nápověda u Library setup. Tlačítko „+“ přidá nový bank. Každá záložka zobrazuje jméno banku i mimo aktivní stav; bank bez ikony má minimalistický číselný fallback `1`, `2`…; u výchozího jména „Bank N“ se číslo na desktopu nezdvojuje („Bank 1“, ne „1 Bank 1“), na mobilu zůstává u neaktivních záložek jen číslo (K-7). Aktivní záložka používá `aria-current`.

**Interakce:**
- Klik na záložku → `selectBank(i)` — přepne `activeBank` a překreslí panely
- Tlačítko „+" → `addBank()` — přidá na konec kopii aktivního banku (mapování, kanál, roller) jako „Bank N" a přepne na ni; Library setup neotevírá
- Drag & drop záložky → změní pořadí banků v `cfg.banks`; stejné pořadí se po **Send to device** používá při přepínání na hardware.
- Šipky u názvu banku → přístupná alternativa změny pořadí pro klávesnici a dotyk.

**Klíčové funkce:** `renderBankTabs()`, `selectBank()`, `addBank()`, `reorderBank()`, `moveBank()`, `removeBank()`. ⚠ `stepBanks()` **odstraněno.**

---

### 3.6 Bank Name Card

**Co dělá:** Hlavička bank karty pod záložkami, tři patra: eyebrow „Bank N of M" (+ „· active on device", jen na bance fyzicky aktivní na zařízení, `#bank-eyebrow-device`), ikona + display název (`.bank-title-input`, `--fs-display` 20px) a řádek „Library setup · Browse…".

**Komponenty:**
- **Icon picker:** Emoji nebo barevný badge (výběr z předdefinovaných kategorií — nástroje, styly, barvy). Otevírá overlay `#icon-picker`.
- **Name input:** Inline editovatelné jméno banku, teď v display velikosti `.bank-title-input`.
- **Library setup · Browse…:** Textový odkaz otevírá `toggleLibraryPopover()` – nezměněný searchable picker (Recently used / Libraries / My setups, filtrování za psaní, Arrow Up/Down, Home/End, Enter) teď sedí uvnitř `.library-popover`, ne přímo v řádku karty. Dvoukrokový Escape: v otevřených options Escape přesune fokus zpět na vyhledávací pole (`quickSetupOptionKey`); Escape ve vyhledávacím poli popover zavře a fokus vrátí na „Browse…" (`quickSetupInputKey`). Volba nejprve otevře přístupný preview dialog s cílovým bankem, konkrétními CC, režimem rolleru, počtem artikulací a ikonou. **Apply setup** aplikuje všechny uložené části; **Articulations only** zachová mappings, roller i ikonu. Vestavěný setup je výslovně označen jako starting point, který je nutné ověřit proti konkrétnímu patchi/verzi knihovny. Poslední tři potvrzené volby ukládá lokálně v `ff-recent-quick-setups-v1`. Známá záměrná odchylka od mockupu: subtitle ukazuje „Library setup · Browse…", ne jméno knihovny (spec §4).
- **My setups:** Tlačítko **Save as setup…** (v řádku Bank actions karty Feel Fader, viz níže) uloží aktuální bank jako vlastní Library setup do `localStorage` (`ff-custom-library-presets-v1`). Uživatel samostatně volí, zda setup obsahuje fader mappings a kanály, roller/navigation, artikulace/keyswitches a ikonu. Vlastní setupy se zobrazí ve skupině **My setups** v Library setup popoveru; dialog podporuje editaci/přejmenování, potvrzené přepsání, potvrzené smazání a JSON import/export. Katalog zůstává ve web appce — firmware dostává pouze výslednou konfiguraci banku.

**Bank actions** (od 2026-09-28): samostatná skupina „Bank" byla zrušena (příliš výrazná). Akce jsou první sbalený řádek karty Feel Fader (§3.9) – `#bank-actions-toggle-btn` s názvem editované banky vpravo (`#bank-actions-summary`), obsah `#bank-actions-body` vykresluje `render()`. Rozbalený obsah má stejnou gramatiku jako Device & Settings (`.info-row`: popisek vlevo, sdílený ovladač vpravo):
- **Setup · Save as setup…** — pill jako Export; otevře stejný uložit-setup dialog jako výše.
- **Copy · Duplicate** — pill jako Export; vloží hlubokou kopii celého banku hned za originál, vybere ji a nabídne její unikátní jméno k okamžité editaci. Respektuje limit 8 banků.
- **Position · ‹ N of M ›** — stepper jako MIDI channel (`.bank-position-stepper`); přesune celý bank včetně všech mappingů a zachová otevřenou sekci; `activeBank` sleduje přesunutý obsah. `liveBank` zůstává fyzickým slotem zařízení, dokud se lokální pořadí neodešle. Krajní šipky jsou disabled.
- **Delete · Delete bank…** — červeně orámovaná pill jako Reset; viditelné jen pokud je více než 1 bank; vyžaduje potvrzení a po smazání nabízí dočasné Undo.

**Klíčové funkce:** `onBankRename()`, `openIconPicker()`, `closeIconPicker()`, `toggleLibraryPopover()`

---

### 3.7 Fader Sekce (Fader 1 / Fader 2)

**Co dělá:** Každý bank má dvě fader sekce. Hlavička sekce začíná `.section-mark` značkou (`L` / `R`, Mulish 600), pak následuje titulek a pod ním souhrn (§0 „Minimal hybrid"). Název faderu se edituje přímo v titulku stejným transparentním underline inputem jako jméno banku; samostatné pole **Display name** v obsahu není. Výchozí jména jsou `Expression` pro levý a `Dynamics` pro pravý fader, maximum je 32 znaků a prázdné jméno se při opuštění pole vrátí na default. Kliknutí kamkoli do hlavičky mimo input názvu sekci rozbalí nebo zavře; input zůstává samostatnou editační zónou a souhrn s chevronem `›` (rotuje o 90° otevřením) dál funguje jako přístupné tlačítko. Vlastní jméno vede hlavičku sekce a validační texty; kompaktní Live HUD používá fyzické značky `L` a `R`. Pod MIDI CC zůstává hudební význam (`CC74` Brightness atd.) a raw CC je viditelné a editovatelné. Fader i roller sekce jsou kompaktní akordeon: zavřená hlavička ukazuje MIDI kanál, CC nebo zvolený keyswitch/navigation režim; otevřená je vždy nejvýš jedna sekce banku. Otevřená sekce propojená s ovladačem na fotce dostává plochý neutrální podklad `--highlight-section-fill` (zelená zůstává jen na fotce, tečce banku a u live/success stavů, ne na sekci); na desktopu hlavička otevřené sekce při dlouhém scrollu zůstává přichycená těsně pod horní lištou jako plochá `--bg-card` deska se spodní `--border` linkou (`.is-stuck`), dokud uživatel neopustí danou sekci. Summary typografie odděluje hudební význam v `Mulish 600` od technických hodnot `Ch / CC / nota / klávesa` v `IBM Plex Mono 500`; samotný prázdný macro stav se zobrazuje jako **Not assigned**, ne jako nejasná pomlčka.

**Pole:**
| Pole | Rozsah | Popis |
|---|---|---|
| MIDI CHANNEL | 1–16 | MIDI kanál (interně ukládáno jako 0–15) |
| MIDI CC | 0–127 | Control Change číslo |
| Label | text | Vlastní popis (zobrazuje se v UI, neodesílá se) |

**Live hodnoty:** Duplicitní lokální čísla nejsou v sekcích. Floating Live HUD odvozuje krátkou značku z vlastního jména faderu (`Bow Pressure` → `BOWP`); roller používá `ART/KS/NAV` a zobrazuje název artikulace nebo notu namísto samotného raw čísla.

**Klíčové funkce:** `faderSectionContent()`, `stepCtrl()`, `onCtrl()`. ⚠ `onFaderLabel()` **odstraněno.**

---

### 3.8 Roller sekce

**Co dělá:** Roller (otočný enkodér) na zařízení má čtyři režimy: **Articulation** (krokuje UACC hodnoty na jednom CC), **Keyswitch** (posílá keyswitch noty), **Navigation** (posílá klávesy přes HID) a **Relative CC** (posílá relativní kroky 1/127). Názvy segmentů jsou totožné s nadpisem sekce (`rollerModeTitle()`); vysvětlení je v `title` segmentu (K-5).

**Volba režimu:** Čtyři režimy tvoří jeden pill-shaped segmented control. Posuvný segment označuje aktivní režim jako plochý `--bg-card` pill s jemným `--shadow-sm` stínem na `--bg-input` tracku (od 2026-09-26 – dřív frosty-gray glass stav, viz §0 „aktivní plochy... explicitní --bg-card pill"). Track se při změně režimu nepřekresluje, takže indikátor dokončí souvislou 460ms compositor animaci s jemně tlumeným dojezdem; mění se pouze synchronně cross-fadovaný obsah pod ním. Aktivní prvek používá `aria-pressed`, roving `tabindex` a podporuje šipky, Home a End. `prefers-reduced-motion` animace vypne.

**Keyswitch keyboard:** Rozsah se vybírá na kompaktní horizontálně posuvné klaviatuře MIDI 0–127. Kliknutí zvolí jednu notu, tažení přes klávesy vytvoří souvislý rozsah a zvýraznění používá jemnou barvu faderů se silnějšími krajními klávesami. Tlačítka po stranách posouvají klaviaturu po blocích; preset i přesná změna hranice automaticky zobrazí aktuální rozsah. Klaviatura podporuje focus, Arrow Left/Right, Home, End a aktivaci klávesy přes Enter/Space. Pole FROM/TO zůstávají jako ploché pill steppery pro přesné doladění a přístupnost. Všechny změny probíhají bez překreslení panelu.

Základní keyswitch workflow ukazuje pouze MIDI channel, range preset, klaviaturu a FROM/TO. Velocity, note naming convention, jednotlivé noty a jejich pořadí jsou v nativním rozbalovacím bloku **Advanced keyswitch settings**, jehož otevřený stav se zachová při překreslení. Keyswitch i articulation sekvence jsou označené **ROLLER ORDER** a mají společný seznamový formát `.seq-row` (`sequenceRowHtml()`) místo dřívější chip mřížky: index · hudební/UACC název · MIDI/CC hodnota · `≡` handle na konci řádku. Tlačítka **Move earlier/later** (`‹`/`›`) a **✕ Remove** (`.seq-actions`) jsou vizuálně skrytá a objeví se na hover/focus-within, ale v tab pořadí zůstávají vždy dostupná. Live nota/hodnota (u obou typů – articulation i keyswitch) dostane tučný název, zelený index a tečku vlevo od řádku (`.is-live`). Pořadí lze měnit svislým drag & dropem (těžiště řádku určuje před/za), přes **Alt + šipky** na zaměřeném řádku nebo přístupnými tlačítky Move earlier/later; pořadí řádků odpovídá pořadí krokování rolleru.

**Stepper controls:** Stejný plochý pill systém používají všechny číselné steppery v aplikaci (MIDI channel, CC, velocity a keyswitch FROM/TO): kompaktní neutrální −/+ segmenty bez mezer, užší kapsle hodnoty na `--bg-input`, bez blur/border, skryté dělicí čáry a společné hover/focus chování. Také aktivní volba keyswitch convention používá stejnou plochou neutrální výplň místo červené.

**UACC (Universal Articulation Control Code):**
Spitfire standard pro přepínání artikulací přes CC 32 (v pluginu musí být „Locked to UACC"). Jiní výrobci ho neimplementují, proto appka nenabízí UACC presety pro EW/OT/Kontakt. Názvy v `UACC_NAMES` odpovídají UACC v2 (Spitfire manual, Appendix E).

Každá artikulace je CC hodnota (0–127) s volitelným pojmenováním (interní slovník `UACC_NAMES`).

**Správa seznamu artikulací:**
- Textové odkazy pod seznamem: **Add articulation…** přidá jednotlivou hodnotu, **Templates…** aplikuje **Articulation templates** (dřív ghost tlačítko „Articulation templates ▾" pod seznamem). Knihovní seznam otevře stejný library preview dialog jako Library setup (nic se nezmění do Apply); „Clear all" se ptá.
- Řádky (`.seq-row`) mají drag & drop, **Alt + šipky** i přístupná tlačítka **Move earlier/later**; zobrazené pořadí je přímo pořadím krokování rolleru.
- Roller na zařízení přechází na další/předchozí hodnotu v seznamu.
- Keyswitch noty mají stejný seznam se stejným řádkovým formátem a vlastním odkazem **Add note…**.

**Klíčové funkce:** `encoderSectionContent()`, `addUacc()`, `moveUacc()`, `removeUacc()`, `applyArticulationList()`, `renderUacc()`, `uaccName()`

---

### 3.9 Device

Součást skupiny **Feel Fader** (`.group-cap` „Feel Fader" + `.settings-group` + `.group-row`) pod bank kartou – stejná plochá `--bg-card` karta nese tři rozbalovací `group-row` řádky v pořadí **Bank actions** (§3.6), **Device** (ve sbaleném řádku vpravo `#di-firmware-summary` z `deviceSummaryText()`: „Not connected“, „Firmware 1.4.2“, případně „Connected“ bez známé verze) a pod ním tišší **Help & Guide**. Volba zobrazení je od 2026-09-28 (UX audit N-10) v hlavičce: **Live monitor** (`#live-hud-switch` zapíná/vypíná plovoucí HUD, `setLiveHudEnabled()`, uloženo jen v prohlížeči v `ff_live_hud_enabled`, výchozí zapnuto); dřívější skupina Application settings s tímto jediným přepínačem zanikla a přepínač **Controller** (skrytí controlleru + dokování Send do hlavičky) byl 2026-09-29 odstraněn – controller je po welcome vždy vidět. Otevřený **Device** obsahuje info o zařízení, plochý switch Keyboard (HID) – `.hid-switch-track` je od 2026-09-26 stejná plochá `--control-glass-*` výplň jako ostatní kompaktní controls, bez blur – sbalený **MIDI diagnostics** a kompaktní blok **Backup & reset**. Zapnutí HID používá vlastní přístupný dialog (`.modal`, glass zůstal jen v overlays) namísto nativního `confirm()`; Navigation a trvale viditelný Button Macro nabízejí stejnou akci **Enable Keyboard…** přímo v kontextu – od 2026-09-29 jako plochá poznámka bez rámečku a tónovaného pozadí (amber tečka jako `.section-issue-dot.warn`, text v typu `.uacc-note`, plná pill s metrikou `.ui-keycap`); stejný vzhled má i `#nvm-degraded-notice`. Diagnostika ukazuje connection state, nalezený MIDI input, fyzicky aktivní bank, výsledné L/R/roller mapování, poslední MIDI event, firmware, HID a config hash; **Copy diagnostics** vytvoří textový support snapshot. **Device backup** má pouze tři akce pro celou konfiguraci zařízení: Export, Import a Reset; původní viditelný JSON inspector byl odstraněn. Reset vyžaduje potvrzení, obnoví `DEFAULT_CFG` jako lokální konfiguraci a nastaví `dirty=true`; zařízení se změní až po **Send to device**. Živé pozice faderů se resetem lokální konfigurace nemění.

**Klíčové funkce:** ⚠ `openModal()` / `closeModal()` / `onBankCount()` **odstraněny** — device/advanced settings teď přes `toggleDeviceSettings()`.

---

### 3.10 JSON backup formáty

Web appka rozlišuje dva nezávislé typy záloh:

- **Device backup / Export:** stáhne `feel-fader-device-backup.json` s kompletním `cfg` všech banků a nastavení.
- **My setups / Export:** stáhne `feel-fader-custom-presets.json` pouze s uživatelským katalogem Library setupů (starší název souboru zůstává kvůli kompatibilitě).
- Import kompletní konfigurace nastaví `dirty=true`; změny se do zařízení odešlou až přes **Send to device**.

**Klíčové funkce:** `exportP()`, `importP()`, `onImport()`, `exportCustomPresets()`, `importCustomPresets()`.

---

## 4. Datové struktury

### `cfg` objekt

```js
{
  banks: [
    {
      name: "Bank 1",          // string — zobrazované jméno
      icon: "🎻",              // string — emoji nebo barevný badge kód, nebo ""
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

Definován v inline `<script>` bloku appky (`const DEFAULT_CFG`, dohledatelné greppem). Obsahuje 3 předdefinované banky (Bank 1–3) s různými CC čísly a kanály. Použije se při prvním spuštění nebo po factory resetu.

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
- Snapshotu faderů z `CMD_INFO` při připojení (`applyInfoFaders()`)

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

Appka drží stav v `cfg.macro_global` a `cfg.banks[i].macro_keys`. Přístup jde přes
`activeMacroKeys(bi)` / `setActiveMacroKeys(bi, keys)`; checkbox volá `setMacroGlobal(on)`.
Přechodová pravidla: zapnutí Global převezme makro právě zobrazené banky, vypnutí naseje
globální hodnotu do všech bank. Když je zařízení připojené s `schema_version < 3` a Global
je vypnutý, BUTTON sekce ukáže `#macro-schema-notice`.

---

## 5. Transport (MIDI + Serial)

> Přepsáno 2026-07-12 podle reálného kódu. **Klíčová změna oproti staré verzi doc:** config se **nepřenáší přes MIDI SysEx**. Čtení/zápis konfigurace jde přes **line-based textový protokol po Web Serial**. MIDI slouží už jen k detekci zařízení a k příjmu live hodnot (CC/PC/NoteOn). Starý chunkovaný SysEx (`CMD_CHUNK`/`CMD_ACK`/`enc7`/`sysexWriteConfig`/`sysexReadConfig`) je pryč.

### 5.1 Dvě roviny — kdo co dělá

| Rovina | API | K čemu | Klíčové funkce |
|---|---|---|---|
| **MIDI** | Web MIDI (`requestMIDIAccess({sysex:true})`) | Detekce Feel Faderu; příjem live hodnot (fader CC, encoder CC, bank Program Change, keyswitch NoteOn) | `initMidi`, `connectInputs`, `onMidiMsg` |
| **Serial** | Web Serial (115200 baud, vendor `0x2E8A` = RP Pico) | **Veškerý přenos configu** — read i write, + device info | `serialRequest`, `serialReadConfig`, `serialReadInfo`, `_serialEnsureOpen` |

### 5.2 Detekce a vstup do appky

```
initMidi()
  → requestMIDIAccess({sysex:true})  → onstatechange (debounce 400 ms, ignoruje CC churn)
  → connectInputs()
      → isFeelFader(name): match "feel fader"
      → inp.onmidimessage = onMidiMsg;  _ffConnected = true
      → onDeviceConnected() — rozhodne vstup:
          • serial port už schválený + !dirty → tichý load / sync banner (viz 5.4)
          • port neschválený → ukázat „Start" na welcome (gesto nutné pro requestPort)
          • po skipu → re-welcome
```

> ⚠️ **Neposílat SysEx při detekci.** Původní `_requestDeviceInfoSysex()` byl odstraněn (HW test 2026-07-07): SysEx write přes Chrome/Windows MIDI Services **zasekne MIDI endpoint až do replugu**. Device info se čte serialem (`CMD_INFO`), ne MIDI. Nikdy nevracet SysEx-write do detekce — viz memory `project_feelfader_web_uses_serial`.

### 5.3 Serial protokol (line-based text)

Ne SysEx — prosté textové řádky ukončené `\n`. `serialRequest(cmd, payload, timeoutMs)` je **jediné místo, které serial zapisuje**; transakce jsou serializované přes `_txnChain` (jedna naráz).

**Dvě verze rámování** (`protocolVersion`, bootstrapuje `serialReadInfo`):

| Verze | Odchozí řádek | Příchozí odpověď | Párování |
|---|---|---|---|
| **v1** (legacy) | `CMD` nebo `CMD:payload` | první řádek vyhrává | žádné (fire-first) |
| **v2** (rid framing) | `CMD:rid:payload` | `TYP:rid:payload`, `TYP ∈ {CFG,INFO,ACK,ERR}` | podle `rid` (stale/cizí řádky se zahazují) |

- **Command jména** (řetězce, ne byty): `CMD_R`, `CMD_INFO`, `CMD_W`, `CMD_HID`. Konstanty `MFR/DEV_ID/CMD_*` drží **jen** MIDI-SysEx vrstva (`handleSysEx`), serial používá stringy.
- **Expect-mapa**: `{CMD_R:'CFG', CMD_INFO:'INFO', CMD_W:'ACK', CMD_HID:'ACK'}`. `_readReply` čeká na řádek typu = expect se správným `rid`; `ERR:*` → reject, timeout → reject.
- **v1 fire-and-forget:** `CMD_W`/`CMD_HID` ve v1 nevrací nic (`serialRequest` vrátí `''`).
- **Port:** `_serialEnsureOpen` recykluje session port; auto-connect na dřív schválený port (řadí podle uloženého `usbProductId`, klíč `ff-serial-pid`), jinak `requestPort` filtrovaný na vendor `0x2E8A`. „Busy" chyba = port drží jiný tab/aplikace (viz memory `project_feelfader_serial_port_exclusive`).

### 5.4 CMD_INFO bootstrap + sync detekce

`serialReadInfo()`: pošle `CMD_INFO` **vždy nejdřív v1 rámcem** (odpoví starý i nový firmware), pak z odpovědi:

- `schema_version >= 2 && config_hash:string` → `protocolVersion = 2`, jinak `1`.
- Uloží `DEVICE_INFO.{firmware, serial, hid_available, hid_enabled, config_hash, config_source}`.
- `applyInfoFaders(info)` nastaví `liveValues` **před** renderem.

Při reconnectu (`onDeviceConnected`, v2) se porovná uložený hash (`ff-last-hash`) s `config_hash` zařízení:

| Stav zařízení | Akce |
|---|---|
| `config_source === 'defaults'` | `showSyncBanner('defaults')` — nabídnout volbu mezi verzí zařízení a browseru |
| uložený hash ≠ `config_hash` | `showSyncBanner('differs')` — konfigurace se rozešly |
| shodné / bez hashe | tichý `loadConfigFromDevice()` |

Konfliktní banner nepoužívá neurčité „Send mine“. Akce jsou explicitní **Use device version** a **Overwrite device** a text vysvětluje, že browser a zařízení obsahují dvě rozdílné konfigurace.

### 5.5 Zápis konfigurace — `doSend()`

1. `validate()`; při chybě stop. Každá chyba nese `field` a konkrétní DOM `target` pro navigaci přes `focusValidationError()`.
2. `serialRequest('CMD_W', JSON.stringify(cfg), 5000)` — celý `cfg` jako JSON, jeden řádek.
3. **v2:** zařízení vrátí `ACK` s novým **config hashem** → uloží se do `ff-last-hash` + `DEVICE_INFO.config_hash`. **v1:** ACK prázdný (fire-and-forget).
4. `cfgSave()`, `dirty=false`, inline potvrzení **✓ Configuration sent to device** plynule vedle centrálního tlačítka; globální success toast ani velkou zelenou plochu nepoužívá.
5. Chyby: `ERR:<reason>` → „Device rejected config" (drží jako unsaved); `timeout` → „No confirmation" (retry); jinak zavře port.

### 5.6 Čtení konfigurace — `loadConfigFromDevice()`

`_serialEnsureOpen` → `serialReadInfo` (best-effort) → `serialReadConfig()` (= `serialRequest('CMD_R', null, 5000)`) → `JSON.parse` → `normalizeFwConfig` → `cfg`, `loaded=true`, `dirty=false`, `cfgSave`, `render`. Volané z `doStart` (welcome gesto) i tichého reconnectu.

### 5.7 MIDI příjem — `onMidiMsg()`

- **CC (0xB0):** porovná s `fader1/2.cc+channel` → `liveValues` + `scheduleFaderFrame`; encoder CC → artikulace/UACC.
- **NoteOn (0x90) na `ks_channel`:** live keyswitch pozice (roller_mode `keyswitch`).
- **Program Change (0xC0):** hardware bank switch → `liveBank`+`activeBank`.
- **SysEx (0xF0):** `handleSysEx` — dekóduje `dec7()`, reaguje jen na příchozí `CMD_INFO`. Toto je jediné zbylé využití SysEx a je pouze **příjem**; app SysEx nikdy neposílá (viz 5.2). Příchozí `CMD_W` (config push) byl odstraněn (strukturní audit 2026-07-20, SEC-003/PR-001) — appka SysEx neměla jak ověřit původ zprávy (substring shoda jména MIDI portu není autentizace) a firmware ho stejně nikdy neposílal.

### 5.8 Formát konfigurace: app vs. device

App drží **web formát** (`cfg` — per-control, viz §4), device posílá **interní kompaktní formát**; převod `normalizeFwConfig()`:

```js
// Device (banks[i]) — interní tvar z CMD_R
{ fader_cc:[cc1,cc2], fader_ch:[ch1,ch2], encoder:cc, encoder_ch:ch,
  uacc_values:[...], roller_mode, ks_notes, ks_channel, nav_keys_cw/ccw,
  m:{ n:name, i:icon, l:[label1,label2] } }   // m = prezentační meta
```

- **Prezentační pole** (name/icon/label) čte device z `m{}`; když chybí, `normalizeFwConfig` je drží z dosavadního `cfg` (localStorage) — funkční data ale vždy ze zařízení. Staré `tags` / `m.t` se při načtení zahodí.
- **Každý ovladač má vlastní MIDI kanál** (`fader_ch[0/1]`, `encoder_ch`); fallback na starý jednokanálový `channel`.
- ⚠️ Tento formát musí zůstat v synchronu s firmwarem — viz `CLAUDE.md` (pravidlo app↔firmware, nikdy společný merge).

---

## 6. Klíčové funkce

> Bez čísel řádků — appka roste rychle a čísla by za pár dní zase zastarala (viz hlavička dokumentu). Funkci dohledáš greppem podle jména. ⚠ = funkce od 06-27 odstraněna/přejmenována refaktorem (SysEx-chunking → serial request/reply, value bar zrušen) — viz náhrada.

| Funkce | Popis |
|---|---|
| `render()` | Překreslí celé UI podle aktuálního `cfg`. Volá `renderBankTabs()` + `renderPanels()`. |
| `renderBankTabs()` | Vykreslí záložky banků. |
| `renderPanels()` | Vykreslí sekce aktivního banku (fader1, fader2, encoder). |
| `selectBank(i)` | Přepne aktivní bank, překreslí UI. |
| `stepCtrl(bi,key,field,delta)` | Změní hodnotu pole (CC/channel) o delta (±1) přes stepper tlačítka. |
| `onCtrl(bi,key,field,val)` | Zapíše novou hodnotu do `cfg`, uloží do localStorage. |
| `layoutFaders()` | Pozicuje fader tracky na device imagu podle layout konstant. |
| `pF(tid,thid,v)` | Pozicuje fader thumb na pixel pozici odpovídající MIDI hodnotě v (0–127). |
| ⚠ `mF()` | **Odstraněno.** Drag path refaktorován → `scheduleFaderFrame()` + `flushFaderFrame()` + `applyInfoFaders()`. |
| `connectInputs()` | Připojí MIDI vstup/výstup Feel Faderu, spustí connect sekvenci. |
| `onMidiMsg(event)` | Zpracuje příchozí MIDI zprávy (CC → liveValues, SysEx → handleSysEx). |
| `handleSysEx(data)` | Zpracuje příchozí SysEx. |
| ⚠ `sysexWriteConfig(cfg)` | **Odstraněno.** Zápis teď `serialRequest('CMD_W', …)`, volané z `doSend`. |
| ⚠ `sysexReadConfig()` | **Odstraněno.** Nahrazeno `serialReadConfig()`. |
| `doSend()` | UI handler pro „send to device" — validuje, pak `serialRequest('CMD_W', …)`. |
| `doStart()` | Welcome „Start": grant serial portu + `loadConfigFromDevice()` + transition. |
| `loadConfigFromDevice()` | Sdílené: otevře port → `serialReadInfo` → `serialReadConfig` → `cfg` → `render()`. |
| `onDeviceConnected()` | Po detekci zařízení: auto-vstup (port schválený) vs Start vs re-welcome. |
| ⚠ `updateStatus()` | **Odstraněno.** Nahrazeno `renderConnState()`. |
| `connectTransitionWelcome()` | Animovaný přechod welcome screenu při připojení zařízení. |
| `hideWelcome()` | Spustí connect transition. Volá `connectTransitionWelcome()`. |
| `skipWelcome()` | Okamžitě skryje welcome screen bez animace. |
| ⚠ `initWelcomeFaderOverlay()` | **Odstraněno.** Welcome screen a stage teď sdílí jeden `#device-home` DOM uzel (přesouvaný mezi `#welcome-controller-slot` a stage, viz §3.1 bod 7) — žádná samostatná overlay kopie faderů. |
| ⚠ `renderFaderVisual()` | **Odstraněno** (value bar zrušen — viz komentář u `setBar`). |
| ⚠ `updateFaderVisual()` | **Odstraněno** (dtto). |
| `toggleDark()` | Přepne dark/light mode + uloží do localStorage. |
| `initDark()` | Načte preferenci dark mode při startu. |
| `applyLang()` | Aplikuje překlady (data-i18n atributy). Aktuálně pouze EN. |
| `validate()` | Validuje `cfg` — kontroluje duplicitní CC/kanál kombinace. |
| `openIconPicker(bi, mode)` | Otevře overlay pro výběr ikony banku. |
| `onImport(e)` | Importuje JSON konfiguraci ze souboru. |
| `toggleHelp()` / `openHelpAt(id)` | Otevře Help & Guide, případně konkrétní sekci. Starý JSON inspector a jeho mrtvé helpery byly odstraněny. |
| `toast(t, m)` | Zobrazí dočasné notifikační hlášení (success/error/info). |
| `cfgSave()` | Uloží `cfg` do localStorage. |
| `cfgLoad()` | Načte `cfg` z localStorage, vrátí null pokud neexistuje. |

---

## 7. Fader Layout — Konstanty

Definovány v inline `<script>` bloku, těsně před `layoutFaders()` (dohledatelné greppem po `const FLX`):

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

Překlady jsou definovány v JS objektu `TRANSLATIONS` (dřív dokumentováno jako `STRINGS`) a aplikovány přes `t(key)` + `applyLang()` na elementy s atributem `data-i18n="key"`. `currentLang` je natvrdo `'en'`.

Aktuálně podporován pouze **anglický jazyk**. Česká lokalizace není implementována — appka je primárně pro mezinárodní uživatele.

---

*Naposledy aktualizováno: 2026-08-17 (doc-drift oprava dle finální kontroly — odstraněny odkazy na neexistující `initWelcomeFaderOverlay()`, §0 Motion doplněna o tokenový systém `--dur-*`/`--ease-*`, opraven počet onboarding slidů (3→4) a poslední stopa čísla řádku u `TRANSLATIONS` — viz `docs/feel-fader-final-review-2026-08-17.md` DOC-004/008/009/010/011)*
