# Sticky bank bar (varianta B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persistentní sticky pruh pod headerem s aktivní bankou (V2 taby: aktivní = index+ikona+název, neaktivní = index+ikona), zatímco zařízení + fadery + send dál parkují (sticky stage) — jen posazené pod novou lištu.

**Architecture:** Vše v `feel-fader.html`. Header + nová `.bank-bar` se zabalí do jednoho sticky wrapperu `top:0` (header+lišta se lepí jako celek — netřeba počítat výšku headeru). `#bank-tabs` se přesune z karty do lišty. Editovatelný název/ikona/tagy se přesune na **vršek obsahové karty**. `.stage` park se přeladí, aby seděl pod header+lištu. Smooth animace šířky aktivního tabu přes persistentní taby + class-toggle (ne rebuild innerHTML).

**Tech Stack:** Vanilla JS + CSS v jednom souboru. Bez buildu, bez test frameworku — ověření = headless puppeteer-core (proti systémovému Chrome, `pipe:true`) se scrollem + vizuál.

## Global Constraints

- ONLY `feel-fader.html`. Žádné nové soubory. Surgical.
- **Žádná změna protokolu / configu / firmwaru.**
- Zachovat: live-bank tečku (C5), scroll-fade přetečených tabů `_updateTabsFade` (S9), `scrollIntoView` aktivního tabu, T3 `bankFade`, `selectBank`, PC handler (0xC0 → bank sync), `addBank/removeBank/rename`.
- Bez test frameworku → verify = headless scroll proby + screenshoty. Reuse vzor: `require('puppeteer-core')` přes `createRequire`, `executablePath` na `C:/Program Files/Google/Chrome/Application/chrome.exe`, `headless:'new'`, `pipe:true`. Instaluj `npm i puppeteer-core --no-save` do repa, po ověření `rm -rf node_modules` (není v .gitignore).
- Reference spec: `docs/superpowers/specs/2026-07-09-sticky-bank-bar-design.md`.
- Barvy: header light `rgba(228,228,228,.93)`, dark `rgba(15,15,17,.92)`; tokeny `--border`, `--t1/2/3`, `--bg-card #fff / #1c1c1e`, dark aktivní chip `#3a3a3c`.
- Branch: `sticky-bank-bar` (už existuje, z `main`).

---

## Task 1: Sticky wrapper + prázdná bank lišta, přesun tabů

Zabalit header + novou `.bank-bar` do sticky wrapperu; přesunout `#bank-tabs` z `.bank-block` do lišty. Zatím beze změny obsahu tabů (to je Task 2) a beze změny name-area (Task 3).

**Files:** Modify `feel-fader.html` — HTML kolem `<header>` (~ř.1073-1091), `.bank-block` (~ř.1124-1128), CSS header (~ř.64) + nový blok.

**Interfaces:**
- Consumes: nic.
- Produces: `.top-sticky` (sticky wrapper), `.bank-bar` s `#bank-tabs` uvnitř. `#bank-tabs` zůstává stejné id (renderBankTabs cíl beze změny).

- [ ] **Step 1: Zabalit header + lištu do sticky wrapperu (HTML)**

Najdi `<header>` … `</header>` (~ř.1073-1091). Obal ho a přidej lištu:

```html
<div class="top-sticky">
<header>
  ... (obsah headeru beze změny) ...
</header>
<div class="bank-bar" id="bank-bar"><div class="bank-block-tabs" id="bank-tabs"></div></div>
</div>
```

Pak najdi `.bank-block` (~ř.1124-1128) a **odeber** z něj řádek s taby:

```html
<!-- PŘED -->
  <div class="bank-block">
    <div class="bank-block-tabs" id="bank-tabs"></div>
    <div class="bank-block-divider"></div>
    <div id="bank-name-area"></div>
  </div>
<!-- PO -->
  <div class="bank-block">
    <div id="bank-name-area"></div>
  </div>
```

