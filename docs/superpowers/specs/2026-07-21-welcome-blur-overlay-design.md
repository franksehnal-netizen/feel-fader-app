# Welcome screen — blur overlay redesign

**Datum:** 2026-07-21
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu / formátu configu → firmware se netýká, repa oddělená.
**Kontext:** Vzniklo při ladění symetrie mezer mezi welcome a app layoutem (`--send-entry-gap`/`--stage-entry-offset`, finding C8) — po zmenšení welcome-screen mezer (2026-07-21, `.welcome-copy-stage`/`.welcome-inner`/`.welcome-action-slot`) navrhl Frank zásadně jinou architekturu, která celý problém řeší u kořene: `pojďme to brainstormovat úplně jinak. Na welcome screen bychom mohli udělat celoplošnou vrstvu, která bude dělat blur. Pod touto vrstvou by byl zobrazen ten controller s fadery, už v pozici, která zůstane v té aplikaci. Ostatní tlačítka a texty by byly nad tím.` Probráno jako mini-design (3 otázky): ostrost controlleru pod blurem, stejný princip pro Send tlačítko, architektura — všechno rozhodnuto níže.

## Cíl

Nahradit dnešní mechanismus, kde je `#device-wrap` (obrázek + fadery) a Send tlačítko **jeden sdílený DOM element fyzicky přesouvaný** mezi welcome sloty (`#welcome-controller-slot`, `#welcome-action-slot`) a app sloty (`#device-home`, `.send-callout`), architekturou, kde oba prvky **mountují jednou, natrvalo, rovnou do finální app pozice** — a welcome screen se stává čistě vizuálním `position:fixed` overlay (blur + nezávislá plovoucí karta) nad appkou, která už reálně existuje pod ním.

Tím zmizí celý dnešní pomocný mechanismus pro "pixel continuity" mezi dvěma různými layouty: `--stage-entry-offset`, `--send-entry-gap`, `alignAppControllerToWelcome()`, `alignAppControllerToTarget()`, `correctMountedControllerToTarget()`, `_welcomeControllerTargetTop`, `mountControllerInWelcome()`, `mountPrimaryActionInWelcome()` a reparentovací části `handoffPrimaryActionToApp()`/`skipWelcome()`.

## Kritérium úspěchu

1. `#device-wrap` (obrázek zařízení + interaktivní fadery) i Send tlačítko existují v DOM **jen na jednom místě, od načtení stránky** — v `#device-home` / `.send-callout`, tak jak dnes vypadá jejich finální app pozice. Nikdy se nereparentují.
2. Welcome screen je `position:fixed;inset:0` overlay s `backdrop-filter:blur()` + poloprůhledným tintem, ležící **nad** už plně vykreslenou appkou. Overlay obsahuje nezávislou vycentrovanou kartu: wordmark, onboarding beaty (title/sub/dots), "Continue without device" odkaz. Vizuálně do stejné karty zapadá i Send tlačítko (viz bod 4) — DOM ale nesdílí, tlačítko tam jen "dosahuje" přes CSS.
3. Controller/fadery jsou pod overlayem **rozmazané stejně jako zbytek appky** (bank panely, footer) — žádná výjimka, žádné "probleskávání" jako ostrý hero prvek. Jedna uniformní blur vrstva pro celou appku.
4. Send tlačítko zůstává **jeden** DOM element uvnitř `.send-callout`. Dokud běží welcome, má CSS třídu `.welcome-floating` (`position:fixed` + `transform:translate(-50%,-50%)` na souřadnice vycentrované karty) — vizuálně sedí nad blurem jako CTA, ačkoliv strukturálně žije v device-wrap. Žádné reparentování mezi sloty.
5. Připojení (`connectTransitionWelcome()`) i skip (`skipWelcome()`) fungují jako **prostý fade overlaye pryč** — `.welcome-floating` se z tlačítka sundá ve stejný okamžik, kdy začne mizet blur (ne až po dokončení fade), takže se tlačítko "usadí" do finální pozice ještě pod závojem mizící mlhy, ne na čisté odkryté scéně. Žádná pozicová matematika, žádné riziko viditelného skoku — protože se nic nikdy nehýbalo.
6. Zamrznutí/dojetí faderové animace na reálnou hardware hodnotu (dnešní kroky 1+3 `connectTransitionWelcome()`) zůstává beze změny — to řeší kontinuitu ANIMOVANÉ HODNOTY, ne pozice, a s touto přestavbou nesouvisí.
7. Fadery jsou před připojením neinteraktivní **implicitně** — overlay sedí výš v z-indexu a ve výchozím stavu zachytává kliky. Žádná speciální "inert" CSS/JS logika na faderech navíc.
8. Toggle "skrýt controller" (`applyStageCollapse`/`applySendAnchorDock`) už nepotřebuje odložené časování na handoff moment (ten přestává existovat) — **korekce po implementaci** (final review 2026-07-21): obojí se stále musí odložit, jen na jiný moment než dřív — dokud běží welcome, spouští se poprvé až uvnitř `finalizeWelcomeExit()` (moment, kdy welcome doopravdy zavře), ne rovnou při loadu. Důvod: `.stage-collapse.is-collapsed>.stage{transform:...}` by jinak (transform na předkovi = nový containing block pro `position:fixed` potomky) "unesl" `#send-btn.welcome-floating`. Třída bugu "zaseknuté tlačítko na welcome screenu" (2026-07-21) tím i tak zmizí strukturálně, ne jen záplatou — jen ne úplně tak, jak tenhle bod původně popisoval.
9. `prefers-reduced-motion` → overlay zmizí okamžitě bez fade tranzice (stejná konvence jako u ostatních animací v appce).
10. Regrese: celá sada `scratch/run-all-probes.mjs` sedí na dnešní baseline (254 pass / 3 fail / 6 crash — beze změny, žádné nové faily).

