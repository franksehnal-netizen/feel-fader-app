# TODO batch 2026-08-10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 9 small UI/UX fixes from `docs/TODO.md` (#1–#9) into `feel-fader.html`, one branch, one PR.

**Architecture:** Single-file app (`feel-fader.html` inline `<script>`/`<style>` is the only source of truth — `app.js`/`styles.css`/`assets/` in the repo root are a stale, untracked, uncommitted extract; never edit them). Each task is a self-contained, independently testable change with its own Puppeteer regression probe in `scratch/`, run against a throwaway static server on `:8100`. No firmware changes in this batch.

**Tech Stack:** Vanilla JS/CSS/HTML (no build step), `puppeteer-core` driving local Chrome for regression probes, Node's built-in `http` module for the test server (`scratch/run-all-probes.mjs`).

## Global Constraints

- Edit only `feel-fader.html`. Never touch root `app.js`/`styles.css`/`assets/` (stale extract, not loaded by the page).
- Every task ships a probe in `scratch/*.mjs` and gets registered in the `PROBES` array in `scratch/run-all-probes.mjs`.
- Chrome path for probes: `C:/Program Files/Google/Chrome/Application/chrome.exe`. Launch with `{ headless:true, pipe:true, args:['--no-sandbox'] }`.
- Probe pattern: `const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);` — every assertion goes through `P(...)`, one `PASS`/`FAIL` line per check. `run-all-probes.mjs` parses these lines; a probe with zero `PASS`/`FAIL` lines counts as a crash.
- Never call real `navigator.serial.requestPort()` or send real SysEx in a probe — poke internal state directly instead (`skipWelcome()`, `_ffConnected`, `_midiState`, `cfg.banks[...]`, `renderPanels()`, `runValidation()`, `renderLiveStrip()`), matching every existing probe in `scratch/`.
- Commit after each task with `git add` of the specific files touched (never `-A`).
- Two items intentionally changed scope vs. the literal TODO wording (both confirmed by Frank 2026-08-10) — implement exactly as specified here, not as literally worded in `docs/TODO.md`:
  - TODO #1 (HID live keys): show the **configured** key combo, not a true live trigger (no data channel exists for that — see Task 7).
  - TODO #3 (sync timing): overrides an earlier explicit decision in the code comments (2026-07-21) to keep the reveals as separate beats.
- Full design rationale: `docs/superpowers/specs/2026-08-10-todo-batch-design.md`.

---

### Task 1: Stable row height in the ART live-status row (TODO #2)

**Files:**
- Modify: `feel-fader.html:209` (CSS, `.live-hud-roller .live-hud-value`)
- Test: `scratch/art-row-stable-height-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (pure CSS stabilization, no new function/class beyond an unchanged selector gaining one property).

- [ ] **Step 1: Write the failing probe**

Create `scratch/art-row-stable-height-probe.mjs`:

```js
// Regression: the ART row's live-hud-tech line ("Ch1·CC32") must not shift
// vertically when the articulation name above it changes length and picks
// up .is-long/.is-very-long (font-size drops 9px -> 8.25px -> 7.5px). Before
// this fix, line-height was 'normal' (font-size-relative), so row 1's auto
// grid height changed with it. Spec: 2026-08-10-todo-batch-design.md §1.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  skipWelcome();
  _ffConnected = true; _midiState = 'granted';
  // Drive both states through the real renderLiveStrip() code path (not by
  // hand-writing textContent/classList afterward — that bypasses the actual
  // is-long/is-very-long computation and can mask or fake the bug). Use real
  // UACC_NAMES entries: value 1 = 'Legato' (6 chars, plain), value 26 =
  // 'Long — Sul Ponticello' (22 chars, triggers is-very-long) — the exact
  // pairing TODO #2 itself names ("Short — D…" ↔ "Long — Sul...").
  // .live-hud has CSS transitions up to .38s (width/height/padding/border-radius)
  // and .36s (transform/top/left) — wait 600ms after each render, comfortably
  // past all of them, or the measurement catches the HUD's own reveal/reposition
  // transition mid-flight and reports a false difference unrelated to row height.
  encLiveVal = 1;
  renderLiveStrip();
  await new Promise(res => setTimeout(res, 600));
  const techShort = document.getElementById('live-roller-tech').getBoundingClientRect().top;

  encLiveVal = 26;
  renderLiveStrip();
  await new Promise(res => setTimeout(res, 600));
  const techLong = document.getElementById('live-roller-tech').getBoundingClientRect().top;

  return { techShort, techLong };
});

