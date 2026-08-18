# Feel Fader Web App — TODO

Frankovy připomínky k dořešení. Hotové položky přesouvat do sekce **Hotovo** s datem.

> **Pozor na zdroj pravdy:** živý kód je inline `<style>` a `<script>` v
> [feel-fader.html](../feel-fader.html). Samostatné pracovní extrakty CSS/JS
> nevytvářet ani needitovat.

## Otevřené

(žádné otevřené položky)

## Hotovo

### 2026-08-18zk — Bank karta: pole pro název banky omezené na 190px šířky

Frank: "U banky chci omezit velikost pole pro zadávání názvu, tak jak
to máme u ostatních poli." `.bank-name-input` (feel-fader.html ~687)
mělo `flex:1;min-width:0` — roztahovalo se na celou dostupnou šířku
headeru. Ověřeno: šlo o VIZUÁLNÍ šířku (pole už má `maxlength="24"` na
`<input>`, ~3147, znakový limit beze změny).

Fix: `max-width:min(190px,100%)` — stejný cap jako `.fader-title-input`
(section title inputy, ~1833), který slouží jako "ostatní pole" vzor.
`flex:1`/`min-width:0` beze změny, takže pole se pořád roztahuje/zužuje
uvnitř dostupného prostoru, jen ne přes 190px.

Ověřeno screenshotem (dlouhý testovací název "A Really Long Bank Name
Here", 700px viewport): renderovaná šířka přesně 190px, delší text se
uvnitř pole scrolluje, nezabírá celou lištu. `npm test`: 617 passed /
0 failed / 0 crashed (73 probes).

### 2026-08-18zj — Zelené zvýraznění: jen poslední otevřená sekce, ne všechny najednou

Frank: "Když klikám v mobilním prohlížeči na sekce, můžu jich aktuálně
aktivovat více. Chci aby mohla být aktivní vždy jen jedna." Navazuje na
`### 2026-08-18zc` (touch highlight = `isSectionOpen(key)` OR hover) —
protože sekce se otevírají nezávisle (`_openSections` je `Set`, žádný
accordion), víc otevřených sekcí = víc zvýraznění zároveň.

Rozsah potvrzen s Frankem: **jen zvýraznění se omezuje na jednu, sekce
samy zůstávají nezávislé** (víc jich může být rozbalených najednou,
jako dřív) — NE plný accordion.

Fix: nová `_lastActiveFaderKey` (feel-fader.html ~2603) — nastaví se na
klíč sekce, kterou uživatel právě OTEVŘEL; při zavření sekce, která
byla aktivní, se vynuluje (nepropadá se na jinou pořád otevřenou
sekci). `syncFaderLink(key)` teď navíc podmiňuje `isSectionOpen(key)`
rovností s `_lastActiveFaderKey` — mouse hover (`_hoveredFaderKey`)
zůstává nezávislý, funguje jako dřív (OR).

Vědomě nedotčeno: `_openSections.add(section)` na chybovém skoku
(~4470) — ten už má svůj vlastní odlišný vizuál (`.validation-target`
flash), nekonfliktuje s touto změnou.

Ověřeno (Puppeteer, přímá manipulace `_openSections`/`toggleSection`):
otevření fader1 → zvýrazní fader1; otevření roller BEZ zavření fader1 →
zvýrazní se roller, fader1 přestane (i když zůstává rozbalený); zavření
roller → zvýraznění zmizí úplně, NEPADÁ zpět na fader1. `npm test`:
617 passed / 0 failed / 0 crashed (73 probes).

### 2026-08-18zi — Horní lišta: rozmazání spodní hrany vráceno zpět

Frank: "Horní lišta - oddělat to rozmazání spodní hrany, vrátit jak
bylo předtím." Přímá reverze `### 2026-08-18x` (dnešní dřívější fix,
stejná session) — `mask-image`/`-webkit-mask-image` na `header{}`
(feel-fader.html ~202-208) smazány, zbytek pravidla beze změny. Vědomý
kompromis (Frank potvrzen): Send tlačítko při scrollu pod lištu zase
mizí ostrou hranou, ne plynule (viz `2026-08-17` originální nález).

`npm test`: 617 passed / 0 failed / 0 crashed (73 probes) na čistém
re-runu — mezi-běh ukázal 2 už dřív zdokumentované flaky položky
(`bank-live-dot-probe.mjs`, `send-dock-gap-symmetry-probe.mjs`), žádná
nová regrese.

### 2026-08-18zh — Welcome screen: blur zrušen (i pro returning-user)

Frank: "Na welcome screenu zrušit blur." `#welcome-screen::before`
(feel-fader.html ~1804-1809, `backdrop-filter:blur(24px) saturate(150%)`)
— jediné místo blur na welcome obrazovce (`.bank-card`'s vlastní blur na
~1800 je nesouvisející, jiná komponenta). Onboarding varianta blur už
neměla; tohle bylo specificky pro returning-user (ne-onboarding) cestu.

Frank potvrdil: bez blur má být pozadí PLNĚ NEPRŮHLEDNÉ (stejně jako
onboarding varianta), ne poloprůhledný gradient bez blur. Fix:
`background:linear-gradient(145deg,var(--glass-dialog),var(--glass-card))`
→ `background:var(--bg)`, `backdrop-filter` řádek smazán.

