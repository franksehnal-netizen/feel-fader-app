# Faders display-only + Control mód pryč — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fadery v appce jsou striktně jen zrcadlo HW — odstranit veškerou myší/dotykovou manipulaci faderů (a s ní i mrtvý control-mode směr); Help onboarding zachovat bez sekce Control módu.

**Architecture:** Vše v jednom souboru `feel-fader.html`. Bázujeme na `main` (kde control mód nikdy nebyl → nic se nečistí). Task 1 chirurgicky odstraní drag řetěz + jeho HTML/CSS/global-export stopy. Task 2 přenese Help obsah z větve `help-onboarding` (cherry-pick) a vypustí jednu sekci. Bez build/test frameworku → ověření headless přes puppeteer-core (system Chrome, `pipe:true`), servírováno z `http://localhost:8100`.

**Tech Stack:** Vanilla HTML/CSS/JS single-file. Node + puppeteer-core (už v `node_modules`, používáno v předchozích vlnách). Git.

## Global Constraints

- ONLY `feel-fader.html` (+ dočasné probe skripty v `scratch/`). Žádná změna protokolu/firmwaru.
- Branch `faders-display-only` (z `main`, už existuje; spec+evidence commitnuté).
- Soubor je velký (~3550 ř.) → Edit tool může selhat na „File modified since read"; edituj přes **Grep na lokaci → cílený Edit** (malé unikátní old_string), NE přes full Read.
- Fadery se smí hýbat **výhradně** z HW cest: `serial CMD_INFO → applyInfoFaders → positionThumbs` a live MIDI-in → `_faderDirty → flushFaderFrame → pF`. Tyto cesty se NESMÍ dotknout.
- Nechat beze změny: hover-link (`hoverFaderLink`), keyswitch range handles (`ksDragStart`), welcome dekorativní animace (`#welcome-track-l/r`).
- Server pro ověření běží na `http://localhost:8100/feel-fader.html` (servíruje pracovní strom). Pokud neběží: `node scratch/ff-serve.mjs` (statický server na 8100) — viz existující skript ve `scratch/` nebo scratchpadu.
- Čísla řádků v tomto plánu jsou vůči `main` (mohou se po Tasku 1 posunout — pro Task 2 lokalizuj Grepem, ne číslem).

---

## Task 1: Fadery display-only (odstranit drag)

**Files:**
- Modify: `feel-fader.html` — CSS (ř.120-121), track HTML (ř.1106, 1109), state (ř.1448), drag funkce (ř.2427-2439), global exporty (ř.3489-3490).
- Test: `scratch/faders-inert-probe.mjs` (nový headless probe).

**Interfaces:**
- Consumes: nic z jiných tasků.
- Produces: nic pro jiné tasky (Task 2 je nezávislý). Po tomto tasku `window.drag`/`window.dragT` neexistují a fadery jsou inertní k myši/dotyku.

- [ ] **Step 1: Odstranit drag-afordanci kurzoru (CSS)**

Grep `\.fader-track\{` → najdi řádek (na main ř.120):
```css
.fader-track{position:absolute;cursor:grab;user-select:none}
```
Edit na (odebrat `cursor:grab;`):
```css
.fader-track{position:absolute;user-select:none}
```
Pak Grep `\.fader-track:active` (na main ř.121) a **smaž celé pravidlo**:
```css
.fader-track:active{cursor:grabbing}
```
(pozor: nesmaž `.fader-track::before` ani `.fader-track.fader-linked::before` — ty zůstávají).

- [ ] **Step 2: Odstranit drag/touch atributy z track-l a track-r (HTML)**

Grep `id="track-l"`. Řádek na main:
```html
        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)" onmousedown="drag(event,'l')" ontouchstart="dragT(event,'l')">
```
Edit na (odebrat `onmousedown` + `ontouchstart`, zachovat hover):
```html
        <div class="fader-track" id="track-l" data-fader="fader1" onmouseenter="hoverFaderLink('fader1',true)" onmouseleave="hoverFaderLink('fader1',false)">
```
Totéž pro `id="track-r"`:
```html
        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)" onmousedown="drag(event,'r')" ontouchstart="dragT(event,'r')">
```
→
```html
        <div class="fader-track" id="track-r" data-fader="fader2" onmouseenter="hoverFaderLink('fader2',true)" onmouseleave="hoverFaderLink('fader2',false)">
```