P('live-roller-tech row does not move when the value becomes .is-very-long',
  Math.abs(r.techLong - r.techShort) < 0.5, `short=${r.techShort} long=${r.techLong}`);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- art-row-stable-height-probe.mjs`
Expected: `FAIL  live-roller-tech row does not move...` (row shifts by ~2.4px because `is-very-long` drops font-size, shrinking the 'normal' line-height — verified 2026-08-10 via direct measurement: `.live-hud-roller`'s internal `grid-template-rows` stays byte-identical between states once `line-height` is fixed, so this is purely the value cell's line-height collapsing with font-size, not a grid/track issue).

- [ ] **Step 3: Fix the CSS**

In `feel-fader.html`, line 209, change:

```css
.live-hud-roller .live-hud-value{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:9px;letter-spacing:-.02em}
```

to:

```css
.live-hud-roller .live-hud-value{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:9px;line-height:11px;letter-spacing:-.02em}
```

(Adding `line-height:11px` fixes the box height regardless of font-size; `.is-long`/`.is-very-long` at lines 210-211 only override `font-size`/`letter-spacing`, so they inherit the fixed `11px` line-height and no longer change row 1's auto grid height.)

- [ ] **Step 4: Run the probe again to confirm it passes**

Run: `npm test -- art-row-stable-height-probe.mjs`
Expected: both `PASS` lines.

- [ ] **Step 5: Register the probe and commit**

In `scratch/run-all-probes.mjs`, add `'art-row-stable-height-probe.mjs',` to the `PROBES` array (anywhere in the list; alphabetical grouping isn't enforced elsewhere in the file, so append near other `live-hud-*` probes for readability).

```bash
git add feel-fader.html scratch/art-row-stable-height-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(live-hud): stabilize ART row height across articulation name lengths (TODO #2)"
```

---

### Task 2: Stop the stray focus ring after mouse clicks on section headers (TODO #8)

**Files:**
- Modify: `feel-fader.html:2182-2187` (JS, `toggleSection`)
- Modify: `feel-fader.html:2205,2213-2214,2219-2220` (JS, `sectionHeaderHtml` — `onclick` call sites)
- Test: `scratch/section-toggle-focus-ring-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: `toggleSection(key, event)` — new optional second parameter, backward compatible (all call sites updated to pass `event` in this task; no other code calls `toggleSection` with one argument after this task, but the function still tolerates being called with none).

- [ ] **Step 1: Write the failing probe**

Create `scratch/section-toggle-focus-ring-probe.mjs`:

```js
// Regression: clicking a section header's expand/collapse control with the
// mouse must not steal focus onto the freshly re-rendered toggle button —
// toggleSection() re-focuses it unconditionally on every call today, which
// moves focus to the button after ANY click, mouse or keyboard alike
// (confirmed empirically 2026-08-10: document.activeElement becomes the
// toggle button after a plain Puppeteer .click() on unmodified code). The
// fix only re-focuses on keyboard-driven activation — a click event with
// detail === 0 (verified empirically: a real Puppeteer mouse click reports
// event.detail === 1; a keyboard Enter press on a focused button reports
// event.detail === 0). This probe checks document.activeElement directly
// rather than the :focus-visible CSS pseudo-class: :focus-visible did not
// reliably distinguish mouse vs. keyboard focus for CDP-dispatched clicks
// in headless Chrome during manual verification (it read false in both
// cases, before AND after the fix), so it can't discriminate this bug —
// activeElement identity is the concrete, deterministic thing the fix
// actually changes.
// Spec: 2026-08-10-todo-batch-design.md §2.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

// Real mouse click on the macro section's expand button. Nothing should be
// focused beforehand, so a positive result can't be a leftover from setup.
await p.evaluate(() => document.activeElement?.blur());
const macroToggle = await p.$('#section-toggle-0-macro');
await macroToggle.click();
await new Promise(r => setTimeout(r, 100));
const afterMouseClick = await p.evaluate(() => document.activeElement?.id || null);
P('mouse click does not move focus onto the section toggle', afterMouseClick !== 'section-toggle-0-macro', `activeElement=${afterMouseClick}`);

// Keyboard activation must still move focus there (no regression). Focus
// the button via JS first (simulating arrival by Tab), then press Enter —
// a real Enter-on-a-focused-button click, which reports event.detail === 0.
await p.evaluate(() => { document.activeElement?.blur(); document.getElementById('section-toggle-0-macro').focus(); });
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 100));
const afterEnter = await p.evaluate(() => document.activeElement?.id || null);
P('keyboard Enter still moves focus onto the section toggle', afterEnter === 'section-toggle-0-macro', `activeElement=${afterEnter}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm the first assertion fails**

Run: `npm test -- section-toggle-focus-ring-probe.mjs`
Expected: `FAIL  mouse click does not move focus onto the section toggle` — `activeElement=section-toggle-0-macro` (unmodified `toggleSection()` always re-focuses, regardless of input source). The second assertion (keyboard Enter) already passes on unmodified code — that's expected, it's the no-regression check.

- [ ] **Step 3: Pass the triggering event through and gate the re-focus**

In `feel-fader.html:2182-2187`, change:

```js
function toggleSection(key) {
  if (_openSections.has(key)) _openSections.delete(key); else _openSections.add(key);
  renderPanels();
  runValidation();
  requestAnimationFrame(() => document.getElementById(`section-toggle-${activeBank}-${key}`)?.focus());
}
```

to:

```js
function toggleSection(key, event) {
  if (_openSections.has(key)) _openSections.delete(key); else _openSections.add(key);
  renderPanels();
  runValidation();
  // event.detail === 0 identifies a keyboard/Enter-triggered click (real
  // mouse clicks report detail >= 1) — only steal focus for keyboard nav,
  // so a mouse click doesn't leave a programmatic-focus ring behind on the
  // freshly re-rendered button (TODO #8).
  if (!event || event.detail === 0) {
    requestAnimationFrame(() => document.getElementById(`section-toggle-${activeBank}-${key}`)?.focus());
  }
}
```

Then update every `onclick="toggleSection('${key}')"` call site to pass `event`:

At `feel-fader.html:2205`:
```js
      onclick="if(!event.target.closest('input,button'))toggleSection('${key}',event)">
```
(was `onclick="if(!event.target.closest('input,button'))toggleSection('${key}')"`)

At `feel-fader.html:2213-2214`:
```js
      <button type="button" class="section-toggle-action" id="section-toggle-${bi}-${key}"
        onclick="toggleSection('${key}',event)" aria-expanded="${open}" aria-controls="section-body-${bi}-${key}" aria-label="${open?'Collapse':'Expand'} ${escHtml(title)} settings">
```
(was `onclick="toggleSection('${key}')"`)

At `feel-fader.html:2219-2220`:
```js
  return `<button type="button" class="section-head section-toggle" id="section-toggle-${bi}-${key}" data-fader="${key}"
    onclick="toggleSection('${key}',event)" aria-expanded="${open}" aria-controls="section-body-${bi}-${key}">
```
(was `onclick="toggleSection('${key}')"`)

- [ ] **Step 4: Run the probe again to confirm both assertions pass**

Run: `npm test -- section-toggle-focus-ring-probe.mjs`
Expected: both `PASS` lines.

- [ ] **Step 5: Run the existing sections-independent probe to confirm no regression**

Run: `npm test -- sections-independent-probe.mjs`
Expected: all `PASS` (this probe exercises `toggleSection` heavily via `p.evaluate(() => toggleSection('fader1'))`, which now calls it with `event === undefined` — the `!event` branch in Step 3 keeps that path re-focusing exactly as before).

- [ ] **Step 6: Register the probe and commit**

Add `'section-toggle-focus-ring-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/section-toggle-focus-ring-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(a11y): only re-focus section toggles on keyboard activation, not mouse clicks (TODO #8)"
```

---

### Task 3: Live-status overview card reacts to validation errors (TODO #9)

**Files:**
- Modify: `feel-fader.html:4109` (JS, end of `runValidation()`)
- Modify: `feel-fader.html:5191-5192` (JS, `renderLiveStrip()`)
- Modify: `feel-fader.html:206` (CSS, `.live-hud-tech`)
- Test: `scratch/live-strip-validation-signal-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: `sectionIssueKeys(bi)` (existing, `feel-fader.html:4120`) — returns `Set<'fader1'|'fader2'|'roller'|'macro'>` of section keys with a validation error for bank `bi`. `liveBank` (existing global, the device's currently-active bank index).
- Produces: `.live-hud-tech.has-issue` CSS class toggle on `#live-f1-tech`/`#live-f2-tech` — no new functions.

- [ ] **Step 1: Write the failing probe**

Create `scratch/live-strip-validation-signal-probe.mjs`:

```js
// Regression: the always-visible live-status card (top-left square) must
// turn its Ch/CC line red when that fader has a validation error — today it
// only shows in the bank tab dot and the open section's dot, never here, so
// an invalid CC (e.g. 999) reads as perfectly normal in the persistent card.
// Spec: 2026-08-10-todo-batch-design.md §3.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const before = await p.evaluate(() => document.getElementById('live-f1-tech').classList.contains('has-issue'));
P('live-f1-tech has no issue class on a valid config', !before, String(before));

const afterInvalid = await p.evaluate(() => {
  liveBank = 0;
  cfg.banks[0].fader1.cc = 999; // out of 0-127 range -> validate() flags b0.fader1
  renderPanels(); runValidation();
  return document.getElementById('live-f1-tech').classList.contains('has-issue');
});
P('live-f1-tech gets has-issue when fader1 CC is invalid', afterInvalid, String(afterInvalid));

const otherUnaffected = await p.evaluate(() => document.getElementById('live-f2-tech').classList.contains('has-issue'));
P('live-f2-tech is unaffected by a fader1-only error', !otherUnaffected, String(otherUnaffected));

const colorChanged = await p.evaluate(() => {
  const el = document.getElementById('live-f1-tech');
  return getComputedStyle(el).color;
});
const dangerColor = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--danger').trim());
P('has-issue color matches --danger', colorChanged.length > 0 && dangerColor.length > 0, `color=${colorChanged} --danger=${dangerColor}`);

const afterFixed = await p.evaluate(() => {
  cfg.banks[0].fader1.cc = 11;
  renderPanels(); runValidation();
  return document.getElementById('live-f1-tech').classList.contains('has-issue');
});
P('has-issue clears once the CC is fixed', !afterFixed, String(afterFixed));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- live-strip-validation-signal-probe.mjs`
Expected: `FAIL  live-f1-tech gets has-issue when fader1 CC is invalid` (class never gets applied — `renderLiveStrip()` doesn't know about validation state yet).

- [ ] **Step 3: Add the CSS state**

In `feel-fader.html:206`, change:

```css
.live-hud-tech{color:var(--t3);font:600 6.25px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1;white-space:nowrap}
```

to:

```css
.live-hud-tech{color:var(--t3);font:600 6.25px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1;white-space:nowrap}
.live-hud-tech.has-issue{color:var(--danger)}
```

- [ ] **Step 4: Wire validation into `renderLiveStrip()`**

In `feel-fader.html:5191-5192`, change:

```js
  setTxt('live-f1-tech', `Ch${bank.fader1.channel+1}·CC${bank.fader1.cc}`);
  setTxt('live-f2-tech', `Ch${bank.fader2.channel+1}·CC${bank.fader2.cc}`);
```

to:

```js
  setTxt('live-f1-tech', `Ch${bank.fader1.channel+1}·CC${bank.fader1.cc}`);
  setTxt('live-f2-tech', `Ch${bank.fader2.channel+1}·CC${bank.fader2.cc}`);
  const liveIssues = sectionIssueKeys(liveBank);
  document.getElementById('live-f1-tech')?.classList.toggle('has-issue', liveIssues.has('fader1'));
  document.getElementById('live-f2-tech')?.classList.toggle('has-issue', liveIssues.has('fader2'));
```

- [ ] **Step 5: Make `runValidation()` refresh the live strip**

In `feel-fader.html:4109-4110`, change:

```js
  markSectionIssues();
}
```

to:

```js
  markSectionIssues();
  renderLiveStrip();
}
```

(This guarantees the card's issue state is always current after any validation pass, not just the ones that happen to already call `renderLiveStrip()` — e.g. `stepCtrl`-family edits.)

- [ ] **Step 6: Run the probe again to confirm it passes**

Run: `npm test -- live-strip-validation-signal-probe.mjs`
Expected: all `PASS`.

- [ ] **Step 7: Run the existing validation-single-signal probe to confirm no regression**

Run: `npm test -- validation-single-signal-probe.mjs`
Expected: all `PASS` (this probe exercises `runValidation()` heavily; the added `renderLiveStrip()` call must not break any of its height/visibility assertions since `renderLiveStrip()` never touches section DOM, only the live-strip card).

- [ ] **Step 8: Register the probe and commit**

Add `'live-strip-validation-signal-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/live-strip-validation-signal-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(live-hud): overview card turns red when its fader has a validation error (TODO #9)"
```

---

### Task 4: Give the welcome heading breathing room above the button (TODO #6)

**Files:**
- Modify: `feel-fader.html:1121-1124` (CSS, `.welcome-copy-stage` base rule)
- Modify: `feel-fader.html:1154` (CSS, `@media(min-width:601px)` override)
- Test: `scratch/welcome-heading-gap-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (pure CSS; `positionWelcomeAnchor()` at `feel-fader.html:5917` is unaffected — it dynamically re-measures and re-anchors regardless of `.welcome-copy-stage`'s own height, verified empirically below).

**Empirical grounding (measured 2026-08-10 against this exact page via Puppeteer, 1280×900, do not re-derive from scratch):**
- Today, in the "no tips" state (`ff-onboarded` set), `#welcome-wordmark` bottom sits at **exactly** the same y as `#welcome-action-slot` top (0px gap) — the heading is visually glued to the button with zero breathing room. That is the real, measured bug (not the originally-hypothesized "padding-top compensation shift" — that hypothesis was tested and disproven; see spec §4 changelog).
- `positionWelcomeAnchor()` keeps `#send-btn`'s real screen position constant by shrinking/growing `--welcome-anchor-top` to compensate for whatever height `.welcome-copy-stage` renders at — so increasing `.welcome-copy-stage`'s own `height`/`flex-basis` (with `justify-content:flex-start` instead of `center`, so the wordmark top-aligns and the extra height becomes pure gap below it, not split above+below) produces exactly that much extra gap, with the button's on-screen position **unchanged**. Verified: raising desktop `height`/`flex-basis` from `32px` to `56px` (mobile base from `50px` to `74px`) produced a measured **24px gap** where there was 0px before, and `#send-btn`'s top stayed at the same pixel in both the "no tips" and "with tips" states.
- The `.welcome-onboarding` variant (`feel-fader.html:1125-1136`) sets its own `height:auto` and its own `justify-content:flex-start` already, so it is untouched by this change — confirmed by measurement (`#send-btn` top identical before/after in the "with tips" state).

- [ ] **Step 1: Write the failing probe**

Create `scratch/welcome-heading-gap-probe.mjs`:

```js
// Regression: in the "no onboarding tips" welcome state (returning user,
// ff-onboarded already set), the heading must not sit flush against the
// action button with zero gap. Measured 2026-08-10: gap was exactly 0px.
// Also asserts positionWelcomeAnchor() still pins #send-btn's screen
// position identically whether tips show or not (its whole job).
// Spec: 2026-08-10-todo-batch-design.md §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const noTips = await p.evaluate(async () => {
  localStorage.setItem('ff-onboarded','1');
  showWelcome();
  await new Promise(r => setTimeout(r, 100));
  const w = document.getElementById('welcome-wordmark').getBoundingClientRect();
  const slot = document.getElementById('welcome-action-slot').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { gap: slot.top - w.bottom, btnTop: btn.top };
});
P('heading has a visible gap above the button in the no-tips state', noTips.gap >= 16, `gap=${noTips.gap}`);

const withTips = await p.evaluate(async () => {
  localStorage.removeItem('ff-onboarded');
  showWelcome();
  await new Promise(r => setTimeout(r, 100));
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { btnTop: btn.top };
});
P('#send-btn stays pinned to the same screen position in both states', Math.abs(withTips.btnTop - noTips.btnTop) < 0.5,
  `noTips=${noTips.btnTop} withTips=${withTips.btnTop}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm the first assertion fails**

Run: `npm test -- welcome-heading-gap-probe.mjs`
Expected: `FAIL  heading has a visible gap above the button in the no-tips state` (gap=0).

- [ ] **Step 3: Apply the CSS fix**

In `feel-fader.html:1121-1124`, change:

```css
.welcome-copy-stage{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  position:relative;width:100%;height:50px;flex:0 0 50px;
}
```

to:

```css
.welcome-copy-stage{
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;
  position:relative;width:100%;height:74px;flex:0 0 74px;
}
```

In `feel-fader.html:1152-1156` (the `@media(min-width:601px)` block), change:

```css
@media(min-width:601px){
  .welcome-inner{gap:2px}
  .welcome-copy-stage{height:32px;flex-basis:32px}
  .welcome-action-slot{margin:0}
}
```

to:

```css
@media(min-width:601px){
  .welcome-inner{gap:2px}
  .welcome-copy-stage{height:56px;flex-basis:56px}
  .welcome-action-slot{margin:0}
}
```

- [ ] **Step 4: Run the probe again to confirm both assertions pass**

Run: `npm test -- welcome-heading-gap-probe.mjs`
Expected: both `PASS` (gap should measure ~24px on the 1280px-wide viewport this probe uses).

- [ ] **Step 5: Run the existing onboarding probes to confirm no regression**

Run: `npm test -- onb-probe4.mjs`
Expected: all `PASS` (this is the surviving onboarding regression probe in `PROBES`; the `.welcome-onboarding` branch's own `height:auto` override is untouched by this change).

- [ ] **Step 6: Register the probe and commit**

Add `'welcome-heading-gap-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/welcome-heading-gap-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(welcome): add breathing room above heading when onboarding tips are hidden (TODO #6)"
```

---

### Task 5: Sync the live-HUD and Send-to-device reveal timing after connect (TODO #3)

**Files:**
- Modify: `feel-fader.html:1318-1321` (CSS, `@keyframes welcome-btn-reveal` usage — actually the duration lives in JS, see below)
- Modify: `feel-fader.html:5873` (JS, `revealPostConnectUI`)
- Modify: `feel-fader.html:6085-6088` (JS, `connectTransitionWelcome`)
- Test: `scratch/connect-reveal-sync-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (timing-only change to existing `setTimeout` calls and one animation duration).

- [ ] **Step 1: Write the failing probe**

Create `scratch/connect-reveal-sync-probe.mjs`:

```js
// Regression: after connectTransitionWelcome() runs, the reveal of the
// live-status HUD and the reveal of the Send-to-device button must be
// scheduled with the same delay. Before this fix they weren't (HUD's
// trigger at T+1100ms, button's at T+1450ms) — TODO #3 explicitly overrides
// an earlier decision (2026-07-21 code comment) to keep them as separate
// beats, confirmed by Frank 2026-08-10.
//
// This does NOT poll rendered opacity to detect "visible" — verified
// empirically 2026-08-10 that doesn't work here: #send-btn is already
// opacity:1 (from the earlier "Connect & load" CTA reveal, via the
// unrelated .welcome-start.show class) before connectTransitionWelcome()
// ever runs, and the button's later hide-then-reveal happens through a
// separate body.welcome-connecting CSS-driven fade layered on top of that
// — so a plain "poll until opacity>=0.99" check reports "visible" at ~20ms
// regardless of either the old 1450ms delay or the new 1100ms one; it
// can't discriminate the change at all. Instead this spies on the actual
// setTimeout call the code makes for revealPostConnectUI — the exact,
// deterministic thing this task changes — and separately checks the
// animation-duration change by calling revealPostConnectUI() directly.
// Spec: 2026-08-10-todo-batch-design.md §5.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  showWelcome();
  const captured = [];
  const origSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (fn === revealPostConnectUI) captured.push(delay);
    return origSetTimeout.call(window, fn, delay, ...args);
  };
  connectTransitionWelcome();
  window.setTimeout = origSetTimeout;
  await new Promise(res => origSetTimeout(res, 50));

  const btn = document.getElementById('send-btn');
  revealPostConnectUI();
  const animationStr = btn.style.animation;

  return { revealDelay: captured[0], animationStr };
});

P('revealPostConnectUI is scheduled at the same T+1100ms delay as the HUD reveal', r.revealDelay === 1100, `delay=${r.revealDelay}`);
P('welcome-btn-reveal animation duration is .3s (matches the HUD\'s .28s opacity transition)', /welcome-btn-reveal/.test(r.animationStr) && /^0?\.3s/.test(r.animationStr), r.animationStr);
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- connect-reveal-sync-probe.mjs`
Expected: `FAIL  revealPostConnectUI is scheduled at the same T+1100ms delay as the HUD reveal` — `delay=1450` (unmodified code still uses the old, later delay) and `FAIL  welcome-btn-reveal animation duration is .3s...` — the reported string will show `.6s`.

- [ ] **Step 3: Align the two reveal timers**

In `feel-fader.html:6085-6088`, change:

```js
  // 6. Reveal the button once the app has actually finished opening, as its
  // own distinct beat — not bundled into the moment above (Frank, 2026-07-21:
  // "at se tam to send to device objevi az plynule po otevreni te appky").
  setTimeout(revealPostConnectUI, 1450);
}
```

to:

```js
  // 6. Reveal the button in lockstep with the live HUD above (both start at
  // T+1100ms) — previously a separate, later beat at T+1450ms (Frank,
  // 2026-07-21); revised 2026-08-10 (TODO #3) so the two read as one moment.
  setTimeout(revealPostConnectUI, 1100);
}
```

In `feel-fader.html:5873`, change:

```js
      btn.style.animation = 'welcome-btn-reveal .6s ease';
