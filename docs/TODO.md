# Feel Fader Web App — TODO

Frankovy připomínky k dořešení. Hotové položky přesouvat do sekce **Hotovo** s datem.

> **Pozor na zdroj pravdy:** živý kód je inline `<style>` a `<script>` v
> [feel-fader.html](../feel-fader.html). Samostatné pracovní extrakty CSS/JS
> nevytvářet ani needitovat.

## Otevřené

_(žádné otevřené položky)_

## Hotovo

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
