# UI vlna 1 — sekce, rename input, jeden signál chyby — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Odstranit akordeon sekcí, zúžit inline rename input na šířku textu a nahradit čtyři souběžné signály validační chyby jedním.

**Architecture:** Tři nezávislé změny v jediném souboru `feel-fader.html` (build-free single-file appka). Stav otevřených sekcí přechází z `Map<bankIndex, key>` na jeden sdílený `Set<key>`. Validační signalizace se stahuje z globálního banneru na inline hlášku u pole plus tečkové markery v hlavičce sekce a na tabu banky. Každá změna má vlastní Puppeteer regresní probe.

**Tech Stack:** Vanilla JS + CSS v jednom HTML souboru, bez build stepu. Testy: `puppeteer-core` probes v `scratch/`, spouštěné přes `npm test`.

**Spec:** `docs/superpowers/specs/2026-08-08-ui-backlog-design.md`, sekce A, B, C.

## Global Constraints

- **Veškeré změny appky jdou výhradně do `feel-fader.html`.** Je to jediný zdroj pravdy — obsahuje inline `<style>` i `<script>` a neodkazuje na žádný externí JS/CSS.
- **`app.js`, `styles.css` a `assets/` v pracovní kopii NEUPRAVOVAT, NECOMMITOVAT ani NEMAZAT.** Jsou to necommitnuté zbytky Codexova refaktoru, zastaralé o commit `767eaf4`. Jsou mimo rozsah této vlny.
- **Odkazy typu `app.js:1872` / `styles.css:840` jsou jen navigační pomůcka.** Identický text žije v inline `<script>` / `<style>` bloku `feel-fader.html`; hledej ho tam podle citovaného řetězce, ne podle čísla řádku.
- **Nikdy `git add -A` ani `git add .`.** Pracovní strom obsahuje nesouvisející necommitnuté změny (`AGENTS.md`, `CLAUDE.md`, `WEBAPP.md`, `app.js`, `styles.css`, `assets/`, `.mcp.json`, `.ignore`, `scratch/mobile-ux-probe.mjs`, `scratch/audit/*`). Vždy `git add` s konkrétními cestami.
- **Branch:** `ui-backlog-2026-08` (už existuje, je na něm commitnutý spec).
- **Cílový prohlížeč je Chrome/Edge desktop.** Appka bez Web Serial nedává smysl (viz `CLAUDE.md` — „desktop-first"). `field-sizing:content` (Chrome 123+) je proto povolený bez fallbacku.
- **Mobil držet jen nerozbitý, neoptimalizovat** (`CLAUDE.md`).
- **Probe harness:** server běží na `http://localhost:8100/feel-fader.html`, spouští ho `scratch/run-all-probes.mjs`. Chrome binárka: `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- **Nový probe musí být zaregistrovaný v poli `PROBES` v `scratch/run-all-probes.mjs`**, jinak ho runner odmítne s „Unknown probe(s)".
- Komentáře v kódu piš jazykem bezprostředního okolí (soubor míchá češtinu a angličtinu podle stáří bloku).

---

### Task 0: Commitnout probe runner, na kterém stojí zbytek plánu

`scratch/run-all-probes.mjs` je v pracovní kopii upravený a ta úprava je **nutná** pro celý plán: přidává selektivní běh (`npm test -- <probe>`, jinak runner spustí celou sadu) a správné `Content-Type` hlavičky. Bez ní nejde spustit jediný probe samostatně. Zbytek Codexových necommitnutých změn zůstává nedotčený.

**Files:**
- Modify: `scratch/run-all-probes.mjs` (už upravený v pracovní kopii, jen ho commitnout)

**Interfaces:**
- Consumes: nic
- Produces: `npm test -- <probe-name.mjs>` spustí jediný probe; `npm test` spustí celou sadu

- [ ] **Step 1: Ověřit, že selektivní běh funguje**

Run: `npm test -- vbar-aria-live-probe.mjs`
Expected: proběhne **jen** tento probe, všechny jeho řádky `PASS`, exit 0.

- [ ] **Step 2: Ověřit, že celá sada je zelená před jakoukoliv změnou**

Run: `npm test`
Expected: exit 0, žádný `FAIL`. Toto je baseline — když už tady něco padá, zastav se a nahlas to, neopravuj to v rámci této vlny.

- [ ] **Step 3: Commit**

```bash
git add scratch/run-all-probes.mjs
git commit -m "test(harness): selektivni beh probes + spravne Content-Type hlavicky

Prerekvizita pro UI vlnu 1 — bez toho nejde spustit jediny probe
samostatne (npm test -- <probe>). Zbytek pracovni kopie zustava
necommitnuty (Codexuv refaktor, mimo rozsah)."
```

---

### Task A: Sekce togglují nezávisle a stav přežije přepnutí banky

**Files:**
- Modify: `feel-fader.html` — inline `<script>`, blok `const _openBankSections` (odpovídá `app.js:60–68`) + 14 call sites + `focusValidationError` (`app.js:1816`)
- Create: `scratch/sections-independent-probe.mjs`
- Modify: `scratch/run-all-probes.mjs` (registrace probe)

**Interfaces:**
- Consumes: `renderPanels()`, `runValidation()`, `selectBank(i)`, `activeBank` (globální, existující)
- Produces:
  - `isSectionOpen(key: string) -> boolean`
  - `toggleSection(key: string) -> void`
  - `const _openSections: Set<string>` — klíče `'fader1' | 'fader2' | 'roller' | 'macro'`
  - Zaniká: `openBankSection(bi)`, `isBankSectionOpen(bi,key)`, `toggleBankSection(bi,key)`, `_openBankSections`

- [ ] **Step 1: Napsat padající probe**

Create `scratch/sections-independent-probe.mjs`:

```js
// Regression probe: control sections toggle independently (no accordion) and
// their open/closed state is shared across banks, not stored per bank
// (Frank, HW test 2026-08-08 — spec 2026-08-08-ui-backlog-design.md §A).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const initial = await p.evaluate(() => ['fader1','fader2','roller','macro'].filter(k => isSectionOpen(k)));
P('all sections closed on first load', initial.length === 0, initial.join(',') || '(none)');

await p.evaluate(() => { toggleSection('fader1'); toggleSection('fader2'); });
const both = await p.evaluate(() => ['fader1','fader2'].every(k => isSectionOpen(k)));
P('opening a second section does not close the first', both, String(both));

await p.evaluate(() => { selectBank(1); });
await new Promise(r => setTimeout(r, 200));
const afterSwitch = await p.evaluate(() => ({
  state: ['fader1','fader2'].every(k => isSectionOpen(k)),
  dom:   !document.getElementById('section-body-1-fader2')?.hasAttribute('hidden'),
}));
P('open state survives a bank switch (state)', afterSwitch.state, String(afterSwitch.state));
P('open state survives a bank switch (DOM)',   afterSwitch.dom,   String(afterSwitch.dom));

await p.evaluate(() => { toggleSection('fader1'); });
const closedOne = await p.evaluate(() => !isSectionOpen('fader1') && isSectionOpen('fader2'));
P('clicking an open section closes only itself', closedOne, String(closedOne));

const noLegacy = await p.evaluate(() => typeof window.isBankSectionOpen === 'undefined' && typeof window.toggleBankSection === 'undefined');
P('legacy per-bank helpers are gone', noLegacy, String(noLegacy));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Zaregistrovat probe v runneru**

V `scratch/run-all-probes.mjs` přidej do pole `PROBES` **před** řádek `'audit/p1-xss-config-import.mjs',`:

```js
  'sections-independent-probe.mjs',
```

- [ ] **Step 3: Spustit probe a ověřit, že padá**

Run: `npm test -- sections-independent-probe.mjs`
Expected: FAIL. Konkrétně `no page errors` selže s `ReferenceError: isSectionOpen is not defined`, protože funkce zatím neexistuje.

- [ ] **Step 4: Přepsat blok stavu sekcí**

V `feel-fader.html` najdi tento blok a nahraď ho celý:

```js
const _openBankSections = new Map();
function openBankSection(bi) { return _openBankSections.has(bi) ? _openBankSections.get(bi) : 'fader1'; }
function isBankSectionOpen(bi, key) { return openBankSection(bi) === key; }
function toggleBankSection(bi, key) {
  _openBankSections.set(bi, isBankSectionOpen(bi,key) ? null : key);
  renderPanels();
  runValidation();
  requestAnimationFrame(() => document.getElementById(`section-toggle-${bi}-${key}`)?.focus());
}
```

za:

```js
// Otevřené sekce jsou JEDEN sdílený Set klíčů, ne mapa per banka: sekce
// togglují nezávisle (žádný akordeon) a stav zůstává stejný i po přepnutí
// banky — patří sekci, ne bance (Frank, HW test 2026-08-08). Výchozí stav
// je "všechno zavřené"; stav se záměrně nepersistuje do localStorage.
const _openSections = new Set();
function isSectionOpen(key) { return _openSections.has(key); }
function toggleSection(key) {
  if (_openSections.has(key)) _openSections.delete(key); else _openSections.add(key);
  renderPanels();
  runValidation();
  requestAnimationFrame(() => document.getElementById(`section-toggle-${activeBank}-${key}`)?.focus());
}
```

- [ ] **Step 5: Přepsat všechny call sites jedním skriptem**

Každý existující call site předává `bi` jako první argument doslova, takže dvě přesné náhrady pokryjí všech 14. Spusť z kořene repa:

```bash
node -e "
const fs=require('fs');
const f='feel-fader.html';
let s=fs.readFileSync(f,'utf8');
const a=(s.match(/isBankSectionOpen\(bi\s*,\s*/g)||[]).length;
const b=(s.match(/toggleBankSection\(\\\$\{bi\},/g)||[]).length;
s=s.replace(/isBankSectionOpen\(bi\s*,\s*/g,'isSectionOpen(');
s=s.replace(/toggleBankSection\(\\\$\{bi\},/g,'toggleSection(');
fs.writeFileSync(f,s);
console.log('isBankSectionOpen call sites replaced:',a);
console.log('toggleBankSection call sites replaced:',b);
console.log('leftover isBankSectionOpen:',(s.match(/isBankSectionOpen/g)||[]).length);
console.log('leftover toggleBankSection:',(s.match(/toggleBankSection/g)||[]).length);
"
```

Expected výstup: `isBankSectionOpen call sites replaced: 7`, `toggleBankSection call sites replaced: 3`, oba `leftover` **0**.

Pokud některý `leftover` není 0, najdi zbylé výskyty přes `rg -n "isBankSectionOpen|toggleBankSection" feel-fader.html` a oprav je ručně — nepokračuj dál.

- [ ] **Step 6: Opravit `focusValidationError`, aby stav přidával, ne přepisoval**

Najdi v `feel-fader.html`:

```js
  _openBankSections.set(bi, section);
  selectBank(bi);
```

a nahraď za:

```js
  _openSections.add(section);   // add, ne set — skok na chybu nesmí zavřít ostatní sekce (zpět akordeon)
  selectBank(bi);
```

- [ ] **Step 7: Spustit probe a ověřit, že prochází**

Run: `npm test -- sections-independent-probe.mjs`
Expected: všech 7 řádků `PASS`, exit 0.

- [ ] **Step 8: Ověřit netknuté sousedy**

Run: `npm test`
Expected: exit 0. Zvláštní pozornost `c10-bank-switch-preserves-edit-probe.mjs` a `v4-ks-preset-listbox-probe.mjs` — druhý jede přes roller sekci, která je nově po startu zavřená.

Pokud `v4-ks-preset-listbox-probe.mjs` selže proto, že jeho krok počítal s otevřenou roller sekcí, **oprav probe** (přidej `toggleSection('roller')` po `skipWelcome()`), ne produkční kód — výchozí „všechno zavřené" je záměr ze spec.

- [ ] **Step 9: Ruční kontrola dvou návazností, které spec označil za neověřené**

Otevři `http://localhost:8100/feel-fader.html` v Chrome (`npx http-server -p 8100` nebo jiný statický server), klikni `skipWelcome` přes DevTools konzoli a ověř očima:
1. Otevři všechny čtyři sekce naráz — nalepené hlavičky (`updateStickySectionHeads()`) se nepřekrývají a nedělají nesmysly.
2. Přepni roller na `Keyswitch` s otevřenou roller sekcí — rozsahový slider (`ksRevealRange`) se pořád vykreslí.

Když některá z těch dvou věcí nefunguje, oprav ji teď a přidej ke commitu; jinak pokračuj.

- [ ] **Step 10: Commit**

```bash
git add feel-fader.html scratch/sections-independent-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(ui): sekce toggluji nezavisle a stav prezije prepnuti banky

Map<bankIndex,key> -> jeden sdileny Set<key>. Rozbaleni sekce uz
nesbali predchozi a stav patri sekci, ne bance. Vychozi stav je
vsechno zavrene. focusValidationError() stav pridava (add), ne
prepisuje — jinak by skok na chybu zavedl akordeon zadnimi vratky."
```

---

### Task B: Inline rename input má šířku svého textu

**Files:**
- Modify: `feel-fader.html` — inline `<style>`, pravidlo `.fader-title-input` (odpovídá `styles.css:1398`)
- Create: `scratch/fader-name-input-width-probe.mjs`
- Modify: `scratch/run-all-probes.mjs` (registrace probe)

**Interfaces:**
- Consumes: `isSectionOpen(key)` z Tasku A (probe otevírá sekci); existující `#section-title-0-fader1` input a jeho `.section-head` rodič
- Produces: nic pro další tasky (čistě prezentační změna)

- [ ] **Step 1: Napsat padající probe**

Create `scratch/fader-name-input-width-probe.mjs`:

```js
// Regression probe: the inline fader-name input is sized to its own text, so
// the empty space to the right of the name belongs to the section header
// (= expands the section) instead of starting a rename. Frank, HW test
// 2026-08-08 — spec 2026-08-08-ui-backlog-design.md §B.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const m = await p.evaluate(() => {
  const inp = document.getElementById('section-title-0-fader1');
  const cs  = getComputedStyle(inp);
  const span = document.createElement('span');
  span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
  span.textContent = inp.value;
  document.body.appendChild(span);
  const textW = span.getBoundingClientRect().width;
  span.remove();
  const r = inp.getBoundingClientRect();
  const head = inp.closest('.section-head').getBoundingClientRect();
  return { value: inp.value, inputW: r.width, textW, right: r.right, midY: r.top + r.height/2, headRight: head.right };
});

P('input is sized to its text (<= text + 24px)', m.inputW <= m.textW + 24,
  `"${m.value}" input ${m.inputW.toFixed(1)}px vs text ${m.textW.toFixed(1)}px`);
P('input leaves free header space to its right', m.headRight - m.right > 40,
  `${(m.headRight - m.right).toFixed(1)}px free`);

const hitRight = await p.evaluate(([x,y]) => {
  const el = document.elementFromPoint(x,y);
  return { tag: el?.tagName, isInput: el?.id === 'section-title-0-fader1' };
}, [m.right + 30, m.midY]);
P('clicking right of the name does not hit the input', !hitRight.isInput, hitRight.tag);

await p.evaluate(([x,y]) => { document.elementFromPoint(x,y).click(); }, [m.right + 30, m.midY]);
await new Promise(r => setTimeout(r, 200));
const opened = await p.evaluate(() => isSectionOpen('fader1'));
P('clicking right of the name expands the section', opened, String(opened));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Zaregistrovat probe v runneru**

V `scratch/run-all-probes.mjs` přidej do `PROBES` hned za `'sections-independent-probe.mjs',`:

```js
  'fader-name-input-width-probe.mjs',
```

- [ ] **Step 3: Spustit probe a ověřit, že padá**

Run: `npm test -- fader-name-input-width-probe.mjs`
Expected: FAIL na `input is sized to its text` — input má dnes pevných 190 px, text „Expression" ~75 px.

- [ ] **Step 4: Upravit CSS pravidlo**

V `feel-fader.html` najdi:

```css
.fader-title-input{width:min(190px,100%);font-size:13px;padding:0;flex:0 1 auto;cursor:text}
```

a nahraď za:

```css
/* Šířka podle obsahu, ne pevných 190 px: prázdné místo napravo od názvu
   patří hlavičce sekce (= rozbalí ji), ne inputu (Frank, HW test 2026-08-08).
   field-sizing je Chrome 123+/Edge — appka je stejně Chrome-only kvůli
   Web Serial. max-width drží nejhorší případ na dosavadní šířce. */
.fader-title-input{field-sizing:content;width:auto;min-width:5ch;max-width:min(190px,100%);font-size:13px;padding:0;flex:0 1 auto;cursor:text}
```

- [ ] **Step 5: Spustit probe a ověřit, že prochází**

Run: `npm test -- fader-name-input-width-probe.mjs`
Expected: všech 5 řádků `PASS`, exit 0.

- [ ] **Step 6: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add feel-fader.html scratch/fader-name-input-width-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(ui): rename input ma sirku sveho textu, ne pevnych 190 px

Klik napravo od nazvu faderu ted rozbali sekci misto spusteni editace.
JS se nemeni — hlavicka uz ma guard closest('input,button')."
```

---

### Task C1: Inline chyba nemění výšku sekce

První ze tří kroků sekce C. Jde první, protože je nezávislý na ostatních — a protože bez něj by následující tasky commitovaly se známou padající assertion.

**Files:**
- Modify: `feel-fader.html` — `faderSectionContent()` (`app.js:626`), `ccEncoderBody()` (`app.js:677`), per-field smyčka v `runValidation()` (`app.js:1878–1882`), inline `<style>`
- Create: `scratch/validation-single-signal-probe.mjs`
- Modify: `scratch/run-all-probes.mjs` (registrace probe)

**Interfaces:**
- Consumes: `#err-b{bi}-{key}` elementy, `runValidation()`, `isSectionOpen(key)` a `toggleSection(key)` z Tasku A
- Produces: CSS třída `.section-error` — jediný selektor pro inline validační hlášku; probe soubor, který Tasky C2 a C3 rozšiřují

- [ ] **Step 1: Napsat padající probe**

Create `scratch/validation-single-signal-probe.mjs`:

```js
// Regression probe: one validation error produces exactly ONE visible
// message, and showing it does not move anything on the page. Before
// 2026-08-08 a duplicate CC raised four signals at once (the #vbar banner,
// "1 issue to fix" next to the send button, a "Show error" relabel of the
// button itself, and the inline red line) and #vbar, as the first child of
// .center-col, pushed the whole page down so the cursor was no longer over
// the +/- stepper being clicked.
// Grows across three tasks: C1 inline height, C2 single signal, C3 dots.
// Spec: 2026-08-08-ui-backlog-design.md §C.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); toggleSection('fader1'); });
await new Promise(r => setTimeout(r, 300));

// Výška sekce se nesmí měnit tím, že se v ní objeví chyba. Měří se sekce
// samotná, ne pozice na stránce — tu v tuhle chvíli pořád posouvá #vbar
// (řeší Task C2).
const sectionH = () => p.evaluate(() =>
  document.querySelector('.bank-section[data-fader="fader1"]').getBoundingClientRect().height);

const heightBefore = await sectionH();

await p.evaluate(() => {
  cfg.banks[0].fader2.cc      = cfg.banks[0].fader1.cc;
  cfg.banks[0].fader2.channel = cfg.banks[0].fader1.channel;
  renderPanels(); runValidation();
});
await new Promise(r => setTimeout(r, 150));

const heightAfter = await sectionH();
P('section height is unchanged when the error appears', Math.abs(heightAfter - heightBefore) < 1,
  `before ${heightBefore.toFixed(1)} / after ${heightAfter.toFixed(1)}`);

const inline = await p.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const shown = [...document.querySelectorAll('.section-error')].filter(el => el.textContent.trim() && vis(el));
  return { count: shown.length, text: shown[0]?.textContent.trim() || '' };
});
P('exactly one visible inline error', inline.count === 1, `${inline.count}: ${inline.text}`);

const cleared = await p.evaluate(() => {
  cfg.banks[0].fader2.cc = (cfg.banks[0].fader1.cc + 1) % 128;
  renderPanels(); runValidation();
  return [...document.querySelectorAll('.section-error')].filter(el => el.textContent.trim()).length;
});
P('inline error clears when the conflict is fixed', cleared === 0, String(cleared));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Zaregistrovat probe v runneru**

V `scratch/run-all-probes.mjs` přidej do pole `PROBES` hned za `'fader-name-input-width-probe.mjs',`:

```js
  'validation-single-signal-probe.mjs',
```

- [ ] **Step 3: Spustit probe a ověřit, že padá**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: FAIL na `section height is unchanged` (div se přepíná `display:none/block`) i na `exactly one visible inline error` (třída `.section-error` zatím neexistuje, počet je 0).

- [ ] **Step 4: Přidat CSS třídu s rezervovanou výškou**

V `feel-fader.html` najdi:

```css
.vbar{display:none}
```

a **před** tento řádek vlož:

```css
/* Výška je rezervovaná pořád, i když je hláška prázdná: jinak by zobrazení
   chyby posunulo sekce pod sebou. Po zrušení akordeonu je otevřených sekcí
   víc naráz, takže by to bylo vidět častěji (spec §C-navíc). */
.section-error{font-size:12px;color:var(--danger);margin-top:4px;min-height:16px;line-height:16px}
```

- [ ] **Step 5: Převést fader hlášku na třídu**

V `feel-fader.html` najdi:

```js
      <div id="err-b${bi}-${key}" style="font-size:12px;color:var(--danger);margin-top:4px;display:${err?'block':'none'}">${escHtml(err)}</div>
```

a nahraď za:

```js
      <div id="err-b${bi}-${key}" class="section-error">${escHtml(err)}</div>
```

- [ ] **Step 6: Převést encoder hlášku na třídu**

Najdi:

```js
        <div id="err-b${bi}-encoder" style="font-size:12px;color:var(--danger);margin-top:6px;display:${encErr?'block':'none'}">${escHtml(encErr)}</div>
```

a nahraď za:

```js
        <div id="err-b${bi}-encoder" class="section-error">${escHtml(encErr)}</div>
```

- [ ] **Step 7: Přestat přepínat `display` v `runValidation()`**

Najdi:

```js
      el.textContent = e ? e.msg : '';
      el.style.display = e ? 'block' : 'none';
```

a nahraď za:

```js
      el.textContent = e ? e.msg : '';
```

- [ ] **Step 8: Spustit probe a ověřit, že prochází celý**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: **všechny** řádky `PASS`, exit 0.

- [ ] **Step 9: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0, žádný `FAIL`.

- [ ] **Step 10: Commit**

```bash
git add feel-fader.html scratch/validation-single-signal-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(ui): inline validacni hlaska ma rezervovanou vysku

Div uz se neprepina display:none/block, jen se meni jeho text — vyska
sekce je konstantni, takze zobrazeni chyby neposune sekce pod sebou.
Inline styly presunuty do tridy .section-error."
```

---

### Task C2: Jedna chyba = jedna hláška

Ruší tři ze čtyř dnešních signálů: `#vbar` jako vizuální prvek, „N issues to fix" u tlačítka a přejmenování tlačítka na „Show error". Inline hláška z Tasku C1 zůstává jediná textová.

**Files:**
- Modify: `feel-fader.html` — `<div id="vbar">` markup, CSS `.vbar` / `.send-change-note.has-issues` / nové `.send-btn.blocked` a `.sr-only`, funkce `runValidation()` (odpovídá `app.js:1855–1875`)
- Modify: `scratch/validation-single-signal-probe.mjs` (rozšíření)

**Interfaces:**
- Consumes: `validate() -> Array<{field,target,msg}>`, `dirty`, `_sendConfirmed`, `t('btn.send') === 'Send to device'`, `handleDirtyAction()`, `.section-error` z Tasku C1
- Produces: `#vbar` s třídou `sr-only` (zůstává `role="alert"` + `aria-live="assertive"`); `#send-btn` s třídou `blocked` při neplatné konfiguraci; třída `.sr-only` použitelná dál

- [ ] **Step 1: Rozšířit probe**

V `scratch/validation-single-signal-probe.mjs` přidej **hned za** řádek `const heightBefore = await sectionH();`:

```js
const stepTop = () => p.evaluate(() =>
  document.querySelector('#b0-fader1-cc + .step-btn').getBoundingClientRect().top);
const stepBefore = await stepTop();
```

Za řádek `P('section height is unchanged when the error appears', ...)` přidej:

```js
const stepAfter = await stepTop();
P('stepper does not move when the error appears', Math.abs(stepAfter - stepBefore) < 1,
  `before ${stepBefore.toFixed(1)} / after ${stepAfter.toFixed(1)}`);

const s = await p.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const vbar = document.getElementById('vbar');
  const btn  = document.getElementById('send-btn');
  const note = document.getElementById('send-change-note');
  return {
    vbarSrOnly:    vbar.classList.contains('sr-only'),
    vbarVisible:   vis(vbar),
    vbarAnnounces: vbar.textContent.trim().length > 0,
    vbarRole:      vbar.getAttribute('role'),
    btnText:       btn.textContent.trim(),
    btnBlocked:    btn.classList.contains('blocked'),
    btnDisabled:   btn.disabled,
    noteText:      note ? note.textContent.trim() : '',
  };
});
P('#vbar is screen-reader-only',        s.vbarSrOnly && !s.vbarVisible, `srOnly=${s.vbarSrOnly} visible=${s.vbarVisible}`);
P('#vbar still announces the error',    s.vbarAnnounces && s.vbarRole === 'alert', `role=${s.vbarRole}`);
P('send button keeps its label',        s.btnText === 'Send to device', s.btnText);
P('send button is muted, not disabled', s.btnBlocked && !s.btnDisabled, `blocked=${s.btnBlocked} disabled=${s.btnDisabled}`);
P('change note shows no issue count',   !/issue/i.test(s.noteText), s.noteText || '(empty)');
```

A rozšiř existující blok `const cleared = ...` — nahraď ho celý za:

```js
const cleared = await p.evaluate(() => {
  cfg.banks[0].fader2.cc = (cfg.banks[0].fader1.cc + 1) % 128;
  renderPanels(); runValidation();
  const btn = document.getElementById('send-btn');
  return {
    inline:  [...document.querySelectorAll('.section-error')].filter(el => el.textContent.trim()).length,
    blocked: btn.classList.contains('blocked'),
    text:    btn.textContent.trim(),
  };
});
P('inline error clears when the conflict is fixed', cleared.inline === 0, String(cleared.inline));
P('blocked state clears with the error', !cleared.blocked && cleared.text === 'Send to device',
  `blocked=${cleared.blocked} text=${cleared.text}`);
```

- [ ] **Step 2: Spustit probe a ověřit, že nové řádky padají**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: FAIL na `stepper does not move`, `#vbar is screen-reader-only`, `send button keeps its label`, `send button is muted`, `change note shows no issue count` a `blocked state clears with the error`. Řádky z Tasku C1 dál procházejí.

- [ ] **Step 3: Přidat `.sr-only` utilitu a `.send-btn.blocked`, zrušit `.has-issues`**

V `feel-fader.html` najdi:

```css
.vbar{display:none}
.vbar.err{display:block}
```

a nahraď za:

```css
/* #vbar už není vizuální prvek. Jedna chyba měla čtyři signály naráz
   (banner, "N issues to fix", "Show error" na tlačítku, inline věta);
   viditelná zůstává jen inline věta u pole a tečky v hlavičce sekce /
   na tabu banky. Element zůstává jako assertive live region, aby odečítač
   obrazovky o chybě dál věděl. Vedlejší efekt: nic nevstupuje do flow,
   takže se pod ním nehne stepper (Frank, HW test 2026-08-08). */
.sr-only{position:absolute!important;width:1px!important;height:1px!important;margin:0!important;padding:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
.vbar{display:block}
```

Dál najdi:

```css
.send-change-note.has-issues{color:var(--danger)}
```

a nahraď za:

```css
/* Neplatná konfigurace: tlačítko si nechá svůj text "Send to device" a jen
   zesládne — nikdy "Show error". Klik pořád funguje a skočí na první chybu
   (handleDirtyAction), protože disabled tlačítko uživateli neřekne proč.
   Vizuální jazyk převzatý ze .send-btn.idle o pár řádků výš. */
.send-btn.blocked{background:var(--control-glass-bg);color:var(--t2);box-shadow:var(--control-glass-shadow)}
.send-btn.blocked:hover{background:var(--control-glass-bg);box-shadow:var(--control-glass-shadow-hover);color:var(--danger)}
```

- [ ] **Step 4: Označit `#vbar` v markupu jako sr-only**

V `feel-fader.html` najdi:

```html
  <div id="vbar" class="vbar" role="alert" aria-live="assertive"></div>
```

a nahraď za:

```html
  <div id="vbar" class="vbar sr-only" role="alert" aria-live="assertive"></div>
```

- [ ] **Step 5: Vyčistit bezchybnou větev `runValidation()`**

V `feel-fader.html` najdi:

```js
  if(errs.length===0){
    bar.className='vbar';bar.innerHTML='';
```

a nahraď za:

```js
  if(errs.length===0){
    bar.className='vbar sr-only';bar.textContent='';
```

Dál nahraď tyto tři řádky (každý zvlášť, jsou unikátní) tak, aby mazaly i `blocked`:

```js
        btn.disabled=true;btn.textContent='✓ Sent';btn.classList.add('sent');btn.classList.remove('review','idle');
```

na:

```js
        btn.disabled=true;btn.textContent='✓ Sent';btn.classList.add('sent');btn.classList.remove('review','idle','blocked');
```

```js
        btn.disabled=false;btn.textContent=t('btn.send');btn.classList.add('idle');btn.classList.remove('review','sent');
```

na:

```js
        btn.disabled=false;btn.textContent=t('btn.send');btn.classList.add('idle');btn.classList.remove('review','sent','blocked');
```

```js
        btn.disabled=false;btn.textContent=t('btn.send');btn.classList.remove('review','sent','idle');
```

na:

```js
        btn.disabled=false;btn.textContent=t('btn.send');btn.classList.remove('review','sent','idle','blocked');
```

- [ ] **Step 6: Přepsat chybovou větev `runValidation()`**

Najdi:

```js
  } else {
    const more=errs.length>1?` (+${errs.length-1} more)`:'';
    bar.className='vbar err';
    bar.innerHTML=`<button class="vbar-jump" type="button" onclick="focusValidationError(0)" aria-label="Show first configuration error"><span aria-hidden="true">⚠</span><span class="vbar-message">${escHtml(errs[0].msg)}${more}</span><span class="vbar-go">Show</span></button>`;
    if (!skipBtnUpdate) { btn.disabled=false;btn.textContent='Show error';btn.classList.add('review');btn.classList.remove('sent','idle'); }
    if(changeNote){setSendChangeNoteText(`${errs.length} issue${errs.length===1?'':'s'} to fix`);changeNote.classList.add('has-issues');}
  }
```

a nahraď za:

```js
  } else {
    const more=errs.length>1?` (+${errs.length-1} more)`:'';
    // Jen text pro odečítač obrazovky — žádné tlačítko "Show". Lokaci nese
    // tečka v hlavičce sekce a na tabu banky (markSectionIssues), samotné
    // znění chyby inline hláška u pole.
    bar.className='vbar sr-only';
    bar.textContent=`${errs[0].msg}${more}`;
    if (!skipBtnUpdate) { btn.disabled=false;btn.textContent=t('btn.send');btn.classList.add('blocked');btn.classList.remove('sent','idle','review'); }
  }
```

- [ ] **Step 7: Ověřit, že nezbyly odkazy na zrušené stavy**

Run: `rg -n "classList.add\('review'\)|has-issues|'Show error'" feel-fader.html`
Expected: **žádný výstup**. Když něco zbylo, odstraň to.

CSS pravidla `.vbar-jump` / `.vbar-message` / `.vbar-go` nech být — jsou mrtvá, ale jejich odstranění je kosmetika mimo rozsah a zvyšuje riziko překlepu v 840 KB souboru.

- [ ] **Step 8: Spustit probe**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: **všechny** řádky `PASS`, exit 0.

- [ ] **Step 9: Ověřit, že stávající vbar probe drží**

Run: `npm test -- vbar-aria-live-probe.mjs`
Expected: všechny řádky `PASS`. Probe testuje `role`, `aria-live` a naplnění obsahu `#vbar` při chybě — to platí dál.

- [ ] **Step 10: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add feel-fader.html scratch/validation-single-signal-probe.mjs
git commit -m "fix(ui): jedna validacni chyba = jeden viditelny signal

#vbar se meni na sr-only live region (odecitac obrazovky o chybe dal vi,
ale nic nevstupuje do flow -> nehne se stepper pod nim). Send tlacitko
si nechava text 'Send to device' a jen zesladne novou tridou .blocked;
'N issues to fix' a prejmenovani na 'Show error' zrusene."
```

---

### Task C3: Tečka ukazuje, kde chyba je

Nahrazuje zrušené tlačítko „Show" — lokaci chyby nese marker v hlavičce sekce a na tabu banky.

**Files:**
- Modify: `feel-fader.html` — `runValidation()` (konec funkce), `setActiveTab()` (`app.js:472–486`), inline `<style>`
- Modify: `scratch/validation-single-signal-probe.mjs` (rozšíření)

**Interfaces:**
- Consumes: `validate() -> Array<{field}>` kde `field` má tvar `b<index>.<fader1|fader2|encoder|uacc>`; `isSectionOpen(key)`; `cfg.banks`; `activeBank`
- Produces:
  - `sectionIssueKeys(bi: number) -> Set<string>` — klíče sekcí (`'fader1'|'fader2'|'roller'|'macro'`) s chybou v bance `bi`
  - `banksWithIssues() -> Set<number>` — indexy bank s chybou
  - `markSectionIssues() -> void` — promítne oboje do DOM; volá se z `runValidation()` a `setActiveTab()`
  - CSS třídy `.section-issue-dot`, `.bank-tab-issue`

- [ ] **Step 1: Rozšířit probe**

V `scratch/validation-single-signal-probe.mjs` přidej do objektu vraceného z `const s = await p.evaluate(...)` tyto dva klíče před uzavírací `};`:

```js
    sectionDot: !!document.querySelector('.bank-section[data-fader="fader1"] .section-issue-dot'),
    otherDot:   !!document.querySelector('.bank-section[data-fader="roller"] .section-issue-dot'),