```

to:

```js
      btn.style.animation = 'welcome-btn-reveal .3s ease';
```

(`.3s` is close to `.live-hud`'s own `.28s` opacity transition at `feel-fader.html:168`, so both finish within the same ~300ms window once both start at T+1100ms.)

- [ ] **Step 4: Run the probe again to confirm it passes**

Run: `npm test -- connect-reveal-sync-probe.mjs`
Expected: both `PASS`.

- [ ] **Step 5: Run the existing live-hud-immediate-reveal probe to confirm no regression**

Run: `npm test -- live-hud-immediate-reveal-probe.mjs`

Note: this probe is not in the `PROBES` list in `run-all-probes.mjs` (verify with `grep -n "live-hud-immediate-reveal" scratch/run-all-probes.mjs` — if absent, run it directly instead: `node scratch/live-hud-immediate-reveal-probe.mjs` against the same `:8100` server started by `npm test`, or just skip this cross-check and rely on Step 6's full suite run). It uses `skipWelcome()`, not `connectTransitionWelcome()`, so it is unaffected by this change either way — this step is a sanity check, not expected to reveal anything.

- [ ] **Step 6: Register the new probe and commit**

Add `'connect-reveal-sync-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/connect-reveal-sync-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(welcome): sync Send-to-device reveal timing with the live HUD (TODO #3)"
```

---

### Task 6: Center "Live positions unavailable" between the header and the controller (TODO #7)

**Files:**
- Modify: `feel-fader.html:293-294` (CSS, `.live-note`)
- Modify: `feel-fader.html:5258-5261` (JS, `renderConnState`)
- Modify: `feel-fader.html:6647` (JS, resize listener block — add one more listener)
- Test: `scratch/live-note-centered-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces: `positionLiveNote()` — new global function, no arguments, no return value. Repositions `#live-note` absolutely within `.stage` (which already has `position:relative`, `feel-fader.html:272`) so it sits vertically centered between `header`'s bottom edge and `#device-home`'s top edge. Safe to call whenever `#live-note` is visible; no-ops if any required element is missing or the note is hidden.

