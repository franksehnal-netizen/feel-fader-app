# Feel Fader Web App — TODO

Frankovy připomínky k dořešení. Hotové položky přesouvat do sekce **Hotovo** s datem.

> **Pozor na zdroj pravdy:** živý kód je inline `<style>` a `<script>` v
> [feel-fader.html](../feel-fader.html). Samostatné pracovní extrakty CSS/JS
> nevytvářet ani needitovat.

## Otevřené

- **Kurzor (ruka s 5 prsty) při hoveru nad klikatelnými prvky (bank chipy apod.) vypadá old-school/8-bit, chtít modernější (Frank 2026-08-18):** appka nikde nemá vlastní kurzor — jde o čistě OS/prohlížečový nativní `cursor:pointer` (32× v souboru, feel-fader.html), jehož vzhled (rozlišení, styl) se liší podle systému/prohlížeče uživatele a na Windows bývá dost pixelovaný. Fix vyžaduje vlastní CSS kurzor (SVG obrázek přes `cursor:url(...),pointer`) aplikovaný všude, kde teď je `cursor:pointer` — potřeba navrhnout/sehnat vhodnou ikonu kurzoru, než se implementuje.
- **Skrytí controlleru smrští jen svisle, chci i vodorovně rovnoměrně (Frank 2026-08-18):** "když skryju controller, smrští se to ve směru svislé osy. Chtěl bych, aby se controller změnil rovnoměrně i ve vodorovném směru." Mechanismus: `.stage-collapse{display:grid;grid-template-rows:minmax(0,1fr)}` → `.is-collapsed{grid-template-rows:minmax(0,0fr)}` (feel-fader.html ~310-313) — animovatelný grid-trick na výšku, na šířku nemá vliv (ta zůstává 100 % kontejneru). `.stage-collapse.is-collapsed>.stage` má navíc jen malé jednotné `transform:scale(.94)` jako součást fade-outu, ne hlavní schlopení. Chtělo by to buď přidat souběžnou horizontální komponentu (grid-template-columns / scaleX / width), nebo celé schlopení předělat na jednotný `scale()` z obou os — rozhodnout při implementaci.
- **Toggle switch (Keyboard HID zapnuto) má být stejně zelený jako hlavní tlačítko "Sent", navázat na stejný barevný parametr (Frank 2026-08-18, screenshot):** "chci mít aplikaci konzistentní." Oba UŽ ODKAZUJÍ na stejnou proměnnou `--green:#34c759` (feel-fader.html ~68) — `.send-btn.sent{background:var(--green)}` (~379, plná, sytá barva) vs. `.hid-switch input:checked + .hid-switch-track{background:color-mix(in srgb,var(--green) 44%,transparent);...}` (~755, jen 44% mix → vybledlá/pastelová, proto vizuálně nesedí, i když je to nominálně "stejný parametr"). Řešit pravděpodobně zvýšením/odstraněním toho 44% mixu na tracku, ne změnou samotné `--green` proměnné.
- **Sdílený "glass" gradient (`--control-glass-bg`) vypadá "cheap", ladit GLOBÁLNĚ (Frank 2026-08-18, screenshot Roller order UACC pilulek → rozhodnuto 2026-08-18):** "tyto tlačítka vypadají strašně cheap s tím gradientem" → "celý sdílený styl se mi nezdá, poladíme ho globálně." `--control-glass-bg:linear-gradient(145deg,rgba(255,255,255,.72),rgba(174,174,178,.34))` (feel-fader.html ~61, dark varianta ~131) — používá `.ui-glass`, `.send-btn.idle`, `.uacc-tag`, `.roller-mode-row`, `.stepper input`, `.ks-stepval` a další (celoaplikační token, ne jednotlivá komponenta). Rozsah potvrzen: řešit token samotný, ne jen `.uacc-tag`.
- **Výrazněji zvýraznit banku aktivní na zařízení, ne jen malou ikonku (Frank 2026-08-18):** "zatím je tam ta malá ikonka na liště, ale chtěl bych tam přidat něco víc." Současný stav: `.bank-tab-device` (feel-fader.html ~1919-1920, 12×14px SVG ikonka ovladače, `opacity:.78`, barva `var(--t2)` — tichá/sekundární) se zobrazí v bank tabu, když je ta banka `isLive` (aktivní na hardwaru, ~2957-2980). `.bank-block-tab.is-live{box-shadow:none}` momentálně jen RUŠÍ stín, nepřidává žádný vlastní akcent. Návrh řešení (barva/okraj/glow/badge apod.) nechat na designové rozhodnutí při implementaci — zatím jen zaznamenat požadavek.
- **"Enable Keyboard (HID)?" potvrzovací dialog — prověřit vizuální konzistenci s ostatními notifikacemi (Frank 2026-08-18, screenshot):** dialog vzniká přes sdílený `openConfirm()` helper (feel-fader.html ~3511-3520, `onHidToggle()`, `title:'Enable Keyboard (HID)?'`, `tone:'primary'`) — stejný mechanismus jako ostatní confirm dialogy v appce (`.overlay`/`.modal`), takže případná nekonzistence bude spíš v konkrétním stylingu (barva/tone tlačítka, formátování textu) než ve struktuře. Projít vedle sebe se zbytkem notifikací/dialogů a porovnat.
- **Mobil — floating Live HUD, drag funguje jen na PC (Frank 2026-08-17):** "je to dragable jen na PC, ne když si to zobrazím v telefonu." Upřesněno — jde o existující Live HUD (`#live-strip`, `_liveHudDrag`). Záměrně vypnuto pro touch: `function liveHudManipulable(){ return window.matchMedia('(any-pointer:fine)').matches; }` (feel-fader.html ~5527, komentář "enlarge/drag need a mouse, not a wide window (Frank 2026-07-27)") — tohle je teď REVERZE toho dřívějšího rozhodnutí, ne nová věc. Řešit: povolit drag i na `(any-pointer:coarse)`, ověřit že pointer-events based drag mechanismus (~5635+, `pointerdown`/`pointermove`) funguje i s touch pointery beze změny (měl by, jen gate to blokuje).
- **Mobil — skrýt controller → scroll → zase zobrazit: objeví se ve špatné pozici, po ~1s skočí na správnou (Frank 2026-08-17):** "když skryju controller, kousek scrolluju a controller opět aktivuju, objeví se v jiné pozici a cca za 1s skočí zpět do správné pozice." Podezřelé místo: `applySendAnchorDock`/`trackSendAnchorDock` (feel-fader.html ~5996-6195+) měří pozice přes `getBoundingClientRect()` (viewport-relativní) v okamžiku SHOW/HIDE přechodu (`r0 = anchor.getBoundingClientRect()`, `pillStartTop`, ~6102-6108) — pokud se něco z toho cachuje při HIDE a znovu použije při SHOW BEZ přeměření po mezitímním scrollu, přesně tohle by to vysvětlilo (~1s zpoždění pak sedí na nějaký fallback/settle timer, který to nakonec dorovná). Ověřit a najít přesné místo cache→scroll→stale-hodnota.
- **Mobil — červené "Send to device" tlačítko při scrollu pod horní liquid-glass lištu zmizí naráz, ne plynule (Frank 2026-08-17):** "když scrolluju dolů, tlačítko zajede za tu lištu a najednou pak zmizí, nedojede to plynule, což je škoda." `header` (uvnitř `.top-sticky`, `position:sticky;z-index:50`, feel-fader.html ~182-202) má `background:var(--chrome-glass-bg)` + `backdrop-filter`, ale žádnou měkkou masku/gradient na spodní hraně — `#send-btn` v normálním (ne-welcome, ne-dokovaném) flow nemá žádnou scroll-vázanou logiku (žádný IntersectionObserver na tohle, ověřeno), takže jde čistě o CSS stacking: tlačítko se zpod lišty "utne" tvrdou hranou místo plynulého mizení. Řešit pravděpodobně přes gradient-masku na spodní hraně `header`/`.top-sticky`, nebo dřívější dokování Send tlačítka (existující `applySendAnchorDock` mechanismus) předtím, než se dostane pod lištu.
- **Mobil — kliknutí do "Search setups" pole přiblíží (zoomne) celou appku (Frank 2026-08-17):** "otevře se dropdown menu a celé se mi to přiblíží. Nevím proč, ale nemělo by se to přibližovat." Skoro jistá příčina: `.library-quick-input` (feel-fader.html, `font:12px 'Mulish',sans-serif`) — iOS Safari/Chrome automaticky zoomuje viewport při focusu na `<input>` s `font-size` pod 16px (známé mobilní chování, netýká se to appky specificky). Fix: zvýšit `font-size` na `input` na aspoň 16px (i jen pro mobilní breakpoint), případně vizuálně zmenšit přes `transform:scale()` pokud má zůstat opticky stejně velké.
- **Live status bar — "Ch1·CC1" text má být vystředěný na tečce, ne jako celý string (Frank 2026-08-17):** "chci aby to bylo umístěno tou tečkou na střed toho indikátoru. Teď se to posouvá, když změním např. z CC9 na CC10." `.live-hud-tech` (`#live-f1-tech`/`#live-f2-tech`, `font-variant-numeric:tabular-nums` už řeší číslice v RÁMCI jednoho čísla, ale celý string "Ch1·CC9" vs "Ch1·CC10" má jinou DÉLKU, a rodič `.live-hud-item:not(.live-hud-roller)` centruje přes `justify-items:center` — takže při vystředění celého stringu se posune i levá "Ch1" část, ne jen pravá strana kde se mění počet znaků). Řešit ukotvením na oddělovači "·" — např. dva flex/grid sloty po stranách tečky s pevnou šířkou pro kanál i hodnotu, nebo `·` jako grid gridline mezi dvěma right/left-aligned buňkami.
- **Help & Guide — odstranit sekci "Service: DEV / PROD mode" (Frank 2026-08-17):** "to slouží pro mě, ale ne pro uživatele." feel-fader.html ~2274-2275: `<div class="settings-subhead" id="help-dev">Service: DEV / PROD mode</div>` + navazující `<p>` (firmware boot-mode postup s BOOTSEL recovery). Smazat oba řádky; ověřit, že nikde jinde v appce neexistuje odkaz/link na `#help-dev` (kotva).
- **Mobil — "unsaved changes" popisek koliduje s Live status barem, když je controller skrytý (Frank 2026-08-17):** "když na mobilu skryju zobrazení controlleru, tlačítko Send to device se přesune nahoru. Když udělám nějakou změnu, vlevo od něj se zobrazí popis unsaved changes. To se pak překrývá s LIVE status barem." Doky: `#send-sticky-row`/`#send-sticky-row-inner` (feel-fader.html ~1143-1164, 2259, 5710+) — Send tlačítko a jeho `.send-change-note` popisek dokují do `.top-sticky` při skrytém controlleru; Live HUD (`#live-strip`, z-index 45) sedí taky v horní části obrazovky (`.top-sticky` má z-index 50, komentář ~201 zmiňuje jejich vztah). Potřeba vymyslet, jak zabránit kolizi — přesunout Live HUD, zúžit/zkrátit note, nebo jinak.
- **Mobil — vybraná sekce BUTTON nezvýrazní odpovídající tlačítko na controlleru (Frank 2026-08-17):** "Chci stejný efekt jako v onboarding aplikaci." Highlight `.fader-linked` (feel-fader.html ~727-737, `#zone-macro.fader-linked` už existuje a je nastylovaný) se v hlavní appce spouští jen přes `hoverFaderLink()` (~5499), navázané na `onmouseenter`/`onmouseleave` (~3222-3235) — na mobilu bez hoveru se to nikdy nespustí. Stejný vzor mají VŠECHNY sekce (fader1/fader2/roller/macro), takže je to potenciálně širší mezera než jen BUTTON — ověřit, jestli Frank vidí problém i u ostatních sekcí, nebo jestli macro/button má ještě něco navíc jinak. Onboarding řeší highlight jinak (`data-onb-feature="button"` → `#zone-macro` CSS, feel-fader.html ~1530), bez hoveru — tenhle mechanismus by šel jako vzor.
- **Mobil — horní lišta: dark/light tlačítko kulaté, bank chipy na stejnou výšku jako jeho průměr (Frank 2026-08-17):** "chci aby tlačítko na horní liště pro přepínání mezi light/dark bylo kulaté. A chipy u bank na té liště aby měly stejnou výšku jako bude průměr toho light/dark tlačítka. Chci konzistenci a minimalismus." `.dark-toggle` (feel-fader.html ~1113, 30px base / 44px `@media(pointer:coarse)`) má třídu `ui-pill` (`border-radius:var(--r-pill)`) — na čtvercovém boxu by to už mělo dávat kruh, ověřit proč to tak nepůsobí (padding/ikona/header layout?) než se řeší. Bank chipy = `.bank-block-tab` (feel-fader.html ~2015, `padding:2px 9px`, žádná pevná výška — výška plyne z obsahu) — nastavit na výšku = průměr tlačítka.
- **Mobil — bank karta: action tlačítka (‹ › ⧉ ✕) na stejnou výškovou úroveň jako Bank ikona, zmenšit (Frank 2026-08-17):** "na kartě s bankami bych chtěl mít buttony s šipkami, duplikací a křížkem na stejné výškové úrovni jako Bank ikonu, a tlačítka chci subtilnější, zmenšit." Aktuálně na `@media(max-width:540px)` `.bank-block-name-top{flex-wrap:wrap}` shazuje `.bank-actions` na vlastní řádek pod ikonu/jméno (feel-fader.html ~762). Velikost tlačítek `@media(pointer:coarse)` je 36px (feel-fader.html ~1039) — už jednou zmenšeno z 44px po Frankově zpětné vazbě 2026-08-16, teď chce dál dolů.
- **Onboarding poslední krok — Next zmizí a glow "Connect & load" ať naskočí přesně současně (Frank 2026-08-17):** "v posledním kroku tlačítko next zmizí a já bych chtěl, aby se přesně jak tlačítko mizí, zobrazil glow kolem tlačítka connect & load. Časově ať je to navázané na stejný parametr." 17n už sjednotilo RYCHLOST obou (`--dur-glow`/`--ease-hero`, sdílený token) — tohle je o tom, jestli oba START ve stejný okamžik (`.onb-next.is-final` toggle vs. `data-onb-feature="configure"` toggle, oba by měly nastávat ve stejném volání `onbBeatGo()`, ale nekontrolováno). Ověřit na nasazeném demu, případně doladit spouštěcí moment.
  (Dřívější pre-existing selhání `mobile-ux-probe.mjs` — "Normal welcome contains only the brand and essential actions" — samo spadlo jako vedlejší efekt 2026-08-17m: wordmark je teď záměrně vidět i v plain welcome stavu.)

