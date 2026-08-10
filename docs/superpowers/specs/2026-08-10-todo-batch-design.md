# TODO batch 2026-08-10 — design

**Datum:** 2026-08-10
**Zdroj požadavků:** `docs/TODO.md`, sekce Otevřené #1–#9 (Frankovy připomínky z provozu)
**Repo:** `feel-fader-app`, jedna vlna, jeden PR

## Kontext a rozsah

Devět drobných UI/UX oprav, všechny čistě ve `feel-fader.html` (single-file zdroj pravdy — `app.js`/
`styles.css`/`assets/` v rootu jsou zastaralý necommitnutý extrakt, nepoužívají se; viz `CLAUDE.md`).
Žádná firmware/protokol změna. Pořadí implementace: od nejjednodušší po nejsložitější, ne podle
čísla v TODO.

Dvě položky mění scope oproti doslovnému zadání — obě odsouhlaseny Frankem 2026-08-10:

- **#1 (HID live keys):** appka nemá žádný datový kanál pro "právě triggerovaná klávesa" v
  `track_nav` módu (roller posílá HID přímo do OS, mimo MIDI/Serial spojení, které appka poslouchá).
  Skutečné live zobrazení by vyžadovalo firmware změnu (nový report kanál) — mimo rozsah této vlny.
  **Redukovaný scope:** místo prázdné pomlčky zobrazit nakonfigurovanou kombinaci kláves (staticky).
- **#3 (sync timing):** kód obsahuje komentář odkazující na Frankovo dřívější rozhodnutí (2026-07-21)
  nechat fade-in status baru a Send-to-device záměrně oddělený jako dva beaty. Nové zadání v TODO
  chce sladit na stejný okamžik — **potvrzeno jako přepis staršího rozhodnutí.**

---

## 1. Layout skok v ART řádku (TODO #2)

### Problém

`.live-hud-roller` (`styles`, ř. ~207) má `grid-template-rows:auto auto`. `.live-hud-value` mění
font-size podle délky textu (`.is-long` 8.25px, `.is-very-long` 7.5px, base 9px) — auto-výška
řádku 1 se tím mění a posouvá řádek 2 (`.live-hud-tech`, "Ch1·CC32") pod sebou.

Třídy se přepínají v `renderLiveStrip()`:
```js
rollerValueEl.classList.toggle('is-long', readableValue.length > 12);
rollerValueEl.classList.toggle('is-very-long', readableValue.length > 20);
```

### Řešení

Čistě CSS. Dát `.live-hud-roller`'s prvnímu řádku pevnou `min-height` (odpovídající base 9px
variantě, největší case), takže grid row-height je konstantní bez ohledu na aktivní
`.is-long`/`.is-very-long` třídu. Beze změny JS.

---

## 2. Modrý focus rám po kliku (TODO #8)

### Problém

`toggleSection(key)` po každém přepnutí (řádek ~2182) volá:
```js
requestAnimationFrame(() => document.getElementById(`section-toggle-${activeBank}-${key}`)?.focus());
```
`renderPanels()` mezitím DOM přestaví, takže `.focus()` cílí na nový element bez vazby na původní
klik. Prohlížečova `:focus-visible` heuristika u takového "osiřelého" programmatic focusu často
ukáže ring i po myší kliku — proto modrý rám na expandovaném BUTTON · Macro headeru.

`--focus` je záměrně modrá (`#4f7cff` light / `#7d9cff` dark) — jde o cílenou barvu ringu, ne o
neošetřený browser default. Chyba je v tom, kdy se ring ukazuje, ne v barvě.

### Řešení

Předat `event` do `toggleSection(key, event)` ze všech `onclick="toggleSection('${key}')"` volání
(section header markup) a `.focus()` volat podmíněně:
```js
requestAnimationFrame(() => {
  const el = document.getElementById(`section-toggle-${activeBank}-${key}`);
  if (el && (!event || event.detail === 0)) el.focus();
});
```
`event.detail === 0` identifikuje aktivaci klávesnicí/Enter na tlačítku (nulový počet kliků);
skutečný myší klik má `detail >= 1`. Klávesová navigace zůstává funkční (focus zůstává na nově
otevřeném/zavřeném headeru), po myší interakci se `.focus()` přeskočí a ring se neukáže.

---

## 3. Přehledová kartička nereaguje na validaci (TODO #9)

### Problém

