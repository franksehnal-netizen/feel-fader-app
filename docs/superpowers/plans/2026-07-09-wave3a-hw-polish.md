# Vlna 3a — HW polish T1–T4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Odstranit čtyři HW-ověřené polish nálezy (T1–T4) ve Feel Fader web appce: přestylovat bank taby (varianta C), sjednotit přechod při přepnutí banky a odstranit sekání při pohybu obou faderů.

**Architecture:** Vše v jednom souboru `feel-fader.html` (single-file app). T1/T2 = čistě CSS. T3 = CSS keyframe + jedna třída navíc v `renderPanels()`. T4 = rAF batching v `onMidiMsg` CC cestě + cache geometrie faderu v `layoutFaders()`. Žádná změna protokolu → firmware se netýká.

**Tech Stack:** Vanilla JS + CSS v `feel-fader.html`. Web MIDI (`onMidiMsg`), Web Serial. Bez build stepu, bez test frameworku — ověření = načtení souboru v prohlížeči (`file://` nebo lokální server) + HW test na zařízení.

## Global Constraints

- **Jeden soubor:** všechny změny v `c:/Users/Fanda Borec/Documents/feel-fader-app/feel-fader.html`. Žádné nové soubory.
- **Žádná změna protokolu / formátu configu / `enc7`/`dec7`.** Pokud by task vedl k dotyku protokolu → STOP, není v rozsahu.
- **Surgical:** každý změněný řádek stopovatelný k T1–T4. Žádný nesouvisející refaktor.
- **Bez test frameworku:** ověření je manuální browser smoke + HW test. Kroky „ověř" popisují, co v prohlížeči/na zařízení pozorovat.
- **Barvy = tokeny appky** kde existují: light `--bg:#f5f5f7 --bg-card:#fff --bg-input:#f0f0f2 --t1:#1d1d1f --t2:#6e6e73 --t3:#aeaeb2`, dark `--bg:#0f0f11 --bg-card:#1c1c1e --bg-input:#2c2c2e --t1:#f5f5f7 --t2:#aeaeb2 --t3:#8e8e93`. Výjimka: dark aktivní chip `#3a3a3c` (lifted, viz schválený mockup C).
- **Referenční mockup** schválené varianty C: `.superpowers/brainstorm/*/content/bank-tabs.html` (karta „C — plochý chip").
- **Commit po každém tasku.** Branch: `wave3a-hw-polish` (už existuje, design doc je na ní).

---

## Task 1: T1 + T2 — bank taby (varianta C, plochý chip)

Čistě CSS. Aktivní tab = plochý světlý chip (plné zaoblení, bez stínu), **žádné podtržení**. Neaktivní = jen šedý text. Reprodukuje schválený mockup C.

**Files:**
- Modify: `feel-fader.html` — CSS blok bank tabů (~ř. 951–982), dark overrides (~ř. 1033–1035)

**Interfaces:**
- Consumes: nic (samostatné)
- Produces: nic (jiné tasky na tom nezávisí)

- [ ] **Step 1: Přestylovat neaktivní tab na plný chip radius**

V `feel-fader.html` najdi `.bank-block-tab{` (~ř. 951). Změň `border-radius`:

```css
/* PŘED */
  border-radius:var(--r-sm) var(--r-sm) 0 0;
/* PO */
  border-radius:var(--r-sm);
```

- [ ] **Step 2: Aktivní tab = plochý chip bez podtržení**

Najdi `.bank-block-tab.active{` (~ř. 969). Nahraď celé pravidlo `.bank-block-tab.active{…}` A následující `.bank-block-tab.active::after{…}` (~ř. 969–982) tímto (podtržení `::after` se **maže celé**):

```css
.bank-block-tab.active{
  color:var(--t1);
  font-weight:600;
  background:var(--bg-input);
  border-radius:var(--r-sm);
}
```

- [ ] **Step 3: Dark override — aktivní chip lifted, smazat dark podtržení**

Najdi `html.dark .bank-block-tab.active{background:var(--bg-input);color:var(--t1);}` a hned pod ním `html.dark .bank-block-tab.active::after{background:var(--t1);}` (~ř. 1034–1035). Nahraď oba řádky jedním (dark `::after` se **maže**):

```css
html.dark .bank-block-tab.active{background:#3a3a3c;color:var(--t1);}
```

- [ ] **Step 4: Ověř v prohlížeči (light + dark)**

Otevři `feel-fader.html` v prohlížeči (Chrome). Přidej 2–3 banky (tlačítko „+" v tabech). Pozoruj:
- Aktivní tab: světlý plochý chip s plným zaoblením, **žádná černá/bílá linka pod ním**.
- Neaktivní taby: jen šedý text, bez pozadí.
- Přepni téma (ikona slunce/měsíc) → v dark je aktivní chip viditelně světlejší než karta, neaktivní šedé.

Porovnej s kartou „C — plochý chip" v mockupu (`.superpowers/brainstorm/*/content/bank-tabs.html`). Musí sedět.

Pozn.: pokud Frank bude chtít aktivní v **light** ještě „bělejší", je to jednořádková iterace — prohodit v `.bank-block-tab.active` `background:var(--bg-input)` → `var(--bg-card)` a stripu `.bank-block-tabs` dát `background:var(--bg-input)`. Needělej teď, jen pokud to vyžádá.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "style: bank tabs variant C — flat chip active, no underline (T1/T2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: T3 — seamless přepnutí banky (jednotný 140ms opacity fade)

Hlavička banky (`.bank-block-name`) i karta (`.bank-card`) se dnes překreslují v různém rytmu: hlavička okamžitě bez animace, karta s `fadeSlideIn .22s` (opacity **+ translateY**). Sjednotit na jeden krátký **opacity-only** fade, spuštěný na obou zároveň. Obě jsou fresh elementy vytvořené `innerHTML` v `renderPanels()` → stačí jim dát stejnou anim třídu, animace se přehrají synchronně bez reflow hacků.

**Files:**
- Modify: `feel-fader.html` — keyframe/anim CSS (~ř. 177–181), `renderPanels()` (~ř. 1513–1539)

**Interfaces:**
- Consumes: nic
- Produces: nic

- [ ] **Step 1: Přidat opacity-only keyframe a přepnout `.bank-card.bank-anim` na něj**

V `feel-fader.html` najdi (~ř. 177–181):

```css
@keyframes fadeSlideIn{
  from{opacity:0;transform:translateY(6px)}
  to{opacity:1;transform:translateY(0)}
}
.bank-card.bank-anim{animation:fadeSlideIn .22s ease-out;}   /* fade jen při změně banky, ne při každém renderu */
```

Nahraď to tímto (`fadeSlideIn` **ponech** — používá se i jinde na ř. 189; jen přidej nový keyframe a předěl `.bank-card.bank-anim` + přidej pravidlo pro `.bank-block-name.bank-anim`):

```css
@keyframes fadeSlideIn{
  from{opacity:0;transform:translateY(6px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes bankFade{
  from{opacity:0}
  to{opacity:1}
}
.bank-card.bank-anim,
.bank-block-name.bank-anim{animation:bankFade .14s ease-out;}   /* T3: jednotný opacity fade hlavičky i karty, bez posunu */
```

- [ ] **Step 2: Dát `.bank-block-name` stejnou anim třídu při změně banky**

V `renderPanels()` najdi řádek generující hlavičku (~ř. 1514):

```html
    <div class="bank-block-name">
```

Změň na (přidání `bank-anim` při `bankChanged`, stejně jako karta na ~ř. 1539):

```html
    <div class="bank-block-name${bankChanged ? ' bank-anim' : ''}">
```

`bankChanged` je už v `renderPanels()` spočítané výš (~ř. 1491) a platí pro celý běh funkce.

- [ ] **Step 3: Ověř v prohlížeči**

Otevři `feel-fader.html`, přidej ≥2 banky, přepínej mezi nimi kliknutím na taby. Pozoruj:
- Celý blok (hlavička s názvem/ikonou/tagy **i** karta se sekcemi) prolne **jako jeden celek** — nic neskočí dřív než zbytek.
- Přechod je jemný, obsah se **neposouvá** (žádný translateY „naskočení zdola").
- Klik na **tentýž** tab / editace v rámci banky nespouští fade znovu (jen reálná změna banky).

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "fix: unified 140ms opacity fade on bank switch — header+card together, no translateY (T3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: T4 — dual-fader jank (rAF batching + cache geometrie)

Dnes CC handler volá `pF()` per zprávu → čte `offsetHeight` (vynucený reflow) + zapisuje `style.top`, ~250×/s pro dva fadery = layout thrashing. Fix: CC handler jen uloží poslední hodnotu a naplánuje jednu `requestAnimationFrame`; ta aplikuje pozici max ~60×/s z **cachované** geometrie (žádný `offsetHeight` per zpráva).

**Files:**
- Modify: `feel-fader.html` — stavové proměnné faderu (~ř. 1429–1431), `layoutFaders()` (~ř. 2347–2359), `pF()`/`positionThumbs()` (~ř. 2362–2367), `onMidiMsg` CC větev (~ř. 2489–2493)

**Interfaces:**
- Consumes: `liveValues` (`{f1,f2}`, ~ř. 1431), `layoutFaders()` výpočet `tH` (track px výška) a `th` (thumb px výška) (~ř. 2349–2350)
- Produces:
  - `let _faderTravel = 0;` — cachovaná dráha thumbu v px (`trackH - thumbH`), společná pro oba fadery (stejná geometrie). Nastavena v `layoutFaders()`.
  - `function scheduleFaderFrame()` — naplánuje jednu rAF, pokud ještě není naplánovaná.
  - `function flushFaderFrame()` — aplikuje dirty fadery (pozice + hodnota) a vyčistí flagy.

- [ ] **Step 1: Přidat stavové proměnné pro batching a cache**

Najdi (~ř. 1429–1431):

```javascript
let activeBank = 0;
let liveBank   = 0;
let liveValues = { f1:64, f2:64 };
```

Přidej hned pod ně:

```javascript
let _faderTravel   = 0;                 // T4: cachovaná dráha thumbu (px) = trackH - thumbH
let _faderDirty    = { l:false, r:false };
let _faderRafPending = false;
```

- [ ] **Step 2: Cachovat dráhu v `layoutFaders()`**

Najdi v `layoutFaders()` (~ř. 2349–2353):

```javascript
  const tw=Math.round(W*FTW),th=Math.round(tw*1.506);
  const tH=Math.round((FBY-FTY)*H),tT=Math.round(FTY*H);
  stT('track-l',Math.round(FLX*W-tw/2),tT,tw,tH);
  stT('track-r',Math.round(FRX*W-tw/2),tT,tw,tH);
  stTh('thumb-l',tw,th);stTh('thumb-r',tw,th);
```

Přidej za `stTh(...)` řádek (uvnitr `layoutFaders`, `tH`/`th` jsou tu dostupné):

```javascript
  _faderTravel = tH - th;   // T4: dráha thumbu se mění jen s layoutem, ne per CC zpráva
```

- [ ] **Step 3: Přepsat `pF()` na cache s fallbackem**

Najdi `pF()` (~ř. 2363–2367):

```javascript
function pF(tid,thid,v){
  const tr=document.getElementById(tid),th=document.getElementById(thid);
  if(!tr||!th)return;
  th.style.top=Math.round((1-v/127)*(tr.offsetHeight-(th.offsetHeight||24)))+'px';
}
```

Nahraď:

```javascript
function pF(tid,thid,v){
  const th=document.getElementById(thid);
  if(!th)return;
  // T4: použij cachovanou dráhu; fallback na měření jen když ještě nebyl layout
  let travel=_faderTravel;
  if(travel<=0){
    const tr=document.getElementById(tid);
    if(!tr)return;
    travel=tr.offsetHeight-(th.offsetHeight||24);
  }
  th.style.top=Math.round((1-v/127)*travel)+'px';
}
```

Pozn.: `positionThumbs()` (~ř. 2362) a drag `mF()` (~ř. 2373) volají `pF()` dál beze změny — jen teď čtou z cache.

- [ ] **Step 4: Přidat rAF plánovač a flush**

Přidej hned za `positionThumbs()` (~ř. 2362, před `function pF`):

```javascript
function scheduleFaderFrame(){
  if(_faderRafPending)return;
  _faderRafPending=true;
  requestAnimationFrame(flushFaderFrame);
}
function flushFaderFrame(){
  _faderRafPending=false;
  if(_faderDirty.l){ _faderDirty.l=false; pF('track-l','thumb-l',liveValues.f1); setTxt('f1-val',liveValues.f1); liveOn('f1-val'); }
  if(_faderDirty.r){ _faderDirty.r=false; pF('track-r','thumb-r',liveValues.f2); setTxt('f2-val',liveValues.f2); liveOn('f2-val'); }
}
```

- [ ] **Step 5: CC handler jen ukládá hodnotu + plánuje frame**

Najdi v `onMidiMsg` (~ř. 2489–2493):

```javascript
    if(cc===bank.fader1.cc && ch===bank.fader1.channel){
      liveValues.f1=val;pF('track-l','thumb-l',val);setTxt('f1-val',val);liveOn('f1-val');setBar('f1-bar',val);
    }
    if(cc===bank.fader2.cc && ch===bank.fader2.channel){
      liveValues.f2=val;pF('track-r','thumb-r',val);setTxt('f2-val',val);liveOn('f2-val');setBar('f2-bar',val);
    }
```

Nahraď (přímé DOM zápisy → uložit hodnotu + mark dirty + naplánovat rAF; `setBar` byl no-op, zahazuje se):

```javascript
    if(cc===bank.fader1.cc && ch===bank.fader1.channel){
      liveValues.f1=val;_faderDirty.l=true;scheduleFaderFrame();
    }
    if(cc===bank.fader2.cc && ch===bank.fader2.channel){
      liveValues.f2=val;_faderDirty.r=true;scheduleFaderFrame();
    }
```

- [ ] **Step 6: Lokální smoke — simulace CC záplavy z konzole**

Otevři `feel-fader.html` v Chrome, otevři DevTools konzoli. `onMidiMsg` čte `event.data`, takže jde volat přímo. Zjisti CC/kanál aktivní banky:

```javascript
const b = cfg.banks[liveBank];
console.log('f1', b.fader1.cc, b.fader1.channel, 'f2', b.fader2.cc, b.fader2.channel);
```

Zaplav oba fadery 500 zprávami (nahraď `CC1/CH1/CC2/CH2` vypsanými hodnotami):

```javascript
for(let i=0;i<500;i++){
  const v=Math.round((Math.sin(i/12)*0.5+0.5)*127);
  onMidiMsg({data:[0xB0|CH1, CC1, v]});
  onMidiMsg({data:[0xB0|CH2, CC2, (127-v)]});
}
```

Ověř:
- Žádná chyba v konzoli.
- Oba thumby skončí na poslední poslané hodnotě (f1 ≈ hodnota pro i=499, f2 ≈ její inverze) — batching bere vždy poslední hodnotu.
- `_faderRafPending` po chvíli zpět `false` (smyčka se sama zastaví): `console.log(_faderRafPending)` → `false`.
- Drag faderů myší dál funguje (pozice sedí).

- [ ] **Step 7: Commit**

```bash
git add feel-fader.html
git commit -m "perf: rAF-batch live fader updates + cache thumb travel — kills 250Hz layout thrash (T4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## HW test (po všech taskech, na fyzickém zařízení)

Nutné před označením Vlny 3a za hotovou (viz spec Kritérium úspěchu). Postup připojení: `../feel-fader-firmware/CLAUDE.md`. POZOR: konfig přes Web Serial, **nikdy SysEx přes MIDI out** (zasekne endpoint — HW nález 2026-07-07).

1. **T4:** hýbej oběma fadery naráz → pohyb v appce plynulý, bez sekání.
2. **T3:** přepni banku tlačítkem na zařízení (Program Change) i kliknutím v appce → hlavička i karta prolnou jako jeden celek.
3. **T1/T2:** vizuální kontrola tabů v light i dark.

Windows MIDI pozn.: po DEV↔PROD bootu může WinMM ztratit MIDI port → reboot PC (memory `project_feelfader_windows_midi_reboot`). Serial funguje vždy.

---

## Self-review (autor plánu)

- **Spec coverage:** T1/T2 → Task 1; T3 → Task 2; T4 → Task 3; HW test → sekce HW test. Kritérium úspěchu pokryto. ✓
- **Placeholdery:** žádné TBD/„handle edge cases" — všechny kroky mají konkrétní kód/příkazy. ✓
- **Konzistence typů:** `_faderTravel` (Task 3 Step 1) použit v `pF` (Step 3) a nastaven v `layoutFaders` (Step 2); `_faderDirty`/`_faderRafPending` definované v Step 1, čtené v Step 4/5; `scheduleFaderFrame`/`flushFaderFrame` definované v Step 4, volané v Step 5. `bankChanged` existuje v `renderPanels` před ř. 1514 i 1539. ✓
