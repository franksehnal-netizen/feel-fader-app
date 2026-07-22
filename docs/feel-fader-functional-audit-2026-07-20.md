# Feel Fader — Funkční audit v3: optimalita, efektivita, intuitivnost

**Datum:** 2026-07-20 · **Rozsah:** app (`feel-fader.html`) + firmware (`code.py`, `boot.py`, `ff_config.py`) · **Metoda:** 4 paralelní diagnostičtí agenti (Cross-device seamlessness, Interakce & flow, Stavy & edge cases + a11y, Firmware UX + Vizuální jazyk) — reálný headless render + statický rozbor kódu obou rep · **Typ:** diagnostika + rovnou opravené P0/P1 nálezy (na Frankovo zadání, na rozdíl od auditů 06-27/07-03/dnešního strukturního auditu, které byly čistě diagnostické).

> Navazuje na `feel-fader-ux-audit-2026-06-27.md` a `feel-fader-product-audit-2026-07-03.md`. Nálezy vyřešené v těch dvou auditech (a jejich Vlnách 1–2, HW ověřené) se neopakují. Vlna 3 z 07-03 (stavový model, onboarding, bank-bar header, T1–T4) je podle všech 4 agentů z velké části implementovaná v plánech `2026-07-09` až `2026-07-13` — potvrzeno kódem, ne jen věřeno dokumentu.

---

## Status: 5 z 6 P0/P1 nálezů opraveno a commitnuto 2026-07-20

**Opraveno, ověřeno probes, commitnuto:**
- **S10** (P0) — `commit 4438971` — "Continue without device" už nevratně nepřepisuje uložený config.
- **C7** (P1) — `commit 9845f42` — fyzické odpojení zařízení už nenechává appku lhát o stavu "connected".
- **C9** (P1) — `commit 9498bcc` — limity jména banky/labelu faderu v appce odpovídají tomu, co firmware skutečně uloží.
- **A8** (P1) — `commit 090ab93` — numerické steppery (nejpoužívanější prvek appky) skutečně dosahují 44px na dotyku.
- **A9** (P1) — `commit 54a469e` — validační chybová lišta je teď dostupná čtečkám obrazovky.

**Vědomě neopraveno, čeká na tebe:**
- **C8** (P1) — `--stage-entry-offset`/`--send-entry-gap` zůstávají po `connectTransitionWelcome()` nastavené na nenulovou hodnotu, ale `WEBAPP.md` §3.1 bod 5 tohle popisuje jako **záměrný** mechanismus pixel-perfect pokračování (ne bug). Bez fyzického zařízení nejde bezpečně ověřit, jestli reset na 0 nerozbije animaci, kterou jsi cíleně navrhoval. Dílčí zjištění agenta (hodnota se nepřepočítá po resize/rotaci) je nezávisle platné. Viz Detaily nálezů níže.

Zbylých 15 nálezů (P2/P3) je čistá diagnostika — žádný kód neměněn, čekají na tvou triáž.

---

## 1. Executive summary

