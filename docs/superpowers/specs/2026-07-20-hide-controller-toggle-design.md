# Hide-controller toggle — design

**Datum:** 2026-07-20
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu / formátu configu → firmware se netýká, repa oddělená.
**Kontext:** Frankův požadavek — chce toggle, který schová pohled na controller (obrázek zařízení + fadery), aby získal čistou plochu jen pro konfiguraci parametrů (bank panely). Chce plynulou animaci "krásného zmizení/odsunutí". Probráno jako mini-design (4 otázky): umístění Send tlačítka, umístění toggle, persistence stavu, osud live-hud widgetu, styl animace, mechanika přesunu Send tlačítka — všechno rozhodnuto níže.

## Cíl

Nový toggle přepínač v headeru, který skryje `.stage` (obrázek zařízení + fadery + Send tlačítko) plynulou animací, čímž se `.panels-row` (bank konfigurace) posune nahoru a získá víc místa na obrazovce. Stav se pamatuje mezi návštěvami.

## Kritérium úspěchu

1. V headeru (`.h-right`, vedle dark-mode přepínače) je nová ikonka toggle. Klik skryje/zobrazí `.stage`.
2. Skrytí je animované: `.stage` se plynule zmenší na výšku 0 (grid `1fr→0fr` trik) + fade opacity + jemné zmenšení/posun nahoru, `cubic-bezier(.16,1,.3,1)` křivka appky, ~380–450 ms. `.panels-row` se přirozeně vysune nahoru do uvolněného místa (žádná díra po sobě).
3. `prefers-reduced-motion` → okamžité skrytí/zobrazení bez animace.
4. Send tlačítko (`.send-anchor` s `#send-btn`, `#send-change-note`, `#change-popover`) se při skrytí **reparentuje** (skutečný DOM přesun, ne kopie) do nového slotu v `.h-right`, dostane kompaktní toolbar styl (bez šipky ukazující na zařízení, bez absolutního pozicování). Při zobrazení se vrátí zpět do `.device-wrap`.
5. Stav (`_controllerHidden`) se ukládá do `localStorage`, aplikuje se při načtení stránky před prvním smysluplným vykreslením (jako dnešní dark-mode preference) — žádný flash špatného stavu.
6. Toggle je viditelný jen v hlavním view appky (ne na welcome obrazovce), stejně jako dark-toggle dnes.
7. Live-hud (plovoucí mini L/R + ART widget vlevo nahoře) je **nezávislý** — toggle ho nijak neovlivňuje, zůstává vždy viditelný podle svých vlastních pravidel (scroll/connect stav).
8. Živé MIDI hodnoty (`liveValues`, pozice thumbů) se dál aktualizují na pozadí i když je `.stage` skrytá — žádná pauza logiky, jen se nevykresluje.

## Toggle control

- Nové tlačítko v `.h-right`, **před** `.dark-toggle` (stejné pořadí jako Send bude za ním): `<button class="controller-toggle ui-control ui-pill ui-glass" onclick="toggleControllerVisibility()" ...>`.
- Vizuál stejný vzor jako `.dark-toggle`: dvě SVG ikonky (např. "eye" / "eye-off" nebo "controller" / "layout"), crossfade přes opacity+transform (`.theme-icon` vzor), `aria-pressed` reflektuje stav, `title`/`aria-label` se přepíná ("Hide controller" / "Show controller").
- Renderuje se jen mimo welcome screen (stejná podmínka jako existující header controls).

## Stav + persistence

- Nová proměnná `_controllerHidden` (bool), nový klíč `localStorage['ff-controller-hidden']`.
- Načtení: při startu appky (vedle čtení dark-mode preference) se `_controllerHidden` nastaví z localStorage a **aplikuje bez animace** (rovnou nastavená CSS třída), aby nebyl vidět flash "napřed viditelné, pak se schová".
- `toggleControllerVisibility()`: přepne `_controllerHidden`, uloží do localStorage, spustí `applyControllerVisibility(animate=true)`.

## Collapse mechanika

- `.stage` se obalí novým wrapperem (např. `.stage-collapse`), který dostane `display:grid; grid-template-rows:1fr; transition:grid-template-rows .42s cubic-bezier(.16,1,.3,1)`.
- Vnitřní `.stage` (uvnitř wrapperu) dostane `overflow:hidden` (nutné pro grid-rows trik) a `min-height:0`.
- Skrytí: wrapper dostane třídu `.is-collapsed` → `grid-template-rows:0fr`. Zároveň na vnitřní `.stage` (nebo přímo `.device-home`) aplikovaná `opacity:0` + `transform:scale(.96) translateY(-8px)` se stejnou tranzicí — "vtahuje se pryč" efekt.
- Zobrazení: reverzní — třída se sundá, grid-rows zpět na `1fr`, opacity/transform zpět na výchozí.
- `@media(prefers-reduced-motion:reduce)`: `transition:none` na wrapperu i vnitřním prvku — okamžitý přechod.
- `.panels-row` pod tím je normální block flow → přirozeně se posune nahoru, jak `.stage-collapse` mizí (žádný extra kód potřeba).

