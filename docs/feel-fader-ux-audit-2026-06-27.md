# Feel Fader — UX / vizuální audit

**Datum:** 2026-06-27 · **Auditovaný soubor:** `feel-fader.html` · **Metoda:** render (headless Chrome, 8 stavů) + statický rozbor CSS/JS · **Typ:** diagnostika, bez zásahů do kódu.

> Connected stavy (live fadery, connect transition, SysEx přenos) nejdou bez HW vyrenderovat — nálezy o nich jsou založené na čtení kódu, označeno `zdroj: kód`.

---

## Status: implementováno 2026-06-27

**Várka 1** (9 fix položek + code-hygiene) + **Várka 2 — type/space pass (V2+V3+V4)** aplikováno do `feel-fader.html` a ověřeno renderem (headless Chrome). Žádná změna se nedotkla SysEx/serial protokolu → round-trip sync s firmwarem beze změny.

Type/space pass výsledek:
- **V3** — typografie 9 → **6 stupňů** (22/16/13/12/11/10). Titulky kompaktní (14→13 dle Frankova rozhodnutí). Glyphy `+/−/×` a ikony (14/20) ponechány jako výjimka.
- **V4** — Mulish 500→600 → **3 váhy** (400/600/700). Mono ponechán na 500 (jediná numerická váha; IBM Plex Mono nemá načtené 600).
- **V2** — 10 off-grid paddingů (5/7/9/13/14/22) srovnáno na 4px grid. `margin-left:-13px` (centrování ks-handle) ponecháno (geometrie). Hodnoty 6/10/20 ponechány (mimo flagged set).

