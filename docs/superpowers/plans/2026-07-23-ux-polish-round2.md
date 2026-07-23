# UX polish round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six independent, surgical UI fixes in `feel-fader.html` from Frank's post-audit feedback (2026-07-23): remove the welcome-screen dark-mode box, make the header connection text reveal on hover/click instead of staying permanently visible, revert the bank-tab "active on device" glyph to its pre-audit neutral color, make the Live HUD a permanent square (no more compact-pill switching), fix an asymmetric gap around the "Send to device" button when the controller is hidden, and slow the controller show/hide transition from 420ms to 900ms.

**Architecture:** No new architecture. Six localized CSS/JS edits inside the single-file app, each independently revertable (no two tasks touch the same line). Every fact below (root causes, exact values) was verified live against a running `localhost:8100` instance via Chrome DevTools MCP before being written down — not assumed from reading CSS alone, because two of these turned out to have a different root cause than the design spec (`docs/superpowers/specs/2026-07-23-ux-polish-round2-design.md`) guessed.

**Tech Stack:** Vanilla HTML/CSS/JS, Puppeteer-core (already a devDependency) for regression probes, Chrome DevTools MCP for interactive verification during development.

## Global Constraints

- Dev server: `http://localhost:8100/feel-fader.html`. If not running: `python -m http.server 8100` from `c:/Users/Fanda Borec/Documents/feel-fader-app/`. **Do not leave a manually-started server running when you invoke `scratch/run-all-probes.mjs`** — it spawns its own server on the same port and will crash with `EADDRINUSE` if one is already bound (hit this during planning; fixed by killing the stray process).
- **Never** call `navigator.serial.requestPort()` or send real SysEx during verification — wedges the MIDI endpoint until physical USB replug. Simulate connected/live state only via the internal-state-poke pattern: `_midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState();` through `evaluate_script`/`page.evaluate`.
- Do not touch the SysEx/serial protocol, `dec7`/`enc7`, or anything in `../feel-fader-firmware/` — none of these six findings need it, and this repo/firmware never merge in lockstep.
- No two tasks in this plan touch the same file line — every task is independently revertable. If Frank rejects one, skip it; it doesn't block the others.
- Baseline regression suite before this work: `node scratch/run-all-probes.mjs` → **308 passed, 0 failed, 0 crashed (30 probes)**. This must hold after every task.

---

### Task 1: Remove the welcome-screen dark-mode box

**Root cause (verified, not the design spec's original guess):** `.welcome-inner` itself (`feel-fader.html:987-999`) has no background, border, or radius in either theme — it's transparent by default. The visible dark rectangle behind the "Feel Fader" title and "Connect & load" button exists **only in dark mode**, from a single separate rule:

```css
html.dark .welcome-inner{background:var(--bg);}
```

`--bg` is `#0f0f11` in dark mode (near-black) vs `#f5f5f7` in light mode — a flat, sharp-cornered fill (no `border-radius` anywhere on `.welcome-inner`), which is exactly what Frank pointed at as "obdélník" (rectangle, not "rounded box"). Light mode never had this box.

**Files:**
- Modify: `feel-fader.html:1608`
- Test: `scratch/welcome-no-box-probe.mjs` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Delete the dark-mode background rule**

Find (`feel-fader.html:1608`):
```css
html.dark .welcome-inner{background:var(--bg);}
```
Replace with: *(delete the line entirely — no replacement rule needed)*

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/welcome-no-box-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });

