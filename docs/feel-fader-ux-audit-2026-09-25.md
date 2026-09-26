# Feel Fader – UX / UI audit očima skladatele

**Datum:** 2026-09-25 · **Auditovaný soubor:** `feel-fader.html` (8 587 řádků, HEAD `2390791`) · **Typ:** čistě diagnostika, bez zásahů do kódu
**Metoda:** render v headless Chrome (1440×900, 1024×768, light + dark) přes interní‑stav‑poke (žádný reálný serial/MIDI/SysEx), skriptované ověření chování + statický rozbor CSS/JS.
**Screenshoty a skripty:** `Documents/feel-fader-scratch-archiv/2026-09-25/ux-audit-composer-screenshots/` (mimo repo).

> **Úhel pohledu:** předchozí audity (06‑27, 07‑22) hodnotily hlavně vizuální řemeslo. Tenhle se ptá, jestli appka funguje pro **skladatele u DAW**: rychle nastavit bank pro knihovnu, jezdit dynamikou/expresí, spolehlivě přepínat artikulace a věřit tomu, co je v zařízení. Konzistenci hodnotím tam, kde ovlivňuje tyhle úlohy.
>
> **Přiznaná omezení:** appka běžela z `file://`, proto header ukazuje „MIDI blocked" (artefakt, ne nález). Full‑page screenshoty mají artefakty sticky headeru a švu pozadí (není nález). Stav s reálným HW (živé hodnoty, Send přes serial) hodnocen z kódu.

> **Stav (2026-09-25):** sprint 1 hotový – F‑1, F‑3, C‑6 a z F‑2 štítky mechanismu (tím i K‑6). Sprint 1b hotový – presety ověřeny a opraveny (F‑2) a opraven nově nalezený **F‑4: chybná UACC tabulka**. Sprint 2 hotový – C‑1, C‑3, C‑4, C‑7 a po Frankově volbě C‑2 (varianta C, HUD 144 px) a C‑5 (souhrny obnoveny). Sprint 3 hotový – K‑1 až K‑5 včetně `--fs-*` / `--space-*` tokenů a WEBAPP §0. 2026‑09‑26: M‑1 (mobilní HUD 112 px), K‑7 včetně welcome „Connect & load“ (červený primární pill, Frank schválil). Nález M‑1 (mobilní HUD 96 px překrýval L/R s hodnotami) vyřešen větším čtvercem. Detail v `docs/TODO.md`.

---

## 1. Executive summary

Appka je vizuálně klidná a řemeslně dotažená. Library preview, undo historie, validační navigace a keyswitch klaviatura jsou nadprůměrné. Bug I‑1 z auditu 07‑22 (change popover za kartou) je opravený. Pro skladatele ji ale drží zpátky **tři věci, které podkopávají důvěru**, a **jedna slepá skvrna v hudebním jazyce**:

1. **Samotné prohlížení vytváří změny.** Stačí kliknout na mód Keyswitch a vrátit se zpět, a appka hlásí neuloženou změnu a Send zčervená (ověřeno skriptem). Indikátor „unsaved changes" pak přestává znamenat „něco jsem změnil".
2. **Vestavěné knihovní presety slibují víc, než umí.** Kontakt Factory, EW Hollywood a OT Berlin jsou definované jako UACC hodnoty na CC32, ale tyhle knihovny UACC standardně nepoužívají (u Kontakt Factory jisté, u EW/OT je potřeba ověřit). Skladatel aplikuje preset, roller nic nedělá a za chybu označí hardware.
3. **Hodnota artikulace se plete s CC číslem.** Pole pro přidání artikulace má placeholder „CC 0–127", aria „Articulation MIDI CC" a neznámá hodnota se zobrazí jako „CC 42". Ve skutečnosti jde o **hodnotu** na CC32. Skladatel tam napíše 32, nebo si myslí, že každá artikulace je jiné CC.
4. **Keyswitche nemají jména.** UACC chipy ukazují „Legato", „Short – Staccato", ale keyswitch sekvence (včetně LUX presetů, kde autor jména zná a má je v komentářích kódu) ukazuje jen „C0 · 24". V Live HUD pak skladatel během hraní vidí notu, ne artikulaci.