## Architektura

- **Device-wrap a fadery** mountují jednou při `window.onload`, přímo do `#device-home`. Žádná `.welcome-mode` třída pro pozicování (dnešní `.device-home > .device-wrap,.welcome-controller-slot > .device-wrap` sdílené pravidlo a celé `.welcome-controller-slot` jako mount point odpadají).
- **Send tlačítko** mountuje jednou do `.send-callout` uvnitř `.device-wrap`. `.welcome-floating` třída je čistě vizuální CSS eskapace (`position:fixed`), DOM rodič se nemění nikdy.
- **Welcome overlay** (`#welcome-screen`) se z kontejneru, který DRŽÍ sdílené prvky, mění na čistě vizuální vrstvu: `backdrop-filter:blur(Npx)` + tint na celoobrazovkovém `position:fixed` divu, uvnitř samostatná karta (`.welcome-inner` beze změny obsahu — wordmark, `#onb-beats`, skip odkaz), BEZ `.welcome-controller-slot` a BEZ `.welcome-action-slot` jako mount pointů. Where dnes byl button v `#welcome-action-slot`, bude v kartě jen vizuální kotva (např. prázdný `.welcome-action-anchor` div, který `.send-btn.welcome-floating`'s `transform` cílí — viz "Otevřené technické otázky").

## Data flow / sekvence přechodu

- **Page load:** `mountControllerInApp()`-ekvivalent proběhne rovnou (žádná welcome varianta mountu). `initControllerVisibility()` (toggle skrýt-controller) aplikuje stav bez animace, žádná deferred dock logika. Send tlačítko dostane `.welcome-floating`, pokud `#welcome-screen` není `.hidden`.
- **Connect (`connectTransitionWelcome()`):** kroky 1+3 (zamrznutí/dojetí faderů na hardware hodnotu) beze změny. Nově: `.welcome-floating` se odebere z tlačítka a zároveň (`ws.classList.add('connecting')` moment) začne mizet overlay (opacity fade, existující `cubic-bezier(.16,1,.3,1)` křivka appky, orientačně stejná délka jako dnešní `ws.classList.add('connecting')` tranzice). Odpadá: `alignAppControllerToWelcome()`, `handoffPrimaryActionToApp()`'s reparenting a gap-měření část (zůstává jen jeho `applySendAnchorDock(_controllerHidden)` volání, přesunuté jinam — viz bod 8 kritéria úspěchu).
- **Skip (`skipWelcome()`):** stejné zjednodušení — `.welcome-floating` dolů, overlay zmizí okamžitě (bez fade, jako dnešní instant-skip chování). Odpadá celá dnešní komentovaná oprava kolem `--send-entry-gap`/`--stage-entry-offset` resetu (S10/2026-07-20 bug i jeho oprava přestávají být relevantní, protože neexistuje co resetovat).

## Edge cases

- **Klávesnicový tab-order:** tlačítko vizuálně sedí uprostřed karty přes `position:fixed`, ale v DOM zůstává uvnitř `.device-wrap` (pravděpodobně dřív nebo jinde v pořadí než wordmark/skip odkaz ve `#welcome-screen`). Tab-order tedy nemusí přesně kopírovat vizuální pořadí (wordmark → tlačítko → skip odkaz) během welcome. Přijatelný kompromis, ověří se probe testem; pokud bude výsledek matoucí, dořeší se `tabindex` na welcome-specifických prvcích.
- **Toggle "skrýt controller" + welcome současně:** pokud je `_controllerHidden` true (uloženo z minula) a uživatel je ještě na welcome screenu, `.welcome-floating` tlačítko (position:fixed) není ovlivněno collapse stavem svého strukturálního rodiče — mělo by fungovat bez úpravy, ověřit vizuálně.
- **Mobil:** plovoucí karta se centruje přes flex (`inset:0;display:flex;align-items:center;justify-content:center`), mělo by fungovat stejně jako desktop; ověřit vizuálně na úzkém viewportu.
- **`backdrop-filter` podpora:** pokud prohlížeč blur nepodporuje, overlay pořád vizuálně funguje jako clona (poloprůhledné pozadí bez rozostření) — degradace, ne blokátor, žádný extra fallback kód není potřeba.
- **Connect-success shimmer** (dnešní krok 4 `connectTransitionWelcome()` — halo/outline/glass shimmer na `devWrap`) zůstává, jen se spouští ve chvíli mizení overlaye místo ve chvíli reparentingu.

## Otevřené technické otázky (řešit v implementačním plánu, ne teď)

- Přesné souřadnice/transform hodnoty pro `.welcome-floating`, aby tlačítko vizuálně sedlo do stejného místa v kartě, kde dnes sedí `#welcome-action-slot` (potřeba měřit po prvním průchodu implementace, ne odhadovat dopředu).
- Přesná délka/easing overlay fade tranzice (orientačně navázat na existující `cubic-bezier(.16,1,.3,1)` a časování `ws.classList.add('connecting')`, doladit podle vizuálního dojmu).
- Co přesně nahradí dnešní `#welcome-controller-slot`/`#welcome-action-slot` v HTML (ponechat jako prázdné vizuální kotvy pro `transform`, nebo úplně smazat a počítat souřadnice jinak) — rozhodne implementace podle toho, co je čitelnější.

## Ověření

- Headless (puppeteer): page-load stav — `#device-wrap` a `#send-btn` jsou potomky `#device-home`/`.send-callout` (nikdy `#welcome-controller-slot`/`#welcome-action-slot`), overlay viditelný s `backdrop-filter`, tlačítko má `.welcome-floating` a `position:fixed` computed style.
- Connect přechod: `.welcome-floating` zmizí + overlay fade bez měřitelného skoku (stejná metodika jako gap-symmetry měření 2026-07-21 — vzorkovat `getBoundingClientRect()` v pravidelných intervalech přes celý přechod, očekávat plochou křivku).
- Skip cesta: stejné zjednodušení, žádný handoff dance, žádný reparenting.
- Fadery skutečně neinteraktivní, dokud overlay běží (klik-through test — kliknutí na souřadnice fadera při viditelném overlay nesmí vyvolat žádnou faderovou akci).
- Toggle "skrýt controller" + welcome současně nezpůsobí žádnou vizuální chybu.
- `prefers-reduced-motion` emulace → žádná fade tranzice, okamžité zmizení overlaye.
- Mobilní viewport — plovoucí karta zůstává vycentrovaná.
- Regrese: `scratch/run-all-probes.mjs` — 254 pass / 3 fail / 6 crash, žádné nové faily. Existující probe soubory závislé na dnešním mount/handoff mechanismu (`skip-welcome-send-btn-probe.mjs`, `skip-welcome-send-entry-gap-probe.mjs`, `skip-welcome-demo-badge-probe.mjs`, `hide-controller-toggle-probe.mjs` a jeho "stranded button" repro scénář) se přepíšou tak, aby ověřovaly nové chování, ne aby jen přestaly platit.

## Mimo rozsah

- Vizuální redesign obsahu karty samotné (wordmark styl, onboarding copy, texty) — jen se přesune do nové vrstvy, obsah/copy se nemění.
- Firmware, protokol, formát configu — netýká se.
- Live-hud widget — nezávislý, beze změny.
- Dark mode, i18n — beze změny, jen se přesune spolu s existujícím markupem.