// Force dark mode before the welcome screen has closed (skipWelcome not called).
const bg = await p.evaluate(() => {
  document.documentElement.classList.add('dark');
  const inner = document.querySelector('.welcome-inner');
  return getComputedStyle(inner).backgroundColor;
});
P('Welcome box has no background in dark mode', bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent', bg);

// Wordmark and button must still be present and visible (we removed the box, not the content).
const stillThere = await p.evaluate(() => {
  const wordmark = document.querySelector('.welcome-wordmark-text');
  const btn = document.getElementById('send-btn');
  return { wordmarkVisible: !!wordmark && wordmark.offsetParent !== null, btnVisible: !!btn && btn.offsetParent !== null };
});
P('Wordmark still renders', stillThere.wordmarkVisible, JSON.stringify(stillThere));
P('Connect button still renders', stillThere.btnVisible, JSON.stringify(stillThere));

await p.close();
await b.close();
```

Run: `node scratch/welcome-no-box-probe.mjs`
Expected: all three lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/welcome-no-box-probe.mjs
git commit -m "fix(ux): remove welcome-screen dark-mode box background (Frank 2026-07-23)"
```

---

### Task 2: Header status — permanent dot, text reveals on hover/click

**Root cause / prior state:** Yesterday's S-1 audit fix (2026-07-22) made the "device connected" text stay permanently visible on desktop, replacing an even-older 3-second auto-collapse-to-dot behavior (added 2026-07-21 per Frank's own earlier request). Frank now wants a third design: **dot always visible, text revealed only on hover or click/tap**, for `CONNECTED_LIVE` and `CONNECTED_BLIND` only — `MIDI_BLOCKED` and `DISCONNECTED` keep their text permanently visible (rarer states, readability matters more there than compactness).

**Files:**
- Modify: `feel-fader.html:933-943` (CSS), `feel-fader.html:1630` (HTML — add `tabindex`), `feel-fader.html:4735-4774` (`renderConnState()`), `feel-fader.html:5823-5831` (global outside-click handler)
- Test: `scratch/status-hover-reveal-probe.mjs` (new)

**Interfaces:**
- Consumes: existing `t()` i18n helper, `connState()` (unchanged), `.h-status`/`.h-status-dot`/`.h-status-text` DOM (unchanged IDs).
- Produces: `toggleStatusReveal(event)` — new function, called from the HTML `onclick`. Not consumed elsewhere in this plan.

- [ ] **Step 1: Replace the CSS — collapse-by-default text with hover/focus/click reveal**

Find (`feel-fader.html:933-943`):
```css
.h-status-text{
  font-size:11px;color:var(--t3);
  letter-spacing:.02em;
  margin-left:4px;
  transition:opacity .4s,max-width .4s ease,margin-left .4s ease;
}
/* Only the LIVE state auto-hides; give its (short) text a concrete max-width so the
   collapse animates smoothly. Error/disconnected texts stay unconstrained (no clip). */
.h-status-dot.on ~ .h-status-text{max-width:20ch;overflow:hidden;white-space:nowrap;}
.h-status-dot.on ~ .h-status-text.hidden{max-width:0;margin-left:0;}
.h-status-text.hidden{opacity:0;}
```
Replace with:
```css
.h-status-text{
  font-size:11px;color:var(--t3);
  letter-spacing:.02em;
  margin-left:4px;
  max-width:20ch;overflow:hidden;white-space:nowrap;
  transition:opacity .4s,max-width .4s ease,margin-left .4s ease;
}
/* CONNECTED_LIVE/CONNECTED_BLIND only (`.reveal-on-interact`, set in renderConnState()):
   text stays collapsed to the dot until hover, keyboard focus, or a click/tap
   (`.is-revealed`, toggled by toggleStatusReveal()). MIDI_BLOCKED/DISCONNECTED never
   get `.reveal-on-interact` — their text stays permanently visible; readability over
   compactness for the rarer error states (Frank 2026-07-23). */
.h-status.reveal-on-interact .h-status-text{max-width:0;opacity:0;margin-left:0;}
.h-status.reveal-on-interact:hover .h-status-text,
.h-status.reveal-on-interact:focus-visible .h-status-text,
.h-status.reveal-on-interact.is-revealed .h-status-text{max-width:20ch;opacity:1;margin-left:4px;}
```

- [ ] **Step 2: Make `#h-status` keyboard-focusable and clickable**

