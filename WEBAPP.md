# Feel Fader — Web App Reference

Interní dokumentace pro Franka a Ivana. Popisuje aktuální stav appky — funkční popis UI i technické detaily implementace.

> ℹ️ **Stav (2026-07-20):** Appka roste rychle (3 466 → 5 821 řádků mezi 2026-07-12 a 2026-07-20), takže odkazy na konkrétní čísla řádků byly z tohoto dokumentu odstraněny — místo nich se dokument odkazuje na jména funkcí (dohledatelná greppem, přežijí refaktor). Výjimka: `## 6. Klíčové funkce` níže má sloupec Popis místo Řádek. Funkce odstraněné/přejmenované refaktorem od 06-27 jsou označené `⚠` s ukazatelem na náhradu. **§5 (transport) kompletně přepsána** podle reálného kódu — config jde přes line-based serial protokol, ne přes MIDI SysEx. §0 (design contract) je proti driftu imunní (popisuje `:root`, ne řádky).

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
| `--focus` | Viditelný keyboard focus ring | `#4f7cff` | `#7d9cff` |
| `--control-glass-bg` / `--control-glass-border` | Sdílená frosty výplň a hairline pro kompaktní controls | světlý glass gradient / `.56` | tmavý glass gradient / `.10` |
| `--control-glass-shadow` / `--control-glass-shadow-hover` | Sdílená elevace kompaktních controls | jemná dvouvrstvá | tmavší dvouvrstvá |
| `--green` | Success **fill/tečka** (na neutrálu) | `#34c759` | stejné |
| `--green-text` | Success **text** (na barvě) | `#1e8237` | `#5dd47a` |
| `--green-bg` / `--green-border` | Success plocha / okraj | `rgba(52,199,89,.10)` / `.32` | stejné |
| `--amber` | Warning | `#e6a23c` | stejné |
| `--piano-white` / `--piano-black` | Klávesy keyswitch klaviatury | `#fbfbfd` / `#303036` | `#d8d8dc` / `#202024` |
| `--shadow` / `--shadow-sm` | Elevace | dvouvrstvá | tmavší varianta |