**Test aktualizován, ne jen opraven:** `welcome-blur-overlay-probe.mjs`
z 2026-07-21 designu explicitně ověřoval "returning-user welcome keeps
the original soft blur" — teď obrácené tvrzení (`backdropFilter ===
'none'`), komentář v hlavičce souboru aktualizován. `npm test`: 617
passed / 0 failed / 0 crashed (73 probes) na čistém re-runu.

### 2026-08-18zg — Light/dark přepnutí: header/HUD blur artefakt odstraněn

Frank: "po změně lišta horní se překresluje, blur se zapne se zpožděním
cca sekundu. Lišta je chvíli transparentní a až pak se zapne blur. Není
to seamless."

**Root cause:** `applyTheme()` přepíná motiv přes `document.
startViewTransition(commit)` — bere DVA celostránkové snímky
(`::view-transition-old/new(root)`, feel-fader.html ~515-519) a mezi
nimi crossfade. `header`/`.live-hud` mají `backdrop-filter`, jehož
sytost/hodnota se mezi motivy vůbec nemění (jen barva podkladového
skla) — problém byl čistě v tom, že known browser quirk: rasterizace
"nového" snímku pro crossfade může proběhnout dřív, než backdrop-filter
stihne dokompozitovat proti podkladu, takže zachycený snímek headeru
chvíli vypadá bez blur.

Fix: `header,.live-hud{view-transition-name:none}` — vyjmuty z
crossfade snímkování úplně; barva jejich skla teď přepne OKAMŽITĚ
(žádný fade), zatímco zbytek stránky dál plynule prolíná přes
`theme-frame-in` animaci.

Ověřeno vizuálně: zachyceny sekvence snímků headeru po 25ms (0-225ms po
kliknutí na přepínač) před a po fixu, porovnány vedle sebe v
brainstorming companion prohlížeči — Frank potvrdil, že fix vypadá
dobře. `npm test`: 617 passed / 0 failed / 0 crashed (73 probes).

TODO.md **Otevřené je teď prázdné** — všech 18 položek z této session
(17 z `docs/TODO.md` + tahle, přidaná a dokončená ve stejné konverzaci)
vyřešeno.

### 2026-08-18zf — Onboarding Next fade / Connect glow: ověřeno už synchronizované, beze změny

Frank: "v posledním kroku tlačítko next zmizí a já bych chtěl, aby se
přesně jak tlačítko mizí, zobrazil glow kolem tlačítka connect & load."
17n už sjednotilo RYCHLOST obou (`--dur-glow`/`--ease-hero`); otevřené
zůstávalo jen to, jestli oba START ve stejný okamžik — nekontrolováno.

**Analýza kódu:** `applyBeat()` (feel-fader.html, `onbBeatGo()`) mění
`nextEl.classList.toggle('is-final',...)` a
`controller.dataset.onbFeature = beat.feature` v sousedních řádcích
STEJNÉHO synchronního volání — žádný `setTimeout`/`await` mezi nimi.
Obě CSS tranzice (`.onb-next.is-final` opacity, `[data-onb-feature=
"configure"] #send-btn` box-shadow) mají `transition:...var(--dur-glow)
var(--ease-hero)...` bez `transition-delay`.

**Empirické ověření** (Puppeteer, jemné vzorkování `getComputedStyle`
po 2ms): první pokus ukázal ~35-40ms rozdíl, ale metodika měla chybu —
po "instant" skoku na předposlední beat čekala jen 50ms, což nestačilo
na ustálení PŘEDCHOZÍ box-shadow tranzice (460ms) → naměřený "baseline"
nebyl ustálený stav. Po opravě (počkat 800ms na plné usazení před
měřením) klesl rozdíl na konzistentních **~15-25ms** napříč 4 běhy —
necelý jeden snímek při 60fps (16.7ms), hluboko pod hranicí lidského
vnímání současnosti (~100ms).

Uzavřeno jako **ověřeno, beze změny** — kód i měření souhlasně ukazují,
že oba efekty startují prakticky současně; zbylý rozdíl je artefakt
měření (`box-shadow` s `color-mix()` je nákladnější na přepočet než
prosté `opacity`), ne vizuálně postřehnutelná asynchronost.

### 2026-08-18ze — Bank karta: action tlačítka zpátky na řádek s ikonou, zmenšena na 28px

Frank: "na kartě s bankami bych chtěl mít buttony... na stejné výškové
úrovni jako Bank ikonu, a tlačítka chci subtilnější, zmenšit." Dvě
samostatné úpravy:

1. **Zpátky na jeden řádek.** `@media(max-width:540px)
   {.bank-block-name-top{flex-wrap:wrap}}` (feel-fader.html) shazovalo
   `.bank-actions` pod ikonu/jméno na vlastním řádku. Zjištěno, že to
   nebyla technická nutnost — `.bank-name-input{flex:1;min-width:0}` se
   umí zúžit, aby akce vedle sebe měly místo. `flex-wrap:wrap` +
   doprovodné `.bank-actions{width:100%;padding-left:31px}` odstraněny.
2. **Menší tlačítka.** `.btn-remove-bank`/`.bank-action-btn` mají
   ZÁKLADNÍ (myš) velikost už 28px — jen `@media(pointer:coarse)`
   override je na dotyku zvětšoval na 36px (zmenšeno z 44px 2026-08-16).
   Frank vybral z nabídnutých 28px/32px → **28px** (shodně s Bank
   ikonou) — touch override snížen z 36px na 28px, takže teď je
   identický se základní velikostí v obou kontextech.

Ověřeno screenshotem (iPhone 13 emulace): ‹ › ⧉ ✕ na stejném řádku s
ikonou i jménem banky, vizuálně sladěné, subtilnější. `npm test`: 617
passed / 0 failed / 0 crashed (73 probes).

### 2026-08-18zd — Dark/light tlačítko konečně kulaté, bank chipy na stejnou výšku

Frank: "chci aby tlačítko na horní liště pro přepínání mezi light/dark
bylo kulaté. A chipy u bank... aby měly stejnou výšku jako bude průměr
toho light/dark tlačítka." `.dark-toggle` mělo `border-radius:999px`
(`.ui-pill`) a `width:44px;height:44px` uvnitř `@media(pointer:coarse)`
— na papíře mělo být kruh, ale nebylo.

**Root cause (skutečná cascade chyba, ne padding/ikona jak TODO
tušilo):** bezpodmínečné `.dark-toggle{width:30px;height:30px}` (báze,
~1039) se v souboru nachází AŽ PO `@media(pointer:coarse){.dark-toggle
{width:44px;height:44px}}` (~967). Při stejné specificitě vyhrává
POZDĚJŠÍ pravidlo — takže na dotyku `width` spadlo zpátky na 30px,
zatímco `height` zůstalo 44px jen díky samostatnému `min-height:44px`
(~968), který u `width` obdobu neměl. Výsledek: 30×44px obdélník.

Fix: `.dark-toggle` dostalo vlastní `min-width:44px` (floor, který ta
pozdější `width:30px` cascade nepřebije) — bez zásahu do sdíleného
`min-height` pravidla (to by zasáhlo i `.bank-block-tab`/`.send-btn`
šířkou, nechtěné). Bank chipy (`.bank-block-tab`) dostaly `@media
(pointer:fine){min-height:30px}` — vědomě SCOPED, ne bezpodmínečné:
bezpodmínečné pravidlo by (stejnou cestou) přebilo existující touch
`min-height:44px` a stáhlo dotykovou výšku zpátky na 30px — přesně
stejná třída chyby, kterou jsem právě opravoval, teď ve vlastním kódu.

**Vedlejší nález, skutečná regrese odhalená testy:** opravený (teď
skutečně 44px) toggle zabírá o 14px víc místa v headeru → na
nejužším podporovaném telefonu (393px, `iphone-messenger` profil) se
`#bank-tabs` řádek zúžil natolik, že s uměle dlouhým testovacím jménem
banky ("Bang go b") přestaly všechny 3 taby doslova "vejít" bez
scrollu. `.bank-block-tabs{overflow-x:auto}` je ale přesně na tohle už
dávno navržené — scroll v tomhle případě není bug. `mobile-ux-probe.mjs`
ale ověřoval "každý tab se vejde do kontejneru bez scrollu", což
fungovalo jen náhodou díky předtím vadnému (užšímu) toggle. Přepsáno na
smysluplnější invariant: řádek jako celek nesmí vizuálně kolidovat s
toggle tlačítkem (`bankTabContainer.right <= darkToggle.left`) — scroll
uvnitř řádku je v pořádku, kolize s tlačítkem vedle by nebyla.