## Hotovo

### 2026-08-18 — `welcome-heading-gap-probe.mjs` opraven na aktuální onboarding layout

Poslední pre-existing selhání ze session. Test tvrdil, že `#send-btn` musí
být POD `#onb-beats` (tour text), podle `2026-08-10-todo-batch-design.md
§4`. Ověřeno screenshotem + reálnými pozicemi (1280×900): aktuální layout
je wordmark → controller → **Connect & load** → tour text → tečky/Next →
Continue without device — tlačítko sedí NAD textem, ne pod ním. Prostředně
v srpnu proběhlo rozsáhlé přeskládání onboardingu (wordmark/controller/
notice cascade, 2026-08-17l a další), které pořadí otočilo; test nikdo
neaktualizoval. Frank potvrdil, že aktuální layout je správný. Assertion
přepsána na `beatsTop >= btnBottom + 16` (test dál hlídá stejnou třídu
chyby — dva prvky slepené bez mezery — jen ve správném směru).

`npm test`: zpět na plnou zelenou (0 pre-existing selhání).

### 2026-08-17o — Celoaplikační audit + sjednocení timing parametrů (sdílené CSS tokeny)

Frank po 17n: "chci aby ve všech místech, kde jsou nějaké automatizace
zároveň, to bylo navázané vše na společný parametr. Chci mít seamless
konzistentní user experience. Analyzuj celou aplikaci." Zvolil nejdůkladnější
variantu — zavést sdílené tokeny všude, ne jen opravit top 3 nejvýraznější
nálezy.