Find (`feel-fader.html:1630`):
```html
      <span class="h-status" id="h-status" aria-live="polite">
```
Replace with:
```html
      <span class="h-status" id="h-status" aria-live="polite" tabindex="0" onclick="toggleStatusReveal(event)">
```

- [ ] **Step 3: Simplify `renderConnState()` and add the reveal-state bookkeeping**

Find (`feel-fader.html:4735-4774`):
```js
function renderConnState(){
  const status = document.getElementById('h-status');
  const dot  = document.getElementById('h-status-dot');
  const txt  = document.getElementById('h-status-text');
  const note = document.getElementById('live-note');
  if (!dot || !txt) return;
  const s = connState();
  const entering = s !== _lastConnState;
  _lastConnState = s;
  if (s === 'CONNECTED_LIVE'){
    dot.className = 'h-status-dot on';
    if (entering) {
      txt.classList.remove('hidden'); txt.textContent = t('status.connected');
    }
  } else if (s === 'CONNECTED_BLIND'){
    dot.className = 'h-status-dot warn';
    txt.classList.remove('hidden'); txt.textContent = t('status.no_live_view');
  } else if (s === 'MIDI_BLOCKED'){
    dot.className = 'h-status-dot err';
    txt.classList.remove('hidden');
    txt.textContent = _midiState === 'unsupported' ? t('midi.unavailable') : t('midi.denied');
  } else { // DISCONNECTED
    dot.className = 'h-status-dot';
    txt.classList.remove('hidden'); txt.textContent = t('status.no_device');
  }
  if (note) {
    note.hidden = (s !== 'CONNECTED_BLIND');
    if (s === 'CONNECTED_BLIND') note.textContent = t('live.note_unavailable');
  }
  if (s === 'MIDI_BLOCKED') {
    txt.title = _midiState === 'unsupported' ? t('midi.unavailable_help') : t('midi.denied_help');
  } else txt.removeAttribute('title');
  if (status) {
    status.setAttribute('aria-label',txt.textContent);
    status.title = txt.title || txt.textContent;
  }
  renderLiveStrip();
  renderMidiDiagnostics();
  updateNvmDegradedNotice();
}
```
Replace with:
```js
function renderConnState(){
  const status = document.getElementById('h-status');
  const dot  = document.getElementById('h-status-dot');
  const txt  = document.getElementById('h-status-text');
  const note = document.getElementById('live-note');
  if (!dot || !txt) return;
  const s = connState();
  _lastConnState = s;
  const revealOnInteract = (s === 'CONNECTED_LIVE' || s === 'CONNECTED_BLIND');
  if (s === 'CONNECTED_LIVE'){
    dot.className = 'h-status-dot on';
    txt.textContent = t('status.connected');
  } else if (s === 'CONNECTED_BLIND'){
    dot.className = 'h-status-dot warn';
    txt.textContent = t('status.no_live_view');
  } else if (s === 'MIDI_BLOCKED'){
    dot.className = 'h-status-dot err';
    txt.textContent = _midiState === 'unsupported' ? t('midi.unavailable') : t('midi.denied');
  } else { // DISCONNECTED
    dot.className = 'h-status-dot';
    txt.textContent = t('status.no_device');
  }
  if (status) {
    status.classList.toggle('reveal-on-interact', revealOnInteract);
    if (revealOnInteract) status.setAttribute('aria-expanded', status.classList.contains('is-revealed') ? 'true' : 'false');
    else { status.removeAttribute('aria-expanded'); status.classList.remove('is-revealed'); }
  }
  if (note) {
    note.hidden = (s !== 'CONNECTED_BLIND');
    if (s === 'CONNECTED_BLIND') note.textContent = t('live.note_unavailable');
  }
  if (s === 'MIDI_BLOCKED') {
    txt.title = _midiState === 'unsupported' ? t('midi.unavailable_help') : t('midi.denied_help');
  } else txt.removeAttribute('title');
  if (status) {
    status.setAttribute('aria-label',txt.textContent);
    status.title = txt.title || txt.textContent;
  }
  renderLiveStrip();
  renderMidiDiagnostics();
  updateNvmDegradedNotice();
}
function toggleStatusReveal(event) {
  const status = document.getElementById('h-status');
  if (!status || !status.classList.contains('reveal-on-interact')) return;
  event.stopPropagation();
  const revealed = status.classList.toggle('is-revealed');
  status.setAttribute('aria-expanded', revealed ? 'true' : 'false');
}
```
(`_lastConnState` keeps being written for any future transition-detection need, but the `entering`-gated branch is gone — every render now sets `textContent` unconditionally, which is cheap and was the only thing `entering` used to gate.)

