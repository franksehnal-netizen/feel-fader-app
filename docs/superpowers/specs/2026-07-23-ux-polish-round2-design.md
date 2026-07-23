# UX polish round 2 — welcome box, status text, bank glyph, Live HUD shape, send spacing, toggle speed

**Datum:** 2026-07-23
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu / formátu configu → firmware se netýká, repa oddělené.
**Kontext:** Frank poslal screenshoty + psaný feedback k živé appce po včerejším UX audit fix batchi (2026-07-22) a featurové vlně (draggable Live HUD, onboarding rework). Šest samostatných bodů, z nichž dva (bank glyph barva, Live HUD tvar) přímo obrací rozhodnutí shipnutá včera — probráno jako mini-brainstorm (2 otázky v terminálu + 2 vizuální srovnání přes brainstorming companion) a živě ověřeno přes Chrome DevTools MCP proti `localhost:8100` (interní-stav-poke, žádný reálný HW).

## Cíl

Šest nezávislých, chirurgických oprav v jednom souboru. Žádná z nich nemění datový model, serial protokol ani NVM formát.

## Kritérium úspěchu

### 1. Welcome screen — bez rámového boxu

Titulek „Feel Fader" a tlačítko „Connect & load" plavou volně nad blur overlayem, bez vlastního ohraničeného/vybarveného panelu kolem sebe (dnešní `.welcome-inner`/karta okolo wordmarku+tlačítka). Frank: „zbytečný rámový box… název a tlačítko by měly plavat volně nad rozmazaným pozadím bez vlastního ohraničeného panelu."

- Text a tlačítko zůstávají vizuálně čitelné na libovolném pozadí (kontrast/stín na textu samotném, ne na kontejneru).
- Zbytek welcome architektury (single-mount blur overlay z 2026-07-21, `.welcome-floating` mechanismus pro Send tlačítko) se nemění — jde jen o odstranění vizuálního rámu karty, ne o návrat k reparentování.

### 2. Header status — trvalá tečka, popisek na hover/klik