Konzistence: typová škála se znovu rozjela (14 velikostí proti 7 v kontraktu, nově i 7px a 8px v Live HUD), jsou tu tři různé styly boolean přepínačů (včetně browserově modrého checkboxu mimo paletu) a červená současně znamená hlavní akci, výběr i destruktivní Reset.

**Verdikt:** žádné přepracování. Stačí 3 opravy důvěry (P1), 7 cílených workflow úprav pro skladatele (P2) a hygienický průchod konzistencí (P3). Většina P1/P2 jsou malé zásahy.

---

## 2. Tabulka nálezů

| ID | Záv. | Osa | Název | Lokace |
|---|---|---|---|---|
| F‑1 | **P1** | Důvěra | Přepnutí na Keyswitch a zpět = fantomová neuložená změna | `setRollerMode()` ~4120 |
| F‑2 | **P1** | Důvěra | Knihovní presety tvrdí UACC u knihoven bez UACC | `LIBRARY_PRESETS` ~7819–7855 |
| F‑3 | **P1** | Jazyk | Artikulační *hodnota* pojmenovaná jako „CC" | `#uacc-input` ~3372, `uaccName()` 2637, `addUacc()` 4466 |
| C‑1 | P2 | Skladatel | Keyswitche bez jmen artikulací (asymetrie s UACC) | keyswitch data model, presety LUX/SSO |
| C‑2 | P2 | Skladatel | Live HUD nečitelný při hraní (7–10 px, `--t3`) | CSS ~279–313 |
| C‑3 | P2 | Skladatel | Dva paralelní mechanismy artikulací (Library setup vs Articulation templates) | `UACC_TEMPLATES` 4327, `applyUaccTemplate()` |
| C‑4 | P2 | Skladatel | Aplikace knihovny nepojmenuje bank | `applyLibraryPreset()` 8419 |
| C‑5 | P2 | Skladatel | Sbalené sekce neukazují mapování; jen Button má souhrn | `sectionHeaderHtml()` ~2700 |
| C‑6 | P2 | Skladatel | Chybí Ctrl/Cmd+S (Send) a Ctrl/Cmd+Z (Undo) | globální `keydown` |
| C‑7 | P2 | Jazyk | Relative CC text předpokládá Ableton + neexistující M4L device | `ccRelativeBody()` 3602 |
| K‑1 | P3 | Konzistence | Tři styly boolean přepínačů; nativní checkbox v browserové modré | 3591, 3662, CSS 2129 |
| K‑2 | P3 | Konzistence | Key‑capture tlačítka mimo pill/glass systém (inline styly) | 3581–3587, 3651 |
| K‑3 | P3 | Konzistence | Typová škála 14 velikostí, 5 vah, radiusy mimo kontrakt | inline `<style>` |
| K‑4 | P3 | Konzistence | Červená = CTA i výběr i destruktivní akce | Send / Apply / Reset / KS range |
| K‑5 | P3 | Jazyk | Nekonzistentní názvosloví a velikost písmen v labelech | roller sekce |
| K‑6 | P3 | Konzistence | „Starting point" na každé položce knihovny = nulová informace | 8014 |
| K‑7 | P3 | Konzistence | Drobnosti: „1 Bank 1", neoznačený toggle v headeru, × barva light≠dark, dvě velikosti tlačítek v KS řádku | header, bank card |

---

## 3. Detaily

### P1 – důvěra a jazyk

