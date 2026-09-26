# Minimal hybrid – vizuální varianta — design

**Datum:** 2026-09-26
**Větev:** `design/minimal` (odbočená z `main` @ `dc10c38`). `main` zůstává beze změny = původní vizuál. Návrat ke starému vizuálu = zůstat na `main` / větev nemergovat.
**Rozsah:** app-only (`feel-fader.html` + `WEBAPP.md` + probes). Žádná změna protokolu, formátu configu ani `cfg` schématu → firmware se netýká, repa zůstávají oddělená.
**Kontext:** Frank chtěl vyzkoušet nový směr UI. Proběhly dva throwaway drafty (Teenage Engineering → zamítnut; čistě Apple-like → „až moc Apple aplikace", ale minimalismus se líbí). Z analýzy současného designu vzešel „minimal hybrid": zachovat identitu appky (fotka controlleru, Mulish + IBM Plex Mono, brand červená, zelený live glow, HUD), převzít z Apple jen disciplínu – méně typových stylů, méně povrchových efektů, jasná hierarchie, sekundární akce odsunuté.

**Vizuální reference (lokální, gitignored):** `.superpowers/brainstorm/hybrid-2026-09-26/`
- `hybrid-full.png` – celá stránka s rozbaleným rollerem (cílový stav)
- `hybrid-compare.png` – první obrazovka dnes vs. návrh
- `hybrid-mock.html` – statický mockup (hodnoty CSS: barvy, velikosti, radii – orientační zdroj)

## Cíl

Přestylovat hlavní view appky do klidnějšího minimalistického jazyka bez změny funkcí, chování, dat a transportu. Každá dnešní funkce zůstává dostupná; mění se vizuální vrstva, hierarchie a umístění sekundárních akcí.

## Kritéria úspěchu

1. Na `body` nejsou ambientní radial gradients; pozadí stránky je jednobarevné `--bg`.
2. Obsahové karty (bank card, skupiny Bank / Feel Fader) nemají `backdrop-filter` ani stín; glass (`backdrop-filter`) zůstává jen v hlavičce a u overlay/dialogů.
3. Otevřená sekce ovladače nemá zelené ani jiné barevné tónování; zelená se v UI používá jen pro live signál (glow thumbu, tečka „active on device", aktuální položka roller order) a success stavy.
4. Karta banky začíná řádkem „Bank N of M" + velkým editovatelným názvem banky (~32–34 px, Mulish 800); library setup je šedý podtitulek s odkazem **Browse…**; nad ovladači nejsou ikony ‹ › ⧉ × ani pole Library setup / tlačítko Save setup.
5. Hlavičky sekcí ovladačů mají jediný primární text (vlastní název – Expression / Dynamics / název režimu rolleru / Button), pod ním mapping v Plex Mono v `--t2`, vpravo chevron › (otevřená sekce = otočený). Uppercase popisky `LEFT FADER`, `RIGHT FADER`, `ROLLER`, `BUTTON` v hlavičkách nejsou.
6. Roller order (artikulace i keyswitche) je svislý seznam řádků `index · název · hodnota · ≡`; drag & drop, Alt+šipky, Move earlier/later a odebrání fungují jako dnes; Move/× jsou viditelné na hover a `:focus-within`.
7. Pod ovladači je skupina **Bank** (Save as setup…, Duplicate bank, Move ‹ Earlier / Later ›, Delete bank… v `--danger`) a skupina **Feel Fader** (Device & Settings, Help & Guide).
8. HUD má stejnou geometrii, obsah a chování (čtverec ↔ kapsle) jako dnes, ale plochý styl.
9. Všechny barvy/radii/stíny jdou přes tokeny (`var(--…)`); `WEBAPP.md` §0 odpovídá novému stavu.
10. `npm test` projde (upravené a nové probes zahrnuty); žádné page errors.
11. Frank vizuálně potvrdí na `localhost:8100` (light + dark) před jakýmkoli merge/deployem.

## Rozhodnutí po oblastech

### 1. Povrchy a tokeny
- Odstranit ambientní radial gradients z `body` (light i dark).
- Karty: plná výplň `--bg-card` na `--bg`, bez stínu, bez blur; radius zachovat z tokenu (`--r-*`). Pomocné panely (dnes lehčí glass) → také plné.
- Hlavička: glass zůstává (jediný glass povrch v obsahu).
- Otevřená sekce: neutrální – žádný levý světelný gradient ani zelený tint; oddělení od sousedů jen vlasovou linkou.
- Dark: stránka `--bg` blízko černé, karty `#1c1c1e`-ish (přes existující/nové tokeny).
- `--control-glass-*` u kompaktních controls (steppery, segmented, pills): ploché výplně `--bg-input`; tokeny přejmenovat nebo přemapovat – rozhodne plán, ale výsledkem je jedna konzistentní plochá sada.

### 2. Hlavička
- Wordmark „Feel Fader" normálním písmem (bez uppercase + letter-spacing), Mulish 800.
- Taby banků vedle wordmarku; editovaný bank = bílý pill s vlasovou linkou; bank aktivní na zařízení = malá zelená tečka (nahrazuje dnešní symbol controlleru – **ověřit v plánu**, zda symbol nemá navázané probes/a11y texty; `title`/`aria-label` „Active on device" zůstává).
- Vpravo: stav připojení (tečka + slovo, `--t2`), přepínač Controller (ikona, funkce beze změny), přepínač motivu.

### 3. HUD
- Geometrie, obsah, přechod čtverec ↔ kapsle, desktop/mobil rozměry beze změny (viz `WEBAPP.md` §3.2).
- Styl: `--bg-card`, vlasová linka `--border`, jemný stín (nový token, např. `--shadow-hud`), bez `backdrop-filter`.

### 4. Karta banky
- Horní blok: `Bank N of M` (13 px, `--t2`; pokud je bank aktivní na zařízení, doplnit „· active on device"), pod ním velký název (inline editovatelný input, limity jako dnes), vlevo zachovat malou ikonu banku (icon picker beze změny).
- Podtitulek: text `Library setup` (`--t2`) + odkaz **Browse…** (`--red`, 600). Klik otevře stávající searchable picker jako popover ukotvený k odkazu; picker, skupiny, klávesnice, preview dialog a Apply logika beze změny.
- Appka dnes u banky neuchovává název aplikovaného setupu (ověřeno grepem 2026-09-26) a nové pole do `cfg` se nepřidává → podtitulek nezobrazuje název knihovny (odchylka od mockupu, kde je „Spitfire Symphonic Strings · Change" jen ilustrační).

### 5. Sekce ovladačů
- Hlavička sekce: vlevo malá značka (`L`, `R`, ikona rolleru, ikona buttonu v `--t3`), primární text = vlastní název (u rolleru název režimu, u buttonu „Button"), sekundární řádek = dnešní kompaktní souhrn (`Ch 1 · CC 11`, `17 articulations · Ch 1 · CC 32`, …) v Plex Mono `--t2`.
- Chevron › vpravo, otevřená sekce = rotace 90°. Klik do hlavičky, inline editace názvu, sticky hlavička při scrollu, „nejvýš jedna otevřená" – beze změny.
- Živé hodnoty v hlavičkách se nezobrazují (ukazuje je HUD).
- Obsah sekcí (steppery, segmented control režimů, response, klaviatura keyswitchů, macro capture): stejná funkce, plochý styl dle §1.

### 6. Roller order
- Sdílená komponenta pro artikulace i keyswitche → svislý seznam: `index` (Plex Mono, `--t3`), primární název (Mulish), sekundární hodnota (UACC číslo / nota, Plex Mono `--t2`), drag handle `≡`.
- Aktuální (live) položka: tučný název + zelená tečka/index (nahrazuje dnešní zelený obrys chipu).
- Move earlier/later a × v řádku: `opacity:0` → viditelné na `:hover` a `:focus-within`; zůstávají v DOM a v tab pořadí (a11y).
- Pod seznamem textové odkazy **Add articulation…** / **Templates…** (resp. keyswitch ekvivalenty) místo pill tlačítek; vstup pro hodnotu zůstává, jen ve stejném plochém stylu.

### 7. Akce banky a spodní skupiny
- Skupina **Bank** (pod kartou ovladačů, stejný kartový styl, řádky 50 px): Save as setup… (otevírá dnešní dialog), Duplicate bank, Move (‹ Earlier / Later ›, disabled na krajích), Delete bank… (`--danger`, jen pokud je > 1 bank, potvrzení + Undo beze změny).
- Skupina **Feel Fader**: Device & Settings (vpravo firmware verze), Help & Guide – rozbalování funguje jako dnes (akordeon), jen jako řádky jedné karty.
- Footer beze změny obsahu, vizuálně ztišit.

### 8. Send
- Chování, stavy, animace a mobilní dock beze změny.
- Inline notifikace (počet změn, Review/change popover, validační stav) se na desktopu zobrazí **pod** tlačítkem jako jeden řádek textu (`3 changes · Review`) místo vedle něj; `--send-entry-gap` a rezervace výšky stage přepočítat tak, aby se nic neposouvalo.

## Mimo rozsah
- Struktura welcome screenu a onboardingu (jen převezme nové tokeny).
- Samostatná optimalizace mobilu (drží se regresně funkční – viz `CLAUDE.md` repa).
- Změny `cfg`, protokolu, firmware, i18n klíčů nad rámec nutných textů.
- Runtime přepínač starý/nový vizuál (rozhodnuto: jen git větev).

## Testy
- Kandidáti na úpravu (plán ověří grepem, které selektory/asserty se mění): `design-consistency-probe.mjs`, `desktop-bank-actions-probe.mjs`, `a1-mobile-bank-actions-probe.mjs`, `live-hud-*-probe.mjs`, `hud-readable-summaries-probe.mjs`, `section-toggle-focus-ring-probe.mjs`, `sections-independent-probe.mjs`, `send-dock-gap-symmetry-probe.mjs`, `send-btn-idle-state-probe.mjs`, `keyswitch-names-probe.mjs`, `art-row-stable-height-probe.mjs`, `library-*-probe.mjs`, `bank-live-dot-probe.mjs`, `bank-tab-blur-probe.mjs`.
- Nové asserty v `design-consistency-probe.mjs`: `body` bez `radial-gradient`; obsahové karty bez `backdrop-filter` a `box-shadow`; otevřená sekce bez barevného pozadí; hlavičky sekcí bez uppercase popisku.
- Nový probe pro roller order list: pořadí, Alt+šipky, Move tlačítka dosažitelná Tabem, viditelnost na focus.
- Vizuální kontrola: screenshoty light/dark 1440 × 900 + 390 × 844 porovnat s `hybrid-full.png`; finální oko = Frank na `localhost:8100` (vnitřní loop bez commitů/deploye, viz workflow vizuálních iterací).

## Rizika
- Mnoho probes je svázáno se současnou strukturou → přepisovat asserty cíleně, nemazat regresní pokrytí chování.
- Přesun Library setup do popoveru a akcí banky dolů mění naučené cesty; funkce musí zůstat dosažitelné klávesnicí.
- `--send-entry-gap` / seamless přechod z welcome je citlivý na výšku oblasti pod Send → ověřit `connect-reveal-sync-probe`, `skip-welcome-send-entry-gap-probe`.

## Deploy
- Žádný deploy dema z této větve bez Frankova výslovného souhlasu. Merge do `main` až po Frankově potvrzení.