1. **Nejzávažnější nález celého auditu (S10) byl v cestě, kterou appka nabízí jako bezpečnou.** "Continue without device" — jediný vstup do appky bez hardwaru — nevratně mazal uloženou práci při každém kliknutí, včetně zálohy v localStorage. Přesně ten scénář, který S5 fix (07-03) měl vyřešit (refresh ≠ ztráta práce), byl obejitý jinou cestou. Opraveno, ale odhalilo to skutečný **konflikt rolí**: appka slouží zároveň jako tvůj nástroj (uložená práce musí přežít) a veřejné demo (Slávi a spol. chtějí vždy stejný čistý start) — rozhodl jsi, že uložená práce vyhrává.
2. **Appka místy tvrdí věci, které dokument popírá, a naopak.** `WEBAPP.md` §0 slibuje "žádný cubic-bezier v celém souboru" — reálně jich je 19+, systematicky používaných, ne omylem. To není bug v appce, je to nepravdivá dokumentace — riskuje, že příští session buď zbytečně přepíše fungující animace, nebo si myslí, že přidává výjimku, která už dávno existuje.
3. **Firmware UX nedodržuje vlastní deklarovanou filozofii.** F3 z auditu 07-03 je pořád otevřený: přepnutí banky na zařízení okamžitě vystřelí pozici faderů do DAW (slyšitelný skok), zatímco boot je záměrně tichý. Help & Guide o tomhle vedlejším efektu mlčí.
4. **Cross-device sync má díry přesně tam, kde appka tvrdí, že je "hotovo".** Fyzické odpojení nechávalo appku lhát o stavu (C7, opraveno); jména/labely se tiše ořezávaly na firmware hranici bez varování (C9, opraveno); PC bank-switch z hardwaru přepíše `activeBank` bez ohledu na to, co zrovna editujete (C10, neopraveno — designová otázka).
5. **A11y má jednu systematickou díru (aria-live) a jednu regresi (touch targety).** A8 je zvlášť poučný: touch-target fix z dřívějška v kódu FYZICKY EXISTOVAL, ale CSS specificita ho přebíjela — appka si myslela, že je to vyřešené, a nebylo.

**Vzdálenost od cíle:** cross-device sync ~80 % (bylo ~45 % v 07-03, teď hlavně drobné díry, ne díry v základní hodnotě produktu) · interakce & flow ~90 % (I4/I6/I7/I8 hotové, zbývá jen "?" deep-linking) · a11y ~85 % po dnešních fixech · firmware UX ~70 % (F3 pořád otevřený, silent NVM degradace).

---

## 2. Tabulka nálezů

| ID | Osa | Závažnost | Stav | Náročnost | Protokol ⚠️ |
|---|---|---|---|---|---|
| S10 | Stavy & edge cases | P0 | ✅ opraveno | S | |
| C7 | Cross-device seamlessness | P1 | ✅ opraveno | S | |
| C8 | Cross-device seamlessness | P1 | ⚠️ deferováno | S–M | |
| C9 | Cross-device seamlessness | P1 | ✅ opraveno | S | ⚠️ (limity formátu) |
| A8 | Přístupnost | P1 | ✅ opraveno | S | |
| A9 | Přístupnost | P1 | ✅ opraveno | S | |
| A1 | Firmware UX | P2 | diagnostika | S/M | ⚠️ pokud konfigurovatelné |
| A3 | Firmware UX | P2 | diagnostika | S | |
| B2 | Vizuální jazyk | P2 | ✅ opraveno (doc) | S/M | |
| C10 | Cross-device seamlessness | P2 | diagnostika | S | |
| C11 | Cross-device seamlessness | P2 | diagnostika | S–M | |
| A10 | Přístupnost | P2 | ✅ opraveno | S | |
| S11 | Stavy & edge cases | P2 | ✅ opraveno | S | |
| F-01 | Interakce & flow | P2 | diagnostika | S | |
| F-02 | Interakce & flow | P2 | ✅ opraveno (částečně A9) | S | |
| F-03 | Interakce & flow | P3 | ✅ opraveno | S | |
| A2 | Firmware UX | P3 | ✅ opraveno | S ⚠️ | |
| B1/V10 | Vizuální jazyk / Stavy | P3 | ✅ opraveno 2026-07-22 | S | |
| B3 | Vizuální jazyk | P3 | ✅ opraveno | S | |
| B4 | Vizuální jazyk | P3 | ✅ opraveno | S | |

---

## 3. Detaily nálezů — opravené