#### F‑1 – Prohlížení módů rolleru zakládá neuloženou změnu
**Ověřeno skriptem:** čistý stav (`dirty=false`) → `setRollerMode(0,'keyswitch')` → `setRollerMode(0,'cc')` → `dirty=true`, change list `["Bank 1: articulations / keyswitches"]`, config se liší v `ks_notes`. Stejně po průchodu Navigation.
**Příčina:** `setRollerMode()` při vstupu do Keyswitch inicializuje prázdné `ks_notes = ksRange(0,11)` a tahle mutace zůstane i po návratu.
**Dopad na skladatele:** zvědavost („co umí Keyswitch?") se trestá červeným Send a „1 unsaved change". Ztrácí se hlavní signál appky: „zařízení ≠ appka".
**Doporučení:** výchozí rozsah zobrazovat jako *placeholder* (render‑only default) a do `cfg` ho zapsat až při první skutečné editaci, nebo až při přepnutí, které uživatel potvrdí odesláním. Alternativa: `configChangeItems()` ignoruje `ks_notes`, pokud `roller_mode !== 'keyswitch'` v obou snapshotech. Přidat probe: switch tam a zpět → `dirty === false`.

#### F‑2 – Vestavěné presety slibují UACC tam, kde nefunguje
`Kontakt Factory`, `EW Hollywood Strings/Brass`, `OT Berlin Strings/Brass` jsou čisté `uacc_values` na CC32. UACC nativně podporuje Spitfire. Kontakt factory instrumenty UACC nemají. EW (Play/Opus) a OT (SINE) přepínají artikulace keyswitchem nebo vlastním, uživatelsky mapovaným CC. **Ověřit proti aktuálním verzím knihoven**, ale riziko je vysoké.
Badge „Starting point" a upozornění v preview („confirm CC and articulation support…") odpovědnost přesouvá na uživatele, problém ale neřeší. Skladatel nemá jak poznat, že preset *principiálně* nebude fungovat.
**Doporučení:** (a) presety bez ověřené UACC podpory buď přepsat na keyswitch sekvence (jako LUX/SSO), nebo odstranit; (b) místo „Starting point" zobrazit u každé položky **mechanismus** („UACC · CC32" / „Keyswitch C0–G0"); (c) Kontakt Factory odstranit.

**Ověření (2026-09-25, web + manuály):**

| Preset | Výsledek | Zdroj |
|---|---|---|
| Spitfire (BBCSO, Chamber Strings, Brass, Woodwinds) | UACC podporují, ale **jen po přepnutí articulation locku v pluginu na „Locked to UACC"** – ve výchozím stavu CC32 nereaguje | SCS manuál App. E; Spitfire Help „Switching Articulations" |
| EW Hollywood Strings / Brass (Opus) | **UACC ne.** Výchozí je keyswitch, trigger lze per artikulace přemapovat v Opus palette, ale bez UACC tabulky | soundsonline, Opus review, Cakewalk forum |
| OT Berlin Strings / Brass (SINE) | **UACC ne.** SINE přiřazuje artikulacím rovnoměrně rozložené CC hodnoty; na UACC je nutné je ručně přemapovat | Babylonwaves Art Conductor (SINE), VI-Control |
| Kontakt Factory | **Nemá žádný artikulační standard** (úvaha, ne ověřeno zdrojem) | – |

**Opraveno (2026-09-25):** presety EW/OT/Kontakt Factory odstraněny (z library pickeru i z dropdownu šablon). Spitfire presety postavené znovu na hodnotách UACC v2 a jejich preview říká „set the articulation lock to Locked to UACC“.

#### F‑4 (P1, nový) – Tabulka `UACC_NAMES` neodpovídá UACC v2 specifikaci
Porovnání se spec (SCS manuál Appendix E + tabulka na syntheticorchestra.com, oba shodné) ukazuje, že `UACC_NAMES` (~2620) sedí jen u 70–73 (trilly) a 90/91 (FX). Zbytek je posunutý nebo vymyšlený:

| Hodnota | Appka | UACC v2 spec |
|---|---|---|
| 1 | Legato | Long – Generic |
| 20 | Long – Sustain | Legato – Generic |
| 26 | Long – Sul Ponticello | Legato – Muted |
| 40 | Short – Détaché | Short – Generic |
| 43 | Short – Pizzicato | Short – Very short soft |
| 52 | Short – Harmonics | Short – Marcato |
| 56 | – | Short – Plucked (pizzicato) |
| 100 / 101 | Crescendo / Diminuendo | Up (rips & runs) / Down (falls & runs) |