- [ ] **Step 4: Close the revealed text on outside click**

Find (`feel-fader.html:5823-5831`, the existing global outside-click handler):
```js
document.addEventListener('pointerdown', event => {
  document.querySelectorAll('.quick-setup-picker').forEach(picker => {
    if (!picker.contains(event.target)) closeQuickSetupMenu(Number(picker.id.split('-').pop()));
  });
  document.querySelectorAll('.ks-preset-picker').forEach(picker => {
    if (!picker.contains(event.target)) closeKsPresetMenu(Number(picker.id.split('-').pop()));
  });
  if (!event.target.closest('.send-callout')) closeChangePopover();
});
```
Replace with:
```js
document.addEventListener('pointerdown', event => {
  document.querySelectorAll('.quick-setup-picker').forEach(picker => {
    if (!picker.contains(event.target)) closeQuickSetupMenu(Number(picker.id.split('-').pop()));
  });
  document.querySelectorAll('.ks-preset-picker').forEach(picker => {
    if (!picker.contains(event.target)) closeKsPresetMenu(Number(picker.id.split('-').pop()));
  });
  if (!event.target.closest('.send-callout')) closeChangePopover();
  const statusEl = document.getElementById('h-status');
  if (statusEl && !statusEl.contains(event.target) && statusEl.classList.contains('is-revealed')) {
    statusEl.classList.remove('is-revealed');
    statusEl.setAttribute('aria-expanded', 'false');
  }
});
```

- [ ] **Step 5: Verify with a Puppeteer probe**

Create `scratch/status-hover-reveal-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

// CONNECTED_LIVE: text collapsed by default, has reveal-on-interact.
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
const liveState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('CONNECTED_LIVE gets reveal-on-interact, text collapsed by default', liveState.hasClass && liveState.maxWidth === '0px', JSON.stringify(liveState));

// Click reveals it.
await p.evaluate(() => document.getElementById('h-status').click());
const afterClick = await p.evaluate(() => {
  const txt = document.getElementById('h-status-text');
  return { maxWidth: getComputedStyle(txt).maxWidth, ariaExpanded: document.getElementById('h-status').getAttribute('aria-expanded') };
});
P('Click reveals the text', afterClick.maxWidth === '20ch' && afterClick.ariaExpanded === 'true', JSON.stringify(afterClick));

// Outside click closes it again.
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})));
const afterOutside = await p.evaluate(() => getComputedStyle(document.getElementById('h-status-text')).maxWidth);
P('Outside click collapses it back', afterOutside === '0px', afterOutside);

// DISCONNECTED: no reveal-on-interact, text always visible.
await p.evaluate(() => { _ffConnected=false; _serialPort=null; connState(); renderConnState(); });
const disconnectedState = await p.evaluate(() => {
  const status = document.getElementById('h-status');
  const txt = document.getElementById('h-status-text');
  return { hasClass: status.classList.contains('reveal-on-interact'), maxWidth: getComputedStyle(txt).maxWidth };
});
P('DISCONNECTED has no reveal-on-interact, text stays visible', !disconnectedState.hasClass && disconnectedState.maxWidth === '20ch', JSON.stringify(disconnectedState));

await p.close();
await b.close();
```