- [ ] **Step 2: Přesunout sticky z headeru na wrapper + styl lišty (CSS)**

Najdi `header{...position:sticky;top:0;z-index:50}` (~ř.64). Odeber z něj `position:sticky;top:0;z-index:50` (ostatní — padding, bg, blur, border-bottom — nech). Přidej nový blok:

```css
.top-sticky{position:sticky;top:0;z-index:50;}
.bank-bar{
  background:rgba(228,228,228,.93);
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  border-bottom:1px solid var(--border);
  padding:6px 12px;
}
html.dark .bank-bar{background:rgba(15,15,17,.92);}
.bank-bar .bank-block-tabs{background:transparent;padding:0;}   /* lišta dodává podklad, ne strip */
```

- [ ] **Step 3: Ověřit headless (lišta pod headerem, taby v ní)**

Vytvoř probe `scratch/sbb-probe.mjs` (puppeteer-core, viewport 1000×900, skip welcome + render): načti, `skipWelcome();render()`, ověř:
- `#bank-tabs` je potomkem `.bank-bar` (`document.querySelector('.bank-bar #bank-tabs')` != null).
- Po scrollu (`window.scrollTo(0,600)`) je `.top-sticky` přilepený nahoře: `getBoundingClientRect().top` ≈ 0.
Vypiš OK/FAIL. Spusť, potvrď oba PASS.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html && git commit -m "feat: sticky bank bar shell — header+bar wrapper, tabs moved into bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: V2 taby + plynulá animace šířky

Aktivní tab = index+ikona+název; neaktivní = index+ikona. Název se při přepnutí **plynule** roztáhne/smrskne. Aby animace hrála, přepnutí aktivního tabu **nepřekresluje** taby (žádný innerHTML rebuild) — jen přehodí `active` třídu na persistentních tlačítkách.

**Files:** Modify `feel-fader.html` — `renderBankTabs` (~ř.1483-1499), tab template (~ř.1489), `selectBank` (~ř. hledej `function selectBank`), PC handler (~ř. `type===0xC0`), CSS tabů.

**Interfaces:**
- Consumes: `#bank-tabs` v liště (Task 1), `activeBank`, `liveBank`, `_ffConnected`, `cfg.banks`.
- Produces: `setActiveTab(i)` — lehké přehození `active` třídy + live tečky na persistentních tabech (bez rebuildu), pro animaci. `renderBankTabs()` = plný rebuild (struktura: add/remove/rename/load).

- [ ] **Step 1: Tab template — název jen na aktivním (renderBankTabs)**

Najdi tab template (~ř.1489). Nahraď tělo `.map` tak, aby název byl vždy v DOM, ale sbalený u neaktivních (kvůli animaci):

```js
  const tabsHtml = cfg.banks.map((b,i) => {
    const iconHtml = b.icon ? `<span class="bank-tab-ic">${b.icon}</span>` : '';
    const liveDot = (i === liveBank && _ffConnected) ? '<span class="bank-tab-live" title="Active on device"></span>' : '';
    const nm = (b.name || 'Bank '+(i+1)).replace(/"/g,'&quot;');
    return `<button class="bank-block-tab ${i===activeBank?'active':''}" onclick="selectBank(${i})"><span class="bank-tab-idx">${i+1}</span>${liveDot}${iconHtml}<span class="bank-tab-name">${nm}</span></button>`;
  }).join('');
```

(Pozn.: opravena i mojibake `<\span>` → `</span>` v `liveDot`, byla-li tam.)

- [ ] **Step 2: CSS — sbalený název u neaktivních, plynulé roztažení u aktivního**

Přidej k CSS tabů (`.bank-block-tab`):

```css
.bank-tab-name{
  display:inline-block;max-width:0;opacity:0;overflow:hidden;white-space:nowrap;
  transition:max-width .2s ease,opacity .2s ease,margin-left .2s ease;margin-left:0;
}
.bank-block-tab.active .bank-tab-name{max-width:140px;opacity:1;margin-left:5px;text-overflow:ellipsis;}
```