Dopad: štítky chipů, Live HUD i výběr hodnot v presetech a šablonách (`legato: [1..5]` jsou ve spec Long varianty) jsou pro Spitfire knihovny zavádějící. Skladatel vidí „Pizzicato", knihovna hraje něco jiného. Uložené hodnoty v configu jsou čísla, takže oprava tabulky nevyžaduje migraci. Změní se jen popisky, které pak odpovídají skutečnosti. Komentář „compatible with East West, Orchestral Tools, Cinesamples" je nepravdivý.

**Opraveno (2026-09-25):** `UACC_NAMES` přepsána podle v2 spec (1–19, 20–36, 40–61, 70–82, 90–105, 110–112). Šablony: „UACC common techniques“ (nahrazuje „Spitfire UACC (full)“), Legato 20–33, Shorts 40–61. Hlídá `uacc-v2-spec-probe`.

#### F‑3 – „CC 0–127" u artikulací je věcně špatně
Pole pro přidání artikulace: placeholder `CC 0–127`, `aria-label="Articulation MIDI CC"`, toast `uacc_range`, a `uaccName()` vrací pro neznámou hodnotu `CC ${v}`. Hned nad tím je pole **MIDI CC = 32**. Skladatel čte: „artikulace je CC", ale ve skutečnosti je to **hodnota 0–127 posílaná na CC32**.
**Doporučení:** placeholder `Value 0–127`, aria `Articulation value (UACC)`, fallback jméno `Value 42`. Ideálně přidávat artikulaci **podle jména** (autocomplete nad `UACC_NAMES`), číslo až jako sekundární cesta.

### P2 – workflow skladatele