Run: `node scratch/status-hover-reveal-probe.mjs`
Expected: all four lines print `PASS`.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/status-hover-reveal-probe.mjs
git commit -m "fix(ux): header status text reveals on hover/click instead of staying visible (Frank 2026-07-23)"
```

---

### Task 3: Bank tab "active on device" glyph — revert to neutral color

**Root cause:** Yesterday's V-7 audit fix (commit `1672b52`, 2026-07-22) recolored this glyph green. Frank wants the pre-audit neutral color back — confirmed via `git show 1672b52` during design, not from memory.

**Files:**
- Modify: `feel-fader.html:1480`
- Test: `scratch/bank-glyph-neutral-probe.mjs` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Revert the color**

Find (`feel-fader.html:1480`):
```css
.bank-tab-device{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green-text)}
```
Replace with:
```css
.bank-tab-device{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--t2);opacity:.78}
```

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/bank-glyph-neutral-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

// Mark bank 0 as live-on-device so its glyph renders, then read computed style.
const result = await p.evaluate(() => {
  liveBank = 0; renderBankTabs();
  const glyph = document.querySelector('.bank-tab-device');
  if (!glyph) return { found: false };
  const cs = getComputedStyle(glyph);
  return { found: true, color: cs.color, opacity: cs.opacity };
});
P('Glyph renders when a bank is live-on-device', result.found, JSON.stringify(result));
P('Glyph is NOT green', result.found && !result.color.includes('52, 199') && !result.color.includes('96, 155'), result.color);
P('Glyph uses --t2 opacity .78 (not the old fully-opaque green)', result.found && Math.abs(parseFloat(result.opacity) - 0.78) < 0.01, result.opacity);

await p.close();
await b.close();
```

Run: `node scratch/bank-glyph-neutral-probe.mjs`
Expected: all three lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/bank-glyph-neutral-probe.mjs
git commit -m "fix(ux): revert bank-tab active-on-device glyph to neutral color (Frank 2026-07-23)"
```

---

### Task 4: Live HUD — permanent square, no compact-pill switching

**Root cause:** Yesterday's Codex feature wave made `.is-compact` unconditional — hardcoded in the initial HTML class and force-added every render in `updateContextualLiveStrip()`. Frank compared three options live (always-square / always-pill / contextual-switch-like-before) via the brainstorming companion and picked **always-square** (Option A).

**Verified live during planning, not assumed:**
- Position formula (`headerBottom + 12px`) is unchanged from before yesterday's wave and was measured at exactly 12px via DevTools — Frank's "too low" complaint was the wide pill's visual weight, not a position bug. No position change needed.
- Base (non-compact) `.live-hud` CSS already renders correctly today (112×112px, 22px radius, 2×2 grid) — confirmed by removing `is-compact` live and screenshotting.
- Long articulation names in the narrower square roller row (48px max column vs the pill's much wider one) already truncate gracefully via the existing `.live-hud-roller .live-hud-value{overflow:hidden;text-overflow:ellipsis}` rule (`feel-fader.html:171`) — confirmed live with a 22-character test name ("Sul Tasto Tremolo Long" → renders as "Sul Tasto …", no overflow, no layout break). **No new CSS thresholds needed for this edge case.**

**Files:**
- Modify: `feel-fader.html:1665` (HTML — drop `is-compact` from the initial class), `feel-fader.html:4657-4671` (`updateContextualLiveStrip()` — stop force-adding it)
- Test: `scratch/live-hud-square-probe.mjs` (new)

**Interfaces:**
- Consumes: existing `#live-strip` DOM, `updateContextualLiveStrip()` (unchanged signature).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Drop `is-compact` from the initial HTML class**

Find (`feel-fader.html:1665`):
```html
<div class="live-hud is-compact" id="live-strip" data-state="DISCONNECTED" data-side="left" role="group" tabindex="0" aria-label="Live device values. Drag left or right to reposition." aria-hidden="true">
```
Replace with:
```html
<div class="live-hud" id="live-strip" data-state="DISCONNECTED" data-side="left" role="group" tabindex="0" aria-label="Live device values. Drag left or right to reposition." aria-hidden="true">
```