### S10 — "Continue without device" nevratně smaže uložený config
- **Osa:** Stavy & edge cases · **Závažnost:** P0 · **Stav:** ✅ opraveno (`4438971`)
- **Co:** `skipWelcome()` bezpodmínečně volala `loadDefaultDemoConfig()`, která přepsala `cfg` na `DEFAULT_CFG` a do ~400ms i localStorage zálohu. Žádná podmínka nerozlišovala first-run od returning uživatele s rozpracovaným configem. Ověřeno end-to-end: uložit jméno banky → reload (přežilo) → klik "Continue without device" → jméno pryč z paměti i localStorage.
- **Kde:** `feel-fader.html` `skipWelcome()`, `loadDefaultDemoConfig()`.
- **Proč to vadí:** R14 (obnovitelnost) — přesně scénář, který S5 fix (07-03) měl vyřešit, obejitý jinou cestou.
- **Rozhodnutí:** Konflikt mezi "appka nikdy neztratí práci" a "veřejné demo vždy čisté" — Frank potvrdil, že uložená práce vyhrává. `skipWelcome()` teď resetuje na defaults jen když `_savedCfg` neexistuje (čerstvý prohlížeč). Existující test `mobile-ux-probe.mjs` ("...ignores stale browser configuration") testoval opačné chování — opraven na nové, plus přidán `skip-welcome-preserves-saved-config-probe.mjs`.

### C7 — Falešný "connected" stav po fyzickém odpojení
- **Osa:** Cross-device seamlessness · **Závažnost:** P1 · **Stav:** ✅ opraveno (`9845f42`)
- **Co:** `connState()`'s `linked = _ffConnected || !!_serialPort` — ale nic nenulovalo `_serialPort` při reálném odpojení (jen catch bloky u selhaného zápisu, časem). Appka mezitím hlásila "connected · no live view".
- **Kde:** nová `initSerialDisconnectWatch()`, volaná vedle `initMidi()`.
- **Proč to vadí:** R11 — appka tvrdí stav zařízení, který neplatí.
- **Fix:** `navigator.serial.addEventListener('disconnect', ...)` nuluje `_serialPort` na skutečnou odpojovací událost.

### C9 — Tiché ořezávání jmen bank/labelů na firmware hranici
- **Osa:** Cross-device seamlessness · **Závažnost:** P1 · **Stav:** ✅ opraveno (`9498bcc`) ⚠️
- **Co:** Firmware ořezává `name`→24, `label`→12 znaků bez ohledu na appku. `.bank-name-input` neměl `maxlength` vůbec; `.fader-title-input` měl `maxlength="32"`, firmware stejně ořízl na 12. Appka lhala o tom, kolik znaků skutečně přežije.
- **Kde:** `onBankRename()`, `onFaderName()`, oba inputy.
- **Fix:** limity sjednoceny na 24/12 na obou stranách (`maxlength` + JS clamp).

### A8 — Touch-target fix pro steppery přebitý CSS specificitou
- **Osa:** Přístupnost · **Závažnost:** P1 · **Stav:** ✅ opraveno (`090ab93`)
- **Co:** `@media(pointer:coarse){.step-btn{width:44px;height:44px}}` existoval, ale `.stepper .step-btn{width:24px;height:24px}` (mimo media query, vyšší specificita) ho přebíjel. Nejpoužívanější ovládací prvek appky (MIDI kanál/CC/velocity steppery) zůstával 24×24 na dotyku. `.section-toggle-action` chyběl v coarse bloku úplně.
- **Fix:** compound selektor `.stepper .step-btn` uvnitř coarse bloku + přidán `.section-toggle-action`.

### A9 — Validation banner bez aria-live
- **Osa:** Přístupnost · **Závažnost:** P1 · **Stav:** ✅ opraveno (`54a469e`)
- **Co:** `#vbar` byl jediná dynamická plocha appky bez `aria-live` (toasty, header status, send-change-note, welcome-start-msg ho mají).
- **Fix:** `role="alert" aria-live="assertive"`.

---

## 4. Detaily nálezů — deferováno k rozhodnutí