```

a přidej dva `P(...)` řádky za `P('change note shows no issue count', ...)`:

```js
P('section head with the error carries a dot', s.sectionDot,  String(s.sectionDot));
P('unaffected section carries no dot',        !s.otherDot,    String(s.otherDot));
```

Do bloku `const cleared = await p.evaluate(...)` přidej do vraceného objektu:

```js
    dot: !!document.querySelector('.section-issue-dot'),
```

a rozšiř jeho assert — nahraď:

```js
P('blocked state clears with the error', !cleared.blocked && cleared.text === 'Send to device',
  `blocked=${cleared.blocked} text=${cleared.text}`);
```

za:

```js
P('blocked state clears with the error', !cleared.blocked && cleared.text === 'Send to device',
  `blocked=${cleared.blocked} text=${cleared.text}`);
P('issue dot clears with the error', !cleared.dot, String(cleared.dot));
```

- [ ] **Step 2: Spustit probe a ověřit, že nové řádky padají**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: FAIL na `section head with the error carries a dot`. Ostatní řádky dál procházejí.

- [ ] **Step 3: Přidat CSS pro obě tečky**

V `feel-fader.html` najdi:

```css
.send-btn.blocked{background:var(--control-glass-bg);color:var(--t2);box-shadow:var(--control-glass-shadow)}
```

a **před** tento řádek vlož:

```css
/* Lokace chyby bez věty navíc — nahrazuje zrušené tlačítko "Show" v #vbar.
   Tečka je čistě vizuální; znění chyby nese inline hláška a #vbar pro
   odečítač obrazovky, proto aria-hidden. */