- [ ] **Step 2: Stop force-adding `is-compact` on every render**

Find (`feel-fader.html:4657-4671`):
```js
function updateContextualLiveStrip(){
  const strip = document.getElementById('live-strip');
  const welcome = document.getElementById('welcome-screen');
  if (!strip) return;
  const headerBottom = document.querySelector('.top-sticky')?.getBoundingClientRect().bottom || 0;
  const welcomeClosed = !!welcome?.classList.contains('hidden');
  const hasLiveData = !!(liveSeen.f1 || liveSeen.f2 || encLiveVal !== null || ksLiveNote !== null);
  const live = strip.dataset.state === 'CONNECTED_LIVE' && hasLiveData;
  const visible = welcomeClosed;
  strip.style.top = `${Math.round(headerBottom + 12)}px`;
  strip.classList.toggle('is-contextual-visible',visible);
  strip.classList.toggle('is-idle',!live);
  strip.classList.add('is-compact');
  strip.setAttribute('aria-hidden',String(!visible));
}
```
Replace with:
```js
function updateContextualLiveStrip(){
  const strip = document.getElementById('live-strip');
  const welcome = document.getElementById('welcome-screen');
  if (!strip) return;
  const headerBottom = document.querySelector('.top-sticky')?.getBoundingClientRect().bottom || 0;
  const welcomeClosed = !!welcome?.classList.contains('hidden');
  const hasLiveData = !!(liveSeen.f1 || liveSeen.f2 || encLiveVal !== null || ksLiveNote !== null);
  const live = strip.dataset.state === 'CONNECTED_LIVE' && hasLiveData;
  const visible = welcomeClosed;
  strip.style.top = `${Math.round(headerBottom + 12)}px`;
  strip.classList.toggle('is-contextual-visible',visible);
  strip.classList.toggle('is-idle',!live);
  strip.setAttribute('aria-hidden',String(!visible));
}
```

- [ ] **Step 3: Verify with a Puppeteer probe**

Create `scratch/live-hud-square-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 500)); // let the position/visibility transition settle

const shape = await p.evaluate(() => {
  const strip = document.getElementById('live-strip');
  const cs = getComputedStyle(strip);
  return { hasCompact: strip.classList.contains('is-compact'), width: cs.width, height: cs.height, borderRadius: cs.borderRadius };
});
P('is-compact never gets added', !shape.hasCompact, JSON.stringify(shape));
P('Renders as a 112x112 square, not a pill', shape.width === '112px' && shape.height === '112px' && shape.borderRadius === '22px', JSON.stringify(shape));

const gap = await p.evaluate(() => {
  const strip = document.getElementById('live-strip');
  const header = document.querySelector('.top-sticky') || document.querySelector('header');
  return Math.round(strip.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
});
P('Position gap under header is still 12px (unchanged by the shape fix)', gap === 12, `gap=${gap}px`);

// Long articulation name still truncates gracefully instead of overflowing the card.
const longName = await p.evaluate(() => {
  const val = document.getElementById('live-roller-value');
  val.textContent = 'Sul Tasto Tremolo Long';
  val.classList.add('is-very-long');
  const rect = val.getBoundingClientRect();
  const cardRect = document.getElementById('live-strip').getBoundingClientRect();
  return { valueRight: rect.right, cardRight: cardRect.right, overflowsCard: rect.right > cardRect.right + 1 };
});
P('Long articulation name does not overflow the card', !longName.overflowsCard, JSON.stringify(longName));

await p.close();
await b.close();
```