**Empirical grounding (measured 2026-08-10):** with the note force-shown, `header` bottom = 40px, `#device-home` top = 94.8px (a 54.8px gap), but the note itself currently renders at top=78/bottom=94.8 — flush against the controller, not centered in the gap (midpoint would be ~67.4px). `.stage`'s own `justify-content:center` centers the whole flex column as a block; it does not center `#live-note` independently within the header-to-controller gap, because `header` lives outside `.stage` entirely (different ancestor — `.top-sticky` vs `.stage-collapse`). Reusing `.stage`'s existing flex centering can't solve this without touching layout used by every other state of `.stage`; an absolutely-positioned, JS-measured note (same idiom as the existing `positionWelcomeAnchor()`/`updateContextualLiveStrip()` header-measurement pattern) is the safe fix.

- [ ] **Step 1: Write the failing probe**

Create `scratch/live-note-centered-probe.mjs`:

```js
// Regression: "Live positions unavailable — MIDI not connected" must sit
// vertically centered in the gap between the header and the controller, not
// flush against the controller with all the whitespace above it. Measured
// 2026-08-10: note was flush against #device-home (0px gap below), leaving
// the full 38px gap above it.
// Spec: 2026-08-10-todo-batch-design.md §6.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(async () => {
  skipWelcome();
  await new Promise(res => setTimeout(res, 200));
  // Force CONNECTED_BLIND-equivalent visibility the same way renderConnState() would.
  const note = document.getElementById('live-note');
  note.hidden = false;
  positionLiveNote();
  await new Promise(res => setTimeout(res, 50));
  const header = document.querySelector('header').getBoundingClientRect();
  const deviceHome = document.getElementById('device-home').getBoundingClientRect();
  const n = note.getBoundingClientRect();
  const gapAbove = n.top - header.bottom;
  const gapBelow = deviceHome.top - n.bottom;
  return { gapAbove, gapBelow };
});

P('roughly equal whitespace above and below the note', Math.abs(r.gapAbove - r.gapBelow) < 3,
  `above=${r.gapAbove.toFixed(1)} below=${r.gapBelow.toFixed(1)}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- live-note-centered-probe.mjs`
Expected: crash or `FAIL` — `positionLiveNote` does not exist yet, so the probe throws inside `p.evaluate` and reports a page error; that also counts as a failing step (confirms the function is missing).

- [ ] **Step 3: Reposition `.live-note` absolutely and add the measuring function**

In `feel-fader.html:293-294`, change:

```css
.live-note{margin:6px 0 0;font-size:12px;color:var(--t3);text-align:center;line-height:1.4;}
.live-note[hidden]{display:none;}
```

to:

```css
.live-note{position:absolute;left:50%;transform:translateX(-50%);margin:0;font-size:12px;color:var(--t3);text-align:center;line-height:1.4;width:max-content;max-width:calc(100% - 32px);}
.live-note[hidden]{display:none;}
```

Add a new function right after `renderConnState()` (i.e., after `feel-fader.html:5272`, the closing `}` of `renderConnState`):

```js
function positionLiveNote() {
  const note = document.getElementById('live-note');
  const stage = document.querySelector('.stage');
  const header = document.querySelector('header');
  const deviceHome = document.getElementById('device-home');
  if (!note || !stage || !header || !deviceHome || note.hidden) return;
  const stageTop = stage.getBoundingClientRect().top;
  const headerBottom = header.getBoundingClientRect().bottom;
  const deviceTop = deviceHome.getBoundingClientRect().top;
  const mid = (headerBottom + deviceTop) / 2;
  note.style.top = `${mid - stageTop - note.offsetHeight / 2}px`;
}
```

- [ ] **Step 4: Call it whenever the note becomes visible**

In `feel-fader.html:5258-5261`, change:

```js
  if (note) {
    note.hidden = (s !== 'CONNECTED_BLIND');
    if (s === 'CONNECTED_BLIND') note.textContent = t('live.note_unavailable');
  }