.section-issue-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0;margin-right:2px}
.bank-tab-issue{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0;margin-right:4px}
```

- [ ] **Step 4: Napsat pomocné funkce a `markSectionIssues()`**

V `feel-fader.html` najdi konec funkce `runValidation()`:

```js
      if (ccEl) ccEl.setAttribute('aria-invalid', e ? 'true' : 'false');
      if (chEl) chEl.setAttribute('aria-invalid', e ? 'true' : 'false');
    });
  });
}
```

a nahraď za:

```js
      if (ccEl) ccEl.setAttribute('aria-invalid', e ? 'true' : 'false');
      if (chEl) chEl.setAttribute('aria-invalid', e ? 'true' : 'false');
    });
  });
  markSectionIssues();
}

// Mapa validačního `field` -> klíč sekce. 'encoder' i 'uacc' bydlí v roller
// sekci; 'macro' zatím nemá vlastní validaci, ale klíč je v seznamu níž
// kvůli symetrii a kvůli tomu, aby se stará tečka uklidila.
function _issueFieldToSection(field) {
  const m = /^b(\d+)\.(fader1|fader2|encoder|uacc)$/.exec(field || '');
  if (!m) return null;
  return { bi: Number(m[1]), key: (m[2] === 'encoder' || m[2] === 'uacc') ? 'roller' : m[2] };
}
function sectionIssueKeys(bi) {
  const out = new Set();
  validate().forEach(e => { const s = _issueFieldToSection(e.field); if (s && s.bi === bi) out.add(s.key); });
  return out;
}
function banksWithIssues() {
  const out = new Set();
  validate().forEach(e => { const s = _issueFieldToSection(e.field); if (s) out.add(s.bi); });
  return out;
}
function markSectionIssues() {
  const keys = sectionIssueKeys(activeBank);
  ['fader1','fader2','roller','macro'].forEach(key => {
    const section = document.querySelector(`.bank-section[data-fader="${key}"]`);
    const head = section && section.querySelector('.section-head');
    if (!head) return;
    head.querySelector('.section-issue-dot')?.remove();
    if (keys.has(key)) {
      const d = document.createElement('span');
      d.className = 'section-issue-dot'; d.setAttribute('aria-hidden','true');
      const slot = head.querySelector('.section-toggle-meta') || head.querySelector('.section-toggle-action') || head;
      slot.insertBefore(d, slot.firstChild);
    }
  });
  const bad = banksWithIssues();
  document.querySelectorAll('#bank-tabs .bank-block-tab').forEach((btn, idx) => {
    btn.querySelector('.bank-tab-issue')?.remove();
    if (bad.has(idx)) {
      const d = document.createElement('span');
      d.className = 'bank-tab-issue'; d.setAttribute('aria-hidden','true');
      btn.insertBefore(d, btn.children[0] || null);
    }
  });
}
```

- [ ] **Step 5: Zajistit, že `setActiveTab()` tečku nesmaže**

`setActiveTab()` přestavuje obsah tabů a odstraňuje `.bank-tab-device`. Najdi:

```js
      btn.insertBefore(s, btn.children[0]||null);
    }
  });
  const act=el.querySelector('.bank-block-tab.active');
