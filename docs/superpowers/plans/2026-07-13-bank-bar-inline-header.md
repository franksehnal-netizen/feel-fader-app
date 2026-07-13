# Bank Bar → Inline Header (V3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the bank tabs inline into the single header row (status dot in the far-left corner, then title, a divider, then the bank tabs), drop the index numbers, and remove the separate `.bank-bar` strip.

**Architecture:** Pure layout refactor of the one-file web app `feel-fader.html`. Relocate `#h-status` and `#bank-tabs` DOM nodes into `.h-left`, delete the `.bank-bar` wrapper, restyle for a single row, remove the numeric index from the tab template, and re-point the one hard offset (`.sync-banner`) that assumed the old two-row height. No behavior change to connection-state logic or bank actions.

**Tech Stack:** Single self-contained `feel-fader.html` (HTML + CSS + vanilla JS, no build). Verification via `puppeteer-core` DOM probes.

## Global Constraints

- Single-file app `feel-fader.html`; no build step; runtime must stay fully self-contained (no new external deps).
- Preserve `connState()` / `renderConnState()` behavior across all four states (CONNECTED_LIVE, CONNECTED_BLIND, MIDI_BLOCKED, DISCONNECTED) — only the DOM location of `#h-status` changes.
- Must render correctly in both light and dark (`html.dark`).
- Verify with `puppeteer-core` against the already-running local server `http://localhost:8100/feel-fader.html`; launch pattern per `scratch/connstate-probe.mjs` (`headless:true, pipe:true`, Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`). Read state from the DOM, never from screenshots (memory `project_feelfader_browser_test_automation`).
- Commit only on Frank's explicit go (his standing rule). The commit steps below stage + prepare the message; run the actual `git commit` only when Frank approves.
- web↔device stays Web Serial only — this change touches no MIDI/serial code (memory `project_feelfader_web_uses_serial`).

## File Structure

- **Modify:** `feel-fader.html` — the only production file. Touch points: header markup (~1093–1112), CSS (`.h-left` 76, `.h-right` 82, `.bank-bar` 67–75, `.h-status` 622–624, `.bank-block-tabs` 972–980, `.bank-block-tab-add` 1017–1028, `.sync-banner` 592), JS (`renderBankTabs` 1518–1535, `setActiveTab` 1536–1545).
- **Create:** `scratch/bankbar-probe.mjs` — puppeteer-core DOM probe (structural + single-row assertions, then extended for state/responsive/dark). Lives in `scratch/` like the other probes; not shipped.

---

### Task 1: Collapse bank bar into single-row header

**Files:**
- Modify: `feel-fader.html` (markup ~1093–1112; CSS lines 67–75, 76, 592, 622–624, 972–980, 1017–1028; JS 1518–1535, 1536–1545)
- Create: `scratch/bankbar-probe.mjs`

**Interfaces:**
- Consumes: existing globals `skipWelcome()`, `render()`, `renderBankTabs()`, `setActiveTab()`, `cfg.banks`, `activeBank`, `liveBank`, `_ffConnected`.
- Produces: header DOM where `.h-left` children are, in order, `#h-status`, `.h-title`, `.h-div`, `#bank-tabs`; no `#bank-bar` element; bank tab buttons contain **no** `.bank-tab-idx` span.

- [ ] **Step 1: Write the failing probe**

Create `scratch/bankbar-probe.mjs`:

```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ try{skipWelcome&&skipWelcome()}catch(e){}; try{render&&render()}catch(e){}; });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const r = await p.evaluate(()=>{
  const hleft = document.querySelector('.h-left');
  const order = [...hleft.children].map(c => c.id || c.className.split(' ')[0]);
  const header = document.querySelector('header');
  const tabs = document.getElementById('bank-tabs');
  const right = document.querySelector('.h-right');
  const hb = header.getBoundingClientRect();
  const rr = right.getBoundingClientRect();
  return {
    order,
    noBankBar: !document.getElementById('bank-bar'),
    tabsInHeader: !!(tabs && header.contains(tabs)),
    dividerPresent: !!document.querySelector('.h-div'),
    idxCount: document.querySelectorAll('.bank-tab-idx').length,
    headerH: Math.round(hb.height),
    toggleRightGap: Math.round(window.innerWidth - rr.right),
  };
});
P('h-left order = status,title,div,tabs', JSON.stringify(r.order)==='["h-status","h-title","h-div","bank-tabs"]', JSON.stringify(r.order));
P('no #bank-bar element', r.noBankBar);
P('#bank-tabs inside <header>', r.tabsInHeader);
P('divider present', r.dividerPresent);
P('no .bank-tab-idx spans', r.idxCount===0, 'count='+r.idxCount);
P('single-row header (height < 60px)', r.headerH>0 && r.headerH<60, 'h='+r.headerH);
P('toggle pinned right (gap < 40px)', r.toggleRightGap<40, 'gap='+r.toggleRightGap);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run the probe to verify it fails**

Run: `node scratch/bankbar-probe.mjs`
Expected: FAIL on `h-left order` (title is first, no divider, tabs not in header), `no #bank-bar element`, `no .bank-tab-idx spans` (idx count = number of banks).

- [ ] **Step 3: Relocate the markup**

In `feel-fader.html`, replace the header + bank-bar block (lines ~1093–1112).

Old:
```html
<header>
  <div class="h-left">
    <span class="h-title">Feel Fader</span>
    <div class="h-status" id="h-status">
      <div class="h-status-dot" id="h-status-dot"></div>
      <span class="h-status-text" id="h-status-text"></span>
    </div>
  </div>
  <div class="h-right">

    <button class="dark-toggle" onclick="toggleDark()" title="Toggle dark mode">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </button>

  </div>
</header>
<div class="bank-bar" id="bank-bar"><div class="bank-block-tabs" id="bank-tabs"></div></div>
```

New:
```html
<header>
  <div class="h-left">
    <div class="h-status" id="h-status">
      <div class="h-status-dot" id="h-status-dot"></div>
      <span class="h-status-text" id="h-status-text"></span>
    </div>
    <span class="h-title">Feel Fader</span>
    <span class="h-div" aria-hidden="true"></span>
    <div class="bank-block-tabs" id="bank-tabs"></div>
  </div>
  <div class="h-right">

    <button class="dark-toggle" onclick="toggleDark()" title="Toggle dark mode">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </button>

  </div>
</header>
```

- [ ] **Step 4: Restyle the header row (CSS)**

4a. `.h-left` (line 76). Old: `.h-left{display:flex;align-items:center;gap:12px}`
New: `.h-left{display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0}`

4b. `.h-status` (lines 622–625). Remove the `margin-left:10px` (it is now the first, corner element; `.h-left` gap handles spacing). Old:
```css
.h-status{
  display:flex;align-items:center;gap:4px;
  margin-left:10px;
}
```
New:
```css
.h-status{
  display:flex;align-items:center;gap:4px;
}
```

4c. Add a divider rule immediately after the `.h-status-text.hidden` rule (line 647):
```css
.h-div{width:1px;height:16px;background:var(--border);flex:0 0 auto;}
```

4d. `.bank-block-tabs` (lines 972–980). Make it live in the header: transparent, no top padding, shrinkable. Old:
```css
.bank-block-tabs{
  display:flex;
  align-items:center;
  gap:0;
  padding:6px 6px 0;
  background:var(--bg-card);
  overflow-x:auto;
  scrollbar-width:none;
}
```
New:
```css
.bank-block-tabs{
  display:flex;
  align-items:center;
  gap:0;
  padding:0;
  background:transparent;
  min-width:0;
  overflow-x:auto;
  scrollbar-width:none;
}
```

4e. `.bank-block-tab-add` (line 1020). It is no longer a folder tab; make its corners symmetric. Old: `border-radius:var(--r-sm) var(--r-sm) 0 0;` → New: `border-radius:var(--r-sm);`

4f. Delete the now-dead `.bank-bar` rules (lines 67–75):
```css
.bank-bar{
  background:rgba(228,228,228,.93);
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  border-bottom:1px solid var(--border);
  padding:3px 12px;
}
html.dark .bank-bar{background:rgba(15,15,17,.92);}
.bank-bar .bank-block-tabs{background:transparent;padding:0;}
html.dark .bank-bar .bank-block-tabs{background:transparent;}
```

- [ ] **Step 5: Drop the index number from the tab template (JS)**

5a. `renderBankTabs` (line 1525). Old:
```javascript
    return `<button class="bank-block-tab ${i===activeBank?'active':''}" onclick="selectBank(${i})"><span class="bank-tab-idx">${i+1}</span>${liveDot}${iconHtml}<span class="bank-tab-name">${nm}</span></button>`;
```
New:
```javascript
    return `<button class="bank-block-tab ${i===activeBank?'active':''}" onclick="selectBank(${i})">${liveDot}${iconHtml}<span class="bank-tab-name">${nm}</span></button>`;
```

5b. `setActiveTab` (line 1543). The live dot is now the tab's first child (idx removed). Old:
```javascript
      btn.insertBefore(s, btn.children[1]||null);
```
New:
```javascript
      btn.insertBefore(s, btn.children[0]||null);
```

- [ ] **Step 6: Re-point the sync-banner offset (CSS)**

The `.sync-banner` was pinned below the old two-row `header + bank-bar` (~88px). First measure the new single-row header height, then set the offset just below it.

Measure: `node -e "0"` is not enough — read it from the probe you already have. Add this to `scratch/bankbar-probe.mjs` temporarily (or run inline):
Run: `node -e "import('puppeteer-core').then(async m=>{const b=await m.default.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,args:['--no-sandbox']});const p=await b.newPage();await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});const h=await p.evaluate(()=>Math.round(document.querySelector('header').getBoundingClientRect().height));console.log('header height:',h);await b.close();})"`
Expected: prints e.g. `header height: 46`.

Then update `.sync-banner` (line 592). Old:
```css
.sync-banner{position:fixed;top:98px;left:50%;transform:translateX(-50%);z-index:250;   /* pod header+bank-bar (~88px), nad stage (z-40) i toasty */
```
New (use measured height + 8px gap; example assumes 46 → 54):
```css
.sync-banner{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:250;   /* pod single-row header (~46px + 8px gap), nad stage (z-40) i toasty */
```

- [ ] **Step 7: Run the probe to verify it passes**

Run: `node scratch/bankbar-probe.mjs`
Expected: all PASS — order `["h-status","h-title","h-div","bank-tabs"]`, no `#bank-bar`, tabs in header, divider present, 0 `.bank-tab-idx`, single-row height < 60, toggle pinned right, no page errors.

- [ ] **Step 8: Visual confirmation in the real app**

Serve is already up on `http://localhost:8100/feel-fader.html`. Open in Chrome (or reuse the running tab) and confirm: one header row; green dot in the left corner; `Feel Fader` then a thin divider then the bank tabs (no numbers); active tab is a filled pill with the name; `+` present; dark toggle far right. Toggle dark mode and confirm the divider and tabs read correctly.

- [ ] **Step 9: Stage + prepare commit (commit only on Frank's go)**

```bash
git add feel-fader.html scratch/bankbar-probe.mjs
git commit -m "feat(ui): fold bank tabs into single-row header, drop index numbers"
```

---

### Task 2: Connection-state relocation + responsive/dark robustness

**Files:**
- Modify: `feel-fader.html` (only if a check fails — e.g. mobile block lines ~397–407)
- Modify: `scratch/bankbar-probe.mjs` (extend with state + responsive + dark assertions)

**Interfaces:**
- Consumes: globals `_midiState`, `_ffConnected`, `_serialPort`, `connState()`, `renderConnState()`, `liveAllowed()` (drive them exactly as `scratch/connstate-probe.mjs` does).
- Produces: confirmation that the relocated `#h-status` shows the correct dot class + text per state, that the header does not overflow at narrow width, and that the divider is visible in dark mode.

- [ ] **Step 1: Extend the probe with state + responsive + dark checks**

Append to `scratch/bankbar-probe.mjs` before `await b.close();` (reopen a page if you closed it — simplest is to move `await b.close()` to the very end and keep the page `p`). Add:

```javascript
// --- connection-state relocation (dot+text now in the corner, before the title) ---
async function scenario(midi, ff, serial){
  return await p.evaluate((midi,ff,serial)=>{
    _midiState = midi; _ffConnected = ff; _serialPort = serial ? {} : null;
    const st = connState(); renderConnState();
    const dot = document.getElementById('h-status-dot');
    const txt = document.getElementById('h-status-text');
    const status = document.getElementById('h-status');
    const title = document.querySelector('.h-title');
    return { st, dotClass: dot.className, text: txt.textContent,
      textHidden: txt.classList.contains('hidden'),
      statusLeftOfTitle: status.getBoundingClientRect().left < title.getBoundingClientRect().left };
  }, midi, ff, serial);
}
let s;
s = await scenario('granted', true, false);
P('LIVE: dot on + status left of title', /\bon\b/.test(s.dotClass) && s.statusLeftOfTitle, JSON.stringify(s));
s = await scenario('denied', false, true);
P('BLIND: warn + text shown', /\bwarn\b/.test(s.dotClass) && s.textHidden===false && s.text.length>0, JSON.stringify(s));
s = await scenario('denied', false, false);
P('BLOCKED: err dot', /\berr\b/.test(s.dotClass), JSON.stringify(s));
s = await scenario('pending', false, false);
P('DISCONNECTED: plain dot + text', s.dotClass==='h-status-dot' && s.text.length>0, JSON.stringify(s));

// --- narrow width: no horizontal page overflow, toggle stays visible ---
await p.setViewport({ width: 400, height: 800 });
await p.evaluate(()=>renderBankTabs());
const narrow = await p.evaluate(()=>{
  const right = document.querySelector('.h-right').getBoundingClientRect();
  return {
    noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    toggleVisible: right.right <= window.innerWidth + 1 && right.left >= 0,
  };
});
P('narrow: no horizontal page overflow', narrow.noPageOverflow, JSON.stringify(narrow));
P('narrow: toggle still visible', narrow.toggleVisible, JSON.stringify(narrow));
await p.setViewport({ width: 1200, height: 800 });

// --- dark mode: divider visible ---
const dark = await p.evaluate(()=>{
  document.documentElement.classList.add('dark');
  const d = document.querySelector('.h-div');
  const bg = getComputedStyle(d).backgroundColor;
  document.documentElement.classList.remove('dark');
  return { bg, opaque: bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent' };
});
P('dark: divider has visible color', dark.opaque, dark.bg);
```

- [ ] **Step 2: Run the extended probe**

Run: `node scratch/bankbar-probe.mjs`
Expected: all structural PASS from Task 1 plus: LIVE/BLIND/BLOCKED/DISCONNECTED state rows PASS (status sits left of title, correct dot classes + text), narrow rows PASS (no page overflow, toggle visible), dark divider PASS.

- [ ] **Step 3: Fix any failing check**

If narrow overflows: ensure `.h-title` has `flex-shrink:0` and the bank region scrolls. Add to the mobile block (lines ~397–407):
```css
  .h-title{flex-shrink:0;}
```
If the mobile rule `.bank-tab{font-size:11px;padding:8px}` (line 404) targets the dead old class and does nothing, leave it. Re-run Step 2 until green. If everything already passed, no code change is needed here.

- [ ] **Step 4: Visual confirmation across states + widths**

On `http://localhost:8100/feel-fader.html`: with no device, confirm the corner shows dot + "no device" text and the title/tabs shift right cleanly. Narrow the window to ~400px and confirm the row stays on one line with the tabs scrolling and the toggle pinned. Check light + dark.

- [ ] **Step 5: Stage + prepare commit (commit only on Frank's go)**

```bash
git add feel-fader.html scratch/bankbar-probe.mjs
git commit -m "test(ui): verify inline header across conn states, narrow width, dark"
```

---

## Self-Review

**Spec coverage:**
- Single row / no `.bank-bar` → Task 1 Steps 3, 4f; probe asserts `noBankBar` + single-row height. ✓
- Status dot in corner, dot-only when live → Task 1 Step 3 (markup order); Task 2 state checks (`statusLeftOfTitle`, LIVE dot on, text auto-hides via unchanged `renderConnState`). ✓
- Inline tabs, no index, active pill + name → Task 1 Steps 3, 5a; probe `idxCount===0`; active-pill styling untouched. ✓
- Divider (V3b) → Task 1 Steps 3, 4c; probe `dividerPresent`; dark check Task 2. ✓
- Dark toggle pinned right → Task 1 Step 3 + `.h-left flex:1` pushes `.h-right` right via header `justify-content:space-between`; probe `toggleRightGap`/`toggleVisible`. ✓
- Sync-banner offset → Task 1 Step 6. ✓
- Preserve connState across 4 states → Task 2 Step 1–2. ✓
- Light + dark, narrow → Task 2 Steps 1–4. ✓
- Out of scope (numbered fallback, icons, stage) → not touched. ✓

**Placeholder scan:** No TBD/TODO; every code step shows the exact before/after. The sync-banner value (54) is derived from a concrete measurement command, not a placeholder. ✓

**Type/name consistency:** `#h-status`, `#h-status-dot`, `#h-status-text`, `#bank-tabs`, `.h-div`, `.bank-block-tab`, `.bank-tab-name`, `renderBankTabs`, `setActiveTab`, `renderConnState`, `connState`, `liveAllowed` all match the current source and are used consistently across tasks. `setActiveTab` live-dot insert index (children[0]) matches the new `renderBankTabs` order (liveDot before icon). ✓
