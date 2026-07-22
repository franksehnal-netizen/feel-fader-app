# UX Audit 2026-07-22 — Fix Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 14 findings from `docs/feel-fader-ux-audit-2026-07-22.md` (1 P1, 8 P2, 5 P3) — a broken Undo/change-history popover, four regressions of already-fixed 06-27 discipline (typography, weight, spacing, contrast), and several smaller consistency/a11y issues — without touching the serial/MIDI protocol or `WEBAPP.md`'s functional description of any section.

**Architecture:** `feel-fader.html` is a single-file vanilla JS/CSS app (no build step). Every fix here is a localized CSS or small-function edit inside that one file; no new files except one consolidated Puppeteer regression probe for the fixes that are genuinely risky to regress silently (stacking-context bug, mobile overflow, native-select replacement, switch color, status collapse).

**Tech Stack:** Vanilla HTML/CSS/JS, Puppeteer-core (already a devDependency) for the regression probe, Chrome DevTools MCP for interactive/render verification during development (never against real hardware/serial — see Global Constraints).

## Global Constraints

- Dev server: `http://localhost:8100/feel-fader.html`. If not running, start with `python -m http.server 8100` from `c:/Users/Fanda Borec/Documents/feel-fader-app/`.
- **Never** call `navigator.serial.requestPort()` or send real SysEx during verification — it wedges the MIDI endpoint until physical USB replug (HW finding 2026-07-07). Simulate connected/live state only via the internal-state-poke pattern: `_midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState();` run through `evaluate_script`/`page.evaluate`.
- Do not change anything described by `WEBAPP.md` as functional behavior of a section without also correcting `WEBAPP.md` in the same task (only Task 11 needs this — it corrects a doc-drift the audit found).
- Do not touch the SysEx/serial protocol, `dec7`/`enc7`, or anything in `../feel-fader-firmware/` — none of these findings require it, and this repo/firmware never merge in lockstep.
- Every task below is independently revertable — if Frank rejects one, skip it; it does not block any other task's edit (verified: no two tasks touch the same line).
- Font sizes across this plan settle on the already-approved 06-27 scale (22/16/13/12/11/10) wherever a finding calls for consolidation — no new sizes are introduced.

---

### Task 1: I-1 (P1) — Change-history popover trapped behind bank card

**Files:**
- Modify: `feel-fader.html:1074-1075` (existing `:has()` z-index-reset precedent, extend it)
- Test: `scratch/i1-change-popover-probe.mjs` (new)

**Interfaces:**
- Consumes: existing `.change-popover.is-open` class toggled by `toggleChangePopover()` (already in the file, untouched).
- Produces: nothing new consumed by later tasks.

**Root cause — two layered problems, both confirmed live (2026-07-22, first implementer attempt + controller follow-up), not just from the audit's citation.**

1. **Stacking-context trap:** `.change-popover` (z-index:30) is a direct child of `.send-callout` (`position:relative;z-index:10`), nested inside `.stage` (`position:relative;z-index:1`). The same class of bug was already hit and fixed once for `#send-btn.welcome-floating` at line 1058-1075. Fix: drop `.stage`/`.send-callout` to `z-index:auto` while the popover is open, identical to that precedent.
2. **This alone is not sufficient** — verified by brute-forcing `z-index:999999` on the popover directly in a live render: the hit-test still failed. The real remaining blocker is `overflow:hidden` on `.stage`, set unconditionally by `.stage-collapse>.stage{overflow:hidden;...}` (line 201 — `.stage-collapse` is a permanent wrapper div at line 1647, used for the bank-switch collapse/fade grid animation, not a conditional class). `.change-popover` is `position:absolute` (unlike the `position:fixed` welcome-floating precedent, which is exempt from ancestor clipping) and its `top:calc(100% + 12px)` box falls outside `.stage`'s own border-box, so `overflow:hidden` clips it regardless of z-index. Confirmed by forcing `.stage{overflow:visible}` live with the z-index fix still applied: the hit-test then passes.

Fix both in the same scoped `:has()` idiom already used in this file:

- [ ] **Step 1: Add the scoped z-index reset AND the scoped overflow reset**