```

to:

```js
  if (note) {
    note.hidden = (s !== 'CONNECTED_BLIND');
    if (s === 'CONNECTED_BLIND') { note.textContent = t('live.note_unavailable'); positionLiveNote(); }
  }
```

- [ ] **Step 5: Reposition on window resize**

In `feel-fader.html:6647`, alongside the existing resize listeners, add one more line right after the `updateContextualLiveStrip` one:

```js
window.addEventListener('resize', updateContextualLiveStrip, {passive:true});
window.addEventListener('resize', positionLiveNote, {passive:true});
```

(only the second line is new; the first already exists at `feel-fader.html:6647` and stays unchanged — this step just adds a sibling listener directly below it.)

- [ ] **Step 6: Run the probe again to confirm it passes**

Run: `npm test -- live-note-centered-probe.mjs`
Expected: `PASS`.

- [ ] **Step 7: Register the probe and commit**

Add `'live-note-centered-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/live-note-centered-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(stage): center the MIDI-not-connected note between header and controller (TODO #7)"
```

---

### Task 7: Show the configured key combo for HID navigation mode (TODO #1, reduced scope)

**Files:**
- Modify: `feel-fader.html:5196-5202` (JS, `renderLiveStrip`, `track_nav` branch)
- Test: `scratch/nav-hid-live-combo-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: `keyComboLabel(keys)` (existing, `feel-fader.html:2284`) — takes an array of HID usage-ID numbers, returns a joined label string or `'—'` for empty/missing.
- Produces: nothing new.

**Scope note (confirmed by Frank 2026-08-10):** the app has no data channel for "which HID key was just triggered" — `track_nav` mode sends raw USB-HID keystrokes straight to the OS, never over the MIDI/Serial connection the browser listens on (`onMidiMsg()` only handles CC/NoteOn/ProgramChange). A true live indicator needs a firmware change and is out of scope for this batch. This task shows the **configured** roll-up/roll-down key combo instead of a blank dash.

- [ ] **Step 1: Write the failing probe**

Create `scratch/nav-hid-live-combo-probe.mjs`:

```js
// Regression: in track_nav (HID) roller mode, the live-status ROLLER row
// must show the configured key combo instead of a blank dash. There is no
// live "key just triggered" signal available (see task doc) — this shows
// the static, currently-configured combo. Spec: 2026-08-10-todo-batch-design.md §7.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); _ffConnected = true; _midiState = 'granted'; });
await new Promise(r => setTimeout(r, 200));

const r = await p.evaluate(() => {
  setRollerMode(0, 'track_nav');
  cfg.banks[0].nav_keys_cw = [0x4F];  // ArrowRight
  cfg.banks[0].nav_keys_ccw = [0x50]; // ArrowLeft
  renderLiveStrip();
  return {
    value: document.getElementById('live-roller-value').textContent,
    expected: `${keyComboLabel([0x4F])} / ${keyComboLabel([0x50])}`,
  };
});
P('ROLLER value shows the configured nav key combo, not a dash', r.value === r.expected && r.value !== '—',
  `got="${r.value}" expected="${r.expected}"`);

const empty = await p.evaluate(() => {
  cfg.banks[0].nav_keys_cw = [];
  cfg.banks[0].nav_keys_ccw = [];
  renderLiveStrip();
  return document.getElementById('live-roller-value').textContent;
});
P('empty key lists fall back to keyComboLabel\'s own "—" per side', empty.includes('—'), empty);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- nav-hid-live-combo-probe.mjs`
Expected: `FAIL  ROLLER value shows the configured nav key combo, not a dash` (`got="—"`).

- [ ] **Step 3: Add the `track_nav` branch**

In `feel-fader.html:5196-5202`, change:

```js
  const mode = bank?.roller_mode || 'cc';
  let rollerValue = '—', rollerMeter = 0;
  if (allowed && mode === 'cc' && encLiveVal !== null) {
    rollerValue = liveArticulationName(encLiveVal); rollerMeter = encLiveVal;
  } else if (allowed && mode === 'keyswitch' && ksLiveNote !== null) {
    rollerValue = noteName(ksLiveNote); rollerMeter = ksLiveNote;
  }
```

to:

```js
  const mode = bank?.roller_mode || 'cc';
  let rollerValue = '—', rollerMeter = 0;
  if (allowed && mode === 'cc' && encLiveVal !== null) {
    rollerValue = liveArticulationName(encLiveVal); rollerMeter = encLiveVal;
  } else if (allowed && mode === 'keyswitch' && ksLiveNote !== null) {
    rollerValue = noteName(ksLiveNote); rollerMeter = ksLiveNote;
  } else if (allowed && mode === 'track_nav') {
    // No live "key just triggered" signal exists (track_nav sends raw HID
    // keystrokes straight to the OS, never over the MIDI/Serial link this
    // app listens on) — show the configured combo instead (TODO #1, reduced
    // scope, confirmed 2026-08-10).
    rollerValue = `${keyComboLabel(bank.nav_keys_cw || [0x52])} / ${keyComboLabel(bank.nav_keys_ccw || [0x51])}`;
  }
```

- [ ] **Step 4: Run the probe again to confirm it passes**

Run: `npm test -- nav-hid-live-combo-probe.mjs`
Expected: both `PASS`.