Run: `node scratch/live-hud-square-probe.mjs`
Expected: all four lines print `PASS`.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html scratch/live-hud-square-probe.mjs
git commit -m "fix(ux): Live HUD permanently square, no more compact-pill switching (Frank 2026-07-23, option A of 3)"
```

---

### Task 5: Symmetric gap around "Send to device" when controller is hidden

**Root cause (verified live, different from the design spec's original guess):** The design spec guessed `.stage`'s padding stacking with `.send-callout`'s margin was the cause. That's wrong — `.send-anchor.docked .send-callout{margin:0}` already zeroes that margin when docked, and the collapsed `.stage-collapse` measures 0px tall. The real cause: `#send-sticky-row` (`feel-fader.html:963-966`) is a **sibling of `<header>`**, not a child of `.center-col` — its own `padding:14px 0` gives it a symmetric 14px top/bottom on its own. But `.center-col{display:flex;flex-direction:column;gap:16px}` still reserves its **16px flex `gap`** between the (invisible, 0-height) `.stage-collapse` and the next visible block (`#panels-row`/`.bank-card`) — CSS flexbox `gap` applies between adjacent items regardless of one item's collapsed content height. That phantom 16px only shows up *below* the button (between the row and the bank card), never above it (the row sits before `.center-col` entirely) — hence the asymmetry: 14px above, 14+16=30px below.

Measured live via DevTools before and after the fix:
- Before: `gapHeaderToButton: 14`, `gapButtonToBankCard: 30`.
- After changing `.send-sticky-row`'s padding to `32px 0 16px`: `gapHeaderToButton: 32`, `gapButtonToBankCard: 32` — exactly symmetric, and reuses the app's existing 32px spacing constant (already used by `.stage{padding:32px...}` and `.send-callout{margin:32px...}`) rather than inventing a new number.

**Files:**
- Modify: `feel-fader.html:963-966`
- Test: `scratch/send-dock-gap-symmetry-probe.mjs` (new)

**Interfaces:**
- Consumes: existing `applySendAnchorDock()`/`toggleControllerVisibility()` (unchanged).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Change the padding**

Find (`feel-fader.html:963-966`):
```css
.send-sticky-row{
  display:flex;align-items:center;justify-content:center;padding:14px 0;
}
.send-sticky-row[hidden]{display:none}
```
Replace with:
```css
.send-sticky-row{
  display:flex;align-items:center;justify-content:center;padding:32px 0 16px;
}
.send-sticky-row[hidden]{display:none}
```
(The 16px flex-gap contributed by the collapsed `.stage-collapse` in `.center-col` sits *below* this row and can't be removed without restructuring the flex layout — so the row's own bottom padding is set to 16px, giving 16+16=32px below, matching a new 32px top padding above. Both sides land on the app's existing 32px spacing unit.)

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/send-dock-gap-symmetry-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });
await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });

// Hide the controller and let the .9s collapse transition finish (Task 6 slows this
// to 900ms — wait long enough to cover either the old 420ms or the new 900ms value).
await p.evaluate(() => toggleControllerVisibility(false));
await new Promise(r => setTimeout(r, 1000));

const gaps = await p.evaluate(() => {
  const header = document.querySelector('header');
  const callout = document.querySelector('.send-callout');
  const bankCard = document.querySelector('.bank-card');
  const hRect = header.getBoundingClientRect();
  const cRect = callout.getBoundingClientRect();
  const bRect = bankCard.getBoundingClientRect();
  return {
    above: Math.round(cRect.top - hRect.bottom),
    below: Math.round(bRect.top - cRect.bottom),
  };
});
P('Gap above and below the docked Send button match', gaps.above === gaps.below, JSON.stringify(gaps));
P('Gap is 32px on both sides', gaps.above === 32 && gaps.below === 32, JSON.stringify(gaps));

await p.close();
await b.close();
```

Run: `node scratch/send-dock-gap-symmetry-probe.mjs`
Expected: both lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/send-dock-gap-symmetry-probe.mjs
git commit -m "fix(ux): symmetric gap around docked Send button when controller is hidden (Frank 2026-07-23)"
```

---

### Task 6: Slow the controller show/hide transition (420ms → 900ms)

**Confirmed via the brainstorming companion:** Frank watched looping 420ms/650ms/900ms comparisons side by side and picked 900ms.