Ověřeno automatizovaně (base i touch kontext): toggle 30×30 (myš) /
44×44 (dotyk) v obou případech čtverec; bank chipy 30px (myš) / 44px
(dotyk), shodně s toggle. `npm test`: 617 passed / 0 failed / 0 crashed
(73 probes) na čistém re-runu.

### 2026-08-18zc — Sekce zvýrazňují odpovídající zónu na controlleru i bez hoveru (dotyk)

Frank: "Chci stejný efekt jako v onboarding aplikaci" (BUTTON sekce
nezvýrazní tlačítko na mobilu). Ověřeno a rozsah potvrzen s Frankem:
mezera se týkala VŠECH 4 sekcí (fader1/fader2/roller/macro), ne jen
BUTTON — `hoverFaderLink()` byla navázaná čistě na
`onmouseenter`/`onmouseleave`, které se na dotyku nikdy nespustí.

Fix (feel-fader.html ~5437-5455): highlight teď řízen DVĚMA nezávislými
zdroji sloučenými přes OR, ne přepisováním — `_hoveredFaderKey` (živý
mouse hover, jako dřív) A `isSectionOpen(key)` (sekce rozbalená —
funguje bez hoveru, tohle nese touch případ). Nová `syncFaderLink(key)`
je jediný zdroj pravdy, volaná jak z `hoverFaderLink()` (mouse), tak
nově v `renderPanels()` pro všechny 4 klíče po každém renderu (`~3177`)
— nutné, protože `renderPanels()` staví `.bank-section` HTML od nuly
přes `innerHTML`, což by jinak smazalo dřív nastavenou třídu.

Vědomě NEudělané: `.fader-linked` třída na SAMOTNÉM `.bank-section`
panelu se aplikuje stejným mechanismem jako dřív u hoveru (bez
speciální výjimky) — konzistentní s existujícím vizuálem, žádná nová
komponenta.

Ověřeno (`scratch/tmp-fader-link-touch-check.mjs`): otevření každé ze 4
sekcí BEZ jakékoliv myší akce zvýrazní odpovídající controller zónu;
zavření všech čtyř highlight vyčistí; simultánní mouse hover (fader1) +
open (roller) jsou zvýrazněné zároveň a jsou na sobě nezávislé — odchod
myší z fader1 vyčistí JEN fader1, roller (pořád open) zůstává
zvýrazněný. `npm test`: 617 passed / 0 failed / 0 crashed (73 probes).

### 2026-08-18zb — "Unsaved changes" popisek už nekoliduje s Live HUD

Frank: "když na mobilu skryju zobrazení controlleru... vlevo od něj se
zobrazí popis unsaved changes. To se pak překrývá s LIVE status barem."
Screenshot potvrdil skutečně ošklivou kolizi — text popisku vykreslený
přes "L R" hodnoty HUD karty.

**Přesná příčina, ne jen obecná "kolize":** `updateContextualLiveStrip()`
(feel-fader.html ~5645) má už z 2026-07-27 vědomé rozhodnutí kotvit HUD
jen k `header`u, ne k celému `.top-sticky` — komentář výslovně
zdůvodňuje, že dokované Send tlačítko je VYCENTROVANÉ, zatímco HUD sedí
zcela vlevo, takže nekolidují. Ta úvaha byla správná PRO TLAČÍTKO, ale
nepočítala s `.send-change-note` ("unsaved changes"), který se na rozdíl
od tlačítka rozpíná DOLEVA od centrovaného tlačítka a na úzkém mobilním
viewportu dosáhne až do zóny HUD.

