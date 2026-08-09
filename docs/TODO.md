# Feel Fader Web App — TODO

Frankovy připomínky k dořešení. Hotové položky přesouvat do sekce **Hotovo** s datem.

> **Pozor na zdroj pravdy:** živý kód je inline `<script>` v
> [feel-fader.html:2116](../feel-fader.html#L2116). Soubor `app.js` v rootu není
> trackovaný v gitu a stránka ho nenačítá — je to zastaralý extrakt, needitovat.

## Otevřené

1. **Live status bar nezobrazuje triggerované klávesy v HID módu.** Když je
   aktivní HID (label "HID・keys" u NAV řádku), hodnota vedle NAV zůstává
   prázdná/pomlčka (`—`) místo toho, aby ukázala skutečné klávesy, které se
   právě triggerují (analogicky k tomu, jak L/R sloupce ukazují CC hodnotu).

2. **Skok layoutu při přepnutí artikulace.** V ART řádku live status baru se
   při přepnutí mezi artikulacemi (např. "Short — D…" ↔ "Long — Sul…") mění
   velikost fontu textu artikulace, což způsobí i drobný svislý odskok řádku
   "Ch1・CC32" pod ním. Text by měl mít stabilní font-size bez ohledu na
   délku/obsah názvu artikulace.

3. **Nesouběžný nástup live status baru a "Send to device" po connectu.** Po
   "Connect & load" a načtení hlavní aplikace se live status bar a tlačítko
   "Send to device" každé zobrazí zvlášť plynulým fade/transition efektem, ale
   ne ve stejný okamžik — nejdřív status bar, pak tlačítko. Mají se objevit
   současně (sladit timing přechodů).

4. **Zrušit ikony s otazníkem odkazující na Help & guide, nahradit hover
   tooltipy.** Ikony s "?" u funkčních prvků, které odkazují na sekci Help &
   guide, jsou zbytečné — odstranit je. Místo toho: když uživatel nechá kurzor
   nad funkčním prvkem cca 2 sekundy, má se objevit malé tooltip okno s
   informací o daném prvku (inline nápověda místo prokliku do Help & guide).

5. **Přepínání tipů na welcome screenu — nahradit tečky drag interakcí.**
   Tipy na welcome screenu se teď přepínají klikáním na 3 tečky (dot
   indikátory). Chtěl by místo/vedle toho, aby to reagovalo na kurzor —
   uživatel by měl mít pocit, že tip může intuitivně "vzít a potáhnout"
   (drag/swipe gesto) místo klikání na tečky.

6. **Nadpis "Feel Fader" na welcome screenu spadne dolů, když chybí tipy.**
   Když je v prohlížeči už zapamatované zařízení, sekce se 3 tipy se
   nezobrazuje (to je OK) — ale nadpis "Feel Fader" pak spadne přímo nad
   tlačítko "Connect & load", což nevypadá dobře. Pozice nadpisu má zůstat
   stejná jako ve stavu, kdy tipy zobrazené jsou (rezervovat místo/nezávislé
   pozicování, ne aby nadpis "padal" dolů podle přítomnosti tipů).

7. **Text "Live positions unavailable — MIDI not connected" vycentrovat mezi
   horní lištu a controller.** V hlavní aplikaci (bez připojeného MIDI) je
   hláška "Live positions unavailable — MIDI not connected" zarovnaná hned pod
   horní lištou, těsně nad fader controllerem. Chtěl by ji vizuálně vycentrovat
   na výšku v prostoru mezi horní lištou a horním okrajem controlleru.

8. **Nechtěný modrý focus rám kolem některých prvků.** U některých prvků
   (např. rozbalený panel "BUTTON · Macro" v Bank editoru) se občas zobrazí
   modrý ohraničující rám (focus outline). Chtěl by ho odstranit.

9. **Přehledová kartička nereaguje na validační chybu.** Nastavil jsem levému
   faderu Bank 1 neplatné CC (999, mimo 0–127 rozsah). Tab banky i řádek
   LEFT FADER v panelu dostanou červenou tečku — konzistentní signál. Ale
   kompaktní přehledová kartička vlevo nahoře, která je vidět pořád (i se
   zavřeným panelem banky), dál vypisuje `Ch1-CC999` obyčejným šedým textem,
   beze změny barvy nebo tečky.

## Hotovo

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