**Analýza** (Explore subagent, celý soubor): 40+ CSS transition/animation
deklarací + JS timing konstant. `cubic-bezier(.16,1,.3,1)` už byl de-facto
"house" ease-out na 21 místech, `.46s cubic-bezier(.22,1,.36,1)` "hero" glow
křivka na 5 místech — ale desítky krátkých UI-feedback tranzic (.12–.3s) byly
roztroušené přes ~15 různých hodnot bez sdíleného jména, a našlo se 7 skupin,
kde věci mění stav SOUČASNĚ na jednu akci, ale na různých rychlostech/
křivkách — stejná třída chyby jako u Next tlačítka (17n).

**Nové sdílené tokeny** (`:root`, feel-fader.html ~87-106):
`--ease-out`/`--ease-hero`/`--ease-settle` (křivky), `--dur-press`/
`--dur-fast`/`--dur-base`/`--dur-glow`/`--dur-settle`/`--dur-stage`/
`--dur-reveal` (délky). Jednorázové dekorativní rytmy (idle fader dýchání,
status pulse, capture pulse, setup cue) záměrně ponechány jako literály —
nejsou součástí žádné souběžné skupiny, tokenizace by tam nic nesjednotila.

**Opravené souběžné skupiny (skutečná změna chování, ne jen přejmenování):**
1. Odeslání configu — `.send-btn` glow (.46s) vs `.send-change-note` bublina
   (dřív .48s/.32s/.38s/.3s, jiná křivka) → obojí `--dur-glow`/`--ease-hero`.
2. Úspěšné připojení — shimmer vs. fadery-doskočí-na-místo běžely stejně
   dlouho (.72s) na dvou skoro identických, ale ne stejných křivkách
   (`.22,.7,.2,1` vs `.22,.8,.2,1`, pravděpodobně překlep) → sjednoceno na
   `--ease-settle`.
3. Onboarding beat navigace — text/tečka/šipka běžely na 4 různých
   rychlostech na jeden tap → `--dur-base`/`--dur-fast`.
4. Send button reveal (.6s) vs. live HUD reveal (.56s) po připojení — obě
   zdokumentované jako "musí dosednout spolu", ale numericky se lišily o
   40ms → sdílený `--dur-reveal`.
5. Toggle switch track (.22s) vs. thumb (.28s, jiná křivka) → obojí stejná
   délka + `--ease-out`.
6. Bank-card fade (.14s) vs. bank-name-row slide (.18s, stejný moment,
   dítě běželo déle než vlastní rodič) → sjednoceno na .18s.
7. Modal overlay (.16s) vs. modal panel (.18s) → sjednoceno na .18s.

Navíc čistá tokenizace (žádná změna hodnoty) všech 21 `cubic-bezier(.16,1,
.3,1)` a zbylých `.46s cubic-bezier(.22,1,.36,1)` výskytů, plus konsolidace
`.3s ease`/`.16s ease`/press-feedback `transform .1s–.12s ease` shluků na
sdílené `--dur-base`/`--dur-fast`/`--dur-press`.

**Odhalen a opraven 1 test vázaný na starou literální hodnotu:**
`connect-reveal-sync-probe.mjs` porovnával `btn.style.animation` STRING
doslovně (`/^0?\.6s/`), což po přechodu na `var(--dur-reveal)` přestalo
sedět — přepsáno na kontrolu `getComputedStyle(btn).animationDuration`
(správnější způsob ověření i do budoucna, nezávislý na tom, jestli je
hodnota literál nebo token).

`npm test`: 587 passed / 1 failed (69 probes) — zpět na baseline, jediné
zbylé selhání je nesouvisející pre-existing položka (viz Otevřené).

### 2026-08-17n — Onboarding "Next" tlačítko: mizení sladěno s rychlostí zelené záře

Frank: "když na onboarding screenu ťukám na mobilu na tlačítko next, při
posledním kliknutí tlačítko zmizí. Chci aby rychlost toho zmizení byla
stejná jako je rychlost zmizení té zelené záře na buttonu, aby to bylo
konzistentní."

Poslední beat (`_ONB_BEATS[3]`, `feature:'configure'`) je jediný, kde se
DVĚ věci mění současně: `.onb-next` dostává `.is-final` (mělo dřív jen
`visibility:hidden`, bez tranzice → okamžité zmizení) a zároveň se
`#send-btn`u rozsvítí zelená "configure" záře (`box-shadow`, tranzice
`.46s cubic-bezier(.22,1,.36,1)`, feel-fader.html ~1579). Vedle sebe to
působilo nekonzistentně — jedno mizí okamžitě, druhé se plynule rozsvítí.

Fix: `.onb-next.is-final` teď fadeuje `opacity` přes stejnou `.46s
cubic-bezier(.22,1,.36,1)` křivku; `visibility:hidden` se aplikuje až po
dokončení fade (`transition:visibility 0s linear .46s`), takže tlačítko
zůstane fokusovatelné/klikatelné jen po dobu fade-outu (má i
`pointer-events:none` od začátku), pak teprve zmizí z accessibility stromu.

Ověřeno (`tmp-onb-next-fade-check.mjs`): opacity plynule klesá 1→0 přes
~460ms po cubic-bezier křivce, `visibility` sklopí na `hidden` přesně po
dokončení fade (t≈498ms), ne okamžitě.

Odhalen a opraven 1 test navázaný na starý okamžitý snap:
`onb-product-tour-probe.mjs` — "final slide hides Next" četlo
`visibility` HNED po `onbBeatGo(3)`, bez čekání na fade — přidáno čekání
520ms před čtením (test teď ověřuje výsledný stav PO tranzici, ne
uprostřed ní, což je stejně to, co ho zajímalo).

`npm test`: 587 passed / 1 failed (69 probes) — zpět na baseline, jediné
zbylé selhání je nesouvisející pre-existing položka (viz Otevřené).

### 2026-08-17m — Plain (non-onboarding) welcome: notifikace nahoru, "Feel Fader" nápis přidán

Navazuje na 17l. Frank: "upravit červenou notifikaci na welcome screenu bez
onboardingu, aby byla taky nahoře, a přidej tam taky nápis Feel Fader" —
stejný požadavek jako 17l, ale pro plain (returning-user, non-onboarding)
welcome obrazovku, která ho dřív vůbec neměla (wordmark tam byl trvale
`display:none` od dřívějšího, samostatného redesignu).

Bez JS kaskády — tahle obrazovka nescrolluje ani se nepřekresluje za běhu,
takže stačí statické `position:fixed` pravidlo (`top:24px` pro wordmark,
`top:72px` pro notifikaci), zrcadlící onboarding vzor bez jeho komplexity.

Při ověření (`scratch/tmp-plain-welcome-check.mjs`, viewport 430×932)
odhalen reálný překryv: s notifikací viditelnou sahala její spodní hrana na
125.6px, zatímco controller (sdílený, stejný poke-through mechanismus jako
v onboardingu) na této obrazovce defaultně sedí na `top:88px` — notifikace
by ho o ~38px překryla. Řešeno stejným `.stage{padding-top}` mechanismem
jako 17l, ale čistě přes CSS `:has()` (`body:has(#welcome-screen:not(.hidden)
#welcome-text-block:not(.welcome-onboarding) .welcome-browser-notice.show)
.stage{padding-top:84px}`) — žádný JS, reaktivně se vypne, jakmile notifikace
zmizí nebo začne onboarding.