**Várka 3 — A3 + A4:**
- **A3** — touch targety: `@media(pointer:coarse)` zvětšuje step-btn, m-close, btn-remove-bank, icon-picker-trigger na ≥44px a tag-remove na ≥32px. Desktop beze změny.
- **A4** — kontrast (strategie: promote info text → t2): 16 informačních popisků (field-label, enc-label, section eyebrows, notes, info-lbl/values, mode val, „Waiting for device") přepnuto z t3 na t2 → splňují AA. `--t3` ponechán světlý jen pro dekorativní prvky (badge, chip, glyphy ▼/×/+, placeholdery, footer drobnopis, debug, chevrony) — zachována tonální hierarchie. Dark mód těží automaticky (dark t2 světlejší než t3).

## Scope decision (triáž s Frankem, 2026-06-27)

**✅ FIX (v scope):** V1, A1, A2, S1, V7, I2, S2, S3, A5 + code-hygiene H1–H4.
**✅ VŠE HOTOVO 2026-06-27:** ~~V2 + V3 + V4 (type/space pass)~~, ~~A4 (kontrast)~~, ~~A3 (touch targety)~~ — viz Várka 3 níže.
**❌ DROP:** I1 (fadery jsou OK v aktuálním stavu — záměr), V5, V6, I3, A6, S4 (spadá do V1).

Poznámky: S3 (dirty indikátor) Frank explicitně chce. Mobil není priorita, ale má fungovat → A5 fix, A3 defer.

---

## Executive summary

Appka působí Apple-like už na první pohled — čistý layout, dobrá tokenizace barev/radiusů, smysluplný split Mulish (UI) / IBM Plex Mono (čísla). Není to chaos; je to **nedotažená disciplína**. Pět opakujících se témat, která dělí appku od „dokonalého" pocitu:

1. **Fragmentovaná sémantická zelená** — success/connected zelená existuje ve **4 různých hodnotách**; klíčová zelená na „send" tlačítku je hardcoded mimo paletu.
2. **Spacing nemá jeden rytmus** — ~21 různých hodnot včetně off-grid 5/7/9/13/14/22px.
3. **Přebujelá typografie** — 9 velikostí písma a 4 váhy běží paralelně.
4. **Klávesnicový focus je vypnutý** — dvě `outline:none` pravidla přebíjejí jinak hotový `:focus-visible` ring; touch targety pod 44px.
5. **Chybové/edge stavy nejsou navržené** — „MIDI nedostupné" vypadá jako „hledám"; „neuložené změny" uživatel nevidí; dlouhý název banku rozbíjí řadu tabů.

Celkové hodnocení: **~75 % cesty k Apple-like dokonalosti.** Žádné fundamentální přepracování — sada cílených, většinou nízkonákladových oprav appku zřetelně pozvedne. Většina P1 nálezů jsou „quick wins".

---

## Tabulka nálezů

| ID | Osa | Záv. | Název |
|---|---|---|---|
| V1 | Vizuál | **P1** | Sémantická zelená fragmentovaná do 4 hodnot |
| V2 | Vizuál | **P1** | Spacing mimo 4px grid |
| A1 | A11y | **P1** | `button:focus{outline:none}` ruší klávesnicový focus |
| A2 | A11y | **P1** | Inputy nemají focus stav |
| A3 | A11y | **P1** | Touch targety pod 44px |
| S1 | Stavy | **P1** | Error/unsupported stav vypadá jako „searching" |
| V3 | Vizuál | P2 | 9 velikostí písma |
| V4 | Vizuál | P2 | 4 váhy písma paralelně |
| V5 | Vizuál | P2 | Ad-hoc stíny mimo tokeny |
| V7 | Vizuál | P2 | Nedefinovaná `--bg-base` → šedý fallback blok |
| I1 | Interakce | P2 | Fader thumby bez affordance |
| I2 | Interakce | P2 | Send/Load aktivní bez zařízení → tichý serial chooser |
| S2 | Stavy | P2 | Dlouhý název banku se v tabu netruncuje |
| S3 | Stavy | P2 | „Neuložené změny" (dirty) nemá indikaci |
| A4 | A11y | P2 | Kontrast `--t3` pod 4.5:1 |
| A5 | A11y | P2 | Mobil: status připojení skrytý + overflow tabů |
| V6 | Vizuál | P3 | Hardcoded barvy v dark overrides |
| I3 | Interakce | P3 | Header metadata nízký kontrast (splývá) |
| S4 | Stavy | P3 | Send success: inline zelená mimo token (viz V1) |
| A6 | A11y | P3 | Icon-only tlačítka — ověřit aria-label/title |

---

## Detaily — Osa 1: Vizuální jazyk

### V1 — Sémantická zelená fragmentovaná do 4 hodnot
- **Záv.:** P1 · **Zdroj:** kód
- **Co:** „success / connected" zelená je v kódu jako 4 různé barvy.
- **Kde:** `--green:#34c759` (ř. 24, status dot) · `#3a7a3a` (ř. 2681, inline „✓ sent" na send tlačítku) · `#2e7d32` (ř. 531 toast.s; ř. 80 connected banner text) · `rgba(76,175,80,…)` (ř. 80 banner bg/border).
- **Proč vadí:** R4 (jeden akcent, konzistentní sémantika). Klíčové potvrzení úspěchu (send → zelená) je hardcoded mimo paletu a tmavší/jiné než status zelená — uživatel vidí dva různé „úspěchy".
- **Doporučení:** Jeden token `--green` + odvozené tinty (`--green-bg`, `--green-border`, `--green-strong`). Send success, toast, banner i dot z jednoho zdroje. (Zelená je dle tvého zadání důležitá — tím spíš ať je jednotná.)

### V2 — Spacing mimo 4px grid
- **Záv.:** P1 · **Zdroj:** kód
- **Co:** ~21 hodnot spacingu, z toho off-grid 5/7/9/13/14/22px rozbíjí rytmus.
- **Kde:** např. `.bank-block-tab` padding `7px 16px` (ř. 886) · `.bank-block-name` padding `12px 14px` (ř. 933) · `.ks-slider` margin `12px 18px` (ř. 196) · `.m-close` 27×27 (ř. 519) · paddingy 5/9/13px napříč.
- **Proč vadí:** R1. Drobné nekonzistence se sčítají do pocitu „lehce neuspořádané".
- **Doporučení:** Globální pass — zaokrouhlit vše na `4·8·12·16·24·32·48·64`. Nejlépe zavést `--sp-1…--sp-8` tokeny a používat je.

### V3 — 9 velikostí písma
- **Záv.:** P2 · **Zdroj:** kód
- **Co:** font-size 9/10/11/12/13/14/16/20/22px.
- **Proč vadí:** R2 (max 6 stupňů). Příliš jemné rozdíly (12 vs 13, 20 vs 22) oko nevnímá jako hierarchii, jen jako šum.
- **Doporučení:** Sloučit na schválených 6: Display 22 / Title 16 / Body 13 / Secondary 12 / Caption 11 / Mono-micro 10. Zrušit 9, 14, 20.

### V4 — 4 váhy písma paralelně
- **Záv.:** P2 · **Zdroj:** kód
- **Co:** 400/500/600/700; 500 i 600 se míchají (stepper input 600, `.btn` 500, panel-name 600).
- **Proč vadí:** R3 (max 3 váhy).
- **Doporučení:** Sjednotit na 400 / 600 / 700; zrušit 500.

### V5 — Ad-hoc stíny mimo tokeny
- **Záv.:** P2 · **Zdroj:** kód
- **Kde:** `.device-img` (ř. 100), uacc dropdown `0 8px 24px` (ř. 233), `.modal` `0 20px 60px` (ř. 515), toast (ř. 530), send-btn glow (ř. 133).
- **Proč vadí:** R5 (elevace = systém).
- **Doporučení:** 2–3 elevační tokeny (`--shadow-sm/md/lg`) + výjimka pro device hero. Vše ostatní přemapovat.

### V7 — Nedefinovaná `--bg-base` → šedý fallback blok
- **Záv.:** P2 · **Zdroj:** kód + render
- **Co:** `.artic-display{background:var(--bg-base,#e0e0e0)}` (ř. 385) — `--bg-base` nikde není definovaná, takže se vždy použije fallback `#e0e0e0`, šedý blok mimo paletu (v light i jako základ pro dark override).
- **Proč vadí:** R4.
- **Doporučení:** Buď definovat `--bg-base` v `:root` i `.dark`, nebo nahradit existujícím tokenem (`--bg-input`).

### V6 — Hardcoded barvy v dark overrides
- **Záv.:** P3 · **Zdroj:** kód
- **Kde:** `#888`, `#e0e0e0`, `#111`, `#111115`, `#ff5a42`, `#1a1a1e` v `html.dark …` pravidlech.
- **Proč vadí:** R4. Obchází tokeny → riziko rozjetí palety.
- **Doporučení:** Zavést dark varianty proměnných.

---

## Detaily — Osa 2: Interakce & flow

### I1 — Fader thumby bez affordance
- **Záv.:** P2 · **Zdroj:** render + kód
- **Co:** Thumby na device PNG jsou dragovatelné (`cursor:grab`), ale nic nenapovídá, že obrázek zařízení je interaktivní.
- **Proč vadí:** R2 (discoverability). Uživatel netuší, že může táhnout.
- **Doporučení:** Jemný hover/idle hint (mikro-pohyb thumbu při prvním zobrazení, nebo jednorázový tooltip „drag to test").

### I2 — Send/Load aktivní bez zařízení → tichý serial chooser
- **Záv.:** P2 · **Zdroj:** render + kód
- **Co:** Při „Web MIDI not available" jsou obě primární tlačítka aktivní; klik na send (`doSend` → `_serialEnsureOpen`) rovnou vyvolá serial port chooser bez kontextu.
- **Proč vadí:** R2/R8 (prevence chyb, feedback).
- **Doporučení:** Buď disable + tooltip „connect device first", nebo krok s vysvětlením před vyvoláním serial pickeru.

### I3 — Header metadata nízký kontrast
- **Záv.:** P3 · **Zdroj:** render
- **Co:** Verze (`.h-ver`), badge a status text v `--t3` splývají s pozadím.
- **Doporučení:** Viz A4 (kontrast).

---

## Detaily — Osa 3: Stavy & edge cases

### S1 — Error/unsupported stav vypadá jako „searching"
- **Záv.:** P1 · **Zdroj:** render
- **Co:** „Web MIDI not available — use Chrome or Edge" se zobrazí v šedé (`--t3`) se šedým dotem — vizuálně identické se stavem „hledám zařízení".
- **Proč vadí:** R8 (každý stav má design). Chyba/nepodpora není odlišená od běžného čekání.
- **Doporučení:** Error/unsupported = červený dot + `--red` text (banner už `.error` třídu má — jen ji na tento případ použít).

### S2 — Dlouhý název banku se v tabu netruncuje
- **Záv.:** P2 · **Zdroj:** render (filled bank, mobile)
- **Co:** `.bank-block-tab` nemá max-width/ellipsis; jeden dlouhý název („Spitfire BBC Symphony Orchestra — Violins I") rozvře tab a vytlačí ostatní banky do horizontálního scrollu.
- **Proč vadí:** R8/R10.
- **Doporučení:** `max-width` + `text-overflow:ellipsis` na tab name (vzor `.bank-tab-name` už existuje, ř. 152).

### S3 — „Neuložené změny" (dirty) nemá indikaci
- **Záv.:** P2 · **Zdroj:** kód
- **Co:** JS drží `dirty` flag, ale UI nikde nezobrazuje, že konfigurace v appce ≠ konfigurace v zařízení.
- **Proč vadí:** R8. Uživatel může odejít s neodeslanými změnami.
- **Doporučení:** Vizuální dirty indikátor (tečka u „send to device", změna stavu tlačítka).

### S4 — Send success: inline zelená mimo token
- **Záv.:** P3 — viz **V1**.

---

## Detaily — Osa 4: Přístupnost & responzivita

### A1 — `button:focus{outline:none}` ruší klávesnicový focus
- **Záv.:** P1 · **Zdroj:** kód
- **Co:** Appka má hotový `:focus-visible{outline:2px solid var(--red)}` (ř. 846), ale `button:focus{outline:none}` (ř. 943) ho vyšší specificitou přebije → tlačítka nemají žádný viditelný focus při ovládání klávesnicí.
- **Proč vadí:** R9.
- **Doporučení:** Smazat ř. 943 (focus-visible řeší vše korektně). **Quick win.**

### A2 — Inputy nemají focus stav
- **Záv.:** P1 · **Zdroj:** kód
- **Co:** `input:focus-visible{outline:none}` (ř. 852) vypíná ring i pro inputy; stepper/uacc inputy pak nemají žádný focus indikátor (jen `.bank-name-input` mění border-bottom).
- **Proč vadí:** R9.
- **Doporučení:** Smazat ř. 852, nebo dát inputům vlastní jasný focus (border/ring). **Quick win.**

### A3 — Touch targety pod 44px
- **Záv.:** P1 · **Zdroj:** kód
- **Kde:** `.step-btn` 28×32 (ř. 190) · `.m-close` 27×27 (ř. 519) · `.btn-remove-bank` 28×28 (ř. 287) · `.stepper input` width 32 (ř. 188) · `.tx`, `.lib-tag-remove`.
- **Proč vadí:** R9 (≥44px).
- **Doporučení:** Zvětšit cíle nebo přidat neviditelný hit-area padding. Na desktopu méně kritické, na dotyku zásadní.

### A4 — Kontrast `--t3` pod 4.5:1
- **Záv.:** P2 · **Zdroj:** kód
- **Co:** `--t3:#aeaeb2` na `--bg:#f5f5f7` ≈ 1.9:1; používá se na field-labely, captions, info-lbl, notes.
- **Proč vadí:** R9 (≥4.5:1 pro text).
- **Doporučení:** Ztmavit `--t3` pro text (např. ~`#86868b`), nebo `--t3` rezervovat jen pro netextové prvky.

### A5 — Mobil: status připojení skrytý + overflow
- **Záv.:** P2 · **Zdroj:** render (375px) + kód
- **Co:** `@media(max-width:540px)` skrývá `.h-status-text` (ř. 354) → na mobilu uživatel nevidí stav připojení; navíc overflow tabů (S2).
- **Proč vadí:** R10.
- **Doporučení:** Ponechat aspoň dot + zkrácený stav; vyřešit S2.

### A6 — Icon-only tlačítka — ověřit aria-label/title
- **Záv.:** P3 · **Zdroj:** kód
- **Co:** Celkem jen 19 výskytů `aria-/alt/title`. Ověřit, že dark toggle, ⚙ settings, × remove, icon-picker trigger mají přístupný název.
- **Doporučení:** Doplnit `aria-label` kde chybí.

---

## Code-hygiene (mimo UX, na vyžádání)

| ID | Co | Kde |
|---|---|---|
| H1 | Duplicitní CSS pravidla | `.send-btn:hover` (136/138), `.send-btn:active` (137/139), `.bank-tab:hover` (150/153), `.step-btn:hover` (191/193), `.bank-tab-add:hover` (156/158), `.bank-name-input:focus` (281/282) |
| H2 | Prázdný media blok | `@media(hover:hover){}` (ř. 446) |
| H3 | Nedefinovaná proměnná | `--bg-base` jen jako fallback (ř. 385) — viz V7 |
| H4 | Mrtvý kód / komentáře | `.panel-dot{display:none}` (ř. 173), `.send-arrow{display:none}` (ř. 119), „bank-header-wrap removed" (ř. 256) |

---

## Quick wins (vysoký dopad / nízký náklad)

1. **A1 + A2** — smazat dvě `outline:none` pravidla (ř. 852, 943); funkční focus ring je už hotový. Okamžitě opravený keyboard a11y.
2. **V1** — sjednotit zelenou do jednoho tokenu (řeší i S4). Důležitá barva, malá změna.
3. **S1** — přepnout error/unsupported na červený dot + `--red` (třída `.error` existuje).
4. **S2** — `max-width` + ellipsis na bank tab name (1 řádek CSS).
5. **H1** — dedupe duplicitních pravidel.

Tyto 4–5 položek pokrývají většinu P1 nálezů a jsou otázka řádů minut, ne hodin.