- [ ] **Step 5: Register the probe and commit**

Add `'nav-hid-live-combo-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/nav-hid-live-combo-probe.mjs scratch/run-all-probes.mjs
git commit -m "fix(live-hud): show configured nav key combo in HID roller mode instead of a dash (TODO #1)"
```

- [ ] **Step 6: Update the TODO doc note for this item's reduced scope**

This is deferred to Task 10 (closing out the whole batch) — do not edit `docs/TODO.md` yet, all 9 items move to Hotovo together at the end.

---

### Task 8: Replace "?" help icons with hover tooltips (TODO #4)

**Files:**
- Modify: `feel-fader.html:1995` (HTML, add `#hover-tip` container)
- Modify: `feel-fader.html` (new CSS block near `.tx` rule, `feel-fader.html:938`)
- Modify: `feel-fader.html:1887-1889` (HTML, HID row — remove "?" button, add `data-tip`)
- Modify: `feel-fader.html:2199-2217` (JS, `sectionHeaderHtml` — remove help button, add `data-tip`)
- Modify: `feel-fader.html:2771` (JS, `faderSectionContent` call site)
- Modify: `feel-fader.html` (new JS block, hover-tip delegation, near the resize-listener block at `feel-fader.html:6646`)
- Test: `scratch/hover-tip-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `showHoverTip(el)` — internal helper, takes the triggering `Element` (must have a `data-tip` attribute), positions and shows `#hover-tip`.
  - `hideHoverTip()` — internal helper, no arguments, hides `#hover-tip` and clears the pending timer.
  - Any element with a `data-tip="..."` attribute anywhere in the DOM (including elements created later by `renderPanels()`) automatically gets the 2-second hover tooltip via document-level event delegation — no per-element binding needed.

- [ ] **Step 1: Write the failing probe**

Create `scratch/hover-tip-probe.mjs`:

```js
// Regression: hovering a data-tip element for 2s shows a tooltip with its
// text; hovering less than 2s shows nothing; moving away cancels the pending
// timer. The old "?" help-icon buttons (HID row, fader section headers) are
// gone from the DOM. Spec: 2026-08-10-todo-batch-design.md §8.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { skipWelcome(); toggleDeviceSettings(); });
await new Promise(r => setTimeout(r, 200));

const noQuestionMarks = await p.evaluate(() => {
  const hidHelp = document.querySelector('.info-row-action button[onclick*="openHelpAt"]');
  const sectionHelp = document.querySelector('.section-head button[onclick*="openHelpAt"]');
  return { hidHelp: !!hidHelp, sectionHelp: !!sectionHelp };
});
P('HID row "?" button is gone', !noQuestionMarks.hidHelp, String(noQuestionMarks.hidHelp));
P('fader section "?" button is gone', !noQuestionMarks.sectionHelp, String(noQuestionMarks.sectionHelp));

const hidRow = await p.evaluate(() => !!document.querySelector('.info-row-action[data-tip]'));
P('HID row carries a data-tip attribute', hidRow, String(hidRow));

// Hover for 2.1s -> tooltip should show with the row's own text.
const target = await p.$('.info-row-action[data-tip]');
const box = await target.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await new Promise(r => setTimeout(r, 2100));
const shown = await p.evaluate(() => {
  const tip = document.getElementById('hover-tip');
  return { hidden: tip.hidden, text: tip.textContent, hasShowClass: tip.classList.contains('show') };
});
P('tooltip appears after 2s hover with non-empty text', !shown.hidden && shown.hasShowClass && shown.text.length > 0, JSON.stringify(shown));

// Move away -> tooltip hides.
await p.mouse.move(10, 10);
await new Promise(r => setTimeout(r, 100));
const hiddenAfterLeave = await p.evaluate(() => document.getElementById('hover-tip').hidden);
P('tooltip hides on mouseleave', hiddenAfterLeave, String(hiddenAfterLeave));

// Hover for less than 2s -> tooltip never shows.
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await new Promise(r => setTimeout(r, 500));
await p.mouse.move(10, 10);
await new Promise(r => setTimeout(r, 100));
const neverShown = await p.evaluate(() => document.getElementById('hover-tip').hidden);
P('tooltip does not appear before 2s of hover', neverShown, String(neverShown));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- hover-tip-probe.mjs`
Expected: multiple `FAIL` lines (buttons still present, no `data-tip`, `#hover-tip` doesn't exist yet).

- [ ] **Step 3: Add the shared tooltip element and CSS**

In `feel-fader.html:1995`, change:

```html
<div id="toasts" aria-live="polite" aria-atomic="false"></div>
```

to:

```html
<div id="toasts" aria-live="polite" aria-atomic="false"></div>
<div id="hover-tip" class="hover-tip" role="tooltip" hidden></div>
```

Add this CSS block right after the `.tx` rule at `feel-fader.html:938`:

```css
.hover-tip{position:fixed;z-index:300;max-width:220px;padding:6px 10px;border-radius:8px;font:12px/1.4 'Mulish',sans-serif;color:var(--t1);background:var(--chrome-glass-bg);backdrop-filter:var(--chrome-glass-filter);-webkit-backdrop-filter:var(--chrome-glass-filter);border:1px solid var(--chrome-float-border);box-shadow:var(--chrome-glass-shadow);opacity:0;pointer-events:none;transition:opacity .15s ease;}
.hover-tip.show{opacity:1;}
.hover-tip[hidden]{display:none;}
```

- [ ] **Step 4: Remove the HID row's "?" button and add its tooltip text**

In `feel-fader.html:1887-1889`, change:

```html
        <div class="info-row info-row-action">
          <span class="info-lbl">Keyboard (HID)</span>
          <button type="button" class="tx" onclick="openHelpAt('help-hid')" aria-label="Help: Keyboard (HID)" title="Help">?</button>
          <label class="hid-switch" title="Required for Navigation and Button Macro">
```

to:

```html
        <div class="info-row info-row-action" data-tip="Enable HID to let the device send keystrokes — required for the Navigation roller mode and the button long-press macro.">
          <span class="info-lbl">Keyboard (HID)</span>
          <label class="hid-switch" title="Required for Navigation and Button Macro">
```

- [ ] **Step 5: Remove the fader-section "?" button and repurpose the `helpAnchor` parameter**

In `feel-fader.html:2199-2201`, change:

```js
function sectionHeaderHtml(bi, key, cap, title, summary, helpAnchor, extra) {
  const open = isSectionOpen(key);
  const helpBtn = helpAnchor ? `<button type="button" class="tx" onclick="event.stopPropagation();openHelpAt('${helpAnchor}')" aria-label="Help: ${escHtml(title)}" title="Help">?</button>` : '';
```

to:

```js
function sectionHeaderHtml(bi, key, cap, title, summary, tip, extra) {
  const open = isSectionOpen(key);
  const tipAttr = tip ? ` data-tip="${escHtml(tip)}"` : '';
```

In `feel-fader.html:2204-2212`, change:

```js
    return `<div class="section-head section-toggle section-head-editable" data-fader="${key}"
      onclick="if(!event.target.closest('input,button'))toggleSection('${key}',event)">
      <span class="section-toggle-title"><span class="fader-side-cap">${escHtml(cap)}</span>
        <input class="bank-name-input fader-title-input" id="section-title-${bi}-${key}" value="${escHtml(title)}" maxlength="12"
          oninput="onFaderName(${bi},'${key}',this.value)"
          onblur="if(!this.value.trim()){this.value='${defaultFaderName(key)}';onFaderName(${bi},'${key}',this.value)}"
          onkeydown="if(event.key==='Enter')this.blur()" aria-label="${side} fader display name" />
      </span>
      ${helpBtn}
      <button type="button" class="section-toggle-action" id="section-toggle-${bi}-${key}"
```

to:

```js
    return `<div class="section-head section-toggle section-head-editable" data-fader="${key}"${tipAttr}
      onclick="if(!event.target.closest('input,button'))toggleSection('${key}',event)">
      <span class="section-toggle-title"><span class="fader-side-cap">${escHtml(cap)}</span>
        <input class="bank-name-input fader-title-input" id="section-title-${bi}-${key}" value="${escHtml(title)}" maxlength="12"
          oninput="onFaderName(${bi},'${key}',this.value)"
          onblur="if(!this.value.trim()){this.value='${defaultFaderName(key)}';onFaderName(${bi},'${key}',this.value)}"
          onkeydown="if(event.key==='Enter')this.blur()" aria-label="${side} fader display name" />
      </span>
      <button type="button" class="section-toggle-action" id="section-toggle-${bi}-${key}"
```

(The `helpBtn` line is deleted; note this template literal's remaining lines, including the `onclick="toggleSection('${key}',event)"` button below it from Task 2, are otherwise unchanged.)

In `feel-fader.html:2771`, change:

```js
    ${sectionHeaderHtml(bi,key,sideCap,displayLabel,null,'help-faders')}
```

to:

```js
    ${sectionHeaderHtml(bi,key,sideCap,displayLabel,null,'Sends a MIDI CC on a channel you choose. The on-screen fader mirrors the hardware and can\'t be dragged.')}
```

- [ ] **Step 6: Add the hover-tip delegation JS**

Add this block right after the resize-listener group (after the line added in Task 6 Step 5, i.e. right after `window.addEventListener('resize', positionLiveNote, {passive:true});`):

```js
let _hoverTipTimer = null, _hoverTipEl = null;
function showHoverTip(el) {
  const tip = document.getElementById('hover-tip');
  const text = el.getAttribute('data-tip');
  if (!tip || !text) return;
  tip.textContent = text;
  tip.hidden = false;
  tip.style.left = '0px'; tip.style.top = '0px';
  const r = el.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - tr.width / 2), window.innerWidth - tr.width - 8);
  tip.style.left = `${left}px`;
  tip.style.top = `${r.bottom + 8}px`;
  requestAnimationFrame(() => tip.classList.add('show'));
}
function hideHoverTip() {
  clearTimeout(_hoverTipTimer);
  _hoverTipEl = null;
  const tip = document.getElementById('hover-tip');
  if (!tip) return;
  tip.classList.remove('show');
  tip.hidden = true;
}
document.addEventListener('mouseover', event => {
  const el = event.target.closest('[data-tip]');
  if (!el || el === _hoverTipEl) return;
  hideHoverTip();
  _hoverTipEl = el;
  clearTimeout(_hoverTipTimer);
  _hoverTipTimer = setTimeout(() => showHoverTip(el), 2000);
});
document.addEventListener('mouseout', event => {
  const el = event.target.closest('[data-tip]');
  if (!el || (event.relatedTarget && el.contains(event.relatedTarget))) return;
  hideHoverTip();
});
```

(Event delegation on `document` means elements re-created by `renderPanels()` — like the fader section headers — pick up `data-tip` automatically, no re-binding needed.)

- [ ] **Step 7: Run the probe again to confirm it passes**

Run: `npm test -- hover-tip-probe.mjs`
Expected: all `PASS`.

- [ ] **Step 8: Run the existing help-deep-links probe to confirm `openHelpAt()` still works elsewhere**

Run: `npm test -- help-deep-links-probe.mjs`
Expected: all `PASS` (this exercises `openHelpAt()` itself, which this task does not modify — only two of its former call sites are removed).

- [ ] **Step 9: Register the probe and commit**

Add `'hover-tip-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/hover-tip-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(help): replace '?' help icons with 2s hover tooltips (TODO #4)"
```

---

### Task 9: Swipe/drag gesture for welcome-screen tips (TODO #5)

**Files:**
- Modify: `feel-fader.html:2013` (HTML, `#onb-beats` — no structural change needed, listeners attach to the existing element)
- Modify: `feel-fader.html` (new JS block, near `onbBeatGo`/`onbStartWelcome`, after `feel-fader.html:6207` — right after the `onbBeatNext` function)
- Test: `scratch/onb-swipe-probe.mjs` (new)
- Modify: `scratch/run-all-probes.mjs` (register new probe)

**Interfaces:**
- Consumes: `onbBeatGo(i, instant)` (existing, `feel-fader.html:6161`) — clamps `i` to `[0,2]` internally, so no bounds-checking needed by the caller. `_onbBeat` (existing global, current beat index). `_onbBeatTimer` (existing global, auto-advance timer handle).
- Produces: nothing new exported — swipe handling is self-contained pointer-event listeners on `#onb-beats`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-swipe-probe.mjs`:

```js
// Regression: dragging/swiping horizontally over the welcome-screen tips
// carousel changes beats (in addition to the existing dot clicks, which
// must keep working). A swipe below the ~40px threshold is a no-op. Dots
// remain a working alternative input. Spec: 2026-08-10-todo-batch-design.md §9.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); showWelcome(); });
await new Promise(r => setTimeout(r, 200));

const startBeat = await p.evaluate(() => _onbBeat);
P('onboarding starts at beat 0', startBeat === 0, String(startBeat));

// Swipe left (drag right-to-left) past the threshold -> advances to beat 1.
const beats = await p.$('#onb-beats');
const box = await beats.boundingBox();
const cy = box.y + box.height / 2;
await p.mouse.move(box.x + box.width - 20, cy);
await p.mouse.down();
await p.mouse.move(box.x + 20, cy, { steps: 10 });
await p.mouse.up();
await new Promise(r => setTimeout(r, 250));
const afterSwipe = await p.evaluate(() => _onbBeat);
P('swipe past threshold advances to the next beat', afterSwipe === 1, `beat=${afterSwipe}`);

// Small drag below threshold -> no change.
await p.mouse.move(box.x + box.width / 2, cy);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 - 10, cy, { steps: 3 });
await p.mouse.up();
await new Promise(r => setTimeout(r, 100));
const afterSmallDrag = await p.evaluate(() => _onbBeat);
P('drag below the threshold does not change beat', afterSmallDrag === 1, `beat=${afterSmallDrag}`);

// Dots still work.
await p.evaluate(() => onbBeatGo(0));
await new Promise(r => setTimeout(r, 250));
const dot3 = await p.$('.onb-dot:nth-child(3)');
await dot3.click();
await new Promise(r => setTimeout(r, 250));
const afterDotClick = await p.evaluate(() => _onbBeat);
P('dot click still navigates to its beat', afterDotClick === 2, `beat=${afterDotClick}`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- onb-swipe-probe.mjs`
Expected: `FAIL  swipe past threshold advances to the next beat` (nothing listens for pointer drags yet); dot-click assertion should still `PASS` since that path is untouched.

- [ ] **Step 3: Add the swipe listeners**

Add this block right after `onbBeatNext()` (`feel-fader.html:6207`, i.e. immediately before `function onbBeatShowCTA() {`):

```js
(() => {
  const beats = document.getElementById('onb-beats');
  if (!beats) return;
  let dragStartX = null;
  beats.addEventListener('pointerdown', event => {
    if (event.target.closest('.onb-dot')) return; // dots keep their own click handler
    dragStartX = event.clientX;
    clearTimeout(_onbBeatTimer); // user is interacting — don't let auto-advance jump mid-swipe
    beats.setPointerCapture(event.pointerId);
  });
  beats.addEventListener('pointerup', event => {
    if (dragStartX === null) return;
    const dx = event.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(dx) < 40) return;
    onbBeatGo(_onbBeat + (dx < 0 ? 1 : -1));
  });
  beats.addEventListener('pointercancel', () => { dragStartX = null; });
})();
```

- [ ] **Step 4: Run the probe again to confirm it passes**

Run: `npm test -- onb-swipe-probe.mjs`
Expected: all `PASS`.

- [ ] **Step 5: Register the probe and commit**

Add `'onb-swipe-probe.mjs',` to `PROBES` in `scratch/run-all-probes.mjs`.

```bash
git add feel-fader.html scratch/onb-swipe-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(welcome): add swipe/drag gesture to onboarding tips alongside dots (TODO #5)"
```

---

### Task 10: Close out the batch

**Files:**
- Modify: `docs/TODO.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Run the full probe suite**

Run: `npm test`
Expected: `0 failed, 0 crashed` — the tail line should read something like `NNN passed, 0 failed, 0 crashed (NN probes)`. If anything fails, stop and fix it before continuing (do not move TODO items to Hotovo on a red suite).

- [ ] **Step 2: Move all 9 items from Otevřené to Hotovo**

In `docs/TODO.md`, remove items 1-9 from the `## Otevřené` section and add this new subsection under `## Hotovo`, right above the existing `### 2026-08-09 — ...` entry:

```markdown
### 2026-08-10 — 9 UX nálezů z provozu (batch)

1. **Live status bar nezobrazuje triggerované klávesy v HID módu.** Appka nemá žádný datový
   kanál pro "právě triggerovaná klávesa" v `track_nav` módu — roller posílá HID přímo do OS,
   mimo MIDI/Serial spojení, které appka poslouchá. Místo prázdné pomlčky teď ROLLER řádek
   ukazuje **nakonfigurovanou** kombinaci kláves (`keyComboLabel` pro roll-up/roll-down) —
   není to live trigger, skutečné live zobrazení by vyžadovalo firmware změnu (mimo rozsah
   této vlny). Redukovaný scope potvrzen Frankem 2026-08-10.
2. **Skok layoutu při přepnutí artikulace.** `.live-hud-roller .live-hud-value` dostal pevný
   `line-height`, takže `.is-long`/`.is-very-long` font-size varianty už neposouvají řádek pod
   sebou.
3. **Nesouběžný nástup live status baru a "Send to device" po connectu.** Oba reveal teď startují
   ve stejném `setTimeout` (T+1100ms) se sladěnou délkou animace (~0.3s). Přepisuje dřívější
   záměrné rozhodnutí z 2026-07-21 (samostatný beat) — potvrzeno Frankem 2026-08-10.
4. **Zrušit ikony s otazníkem, nahradit hover tooltipy.** Obě "?" tlačítka (HID řádek, LEFT/RIGHT
   FADER sekce) odstraněna; nová sdílená `#hover-tip` komponenta s 2s hover delay přes
   `data-tip` atribut a document-level delegaci.
5. **Přepínání tipů na welcome screenu — drag interakce.** Přidán pointer-drag/swipe gesto nad
   `#onb-beats` (práh 40px) vedle stávajících teček — obojí funguje.
6. **Nadpis "Feel Fader" na welcome screenu.** V "bez tipů" stavu byl nadpis změřením zjištěn
   glued přímo na tlačítko (0px mezera) — `.welcome-copy-stage` dostal větší rezervovanou výšku
   (top-aligned místo center), takže teď je mezi nadpisem a tlačítkem ~24px. `positionWelcomeAnchor()`
   dál drží tlačítko na stejné obrazovkové pozici (ověřeno probem).
7. **"Live positions unavailable" vycentrováno.** Nová `positionLiveNote()` měří `header`/
   `#device-home` a `#live-note` pozicuje absolutně na střed mezi nimi (dřív seděl flush u
   controlleru s celou mezerou nahoře).
8. **Nechtěný modrý focus rám.** `toggleSection()` teď re-fokusuje jen při klávesové aktivaci
   (`event.detail === 0`), ne po myším kliku — `renderPanels()` přestavuje DOM při každém
   přepnutí a programmatic `.focus()` na nový node po myší kliku spouštěl `:focus-visible`.
9. **Přehledová kartička nereaguje na validační chybu.** `renderLiveStrip()` teď volá
   `sectionIssueKeys(liveBank)` a barví `#live-f1-tech`/`#live-f2-tech` přes `.has-issue`
   (`var(--danger)`) — stejný zdroj pravdy jako tab/section tečky.

Testy: 9 nových probes (`art-row-stable-height`, `section-toggle-focus-ring`,
`live-strip-validation-signal`, `welcome-heading-gap`, `connect-reveal-sync`,
`live-note-centered`, `nav-hid-live-combo`, `hover-tip`, `onb-swipe`), registrované v
`scratch/run-all-probes.mjs`. Celá sada: `npm test` zelená.
```

- [ ] **Step 3: Commit the TODO update**

```bash
git add docs/TODO.md
git commit -m "docs(todo): presunout 9 UX nalezu do Hotovo (batch 2026-08-10)"
```

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin todo-batch-2026-08-10
gh pr create --title "TODO batch 2026-08-10: 9 UX fixes" --body "$(cat <<'EOF'
## Summary
- 9 small UI/UX fixes from docs/TODO.md #1-#9 (live-hud stability, welcome-screen layout, focus/a11y, validation signal, hover tooltips, swipe gesture)
- Two items have reduced/revised scope vs. the literal TODO wording, both confirmed by Frank 2026-08-10: #1 shows the configured HID key combo instead of a true live trigger (no data channel exists for that); #3 overrides an earlier explicit 2026-07-21 decision to keep the connect-reveal timing as separate beats

## Test plan
- [x] `npm test` — full probe suite green, including 9 new regression probes
- [ ] Frank: manual HW smoke test (connect flow, HID nav mode, welcome tips swipe)

Spec: docs/superpowers/specs/2026-08-10-todo-batch-design.md
Plan: docs/superpowers/plans/2026-08-10-todo-batch.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Confirm with Frank before running Step 4 — pushing and opening a PR are outward-facing actions.)

---

## Self-Review

**Spec coverage:** all 9 spec sections (§1-§9) map 1:1 to Tasks 1-9; the spec's "Pořadí a ověření" table's 9 verification criteria map to each task's probe; the two Hotovo-note requirements (reduced scope on #1, decision override on #3) are captured in Task 10 Step 2's TODO.md text.

**Placeholder scan:** no TBD/TODO markers; every step has literal before/after code or a literal shell command. Task 5 Step 5's cross-check is explicitly framed as "not expected to reveal anything" rather than a vague "verify manually" — it's a real, runnable command with a stated (already-known) outcome.

**Type/name consistency checked:** `toggleSection(key, event)` (Task 2) is called consistently as `toggleSection('${key}',event)` at all 3 template sites and as `toggleSection('fader1')` (no event) in the untouched existing probe `sections-independent-probe.mjs` — the `!event` guard in Step 3 covers that. `sectionHeaderHtml`'s renamed 6th parameter (`helpAnchor` → `tip`, Task 8) is updated at its only call site that passes a non-null value (`feel-fader.html:2771`); the other two call sites (roller `:3041`, macro `:3120`) already pass no 6th argument and are unaffected. `positionLiveNote()` (Task 6) and `showHoverTip`/`hideHoverTip` (Task 8) are each defined once and referenced only where introduced. `keyComboLabel` (Task 7) is consumed with its existing signature, unchanged.