- [ ] **Step 3: `setActiveTab` (lehké přehození bez rebuildu)**

Přidej hned za `renderBankTabs` funkci:

```js
function setActiveTab(i){
  const el=document.getElementById('bank-tabs'); if(!el)return;
  el.querySelectorAll('.bank-block-tab').forEach((btn,idx)=>{
    btn.classList.toggle('active', idx===i);
    const dot=btn.querySelector('.bank-tab-live'); if(dot) dot.remove();
    if(idx===liveBank && _ffConnected && !btn.querySelector('.bank-tab-live')){
      const s=document.createElement('span'); s.className='bank-tab-live'; s.title='Active on device';
      btn.insertBefore(s, btn.children[1]||null);
    }
  });
  const act=el.querySelector('.bank-block-tab.active');
  if(act&&act.scrollIntoView) act.scrollIntoView({block:'nearest',inline:'nearest'});
  _updateTabsFade(el);
}
```

- [ ] **Step 4: `selectBank` a PC handler používají `setActiveTab` (animace), ne rebuild**

Najdi `function selectBank(i)` (dnes `{ activeBank = i; render(); }`). `render()` volá `renderBankTabs()` (rebuild → zabije animaci). Uprav tak, aby taby jen přehodily aktivní stav, ale zbytek (panely) se překreslil:

```js
function selectBank(i){ activeBank=i; renderPanels(); renderUacc(); runValidation(); setActiveTab(i); if(jsonOpen)refreshJson(); }
```

Najdi PC handler (`if(type===0xC0)` … dnes volá `renderBankTabs()`+`renderPanels()`+`renderUacc()`). Nahraď v něm `renderBankTabs();` za `setActiveTab(activeBank);` (po nastavení `activeBank=pc`).

- [ ] **Step 5: Ověřit headless (V2 + animace)**

Rozšiř probe: `skipWelcome();render()`, přidej 3 banky s ikonami. Ověř:
- Neaktivní taby: `.bank-tab-name` má `getComputedStyle().maxWidth === '0px'` (sbalený); aktivní: `maxWidth==='140px'`.
- Po `selectBank(1)`: `#bank-tabs` **nebyl** rebuildnut (ulož referenci na tlačítko banky 2 před přepnutím → po přepnutí je to `isConnected===true`, stejný node) → potvrzuje class-toggle, ne rebuild.
- Screenshot lišty (light+dark) — aktivní s názvem, neaktivní číslo+ikona.
Spusť, potvrď PASS + mrkni na screenshot.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html && git commit -m "feat: V2 bank tabs — name only on active, smooth width via class-toggle (no rebuild)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Editovatelný název/ikona/tagy na vršek karty

Přesunout `.bank-block-name` (icon picker + name input + remove + tagy) z `#bank-name-area` na **první dítě uvnitř `.bank-card`** (v `renderPanels`). Zrušit prázdný `.bank-block` wrapper i `#bank-name-area`. T3 `bankFade` tím zůstane na jednom prvku (celá karta vč. názvu).

**Files:** Modify `feel-fader.html` — `renderPanels` (~ř. hledej `function renderPanels`), HTML `.bank-block` (~ř.1124-1126 po Task 1), CSS `.bank-block-name.bank-anim` (~ř.185-186).

**Interfaces:**
- Consumes: `renderPanels` skládá `#bank-name-area` i `#panels-row` innerHTML.
- Produces: `#panels-row` `.bank-card` má name-row jako první sekci; `#bank-name-area` a `.bank-block` zmizí.

- [ ] **Step 1: HTML — odstranit prázdný bank-block**

Po Task 1 je `.bank-block` jen `<div class="bank-block"><div id="bank-name-area"></div></div>` (~ř.1124-1126). Smaž celý `.bank-block` blok (i `#bank-name-area`). Zůstane jen `<div class="panels-row" id="panels-row"></div>`.

- [ ] **Step 2: renderPanels — vložit name-row dovnitř karty**