- [ ] **Step 3: Odstranit stavovou proměnnou `dragging`**

Grep `let dragging`. Řádek na main:
```js
let dragging   = null;
```
Smaž celý tento řádek.

- [ ] **Step 4: Odstranit drag funkce (drag/dragT/onDrag/onDragT/stopDrag/mF)**

Grep `function drag(e,k)`. Smaž souvislý blok (na main ř.2427-2439) — všech 6 funkcí:
```js
function drag(e,k){e.preventDefault();dragging=k;document.addEventListener('mousemove',onDrag);document.addEventListener('mouseup',stopDrag);}
function dragT(e,k){dragging=k;document.addEventListener('touchmove',onDragT,{passive:false});document.addEventListener('touchend',stopDrag);}
function onDrag(e){if(dragging)mF(dragging,e.clientY);}
function onDragT(e){e.preventDefault();if(dragging)mF(dragging,e.touches[0].clientY);}
function stopDrag(){dragging=null;document.removeEventListener('mousemove',onDrag);document.removeEventListener('mouseup',stopDrag);document.removeEventListener('touchmove',onDragT);document.removeEventListener('touchend',stopDrag);}
function mF(k,cy){
  const tid=k==='l'?'track-l':'track-r',tr=document.getElementById(tid),rect=tr.getBoundingClientRect();
  const thH=document.getElementById(k==='l'?'thumb-l':'thumb-r').offsetHeight||24;
  const v=Math.round((1-Math.max(0,Math.min(1,(cy-rect.top-thH/2)/(rect.height-thH))))*127);
  if(k==='l'){liveValues.f1=v;pF('track-l','thumb-l',v);setTxt('f1-val',v);setBar('f1-bar',v);}
  else{liveValues.f2=v;pF('track-r','thumb-r',v);setTxt('f2-val',v);setBar('f2-bar',v);}
  if(jsonOpen)refreshJson();   // drag = jen vizualizace, nemění config (audit I5)
}
```
Ověř, že řádek bezprostředně nad blokem NENÍ komentář popisující jen drag (na main je nad tím funkce `pF`, takže komentář `// move via transform...` patří k `pF` — NECHAT). Nic jiného nemaž.

- [ ] **Step 5: Odstranit global exporty**

Grep `window.drag`. Na main (ř.3489-3490):
```js
window.drag              = drag;
window.dragT             = dragT;
```
Smaž oba tyto řádky. (Sousední `window.copyJson`, `window.onTagKeydown` NECHAT.)

- [ ] **Step 6: Napsat headless probe**

Vytvoř `scratch/faders-inert-probe.mjs`. Použij zavedený pattern (system Chrome, `pipe:true`, `createRequire`):
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8100/feel-fader.html';

