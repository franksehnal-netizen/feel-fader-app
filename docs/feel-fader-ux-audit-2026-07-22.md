# Feel Fader — UX / vizuální audit (delta + spot-check)

**Datum:** 2026-07-22 · **Auditovaný soubor:** `feel-fader.html` (~6 000 řádků) · **Metoda:** render (Chrome DevTools MCP, viewport override 1280×900 a 390×844, interní‑stav‑poke — žádný reálný serial/SysEx) + statický rozbor CSS/JS · **Typ:** čistě diagnostika, bez zásahů do kódu · **Screenshoty:** nejsou v repu (v `docs/` se trackují jen `.md`) — archiv `Documents/feel-fader-scratch-archiv/2026-07-22/ux-audit-2026-07-22-screenshots/`

> **Rozsah:** delta oproti auditu 2026‑06‑27 — hloubkově nové/přepsané plochy (welcome, header/Live HUD, send/change‑history, bank tabs, library picker, encoder/keyswitch/roller order, device settings), namátkou staré, + explicitní regresní kontrola opravených bodů 06‑27.
>
> **Prostředí — přiznaná omezení:** (1) Na stroji je **fyzicky připojený Feel Fader** — appka se při každém načtení sama autoconnectne (`_ffConnected=true`, reálné hodnoty faderů 77/54). Welcome‑idle a connect‑transition proto nejdou zachytit „na čisto" bez simulace; welcome jsem auditoval přes bezpečný stav‑poke (bez serial/MIDI volání) + z kódu, kde je render nespolehlivý (blur controlleru ve welcome je **artefakt** simulace, ne nález). (2) Okno headful Chrome nejde zvětšit přes `resize_page` (strop ~644×349) — proto viewport override přes `emulate`; skutečná mobilní šířka jde jen tudy. (3) HID toggle a `Send to device` jsem **nespouštěl** (zápis do reálného HW = proti invariantu) — hodnoceno z kódu.

---

## 1. Executive summary

Appka je od 06‑27 znatelně dál — Live HUD, liquid‑glass, segmented control, keyswitch klaviatura, library picker, change‑history i validační navigace jsou **skutečně dobře navržené plochy**, které v renderu působí klidně a promyšleně (viz welcome, dark parita, device settings, validace). Dominují ale **dva vzorce, které appku drží pod „samozřejmým" dojmem**, a oba jsou z velké části **tichý regres už jednou dotažené disciplíny** — přesně to, kvůli čemu se dělá periodická hygiena:

1. **Jeden P1 funkční defekt na nové ploše.** Change‑history / Undo popover (§3.4) se renderuje **za** kartou banku a jeho tlačítka (**Undo**, **Restore last sent**) nejdou kliknout — `elementFromPoint` na „Undo (1)" vrací Library‑setup input. Klíčová nová feature je fakticky nefunkční. Příčina je čistě stacking (popover žije v `.send-callout` z‑index 10, pozdější `.bank-card` má `backdrop-filter` → vlastní kontext nad ním). Library picker, který sedí uvnitř karty, se přitom překresluje správně — kontrast potvrzuje diagnózu.

2. **Typografie a váhy se rozjely zpět.** 06‑27 sloučil font‑size na 6 stupňů a váhy na 3 (zrušeno 9/14/20 a Mulish 500). Dnes je v CSS **11 velikostí** (8/9/10/11/12/13/14/15/16/20/22) — vrátilo se **9 i 20** (explicitně zrušené) a přibyly **8 a 15** (15px opakovaně jako nadpis dialogů a bank‑name input), plus **Mulish 500** zpět ve třech místech. `WEBAPP.md §0` už drift částečně „posvětil" (cluster uvádí 14), ale 8/9/15/20 jsou mimo i ten přiznaný seznam.