V `renderPanels` najdi zápis do `bank-name-area` (`document.getElementById('bank-name-area').innerHTML = ...` s `.bank-block-name`). Ten zápis **zruš** a jeho HTML (`<div class="bank-block-name">…</div>`) vlož jako **první dítě** do `#panels-row` `.bank-card` template — hned za `<div class="bank-card${bankChanged ? ' bank-anim' : ''}">`. Zbytek `.bank-card` (sekce faderů/enkodéru/macro) beze změny. `bankChanged` gate zůstává na kartě.

- [ ] **Step 3: CSS — zrušit samostatný bank-anim na name (je teď v kartě)**

Najdi `.bank-card.bank-anim, .bank-block-name.bank-anim{animation:bankFade .14s ease-out;}` (~ř.185-186). Zjednoduš na jen kartu (name se animuje s ní jako její dítě):

```css
.bank-card.bank-anim{animation:bankFade .14s ease-out;}
```

Zkontroluj `.bank-block-name` padding (~ř. `padding:8px 14px`) sedí i jako vršek karty; případně srovnej s paddingem `.bank-section` (`11px 14px`). Uprav na `padding:11px 14px 4px` pokud vizuálně vhodnější (viz Step 5).

- [ ] **Step 4: Zkontrolovat mrtvé reference**

Grep `bank-name-area` a `bank-block-divider` v celém souboru — nesmí zůstat žádná JS/CSS reference, co by hodila chybu (kromě smazaných). `renderPanels` už nesahá na `bank-name-area`.

- [ ] **Step 5: Ověřit headless (name v kartě, T3 fade)**

Probe: `skipWelcome();render()`. Ověř:
- `.bank-card .bank-block-name` existuje (name-row je uvnitř karty), `#bank-name-area` neexistuje.
- Přepnutí banky (`selectBank`): `.bank-card` dostane `bank-anim` (fade), name-row s ním.
- Žádné page errors.
Screenshot karty (vršek s názvem + první sekce). Potvrď.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html && git commit -m "feat: bank name/icon/tags row moves to top of the content card (single card, tabs live in the bar)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Přeladit park stage pod header+lištu

`.stage` dnes parkuje pod (jen) header. Po přidání lišty musí zaparkovat **pod header+lištu** — jinak zaparkovaný send zmizí pod lištou (lišta z-50 > stage z-40). Přesně přeladit `top` + scroll-driven `animation-range` a ověřit landing měřením.

**Files:** Modify `feel-fader.html` — `.stage` + scroll-driven blok (~ř.95-124).

**Interfaces:**
- Consumes: výška `.top-sticky` (header+lišta) — změřit runtime v probe.
- Produces: přeladěné offsety stage.

- [ ] **Step 1: Změřit výšku sticky bloku (probe)**

V probe po `skipWelcome();render()`: `const H = document.querySelector('.top-sticky').getBoundingClientRect().height;` — vypiš `H` (očekávej ~header ~48 + lišta ~40 = ~88px; přesně změř).

- [ ] **Step 2: Posunout park o výšku lišty**

Dnešní hodnoty (~ř.98,122,124): `.stage{top:-348px}`, scroll-driven `.stage{top:-408px; animation-range:457px 640px}`, `@keyframes stageSettle{...translateY(60px)}`. Lišta přidala výšku `Δ` = (nová `.top-sticky` H) − (stará header H ~48). Posuň park o `Δ` níž = `top` **zvětšit o Δ** (méně záporné) a `animation-range` posunout o `Δ`:

```css
/* Δ = výška lišty (~40px); dosaď změřenou hodnotu z kroku 1 */
.stage{ ... top:calc(-348px + 40px); ... }   /* = -308px */
@supports (animation-timeline: scroll()) {
  .stage{top:calc(-408px + 40px); animation:stageSettle ease-out both; animation-timeline:scroll(root); animation-range:497px 680px;}
}
```