### C8 — `connectTransitionWelcome()` nechává `--stage-entry-offset`/`--send-entry-gap` nastavené
- **Osa:** Cross-device seamlessness · **Závažnost:** P1 · **Stav:** ⚠️ deferováno
- **Co:** Po animovaném connect přechodu zůstávají obě CSS proměnné na nenulové hodnotě (naměřeno: `-9px` na 1280×900, `+30.47px` na 390×844) — posouvají `.stage` (a tedy vše v něm, ne jen ovladač) po zbytek session. Hodnota se navíc nepřepočítá po resize/rotaci displeje.
- **Proč jsem to needitoval:** `WEBAPP.md` §3.1 bod 5 tohle explicitně popisuje jako záměrný mechanismus — "#device-home se přes `--stage-entry-offset` zarovná na aktuální pixely controlleru; žádná další onboarding karta přechod ani následný layout neposouvá." Bez fyzického zařízení nejde ověřit, jestli by reset na 0 způsobil viditelný "poskok" ovladače, který jsi cíleně navrhl eliminovat. Na rozdíl od `skipWelcome()` (kde starý komentář přiznával prostý omyl), tady žádný takový signál není.
- **Co by chtělo tvoje rozhodnutí:** (a) je 0 skutečně cílový stav po dokončení přechodu, jen chybí finální reset (jako u `skipWelcome()`), nebo (b) nenulová hodnota je nutná natrvalo pro pixel-perfect kontinuitu a jen chybí přepočet po resize? Druhá otázka (resize) je nezávisle platná v obou případech.
- **Kde:** `connectTransitionWelcome()`, `handoffPrimaryActionToApp()`, `correctMountedControllerToTarget()`.
- **Náročnost:** S (pokud (a)) / M (pokud (b), potřeba HW test).

---

## 5. Detaily nálezů — diagnostika (P2/P3, needitováno)

### Cross-device seamlessness

#### C10 — Bank-switch z hardwaru přepíše `activeBank` bez ohledu na rozeditovanou banku
- **P2.** `onMidiMsg()` větev Program Change nastaví `activeBank = pc` bezpodmínečně — i když má uživatel otevřenou a rozeditovanou jinou banku. Doporučení: `activeBank = pc` jen když `!dirty` nebo panel dané banky není otevřený; `liveBank` vždy. **Kde:** `onMidiMsg()`.

#### C11 — "Continue without device" → pozdější reálné připojení neporovná configy, pokud existují lokální edity
- **P2.** `onDeviceConnected()` provede hash porovnání jen `if (!dirty)`. Typický scénář (skip → edity → připojit HW) appku nikdy neinformuje, že zařízení může nést jinou konfiguraci. **Kde:** `onDeviceConnected()`.

### Interakce & flow

#### F-01 — Kontextové "?" odkazy z panelů do Help & Guide nejsou zapojené
- **P2.** Help sekce mají připravená ID (`help-faders`, `help-roller`, ...), nic na ně needkazuje. Vlna 3 (07-03) tohle navrhla, nikdy neimplementováno. **Kde:** Help body, srovnej s `openDeviceSettingsAtHid()`.

#### F-02 — Validation error flow bez `aria-invalid`/`aria-describedby`
- **P2** (částečně řeší dnešní A9 — `#vbar` má teď aria-live, ale jednotlivá pole pořád nemají `aria-invalid`/`aria-describedby` propojení na `err-b{i}-{key}`). **Kde:** error input rendering.

#### F-03 — "Duplicate bank" na stropu 8 bank: disabled tlačítko s nedosažitelným toastem
- **P3.** `disabled` atribut zabrání `onclick`, takže guard-toast v `duplicateBank()` se nikdy nespustí. `addBank()` řeší stejnou situaci lépe (úplně se skryje). **Kde:** duplicate tlačítko, `duplicateBank()`.

### Stavy & edge cases

