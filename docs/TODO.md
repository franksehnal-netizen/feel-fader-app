# Feel Fader Web App — TODO

Frankovy připomínky k dořešení. Hotové položky přesouvat do sekce **Hotovo** s datem.

> **Pozor na zdroj pravdy:** živý kód je inline `<style>` a `<script>` v
> [feel-fader.html](../feel-fader.html). Samostatné pracovní extrakty CSS/JS
> nevytvářet ani needitovat.

## Otevřené

- **Jedno pre-existing selhání v `mobile-ux-probe.mjs`, nesouvisí s onboarding-scroll fixem (2026-08-17b):**
  "Normal welcome contains only the brand and essential actions" — test čeká `'Feel Fader'` wordmark viditelný v compact (returning-user) welcome stavu, ale ten je od dřívějšího wordmark redesignu v tomto stavu záměrně `display:none` (viz CSS komentář u `.welcome-wordmark`, feel-fader.html:1163-1170). Test je zastaralý vůči záměrné změně chování z jiné/předchozí session. Řešit: aktualizovat test expectations. Frank rozhodne.
  (Druhé dřívější selhání — "beats below controller" na velmi krátkém viewportu — vyřešeno jako vedlejší efekt dynamického scroll fallbacku, viz Hotovo 2026-08-17b.)

## Hotovo

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