Fix: `updateContextualLiveStrip()` teď čte, jestli je `#send-change-note`
reálně `.is-visible` (a controller skrytý) — pokud ano, kotví HUD ke
spodku CELÉHO `#send-sticky-row` (dokovaný řádek) místo jen k headeru;
pokud ne, chová se přesně jako předtím (žádná změna pro běžný,
ne-dirty případ — cíleně zachováno, ne paušální posun HUD dolů pokaždé,
když je controller skrytý).

Ověřeno screenshoty: s nezachráněnou změnou HUD karta čistě POD
dokovaným řádkem, žádný překryv. Bez nezachráněné změny HUD `top`
zůstává `52px` (header 40 + 12), identické s chováním před fixem.
`npm test`: 617 passed / 0 failed / 0 crashed (73 probes) na čistém
re-runu — mezi-běhy ukázaly `help-deep-links-probe.mjs`/`bank-live-dot-
probe.mjs`/`send-dock-gap-symmetry-probe.mjs` selhání, všechny 3 už dřív
v této session zdokumentované jako flaky pod zátěží (potvrzeno: 21
Chrome + 9 Node procesů nakumulovaných za celou session na pozadí;
izolovaný re-run všech 3 prošel čistě).

### 2026-08-18za — Help & Guide: smazána sekce "Service: DEV / PROD mode"

Frank: "to slouží pro mě, ale ne pro uživatele." Smazán `#help-dev`
subhead + navazující `<p>` (firmware boot-mode postup, BOOTSEL recovery
— feel-fader.html ~2357-2358). Ověřeno, že na `#help-dev` nikde jinde
neexistoval odkaz (jediný výskyt v souboru).

`help-trim-probe.mjs` explicitně ověřovalo, že `#help-dev` EXISTUJE
(pozůstatek dřívějšího "trim" úkolu, kdy šlo o jinou sekci) — přepsáno
na opačné tvrzení (`#help-dev REMOVED`).

`npm test`: 617 passed / 0 failed / 0 crashed (73 probes) na čistém
re-runu — jeden mezi-běh ukázal `help-deep-links-probe.mjs` selhání
(`inViewport:false`), potvrzeno jako nesouvisející flaky (3× izolovaný
re-run: 2× PASS, 1× FAIL, nedeterministické — skutečná regrese by
selhávala pokaždé).

### 2026-08-18z — Live HUD tech řádek ("Ch1·CC11"): ukotveno na tečce, žádný posun při změně počtu číslic

Frank: "chci aby to bylo umístěno tou tečkou na střed toho indikátoru.
Teď se to posouvá, když změním např. z CC9 na CC10." Příčina: `.live-
hud-item{justify-items:center}` centrovalo celý string `Ch1·CC9` jako
jeden blok — při CC9→CC10 se změnila DÉLKA celého stringu, takže se
posunula i nezměněná levá "Ch1" část.

Fix (feel-fader.html): `#live-f1-tech`/`#live-f2-tech` (~2184, 2189)
rozděleny na 3 vnořené spany (`.live-hud-tech-ch`/`.live-hud-tech-dot`/
`.live-hud-tech-val`), nová `.live-hud-tech-split{display:grid;
grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);justify-self:
stretch}` — dvě `minmax(0,1fr)` krajní kolony vždy dostanou přesně
poloviční podíl ze zbylého prostoru bez ohledu na obsah (bare `1fr`, bez
`minmax`, první pokus, ještě respektuje vlastní min-content jako podlahu
— naměřen zbytkový posun ~2px, opraveno přechodem na `minmax(0,1fr)`).
JS (`renderLiveStrip()`, ~5694-5695): `setTxt` teď píše zvlášť do
`-ch`/`-val` sub-elementů místo jednoho kombinovaného stringu. Roller
tech řádek (`#live-roller-tech`) vědomě NEDOTČEN — má vlastní odlišné
zarovnání (`justify-self:start`, celá šířka řádku) a 3 různé tvary
obsahu podle nav módu, nebylo předmětem požadavku.

Odhalena a opravena 1 vlastní regrese při ladění: prvotní verze měla
`column-gap:1px` mezi sloupci — v kompaktní 96×96 mobilní variantě HUD
to způsobilo 2px přetečení (`scrollWidth 36 > clientWidth 34`),
odhaleno `mobile-ux-probe.mjs` (`techUnclipped` check) — gap odstraněn,
tečka sama má dost vizuálního odstupu.

Ověřeno (`scratch/tmp-live-hud-tech-dot-check.mjs`): tečka i "Ch1" na
IDENTICKÉ x-pozici (`dotX`/`chLeft`) při CC9/CC10/CC100 — 0px rozdíl.
`npm test`: 617 passed / 0 failed / 0 crashed (73 probes).

### 2026-08-18y — "Search setups" input: iOS zoom-on-focus vypnut, opticky beze změny

Frank: "otevře se dropdown menu a celé se mi to přiblíží... nemělo by se
to přibližovat." Potvrzená příčina: `.library-quick-input` mělo
`font-size:12px` — iOS Safari/Chrome automaticky zoomuje viewport při
focusu na `<input>` pod 16px. Frank zvolil variantu **B**: reálně zvětšit
na 16px (vypne zoom), ale opticky zůstat na původní ~12px velikosti přes
`transform:scale()`, ne jen viditelně zvětšit text.

Implementace (feel-fader.html ~1997-2005, ~3109-3114): nový wrapper
`<span class="library-quick-input-scale">` kolem `<input>` — `overflow:
hidden` na wrapperu ořízne inputův PŘED-transformem větší layout box
zpátky na původní vizuální stopu (29px výška, změřeno). Input dostal
`font:16px`, `width:133.333%`, `height:38.667px`, proporčně zvětšený
padding (`8px 13.333px` — 6/.75, 10/.75), `transform:scale(.75)
transform-origin:top left` — 16×.75=12 (zpět na původní vizuální
velikost textu).