#### C‑1 – Keyswitche bez jmen
UACC chipy mají hudební jména, keyswitch chipy jen notu. LUX a SSO presety znají jména artikulací (jsou v komentářích `LIBRARY_PRESETS`), ale data je nenesou. Live HUD během hraní ukáže „C0", ne „Legato".
**Doporučení:** volitelné `ks_names` (jméno na notu, jen v appce, firmware nepotřebuje), editovatelné v chipu. Presety LUX/SSO rovnou vyplnit. HUD a chipy pak ukazují jméno, nota zůstane sekundární (stejný vzor jako UACC „název primárně, číslo sekundárně").

#### C‑2 – Live HUD je příliš malý na to, k čemu slouží
Live HUD je jediné místo, kam skladatel během hraní kouká. Písmo: hodnota `10px`, roller hodnota `9px`, label `8px`, technický řádek `Ch·CC` **7px v `--t3`** (#aeaeb2 na bílé ≈ 2:1, výrazně pod 4.5:1). Na 1440×900 je `Ch1·CC11` na hranici čitelnosti (viz `02-app-top.png`).
**Doporučení:** hodnota ≥ 16–20 px (je to „metr", ne popisek), label ≥ 10 px, tech řádek ≥ 10 px v `--t2`. Pokud se to do 112×112 nevejde, zvětšit HUD; tech řádek zobrazit až po hoveru.

#### C‑3 – Dvě cesty k artikulacím, které se překrývají
Library setup (preview dialog, „Articulations only") a **Articulation templates** (dropdown u roller order) dělají totéž jinak. Šablona `spitfire` je 1:1 shodná se seznamem `Spitfire BBCSO`. Šablony se aplikují **bez preview**, jen s toastem, a volba „Clear" smaže celý seznam bez potvrzení. Library setup přitom potvrzení vyžaduje.
**Doporučení:** jeden mechanismus. Buď šablony přesunout do library pickeru jako generické setupy („UACC – Legato set", „UACC – Shorts"), nebo je ponechat, ale vést stejným preview dialogem. „Clear" sjednotit s mazáním banku (potvrzení nebo toast s Undo).

#### C‑4 – Aplikace knihovny nepojmenuje bank
Po „Apply setup: Spitfire BBCSO" zůstane bank „Bank 1" (ikona se změní). Na zařízení se banky cyklují krátkým stiskem a skladatel potřebuje vědět, že „bank 2 = BBCSO Strings".
**Doporučení:** pokud má bank výchozí jméno `Bank N`, přejmenovat ho na název knihovny (zkrácený na limit 12 znaků). Jinak v preview nabídnout řádek „Bank name: Bank 1 → BBCSO" se zaškrtnutím.

#### C‑5 – Sbalené sekce neříkají, co je namapované
Sbalená karta ukazuje jen „Expression / Dynamics / Articulation / Macro". Mapování (Ch/CC) bylo záměrně přesunuto do Live HUD (WEBAPP §3.2), jenže HUD má 7px text (C‑2) a ukazuje jen *aktuální* bank. Kontrola „jaké CC má levý fader v banku 5" = otevřít sekci. Navíc **jen Button** má souhrn vpravo („Keyboard off"), ostatní tři ne. To je nekonzistence v rámci jedné karty.
**Doporučení:** vrátit do hlavičky všech čtyř sekcí kompaktní souhrn (`Ch1 · CC11`, `UACC · 11 values`, `KS C‑2–B‑2`). Stejný vzor, jaký už má Button. Rozhodnutí z 3.2 přehodnotit s ohledem na C‑2.

#### C‑6 – Chybí klávesové zkratky, na které jsou DAW uživatelé zvyklí
Globální `keydown` řeší jen Escape a key capture. **Ctrl/Cmd+S** dnes spustí browserové „Uložit stránku", **Ctrl/Cmd+Z** mimo input nic nedělá, přestože appka má 10‑krokovou undo historii.
**Doporučení:** Ctrl/Cmd+S → `doSend()` (pokud dirty a připojeno), Ctrl/Cmd+Z → `undoLastConfigChange()` mimo textová pole. Uvést v Help & Guide.

#### C‑7 – Relative CC předpokládá Ableton
Text: „The keyswitch note list lives in the **Keyswitch Stepper Max for Live device** on the track, not here." Uživatel Cubase/Logic/Studio One neví, co to je, odkaz chybí a z appky není jasné, jestli takové zařízení existuje ke stažení.
**Doporučení:** DAW‑neutrální popis („sends +1/−1 steps; your DAW or plugin decides what a step does") a Ableton‑specifickou poznámku s odkazem jen jako doplněk. Pokud M4L device není veřejně k dispozici, větu odstranit.

### P3 – konzistence

#### K‑1 – Tři styly boolean přepínačů
Liquid‑glass switch (Keyboard HID, header controller view), nativní checkbox **bez `accent-color`**, tedy v browserové modré, která v paletě není (Macro „Global", Navigation „Invert", viz `04-open-macro.png`), a checkbox s `accent-color: var(--red)` (custom preset scope). Sjednotit na glass switch pro on/off nastavení.

#### K‑2 – Key‑capture tlačítka mimo design systém
„Roll up / Roll down / Long‑press key" jsou `.step-btn` s inline stylem (`border-radius:var(--r-sm)`, `border-s`) a vypadají jako hranaté boxy mezi pill controly. Prázdný stav je „—" (jinde „Not assigned"), capture nemá viditelný stav „Press a key…". V šablonách je celkem 53 inline `style=` atributů. Doporučení: komponenta `.ui-keycap` (pill/glass) + text „Press keys…" během capture.

#### K‑3 – Typová škála a radiusy znovu mimo kontrakt
- **font-size:** 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 22 px (**14 hodnot**, kontrakt WEBAPP §0 uvádí 7: 10/11/12/13/14/16/22). 7/8/9 px jsou nové v Live HUD.
- **font-weight:** 300/400/500/600/700 (5, cíl z 06‑27 byly 3).
- **border-radius:** raw 7, 8, 9, 10, 11, 13, 26 px vedle tokenů (kontrakt: „Žádná jiná hodnota").
Doporučení: zavést `--fs-*` a `--space-*` tokeny (gap uvedený ve WEBAPP §0) a jednorázově přemapovat. Bez tokenů se drift vrací po každé nové ploše (potřetí za sebou).

#### K‑4 – Červená nese tři různé významy
`--red` je v kontraktu „Chyba / danger", ale plní ho i **Send to device** (hlavní CTA), **Apply setup**, výběr rozsahu na keyswitch klaviatuře a **Reset** (destruktivní). Send a Reset vypadají identicky. Doporučení: červenou ponechat jako brand CTA (sedí k červeným capům), destruktivní akce odlišit (outline + červený text). Kontrakt v WEBAPP přejmenovat na „brand/primary" a přidat `--danger`.

#### K‑5 – Názvosloví a casing
- Segmenty: „Articulation (CC)", „Navigation (keys)" vs „Keyswitch", „Relative CC" (závorky u poloviny). Hlavička sbalené sekce: „Articulation" bez „(CC)".
- Sekce se jmenuje **Roller**, nápověda uvnitř říká „**Encoder** steps through these articulations".
- Labely: `MIDI CHANNEL` / `ROLLER ORDER` (uppercase, dvě velikosti) vs „Keyswitch keyboard" / „Advanced keyswitch settings" (sentence case).
- Knihovny: „Spitfire BBCSO" vs „Spitfire Symphonic Orchestra – …" vs „Spitfire Brass" (které? Symphonic/Studio?).
- Doc drift: WEBAPP §3.8 popisuje 3 módy rolleru, v appce jsou 4.

#### K‑6 – „Starting point" na každé položce
Všech 8 viditelných knihoven má stejný pravý štítek, takže nic nerozlišuje. Nahradit mechanismem (viz F‑2), případně „Verified" u ověřených.

#### K‑7 – Drobnosti
- Bank taby „1 Bank 1": číslo se u výchozích jmen duplikuje. Číslo zobrazit jen u vlastních jmen, nebo jen číslo.
- Header vpravo: ikona slideru + neoznačený switch (controller view) vedle theme tlačítka. Nález I‑3 z 07‑22 trvá.
- × (smazat bank) je v light šedé, v dark červené.
- Keyswitch řádek: „Choose range…" (malý pill) vedle „Reset range" (větší, jiný tvar i velikost písma).
- Welcome: „Connect & load" (jediná primární akce) má stejnou vizuální váhu jako sekundární pill.

---

## 4. Doporučené pořadí

**Sprint 1 – důvěra (malé zásahy, velký dopad):**
1. F‑1 fantomová změna + probe
2. F‑3 přejmenovat „CC" → „Value" (4 řetězce)
3. F‑2 ověřit EW/OT, odstranit Kontakt Factory, mechanismus místo „Starting point" (řeší i K‑6)
4. C‑6 Ctrl/Cmd+S a Ctrl/Cmd+Z

**Sprint 2 – skladatelský workflow:**
5. C‑2 čitelný Live HUD
6. C‑5 souhrny ve všech hlavičkách sekcí
7. C‑4 pojmenování banku z knihovny
8. C‑1 jména keyswitchů (data model + LUX/SSO)
9. C‑3 sloučení šablon s library setupem
10. C‑7 přepsat Relative CC text

**Sprint 3 – konzistence:** K‑1 až K‑5 (nejlépe v jednom průchodu, který zároveň zavede `--fs-*` / `--space-*` tokeny a aktualizuje WEBAPP §0).

---

## 5. Co funguje dobře (neměnit)

- Library preview dialog: přesně ukazuje, co se změní, a má volbu „Articulations only".
- Change popover s Undo (n) a Restore last sent (oprava I‑1 z 07‑22 potvrzena v renderu).
- Keyswitch klaviatura s duálním zobrazením `C‑2 · 0` a volitelnou naming convention (Cubase/Logic vs Pro Tools rozdíly jsou pro skladatele reálná bolest).
- UACC chipy „jméno primárně, číslo sekundárně".
- HID inline notice s akcí přímo v kontextu (Navigation, Macro).
- Dark mode parita je celkově dobrá, bez rozbitých ploch.