**Files:**
- Modify: `feel-fader.html:207-208`
- Test: `scratch/controller-toggle-speed-probe.mjs` (new)

**Interfaces:**
- Consumes: existing `applyStageCollapse()` (unchanged — only the CSS duration changes).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Change both transition durations**

Find (`feel-fader.html:207-208`):
```css
.stage-collapse{display:grid;grid-template-rows:minmax(0,1fr);transition:grid-template-rows .42s cubic-bezier(.16,1,.3,1)}
.stage-collapse>.stage{overflow:hidden;min-height:0;transition:opacity .42s cubic-bezier(.16,1,.3,1),transform .42s cubic-bezier(.16,1,.3,1)}
```
Replace with:
```css
.stage-collapse{display:grid;grid-template-rows:minmax(0,1fr);transition:grid-template-rows .9s cubic-bezier(.16,1,.3,1)}
.stage-collapse>.stage{overflow:hidden;min-height:0;transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
```
(`prefers-reduced-motion` branch at `feel-fader.html:211-213`, `.stage-collapse,.stage-collapse>.stage{transition:none}`, is untouched — reduced-motion users still get an instant toggle.)

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/controller-toggle-speed-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

const durations = await p.evaluate(() => {
  const wrap = getComputedStyle(document.getElementById('stage-collapse'));
  const inner = getComputedStyle(document.querySelector('#stage-collapse > .stage'));
  return { wrapTransition: wrap.transitionDuration, innerTransition: inner.transitionDuration };
});
P('Container transition is 0.9s', durations.wrapTransition === '0.9s', durations.wrapTransition);
P('Inner .stage transition is 0.9s for both properties', durations.innerTransition === '0.9s, 0.9s', durations.innerTransition);

// prefers-reduced-motion still collapses to `none`.
const reduced = await p.evaluate(async () => {
  const style = document.createElement('style');
  style.textContent = '@media(prefers-reduced-motion:no-preference){}'; // no-op, real check is emulated by Puppeteer below
  return true;
});
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const reducedDuration = await p.evaluate(() => getComputedStyle(document.getElementById('stage-collapse')).transitionDuration);
P('prefers-reduced-motion still disables the transition', reducedDuration === '0s', reducedDuration);

await p.close();
await b.close();
```

Run: `node scratch/controller-toggle-speed-probe.mjs`
Expected: all three lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/controller-toggle-speed-probe.mjs
git commit -m "fix(ux): slow controller show/hide transition to 900ms (Frank 2026-07-23, picked via companion A/B/C)"
```

---

## Plan Self-Review

**Spec coverage:** All 6 spec items map to a task 1:1 — spec §1→Task 1, §2→Task 2, §3→Task 3, §4→Task 4, §5→Task 5, §6→Task 6. That's 6/6.

**No two tasks touch the same file line** — checked explicitly: Task 1 (1608), Task 2 (933-943, 1630, 4735-4774, 5823-5831), Task 3 (1480), Task 4 (1665, 4657-4671), Task 5 (963-966), Task 6 (207-208). No overlaps.

**Placeholder scan:** No TBD/TODO. Both of the spec's deferred "otevřené technické otázky" got resolved with real values during planning (live DevTools verification), not left open: Task 4's long-name concern turned out to already be handled (verified, no new CSS needed) and Task 5's exact spacing value (32px) was measured, not guessed.

**Type/interface consistency:** No task introduces a function another task calls, except Task 2's `toggleStatusReveal()` (self-contained, only referenced by its own HTML `onclick`). No cross-task naming risk.

**Root-cause corrections from the design spec, flagged for Frank:** Two tasks (5's spacing cause, and confirming 4's position math) turned out to have a different mechanism than the design spec guessed, discovered via live DevTools inspection during planning rather than assumed from reading CSS. The design spec's *intent* (symmetric gap, unchanged position) is unaffected — only the *implementation mechanism* changed from what was guessed.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-ux-polish-round2.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