**Vědomě NE `overflow:hidden` na `.quick-setup-picker`** (rodič, hostí i
dropdown menu `.quick-setup-menu{position:absolute}`) — to by useklo i
menu. Nový wrapper je scoped jen kolem inputu samotného, picker i menu
beze změny. Ověřeno, že `openQuickSetupMenu()`/pozicování menu vůbec
nečte input's `getBoundingClientRect()` (menu je pozicované vůči
`.quick-setup-picker`, ne vůči inputu) — žádná závislost na přesné
geometrii inputu, změna je bezpečná.

Ověřeno automatizovaně: computed `font-size` inputu teď `16px` (dřív
`12px`), renderovaná (post-transform) šířka `242.83px` — identická s
před-změnovou hodnotou `242.84px` (na sub-pixel přesně stejná vizuální
velikost). Screenshot potvrzuje vizuálně nerozeznatelné od originálu,
dropdown menu se po focusu stále otevírá správně. `npm test`: 617
passed / 0 failed / 0 crashed (73 probes) — žádná regrese.

### 2026-08-18x — Header: měkký fade na spodní hraně, Send tlačítko už nemizí naráz

Frank: "když scrolluju dolů, tlačítko zajede za tu lištu a najednou pak
zmizí, nedojede to plynule." Potvrzeno: `header` (feel-fader.html
~196-202, uvnitř `.top-sticky`, `position:sticky;z-index:50`) neměl na
spodní hraně žádnou masku — obsah scrollující zdola (Send tlačítko, v
normálním flow, nedokované) se pod lištou schovává čistě CSS stackingem,
ostrá hrana.

Fix: `mask-image`/`-webkit-mask-image:linear-gradient(to bottom,#000
calc(100% - 14px),transparent)` na `header` — stejná technika jako
existující `.bank-block-tabs.tabs-fade-r`. 14px zvoleno vůči změřené
výšce headeru (40px, `getBoundingClientRect()`) — dost na viditelné
zjemnění hrany, dost málo na to, aby se nezačal viditelně "rozpouštět"
i vlastní obsah headeru (wordmark, bank taby) — ověřeno screenshotem
zblízka, žádné viditelné useknutí textu.

Ověřeno screenshoty (430×800, scroll 40px — Send tlačítko těsně pod
hranou headeru): žádný artefakt na textu headeru, přechod na hraně
plynulý. `npm test`: 617 passed / 0 failed / 0 crashed (73 probes) —
žádná regrese.

### 2026-08-18w — Skrytí controlleru → scroll → zobrazit: stale scroll-cache způsobovala "špatná pozice, pak skok"

Frank 2026-08-17: "když skryju controller, kousek scrolluju a controller
opět aktivuju, objeví se v jiné pozici a cca za 1s skočí zpět do správné
pozice." TODO už mělo přesné podezření (`applySendAnchorDock`/
`trackSendAnchorDock` cachují pozice) — dnes systematicky ověřeno
(`superpowers:systematic-debugging`), root cause potvrzen a opraven.

**Root cause:** `_sendAnchorPillHomeTop`/`_sendAnchorPillDockedTop`
(feel-fader.html ~5915-5916) se ukládaly jako syrová
`getBoundingClientRect().top` (viewport-relativní) hodnota při HIDE. Mezi
HIDE a SHOW scroll stránku posune, ale hodnota se nikdy nepřepočítala —
`trackSendAnchorDock()`'s glide (~6144-6146) ji použil jako cíl animace
tak, jak byla PŘED scrollem, takže tlačítko nejdřív "nahodilo" starou
pozici a teprve po `settle()` (reparentování zpět do normálního flow,
~900-1400ms) přistálo na skutečné, aktuální pozici — přesně nahlášený
vzorec.

**Ověření mechanismu bylo samo o sobě zajímavé:** první dva pokusy o
reprodukci (`tmp-repro-send-anchor-scroll-stale{,-v2}.mjs`) dávaly
nesedící čísla — ukázalo se, že Chromova **CSS scroll anchoring** (ve
výchozím stavu zapnutá) sama potichu posouvala `window.scrollY`, kdykoliv
se box při instantním show/hide přerostl nad viewportem (živě naměřeno:
scrollY 180→92 jen z toho, že se box vrátil na plnou výšku) — matoucí
proměnná nesouvisející s hledanou chybou. `v3` skript ji vypnul
(`overflow-anchor:none` na `html`/`body`) a porovnal cache-hodnotu (s
korekcí o `scrollY`) proti nezávisle změřené ground-truth pozici (druhá,
nekontaminovaná session, real instant-show code path) — shoda na pixel
(`diff=0`) POTVRDILA formuli fixu, ale první verze testu omylem
aplikovala korekci JEN v test skriptu, ne v ověřovaném app kódu, takže
neprokázala nic (prošla i na nezměněném před-fix kódu — odhaleno
`git stash` bisekcí, výsledek identický 355.1875/355.1875 na obou
verzích). **Skutečné, rozlišující ověření** nakonec `tmp-repro-send-
anchor-scroll-stale.mjs`: porovnání pozice v polovině animace (~120ms) se
skutečnou usazenou pozicí — před fixem 542 vs. 355 (**187px rozjezd**,
skoro přesně scroll delta 180px — to je ten hlášený skok), po fixu 378
vs. 355 (23px, normální průběžný stav plynulé animace, ne bug).

**Fix:** `_sendAnchorPillHomeTop`/`_sendAnchorPillDockedTop` ukládány
dokument-relativně (`+ window.scrollY` při zápisu, ~5955/5963),
`trackSendAnchorDock()` při čtení odečítá AKTUÁLNÍ `window.scrollY`
(~6144-6146) — hodnota tak přežije libovolný scroll mezi HIDE a SHOW.
`_sendAnchorPillOffsetHome`/`Docked` (delta dvou rects ze STEJNÉHO
okamžiku) scroll-korekci nepotřebovaly, scroll se v odečtu ruší sám —
beze změny.