#### S11 — Hlavička "Feel Fader" se zalomí na dva řádky při 8 bankách na 360px
- **P3.** `.h-title` nemá `flex-shrink:0` mimo mobile media query — průsečík dvou samostatně otestovaných featur (inline header + 8-bank overflow). **Kde:** `.h-title`.

#### V10/B1 — Mrtvé footer odkazy + Cloudflare e-mail artefakt
- **P3, opraveno 2026-07-22.** Cloudflare e-mail nahrazen přímým `mailto:support@acoustic-empire.cz`; neexistující Privacy/Terms a sociální `href="#"` odkazy odstraněny, dokud nebudou mít reálné cíle. Footer zároveň uvádí aktuální rok/verzi a oba požadované browser transporty.

### Firmware UX

#### A1 — F3 pořád otevřený: bank-change snapshot vs. tichý boot
- **P2**, stále otevřeno z 07-03. `SEND_FADER_SNAPSHOT_ON_BANK_CHANGE=True` hardcoded — přepnutí banky pošle skok pozice faderů do DAW, boot je záměrně tichý. Help text o tomhle vedlejším efektu mlčí. **Kde:** `code.py` L29-32, `on_bank_changed()`.

#### A2 — `hid_available` v CMD_INFO hardcoded `True`
- **P3** ⚠️. Neodráží skutečný stav `_kbd` (jestli HID inicializace uspěla). **Kde:** `send_info_sysex()`, `handle_serial_line()`.

#### A3 — Selhání obou NVM slotů tiše degraduje na file-backed config
- **P2.** `config_source==='file'` appka zobrazuje stejně jako zdravé `'nvm'` — o krok blíž k tichému factory resetu (F4 stav před opravou). **Kde:** `load_presets()`, app CMD_INFO handling.

### Vizuální jazyk

#### B2 — `WEBAPP.md` tvrdí "žádný cubic-bezier", reálně 19+ výskytů
- **P2.** Systematicky používaná `cubic-bezier(.16,1,.3,1)`-rodina napříč komponentami (welcome glow, HID switch, toasty, roller content, bank-tab, keyswitch chipy...) — ne jedna výjimka. Rozhodnutí: buď doc opravit na "rodina křivek pro větší přechody", nebo sjednotit kód na `ease`. **Kde:** `WEBAPP.md` §0 L48, 19 míst v `feel-fader.html`.

#### B3 — Nové hardcoded dark-mode hex barvy mimo dokumentované výjimky
- **P3.** `.info-lbl`/`.info-val`/`#device-settings-chevron`/`.btn-remove-bank`/`.lib-badge-sm` — stejný drift, který V11 (07-03) už jednou opravil, v nových komponentách. **Kde:** viz nález.

#### B4 — Footer logo v dark módu prakticky neviditelné
- **P3.** `filter` override v dark módu NAHRAZUJE (nesčítá) `opacity:.5` z light — výsledek skoro neviditelný wordmark. **Kde:** `.footer-logo` dark override.

### Přístupnost

#### A10 — Focus indikátor u `.bank-name-input` téměř neviditelný
- **P2.** Jediné pole v appce s `outline:none` a jen 1px border-bottom změnou místo silného focus ringu jako všude jinde. **Kde:** `.bank-name-input:focus`/`:focus-visible`.

---

## 6. Poznámka k procesu

Na rozdíl od `feel-fader-structure-audit-2026-07-20.md` (čistě diagnostický, Batch 9 čekal na tvoje schválení) jsi tentokrát řekl "oprav zjevné P0/P1 co narazím" — proto jsou S10/C7/C9/A8/A9 už v `main`, ne v návrhu. Jediná výjimka (C8) je vědomé rozhodnutí needitovat něco, co má zdokumentovanou, možná záměrnou funkci, bez možnosti to ověřit na hardwaru. Zbylých 15 nálezů (P2/P3) je čistá diagnostika k tvé triáži, žádný kód neměněn.