In `feel-fader.html`, find (around line 1074-1075):
```css
.stage:has(#send-btn.welcome-floating),
.send-callout:has(>#send-btn.welcome-floating){z-index:auto}
```
Replace with:
```css
.stage:has(#send-btn.welcome-floating),
.send-callout:has(>#send-btn.welcome-floating){z-index:auto}
/* Same trap, different trigger: .change-popover (z-index:30) is a direct
   child of .send-callout (z-index:10) inside .stage (z-index:1) — both
   explicit stacking contexts confine the popover's own z-index to *inside*
   .send-callout, so it can never out-rank .panels-row's .bank-card
   (isolation:isolate) one level up. Undo/Restore last sent buttons were
   unclickable underneath the bank card (UX audit 2026-07-22, I-1). Drop
   both ancestors to z-index:auto only while the popover is open, exactly
   like the welcome-floating case above. */
.stage:has(.change-popover.is-open),
.send-callout:has(>.change-popover.is-open){z-index:auto}
/* z-index alone isn't enough: .stage-collapse>.stage{overflow:hidden}
   (line 201, permanent — used for the bank-switch collapse animation) clips
   .change-popover's box regardless of stacking order, since the popover is
   position:absolute (not :fixed like the welcome-floating case) and its
   dropdown extends below .stage's own border-box. Scope it off the same way,
   only while the popover is open. Trade-off: if a bank-switch collapse
   transition happens to run at the exact same moment the popover is open,
   .stage briefly won't clip it — rare, cosmetic-only overlap, not a
   functional break. */
.stage-collapse:has(.change-popover.is-open)>.stage{overflow:visible}
```

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/i1-change-popover-probe.mjs`:
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

// Make a dirty change so the "N unsaved changes" pill + popover exist.
await p.evaluate(() => { cfg.banks[0].fader1.cc = (cfg.banks[0].fader1.cc + 1) % 128; dirty = true; render(); reflectDirty(); });
await p.evaluate(() => toggleChangePopover());
await new Promise(r => setTimeout(r, 300));

const hit = await p.evaluate(() => {
  const btn = document.getElementById('change-undo-btn');
  const r = btn.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return { hitIsButton: el === btn, hitTag: el?.tagName, hitClass: el?.className };
});
P('Undo button is the actual hit target (not occluded)', hit.hitIsButton, JSON.stringify(hit));

await p.evaluate(() => document.getElementById('change-undo-btn').click());
await new Promise(r => setTimeout(r, 200));
const afterUndo = await p.evaluate(() => document.getElementById('change-popover').classList.contains('is-open'));
P('Clicking Undo closes the popover (undoLastConfigChange -> closeChangePopover)', afterUndo === false, `is-open after click: ${afterUndo}`);

await p.close();
await b.close();
```

Run: `node scratch/i1-change-popover-probe.mjs`
Expected: both lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/i1-change-popover-probe.mjs
git commit -m "fix(ux): unstick change-history popover trapped behind bank card (I-1)"
```

---

### Task 2: V-1 (partial) + V-2 (partial) + V-3 + A-2 — Quick-setup picker & keyswitch key-label sweep

Combined into one task because every line below is touched by more than one finding — splitting them would mean two tasks editing the same line, which breaks whichever runs second.

**Files:**
- Modify: `feel-fader.html:450` (`.ks-key-label`), `feel-fader.html:1465-1466`, `feel-fader.html:1467-1470`, `feel-fader.html:1474`, `feel-fader.html:1476`

- [ ] **Step 1: `.ks-key-label` — font-size (V-1), weight (V-2), spacing (V-3)**

Find:
```css
.ks-key-label{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);font-size:8px;font-weight:500;white-space:nowrap;pointer-events:none}
```
Replace with:
```css
.ks-key-label{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);font-size:10px;font-weight:600;white-space:nowrap;pointer-events:none}
```

- [ ] **Step 2: Quick-setup group spacing (V-3) and label size/contrast (V-1, A-2)**

Find:
```css
.quick-setup-group+.quick-setup-group{margin-top:5px;padding-top:5px;border-top:1px solid var(--border)}
.quick-setup-group-label{padding:4px 7px 3px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
```
Replace with:
```css
.quick-setup-group+.quick-setup-group{margin-top:4px;padding-top:4px;border-top:1px solid var(--border)}
.quick-setup-group-label{padding:4px 8px 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t2)}
```

- [ ] **Step 3: Quick-setup option row padding (V-3)**

Find:
```css
.quick-setup-option{
  width:100%;display:flex;align-items:center;gap:8px;padding:7px;border:0;border-radius:var(--r-sm);
  background:transparent;color:var(--t1);font:600 11px 'Mulish',sans-serif;text-align:left;cursor:pointer
}
```
Replace with:
```css
.quick-setup-option{
  width:100%;display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:var(--r-sm);
  background:transparent;color:var(--t1);font:600 11px 'Mulish',sans-serif;text-align:left;cursor:pointer
}
```

- [ ] **Step 4: Quick-setup option-kind size/contrast (V-1, A-2)**

Find:
```css
.quick-setup-option-kind{font-size:9px;font-weight:600;color:var(--t3);white-space:nowrap}
```
Replace with:
```css
.quick-setup-option-kind{font-size:10px;font-weight:600;color:var(--t2);white-space:nowrap}
```

- [ ] **Step 5: Quick-preset button padding (V-3)**

Find:
```css
.quick-preset-btn{min-height:28px;padding:4px 11px;font-size:11px;white-space:nowrap;color:var(--t1)}
```
Replace with:
```css
.quick-preset-btn{min-height:28px;padding:4px 12px;font-size:11px;white-space:nowrap;color:var(--t1)}
```

- [ ] **Step 6: Verify with Chrome DevTools MCP**

With the dev server running, navigate to `http://localhost:8100/feel-fader.html`, skip welcome, open a bank's Library setup picker and a keyswitch section, then run:
```js
() => {
  const gl = getComputedStyle(document.querySelector('.quick-setup-group-label'));
  const ok1 = document.querySelector('.quick-setup-option-kind');
  const ksLbl = document.querySelector('.ks-key-label');
  return {
    groupLabelFont: gl.fontSize, groupLabelColor: gl.color,
    optionKindFont: ok1 ? getComputedStyle(ok1).fontSize : 'not rendered (need a saved custom preset)',
    ksKeyLabelFont: ksLbl ? getComputedStyle(ksLbl).fontSize : 'not rendered (need keyswitch mode + a C note visible)'
  };
}
```
Expected: `groupLabelFont: "10px"`, `groupLabelColor` no longer `rgb(174, 174, 178)` (that was `--t3`), `optionKindFont: "10px"` (if a custom preset exists to render the row), `ksKeyLabelFont: "10px"`.