```

a nahraď za:

```js
      btn.insertBefore(s, btn.children[0]||null);
    }
  });
  markSectionIssues();   // live marker se přestavuje tady, chybová tečka se musí obnovit s ním
  const act=el.querySelector('.bank-block-tab.active');
```

- [ ] **Step 6: Spustit probe**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: **všechny** řádky `PASS`, exit 0.

- [ ] **Step 7: Ověřit celou sadu**

Run: `npm test`
Expected: exit 0, žádný `FAIL`.

- [ ] **Step 8: Ruční vizuální kontrola**

Otevři appku v Chrome (`npx http-server -p 8100` nebo jiný statický server), zavolej `skipWelcome()` v DevTools konzoli, otevři všechny čtyři sekce a nastav duplicitní CC. Zkontroluj očima:
1. Viditelná je jedna červená věta pod stepperem, nic nahoře.
2. Tlačítko říká „Send to device" a je tlumené.
3. Hlavička LEFT FADER má červenou tečku.
4. Během psaní do CC pole se stepper `+`/`−` ani o pixel nehne.

Bod 4 je původní Frankův požadavek — když nesedí, plán selhal, ne probe.

- [ ] **Step 9: Commit**

```bash
git add feel-fader.html scratch/validation-single-signal-probe.mjs
git commit -m "feat(ui): tecka v hlavicce sekce a na tabu banky ukazuje, kde chyba je