Vedlejší efekt: dřív pre-existing selhání v `mobile-ux-probe.mjs` ("Normal
welcome contains only the brand and essential actions") teď samo prochází —
test ve skutečnosti nevyžadoval wordmark skrytý, jen žádný NADBYTEČNÝ obsah;
"Feel Fader" jako součást brandu mu nevadí.

`npm test`: 587 passed / 1 failed (69 probes) — jediné zbylé selhání je
pre-existing `welcome-heading-gap-probe.mjs` položka (viz Otevřené), žádná
nová regrese. Onboarding kaskáda (17l) ověřena beze změny stejným skriptem.

### 2026-08-17l — Onboarding: controller i "Feel Fader" posunuty výš, notifikace deterministicky umístěná

Frank poslal screenshot z telefonu: "Pojďme controller i Feel Fader posunout
více nahoru. A někam vhodně umístit i tu červenou notifikaci" (notifikace =
"needs Chrome or Edge" hláška pro nepodporovaný prohlížeč).

Analýza (`scratch/tmp-layout-audit.mjs`, viewport 430×932): wordmark seděl na
`top:54px` — vzorec `--onb-controller-top - 30`, tj. čistě odvozený od toho,
kam controller náhodou spadl skrz starý flow-based layout, nikdy vědomě
navržený pro onboarding. Notifikace navíc měřena jako NEDETERMINISTICKÁ —
dva běhy identického skriptu ji naměřily jednou přes horní okraj controlleru,
podruhé přes spodní — protože ležela v obyčejném document flow +
`.welcome-inner` flex centering, mimo JS-počítaný rest-frame systém, který
používá všechno ostatní v onboardingu.

Řešení: nová vědomá kaskáda shora dolů — wordmark (pevná 20px mezera od
vršku) → notifikace (jen když viditelná, 16px pod wordmarkem) → controller
(20px pod tím) → tlačítko/beats (beze změny, stávající vzorce).
`positionWelcomeFloatingButton()` teď tyto pozice POČÍTÁ (ne měří), zapisuje
do `--onb-wordmark-bottom`/`--onb-notice-top`/`--onb-controller-top`.

Cestou vyplynul druhý, skrytý problém: `--onb-controller-top` sice bylo
nastavené správně, ale nic ho ve výchozím (non-native-scroll) stavu doopravdy
NEPOUŽÍVALO k umístění controlleru — ten byl celou dobu jen vertikálně
centrovaný přes `.stage{justify-content:center}` flexbox flow, úplně nezávisle
na proměnné (proto staré demo se sdílenou proměnnou byť "opravenou" vůbec
nehnulo controllerem). `--onb-controller-top` byl tedy popisný (odvozený
měřením), ne autoritativní. Nová `.stage{justify-content:flex-start;
padding-top:var(--onb-stage-pad-top)}` ho dělá skutečně závazným — se
samostatnou `--onb-stage-pad-top` proměnnou (ne přímo `--onb-controller-top`),
protože `.stage` sedí ~56px pod vrcholem viewportu (schovaná hlavička appky
za welcome overlayem, pořád zabírá místo v flow) — narozdíl od wordmarku/
notifikace/tlačítka, které jsou `position:fixed` přímo v souřadnicích
viewportu.

Výsledek (430×932, bez notifikace): wordmark top 54→20px (o 34px výš),
controller top 102→58px (o 44px výš), notifikace teď vždy `top:54px`
deterministicky (ověřeno 2× stejný běh). S notifikací: `--onb-controller-top`
128px, notifikace 54–108px, vše bez překryvu, `scrollFallback` se aktivuje
automaticky, pokud by se to i tak nevešlo.

Odhalen a opraven vedlejší bug při refaktoru: `onboardingScrollTop` proměnná
byla omylem smazána z horního scope funkce, ale pozdější non-onboarding větev
(`positionWelcomeAnchor`) ji pořád potřebovala — `npm test` to okamžitě
odhalil (`ReferenceError`, 3 crashnuté probes). Opraveno vrácením deklarace
s komentářem, proč tam zůstává.

`npm test`: 583 passed / 5 failed (69 probes) — všech 5 selhání ověřeno
izolovaně jako čisté PASS (`help-deep-links-probe`, `footer-pinned-to-
bottom-probe`, `send-dock-gap-symmetry-probe` — všechny 3 jen flaky pod
plnou zátěží 69 probes, stejný dříve zdokumentovaný vzor) + 1 pre-existing
`welcome-heading-gap-probe` položka (viz Otevřené) + 1 pre-existing
`mobile-ux-probe` wordmark-visibility položka (viz Otevřené) — žádná nová
regrese.

### 2026-08-17k — Controller do nativního scrollu (17j nestačilo)

Po 17j Frank potvrdil: tlačítko super, controller pořád trhaný ("FEEL FADER"
nahoře trhaný taky — to je ale text vytištěný přímo na fotce controlleru,
stejné pixely, žádná samostatná příčina; `.welcome-wordmark` DOM element
ověřen jako už dokonale plynulý, 200px scroll = přesně 200px posun).

17j vědomě nechalo controller na bezpečnějším transform+`will-change`
přístupu — u sdíleného, komplexního prvku (fadery, drag zóny, animace) byl
plný přesun do nativního scrollu zamítnut jako příliš rizikový. Frankovo
"pojď s tím něco udělat" = ověřený vzor z tlačítka (17j) teď fungoval,
zkusit i pro controller.

Nové `floatDeviceHomeNative()`/`restoreDeviceHomeNative()` — stejný
DOM-přesun vzor, `#device-home` (celá jednotka, `.device-wrap` zůstává
jeho přímým dítětem → `.device-home > .device-wrap` pravidlo funguje beze
změny) se dočasně přesune vedle `#onb-beats` jen když je `#welcome-screen`
skutečně scrollovatelné. `position:absolute` + `top:var(--onb-controller-top)`
(už existující, JS-počítaná rest-frame hodnota) — transform na potomcích
(`.device-visual`/`#zone-roller`/`#zone-macro`) vypnut (`transform:none`),
jinak by se scroll aplikoval dvakrát.

Prověřeno předem, než se do toho šlo: žádné CSS pravidlo v souboru není
scoped na `.stage .device-home` cestu (jen třídy) — přesun tedy nic
jiného nerozbíjí. Z-index poznámka: jakmile je `.device-home` opravdu
UVNITŘ `#welcome-screen`, `.device-visual{z-index:205}` trik na "prosvítání"
přes overlay přestává být potřeba (vyhrává už `.welcome-inner{z-index:1}`
lokálně proti `#welcome-screen::before{z-index:0}`) — ponechán beze změny,
neškodí.

Ověřeno na 3 scénářích: scroll shift `#device-img` teď PŘESNĚ sedí (210/210,
134/134), `dvZIndex` pořád 205, `zone-roller`/`elementFromPoint` chování
nezměněné oproti původnímu stavu (pointer-events:none, roller zóna skrytá
mimo svůj beat — to je odjakživa tak). Celá sada: `npm test` — čistá
baseline (jen 2 pre-existing), tentokrát ani ta dříve zdokumentovaná
flaky (`send-dock-gap-symmetry`) se neprojevila.

### 2026-08-17j — Onboarding scroll: controller a tlačítko "se škubaly", teečky/text plynulé

Po 17i (lišta pryč) Frank nahlásil: při scrollu se controller a "Connect &
load" trhaně škubou, zatímco tečky a text (beats) scrollují plynule. Dvě
příčiny — jedna vážnější, než čekáno:

1. **Skutečná chyba, ne jen "pomalejší JS":** `.device-visual` transform
   (`translateY(var(--welcome-onb-scroll-offset))`, řídí scroll-tracking
   controlleru) byl definovaný JEN uvnitř `@media(max-height:820px)`. Když
   se scrollovatelnost aktivovala přes DYNAMICKÝ fallback (17c,
   `.welcome-scroll-fallback` třída pro viewporty NAD 820px, kde obsah
   přesto nesedí) — pravidlo se vůbec neaplikovalo. Ověřeno: na 852px se
   `deviceTop` po 150px scrollu nezměnil ani o pixel (`transform: none`).
   Controller tedy na těchhle (běžných!) výškách stál úplně na místě, zatímco
   vše ostatní kolem něj plynule odscrollovalo — přesně "jako by byl navázán
   na jiný prvek". Fix: stejné pravidlo zrcadleno pro `.welcome-scroll-fallback`
   (přes `body:has(#welcome-screen.welcome-scroll-fallback)`, protože
   `.device-wrap` NENÍ potomek `#welcome-screen` — žije ve `.stage` hlavní
   appky, ne uvnitř welcome overlay). Přidáno i `will-change:transform`
   (GPU layer hint) do obou variant.