- [ ] **Step 7: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): revert quick-setup/keyswitch type-scale, spacing, contrast regressions (V-1/V-2/V-3/A-2)"
```

---

### Task 3: V-1 (remainder) — Type-scale regressions outside the quick-setup block

**Files:**
- Modify: `feel-fader.html:163` (`.live-hud-value`), `:175` (`.live-hud.is-compact .live-hud-value`), `:542` (`.bank-name-input`), `:1168` (`.live-hud-roller .live-hud-value`), `:1220` (`.confirm-body strong`), `:1501` (`.library-preview-head strong`)

Note: `.bank-icon-display{font-size:20px}` (line 1331) is **deliberately not touched** — the audit's own recommendation explicitly carves out 20px as acceptable "as an icon glyph, not text," and this selector renders an emoji icon, not text.

- [ ] **Step 1: Live HUD value readouts (9px/8px → 10px)**

Find:
```css
.live-hud-value{min-width:3ch;text-align:center;color:var(--t1);font:600 9px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:visible;text-overflow:clip}
```
Replace with:
```css
.live-hud-value{min-width:3ch;text-align:center;color:var(--t1);font:600 10px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:visible;text-overflow:clip}
```

Find:
```css
.live-hud.is-compact .live-hud-value{min-width:0;font-size:9px}
```
Replace with:
```css
.live-hud.is-compact .live-hud-value{min-width:0;font-size:10px}
```

Find:
```css
.live-hud-roller .live-hud-value{font-size:8px}
```
Replace with:
```css
.live-hud-roller .live-hud-value{font-size:10px}
```

- [ ] **Step 2: Bank-name input and dialog headings (15px → 16px)**

Find:
```css
.bank-name-input{
  flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid transparent;
  font-family:'Mulish',sans-serif;font-size:15px;font-weight:600;color:var(--t1);
  outline:none;padding:2px 0;transition:border-color .14s;
  text-align:left;letter-spacing:-.01em;
}
```
Replace with:
```css
.bank-name-input{
  flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid transparent;
  font-family:'Mulish',sans-serif;font-size:16px;font-weight:600;color:var(--t1);
  outline:none;padding:2px 0;transition:border-color .14s;
  text-align:left;letter-spacing:-.01em;
}
```

Find:
```css
.confirm-body strong{display:block;color:var(--t1);font-size:15px;margin-bottom:6px}
```
Replace with:
```css
.confirm-body strong{display:block;color:var(--t1);font-size:16px;margin-bottom:6px}
```

Find:
```css
.library-preview-head strong{display:block;font-size:15px;color:var(--t1);margin-bottom:4px}
```
Replace with:
```css
.library-preview-head strong{display:block;font-size:16px;color:var(--t1);margin-bottom:4px}
```

- [ ] **Step 3: Verify with Chrome DevTools MCP**

```js
() => {
  const bn = getComputedStyle(document.querySelector('.bank-name-input'));
  const lh = getComputedStyle(document.querySelector('.live-hud-value'));
  return { bankNameFont: bn.fontSize, liveHudFont: lh.fontSize };
}
```
Expected: `bankNameFont: "16px"`, `liveHudFont: "10px"`. Open a confirm dialog (e.g. delete a bank) and the Library-setup preview to spot-check those two headings read 16px too.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): consolidate remaining 15/9/8px type-scale regressions to 16/10px (V-1)"
```

---

### Task 4: V-2 (remainder) + I-2 — Help button contrast/touch-target, remaining weight regression

**Files:**
- Modify: `feel-fader.html:836` (`.tx`), `:868` (coarse-pointer touch targets), `:1259` (`.section-summary-sep`)

- [ ] **Step 1: `.tx` (help button) — drop opacity, fix weight**

Find:
```css
.tx{display:grid;width:26px;height:26px;flex:0 0 26px;margin-left:1px;padding:0;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--t2);cursor:pointer;opacity:.5;font:500 11px 'Mulish',sans-serif;transition:background-color .16s ease,color .16s ease,opacity .16s ease,transform .12s ease}
```
Replace with:
```css
.tx{display:grid;width:26px;height:26px;flex:0 0 26px;margin-left:1px;padding:0;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--t2);cursor:pointer;font:600 11px 'Mulish',sans-serif;transition:background-color .16s ease,color .16s ease,opacity .16s ease,transform .12s ease}
```
(Dropping the static `opacity:.5` fixes I-2's ~2.2:1 contrast — `color:var(--t2)` alone already passes AA, per the 06-27 A4 fix. `font:500`→`600` fixes V-2's Mulish-500 regression. The `opacity .16s ease` transition entry is left alone; nothing currently animates `.tx`'s opacity, but removing it isn't part of either finding.)

- [ ] **Step 2: `.tx` touch target on coarse pointers (I-2 — was 32px, needs 44px)**

Find:
```css
  .uacc-tag button,.tx{min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center}
```
Replace with:
```css
  .uacc-tag button{min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center}
  .tx{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
```

- [ ] **Step 3: `.section-summary-sep` weight (V-2)**

Find:
```css
.section-summary-sep{color:var(--t3);font:500 10px 'Mulish',sans-serif}
```
Replace with:
```css
.section-summary-sep{color:var(--t3);font:600 10px 'Mulish',sans-serif}
```

- [ ] **Step 4: Verify with Chrome DevTools MCP**