Nahradit dnešní stav (text „device connected" zůstává trvale viditelný, S-1 fix z 2026-07-22) mechanismem: **tečka je vždy vidět, textový popisek (`t('status.connected')` apod.) se zobrazí jen při hoveru myší nebo kliknutí/klepnutí na tečku**, ne trvale a ne na časovač.

- Desktop: `:hover`/`:focus-visible` na `#h-status` odhalí `.h-status-text` (existující `max-width`/`opacity` transition infrastruktura z dnešního CSS jde recyklovat — jen trigger se mění z JS-timeru na CSS `:hover`).
- Touch/mobil: klik/tap přepíná stejný odhalený stav (bez hoveru není jiná cesta) — potřeba `aria-expanded` nebo ekvivalent a klik mimo prvek popisek zase schová.
- Ruší se: `_lastConnState`-řízené vždy-viditelné chování z S-1 i historický `_statusCollapseTimer` (ten už byl odstraněný 07-22, jen pro úplnost — nevracet).
- **Rozhodnuto:** hover/klik-reveal platí jen pro `CONNECTED_LIVE` a `CONNECTED_BLIND` (běžný provozní stav, kde je úspora místa žádoucí). Chybové stavy `MIDI_BLOCKED` a `DISCONNECTED` zůstávají **trvale s textem** — jsou vzácnější a čitelnost tam má přednost před úsporou místa. Sladit s existujícím rozlišením v `renderConnState()` (ta už dnes stavy odlišuje barvou tečky).

### 3. Bank tab „active on device" glyph — zpět na neutrální barvu

Vrátit `.bank-tab-device{color:var(--t2);opacity:.78}` (stav před commitem `1672b52`, který ho dnes přebarvil na `var(--green-text)` bez opacity). Ověřeno v gitu, ne z paměti — přesná diff:

```diff
-.bank-tab-device{width:14px;height:14px;...;color:var(--green-text)}
+.bank-tab-device{width:14px;height:14px;...;color:var(--t2);opacity:.78}
```

Tímto se ruší nález V-7 z UX auditu 2026-07-22 (byl to explicitní produktový vkus, ne bug).

### 4. Live HUD — natrvalo čtverec, žádné kontextové přepínání na pill

Odstranit dnešní `is-compact` jako permanentní stav (featurová vlna 2026-07-22 ho udělala nepodmíněným — hardcoded `class="live-hud is-compact"` v HTML + `strip.classList.add('is-compact')` v `updateContextualLiveStrip()`). Vrátit se k base `.live-hud` vzhledu (112×112px, `border-radius:22px`, 2×2 grid s L/R fadery + roller řádek), **natrvalo** — ne kontextově přepínat zpátky na starou logiku `compact = controller.bottom <= headerBottom+8` (to byla varianta C v porovnání, Frank zvolil variantu A).

- Pozice se **nemění** — `strip.style.top = headerBottom + 12px` je stejná formule jako dřív a živě ověřena DevTools (gap přesně 12px, žádný skrytý offset). Frankovo „moc dole" byl vizuální dojem ze širokého pillu, ne bug v pozici.
- Drag-to-reposition (dnešní featurová vlna — `initLiveHudPositioning()`, `data-side`, klávesnice Arrow/Home/End) **zůstává** — týká se jen X pozice (levý/pravý roh), ne tvaru. Nic v zadání ho neruší.
- Dlouhé názvy artikulací (dnešní `liveArticulationName`, progresivní zmenšení fontu `is-long`/`is-very-long`) — čtvercová karta má užší roller řádek (112px šířka mínus padding) než pill (až 252px), takže dlouhé názvy budou potřebovat agresivnější zmenšení/zkrácení, aby se nezalamovaly ošklivě. Přesné prahy viz „Otevřené technické otázky".

### 5. „Send to device" — symetrická mezera po skrytí controlleru

Když je controller skrytý (`applyControllerVisibility(true, …)`), gap nad `.send-callout` (dnes `.stage{padding:32px 0 86px}` + `.send-callout{margin:32px auto 0}` — nekolabují kvůli nenulovému paddingu na `.stage`, takže se sčítají na 64px) musí být stejný jako gap pod tlačítkem (aktuálně menší, řízen jinou cestou přes `.send-anchor`/`docked` stav). Cílový stav: jedna konzistentní mezera z obou stran. Přesná hodnota viz „Otevřené technické otázky".

- Netýká se stavu s viditelným controllerem — tam mezera vypadá správně (`.device-img` → `.send-callout` gap se neřeší).

### 6. Přepínání controlleru — pomalejší, 900ms

`.stage-collapse` a `.stage-collapse>.stage` transition duration `.42s` → **`.9s`**, stejná křivka `cubic-bezier(.16,1,.3,1)`. Týká se `grid-template-rows` (kontejner) i `opacity`/`transform` (vnitřní `.stage`). `prefers-reduced-motion` větev (`transition:none`) se nemění.

## Architektura / dotčené oblasti kódu

Žádná nová architektura — šest lokálních CSS/JS úprav ve stejném souboru:

| Bod | Oblast | Typ změny |
|---|---|---|
| 1 | `.welcome-inner` a okolní karta CSS | odebrání vizuálního rámu |
| 2 | `renderConnState()`, `.h-status-text` CSS, nový `:hover`/klik handler na `#h-status` | JS-timer → CSS/event trigger |
| 3 | `.bank-tab-device` CSS | 1 řádek, revert |
| 4 | `.live-hud`/`.is-compact`, `updateContextualLiveStrip()`, initial HTML class | odebrání permanentního `is-compact` |
| 5 | `.stage`, `.send-callout`, `.send-anchor` margin/padding | sjednocení hodnot |
| 6 | `.stage-collapse`, `.stage-collapse>.stage` transition-duration | `.42s` → `.9s` |

Body 3 a 6 jsou jednořádkové, nízké riziko. Body 1, 2, 4, 5 se dotýkají layoutu/interakce a chtějí vizuální ověření po implementaci (viz Ověření).

## Edge cases

- **Bod 2 (hover-reveal) na klávesnici:** `#h-status` potřebuje být fokusovatelný (nebo mít `:focus-within` ekvivalent), aby popisek šel odhalit i bez myši — jinak regrese přístupnosti oproti dnešnímu trvale-viditelnému textu. Řešit `:focus-visible` vedle `:hover`.
- **Bod 4 (čtvercový HUD) na mobilu:** base `.live-hud` má i mobilní media-query override (`left:16px;width:96px;height:96px` apod., viz řádek ~1213 dnešního CSS) — ten zůstává, jen se stejně jako desktop varianta zbavuje `is-compact` přepínání.
- **Bod 5:** ověřit, že sjednocená mezera nezpůsobí, že `.send-callout` najede příliš blízko k hlavičce na malých viewportech (`.stage{margin-top:0;padding-bottom:96px}` mobilní override na řádku ~897 — zkontrolovat, že se symmetrie počítá i tam, nebo že mobilní cesta má vlastní již-OK hodnoty a bod 5 se jí netýká).

## Otevřené technické otázky (řešit v implementačním plánu, ne teď)

- **Bod 4:** přesné prahy pro zmenšení fontu dlouhých názvů artikulace v užším čtvercovém roller řádku (dnešní `is-long`/`is-very-long` prahy byly kalibrované na širší pill — v čtverci se pravděpodobně musí posunout níž nebo přidat třetí stupeň).
- **Bod 5:** přesná hodnota sjednocené mezery nad/pod `.send-callout` po skrytí controlleru (výchozí odhad 32px, ověřit vizuálně vedle `.send-anchor{min-height:68px}`).
- **Bod 1:** přesný způsob zajištění čitelnosti textu/tlačítka bez rámu (text-shadow na wordmarku? Tlačítko už má vlastní glass/pill pozadí, takže to samo o sobě čitelné zůstane — týká se hlavně titulku).

## Ověření

- `node scratch/run-all-probes.mjs` — baseline 308 pass / 0 fail / 0 crash musí zůstat nedotčená; nové probes jen pro body, kde je riziko tiché regrese (doporučeno: bod 2 hover-reveal state, bod 4 absence `is-compact` třídy po loadu, bod 5 gap-symmetry měření stejnou metodikou jako `2026-07-21` gap-symmetry test).
- Chrome DevTools MCP interní-stav-poke pro vizuální kontrolu všech šesti bodů před commitem (stejný postup jako dnešní live ověření pozice Live HUD) — desktop i mobilní viewport (`emulate`, ne `resize_page` — dnešní quirk).
- Žádný reálný HW dotyk (invariant, `AGENTS.md`).