3. **Nové plochy nedědí spacing/kontrast disciplínu.** V nejnovějším kódu (quick‑setup picker, keyswitch) se vrátily off‑grid mezery (5/7/11px) a informační text v `--t3`/`opacity:.5` pod 4.5:1 (quick‑setup labely, „?" help buttony) — tj. lokální regres V2 i A4 v místech, kam předchozí pass nesáhl.

4. **Drobné nekonzistence vizuálního jazyka.** Nativní `<select>` (RANGE PRESET) mezi jinak custom frosty controly; dvě velmi podobné zelené (`--green` #34c759 vs `--highlight` 76,175,105) na stejné obrazovce; neoznačený zelený přepínač „Show controller view" v headeru vedle dark‑toggle.

**Celkové hodnocení: ~82 % cesty k „Apple‑like dokonalému".** Posun proti 75 % z 06‑27 je reálný (nové plochy jsou z velké části na úrovni), ale brzdí ho **jeden opravdový bug (P1)** a **regres už hotových fixů** (typo/váhy/spacing/kontrast). Šlo tedy „hlavně o nové plochy", ALE regrese se objevila — a je to hlavní příběh tohoto auditu. Žádné fundamentální přepracování; sada cílených oprav, většina quick‑win.

---

## 2. Tabulka nálezů

| ID | Osa | Záv. | Název | Lokace |
|---|---|---|---|---|
| I‑1 | Interakce | **P1** | Change‑history / Undo popover se renderuje za kartou banku (neklikatelný) | `.change-popover` v `.send-callout` (z:10) vs `.bank-card` (backdrop‑filter) |
| V‑1 | Vizuál | **P2** | Type scale: 6 → 11 velikostí (9/20 zpět, nové 8/15) — **regrese V3** | napříč; 15px `.bank-name-input`/`.confirm-body strong`/`.library-preview-head strong` |
| V‑2 | Vizuál | **P2** | Mulish 500 zpět ve 3 místech — **regrese V4** | `.tx` (836), `.section-summary-sep` (1259), `.ks-key-label` (450) |
| V‑3 | Vizuál | **P2** | Off‑grid spacing v novém kódu (5/7/11px) — **částečná regrese V2** | `.quick-setup-group` (1465), `.quick-setup-group-label` (1466), `.ks-preset-sel` (459) |
| V‑4 | Vizuál | **P2** | RANGE PRESET je nativní `<select>` mezi custom frosty controly | `.ks-preset-sel` (459) |
| I‑2 | Přístupnost | **P2** | „?" help buttony: kontrast ~2.2:1 (`opacity:.5`) + touch 26–32px | `[aria-label^="Help"]`, fader hlavičky |
| S‑1 | Stavy | **P2** | Desktop: stav připojení po 3 s = holá 7px tečka bez labelu; dokumentovaný klikací hardware‑overview neexistuje | `renderConnState()` (4608–4616), `#h-status` |
| A‑1 | Responzivita | **P2** | Mobil 390px: `.bank-actions` přetéká, Remove (×) uříznut o ~9px za pravou hranou | `.bank-actions` (scrollW 372 > 336) |
| A‑2 | Přístupnost | **P2** | Nový informační text v `--t3` (9px) pod 4.5:1 — **částečná regrese A4** | `.quick-setup-group-label`/`-option-kind`/`-empty` (1466/1474/1475) |
| V‑5 | Vizuál | P3 | Dvě velmi podobné zelené na stejné obrazovce (`--green` vs `--highlight-rgb`) | `:root` 39/43; header + HID toggle |
| V‑6 | Vizuál | P3 | Icon picker: duplicitní titul (heading + eyebrow „Instrument category") | `#icon-picker` |
| I‑3 | Interakce | P3 | Header „Show controller view" — neoznačený zelený switch, účel nečitelný + kolize se zelenou = status | `#controller-toggle-input` (1589) |
| A‑3 | Přístupnost | P3 | `.device-info-toggle:focus{outline:none}` bez `:focus-visible` náhrady — **lokální regrese A1** | `.device-info-toggle:focus` (676) |
| V‑7 | Vizuál | P3 | „Active on device" glyf na tabu je subtilní mezi emoji ikonami banků | `.bank-tab-device` |

---

## 3. Detaily nálezů

### Osa — Interakce & flow

#### I‑1 — Change‑history / Undo popover se renderuje za kartou banku
- **Osa:** Interakce & flow
- **Závažnost:** P1
- **Co:** Klik na „N unsaved change(s)" otevře change‑popover, ale ten se vykreslí **pod** kartou banku — vidět je jen ~10px proužek nad hlavičkou karty, a tlačítka **Restore last sent** / **Undo (n)** nejdou kliknout. Ověřeno `elementFromPoint` na středu „Undo (1)": vrací `library-quick-input` (Library‑setup pole), ne tlačítko. Reprodukováno i z čistého přirozeného stavu (jediná změna CC přes stepper).
- **Kde:** §3.4, `.change-popover.is-open` (z‑index 30) je uvnitř `.send-callout` (`position:relative; z-index:10`); pozdější sourozenec `.bank-card` má `backdrop-filter` → zakládá vlastní stacking context a maluje nad z:10 kontextem. Nezávislé na výšce viewportu (karta je vždy hned pod send‑oblastí).
- **Proč to vadí:** Rozbitá klíčová nová feature (dirty review + Undo(n) + Restore) — R „stavy mají design" a základní R „zpětná vazba/akce fungují". Uživatel klikne na počet změn a nic použitelného se neobjeví. Kontrast: Library picker uvnitř karty se překresluje **správně** nad obsahem — potvrzuje, že jde o umístění popoveru mimo kartu.
- **Doporučení:** Popover portálovat do top‑level vrstvy (mimo `.send-callout`) s vlastní vysokou z‑index (nad `.bank-card`), nebo ho otevírat směrem nahoru do prázdné plochy mezi controllerem a send‑tlačítkem. Ověřit `elementFromPoint` na obou tlačítkách po fixu.
- **Zdroj:** render (`13-change-popover-occluded.png`) + kód

#### I‑2 — „?" help buttony: nízký kontrast + malý touch target
- **Osa:** Přístupnost & responzivita (+ discoverability)
- **Závažnost:** P2
- **Co:** Kontextové „?" u LEFT/RIGHT fader hlaviček mají `color:rgb(80,80,87)` s `opacity:.5` → efektivně ~`#a7a7ab` na bílé ≈ **2.2:1** (pod AA 4.5:1). Velikost 26×26 (resp. 32×32 dle selektoru), na `pointer:coarse` pod 44px.
- **Kde:** `[aria-label^="Help"]`, fader/roller hlavičky. Nový prvek (v 06‑27 neexistoval).
- **Proč to vadí:** R „preciznost/kontrast" + discoverability — nápověda, kterou skoro nevidíš, není nápověda. Zároveň nový touch‑gap proti A3 fixu.
- **Doporučení:** Zrušit `opacity:.5`, dát `--t2` (nebo `--t3` jen pokud ≥4.5:1), touch target ≥44px přes neviditelný hit‑padding (jako u step‑btn).
- **Zdroj:** render + kód

#### I‑3 — Header „Show controller view": neoznačený zelený switch
- **Osa:** Interakce & flow
- **Závažnost:** P3
- **Co:** V headeru je vedle dark‑toggle druhý přepínač — zelený switch (`rgba(76,175,105,.44)`) bez viditelného labelu. Sighted uživatel nevidí, co dělá (skrývá/zobrazuje controller); `aria-label` „Show controller view" má jen čtečka. Zelená navíc koliduje se sémantikou zelené = connected/success jinde v UI.
- **Kde:** `#controller-toggle-input` (1589), banner.
- **Proč to vadí:** R „100% intuitivní" + „jeden akcent/sémantika". Dvě neoznačené kapsle v headeru (zelený switch + slunce) — účel prvního je opaque, barva mate.
- **Doporučení:** Zvážit, zda control patří do headeru (spíš do view/settings), nebo ho udělat ikonograficky jednoznačným (ikona controlleru s on/off stavem) a **neutrální**, ne zelený — zelenou rezervovat pro status/success.
- **Zdroj:** render + a11y snapshot

### Osa — Vizuální jazyk

#### V‑1 — Type scale: 6 → 11 velikostí (regrese V3)
- **Osa:** Vizuální jazyk
- **Závažnost:** P2 (systémové, regresní)
- **Co:** V CSS je nyní **11** font‑size hodnot: 8/9/10/11/12/13/14/15/16/20/22px. Explicitně zrušené 06‑27 se vrátily: **9px** (`.live-hud.is-compact .live-hud-value`, `.quick-setup-group-label`, `.quick-setup-option-kind`), **20px** (`.bank-icon-display`). Nové mimo přiznaný cluster: **8px** (`.ks-key-label`), **15px** — a to opakovaně jako „nadpisová" velikost: `.bank-name-input` (542), `.confirm-body strong` (1220), `.library-preview-head strong` (1501). `WEBAPP.md §0` uvádí cluster 10/11/12/13/14/16/22 — 8/9/15/20 jsou mimo i tento přiznaný seznam.
- **Kde:** viz řádky výše.
- **Proč to vadí:** R „typografická hierarchie — omezené stupně". 15 vs 16 a 12 vs 13 oko nevnímá jako hierarchii, jen jako šum; 8px je na hraně čitelnosti.
- **Doporučení:** Vrátit se k 6 stupňům (22/16/13/12/11/10). 15px → 16 (nadpisy dialogů/bank‑name), 20px ponechat jen jako **icon glyph** (ne text), 9/8px konsolidovat na 10 (nebo přiznat jako jediný „mono‑micro" stupeň, ne rozšiřovat). Zvážit `--fs-*` tokeny, ať drift nejde tiše zopakovat.
- **Zdroj:** kód (grep font‑size)

#### V‑2 — Mulish 500 zpět zpět (regrese V4)
- **Osa:** Vizuální jazyk
- **Závažnost:** P2
- **Co:** 06‑27 sloučil váhy na 400/600/700 a zrušil **Mulish** 500 (mono 500 ponechán jako jediná numerická). Mulish 500 se vrátil: `.tx` (836, `font:500 11px 'Mulish'`), `.section-summary-sep` (1259, `font:500 10px 'Mulish'`), `.ks-key-label` (450, `font-weight:500`). Mono 500 (472/646/649/658/1202/1209/1258/1383) je OK (přiznaná výjimka).
- **Kde:** viz výše.
- **Proč to vadí:** R „max 3 váhy". 500 vs 600 v Mulish je subtilní rozdíl bez hierarchického významu.
- **Doporučení:** `.tx` a `.section-summary-sep` → 600 (nebo 400 dle role); `.ks-key-label` → 600.
- **Zdroj:** kód

#### V‑3 — Off‑grid spacing v novém kódu (částečná regrese V2)
- **Osa:** Vizuální jazyk
- **Závažnost:** P2
- **Co:** Nejnovější sekce zavedly off‑grid mezery mimo přiznaný set (WEBAPP §0 uvádí 8/12/16/28): `5px` (`.quick-setup-group` margin/padding‑top 1465, `.ks-key-label` bottom 450), `7px` (`.quick-setup-group-label` padding 1466, `.quick-setup-option` padding 1468), `11px` (`.quick-preset-btn` padding 1476). 06‑27 přesně tyto (5/7) srovnával na 4px grid.
- **Kde:** viz výše (quick‑setup picker, keyswitch).
- **Proč to vadí:** R „jeden spacing rytmus". Drobné nekonzistence se sčítají do pocitu „lehce neuspořádané".
- **Doporučení:** Zaokrouhlit na 4/8/12; do budoucna `--space-*` tokeny (přiznaný gap — ale nová plocha ať alespoň drží existující raw hodnoty).
- **Zdroj:** kód

#### V‑4 — RANGE PRESET je nativní `<select>`
- **Osa:** Vizuální jazyk / Interakce
- **Závažnost:** P2
- **Co:** RANGE PRESET v keyswitch módu je **nativní** `<select>` (ověřeno `tagName==='SELECT'`), s OS‑popupem a nativním chevronem — mezi jinak custom frosty controly (Library setup je plně custom searchable picker, steppery/segmented/keyboard custom). Rozbíjí to jednotný interakční jazyk.
- **Kde:** `.ks-preset-sel` (459).
- **Proč to vadí:** R „konzistence — jeden interakční jazyk". Nativní OS dropdown vypadá i chová se jinak (font, popup, focus) než zbytek.
- **Doporučení:** Nahradit stejným custom listbox pickerem jako Library setup (už existuje jako vzor), nebo alespoň sjednotit tvar/hover/focus s frosty controly.
- **Zdroj:** render (`10-keyswitch.png`) + kód

#### V‑5 — Dvě podobné zelené na stejné obrazovce
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Success/connected zelená je konsolidovaná do `--green` #34c759 (52,199,89) + tinty — **dobře** (viz regrese V1 níže). Vedle ní ale žije `--highlight-rgb: 76,175,105` (jiná zelená) pro „live/active" akcent — a používá se na header switch a HID toggle. Uživatel vidí dvě téměř shodné, ale ne identické zelené současně.
- **Kde:** `:root` ř. 39 vs 43; header/HID toggle vs status dot/`✓ Sent`.
- **Proč to vadí:** R „jeden akcent". Dva blízké odstíny stejné barvy působí jako nechtěná nepřesnost, ne jako záměrná sémantika.
- **Doporučení:** Buď sjednotit „on/live" akcent na `--green` (iOS‑switch je ostatně #34C759), nebo highlight posunout dost daleko, aby byl čitelně jiný záměr; ideálně toggle „on" = `--green`.
- **Zdroj:** render + kód

#### V‑6 — Icon picker: duplicitní titul
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Dialog výběru ikony má nadpis **„Instrument category"** a hned pod ním eyebrow **„INSTRUMENT CATEGORY"** — dvojí totéž.
- **Kde:** `#icon-picker`.
- **Proč to vadí:** R „redukce — pryč s tím, co nenese funkci".
- **Doporučení:** Ponechat jen jeden (nadpis), eyebrow zrušit.
- **Zdroj:** render (`22-icon-picker.png`)

#### V‑7 — „Active on device" glyf je subtilní mezi emoji ikonami
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Editovaný bank = frosty pill (jasné). Fyzicky aktivní bank = malý monochromatický controller‑glyf (`.bank-tab-device` SVG) před názvem. Když je aktivní bank ≠ editovaný, glyf je snadno zaměnitelný s emoji ikonami ostatních banků (banky mají 🎻🎺… ikony) — na první pohled nepoznáš, který je „live". Zmírněno `title`/`aria`/first‑run vysvětlením.
- **Kde:** `.bank-tab-device`, `renderBankTabs()`.
- **Proč to vadí:** R „stav má design / preciznost". Rozlišení edited vs active drží strukturálně (dva různé kanály), ale glyf je opticky slabý.
- **Doporučení:** Silnější odlišení „active on device" — např. barevná (green) tečka/rámeček glyfu, ne šedý line‑icon vedle barevných emoji.
- **Zdroj:** render (`16-edited-vs-active.png`) + kód

### Osa — Stavy & edge cases

#### S‑1 — Desktop: stav připojení po 3 s = holá tečka; dokumentovaný overview neexistuje
- **Osa:** Stavy & edge cases
- **Závažnost:** P2
- **Co:** Po přechodu DISCONNECTED→LIVE se text „device connected" ukáže na **3 s** a pak se collapsne (`txt.classList.add('hidden')`, `opacity:0; max-width:0`) — na desktopu pak zbývá jen **7px zelená tečka bez labelu**. `#h-status` navíc **není tlačítko** (`elementFromPoint`/snapshot: žádný role=button, žádný click handler), takže `WEBAPP.md §3.2` popsaný „liquid‑glass přehled Hardware/Live MIDI/Configuration + Open diagnostics" po kliknutí **v kódu není** (doc‑drift). Vracející se uživatel má pro potvrzení „zařízení žije" jen malou tečku (Live HUD sice ukazuje hodnoty, ale bez explicitního „connected").
- **Kde:** `renderConnState()` ř. 4608–4616; `#h-status` ř. 1572–1575. (Chybové stavy `MIDI_BLOCKED`/`DISCONNECTED` text NEcollapsují a mají červenou/šedou tečku — to je OK, viz regrese S1.)
- **Proč to vadí:** R „stav má design". Primární status na desktopu je po 3 s prakticky neverbální; slíbený sekundární kanál (klik → detail) chybí.
- **Doporučení:** Buď ponechat kompaktní „Connected"/název portu trvale čitelný na desktopu (je tam místo), nebo skutečně zpřístupnit klikací overview dle WEBAPP (a doc srovnat s kódem). Minimálně: hover/`title` je slabá náhrada — přidat viditelný, byť malý label.
- **Zdroj:** render + kód

### Osa — Přístupnost & responzivita

#### A‑1 — Mobil 390px: bank‑actions přetéká, Remove (×) uříznut
- **Osa:** Přístupnost & responzivita
- **Závažnost:** P2
- **Co:** V hlavičce karty banku má `.bank-actions` `scrollWidth 372 > clientWidth 336` (`overflow:visible`), tlačítko **Remove Bank** (`margin-left:auto`) je vytlačené na `right≈399px` při viewportu 390 → **uříznuté o ~9px** za pravou hranou. Zbytek tlačítek (move‑left/right, duplicate) navíc plave uprostřed s velkou prázdnou mezerou vlevo — řada působí nevyvážně.
- **Kde:** `.bank-actions` v bank name kartě; `.bank-name-top .btn-remove-bank{margin-left:auto}` (1330).
- **Proč to vadí:** R „responzivita — nic se neuřízne; touch target dosažitelný". Delete je na mobilu jediná cesta smazat bank a je částečně mimo obrazovku.
- **Doporučení:** Na mobilu akce zabalit do `flex-wrap`/rovnoměrného rozložení bez `margin-left:auto` přetékajícího za hranu; zajistit, že × je celé uvnitř safe‑area.
- **Zdroj:** render (`17-mobile-390.png`) + měření

#### A‑2 — Nový informační text v `--t3` (9px) pod kontrastem (částečná regrese A4)
- **Osa:** Přístupnost & responzivita
- **Závažnost:** P2
- **Co:** 06‑27 promotoval informační texty z `--t3` na `--t2` (AA). Nové prvky ale zavádějí `--t3` (#aeaeb2 ≈ 1.9:1 na bílé) zpět pro čitelný text: `.quick-setup-group-label` (9px uppercase), `.quick-setup-option-kind` (9px), `.quick-setup-empty` (11px). Plus „?" help (viz I‑2).
- **Kde:** ř. 1466/1474/1475.
- **Proč to vadí:** R „kontrast ≥4.5:1". Skupinové labely v pickeru jsou informace, ne dekorace.
- **Doporučení:** `--t3` → `--t2` pro tyto labely (dark mód těží automaticky). `--t3` držet jen pro čistě dekorativní prvky.
- **Zdroj:** kód

#### A‑3 — `.device-info-toggle:focus{outline:none}` bez náhrady (lokální regrese A1)
- **Osa:** Přístupnost & responzivita
- **Závažnost:** P3
- **Co:** Globální `:focus-visible{outline:2px solid var(--focus)}` (1338) je zpět a funguje (ověřeno renderem — stepper/CC input i sekce mají viditelný modrý ring). Výjimka: `.device-info-toggle:focus{background:none;outline:none;}` (676) má vyšší specificitu a **nemá** `:focus-visible` náhradu → hlavička „Device & Settings" nemá při klávesnicovém focu viditelný ring.
- **Kde:** ř. 676.
- **Proč to vadí:** R „klávesnicový focus viditelný". Jediný prvek, ale je to přesně vzor, který 06‑27 (A1) odstraňoval.
- **Doporučení:** Smazat `outline:none` z `:focus` (globální `:focus-visible` řeší), nebo doplnit vlastní `:focus-visible` ring. **Quick win.**
- **Zdroj:** kód

---

## 4. Quick wins (vysoký dopad / nízký náklad)

1. **A‑3** — smazat `outline:none` z `.device-info-toggle:focus` (676); globální `:focus-visible` řeší. 1 řádek.
2. **I‑2 / A‑2** — zrušit `opacity:.5` na „?" help a `--t3`→`--t2` na quick‑setup labelech; okamžitě přes 4.5:1. Pár řádků.
3. **V‑6** — odstranit duplicitní eyebrow v icon pickeru. 1 řádek.
4. **V‑2** — `.tx`/`.section-summary-sep`/`.ks-key-label` Mulish 500 → 600. 3 řádky.
5. **I‑1 (P1, o něco větší, ale kritické)** — portálovat change‑popover mimo `.send-callout` s vyšší z‑index. Nejvyšší priorita dopadem (rozbitá feature) i když ne „1 řádek".

---

## 5. Regresní kontrola (body 06‑27)

| Bod 06‑27 | Stav | Kde / poznámka |
|---|---|---|
| **V1** — sémantická zelená fragmentovaná do víc hodnot | **DRŽÍ** | Konsolidováno do `--green` #34c759 (52,199,89) + `--green-bg/-border/-text`; `.send-btn.sent` je nyní `var(--green)` (staré hardcoded `#3a7a3a` pryč). `#2e7d32` u `.h-badge.prod` je přiznaná výjimka. **Nuance:** vedle žije 2. zelená `--highlight-rgb` 76,175,105 → viz V‑5 (P3). |
| **V2** — spacing mimo 4px grid | **ČÁSTEČNÁ REGRESE** | Nový kód (quick‑setup, keyswitch) zavedl off‑grid 5/7/11px → viz V‑3. Starší plochy srovnané drží. |
| **V3** — typografie sloučená na 6 stupňů (zrušeno 9/14/20) | **REGRESE** | Nyní 11 velikostí; vrátilo se 9 a 20, přibylo 8 a 15 → viz V‑1. |
| **V4** — váhy sloučené na 3 (zrušeno Mulish 500) | **ČÁSTEČNÁ REGRESE** | Mulish 500 zpět ve `.tx`, `.section-summary-sep`, `.ks-key-label` → viz V‑2. Mono 500 OK. |
| **A1** — `button:focus{outline:none}` rušil focus | **DRŽÍ** (1 výjimka) | Globální `:focus-visible` ring přítomen a funkční. Výjimka `.device-info-toggle:focus{outline:none}` → viz A‑3 (P3). |
| **A2** — inputy bez focus stavu | **DRŽÍ** | Inputy mají `:focus-visible` ring (`.stepper input:focus-visible` 422, `.bank-name-input:focus-visible` 547, globální). Ověřeno renderem — CC input má jasný modrý ring. |
| **A3** — touch targety pod 44px | **DRŽÍ** (nové výjimky) | `@media(pointer:coarse)`: step‑btn/remove‑bank/icon‑picker = 44px (ověřeno). Nové výjimky: „?" help 26–32px, toast close 32px → viz I‑2. |
| **A4** — kontrast `--t3` pod 4.5:1 | **ČÁSTEČNÁ REGRESE** | Staré info texty drží na `--t2`. Nové prvky (quick‑setup labely `--t3` 9px, „?" help `opacity:.5`) pod 4.5:1 → viz A‑2, I‑2. |
| **S1** — error/unsupported vypadá jako „searching" | **DRŽÍ** | `renderConnState()`: `MIDI_BLOCKED` = červená (err) tečka + text; `DISCONNECTED` = neutrální tečka + „no device"; `CONNECTED_LIVE` = zelená. Chyba je odlišená. (Samostatný desktop nález S‑1 je o jiném — collapsu labelu, ne o záměně chyby s hledáním.) |

---

*Pozn. k evidenci: welcome‑idle, dark parita a všechny nové plochy hodnoceny z reálného renderu (viz screenshoty). Connect‑transition animace, live pohyb faderů z HW a HID‑enable dialog hodnoceny z kódu (reálný HW zápis/serial jsem dle invariantu nespouštěl). Blur controlleru na welcome screenshotu je artefakt vynucené simulace (controller se v reálném flow přesouvá do welcome slotu nad blur), ne nález.*
