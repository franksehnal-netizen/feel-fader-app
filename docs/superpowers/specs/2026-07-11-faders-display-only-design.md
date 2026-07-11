# Faders display-only + Control mód pryč (design)

**Datum:** 2026-07-11
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu/firmwaru.

## Kontext a přehodnocení

Vlna control módu (větev `control-mode`, na ní `help-onboarding`) přinesla „softwarový MIDI kontroler": bez připojeného zařízení šlo faderem táhnout myší a appka posílala CC na vybraný MIDI výstup. HW test odhalil nečistotu: na Windows neexistuje vestavěný virtuální MIDI port (na Macu IAC, Windows nic) → smysluplné použití control módu i jeho test vyžadují instalaci (loopMIDI). Frank tento směr **zavrhl**:

1. Appka nemá posílat MIDI do DAWu bez zařízení.
2. Fadery na obrazovce se nemají dát hýbat myší.
3. **Fadery striktně následují pouze HW fadery.**

Appka = konfigurátor + **zrcadlo** stavu zařízení, ne kontroler.

## Zjištěný stav kódu

Na `main` (bez control módu) jsou fadery už teď tahatelné myší — pouze jako vizualizace (`mF` „drag = jen vizualizace, nemění config", audit I5); MIDI se z main neposílá. Control mód do `mF` jen **přidal** posílání CC. Drag aparát na `main`:

- `track-l`/`track-r`: `onmousedown="drag(event,…)"` + `ontouchstart="dragT(event,…)"`.
- řetěz `drag`/`dragT` → `onDrag`/`onDragT` → `mF(k,cy)` → přepíše `liveValues`, posune thumb, hodnotu/bar; proměnná `dragging`.

Příchozí HW data jdou **jinou** cestou a s `mF`/dragem nesouvisí: `serial CMD_INFO → applyInfoFaders → positionThumbs`, a live MIDI-in → `_faderDirty → flushFaderFrame → pF`. Tyto cesty zůstávají.

## Cíl

Fadery na obrazovce jsou **výhradně** zrcadlo HW (serial INFO + live MIDI-in). Žádné posílání MIDI z appky, žádná myší/dotyková manipulace faderů.

## Kritérium úspěchu

- Tažení myší ani dotykem přes `track-l`/`track-r` **nepohne** thumbem (fadery inertní k uživateli).
- Příchozí data (INFO / live MIDI CC) thumby dál posouvají (HW cesta netknutá).
- V kódu nezůstane mrtvý drag aparát ani žádná control-mode logika (grep = 0).
- Žádný page error; light+dark beze změny vzhledu (kromě zmizelé drag-afordance kurzoru).

## Řešení

**Báze:** nová větev `faders-display-only` z `main`. Větve `control-mode` a `help-onboarding` v této podobě **opouštíme** (control mód nikdy nešel do `main`, takže na main není co čistit).

### A. Fadery display-only

- Z `track-l`/`track-r` odstranit `onmousedown` a `ontouchstart`.
- Odstranit mrtvý drag aparát: `drag`, `dragT`, `onDrag`, `onDragT`, `stopDrag`, `mF`, proměnná `dragging`. (`mF` má na main jediné volání z `onDrag`/`onDragT` — po odstranění je mrtvý.)
- Odstranit drag-afordanci: kurzor typu `grab`/`ns-resize`/`pointer` na `.fader-track` (ať to nevypadá tahatelně); track má action-neutrální kurzor (default).
- **Nechat:** hover-link (`hoverFaderLink` na mouseenter/leave = zelený glow fader→config panel; jen zvýraznění, ne manipulace); keyswitch range handles (`ksDragStart` = editace configu, ne fader); welcome dekorativní animace faderů (efekt před připojením, ne uživatel, ne MIDI).

### B. Help onboarding bez Control módu

Přenést Help obsah z `help-onboarding` (mini-guides Roller/Macro/Keyswitch/DEV + `openHelpAt` + `.help-hint` CSS + „?" ikonky u Roller a Button Macro), **vyjma** sekce Control módu:

- **Vypustit** subhead+odstavec `id="help-control"` („Control mode (no device)").
- Ostatní sekce (`help-roller`, `help-macro`, `help-keyswitch`, `help-dev`) + věta o sticky liště v „Banks & tags" zůstávají (sticky bar je na `main`).
- Žádná „?" ikonka nemíří na `help-control` (v původním rozsahu žádná nemířila — jen Roller/Macro).

Mechanika: cherry-pick Help commitů z `help-onboarding` na novou větev, pak odstranit `help-control` sekci; při konfliktu re-implementovat obsah čerstvě (obsah je plně specifikovaný v `2026-07-10-help-onboarding-design.md`).

## Ověření (headless, puppeteer-core, system Chrome, pipe:true)

- `grep` v `feel-fader.html`: `mF(`, `function mF`, `dragT`, `onDrag`, `let dragging`, `controlMode`, `scheduleControlSend`, `help-control` → **0**.
- `track-l`/`track-r` nemají `onmousedown`/`ontouchstart`.
- Simulace: `mousedown`+`mousemove` nad `#track-l` → `#thumb-l` `transform` se **nezmění**.
- HW cesta žije: `applyInfoFaders([100,20]); positionThumbs()` (nebo simulace MIDI CC) → thumby se posunou na odpovídající pozice.
- Help: existují `#help-roller`, `#help-macro`, `#help-keyswitch`, `#help-dev`; `#help-control` **neexistuje**; `.help-hint` u Roller+Macro; `openHelpAt('help-macro')` rozbalí Help + scroll. Žádné page errors.

**Manuální (Frank, nula instalací / nula HW):** otevřít app → zkusit táhnout fadery myší → nehnou se. (HW-following už ověřeno dřív při sync-on-connect: „Pozice faderu v appce odpovídá faderům na zařízení.")

## Mimo rozsah

- Firmware (žádná změna protokolu).
- Welcome animace (zůstává).
- V10/legal patička (samostatné).

## Merge / endgame

Po review: merge `faders-display-only` → `main`; push `main` (byl ahead 3 + tato změna); volitelně demo deploy. Větve `control-mode`/`help-onboarding` zůstanou viset nemergované (smazat lze později).