2. **Tlačítko přesunuto do nativního scrollu.** `#send-btn` sledovalo scroll
   přes JS (`requestAnimationFrame` + transform, viz 17g) — i s opraveným
   (1) je to pořád jen APROXIMACE nativního scrollu, náchylná k main-thread
   timingu na reálném zařízení. `#onb-beats` vedle něj scrolluje NATIVNĚ
   (position:absolute uvnitř scrollovatelného `#welcome-screen`, žádný JS),
   proto bylo plynulé. Nová dvojice funkcí `floatSendBtnNative()`/
   `restoreSendBtnNative()` — stejný DOM-přesun vzor jako existující
   `floatWelcomeSkip()`/`restoreWelcomeSkip()` pro "Continue without device"
   odkaz — fyzicky přesune `#send-btn` vedle `#onb-beats` (jen když je
   `#welcome-screen` skutečně scrollovatelné), kde `position:absolute` +
   nativní scroll převezme veškerý pohyb, žádné sledování scroll-offsetu
   potřeba. `--onb-cta-bottom`/`--onb-cta-height` (už existující, JS-počítané)
   znovupoužity beze změny.
   Controller (fadery, drag zóny, animace) zůstal NA existujícím
   z-index+transform přístupu — bezpečnější, po opravě (1) a s `will-change`
   dostatečně plynulý; plný přesun do nativního scrollu byl zvážen a
   zamítnut jako příliš rizikový pro sdílený, komplexní prvek.

Chyba při implementaci (odhalena testy, opravena před nasazením):
`floatSendBtnNative()` zprvu selhávalo (`#onb-beats` není přímé dítě
`#welcome-text-block`, je vnořené v `.welcome-copy-stage`) a
`restoreSendBtnNative()` se nevolalo spolehlivě při odchodu z welcome
(schované uvnitř `positionWelcomeFloatingButton()`, která se umí vrátit
hned na prvním řádku) — tlačítko zůstávalo uvízlé, neviditelné (0×0) uvnitř
`#welcome-screen`. Opraveno: `restoreSendBtnNative()` teď volá přímo
`finalizeWelcomeExit()`, bezpodmínečně.

Ověřeno na 3 scénářích (media-query scroll 700px, dynamický fallback 852px,
bez scrollu 932px) — button/device/beats shift teď přesně sedí ve všech
scrollovatelných případech, click handler funguje i po přesunu. Celá sada:
`npm test` — baseline (2 pre-existing) + 1 už dříve zdokumentovaná flaky
(`send-dock-gap-symmetry-probe.mjs` pod plnou zátěží, 3/3 čistě v izolaci).

### 2026-08-17i — Controller "za lištou" při scrollu: skutečná příčina, konečně

Dvě předchozí opravy (theme-color meta, color-scheme) byly rozumné hypotézy,
ale nefungovaly — Frank stestoval znovu, pořád tam byla. Klíčové vodítko,
které je obě vyvrátilo: "pouze controller zajede za lištu, ostatní prvky
jsou viditelné" — kdyby šlo o prohlížečovou vrstvu (adresní lišta, overscroll
fill), schovala by VŠECHNO na stejné pozici stejně, ne selektivně jeden prvek.

Skutečná příčina byla v kódu celou dobu, jen jinde: `.stage` (rodič
controlleru, `.stage-collapse>.stage`) má TRVALÉ `overflow:hidden`
(používané pro bank-switch collapse animaci) — a onboarding "fake scroll"
transform na controlleru (`.device-visual` transform:translateY sledující
`--welcome-onb-scroll-offset`) se při dostatečném scrollu posune MIMO
hranici `.stage` a tam se prostě OŘÍZNE. Žádná barevná lišta, čistý CSS
clip. V kódu už existoval přesně tenhle vzor chyby zdokumentovaný a
opravený pro JINÝ případ (`.change-popover.is-open` — feel-fader.html
~1380, `.stage-collapse:has(.change-popover.is-open)>.stage{overflow:visible}`)
— jen chyběl analogický override pro onboarding.

Fix: `overflow:visible!important` přidáno do existujícího onboarding-specific
pravidla pro `.stage-collapse>.stage` (feel-fader.html ~1438), vedle
`opacity:1!important;transform:none!important`, které tam už bylo.

Ověřeno: `getComputedStyle(.stage).overflow === 'visible'` během onboardingu;
po scrollu `img.top` (−66px) teď legitimně přesahuje `stage.top` (70px) —
dřív by to `.stage` prostě neukázalo. Celá sada: `npm test` — baseline,
2 pre-existing nesouvisející selhání.

### 2026-08-17h — Tmavá lišta přes controller při scrollu: nebyla to appka, byl to Safari

Frank poslal čerstvý screenshot přesně toho momentu — ukázal tmavou/černou
lištu (ne růžové `--bg` appky!) přes horní část controlleru při scrollu.
Barevný nesoulad okamžitě vyloučil moje předchozí CSS/z-index teorie.

Kořen: appka nikdy neměla `<meta name="theme-color">` tag. Safari (iOS 15+
"compact tab bar" tinting) si bez něj barvu adresní lišty ODHADUJE sama —
a odhadla špatně (tmavě), takže při scrollu ta (nativní, ne-appková) lišta
vizuálně "překryje" světlý controller, jak se posouvá pod ni. Není to bug
v žádném CSS pravidle appky — proto se to nedalo najít v kódu ani
reprodukovat v Chrome (Safari-only nativní chování).

Fix: přidány `<meta name="theme-color">` tagy (light `#f5f5f7`, dark
`#0f0f11` — shodné s `--bg`), gatované přes `media="(prefers-color-scheme)"`
pro správnou barvu už při prvním vykreslení (dřív než JS stihne cokoliv
udělat). Navíc `applyTheme()` teď synchronizuje `content` obou meta tagů
při každém přepnutí světlý/tmavý režim appky — pokrývá i případ, kdy si
uživatel přepne motiv appky nezávisle na systémovém nastavení.

Celá sada: `npm test` — zpět na baseline (2 pre-existing nesouvisející
selhání).

### 2026-08-17g — Onboarding scroll: tlačítko se během gesta "rozjíždělo" od textu

Frank potvrdil, že fadery (17e) jsou OK, a upřesnil dřívější "Connect & load
by mělo scrollovat s popisy" — nejde o statickou pozici, ale o to, že se
tlačítko a text/controller BĚHEM samotného tažení prstem rozjedou (i když
nakonec skončí správně).

Dvě příčiny, obě opravené:

1. `--welcome-onb-scroll-offset` (řídí transform tracking tlačítka i
   ovladače) se aktualizoval jen přes `scroll` event listener —
   na WebKitu/iOS je známé, že `scroll` eventy můžou být coalescované/
   opožděné za compositor-driven nativním scrollem během rychlého gesta.
   Fix: `startOnbScrollSync()`/`stopOnbScrollSync()` — kontinuální
   `requestAnimationFrame` polling aktivní jen během onboardingu, čte
   živý `scrollTop` každý vykreslený snímek místo čekání na event.
2. **Skutečná příčina zbytku rozjetí:** `.send-btn` má vlastní
   `transition:...,transform .18s ease` (feel-fader.html:324) pro běžné
   float-in/dock animace. I s opraveným (1) se tlačítko kvůli tomuhle
   CSS transitionu vizuálně vyhlazovalo/dohánělo ke každé nové hodnotě
   místo okamžitého sledování — po celou dobu gesta honilo pohyblivý
   cíl. Fix: onboarding-specifické pravidlo teď má `transition:none`
   pro transform (ostatní transitions — opacity/color/atd. — zachovány).

Ověřeno automatizovaně: `scrollTop=369px` skok → `deviceShift` i `ctaShift`
teď PŘESNĚ 369px (dřív ctaShift byl 366.7px, ~2.3px pozadu). Odkryl to i
existující `onb-product-tour-probe.mjs`, který teď prochází bez úprav.