## Send tlačítko — reparenting

- Nový prázdný slot v headeru: `<div class="send-anchor-slot" id="send-anchor-slot"></div>` v `.h-right`, **před** `.dark-toggle`.
- `applyControllerVisibility(hidden, animate)`:
  - Při `hidden=true`: po doběhnutí collapse animace (nebo rovnou při `animate=false`) přesune `document.querySelector('.send-anchor')` pomocí `slot.appendChild(sendAnchor)` a přidá třídu `.in-header`.
  - Při `hidden=false`: reparentuje `.send-anchor` zpátky jako **poslední potomek** `.device-wrap` (`device-wrap.appendChild(sendAnchor)` — odpovídá jeho dnešní pozici v markupu, poslední prvek za `.ctrl-zone` bloky), odebere `.in-header`.
- Nová CSS třída `.send-anchor.in-header`:
  - Ruší absolutní pozicování a `.send-arrow` (skryje `display:none` — šipka ukazující na zařízení nedává v headeru smysl).
  - Kompaktní inline styl (menší padding, výška sladěná s ostatními header controls `min-height:44px` touch-target pravidlem).
  - `.change-popover` uvnitř zůstává funkční (stejné ID, stejná `toggleChangePopover()` logika) — jen se pozicuje relativně k novému místu (ověřit `position:absolute`/`right` hodnoty fungují i v headeru, případně upravit).
- Všechny existující ID (`#send-btn`, `#send-change-note`, `#change-popover`), onclick handlery a ARIA atributy zůstávají nedotčené — reparenting nezpůsobí jejich ztrátu.

## Timing přesunu vs. animace

- Skrytí: Send se přesune do headeru **současně** se startem collapse animace (ne až po jejím doběhnutí) — protipřípad: pokud by čekal na `transitionend`, uživatel by vyseděl bez Send tlačítka po dobu animace. Přesun je okamžitý (DOM reparenting nemá vlastní animaci), jen se vizuálně objeví v headeru hned na začátku collapse.
- Zobrazení: reverzně — Send se vrátí do stage **před** startem expand animace, aby byl na svém místě, až se `.stage` zvětší.

## Co zůstává beze změny

- Live-hud (mini plovoucí widget) — nezávislý na tomto toggle.
- Protokol, formát configu, firmware — netýká se.
- Sticky/scroll-park chování `.stage` (existuje z Vlny 3a) — platí jen když je controller zobrazený; při skrytí je moot (není co parkovat).
- Welcome screen, connect transition (`connectTransitionWelcome()`) — beze změny, toggle je jen v hlavním view.
- Validace, dirty tracking, `runValidation()` — beze změny, Send tlačítko dělá to samé, jen jinde v DOM.

## Ověření

- Headless (puppeteer): toggle klik → `.stage-collapse` má třídu `.is-collapsed`, `#send-btn` je potomkem `#send-anchor-slot` (ne `.device-wrap`), `.panels-row`'s top posun nahoru (změřit `getBoundingClientRect`).
- Opakovaný toggle (skrýt→zobrazit→skrýt) — Send se správně vrací na původní místo v `.device-wrap`, žádné ztracené reference/duplicitní ID.
- `prefers-reduced-motion` emulace → žádná CSS transition, okamžitý přechod.
- localStorage persistence: nastavit `ff-controller-hidden`, reload stránky → stav se obnoví bez flash.
- Toggle není vidět na welcome screen.
- Klik na Send v headeru (skrytý stav) — `handlePrimaryAction()`/`doSend()` funguje identicky jako předtím.
- Regrese: existující probe suite (`scratch/run-all-probes.mjs`) — žádné nové faily.

## Mimo rozsah

- Onboarding/Help vysvětlení tohoto toggle (jen `title`/`aria-label` na tlačítku, žádný vynucený tooltip/Help odkaz).
- Vlastní animace pro live-hud (zůstává beze změny).
- Mobilní specifická optimalizace nad rámec toho, co grid-collapse trik dá zadarmo (ověří se, ale nepředpokládá se speciální media query).