const out = (label, ok, extra='') => console.log(`${ok?'PASS':'FAIL'}  ${label}${extra?'  — '+extra:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args:['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(URL, { waitUntil:'networkidle0' });

// skip welcome + render device UI
await p.evaluate(() => { try{ skipWelcome && skipWelcome(); }catch(e){}; try{ render && render(); }catch(e){}; });
await new Promise(r=>setTimeout(r,150));

// 1) window.drag / window.dragT gone
const g = await p.evaluate(() => ({ d: typeof window.drag, t: typeof window.dragT }));
out('window.drag undefined', g.d==='undefined', g.d);
out('window.dragT undefined', g.t==='undefined', g.t);

// 2) track attrs gone
const attrs = await p.evaluate(() => {
  const l=document.getElementById('track-l'), r=document.getElementById('track-r');
  return { l:l&&(l.getAttribute('onmousedown')||l.getAttribute('ontouchstart')),
           r:r&&(r.getAttribute('onmousedown')||r.getAttribute('ontouchstart')) };
});
out('track-l no drag attrs', !attrs.l, attrs.l||'clean');
out('track-r no drag attrs', !attrs.r, attrs.r||'clean');

// 3) mouse drag attempt does NOT move thumb + cfg unchanged
const mouse = await p.evaluate(() => {
  const th=document.getElementById('thumb-l');
  const before=th.style.transform;
  const cfgBefore=JSON.stringify(window.cfg);
  const tr=document.getElementById('track-l'), rect=tr.getBoundingClientRect();
  const fire=(type,y)=>tr.dispatchEvent(new MouseEvent(type,{bubbles:true,clientY:y,clientX:rect.left+5}));
  fire('mousedown',rect.top+5); fire('mousemove',rect.top+rect.height*0.5);
  document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:rect.top+rect.height*0.5}));
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return { moved: th.style.transform!==before, cfgChanged: JSON.stringify(window.cfg)!==cfgBefore };
});
out('mouse drag does NOT move thumb', !mouse.moved);
out('cfg unchanged after mouse drag', !mouse.cfgChanged);

// 4) touch drag attempt does NOT move thumb
const touch = await p.evaluate(() => {
  const th=document.getElementById('thumb-l'); const before=th.style.transform;
  const tr=document.getElementById('track-l'), rect=tr.getBoundingClientRect();
  const mk=(type,y)=>{ const t={clientY:y,clientX:rect.left+5,identifier:1,target:tr};
    return new TouchEvent(type,{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}); };
  try{ tr.dispatchEvent(mk('touchstart',rect.top+5)); document.dispatchEvent(mk('touchmove',rect.top+rect.height*0.5)); }catch(e){}
  return th.style.transform!==before;
});
out('touch drag does NOT move thumb', !touch);

// 5) HW path still moves thumbs
const hw = await p.evaluate(() => {
  const th=document.getElementById('thumb-l'); const before=th.style.transform;
  applyInfoFaders({faders:[100,20]}); positionThumbs();
  return { after: th.style.transform, moved: th.style.transform!==before };
});
out('HW path (applyInfoFaders+positionThumbs) moves thumb', hw.moved, hw.after);

out('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 7: Spustit probe**

Ujisti se, že server běží (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/feel-fader.html` → 200; pokud ne, spusť `node scratch/ff-serve.mjs` na pozadí).
Run: `node scratch/faders-inert-probe.mjs`
Expected: **všechny řádky PASS**. Zvlášť: `window.drag undefined`, `mouse drag does NOT move thumb`, `cfg unchanged`, `touch drag does NOT move thumb`, `HW path ... moves thumb`, `no page errors`.
Když něco FAIL → oprav odpovídající Step a spusť znovu.

- [ ] **Step 8: Grep čistota**

Run (v repu): `grep -nE "function mF|mF\(|dragT|onDrag|let dragging|window\.drag|controlMode|scheduleControlSend" feel-fader.html`
Expected: **žádný výskyt** (0 řádků). Pokud něco zbylo, odstraň.

- [ ] **Step 9: Commit**

```bash
git add feel-fader.html scratch/faders-inert-probe.mjs
git commit -m "feat: faders are display-only — remove mouse/touch drag (app mirrors hardware only)"
```

---

## Task 2: Help onboarding bez Control módu