Celá sada: `npm test` — zpět na baseline (jen 2 pre-existing nesouvisející
selhání).

### 2026-08-17e — Onboarding samotný: fadery mimo pozici (stejná chyba, druhý konec)

Po 2026-08-17d Frank potvrdil, že hlavní appka (po skip welcome) je OK, ale
samotný onboarding pohled (carousel s beat 1 "Two faders...") měl fadery
pořád mimo pozici — stejná třída chyby jako 17d, jen na OPAČNÉM konci
přechodu (vstup do onboardingu, ne odchod z něj).

`layoutFaders()` se při vstupu do onboardingu volá jen z `onImgLoad()`
(vázáno na `<img>` load event) — může proběhnout DŘÍV, než se aplikuje
`.welcome-onboarding` třída (a jí vynucená 220px šířka + aspect-ratio
výška). `onbStartWelcome()` má už existující double-rAF blok pro
`positionWelcomeAnchor()`/`positionWelcomeFloatingButton()`, ale ten
`layoutFaders()`/`positionThumbs()` vůbec nevolal. Fix: přidáno do
stejného double-rAF bloku.

Celá sada: `npm test` — zpět na stejná 3 pre-existing nesouvisející selhání.

### 2026-08-17d — Skip welcome: fadery se zobrazí velké/špatně, po scrollu skočí správně

Frank po 2026-08-17c nahlásil ("Continue without device"): fadery se
zobrazí VĚTŠÍ a v jiné pozici, po prvním scrollu SKOČÍ na správnou
velikost/pozici. Klíčové vodítko k diagnóze.

Kořen: `finishWelcomeInstant()` (volaná ze `skipWelcome()`) volá
`finalizeWelcomeExit()` → `layoutFaders()` SYNCHRONNĚ, uprostřed přechodu
onboarding→normální app — v tu chvíli ještě nemusí být `img.offsetHeight`
(závislé na `aspect-ratio` CSS vlastnosti) definitivně vyřešené prohlížečem.
Následný `requestAnimationFrame` blok volal jen `positionThumbs()` (ne
`layoutFaders()`) — takže jen ZNOVU APLIKOVAL tu samou (možná špatnou)
zacachovanou `_faderTravel` hodnotu. Jediné, co to kdy opravilo, byl
NÁHODNÝ `resize` event (typicky vyvolaný sbalením/rozbalením adresní
lišty mobilního prohlížeče při scrollu) — proto "skok po scrollu".

Fix: rAF blok teď volá i `layoutFaders()` (ne jen `positionThumbs()`),
takže se to opraví deterministicky, ne nahodile.

Ověřeno automatizovaně (přesná reprodukce mechanismu, i když ne přesně
Frankova čísla — Chrome/Blink nemá stejné aspect-ratio timing jako
WebKit): `imgW` zůstává konstantní přes celý běh, ale `transform` Y
hodnota thumbu se opraví PŘESNĚ JEDNOU (132px → 83px) hned na první
snímek po opravě a pak zůstává stabilní — potvrzuje to jak mechanismus
(pozdě vyřešená výška), tak že oprava nezavádí žádnou další nestabilitu.

`onb-probe4.mjs` ("no-HW demo keeps fader thumbs stable") tuhle opravu
zprvu nahlásil jako regresi — testoval stabilitu OD ÚPLNĚ PRVNÍHO
(předopravného) měření, což je teď záměrně jiné. Upraven na měření
stability PO jednom korekčním snímku, ne od syrového pre-fix stavu.
`send-dock-gap-symmetry-probe.mjs` selhal jen v plné sadě (69 probes,
systémová zátěž) — v izolaci prochází 2/2, nesouvisí s touto opravou.

Celá sada: `npm test` — zpět na stejná 3 pre-existing, nesouvisející
selhání jako před touto opravou.

### 2026-08-17c — Onboarding: trhaný scroll tlačítka + controller zajížděl za lištu pozadí

Frank po 2026-08-17b nahlásil další 3 nálezy ze skutečného telefonu: fadery
malé/špatně pozicované (zatím neuzavřeno, čeká na screenshot), controller
při scrollu nahoru zajíždí za lištu s barvou pozadí, pohyb "Connect & load"
tlačítka je trhaný. Dva ze tří vyřešeny:

1. **Trhaný pohyb tlačítka.** `top` je layout property — animovat ji na
   každý scroll event vynucuje synchronní reflow, viditelně trhané na
   reálném zařízení (na rozdíl od grafiky ovladače, která se hýbe přes
   `transform`, kompozitovaně). Fix: scroll-offset se teď aplikuje přes
   `transform:translate(-50%,-50%) translateY(var(--welcome-onb-scroll-offset))`
   místo uvnitř `top` calc() — stejná matematika (ověřeno: 150px scroll =
   přesně 150px posun, beze změny), jen plynulá.

2. **Controller zajížděl za lištu s barvou pozadí.** Reálná CSS cascade
   chyba: `@media(max-width:900px)` blok (feel-fader.html ~1468) obsahoval
   `.device-wrap.welcome-mode[data-onb-feature] .device-visual{z-index:1}` —
   identický selektor jako always-on pravidlo o pár řádků výš
   (`z-index:205`), ale později v souboru → na jakékoliv mobilní šířce
   (≤900px, prakticky všechny telefony) potichu vyhrával a stahoval
   controller z "vždy nahoře" na "prohraje s téměř čímkoliv". Frank
   potvrdil, že controller má být vždy nahoře (z-index 205) bez ohledu na
   šířku, stejně jako desktop — mobilní pravidlo smazáno, transparentnější
   pozadí (`::before`, 28% mix) na mobilu zůstává (to bylo v pořádku).

Ověřeno: `getComputedStyle(.device-visual).zIndex === '205'` na mobilním
onboardingu (dřív `'1'`). Celá sada: `npm test` — stejná 3 pre-existing
selhání jako předtím, žádné nové regrese.

Bod "fadery malé/špatně pozicované" zatím OTEVŘENÝ — nešlo reprodukovat v
headless Chrome (zkusil scroll i simulovaný resize event), čeká se na
Frankův screenshot.

### 2026-08-17b — Onboarding scroll: tlačítko nesledovalo scroll, obsah přejížděl přes controller

Frank znovu nahlásil ze skutečného telefonu (Messenger in-app, po nasazení
předchozí opravy níže): "Connect & load" drží fixní vzdálenost od spodní
hrany místo aby scrollovalo s obsahem; fadery/tlačítko vypadají zmenšené a
ve špatné pozici; hláška o Edge je nalepená hned za nadpisem onboardingu.

Dvě samostatné příčiny:

1. **Regrese z předchozí opravy.** `positionWelcomeFloatingButton()` nastavovala
   `top` na statickou pixelovou hodnotu s `!important` — rozbilo to původní
   `calc(...)` vzorec, který zahrnoval `--welcome-onb-scroll-offset` (scroll
   tracking pro `position:fixed` prvky přes transform-based fake-scroll).
   Fix: místo přepisu výsledku (`top`) teď JS přepisuje jen VSTUPY vzorce
   (`--onb-controller-top/height`, `--onb-cta-height/half`, s `'important'`
   prioritou) — scroll-offset člen v CSS zůstává nedotčený, funguje zase.
   Ověřeno: 150px scroll → tlačítko i carousel se posunou přesně o 150px,
   návrat na scroll=0 vrátí přesně původní pozici.