```js
() => {
  const help = document.querySelector('[aria-label^="Help"]');
  const cs = help ? getComputedStyle(help) : null;
  return cs ? { opacity: cs.opacity, fontWeight: cs.fontWeight, color: cs.color } : 'no help button rendered in current view — open a fader section or Device & Settings';
}
```
Expected: `opacity: "1"`, `fontWeight: "600"`. Then re-run with `emulate` set to a touch-capable viewport (`390x844x2,mobile,touch`) and confirm `getBoundingClientRect()` on the same button is ≥44×44.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): help-button contrast and touch target (I-2), remaining Mulish-500 regression (V-2)"
```

---

### Task 5: V-4 — Replace RANGE PRESET native `<select>` with a custom listbox

Frank asked for the full custom listbox (not the lighter restyle) — built as a small button+popover component reusing the app's *existing* listbox pattern (`.quick-setup-menu`/`.quick-setup-option`, already used by the Library setup picker at `feel-fader.html:2495-2500` and its JS at `feel-fader.html:5578-5604,5686-5698,5706-5710`), not a new one-off widget. `KEYSWITCH_PRESETS` (`feel-fader.html:3452-3455`) only has 2 static entries and no search, so this is deliberately lighter than the Library picker (no input/filtering) — same listbox mechanics, no combobox layer.

**Files:**
- Modify: `feel-fader.html:459` (replace `.ks-preset-sel`), `feel-fader.html:2716` (`presetOpts` → new option-HTML builder), `feel-fader.html:2729-2734` (HTML: select → picker), `feel-fader.html:5706-5710` (extend outside-click closer)
- Create (new functions, place next to `applyKsPreset` at `feel-fader.html:3654-3660`): `toggleKsPresetMenu`, `openKsPresetMenu`, `closeKsPresetMenu`, `ksPresetOptionKey`
- Test: `scratch/v4-ks-preset-listbox-probe.mjs` (new)

**Interfaces:**
- Consumes: `KEYSWITCH_PRESETS` array (`{name, lo, hi}` or `{name, notes}`), `applyKsPreset(bi, idx)` (unchanged — still takes the same string/number index and applies it to `cfg.banks[bi].ks_notes`), `.quick-setup-option` CSS class (reused as-is, not modified), `refreshBankMenuLayer()` (unchanged — already queries `.quick-setup-menu:not([hidden])`, and the new menu carries that class so no edit needed there).
- Produces: `toggleKsPresetMenu(bi)`, `openKsPresetMenu(bi)`, `closeKsPresetMenu(bi, returnFocus=false)`, `ksPresetOptionKey(event, bi)` — same shapes as the existing `openQuickSetupMenu`/`closeQuickSetupMenu`/`quickSetupOptionKey` trio, kept as separate functions (not a shared refactor) so this change can't regress the already-working Library setup picker.

- [ ] **Step 1: Replace the native-select CSS with picker/trigger/menu CSS**

Find:
```css
.ks-preset-sel{border:1px solid var(--border-s);border-radius:var(--r-sm);background:var(--bg-input);color:var(--t2);font-family:'Mulish',sans-serif;font-size:12px;padding:5px 8px;cursor:pointer;outline:none}
```
Replace with:
```css
/* Custom listbox for RANGE PRESET (UX audit 2026-07-22, V-4) — same pattern as
   the Library setup picker's .quick-setup-menu/.quick-setup-option, just
   without the search input: KEYSWITCH_PRESETS only has 2 static entries. */
.ks-preset-picker{position:relative;flex:0 0 auto}
.ks-preset-trigger{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;font-family:'Mulish',sans-serif;font-size:12px;color:var(--t2)}
.ks-preset-chevron{font-size:9px;color:var(--t3);transition:transform .2s cubic-bezier(.16,1,.3,1)}
.ks-preset-trigger[aria-expanded="true"] .ks-preset-chevron{transform:rotate(180deg)}
.quick-setup-menu.ks-preset-menu{left:0;width:max(180px,100%);max-height:none}
```

- [ ] **Step 2: Add `.ks-preset-trigger` to the coarse-pointer touch-target rule**

Find (same block Task 4 Step 2 edits — this line is untouched by that step, no conflict):
```css
  .dark-toggle,.bank-block-tab,.bank-block-tab-add,.send-btn,.btn{min-height:44px}
```
Replace with:
```css
  .dark-toggle,.bank-block-tab,.bank-block-tab-add,.send-btn,.btn,.ks-preset-trigger{min-height:44px}
```

- [ ] **Step 3: Build the option-HTML and swap the HTML markup**

Find:
```js
  const presetOpts = KEYSWITCH_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
```
Replace with:
```js
  const presetOpts = KEYSWITCH_PRESETS.map((p, i) => `<button class="quick-setup-option" type="button" role="option" data-idx="${i}" onclick="applyKsPreset(${bi},this.dataset.idx);closeKsPresetMenu(${bi},true)" onkeydown="ksPresetOptionKey(event,${bi})">${escHtml(p.name)}</button>`).join('');
```

Find:
```html
      <div class="field-block">
        <span class="field-label">RANGE PRESET</span>
        <select class="ks-preset-sel" onchange="applyKsPreset(${bi},this.value);this.selectedIndex=0" aria-label="Keyswitch range preset">
          <option value="">Choose range…</option>${presetOpts}
        </select>
      </div>