Nahrazuje zrusene tlacitko 'Show' v #vbar. markSectionIssues() se vola
z runValidation() i ze setActiveTab(), aby tecka prezila prestavbu tabu.

Uzavira UI vlnu 1: validation-single-signal-probe.mjs je cely zeleny."
```

---

## Uzavření vlny

- [ ] **Step 1: Poslední plný běh**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 2: Zkontrolovat, že se do commitů nedostaly Codexovy zbytky**

Run: `git status --short`
Expected: pořád vidíš `M AGENTS.md`, `M CLAUDE.md`, `M WEBAPP.md`, `M scratch/mobile-ux-probe.mjs`, `M scratch/audit/run-audit-probes.mjs`, `?? app.js`, `?? styles.css`, `?? assets/`, `?? .mcp.json`, `?? .ignore`, `?? scratch/audit/csp-violation-check.mjs` — tedy nedotčené.

Run: `git diff main...ui-backlog-2026-08 --stat`
Expected: jen `feel-fader.html`, `scratch/run-all-probes.mjs`, tři nové probes a soubory ve `docs/superpowers/`.

- [ ] **Step 3: Předat Frankovi**

Nahlas: co je hotové, výsledek `npm test`, a **zeptej se na redeploy `feel-fader-demo`** (pravidlo z `[[feel-fader]]`: po dokončení nové verze appky se vždy proaktivně zeptat). Neredeployuj bez jeho „ano".