`npm test`: 617 passed / 0 failed / 0 crashed (73 probes) — žádná
regrese.

### 2026-08-18v — Live HUD: drag zapnutý i na dotyku (mobil)

Frank: "je to dragable jen na PC, ne když si to zobrazím v telefonu" —
reverze dřívějšího záměrného rozhodnutí (`liveHudManipulable()`,
feel-fader.html ~5427, gatovalo drag+position-memory+scale-reading jen na
`any-pointer:fine`, komentář "enlarge/drag need a mouse... (Frank
2026-07-27)"). Rozsah potvrzen s Frankem: jen drag, NE zvětšovací
tlačítko — to má vlastní, nezávislý CSS gate
(`@media not all and (any-pointer:fine){.live-hud-size-btn{display:none}}`,
~236) a zůstává na dotyku skryté beze změny.

Fix: media query v `liveHudManipulable()` rozšířena z `(any-pointer:fine)`
na `(any-pointer:fine),(any-pointer:coarse)` — jediná změna, žádná úprava
samotného pointer-event drag mechanismu (~5635+) byla potřeba, ten už
touch pointery zvládal (`event.button` čte 0 i pro touch pointerdown per
spec).

Ověřeno (`scratch/tmp-live-hud-touch-drag-check.mjs`, Puppeteer
`emulate(KnownDevices['iPhone 13'])` — skutečná touch emulace, ne jen
media-feature override, protože `emulateMediaFeatures` nepodporuje
`pointer`/`any-pointer` přímo): na emulovaném touch-only zařízení
(`any-pointer:coarse=true`, `:fine=false`) je `liveHudManipulable()===true`
(dřív `false`), zvětšovací tlačítko zůstává `display:none`. `npm test`:
617 passed / 0 failed / 0 crashed (73 probes) — žádná regrese.

### 2026-08-18u — "Enable Keyboard (HID)?" dialog — vizuální audit, beze změny

Frank (screenshot): prověřit konzistenci s ostatními notifikacemi. Ověřeno
screenshoty vedle sebe (HID confirm, "Remove bank" confirm, info toast):

