# Vlna 3a — HW polish T1–T4 (design)

**Datum:** 2026-07-09
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu → firmware se netýká, repa zůstávají oddělená.
**Zdroj:** Frankovy poznámky z HW testu Vlny 2 (2026-07-07), zapsané do `docs/feel-fader-product-audit-2026-07-03.md` (sekce Vlna 3, T1–T4).

Vlna 3a je podmnožina Vlny 3 — jen čtyři konkrétní, HW-ověřené polish nálezy. Stavový model připojení, F3, I6, onboarding atd. zůstávají mimo rozsah (samostatné sub-projekty).

## Kritérium úspěchu

Na fyzickém zařízení, oba fadery v pohybu naráz:
1. Bank taby: aktivní čte jako bílý/světlý chip, neaktivní jako šedý text, žádné podtržení; pruh nepůsobí těžce. (T1, T2)
2. Přepnutí banky: celý blok (hlavička + karta) prolne jako jeden celek, nic neprobliká rychleji než zbytek. (T3)
3. Pohyb obou faderů zároveň je vizuálně plynulý, bez sekání. (T4)

## T1 + T2 — bank taby (varianta C: plochý chip)

Rozhodnutí z vizuálního brainstormingu: **varianta C** — nejlehčí, aktivní = plochý bílý/světlý chip bez stínu a bez „dráhy", neaktivní = jen šedý text.

Dnešní stav (CSS ~ř. 941–984): pruh `.bank-block-tabs` má `background:var(--bg-card)` (těžké), aktivní `.bank-block-tab.active` má `background:var(--bg-input)` + `color:var(--t1)` + 2px `::after` podtržení v `--t1`.

Změny (čistě CSS, žádná změna JS renderu tabů):
- `.bank-block-tabs` — zrušit/odlehčit `background` (transparentní nebo splývá s podkladem), zmenšit vertikální padding. Řeší „těžkost" (T1).
- `.bank-block-tab.active` — pozadí = světlý chip (`--bg-card` v light; ekvivalent v dark override), `color:var(--t1)`, `border-radius:var(--r-sm)`, **bez stínu**.
- `.bank-block-tab.active::after` — **smazat** (konec „černého podtržení", T2).
- `.bank-block-tab` (neaktivní) — transparentní pozadí, `color:var(--t2)`/`--t3`.
- `html.dark .bank-block-tab.active` — sladit tak, aby aktivní chip byl světlejší než karta (viz mockup dark panel varianty C: `#3a3a3c`-ekv.).
- Live-dot (`.bank-tab-live`) a index (`.bank-tab-idx`) beze změny.

Hover stavy ponechat jemné, konzistentní s chip vzhledem.

## T3 — seamless přepnutí banky

**Příčina (nález z kódu):** `renderPanels()` aktualizuje dva oddělené kontejnery v různém rytmu:
- `bank-name-area` (jméno/ikona/tagy) — přepis `innerHTML` **okamžitě, bez animace** (ř. ~1513).
- `panels-row` (karta se sekcemi) — přepis `innerHTML` + třída `bank-anim` → `fadeSlideIn .22s` (opacity **+ translateY**) jen při `bankChanged` (ř. ~1539, keyframes ~ř. 181).

Hlavička tak skočí okamžitě, karta se teprve fade-in-uje s posunem → „některé prvky probliknou rychleji".

**Řešení (rozhodnutí: jemný uniformní opacity fade):**
- Animovat **oba kontejnery jako jeden celek** stejným přechodem, spuštěným ve stejný okamžik při `bankChanged`. (Buď společný wrapper, nebo stejná anim třída aplikovaná na oba synchronně — implementační detail pro plán.)
- **Změnit efekt:** místo `fadeSlideIn` (opacity + translateY) → **jen opacity fade ~140 ms, bez posunu**. Obsah se nehýbe, jen prolne. `translateY` posun byl součást důvodu, proč přechod „nesedí".
- `_lastRenderedBank` gate zůstává (fade jen při reálné změně banky, ne při každém renderu).

Riziko nízké, čistě prezentační.

## T4 — dual-fader jank (rAF batching + cache geometrie)

**Příčina (nález z kódu):** CC handler `onMidiMsg` (ř. ~2489–2493) volá pro každou příchozí CC zprávu `pF(tid,thid,val)`, které čte `tr.offsetHeight` a `th.offsetHeight` (**vynucený synchronní reflow**) a hned zapisuje `style.top`. Dva fadery po ~125 Hz = ~250 reflow/write cyklů/s prokládaných → layout thrashing → sekání.

`setBar` je no-op (ř. 3048), `setTxt`/`liveOn` levné. Enkodér nízkofrekvenční — mimo rozsah.

**Řešení:**
- **rAF batching:** CC handler jen uloží poslední hodnotu (`liveValues.f1/f2`) a nastaví „dirty" flag pro daný fader; nevolá `pF` přímo. Jedna `requestAnimationFrame` smyčka (spuštěná při první dirty, sama se zastaví když není co kreslit) aplikuje pozici + `setTxt` max ~60×/s. Vždy se použije poslední hodnota → žádné zaostávání, jen decimace na frame rate.
- **Cache geometrie:** výška tracku a thumbu se během tahu nemění; přepočítat jednou (při renderu/resize) a v rAF smyčce už jen počítat `top` z cache, **žádný `offsetHeight` per zpráva**.
- `pF` použité mimo live cestu (drag `mF`, `positionThumbs`) může zůstat na přímém výpočtu, ale mělo by číst ze stejné cache, aby se logika nerozešla.
- Cache invalidovat při: `render()`/`renderPanels()`, `positionThumbs()`, resize, změně orientace.

## Ověření

- Lokální smoke test appky (přepínání bank, drag faderů myší) — plynulost, žádný vizuální regres.
- **HW test na zařízení (nutný):** oba fadery naráz → plynulost (T4); přepnutí banky tlačítkem i v appce → uniformní prolnutí (T3); vizuální kontrola tabů light+dark (T1/T2).
- Zpětná kompatibilita protokolu: N/A (žádná změna protokolu).

## Mimo rozsah

Zbytek Vlny 3: stavový model připojení, F3 (send-on-bank-switch volba), I6, I8, S8, S9, V12, onboarding/Help rozšíření, V10/legal. Každý samostatný sub-projekt (spec → plán → implementace).