(Konkrétní px dolaď v kroku 3 podle měření — cíl: zaparkovaný send lícuje těsně pod spodní hranou lišty.)

- [ ] **Step 3: Ověřit landing headless (0 gap, 0 překryv)**

Probe: viewport 1000×900, `skipWelcome();render();layoutFaders()`, `window.scrollTo(0,1200)` (za landing), počkej 2 rAF. Změř:
- `barBottom = .top-sticky.getBoundingClientRect().bottom`
- `sendTop = .send-btn.getBoundingClientRect().top`
- Cíl: `sendTop >= barBottom` (žádný překryv) a `sendTop - barBottom` malé (např. < 24px, žádná velká mezera).
Když nesedí, uprav px v kroku 2 a opakuj (measure→adjust→verify loop). Ověř na 2 výškách viewportu (900, 700). Screenshot zaparkovaného stavu.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html && git commit -m "fix: re-tune stage park to land just below the header+bank-bar (no overlap/gap)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Mobilní pojistka

Na úzké obrazovce tři sticky patra ukusují výšku — park zkompaktnit/vypnout, ať layout nekolabuje.

**Files:** Modify `feel-fader.html` — mobilní `@media` blok (~ř.377-392 oblast).

**Interfaces:** Consumes: `.stage`, `.top-sticky`. Produces: mobilní override.

- [ ] **Step 1: Media-query — vypnout park na úzké obrazovce**

V mobilním `@media (max-width: …)` bloku (najdi existující s `.center-col{...gap:12px}`) přidej: stage neparkuje (odscrolluje), lišta zůstává sticky:

```css
  .stage{position:static;top:auto;animation:none;}
```

(Tím se mobil chová jako C — jen header+lišta sticky, zařízení odscrolluje.)

- [ ] **Step 2: Ověřit headless (úzký viewport)**

Probe: viewport 390×780 (mobil), `skipWelcome();render();layoutFaders()`, scroll 1200. Ověř: `.top-sticky` přilepený nahoře (`top≈0`), `.stage` **odscrollovala** (`.stage.getBoundingClientRect().bottom < 0` nebo mimo horní zónu — neparkuje). Žádný překryv lišty a obsahu. Screenshot.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html && git commit -m "feat: mobile fallback — stage does not park on narrow screens (bank bar stays sticky)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Závěrečné ověření (po všech taskech)

- Desktop headless (1000×900): scroll → header+lišta přilepené, aktivní banka s názvem viditelná; stage zaparkovaná těsně pod lištou (fadery + send vidět, tahatelné — live CC flood přes `onMidiMsg` hýbe fadery i po scrollu).
- Přepnutí banky (klik + simulovaný PC 0xC0): aktivní tab plynule roztáhne název, žádný jump; live tečka a scroll-fade fungují; karta+name prolne (T3).
- Light + dark vizuál lišty; mobil (390px) nekolabuje.
- Regrese: send/dirty hint funguje, sync banner nad vším (z-250), theme cross-fade a ghost fixy beze změny.
- **HW pass** (s Frankem, na zařízení): tlačítko přepíná banku → lišta ukáže správnou aktivní; fadery/park OK při scrollu.

## Self-review (autor plánu)

- **Spec coverage:** V2 taby → T2; lišta sticky pod headerem → T1; taby ven z karty + name na vršek karty → T1/T3; park přeladěn → T4; mobil pojistka → T5; live-dot/scroll-fade/scrollIntoView/T3 zachovány → T2/T3. ✓
- **Placeholdery:** stage px v T4 jsou záměrně measure→adjust (empirický landing, ověřený probem) — ne TBD, je to definovaný postup. ✓
- **Konzistence:** `setActiveTab` def v T2 Step 3, volán v T2 Step 4 (selectBank, PC handler); `#bank-tabs` cíl stejný napříč; `bankChanged` gate zůstává v T3. ✓
- **Riziko:** T4 (scroll landing) je nejcitlivější → dedikovaný measure/verify loop + 2 výšky viewportu.