```
Replace with:
```html
      <div class="field-block">
        <span class="field-label">RANGE PRESET</span>
        <div class="ks-preset-picker" id="ks-preset-picker-${bi}">
          <button type="button" class="ks-preset-trigger ui-control ui-pill ui-glass" id="ks-preset-trigger-${bi}"
            aria-haspopup="listbox" aria-expanded="false" aria-controls="ks-preset-menu-${bi}"
            aria-label="Keyswitch range preset" onclick="toggleKsPresetMenu(${bi})">
            <span>Choose range…</span><span class="ks-preset-chevron" aria-hidden="true">▾</span>
          </button>
          <div class="quick-setup-menu ks-preset-menu" id="ks-preset-menu-${bi}" role="listbox" aria-label="Keyswitch range presets" hidden>${presetOpts}</div>
        </div>
      </div>
```
(The trigger's own label always stays "Choose range…" — matching the old select's `selectedIndex=0` reset-after-apply behavior. Applying a preset is a one-shot action that seeds `ks_notes`, which the user can then further edit via the keyboard/FROM-TO fields, so persisting a "selected" label would misrepresent the state as soon as they do.)

- [ ] **Step 4: Add the menu open/close/keyboard-nav functions next to `applyKsPreset`**

Find:
```js
function applyKsPreset(bi, idx) {
  if (idx === '' || idx == null) return;
  const p = KEYSWITCH_PRESETS[+idx];
  if (!p) return;
  cfg.banks[bi].ks_notes = p.notes ? p.notes.slice() : ksRange(p.lo, p.hi);
  dirty = true; ksLiveRefresh(bi, true, true); runValidation();
}
```
Replace with:
```js
function applyKsPreset(bi, idx) {
  if (idx === '' || idx == null) return;
  const p = KEYSWITCH_PRESETS[+idx];
  if (!p) return;
  cfg.banks[bi].ks_notes = p.notes ? p.notes.slice() : ksRange(p.lo, p.hi);
  dirty = true; ksLiveRefresh(bi, true, true); runValidation();
}
function toggleKsPresetMenu(bi) {
  const menu = document.getElementById(`ks-preset-menu-${bi}`);
  if (!menu) return;
  if (menu.hidden) openKsPresetMenu(bi); else closeKsPresetMenu(bi);
}
function openKsPresetMenu(bi) {
  const menu = document.getElementById(`ks-preset-menu-${bi}`);
  const trigger = document.getElementById(`ks-preset-trigger-${bi}`);
  if (!menu || !trigger) return;
  menu.hidden = false;
  trigger.setAttribute('aria-expanded','true');
  refreshBankMenuLayer();
  requestAnimationFrame(() => menu.querySelector('.quick-setup-option')?.focus());
}
function closeKsPresetMenu(bi, returnFocus = false) {
  const menu = document.getElementById(`ks-preset-menu-${bi}`);
  const trigger = document.getElementById(`ks-preset-trigger-${bi}`);
  if (menu) menu.hidden = true;
  if (trigger) {
    trigger.setAttribute('aria-expanded','false');
    if (returnFocus) trigger.focus();
  }
  refreshBankMenuLayer();
}
function ksPresetOptionKey(event, bi) {
  const options = [...event.currentTarget.closest('.ks-preset-menu').querySelectorAll('.quick-setup-option')];
  const index = options.indexOf(event.currentTarget);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeKsPresetMenu(bi, true);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
}
```

- [ ] **Step 5: Close the menu on outside click**

Find (in the existing global pointerdown listener, `feel-fader.html:5706-5711`):
```js
document.addEventListener('pointerdown', event => {
  document.querySelectorAll('.quick-setup-picker').forEach(picker => {
    if (!picker.contains(event.target)) closeQuickSetupMenu(Number(picker.id.split('-').pop()));
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
});
```

- [ ] **Step 6: Verify with a Puppeteer probe**

Create `scratch/v4-ks-preset-listbox-probe.mjs`:
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

// Open bank 0's keyswitch section (switch encoder mode to keyswitch first).
await p.evaluate(() => { cfg.banks[0].roller_mode = 'keyswitch'; render(); });

const opened = await p.evaluate(() => {
  document.getElementById('ks-preset-trigger-0')?.click();
  const menu = document.getElementById('ks-preset-menu-0');
  return { hidden: menu?.hidden, optionCount: menu?.querySelectorAll('.quick-setup-option').length };
});
P('Trigger opens the listbox with both presets', opened.hidden === false && opened.optionCount === 2, JSON.stringify(opened));

const before = await p.evaluate(() => cfg.banks[0].ks_notes.slice());
await p.evaluate(() => document.querySelector('#ks-preset-menu-0 .quick-setup-option[data-idx="1"]').click());
const after = await p.evaluate(() => ({ notes: cfg.banks[0].ks_notes.slice(), menuHidden: document.getElementById('ks-preset-menu-0').hidden, triggerLabel: document.querySelector('#ks-preset-trigger-0 span').textContent }));
P('Choosing "From C-1" applies MIDI 12-23 and closes the menu', after.notes[0] === 12 && after.notes[after.notes.length-1] === 23 && after.menuHidden === true, JSON.stringify(after));
P('Trigger label stays "Choose range…" after applying (one-shot action, not a persisted selection)', after.triggerLabel === 'Choose range…', after.triggerLabel);

// Outside click closes an open menu.
await p.evaluate(() => document.getElementById('ks-preset-trigger-0').click());
await p.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})));
const closedByOutsideClick = await p.evaluate(() => document.getElementById('ks-preset-menu-0').hidden);
P('Outside click closes the menu', closedByOutsideClick === true, closedByOutsideClick);

await p.close();
await b.close();
```

Run: `node scratch/v4-ks-preset-listbox-probe.mjs`
Expected: all four lines print `PASS`.

- [ ] **Step 7: Commit**

```bash
git add feel-fader.html scratch/v4-ks-preset-listbox-probe.mjs
git commit -m "feat(ux): replace RANGE PRESET native select with custom listbox matching Library setup picker (V-4)"
```

---

### Task 6: A-1 — Mobile 390px: Remove-bank button clipped off-screen

**Root cause (confirmed live, not from the audit's citation — the audit named `.bank-name-top .btn-remove-bank{margin-left:auto}` at line 1330, but that selector is dead CSS: the actual markup uses class `bank-block-name-top`, which that rule never matches).** The real cause: `.btn-remove-bank` is `position:relative` at all widths (line 550), and the `@media(max-width:540px)` block bundles it with `.bank-tab-add` under `right:-36px` (line 597) — a relative offset that makes sense for `.bank-tab-add` in the bank-tabs row, but wrongly also shifts `.btn-remove-bank` 36px to the right inside `.bank-actions`, pushing it off-screen. Verified via `evaluate_script` on a live 390×844 viewport: before the fix, `.btn-remove-bank` sat at `right:393` (past the 390px viewport and past its own parent's `right:357`); after removing `right` from `.btn-remove-bank`, it lands flush at `right:357`, matching its container, with zero overflow (`scrollWidth === clientWidth`, both 330).

**Files:**
- Modify: `feel-fader.html:597`
- Test: `scratch/a1-mobile-bank-actions-probe.mjs` (new)

- [ ] **Step 1: Split the bundled mobile rule**

Find:
```css
  .bank-tab-add,.btn-remove-bank{right:-36px;width:28px;height:28px;font-size:14px;}
```
Replace with:
```css
  .bank-tab-add{right:-36px;width:28px;height:28px;font-size:14px;}
  .btn-remove-bank{font-size:14px;}
```
(`.btn-remove-bank`'s `width:28px;height:28px` are dropped as redundant — its base rule at line 553 already declares `width:28px;height:28px` at every breakpoint. Only `right:-36px` was the bug and only `font-size:14px` was an intentional mobile-only change worth keeping.)

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/a1-mobile-bank-actions-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

const r = await p.evaluate(() => {
  const wrap = document.querySelector('.bank-actions');
  const btn = document.querySelector('.btn-remove-bank');
  const wrapRect = wrap.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return {
    viewportWidth: window.innerWidth,
    btnRight: btnRect.right, wrapRight: wrapRect.right,
    scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth
  };
});
P('Remove-bank button stays within its container', r.btnRight <= r.wrapRight + 1, JSON.stringify(r));
P('Remove-bank button stays within the viewport', r.btnRight <= r.viewportWidth, JSON.stringify(r));
P('.bank-actions has no horizontal overflow', r.scrollWidth <= r.clientWidth + 1, JSON.stringify(r));

await p.close();
await b.close();
```

Run: `node scratch/a1-mobile-bank-actions-probe.mjs`
Expected: all three lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/a1-mobile-bank-actions-probe.mjs
git commit -m "fix(ux): stop mobile Remove-bank button from being pushed off-screen (A-1)"
```

---

### Task 7: V-5 + I-3 — Unify HID-toggle green, make controller-view toggle neutral

Combined because both edit the same shared rule (`.hid-switch input:checked + .hid-switch-track`), which both the real HID toggle and the header's controller-view toggle inherit via the shared `hid-switch` class — fixing V-5 alone (make "on" = `--green`) would also turn the controller toggle green, worsening I-3. They have to land together.

**Files:**
- Modify: `feel-fader.html:690` (shared switch-track color), add new override for `.controller-switch`

- [ ] **Step 1: Unify the HID switch's "on" color to `--green`**

Find:
```css
.hid-switch input:checked + .hid-switch-track{background:rgba(var(--highlight-rgb),.44);border-color:rgba(var(--highlight-rgb),.72);box-shadow:0 0 12px rgba(var(--highlight-rgb),.25),inset 0 1px 2px rgba(0,0,0,.07),inset 0 1px 0 rgba(255,255,255,.24)}
```
Replace with:
```css
.hid-switch input:checked + .hid-switch-track{background:color-mix(in srgb,var(--green) 44%,transparent);border-color:color-mix(in srgb,var(--green) 72%,transparent);box-shadow:0 0 12px color-mix(in srgb,var(--green) 25%,transparent),inset 0 1px 2px rgba(0,0,0,.07),inset 0 1px 0 rgba(255,255,255,.24)}
/* Header's "Show controller view" reuses .hid-switch styling via the shared
   .controller-switch class, but it's a view preference, not a device/connect
   state — giving it the same green as above would collide with the header's
   connected-status semantics (UX audit 2026-07-22, I-3). Keep it neutral. */
.controller-switch input:checked + .hid-switch-track{background:var(--control-glass-bg);border-color:var(--control-glass-border);box-shadow:var(--control-glass-shadow)}
```

- [ ] **Step 2: Verify with a Puppeteer probe**

Create `scratch/v5-i3-switch-colors-probe.mjs`:
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

// Controller toggle starts checked by default — read its track color directly.
const controllerBg = await p.evaluate(() => {
  const track = document.querySelector('.controller-switch .hid-switch-track');
  return getComputedStyle(track).backgroundColor;
});
P('Controller-view switch track is NOT green when on', !controllerBg.includes('52, 199, 89') && !controllerBg.includes('34, 199'), controllerBg);

// HID toggle: set checked directly (no 'change' dispatch — onHidToggle() opens
// a confirmation dialog and reverts `checked` until confirmed; we're testing
// the CSS :checked track color, not the enable-HID confirmation flow).
await p.evaluate(() => { document.getElementById('hid-toggle').checked = true; });
const hidBg = await p.evaluate(() => {
  const track = document.getElementById('hid-toggle').nextElementSibling;
  return getComputedStyle(track).backgroundColor;
});
P('HID toggle track uses --green when on', hidBg.includes('52, 199, 89'), hidBg);

await p.close();
await b.close();
```

Run: `node scratch/v5-i3-switch-colors-probe.mjs`
Expected: both lines print `PASS`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html scratch/v5-i3-switch-colors-probe.mjs
git commit -m "fix(ux): unify HID-toggle to --green, keep controller-view toggle neutral (V-5, I-3)"
```

---

### Task 8: V-6 — Icon picker duplicate title

**Root cause:** `ICON_ONLY_SECTIONS[0].label` is `'Instrument category'`, rendered as `.icon-section-label` inside the grid — directly duplicating `.icon-picker-title`, which is set to the same string (`t('icon.title')`) one element above it.

**Files:**
- Modify: `feel-fader.html:5341-5356` (`ICON_ONLY_SECTIONS`), `feel-fader.html:5392` (render loop)

- [ ] **Step 1: Remove the redundant section label from the data**

Find:
```js
var ICON_ONLY_SECTIONS = [
  {
    label: 'Instrument category',
    icons: [
```
Replace with:
```js
var ICON_ONLY_SECTIONS = [
  {
    icons: [
```

- [ ] **Step 2: Only render `.icon-section-label` when a section actually has one**

Find:
```js
  for (const section of sections) {
    out += `<div class="icon-section-label">${section.label}</div>`;
```
Replace with:
```js
  for (const section of sections) {
    if (section.label) out += `<div class="icon-section-label">${section.label}</div>`;
```
(This keeps the label mechanism available for `LIBRARY_ONLY_SECTIONS`'s `'VST Library'` label — that section is unaffected since it still has `label` set — while dropping only the one that duplicated the dialog title.)

- [ ] **Step 3: Verify with Chrome DevTools MCP**

Open a bank's icon picker (`openIconPicker(0,'icon')` via a click on the icon-picker-trigger), then:
```js
() => ({
  title: document.getElementById('icon-picker-title')?.textContent,
  sectionLabels: [...document.querySelectorAll('.icon-section-label')].map(e => e.textContent)
})
```
Expected: `title: "Instrument category"`, `sectionLabels: []` (empty — no duplicate rendered).

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): remove duplicate 'Instrument category' heading in icon picker (V-6)"
```

---

### Task 9: V-7 — "Active on device" glyph too subtle among colored emoji

**Files:**
- Modify: `feel-fader.html:1422` (`.bank-tab-device`)

- [ ] **Step 1: Give the glyph the app's real "device-state" color instead of neutral gray**

Find:
```css
.bank-tab-device{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--t2);opacity:.78}
```
Replace with:
```css
.bank-tab-device{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green-text)}
```
(Removing `opacity:.78` and switching from `--t2` (neutral) to `--green-text` (the same AA-safe green used for other "device is really live" indicators) makes it read as a colored status glyph instead of a faint gray line-icon competing with colorful bank emoji — matches the app's existing convention that green = live device state, reinforced by Task 7's decision to reserve green specifically for device/connection state.)

- [ ] **Step 2: Verify with Chrome DevTools MCP**

With at least one bank showing the device glyph (physically-active bank ≠ editing bank, or via state-poke `liveBank = 0` then render bank tabs):
```js
() => {
  const g = document.querySelector('.bank-tab-device');
  return g ? getComputedStyle(g).color : 'not rendered — no bank tab currently marked active-on-device';
}
```
Expected: an RGB matching `--green-text` (`#1e8237` light / `#5dd47a` dark), not the neutral gray of `--t2`.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): strengthen active-on-device tab glyph with device-state green (V-7)"
```

---

### Task 10: A-3 — `.device-info-toggle:focus{outline:none}` has no `:focus-visible` replacement

**Files:**
- Modify: `feel-fader.html:676`

- [ ] **Step 1: Remove the stray outline:none**

Find:
```css
.device-info-toggle:focus{background:none;outline:none;}
```
Replace with:
```css
.device-info-toggle:focus{background:none;}
```
(The global `:focus-visible{outline:2px solid var(--focus)}` rule already handles keyboard focus for every other control in the app — this selector's higher specificity was the only thing suppressing it here. No replacement rule is needed; removing the override is the fix.)

- [ ] **Step 2: Verify with Chrome DevTools MCP**

```js
() => {
  const btn = document.getElementById('device-settings-toggle-btn');
  btn.focus();
  return getComputedStyle(btn).outlineStyle;
}
```
Expected: `"solid"` (not `"none"`) once focused — matches every other keyboard-focusable control in the app.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html
git commit -m "fix(ux): restore keyboard focus ring on Device & Settings toggle (A-3)"
```

---

### Task 11: S-1 — Desktop connection status collapses to an unlabeled dot; doc-drift

**Files:**
- Modify: `feel-fader.html:4596`, `feel-fader.html:4607`, `feel-fader.html:4608-4616`
- Modify: `WEBAPP.md` (§3.2, remove the doc-drifted "clickable overview" claim)
- Test: `scratch/s1-status-label-probe.mjs` (new)

**Chosen fix:** the audit offered two options — build the documented-but-nonexistent clickable Hardware/Live MIDI/Configuration overview, or simply stop auto-collapsing the "Connected" text on desktop. Building a new popover component is out of proportion for a P2 in this batch; removing the 3-second auto-collapse is the minimal fix and matches the audit's own primary recommendation ("there's room" on desktop). Mobile is unaffected either way — `.h-status-text` is already permanently visually-hidden there by a separate, unconditional `@media(max-width:540px)` CSS rule, so this JS timer currently only ever has a visible effect on desktop.

- [ ] **Step 1: Remove the auto-collapse timer**

Find:
```js
let _statusCollapseTimer = null;
```
Replace with:
```js
```
(delete the line — the variable exists solely to support the timer being removed below)

Find:
```js
  const entering = s !== _lastConnState;
  _lastConnState = s;
  if (entering) { clearTimeout(_statusCollapseTimer); _statusCollapseTimer = null; }
  if (s === 'CONNECTED_LIVE'){
    dot.className = 'h-status-dot on';
    // Give the "connected" text a moment to register, then collapse it back to
    // just the dot so the header row has room (Frank 2026-07-21) — only on the
    // DISCONNECTED->LIVE transition, not on every re-render while already live.
    if (entering) {
      txt.classList.remove('hidden'); txt.textContent = t('status.connected');
      _statusCollapseTimer = setTimeout(() => txt.classList.add('hidden'), 3000);
    }
  } else if (s === 'CONNECTED_BLIND'){
```
Replace with:
```js
  const entering = s !== _lastConnState;
  _lastConnState = s;
  if (s === 'CONNECTED_LIVE'){
    dot.className = 'h-status-dot on';
    if (entering) {
      txt.classList.remove('hidden'); txt.textContent = t('status.connected');
    }
  } else if (s === 'CONNECTED_BLIND'){
```

- [ ] **Step 2: Correct the doc-drift in `WEBAPP.md`**

In `WEBAPP.md` §3.2 (Header), find the paragraph starting `Na desktopu je stav připojení trvale čitelný a funguje jako tlačítko. Otevírá kompaktní liquid-glass přehled **Hardware / Live MIDI / Configuration / Last activity**...` and remove/replace it — that popover does not exist in the code (confirmed: no click handler, no `role=button`, on `#h-status`). Replace the paragraph with a description matching actual behavior: the status text now stays visible on desktop once "Connected" is shown (fixed by this task), instead of collapsing to a bare dot after 3 seconds.

- [ ] **Step 3: Verify with a Puppeteer probe**

Create `scratch/s1-status-label-probe.mjs`:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Fanda Borec/Documents/feel-fader-app/node_modules/puppeteer-core');

const URL = 'http://localhost:8100/feel-fader.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => { try{skipWelcome && skipWelcome()}catch(e){} });

await p.evaluate(() => { _midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState(); });
await new Promise(r => setTimeout(r, 3500)); // past the old 3000ms collapse window

const r = await p.evaluate(() => {
  const txt = document.getElementById('h-status-text');
  return { hidden: txt.classList.contains('hidden'), text: txt.textContent, visible: getComputedStyle(txt).opacity !== '0' };
});
P('Desktop "Connected" text is still visible 3.5s after connecting', !r.hidden && r.visible, JSON.stringify(r));

await p.close();
await b.close();
```

Run: `node scratch/s1-status-label-probe.mjs`
Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html WEBAPP.md scratch/s1-status-label-probe.mjs
git commit -m "fix(ux): stop desktop connection status from collapsing to a bare dot (S-1); correct WEBAPP.md doc-drift"
```

---

## Plan Self-Review

**Spec coverage:** All 14 findings from `docs/feel-fader-ux-audit-2026-07-22.md` map to a task — I-1→T1, V-1→T2+T3, V-2→T2+T4, V-3→T2+T5, V-4→T5, A-1→T6, V-5→T7, I-2→T4, I-3→T7, V-6→T8, V-7→T9, A-3→T10, S-1→T11, A-2→T2. That's 14/14.

**No two tasks touch the same file line** — checked explicitly (this is why V-1/V-2/V-3/A-2 are folded into Task 2 instead of one task per finding ID, and why V-4 absorbs V-3's `.ks-preset-sel` padding instead of Task 2 also touching it).

**Placeholder scan:** no TBD/TODO; every step has literal find/replace code or a runnable probe/command.

**Deliberate no-ops flagged for Frank to review, not silently decided:**
- `.bank-icon-display` 20px left alone (icon-glyph exception, per the audit's own nuance).
- S-1 removes the auto-collapse rather than building the documented-but-nonexistent clickable status overview — flag if that popover is actually wanted as a new feature (bigger scope, would need its own design pass).

**Confirmed with Frank (2026-07-22):** full custom listbox for V-4 (not the lighter restyle) — Task 5 rewritten accordingly, reusing the existing `.quick-setup-menu`/`.quick-setup-option` pattern rather than inventing a new one.