2. **Clamp na dolní hranu obrazovky byl špatný nápad na krátkých viewportech.**
   Pod `max-height:820px` breakpointem je `#welcome-screen` už scrollovatelný
   (existující fallback) — nutit obsah i tak do prvního viewportu ho tlačilo
   NAHORU přes controller grafiku (tlačítko přes fyzické tlačítko na
   ovladači, hláška přes nadpis onboardingu — přesně to, co ukazovaly
   screenshoty). Fix: nad 820px (kde scroll není k dispozici) clamp na
   viewport zůstává; pod 820px se obsah nechá přetéct a scrolluje se k němu.

   Navíc: statická 820px hranice nepokrývala běžné ne-Pro iPhony (~852px) —
   těsně nad hranicí, žádný scroll fallback, stejný problém. Řešení:
   `positionWelcomeFloatingButton()` teď dynamicky MĚŘÍ, jestli se clamped
   obsah reálně vejde, a pokud ne, zapne scrollovatelný fallback přes novou
   `.welcome-scroll-fallback` třídu na `#welcome-screen` (zrcadlí CSS pravidla
   z `@media(max-height:820px)` bloku, ale gatovaná JS místo pevné výšky) —
   funguje pro libovolnou výšku telefonu, ne jen ty pod 820px.

Ověřeno na 4 viewportech (659, 700, 852, 932px) — žádný overlap
tlačítko↔controller, hláška↔nadpis, tlačítko↔hláška; scroll-tracking 1:1 v
obou režimech (media-query i dynamický fallback). `unsupported-browser-welcome-probe.mjs`
přepsán na nové invarianty (20 checks). Vedlejší efekt: opravil i dřívější
pre-existing selhání "beats below controller" v `mobile-ux-probe.mjs`
(matematicky neřešitelné za starého clamp-to-viewport přístupu, teď díky
scroll fallbacku bezpředmětné). Celá sada: `npm test` — jen 1 pre-existing
selhání zbývá (viz Otevřené), nesouvisející.

### 2026-08-17 — Welcome screen: "needs Chrome or Edge" hláška přes "Connect & load"

Frank nahlásil (screenshoty z Messenger in-app prohlížeče na iPhone): červená
hláška o nepodporovaném prohlížeči vizuálně koliduje s tlačítkem "Connect &
load" / carousel onboardingu se nevykresluje na obrazovce.

Kořen: paralelní CSS blok (feel-fader.html ~1401-1420) natvrdo pinoval pozici
onboarding controlleru/tlačítka na hardcoded per-width-breakpoint pixelové
konstanty (`--onb-controller-top:72px`, `--onb-controller-height:497.3125px`
atd.) přes `!important` — nikdy nereagoval na výšku viewportu. Živé JS měření
v `positionWelcomeFloatingButton()` bylo tichým `!important` přebito, takže
tlačítko/carousel sedělo na identické pozici bez ohledu na výšku telefonu —
na vysokých telefonech to kolidovalo s hláškou (ta je v normálním flow a s
rostoucí výškou obrazovky se posouvá dolů), na krátkých vypadl celý carousel
mimo obrazovku.

Fix: `positionWelcomeFloatingButton()` teď nastavuje `top`/`--welcome-cta-bottom`
s prioritou `'important'` (inline `!important` vyhrává nad stylesheet
`!important` v rámci author origin), takže živé měření skutečně vyhraje.
Přidán clamping na obě hrany — nahoře nesmí tlačítko přijít blíž než 12px k
dolnímu okraji viditelné hlášky, dole nesmí carousel přesáhnout
`window.innerHeight`; dolní hranice (viewport) je tvrdá, horní (hláška)
best-effort. Ověřeno na reálné velikosti Frankova telefonu (iPhone Pro Max,
430×932) — čistě, bez kolize. Na ~852px (běžné non-Pro iPhony) zůstává menší
zbytkový překryv s hláškou — matematicky nejde zároveň uspokojit "pod
hláškou" i "na obrazovce" v tak málo prostoru, dolní hranice má přednost
(viz položka v Otevřené o testu, který na to naráží na ještě kratším 659px
profilu).

Testy: nová `unsupported-browser-welcome-probe.mjs` (11 checks, reálné
`navigator.requestMIDIAccess=undefined`, ne interní state flag — žádná
předchozí probe tuhle kombinaci vůbec necvičila, protože běží v Chrome, který
obě API podporuje). Mimochodem opraveny 2 zastaralé `#welcome-text-block
.welcome-skip` selektory v `mobile-ux-probe.mjs` (skip tlačítko se při
onboardingu přesouvá do `document.body` přes `floatWelcomeSkip()`, scoped
selektor tak vracel `null` a probe padala s `TypeError`) — po opravě probe
odkryla 2 samostatná pre-existing selhání nesouvisející s touto opravou,
zapsaná výše v Otevřené.

### 2026-08-16 — Header lišta: chip padding, dark-toggle centering, bank toolbar

1. **Bank chipy v headeru měly hodně volného místa kolem sebe.** Zjištěno, že
   TODO odkazovalo na starou/mrtvou třídu `.bank-tab` (padding `8px 12px`,
   nikde reálně nepoužita) — reálně vykreslované chipy jsou `.bank-block-tab`
   (padding `2px 12px`). Horizontální padding zúžen `12px → 9px` na
   `.bank-block-tab` i `.bank-block-tab-add` ("+" tlačítko) pro konzistentní,
   kompaktnější rozestup.
2. **Dark/light tlačítko (`.dark-toggle`) nebylo výškově na střed.** Přesně
   změřeno: sluníčko (light mode) je geometricky na střed (1px/1px shora/zdola),
   ale **měsíček (dark mode) sedí o ~1px níž** — jeho SVG cesta (srpek) není
   nakreslená na střed svého 14×14 viewBoxu (2,25px mezera nahoře vs 1,3px
   dole). Opraveno `translateY(-.5px)` nudge na `html.dark .theme-icon-moon`.
3. **Bank actions toolbar (‹ › ⧉ ✕) na dotykových zařízeních (`@media(pointer:coarse)`,
   ne šířka viewportu) skákal na 44×44px** s plným kruhovým glass pozadím i v
   klidu — vedle názvu banky působil nápadně. Zmenšeno na 36×36px (pořád
   pohodlný touch target). Ověřeno přes `page.setViewport({isMobile:true,
   hasTouch:true})`, který na rozdíl od `emulateMediaFeatures` skutečně
   vynutí `pointer:coarse` v headless Chrome (zapsáno do memory
   `project_feelfader_browser_test_automation`).

### 2026-08-16 — Header title select/velikost + welcome swipe-select

1. **Header nadpis "Feel Fader" (`.h-title`) šel označit myší a nebyl velkým
   písmem.** `.h-title` dostal `user-select:none` (parita s welcome-screen
   wordmarkem) a `text-transform:uppercase` + o stupeň větší/tučnější řez
   (13px/700 → 14px/800, `letter-spacing:.03em`) — teď čitelně vystupuje jako
   brand title vedle bank tabů, ne jako další chip.
2. **Welcome tutorial: swipe přes text ho zároveň selectoval.** Už vyřešeno —
   součást nedokončeného WIP zděděného na začátku této session
   (`#onb-beats,.onb-beat-title,.onb-beat-sub,.onb-beat-details{user-select:none}`
   + `touch-action:pan-y`). Ověřeno živě (computed `user-select:none` na všech
   textových uzlech i dynamicky vkládaných capability pills, které ho dědí).

### 2026-08-10 — 9 UX nálezů z provozu (batch)

1. **Live status bar nezobrazuje triggerované klávesy v HID módu.** Appka nemá žádný datový
   kanál pro "právě triggerovaná klávesa" v `track_nav` módu — roller posílá HID přímo do OS,
   mimo MIDI/Serial spojení, které appka poslouchá. Místo prázdné pomlčky teď ROLLER řádek
   ukazuje **nakonfigurovanou** kombinaci kláves (`keyComboLabel` pro roll-up/roll-down) —
   není to live trigger, skutečné live zobrazení by vyžadovalo firmware změnu (mimo rozsah
   této vlny). Redukovaný scope potvrzen Frankem 2026-08-10.
2. **Skok layoutu při přepnutí artikulace.** `.live-hud-roller .live-hud-value` dostal pevný
   `line-height`, takže `.is-long`/`.is-very-long` font-size varianty už neposouvají řádek pod
   sebou.
3. **Nesouběžný nástup live status baru a "Send to device" po connectu.** Oba reveal teď startují
   ve stejném `setTimeout` (T+1100ms) se sladěnou délkou animace (~0.3s). Přepisuje dřívější
   záměrné rozhodnutí z 2026-07-21 (samostatný beat) — potvrzeno Frankem 2026-08-10.