**Files:**
- Modify: `feel-fader.html` — přenos Help obsahu z `help-onboarding` (#help-body, `openHelpAt`, `.help-hint` CSS, „?" ikonky) minus sekce `help-control`.

**Interfaces:**
- Consumes: nic z Tasku 1 (nezávislé).
- Produces: Help sekce `#help-roller`, `#help-macro`, `#help-keyswitch`, `#help-dev`; helper `openHelpAt(id)`; „?" ikonky u Roller a Button Macro.

- [ ] **Step 1: Cherry-pick Help commitů z `help-onboarding`**

Tyto dva commity obsahují H1 (obsah + `openHelpAt` + CSS) a H2 („?" ikonky); jsou nezávislé na control-mode kódu:
```bash
git cherry-pick b9a41e1 1273ca7
```
Když proběhne čistě → pokračuj Step 3. Když nastane **konflikt** (control-mode kontext) → Step 2.

- [ ] **Step 2: (jen při konfliktu) Vyřešit**

Konflikt bude v `feel-fader.html` v oblasti `#help-body` / CSS / section-head. Přijmi Help **přídavky** z commitu (obsah sekcí, `openHelpAt`, `.help-hint`, „?" tlačítka) nad aktuální main obsah. Control-mode kód na main neexistuje, takže žádné jeho reference nepřebírej. Po vyřešení: `git add feel-fader.html && git cherry-pick --continue`.
*Fallback (když je konflikt neúnosný):* `git cherry-pick --abort` a implementuj H1+H2 čerstvě podle `docs/superpowers/plans/2026-07-10-help-onboarding.md` (má přesné HTML), rovnou BEZ sekce `help-control`.

- [ ] **Step 3: Odstranit sekci Control módu z Helpu**

Grep `id="help-control"`. Smaž subhead + jeho odstavec (2 řádky):
```html
      <div class="settings-subhead" id="help-control">Control mode (no device)</div>
      <p style="margin:0 0 12px">With <b>no Feel Fader connected</b>, the app can act as a software MIDI controller: turn on <b>Control mode</b> (top-right; only offered without a device), pick a MIDI output port (a virtual port such as loopMIDI / IAC routed to your DAW), then drag the on-screen faders to send CC from the active bank. Connecting a device switches back to mirroring.</p>
```
(Sousední `#help-macro` a `Keyboard (HID)` subheady NECHAT.)

- [ ] **Step 4: Ověřit headless**

Vytvoř `scratch/help-trim-probe.mjs` (stejný launch pattern jako Task 1 probe):
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const r = await p.evaluate(() => {
  const ids=['help-roller','help-macro','help-keyswitch','help-dev'].map(id=>[id,!!document.getElementById(id)]);
  const control=!!document.getElementById('help-control');
  const hints=document.querySelectorAll('.help-hint').length;
  const hasOpen=typeof openHelpAt==='function';
  return {ids,control,hints,hasOpen};
});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
r.ids.forEach(([id,ok])=>P(`#${id} exists`,ok));
P('#help-control REMOVED', r.control===false);
P('.help-hint present (>=2)', r.hints>=2, String(r.hints));
P('openHelpAt is function', r.hasOpen);
// openHelpAt rozbalí Help + necrashne
const ok = await p.evaluate(()=>{ try{ openHelpAt('help-macro'); return document.getElementById('help-body').style.display!=='none'; }catch(e){ return 'ERR:'+e.message; } });
P('openHelpAt("help-macro") expands help', ok===true, String(ok));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```
Run: `node scratch/help-trim-probe.mjs`
Expected: všechny PASS — sekce existují, `#help-control` REMOVED, „?" ikonky ≥2, `openHelpAt` funguje, žádné errors.

- [ ] **Step 5: Grep kontrola**

Run: `grep -nE "help-control|Control mode \(no device\)|scheduleControlSend|controlMode" feel-fader.html`
Expected: **0 výskytů**.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/help-trim-probe.mjs
git commit -m "feat: port Help onboarding to display-only branch, drop Control mode section"
```

---

## Závěrečné ověření

- Spusť oba proby znovu (`node scratch/faders-inert-probe.mjs` + `node scratch/help-trim-probe.mjs`) → vše PASS.
- Grep celého souboru: `grep -cE "controlMode|scheduleControlSend|function mF|window\.drag|help-control" feel-fader.html` → **0**.
- Manuální smoke (Frank, nula instalací/HW): otevřít `http://localhost:8100/feel-fader.html` → zkusit táhnout fadery myší → **nehnou se**; Help rozbalit → sekce čitelné, žádná „Control mode"; „?" u Rolleru/Macra otevře Help + scroll.
- Light+dark: vzhled beze změny (kromě zmizelé grab-afordance).

## Self-review (autor plánu)

- **Spec coverage:** control mód pryč (báze main) ✓ · fadery display-only: HTML attrs (T1 S2), drag funkce (T1 S4), `dragging` (T1 S3), window exporty (T1 S5), cursor CSS (T1 S1) ✓ · HW cesty netknuté (constraint + probe HW step) ✓ · Help minus control (T2) ✓ · welcome/hover/ksDrag zachovány (constraint) ✓ · verifikace vč. Codexových mezer (window.drag undefined, touch, cfg-unchanged) → probe Task 1 ✓.
- **Placeholdery:** žádné — každý Edit má konkrétní old→new; proby mají plný kód. ✓
- **Type/název konzistence:** `applyInfoFaders({faders:[...]})` odpovídá signatuře (bere `info` s `.faders`); `positionThumbs`, `pF`, `openHelpAt` sedí s evidence. ✓
- **Riziko:** nízké (odstranění + přenos reviewnutého Help obsahu). Cherry-pick má fallback na čerstvou reimplementaci.