`markSectionIssues()` (řádek ~4130) aktualizuje `.section-issue-dot` na section headerech a
`.bank-tab-issue` na bank tabech pomocí `sectionIssueKeys(bi)`/`banksWithIssues()`, ale nikdy se
nedotkne `#live-f1-tech`/`#live-f2-tech` (live status bar, `renderLiveStrip()`, ř. ~5191-5192) —
ty pořád jen vypisují `Ch${channel+1}·CC${cc}` obyčejným `var(--t3)` textem bez ohledu na validitu.

### Řešení

V `renderLiveStrip()` (nebo na konci `markSectionIssues()`, pokud má přístup k živě zobrazené
bance) zavolat `sectionIssueKeys(liveBank)` a přepnout novou třídu na `live-f1-tech`/`live-f2-tech`:
```js
const issues = sectionIssueKeys(liveBank);
document.getElementById('live-f1-tech')?.classList.toggle('has-issue', issues.has('fader1'));
document.getElementById('live-f2-tech')?.classList.toggle('has-issue', issues.has('fader2'));
```
Nová CSS třída `.live-hud-tech.has-issue{color:var(--danger)}` — barevná změna stačí (kartička je
malá, `.section-issue-dot`-style tečka by tam navíc nešla čistě vejít); barva sama je konzistentní
signál s tabem/řádkem. Znovupoužívá existující validační mechanismus 1:1, žádná nová logika.

---

## 4. Nadpis "Feel Fader" padá dolů bez tipů (TODO #6)

### Problém

`positionWelcomeAnchor()` (řádek ~5917) dopočítává `--welcome-anchor-top`, aby `#send-btn` zůstal
na pevné obrazovkové pozici bez ohledu na výšku obsahu nad `#welcome-action-slot`. Když
`#onb-beats` chybí (`ff-onboarded` už v `localStorage`, `onbShouldRun()` vrací false, `display:none`
zůstává), karta je kratší → algoritmus zvětší `padding-top`, aby button zůstal na místě → nadpis
(první element v kartě) vizuálně klesne.

### Řešení

Rezervovat prostor pro `#onb-beats` bez ohledu na viditelnost: dát `.welcome-copy-stage` (nebo
`#onb-beats` samotnému) pevnou `min-height` odpovídající jeho typické vykreslené výšce (title +
sub + dots), i když je obsah `display:none`/prázdný — např. místo `display:none` použít
`visibility:hidden` s `height:0` nahrazenou fixní rezervovanou výškou, nebo jednodušeji: nikdy
neměnit `.welcome-copy-stage`'s výšku a jen skrýt vnitřní obsah `#onb-beats` (`opacity:0`,
`pointer-events:none`) místo `display:none`.

**Ověřit při implementaci:** `.welcome-onboarding` větev (řádek ~1132) přepíná
`.welcome-copy-stage` na `position:fixed`, controller-centered layout, dokud onboarding běží — to
je nezávislý layout mód, tahle oprava se ho netýká (platí jen pro non-onboarding/"tips hidden"
stav). Zkontrolovat, že fixní min-height nerozbije přechod mezi oběma módy.

---

## 5. Sladit fade-in status baru a Send to device (TODO #3)

### Problém

`connectTransitionWelcome()` (řádek ~6056):
```js
setTimeout(() => { ... updateContextualLiveStrip(); }, 1100);   // .live-hud fade .28s
setTimeout(revealPostConnectUI, 1450);                           // #send-btn keyframe .6s
```
350ms rozestup mezi starty, navíc rozdílná délka animace (.28s vs .6s) — status bar doběhne
~T+1380ms, tlačítko ~T+2050ms. Komentář u druhého volání cituje Frankovo rozhodnutí z 2026-07-21
nechat to záměrně oddělené — **přepsáno tímto batchem.**

### Řešení