> 🪤 **Past — `--green` vs `--green-text`:** `--green` (#34c759) je jasná zelená pro **fill/tečku** na neutrálním pozadí. Pro **text** (hlavně na `--green-bg`) použij VŽDY `--green-text`, které je ztmavené (light) / zesvětlené (dark) kvůli kontrastu. `--green` jako barva textu = nečitelné na světlém, špatný kontrast — nedělat.

### Sdílené control primitivy

Kompaktní interaktivní prvky skládají tři znovupoužitelné třídy: `.ui-control` sjednocuje hover/active/disabled chování, `.ui-pill` tvar a `.ui-glass` theme-aware frosty povrch. `.ui-danger` je barevná varianta (`.ui-primary` byla nepoužívaná a byla odstraněna strukturním auditem 2026-07-20, D-5). Tento kontrakt používají quick actions, onboarding, change history, bank actions, icon picker a kontextová nápověda. Stepper values, keyswitch bounds, roller segment, HID toggle, aktivní bank fill a sequence chipy používají stejné `--control-glass-*` tokeny i tam, kde kvůli vlastní struktuře nepoužívají utility třídy. Globální `:focus-visible` používá výhradně `--focus`; starý mouse-focus reset backgroundu byl odstraněn.

### Radii

`--r-sm: 6px` (badge, malé prvky) · `--r: 12px` (karty, inputy) · `--r-lg: 18px` (velké kontejnery) · `--r-pill: 999px` (tečky, scrollbar, pills). Žádná jiná hodnota.

### Motion

Dvě křivky, žádné jiné. Duration **.06s–.45s**.

- **Micro-interakce** (hover, stepper, drag): **`ease`**, `.12–.15s`
- **Větší/vstupní přechody** (welcome transition, HID switch, toasty, roller content, bank-tab, keyswitch chipy, theme switch, glow): **`cubic-bezier(.16,1,.3,1)`**, `.3–.45s`

Žádný spring/bounce/overshoot mimo tuto rodinu.

Nepřidávat spring/bounce easing ani durationy > .5s pro UI feedback — láme to „klidný, přesný" charakter appky.

### Typografie

- **Mulish** — veškeré UI (base `13px`).
- **IBM Plex Mono** — technické/číselné: verze, badges (`dev`/`prod`), JSON inspector, monospace hodnoty.
- Velikosti jsou **raw px**, clusterují na `10 / 11 / 12 / 13 / 14 / 16 / 22`. Nejsou tokenizované (viz gapy níže).

### Známé gapy (netokenizované — pozor při rozšiřování)

- **Spacing** — gapy/paddingy jsou raw px (`8 / 12 / 16 / 28`), žádný `--space-*` token.
- **Font-size** — raw px, žádný `--fs-*` token.
- **Jednorázové hex mimo tokeny** — `h-badge.dev/.prod` (zlaté/zelené `#b07d00`, `#2e7d32`…), dark overrides (`#111115`, `#1a1a1e` pro JSON/artic display), `html.dark .lib-badge-sm{background:#555}` (viditelnější chip než `--bg-input` dark by dal). Legit výjimky, ale při přidávání podobného prvku sáhni po existující variabli, ne po nové konstantě.

---

## 1. Přehled

**Soubor:** `feel-fader.html` — jedna HTML stránka (roste rychle, řádově tisíce řádků — přesný počet viz `wc -l feel-fader.html`), žádný build step, žádné závislosti (fonty z Google Fonts).

**Účel:** Webový konfigurátor pro hardwarový MIDI kontrolér Feel Fader. Umožňuje nastavit MIDI kanál a CC číslo pro každý fader a enkodér, spravovat presets (banky) a synchronizovat konfiguraci se zařízením.

**Technologie:**
| Vrstva | Co se používá |
|---|---|
| UI | Vanilla JS, CSS animace, IBM Plex Mono + Mulish (Google Fonts) |
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
├── <style>          CSS blok (na začátku souboru)
├── <body>
│   ├── <header>     Stavový řádek + dark mode toggle
│   ├── <main>       Hlavní obsah (center-col)
│   ├── #welcome-screen  Uvítací obrazovka (fixed overlay)
│   ├── #icon-picker Overlay — výběr ikony banku
│   └── <script>     Veškerý JS (za CSS blokem, tvoří většinu souboru)
```

(Poznámka: starší verze tohoto diagramu uváděla `#modal` — Settings modal byl nahrazen `toggleDeviceSettings()` sekcí, viz §3.9, a `#modal` element v HTML už neexistuje.)

### Životní cyklus

```
Načtení stránky
  → cfgLoad() — načte cfg z localStorage (nebo DEFAULT_CFG)
  → initDark() — nastaví tmavý/světlý režim
  → welcomeImg.src = deviceImg.src — zkopíruje PNG zařízení na welcome screen
  → initWelcomeFaderOverlay() — zobrazí animované fadery na welcome screenu
  → render() — vykreslí UI
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

**Welcome intro:** Tři stručné slidy se automaticky střídají, ale neblokují připojení ani demo. Indikátory jsou skutečná tlačítka s `aria-label` a přímou volbou slidu. Samostatné **Skip intro** bylo odstraněno jako redundantní; primární akce je dostupná stále. Intro používá pevný 142px obsahový slot a na mobilu rezervuje popisu tři řádky, takže tečky ani tlačítka pod nimi nemění pozici.

**Mobilní ukotvení akcí:** **Continue without device** je fixované 8 px nad spodní safe-area prohlížeče. **Connect & load** a **Send to device** jsou jeden sdílený `#send-btn`: welcome jej vloží do rezervovaného `.welcome-action-slot`, při zahájení přechodu se tentýž uzel přesune do `.send-callout` a po načtení pouze změní popisek a funkci. Skutečná vzdálenost od controlleru se zachová přes `--send-entry-gap`, takže se tlačítko nepřekreslí ani nepohne také po intro slidu s vyšším textovým slotem.

**První krok v appce:** Po prvním vstupu se nezobrazuje žádná další karta ani povinné odkliknutí. Jakmile uživatel poprvé doscrolluje k **Library setup**, picker se jednou jemně zvýrazní bez změny layoutu, automatického scrollu nebo otevření nabídky. Demo bez zařízení má samostatný čitelný badge; fadery zůstávají stabilní a nikdy nepředstírají periodická live data. **Show intro again** v Help & Guide znovu otevře skutečný welcome intro.

**Klíčové funkce:** `initWelcomeFaderOverlay()`, `connectTransitionWelcome()`, `hideWelcome()`, `skipWelcome()`

---

### 3.2 Header

**Co dělá:** Sticky lišta nahoře. Zobrazuje název „Feel Fader", stav připojení MIDI a dark mode toggle.

**Stav připojení** (`#h-status-dot`, `#h-status-text`):
- Šedý pulzující bod → hledá zařízení
- Zelený bod + „Connected [název portu]" → Feel Fader nalezen
- Červený bod + „MIDI unavailable/blocked" → jediná viditelná informace o nedostupném Web MIDI; duplicitní obsahový banner byl odstraněn, podrobnost zůstává v tooltipu a MIDI diagnostics
- Na mobilu zůstává v liště pouze barevný bod. Text stavu je vizuálně skrytý, ale zachovaný pro čtečky obrazovky přes `aria-label` a pro tooltip; hlavička se proto nikdy nezalomí kvůli „MIDI unavailable".

Na desktopu je stav připojení trvale čitelný a funguje jako tlačítko. Otevírá kompaktní liquid-glass přehled **Hardware / Live MIDI / Configuration / Last activity**, který rozlišuje nepřipojený hardware, blokované nebo nedostupné live MIDI a neodeslané změny. Akce **Open diagnostics** rozbalí Device & Settings, otevře MIDI diagnostics a plynule k nim posune stránku. Stav se tedy dá ověřit bez hledání v dolní části dlouhé konfigurace.

**Banky na mobilu:** Aktivní bank zachová svůj název, neaktivní banky se zkomprimují na minimalistické indexy `2`, `3` atd. Výchozí banky 1–3 tak zůstávají současně viditelné bez horizontálního posunu lišty.

**Dark mode toggle:** Kompaktní kruhové liquid-glass tlačítko se plynule mění mezi ikonou slunce a měsíce. Přepnutí používá View Transitions API jako jednotný 360ms crossfade celého vykresleného UI, takže gradientní glass sekce, text i okraje mění motiv současně; fallback přepne motiv okamžitě a `prefers-reduced-motion` animaci vypíná. Stav se ukládá do `localStorage` (klíč `ff-dark`).

**Adaptivní hardware monitor:** Zaoblený liquid-glass monitor s aktuálními hodnotami zůstává v aplikaci připnutý vlevo pod sticky headerem a používá přesně stejnou průsvitnost, `22px` blur a saturaci jako horní lišta v light i dark režimu. Dokud je controller viditelný, monitor má čtvercový tvar a symetricky kopíruje hardware: označení `L` a `R` je nad svislým mikro-metrem, pod live hodnotou je jemný technický popis `Ch·CC` a spodní řádek patří rolleru včetně jeho mapování. Technické souhrny proto nejsou duplicitně v pravé části hlaviček faderů; editovatelná pole zůstávají uvnitř rozbalených sekcí. Jakmile controller odscrolluje nad lištu, monitor se plynule promění v dvouřádkovou kapsli s live hodnotami a mapováním aktuální banky. Při návratu ke controlleru se stejně plynule rozbalí zpět. Během welcome je skrytý; bez skutečně přijatých live dat zůstává na místě v utlumeném stavu s pomlčkami. Čtverec má na desktopu `112 × 112 px`, pod 980 px `96 × 96 px`; kompaktní kapsle `202 × 46 px`, respektive `190 × 44 px`. Nemá vlastní stavovou tečku ani text `LIVE/OFFLINE`; roller se označuje podle režimu jako `ART`, `KS` nebo `NAV`.

**Liquid glass systém:** Header používá nejsilnější skleněnou vrstvu, aktivní bank card střední blur a pomocné panely lehčí průsvitnost. Globální notifikace jsou kompaktní liquid-glass kapsle: typ zprávy rozlišuje jen malý barevný stavový symbol, nikoli celá barevná plocha; plynule se objeví i zavřou a na mobilu se centrují nad safe-area. Zbytečná notifikace při přepnutí motivu se nezobrazuje. Dialogy a stavové bannery mají vlastní výraznější glass vrstvu. Ambientní radial gradients na `body` dávají průsvitnosti vizuální hloubku; vstupy a steppery zůstávají záměrně neprůhledné kvůli čitelnosti. Na mobilu se blur snižuje a pro prohlížeče bez `backdrop-filter` existuje neprůhledný fallback.

**Klíčové funkce:** `renderConnState()` (dřív `updateStatus`), `toggleDark()`, `initDark()`

---

### 3.3 Stage — Device + Fadery

**Co dělá:** Vizuální reprezentace fyzického zařízení. PNG obrázek zařízení s překrytými interaktivními fader thumby.

**Chování při scrollu:** Desktopový controller je součást běžného toku stránky, není sticky ani fixed. Při scrollování přirozeně odjede nad viewport a nikdy se neparkuje nad Library setup nebo ovládacími sekcemi banku. Stage rezervuje také celou dynamickou mezeru a výšku `Send to device` přes `--send-entry-gap`, takže tlačítko nepřekrývá následující obsah ani po seamless přechodu z welcome screenu. Na desktopu používá stejnou optickou mezeru nad i pod tlačítkem, takže hlavní akce leží přesně mezi controllerem a kartou banky.

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

**Co dělá:** Horizontálně scrollovatelná řada záložek (max. 8 banků). Bank editovaný v appce označuje plochý frosty pill bez vnějšího i vnitřního shadow efektu; používá pouze tónovanou průsvitnou výplň a jemný glass border. Fyzicky aktivní bank zařízení označuje výhradně symbol controlleru, bez spodní linky nebo dalšího fillu. Editovaný a fyzicky aktivní stav jsou tak vizuálně oddělené a nemohou se číst jako dvě současné selekce. Význam symbolu vysvětluje první in-app krok, `title="Active on device"`, `aria-label` tabu a kontextová nápověda u Library setup. Jeho ikonu, slot a název současně ukazuje desktopový Live HUD. Tlačítko „+“ přidá nový bank. Každá záložka zobrazuje jméno banku i mimo aktivní stav; bank bez ikony má minimalistický číselný fallback `1`, `2`… a aktivní záložka používá `aria-current`.

**Interakce:**
- Klik na záložku → `selectBank(i)` — přepne `activeBank` a překreslí panely
- Tlačítko „+" → `addBank()` — přidá bank s defaultní konfigurací
- Drag & drop záložky → změní pořadí banků v `cfg.banks`; stejné pořadí se po **Send to device** používá při přepínání na hardware.
- Šipky u názvu banku → přístupná alternativa změny pořadí pro klávesnici a dotyk.

**Klíčové funkce:** `renderBankTabs()`, `selectBank()`, `addBank()`, `reorderBank()`, `moveBank()`, `removeBank()`. ⚠ `stepBanks()` **odstraněno.**

---

### 3.6 Bank Name Card

**Co dělá:** Řádek pod záložkami — jméno banku a ikona.

**Komponenty:**
- **Icon picker:** Emoji nebo barevný badge (výběr z předdefinovaných kategorií — nástroje, styly, barvy). Otevírá overlay `#icon-picker`.
- **Name input:** Inline editovatelné jméno banku.
- **Library setup:** Searchable liquid-glass picker namísto browserového `datalist`. Seskupuje **Recently used**, vestavěné **Libraries** a **My setups**, filtruje během psaní a podporuje Arrow Up/Down, Home/End, Enter a Escape. Volba nejprve otevře přístupný preview dialog s cílovým bankem, konkrétními CC, režimem rolleru, počtem artikulací a ikonou. **Apply setup** aplikuje všechny uložené části; **Articulations only** zachová mappings, roller i ikonu. Vestavěný setup je výslovně označen jako starting point, který je nutné ověřit proti konkrétnímu patchi/verzi knihovny. Poslední tři potvrzené volby ukládá lokálně v `ff-recent-quick-setups-v1`.
- **My setups:** Tlačítko **Save setup** uloží aktuální bank jako vlastní Library setup do `localStorage` (`ff-custom-library-presets-v1`). Uživatel samostatně volí, zda setup obsahuje fader mappings a kanály, roller/navigation, artikulace/keyswitches a ikonu. Vlastní setupy se zobrazí ve skupině **My setups**; dialog podporuje editaci/přejmenování, potvrzené přepsání, potvrzené smazání a JSON import/export. Katalog zůstává ve web appce — firmware dostává pouze výslednou konfiguraci banku.
- **Duplikovat:** Vloží hlubokou kopii celého banku hned za originál, vybere ji a nabídne její unikátní jméno k okamžité editaci. Respektuje limit 8 banků.
- **Posun vlevo/vpravo:** Přesune celý bank včetně všech mappingů a zachová otevřenou sekci; `activeBank` sleduje přesunutý obsah. `liveBank` zůstává fyzickým slotem zařízení, dokud se lokální pořadí neodešle.
- **Smazat bank (✕):** Viditelné jen pokud je více než 1 bank; vyžaduje potvrzení a po smazání nabízí dočasné Undo.

**Klíčové funkce:** `onBankRename()`, `openIconPicker()`, `closeIconPicker()`

---

### 3.7 Fader Sekce (Fader 1 / Fader 2)

**Co dělá:** Každý bank má dvě fader sekce. Jejich název se edituje přímo v hlavičce stejným transparentním underline inputem jako jméno banku; samostatné pole **Display name** v obsahu není. Výchozí jména jsou `Expression` pro levý a `Dynamics` pro pravý fader, maximum je 32 znaků a prázdné jméno se při opuštění pole vrátí na default. Kliknutí kamkoli do hlavičky mimo input názvu sekci rozbalí nebo zavře; input zůstává samostatnou editační zónou a souhrn s chevronem dál funguje jako přístupné tlačítko. Vlastní jméno vede hlavičku sekce a validační texty; kompaktní Live HUD používá fyzické značky `L` a `R`. Pod MIDI CC zůstává hudební význam (`CC74` Brightness atd.) a raw CC je viditelné a editovatelné. Fader i roller sekce jsou kompaktní akordeon: zavřená hlavička ukazuje MIDI kanál, CC nebo zvolený keyswitch/navigation režim; otevřená je vždy nejvýš jedna sekce banku. Otevřená desktopová sekce má jemný neutrální podklad a měkký levý světelný gradient bez pevné hrany; její liquid-glass hlavička při dlouhém scrollu zůstává přichycená těsně pod horní lištou, dokud uživatel neopustí danou sekci. Summary typografie odděluje hudební význam v `Mulish 600` od technických hodnot `Ch / CC / nota / klávesa` v `IBM Plex Mono 500`; samotný prázdný macro stav se zobrazuje jako **Not assigned**, ne jako nejasná pomlčka.

**Pole:**
| Pole | Rozsah | Popis |
|---|---|---|
| MIDI CHANNEL | 1–16 | MIDI kanál (interně ukládáno jako 0–15) |
| MIDI CC | 0–127 | Control Change číslo |
| Label | text | Vlastní popis (zobrazuje se v UI, neodesílá se) |

**Live hodnoty:** Duplicitní lokální čísla nejsou v sekcích. Floating Live HUD odvozuje krátkou značku z vlastního jména faderu (`Bow Pressure` → `BOWP`); roller používá `ART/KS/NAV` a zobrazuje název artikulace nebo notu namísto samotného raw čísla.

**Klíčové funkce:** `faderSectionContent()`, `stepCtrl()`, `onCtrl()`. ⚠ `onFaderLabel()` **odstraněno.**

---

### 3.8 Encoder Sekce (Articulation Encoder)

**Co dělá:** Otočný enkodér na fyzickém zařízení prochází seznam artikulací (UACC hodnoty). Sekce konfiguruje CC číslo, MIDI kanál a seznam dostupných artikulací.

**Volba režimu:** Articulation, Keyswitch a Navigation tvoří jeden pill-shaped segmented control. Posuvný segment označuje aktivní režim a ve všech třech pozicích používá stejný klidný frosty-gray glass stav. Track se při změně režimu nepřekresluje, takže indikátor dokončí souvislou 460ms compositor animaci s jemně tlumeným dojezdem; mění se pouze synchronně cross-fadovaný obsah pod ním. Aktivní prvek používá `aria-pressed`, roving `tabindex` a podporuje šipky, Home a End. `prefers-reduced-motion` animace vypne.

**Keyswitch keyboard:** Rozsah se vybírá na kompaktní horizontálně posuvné klaviatuře MIDI 0–127. Kliknutí zvolí jednu notu, tažení přes klávesy vytvoří souvislý rozsah a zvýraznění používá jemnou barvu faderů se silnějšími krajními klávesami. Tlačítka po stranách posouvají klaviaturu po blocích; preset i přesná změna hranice automaticky zobrazí aktuální rozsah. Klaviatura podporuje focus, Arrow Left/Right, Home, End a aktivaci klávesy přes Enter/Space. Pole FROM/TO zůstávají jako frosty pill controls pro přesné doladění a přístupnost. Všechny změny probíhají bez překreslení panelu.

Základní keyswitch workflow ukazuje pouze MIDI channel, range preset, klaviaturu a FROM/TO. Velocity, note naming convention, jednotlivé noty a jejich pořadí jsou v nativním rozbalovacím bloku **Advanced keyswitch settings**, jehož otevřený stav se zachová při překreslení. Keyswitch i articulation sekvence jsou označené **ROLLER ORDER** a používají společné composer-first frosty chipy: hudební název nebo UACC název je primární a MIDI/CC číslo sekundární. Live nota dostane jemný zelený obrys. Pořadí lze měnit drag & dropem, přes **Alt + šipky** na zaměřeném chipu nebo přístupnými tlačítky **Move earlier/later**; pořadí chipů odpovídá pořadí krokování rolleru.

**Stepper controls:** Stejný frosty pill systém používají všechny číselné steppery v aplikaci (MIDI channel, CC, velocity a keyswitch FROM/TO): kompaktní neutrální −/+ segmenty bez mezer, užší skleněná kapsle hodnoty, skryté dělicí čáry a společné hover/focus chování. Také aktivní volba keyswitch convention používá frosty gray místo červené.

**UACC (Universal Articulation Control Code):**
Standard pro pojmenování CC hodnot používaný u Spitfire Audio, East West, Orchestral Tools atd. CC 32 je standardní UACC kanál.

Každá artikulace je CC hodnota (0–127) s volitelným pojmenováním (interní slovník `UACC_NAMES`).

**Správa seznamu artikulací:**
- Přidat jednotlivé hodnoty nebo aplikovat **Articulation templates**. Knihovní seznam aplikuje pouze artikulace a nepřepisuje mapování celého banku.
- Hodnoty mají drag & drop, **Alt + šipky** i přístupná tlačítka **Move earlier/later**; zobrazené pořadí je přímo pořadím krokování rolleru.
- Enkodér na zařízení přechází na další/předchozí hodnotu v seznamu.

**Klíčové funkce:** `encoderSectionContent()`, `addUacc()`, `moveUacc()`, `removeUacc()`, `applyArticulationList()`, `renderUacc()`, `uaccName()`

---

### 3.9 Device & Settings

Rozbalovací sekce obsahuje informace o zařízení, liquid-glass switch Keyboard (HID), sbalený **MIDI diagnostics** a kompaktní blok **Backup & reset**. Zapnutí HID používá vlastní přístupný glass dialog namísto nativního `confirm()`; Navigation a trvale viditelný Button Macro nabízejí stejnou akci **Enable Keyboard…** přímo v kontextu. Diagnostika ukazuje connection state, nalezený MIDI input, fyzicky aktivní bank, výsledné L/R/roller mapování, poslední MIDI event, firmware, HID a config hash; **Copy diagnostics** vytvoří textový support snapshot. **Device backup** má pouze tři akce pro celou konfiguraci zařízení: Export, Import a Reset; původní viditelný JSON inspector byl odstraněn. Reset vyžaduje potvrzení, obnoví `DEFAULT_CFG` jako lokální konfiguraci a nastaví `dirty=true`; zařízení se změní až po **Send to device**. Živé pozice faderů se resetem lokální konfigurace nemění.

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

Definován v `<script>` bloku appky (`const DEFAULT_CFG`, dohledatelné greppem). Obsahuje 3 předdefinované banky (Bank 1–3) s různými CC čísly a kanály. Použije se při prvním spuštění nebo po factory resetu.

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
      → isFeelFader(name): match "feel fader" | "circuitpython audio"
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
| `initWelcomeFaderOverlay()` | Zkopíruje PNG thumby z hlavního stage na welcome screen overlay. |
| ⚠ `renderFaderVisual()` | **Odstraněno** (value bar zrušen — viz komentář u `setBar`). |
| ⚠ `updateFaderVisual()` | **Odstraněno** (dtto). |
| `toggleDark()` | Přepne dark/light mode + uloží do localStorage. |
| `initDark()` | Načte preferenci dark mode při startu. |
| `applyLang()` | Aplikuje překlady (data-i18n atributy). Aktuálně pouze EN. |
| `validate()` | Validuje `cfg` — kontroluje duplicitní CC/kanál kombinace. |
| `openIconPicker(bi, mode)` | Otevře overlay pro výběr ikony banku. |
| `onImport(e)` | Importuje JSON konfiguraci ze souboru. |
| `refreshJson()` | Aktualizuje JSON inspector. ⚠ **Pozor:** dle strukturního auditu 2026-07-20 (D-3) je tohle mrtvá cesta — viditelný JSON inspector byl odstraněn, ale `jsonOpen`/`refreshJson`/`toggleJson`/`copyJson` v kódu zůstaly. Aktuální stav ověř v `docs/feel-fader-structure-audit-2026-07-20.md`. |
| `toast(t, m)` | Zobrazí dočasné notifikační hlášení (success/error/info). |
| `cfgSave()` | Uloží `cfg` do localStorage. |
| `cfgLoad()` | Načte `cfg` z localStorage, vrátí null pokud neexistuje. |

---

## 7. Fader Layout — Konstanty

Definovány v `<script>` bloku appky, těsně před `layoutFaders()` (dohledatelné greppem po `const FLX`):

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

Překlady jsou definovány v JS objektu `TRANSLATIONS` (řádek 3018; dřív dokumentováno jako `STRINGS`) a aplikovány přes `t(key)` + `applyLang()` na elementy s atributem `data-i18n="key"`. `currentLang` je natvrdo `'en'`.

Aktuálně podporován pouze **anglický jazyk**. Česká lokalizace není implementována — appka je primárně pro mezinárodní uživatele.

---

*Naposledy aktualizováno: 2026-07-20 (doc-drift oprava dle strukturního auditu — §1 Transport/Serial popis srovnán s §5, čísla řádků odstraněna napříč dokumentem ve prospěch jmen funkcí, opraveny §2/§4/§6/§7 nepřesnosti — viz `docs/feel-fader-structure-audit-2026-07-20.md` DOC-001/003/004/007)*