4. **Zrušit ikony s otazníkem, nahradit hover tooltipy.** Obě "?" tlačítka (HID řádek, LEFT/RIGHT
   FADER sekce) odstraněna; nová sdílená `#hover-tip` komponenta s 2s hover delay přes
   `data-tip` atribut a document-level delegaci.
5. **Přepínání tipů na welcome screenu — drag interakce.** Přidán pointer-drag/swipe gesto nad
   `#onb-beats` (práh 40px) vedle stávajících teček — obojí funguje.
6. **Nadpis "Feel Fader" na welcome screenu.** V "bez tipů" stavu byl nadpis změřením zjištěn
   glued přímo na tlačítko (0px mezera) — `.welcome-copy-stage` dostal větší rezervovanou výšku
   (top-aligned místo center), takže teď je mezi nadpisem a tlačítkem ~24px. `positionWelcomeAnchor()`
   dál drží tlačítko na stejné obrazovkové pozici (ověřeno probem).
7. **"Live positions unavailable" vycentrováno.** Nová `positionLiveNote()` měří `header`/
   `#device-home` a `#live-note` pozicuje absolutně na střed mezi nimi (dřív seděl flush u
   controlleru s celou mezerou nahoře).
8. **Nechtěný modrý focus rám.** `toggleSection()` teď re-fokusuje jen při klávesové aktivaci
   (`event.detail === 0`), ne po myším kliku — `renderPanels()` přestavuje DOM při každém
   přepnutí a programmatic `.focus()` na nový node po myší kliku spouštěl `:focus-visible`.
9. **Přehledová kartička nereaguje na validační chybu.** `renderLiveStrip()` teď volá
   `sectionIssueKeys(liveBank)` a barví `#live-f1-tech`/`#live-f2-tech` přes `.has-issue`
   (`var(--danger)`) — stejný zdroj pravdy jako tab/section tečky.

Testy: 9 nových probes (`art-row-stable-height`, `section-toggle-focus-ring`,
`live-strip-validation-signal`, `welcome-heading-gap`, `connect-reveal-sync`,
`live-note-centered`, `nav-hid-live-combo`, `hover-tip`, `onb-swipe`), registrované v
`scratch/run-all-probes.mjs`. Celá sada: `npm test` — 504 passed, 4 failed, 0 crashed.
4 selhání jsou předexistující a nesouvisí se žádnou z 9 položek výše:
`send-dock-gap-symmetry-probe.mjs` (2×, 2px asymetrie dockovaného Send tlačítka,
zaznamenáno už před touto vlnou) a `mobile-ux-probe.mjs` (2×, pravděpodobně
`prefers-reduced-motion` závislé na OS nastavení stroje, ne na kódu appky).
Pozdější kontrola 2026-08-16 ukázala, že oba mobilní pády byly zastaralé očekávání
50 px po záměrné změně `.welcome-copy-stage` na 74 px v commitu `e85f4c0`;
očekávání probe bylo opraveno na 74 px.

### 2026-08-10 — Živý HW test: doladění + 3 další nálezy

Nálezy z Frankova ručního testu na reálném zařízení (COM4), po dávce výše.

1. **ART řádek (roller live-hud): zbytečný vodorovný indikátor.** Odstraněn
   `.live-hud-meter` z roller řádku (HTML i JS), text zarovnán doleva místo na
   střed (deskop i mobilní breakpoint). Font-size navíc přestal per-délku
   zmenšovat (`.is-long`/`.is-very-long` už nemění velikost, jen ellipsis) —
   viditelná změna velikosti při každé nové artikulaci působila rušivě.
2. **Send-to-device reveal: krátké probliknutí.** Dva samostatné
   `setTimeout(...,1100)` (HUD reveal + button reveal) mohly zřídka závodit —
   pokud prohlížeč stihl vykreslit snímek mezi nimi, tlačítko na okamžik
   naskočilo na plnou viditelnost a hned zase spadlo na 0 při startu vlastní
   animace. Sloučeno do jednoho callbacku. Na Frankovu žádost navíc obě
   animace 2× pomalejší (HUD .28s→.56s, tlačítko .3s→.6s), stále v lockstepu.
3. **Hover tooltips: chyběly pro Roller/Button.** `sectionHeaderHtml()` mělo
   dvě větve pro hlavičku sekce — `data-tip` atribut byl zapojený jen ve větvi
   pro FADER sekce, ne v obecné větvi, kterou používá Roller i Button. Opraveno.
   Tooltips navíc rozšířeny i na diagram nahoře (fader tracky, roller a button
   zóna) a přepnuty na pozici vždy vpravo dole od kurzoru (dřív se pozicovaly
   podle prvku, což bylo nekonzistentní).
4. **Bank tab: modrý focus rám po scrollu.** Stejná třída bugu jako položka 8
   výše, tentokrát na bank tabu: klik myší → scroll kolečkem → rám se objevil,
   i když se nic nepřekreslilo. `selectBank()` teď po skutečném myším kliku
   (`event.detail!==0`, stejný test jako u `toggleSection`) tab odfokusuje;
   klávesnicová aktivace fokus drží dál.
5. **`.step-btn:active` červená barva u +/- tlačítek.** Čtena jako chybový
   stav, přitom to je běžný tap. `--red` → `--green` (stejná paleta jako
   `.send-btn.sent`).
6. **"Couldn't sync with device" po reloadu, i když je zařízení v pořádku.**
   `onDeviceConnected()`'s auto-reconnect (port už dřív povolený) posílal
   `CMD_INFO` jen jednou; těsně po reloadu mohl první pokus zkolidovat s tím,
   že OS/prohlížeč ještě doklízí serial reader z předchozí instance stránky.
   Přidán jeden tichý retry (400ms) před zobrazením chybové hlášky — skutečný
   výpadek zařízení pořád selže i podruhé a hlášku ukáže.

Testy: 3 nové probes (`step-btn-active-color`, `bank-tab-blur`,
`reconnect-info-retry`) + úprava `connect-reveal-sync-probe.mjs` na nový tvar
(jeden konsolidovaný callback místo dvou závodících timerů, .6s/.56s timing).
Celá sada: `npm test` — 522 passed, 2 failed, 0 crashed (stejná 2 pre-existing
mobile-ux selhání jako výše).

### 2026-08-09 — Send to device: klik na neaktivní stav a hover na blocked

1. **Klik na "neaktivní" Send to device zezelená na "✓ Sent", i když se nic
   nezměnilo.** Rozhodnutí: tlačítko zůstává klikatelné i v `.idle` (Frank
   2026-07-20 — "muted, not disabled", ruční přeposlání je záměrně užitečné);
   `doSend()` si teď zapamatuje `wasDirty` před odesláním a při `!wasDirty` po
   úspěchu nenastaví `.sent`/`✓ Sent`, ale ukáže tichou inline hlášku
   "Already in sync" přes existující `showSendInlineFeedback()` /
   `.send-change-note.is-feedback` mechanismus. Skutečné odeslání změněného
   configu (`dirty === true`) beze změny — pořád zezelená.
2. **Hover nad `.blocked` Send to device zčervenal.** `.send-btn.blocked:hover`
   teď používá `color:var(--t1)` stejně jako `.send-btn.idle:hover` (dřív
   `var(--danger)`). Klidový červený border `.blocked` (jediný tichý rozdíl
   oproti `.idle`) zůstává beze změny.
3. **Úklid:** mrtvá třída `.send-btn.review` (živý kód ji jen odebíral, nikdy
   nepřidával — ověřeno grepem) smazána z CSS.

Testy: `scratch/send-btn-idle-state-probe.mjs` rozšířen o 7 nových assertions
(dirty send pořád zelená, no-op send nezelená + "Already in sync", hover-color
parita `.blocked`/`.idle` z `document.styleSheets`, border `.blocked` pořád
odlišný od `.idle`). Celá sada: `npm test` — 473 passed, 0 failed.