Sjednotit start na stejný `setTimeout` (oba na T+1100ms) a sladit trvání animace — zkrátit
`welcome-btn-reveal` keyframe na ~.3s (blíž `.live-hud`'s .28s), ne prodlužovat status bar na .6s
(kratší přechod působí méně těžkopádně). Odstranit komentář odkazující na starý záměr "vlastní
beat", nahradit stručnou poznámkou proč jsou teď sladěné (odkaz na TODO #3 / 2026-08-10).

---

## 6. Vycentrovat "Live positions unavailable" (TODO #7)

### Problém

`#live-note` (řádek 1824) je prostý flex-column sibling před `#device-home` uvnitř `.stage`.
`.stage{justify-content:center}` centruje **celý stack** (live-note + device-home) v rámci vlastní
výšky `.stage` — necentruje `#live-note` samotný v mezeře mezi top barem (`.top-sticky`, mimo
`.stage`) a controllerem. Dnes žádný dedikovaný "gap" element neexistuje.

### Řešení

**Primárně CSS-only pokus:** obalit `#live-note` vlastním wrapperem s `flex:1;display:flex;
align-items:center;justify-content:center` mezi (implicitním) koncem top baru a `#device-home`,
pokud to stávající `.stage` flex-column struktura dovolí bez vedlejších efektů na centrování
zbytku stacku.

**Záloha, pokud CSS-only nesedí vizuálně** (např. kvůli sticky headeru mimo `.stage`): JS výpočet
gapu analogický `positionWelcomeAnchor()` — změřit `header.getBoundingClientRect().bottom` vs.
`#device-home`'s top, absolutně pozicovat `#live-note` do středu rozdílu, přepočítat při
`resize`/změně connection state stejně jako `renderConnState()` už dnes přepíná `hidden`.

Začít CSS-only variantou; JS měření zapojit jen pokud vizuální ověření (probe/screenshot) ukáže
posun mimo mezeru.

---

## 7. HID live keys → statická konfigurovaná kombinace (TODO #1, redukovaný scope)

### Řešení

V `renderLiveStrip()`, větev `mode === 'track_nav'` (řádek ~5196-5202), kde dnes `rollerValue`
zůstává `'—'` (chybí branch), přidat:
```js
} else if (allowed && mode === 'track_nav') {
  rollerValue = `${keyComboLabel(bank.nav_keys_cw)} / ${keyComboLabel(bank.nav_keys_ccw)}`;
}
```
`keyComboLabel()` (řádek 2284) už existuje a řeší formátování (`'—'` pro prázdné pole). Žádná nová
funkce, žádné firmware/protokol dotčení.

Do `docs/TODO.md` Hotovo poznámky u této položky napsat, že jde o zobrazení **nakonfigurované**
kombinace, ne live trigger, a proč (chybí zpětný datový kanál z rolleru v HID módu) — ať je jasné,
že to není zapomenutá práce, ale vědomé zúžení scope.

---

## 8. Hover tooltips místo "?" ikon (TODO #4)

### Problém

Dvě místa s "?" ikonou:
- statická HID řádka, `feel-fader.html:1889`
- `sectionHeaderHtml()` šablona (řádek 2199), `helpBtn` — `helpAnchor` je non-null jen na volání
  z `faderSectionContent()` (řádek 2771, LEFT/RIGHT FADER sekce); roller a macro sekce ho nemají.

Žádný tooltip mechanismus v appce dnes neexistuje (grep na `"tooltip"` — nula výskytů). Jediné
hover-affordance je nativní `title="..."` (25 výskytů file-wide) — browser default, ne custom
komponenta.

### Řešení

Nová malá sdílená komponenta:
- Jeden `<div id="hover-tip" class="hover-tip" role="tooltip" hidden>` append do body, repozicovaný
  JS podle `getBoundingClientRect()` cílového prvku.
- `mouseenter`/`mouseleave` pár na prvcích s `data-tip="..."` atributem, 2000ms `setTimeout` před
  zobrazením (`clearTimeout` na `mouseleave` před uplynutím), krátký fade-in/out přechod.
- Content: krátký vlastní text per prvek (ne celý help-panel odstavec) — u HID řádky a fader
  sekcí použít zkrácenou verzi textu z odpovídajících `help-hid`/`help-faders` sekcí v Help panelu.
- Odstranit oba `<button class="tx" onclick="openHelpAt(...)">?</button>` výskyty; nahradit
  `data-tip="..."` atributem přímo na HID switch labelu a na fader section title/headeru.
- `openHelpAt()` a Help panel samotný **zůstávají beze změny** (pořád přístupné napřímo z Help
  sekce/menu) — ruší se jen tahle dvě vstupní "?" tlačítka, ne cílová help-content sekce.

---

## 9. Drag/swipe na welcome tips (TODO #5, nejsložitější)

### Řešení

Adaptovat existující pointer-drag vzor z `#live-strip` (`pointerdown`/`pointermove`/
`setPointerCapture`, řádky ~5077-5109) na horizontální swipe nad `#onb-beats` — bez "momentum"
fyziky, kterou má originál navíc (ta je pro volné 2D pozicování HUD, tady stačí prahová hodnota):

```js
let dragStartX = null;
beats.addEventListener('pointerdown', e => {
  dragStartX = e.clientX;
  clearTimeout(_onbBeatTimer);          // uživatel právě interaguje, nepřerušovat autoadvance skokem
  beats.setPointerCapture(e.pointerId);
});
beats.addEventListener('pointerup', e => {
  if (dragStartX === null) return;
  const dx = e.clientX - dragStartX;
  dragStartX = null;
  if (Math.abs(dx) < 40) return;         // práh ~40-60px
  onbBeatGo(_onbBeat + (dx < 0 ? 1 : -1));
});
```

- Tečky (`.onb-dot`) **zůstávají** — TODO #5 formuluje "místo/vedle", takže gesto se přidává jako
  doplněk, ne náhrada; klik na tečku dál funguje beze změny.
- `onbBeatGo()` už dělá clamp na `[0,2]` (`Math.max(0, Math.min(2, i))`) — swipe za hranicí prostě
  no-opne na krajním beatu, nepotřebuje vlastní hranice.
- Volitelné vizuální vylepšení (ne nutné pro funkčnost): drag-follow textu při `pointermove` mezi
  down/up, ale vzhledem k tomu, že jde o krátký text s fade transition, jednodušší je nechat
  stávající `onbBeatGo()` fade přechod a swipe brát jen jako alternativní trigger — méně nového kódu.

---

## Pořadí a ověření

Jedna branch (`todo-batch-2026-08-10`), všech 9 položek v pořadí 1→9 výše (od nejjednodušší po
nejsložitější), jeden PR na konci — stejný vzor jako `todo-batch-2026-08-09`.

| # | TODO | Důkaz |
|---|---|---|
| 1 | #2 ART jump | Nový/rozšířený probe: `getBoundingClientRect().top` řádku `live-hud-tech` identický při přepnutí mezi krátkým a dlouhým názvem artikulace |
| 2 | #8 focus ring | Probe: simulovat myší klik na section toggle → `document.activeElement` nemá `:focus-visible` matching (nebo computed outline `none`/transparent); klávesová aktivace (Enter) pořád fokusuje |
| 3 | #9 kartička validace | Probe: nastavit neplatné CC na fader1 → `#live-f1-tech` získá `.has-issue`/`var(--danger)` barvu; po opravě třída zmizí |
| 4 | #6 nadpis | Probe: `#welcome-wordmark.getBoundingClientRect().top` identický s `ff-onboarded` nastaveným i nenastaveným v `localStorage` |
| 5 | #3 sync timing | Probe: po `connectTransitionWelcome()` oba `#live-strip` a `#send-btn` dosáhnou `opacity:1`/plné viditelnosti ve stejném (nebo velmi blízkém, ±nějaké tolerance) okamžiku |
| 6 | #7 live-note centrování | Vizuální ověření (screenshot/DevTools) + probe na `getBoundingClientRect()` střed `#live-note` vs. střed gapu header-bottom↔device-home-top |
| 7 | #1 HID keys | Probe: v `track_nav` módu s nastavenými `nav_keys_cw`/`nav_keys_ccw` je `live-roller-value` rovno `keyComboLabel(...)` výstupu, ne `'—'` |
| 8 | #4 tooltips | Probe: hover na cílovém prvku 2s → tooltip `hidden` false s očekávaným textem; hover < 2s → tooltip se nezobrazí; "?" tlačítka zmizela z DOM |
| 9 | #5 swipe | Probe: simulovat `pointerdown`+`pointermove`+`pointerup` s dx > prahu → `_onbBeat` inkrementuje/dekrementuje; dx < prahu → beze změny; klik na tečku pořád funguje |

Všechny probes + existující sada: `npm test` zelený před PR.

Po dokončení všech 9 položek: přesunout je z **Otevřené** do **Hotovo** v `docs/TODO.md` s datem
2026-08-10, včetně poznámky u #1 (redukovaný scope — statická kombinace, ne live trigger, důvod:
chybí zpětný datový kanál) a u #3 (přepis dřívějšího rozhodnutí z 2026-07-21, potvrzeno Frankem
2026-08-10).

### Mimo rozsah

- Firmware/protokol změna pro skutečný live report HID kláves z rolleru (možná budoucí samostatná
  cross-repo vlna, pokud o to Frank znovu požádá).
- Cokoliv v necommitnutém `app.js`/`styles.css`/`assets/` refaktoru v rootu repa — mimo tuhle vlnu.