- **Barva tlačítka je v pořádku.** "Enable HID" = `tone:'primary'` →
  `--red` (#e45745) — STEJNÁ červená jako `Send to device`/`Save setup`/
  `Apply setup` (appka má jedinou "hlavní akce" barvu napříč celou UI,
  potvrzeno vedle sebe na screenshotu). "Remove bank" dialog používá
  `tone:'danger'` → `--danger` (#b42318, viditelně tmavší/sytější) —
  dvě odlišitelné barvy, HID dialog správně sahá po té nedestruktivní.
- **Jediný reálný rozdíl:** text zprávy je delší/technoštější než u
  ostatních dialogů (26 slov, zmiňuje konkrétní macOS chování — Keyboard
  Setup Assistant) vs. typicky 8-16 slov u ostatních ("This removes the
  bank from the local configuration..."). Posouzeno jako odůvodněné —
  jde skutečně o komplexnější informaci (OS-level vedlejší efekt), ne o
  nekonzistentní styl psaní.

Frank potvrdil, že je to takhle v pořádku — žádná změna kódu. Zaznamenáno
jako uzavřený audit, ne jako "nenalezeno/přeskočeno".

### 2026-08-18t — Live bank na zařízení: pulzující zelená tečka místo tiché ikonky

Frank: "zatím je tam ta malá ikonka na liště, ale chtěl bych tam přidat
něco víc." Vizuální brainstorming (4 varianty v prohlížeči — badge tečka,
celý tab glow+tint, jen zvětšená/zelená ikonka, levý okrajový pruh) →
Frank vybral **A (pulzující tečka)**, s klíčovou opravou: appka má DVA
nezávislé stavy na bank tabu — `.active` (banka právě editovaná v
appce) a `.is-live` (banka, kterou hraje hardware), nemusí to být tatáž
banka. První kolo mockupů oba stavy omylem spojilo do jedné pilulky;
Frank na to upozornil, druhé kolo mockupů je ukázalo na dvou různých
tabech vedle sebe (needitovaná live banka + editovaná ne-live banka) —
potvrdil, že tečka takhle funguje čitelně bez kolize.

Po výběru A ještě Frank všiml: "když bude tečka, není už potřeba ta
ikona faderů" — celá stará SVG ikonka (`.bank-tab-device`) šla pryč, ne
jen zbarvit.

Implementace (feel-fader.html):
- JS marker span (`liveMarker` v `renderBankTabs()` ~2995,
  `setActiveTab()` ~3014-3018) — beze změny STRUKTURY (pořád JS-vkládaný
  `<span>` keyed na `isLive`), jen obsah/třída: žádné vnořené `<svg>`,
  třída `bank-tab-device` → `bank-tab-live-dot`. `title="Active on
  device"` a `aria-hidden="true"` zůstaly, `aria-label` na tlačítku
  (" · active on device") beze změny — přístupnost nedotčena.
- CSS: `.bank-tab-device`/`.bank-tab-device svg` smazány, nahrazeny
  `.bank-tab-live-dot` (~1949) — `position:absolute` v pravém horním
  rohu tabu (`.bank-block-tab` už mělo `position:relative`), `background:
  var(--green)`, pulz přes `@keyframes bank-live-pulse` (opacity 1↔.4,
  1.8s), `@media(prefers-reduced-motion:reduce)` vypíná animaci (existující
  app-wide konvence).
- **Vědomě REAL `<span>`, ne `::before`/`::after` pseudo-element**: tab
  už má `.drag-before::before`/`.drag-after::after` pro drag-reorder
  indikátor (~1927-1931) — kdyby tečka byla taky pseudo-element na
  stejném selektoru, kolidovala by s ním při přetahování zrovna té live
  banky. Reálný child span tohle obchází úplně.
- **Prstenec kolem tečky NENÍ `var(--bg)`** (plná barva) — bank tab strip
  sedí přímo v headeru (`#bank-tabs` uvnitř `<header>`, ne na kartě),
  takže tvrdá barva na průsvitném glass pozadí by nesedla. Header už má
  přesně tenhle případ vyřešený u `.h-status-dot.on` (connection status
  tečka, stejný řádek) — měkký `rgba(52,199,89,...)` glow prstenec místo
  plné barvy. Sjednoceno na stejný vzor místo vymýšlení nového.

**Regresní test přepsán, ne jen opraven:** `bank-glyph-neutral-probe.mjs`
existoval specificky k ověření, že stará ikonka NENÍ zelená (dřívější
záměrné rozhodnutí, důvod nedohledán v této TODO historii) — tohle
session's rozhodnutí ho vědomě obrací. Přejmenováno na
`bank-live-dot-probe.mjs` (+ zápis v `run-all-probes.mjs`), přepsáno na
nové invarianty: tečka existuje/je zelená/pulzuje/stará ikonka je pryč,
PLUS explicitní test dvoustavové nezávislosti (live banka bez `.active`
pořád má tečku; `.active` banka bez live nemá tečku).

**Vedlejší nález při ladění (systematic-debugging, ne jen re-run):**
`send-dock-gap-symmetry-probe.mjs` padal deterministicky (32px/30px) i
v izolaci — vypadalo to jako regrese z dnešních změn. Bisekce přes `git
stash` (feel-fader.html vrácen na čistý HEAD, test spuštěn znovu)
ukázala IDENTICKÉ 32/30 selhání i BEZ jediné dnešní změny → potvrzeno
pre-existing, prostředím/časováním podmíněné (stejná třída jevu jako
dřívější zdokumentované "jen pod plnou zátěží" flaky testy, viz
2026-08-17d/17j), ne nic způsobeného touto session. Podobně
`bank-live-dot-probe.mjs`'s "pulse animation" assert jednou selhal jen
uvnitř plné 73-probe sady, čistě 9/9 v izolaci — stejná třída.

`npm test`: 617 passed / 0 failed / 0 crashed (73 probes) na čistém
re-runu — obě výše zmíněné flaky položky ten den prošly bez zásahu.

### 2026-08-18s — Sdílený `--control-glass-bg` token: z "gradient sheen" na skutečné frosted sklo

Frank: "tyto tlačítka vypadají strašně cheap s tím gradientem" → "celý
sdílený styl se mi nezdá, poladíme ho globálně" (rozsah — token, ne jen
`.uacc-tag` — potvrzen dřív, 2026-08-18). Brainstorming potvrdil obojí
podezření: silný diagonální lesk (starší "glossy button" look) A chybějící
skutečné rozmazání pod prvkem (na rozdíl od headeru/HUD, které
`backdrop-filter` mají). 4 vizuální varianty porovnány v prohlížeči
(companion) — Frank vybral **C: skoro plochá výplň + reálný
`backdrop-filter`**, stejný princip jako `--chrome-glass-bg`/
`--chrome-glass-filter`, jen jemnější (menší blur, míň sytosti — tohle
jsou malé kontrolky, ne celoplošná lišta).

Změny (feel-fader.html):
- `--control-glass-bg` (~61 light, ~144 dark): `linear-gradient(145deg,...)`
  → plochá `rgba(255,255,255,.38)` / `rgba(30,30,35,.42)`.
- Nový `--control-glass-filter:blur(10px) saturate(160%)` — jedna hodnota
  sdílená oběma motivy (stejný vzor jako `--chrome-glass-filter`, který
  taky není v `html.dark` přepsaný).
- `--control-glass-border`/`--control-glass-shadow`/`-hover` doladěny na
  jemnější hodnoty odpovídající plošší výplni (byly kalibrované na starý
  gradient, se starým vzhledem by teď plochá výplň + tak silný border/stín
  vypadala nepatřičně kontrastně).
- `backdrop-filter`/`-webkit-backdrop-filter:var(--control-glass-filter)`
  přidán ke všem 15 základním selektorům, které `--control-glass-bg`
  používají (`.ui-glass`, `.send-btn.idle/.blocked`, `.roller-mode-row::before`
  ×2, `.stepper input` ×2, `.ks-bound-stepper`, `.ks-convention-stepper`,
  `.uacc-tag`, `.hid-switch-track`, `.controller-switch` checked,
  `.btn-ghost`, `.toast-icon`, `.tx:hover`, `.toast-action`,
  `.bank-block-tab.active`) — `:hover`-only varianty, které jen mění
  `background`/`box-shadow` na už-blurovaném základu, nepřidávaly nic
  nového (blur zůstává z base pravidla).

Ověřeno (`scratch/tmp-control-glass-blur-check.mjs`, oba motivy):
`.stepper input` a `.uacc-tag` mají `background-image:none` (žádný
gradient) a computed `backdrop-filter:blur(10px) saturate(1.6)`. `npm
test`: 611 passed / 0 failed / 0 crashed (73 probes) — žádná regrese.

Hodnoty hover-stínu (`--control-glass-shadow-hover`) jsou odhad
proporčně odvozený ze staré hover-delty, ne z vizuálního brainstormingu
(ten hover neukazoval) — čeká na Frankovo oko na reálném zařízení.

### 2026-08-18r — HID toggle track: plná zelená místo vybledlé, sjednoceno se Sent tlačítkem

Frank (screenshot): "chci mít aplikaci konzistentní" — HID toggle a Sent
tlačítko UŽ odkazovaly na stejnou `--green:#34c759` proměnnou, ale
vizuálně nesedělo, protože track (`.hid-switch input:checked +
.hid-switch-track`, feel-fader.html ~770) míchal `color-mix(in
srgb,var(--green) 44%,transparent)` přes vlastní glass pozadí místo plné
barvy jako `.send-btn.sent{background:var(--green)}`.

Fix: `background` na checked tracku → plné `var(--green)` (žádný mix).
`border-color`/`box-shadow` glow zůstaly na měkkém mixu (72 %/25 %) — to
odpovídá stejné konvenci, jakou má i Sent tlačítko u vlastního glow
(`box-shadow:...rgba(52,199,89,.4)`, taky ne 100%). `.controller-switch`
(sdílí `.hid-switch-track` třídu pro jiný přepínač, ~780) zůstal beze
změny — má vlastní override na neutrální `--control-glass-bg`, scoped na
jiný rodičovský selektor, nedotčen.

Ověřeno (`scratch/tmp-hid-switch-green-check.mjs`): computed
`background-color` na checked `.hid-switch-track` (mimo `.controller-switch`)
je `rgb(52,199,89)` — přesně shodné s `--green`. (Poznámka k testování:
programové `input.checked=true` + `dispatchEvent('change')` by spustilo
reálný `onHidToggle()` a konfirmační dialog, který checked stav vrátí
zpět na false do potvrzení — test proto nastavuje jen IDL checkedness bez
change eventu, CSS `:checked` na to reaguje stejně.)

`npm test`: 611 passed / 0 failed / 0 crashed (73 probes) — žádná regrese.

### 2026-08-18q — Skrytí controlleru: smrštění teď rovnoměrné i vodorovně, ne jen zplošťující

Frank: "když skryju controller, smrští se to ve směru svislé osy. Chtěl bych,
aby se controller změnil rovnoměrně i ve vodorovném směru" — potvrzeno v
brainstormingu, že šlo o dojem "placnutí" shora dolů (výška jde přes
`grid-template-rows` k 0, šířka zůstávala skoro celou dobu plná), ne o
konkrétní nesoulad okrajů s něčím vedle.

Řešení zvoleno z už dřív zvažovaných dvou cest (viz starší poznámka v TODO):
přidat souběžnou horizontální komponentu vedle stávajícího mechanismu, NE
předělat celý kolaps na jednotný `scale()`. Důvod zamítnutí druhé cesty:
vertikální kolaps přes `grid-template-rows` je vstup pro JS měření pozic
(`applySendAnchorDock`/`trackSendAnchorDock`, Send tlačítko + Live HUD
anchor tracking) — přepnout by riskovalo rozbít tohle propojení, přidání
je bezpečnější.

Fix: `.stage-collapse.is-collapsed>.stage{transform:scale(.94)...}` →
`transform:scaleX(.85) scaleY(.94)...` (feel-fader.html ~317-324) — scaleY
zůstal beze změny (patří k existující anti-squish ochraně z 2026-07-23,
nezávisle na tomhle fixu), scaleX je nová, výraznější horizontální složka,
běží na stejné `var(--dur-stage)`/`var(--ease-out)` křivce jako rodičovský
`grid-template-rows` kolaps, takže obě osy dosednou ve stejný moment.
`transform-origin` zůstal na středu (default) — smršťování je tak
symetrické z obou stran.

Ověřeno (`scratch/tmp-stage-collapse-scalex-check.mjs`): computed transform
po dokončení přechodu je `matrix(0.85,0,0,0.94,...)` — scaleX skutečně
0.85, odlišné od scaleY (0.94), ne uniformní `scale()` jako dřív; expanded
stav beze změny (`none`). `npm test`: 611 passed / 0 failed / 0 crashed
(73 probes) — žádná regrese.

Přesná hodnota `.85` je vizuální odhad, ne měřená z fyzického zařízení —
čeká na Frankovo potvrzení "cítí se to rovnoměrně" na reálném telefonu,
případně doladit.

### 2026-08-18p — Custom kurzor ve tvaru fader capu implementován

Návaznost na 2026-08-18 (specifikace domluvena, čekalo na implementaci —
viz historie výše). Tvar a velikost doladěny přes vizuální brainstorming
companion (4 varianty siluety porovnány vedle sebe v prohlížeči, pak 3
velikosti přes reálné UI cíle): Frank vybral **variantu A — čistá kapsle**
podle proporcí skutečné fotky (`#thumb-l`), bez highlight pruhu nebo grip
rýh; velikost **20×32px** (poměr stran 5:8 shodný s fotkou).

Implementace: nová sdílená proměnná `--cursor-fader` (feel-fader.html ~81
`:root`, ~147 `html.dark`) — inline SVG data URI (`%23` misto `#` v barvě,
ne base64 — čitelnější diff), `fill` natvrdo zrcadlí aktuální `--t1` hex
(light `#1d1d1f` / dark `#f5f5f7`), protože data URI nemůže odkazovat na
CSS `var()`. Barva se tak přepíná úplně stejně jako zbytek theme systému —
čistě CSS cascade `:root` vs `html.dark`, žádná nová JS logika v
`applyTheme()` nebyla potřeba. Hotspot zvolen `10 4` (vrchní střed capu,
kde fyzicky sedí prst) — TODO počítal s doladěním při implementaci, zatím
ponecháno, čeká na Frankovo ověření na reálném zařízení.

Všech 32 výskytů `cursor:pointer` (CSS pravidla i jeden inline `style=`)
přepsáno na `cursor:var(--cursor-fader),pointer` (`replace_all`, ověřen
počet 32 před i po). Fallback na `pointer` pokrývá prohlížeče, které by
kurzor-URL z nějakého důvodu odmítly.

Ověřeno automatizovaně (`scratch/tmp-cursor-fader-check.mjs`, Puppeteer):
`getComputedStyle(...).cursor` v light i dark motivu resolvuje na `url(...)`
(ne prostý `"pointer"`), obsahuje správný `--t1` hex pro daný motiv, a mezi
motivy se liší (potvrzuje, že `html.dark` override skutečně vyhrává). Žádné
console/page erory při přepínání motivu.

`npm test`: 611 passed / 0 failed / 0 crashed (73 probes) — čistě, žádná
regrese.

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
