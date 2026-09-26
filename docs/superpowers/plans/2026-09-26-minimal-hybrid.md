# Minimal Hybrid Visual Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the main view of the Feel Fader web app into the calmer "minimal hybrid" language (flat surfaces, one glass surface in the header, clear hierarchy, secondary actions moved down) without changing features, data, `cfg` schema or transport.

**Architecture:** Everything stays inline in `feel-fader.html` (single source of truth, no build step). Surfaces are flattened mostly by re-mapping existing tokens (`--control-glass-*`) instead of editing ~40 call sites; the four structural changes (bank card header, section headers, roller order list, Bank / Feel Fader groups) are rewrites of the existing render functions `renderPanels`, `sectionHeaderHtml`, `ccEncoderBody`/`keyswitchTagsHtml` and the static Device & Settings / Help markup. Every behaviour hook (ids, `data-*` attributes, handler names) that probes or other code use is kept.

**Tech Stack:** Vanilla JS/CSS/HTML, `puppeteer-core` probes in `scratch/` run by `npm test` (static server on `:8100`).

**Spec:** `docs/superpowers/specs/2026-09-26-minimal-hybrid-design.md` (branch `design/minimal`). Visual reference (local, gitignored): `.superpowers/brainstorm/hybrid-2026-09-26/hybrid-full.png`, `hybrid-compare.png`, `hybrid-mock.html` (CSS values are orientation only – tokens win).

## Decisions taken while planning (Frank, 2026-09-26)

- **Device marker:** add a green dot to the tab of the bank that is active on the device **and** "· active on device" in the card eyebrow. This reverses the rule in `bank-live-dot-probe.mjs` ("no device marker in tabs"); the HUD bank dots stay.
- **Header status:** moves to the right, **hover/focus/click reveal stays** (`.reveal-on-interact` unchanged). Error states keep their permanently visible text.
- **Live row in roller order:** articulations get a live marker too (today only keyswitches have one; `renderEncChips()` targets a non-existent `#enc-chips`).
- **Mulish 800 is not available** – the embedded Mulish is a 300–700 variable face and `design-consistency-probe` enforces 400/600/700 (K-3). Wordmark and bank name use **700**.
- **Glass tokens:** `--control-glass-*` are re-mapped to one flat set (fill `--bg-input`, no filter, no border, no shadow); names stay so no call site changes. Active pills that would now vanish on `--bg-input` (roller segmented thumb, C-2/C-1 active, edited bank tab) get an explicit `--bg-card` pill.
- **Section/controller link highlight** (`.fader-linked` on a section) becomes a neutral tint; green stays only on the device photo glow, live markers and success states.
- **Send halo** (`.send-callout::before` frosted blur) is removed – it is a content-area glass surface.

## Global Constraints

- Scope: `feel-fader.html`, `WEBAPP.md`, probes in `scratch/` (new ones registered in `scratch/run-all-probes.mjs` `PROBES`). No change to protocol, `cfg`, `cfg` schema, firmware, i18n keys beyond texts the spec names. `feel-fader-firmware` is not touched.
- Read only target slices of `feel-fader.html` (`rg -n` / `grep -n` first, then read the block) – never the whole file (repo `CLAUDE.md`).
- Colours, radii, shadows only via `var(--…)` tokens (spec criterion 9, `WEBAPP.md` §0). Font sizes only via `--fs-*`; a new display size is added as a token `--fs-display:32px`.
- Radii only `--r-sm | --r | --r-lg | --r-pill | 50% | 0 | inherit` (enforced by `design-consistency-probe`).
- Mulish weights 400 / 600 / 700 only; IBM Plex Mono 400/500.
- User-facing text uses the en dash `–`, never `—`.
- Green (`--green`, `--green-text`, `--green-bg`, `--green-border`) only for: fader thumb/zone glow on the device photo, device-active dot, live roller row, success states (`.send-btn.sent`, feedback text, `.step-btn:active` acknowledgement, HID/fw dots).
- Desktop-first (≥ 601 px); mobile (390 × 844) must stay functional, not optimised.
- Probe boilerplate and Chrome path as in existing probes: `C:/Program Files/Google/Chrome/Application/chrome.exe`, `http://localhost:8100/feel-fader.html`, `skipWelcome()` first. Never real `navigator.serial.requestPort()` / SysEx – poke state (`_midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState();`).
- Run one probe: `npm test -- <probe.mjs>`; full suite: `npm test`.
- Commits: explicit `git add <files>`, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **No demo deploy, no merge to `main`** without Frank's explicit OK (spec §Deploy). Screenshots go to the session scratchpad, never into the repo.

## Review Focus

1. **Library picker inside a hidden popover** – keyboard user presses Browse…, types, Escape: expected the menu closes, a second Escape (or the first, when the menu is already closed) closes the popover and focus returns to Browse…; choosing a setup opens the preview dialog and Cancel returns focus to Browse… (test in Task 4).
2. **Device marker vs. edited bank diverge** – device on bank 1, user edits bank 3, then a Program Change moves the device to bank 3 while the config is dirty: expected the dot moves to tab 3 and the card eyebrow of bank 3 shows "· active on device" without a full re-render (test in Task 2).
3. **Roller order reordering in a vertical list** – drag uses the vertical midpoint (today it uses `clientX`), Alt+↑/↓ still reorders, focus follows the moved row, the live marker follows the value, not the index (test in Task 6).
4. **Row actions hidden until hover** – Move earlier/later and × at `opacity:0` must stay in the tab order and become visible on `:focus-within`; on touch (`pointer:coarse`) they are always visible (test in Task 6).
5. **Send note under the button vs. docked Send** – with the controller hidden, the note must keep its docked (left-of-button) placement and the 32 px docked gaps; the change popover must not cover the note on desktop (test in Task 8).

---

### Task 0: Baseline

**Files:** none changed.

- [ ] **Step 1: Confirm branch and clean tree**

Run: `git -C "C:/Users/Fanda Borec/Documents/feel-fader-app" status --short; git -C "C:/Users/Fanda Borec/Documents/feel-fader-app" rev-parse --abbrev-ref HEAD`
Expected: no output from status, branch `design/minimal`.

- [ ] **Step 2: Record baseline test result**

Run: `npm test` (from the repo root)
Expected: all probes PASS. If anything fails on the untouched branch, stop and report it – do not start restyling on a red baseline.

---

### Task 1: Flat surfaces and tokens (spec §1, criteria 1–3, 9)

**Files:**
- Modify: `feel-fader.html` – `:root` tokens (~35–133), `html.dark` tokens (~135–171), `body` (~192–202), `.send-callout::before` (~419–431), `.panel` (~536–540), `.roller-mode-row::before` + dark (~562–581), `.stepper` / `.stepper input` / dark (~599–615), `.ks-convention-stepper .step-btn.active` (~649), `.bank-card` (~1878–1886), open-section block `@media(min-width:601px)` (~1932–1966), dark overrides (~2221–2245), `.bank-section.fader-linked` (~764), `.response-select.is-open .response-select-trigger` (~882)
- Modify: `scratch/design-consistency-probe.mjs`

**Interfaces:**
- Produces tokens used by later tasks: `--shadow-hud`, `--fs-display` (32px), `--bg-card` pill pattern `background:var(--bg-card);box-shadow:0 0 0 1px var(--border)`.
- Produces class `.settings-group` in the probe selector (the class itself is created in Task 7; the probe tolerates its absence until then because it uses `querySelectorAll`).

- [ ] **Step 1: Write the failing asserts**

In `scratch/design-consistency-probe.mjs`, insert directly **before** the line `// Frank's typography rule (2026-09-26)`:

```js
// Minimal hybrid (spec 2026-09-26 §1): flat page, flat content cards, one glass
// surface (header), neutral open section.
P('ambient background tokens are gone', !/--ambient-/.test(src));
const surf = await p.evaluate(() => {
  const cs = el => getComputedStyle(el);
  _openSections.clear(); _lastActiveFaderKey = null; _openSections.add('fader1'); render();
  const open = document.querySelector('.bank-section.is-open');
  const cards = [...document.querySelectorAll('.bank-card, .center-col > .panel, .settings-group')];
  return {
    bodyBg: cs(document.body).backgroundImage,
    cards: cards.map(el => ({ cls: el.className, bf: cs(el).backdropFilter, sh: cs(el).boxShadow })),
    openBg: `${cs(open).backgroundColor}|${cs(open).backgroundImage}`,
    openBefore: getComputedStyle(open, '::before').content,
    headerBf: cs(document.querySelector('header')).backdropFilter,
    halo: getComputedStyle(document.querySelector('.send-callout'), '::before').content,
  };
});
P('body has no ambient radial gradients', !/radial-gradient/.test(surf.bodyBg), surf.bodyBg);
P('content cards have no backdrop-filter and no shadow', surf.cards.length > 0 && surf.cards.every(c => c.bf === 'none' && c.sh === 'none'), JSON.stringify(surf.cards));
P('open section has no tint or light gradient', surf.openBg === 'rgba(0, 0, 0, 0)|none' && ['none', 'normal'].includes(surf.openBefore), `${surf.openBg} / ${surf.openBefore}`);
P('header keeps its glass', !!surf.headerBf && surf.headerBf !== 'none', surf.headerBf);
P('Send has no frosted halo', ['none', 'normal'].includes(surf.halo), surf.halo);
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- design-consistency-probe.mjs`
Expected: FAIL on "ambient background tokens are gone", "body has no ambient radial gradients", "content cards have no backdrop-filter and no shadow", "open section has no tint…", "Send has no frosted halo"; PASS on "header keeps its glass".

- [ ] **Step 3: Tokens**

In `:root`:
- Delete the three `--ambient-accent/--ambient-cool/--ambient-green` lines.
- Replace the five `--control-glass-*` lines (~63–67) and the comment block above them (~57–62) with:

```css
  /* Compact controls (steppers, segmented, pills, keycaps) are flat since the
     minimal hybrid pass (spec 2026-09-26 §1): one fill, no blur, no bevel.
     Names kept so every .ui-glass / control call site follows without edits. */
  --control-glass-bg:var(--bg-input);
  --control-glass-filter:none;
  --control-glass-border:transparent;
  --control-glass-shadow:none;
  --control-glass-shadow-hover:none;
```
- Replace `--highlight-section-fill` / `--highlight-section-glow` (~76–77) with:

```css
  --highlight-section-fill:color-mix(in srgb,var(--t1) 4%,transparent);  /* neutral: green is live-only (spec 2026-09-26 §1) */
  --highlight-section-glow:transparent;
```
- After `--shadow-sm` (~82) add:

```css
  --shadow-hud:0 8px 24px rgba(0,0,0,.06);   /* floating HUD lift – the only shadow on a flat surface */
```
- In the type scale after `--fs-3xl:22px;` add:

```css
  --fs-display:32px;  /* bank name in the card header only (spec 2026-09-26 §4) */
```

In `html.dark`:
- Delete the four `--control-glass-*` lines (~156–159) and the three `--ambient-*` lines (~160–162).
- Replace `--highlight-section-fill/glow` (~167–168) with:

```css
  --highlight-section-fill:color-mix(in srgb,var(--t1) 6%,transparent);
  --highlight-section-glow:transparent;
```
- After `--shadow-sm` (~164) add `--shadow-hud:0 8px 24px rgba(0,0,0,.35);`

- [ ] **Step 4: Page, cards, open section, halo**

Replace the `body{…}` rule (~192–202) with:

```css
body{
  background:var(--bg);
  color:var(--t1);font-family:'Mulish',sans-serif;font-size:var(--fs-base);min-height:100vh;
  display:flex;flex-direction:column;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
```

Delete the `.send-callout::before{…}` rule and its two-line comment above it (~417–431) and delete `html.dark .send-callout::before{…}` (~2222).

Replace `.panel{…}` (~536–540) with:

```css
.panel{
  background:var(--bg-card);
  border:0;border-radius:var(--r);padding:16px;flex:1;min-width:160px;
  box-shadow:none;
}
```

Replace `.bank-card{…}` (~1878–1886) with:

```css
.bank-card{
  background:var(--bg-card);
  border:0;
  border-radius:var(--r);
  box-shadow:none;
  overflow:hidden;
  isolation:isolate;
}
```

Inside `@media(min-width:601px){ … }` (~1932–1966):
- Replace the `.bank-section.is-open{…}` rule with `.bank-section.is-open{position:relative}` (no background, no shadow).
- Delete the `.bank-section.is-open::before{…}` rule and `html.dark .bank-section.is-open::before{…}`.
- Keep `.bank-section.is-open.fader-linked{…}` (now neutral via tokens).
- Replace `.bank-section.is-open>.section-head.is-stuck{…}` with:

```css
  .bank-section.is-open>.section-head.is-stuck{
    background:var(--bg-card);
    box-shadow:0 1px 0 var(--border);
  }
```

Delete `html.dark .bank-card{…}` (~2223). In the `@media(max-width:600px){…}` at the end of `<style>` (~2242–2245) delete both lines (`.panel{backdrop-filter…}` and `.bank-card{backdrop-filter…}`) and the now-empty media block. Keep the `@supports not (backdrop-filter…)` fallback (harmless).

- [ ] **Step 5: Controls that would lose their active state on a flat fill**

Replace `.roller-mode-row::before{…}` (~562–569) with:

```css
.roller-mode-row::before{
  content:'';position:absolute;z-index:0;left:3px;top:3px;bottom:3px;pointer-events:none;
  width:calc((100% - 12px)/4);border-radius:var(--r-pill);background:var(--bg-card);
  transform:translateX(calc(var(--roller-index) * (100% + 2px)));
  box-shadow:var(--shadow-sm);
  transition:transform .46s var(--ease-out),background-color .22s ease,box-shadow .22s ease;
}
```
Replace `.roller-mode-row{…}` `border:1px solid var(--border-s)` → `border:0`, `background:color-mix(…)` → `background:var(--bg-input)`, `box-shadow:inset 0 1px 3px rgba(0,0,0,.10)` → `box-shadow:none`. Replace `html.dark .roller-mode-row{…}` with `html.dark .roller-mode-row{background:var(--bg-input)}` and `html.dark .roller-mode-row::before{…}` with `html.dark .roller-mode-row::before{background:var(--bg-card);box-shadow:var(--shadow-sm)}`.

In `.stepper{…}` (~599) set `border:0`, `background:var(--bg-input)`, `box-shadow:none` (keep every other declaration). In `.stepper input{…}` (~601) the glass tokens now resolve flat – leave it. Replace `html.dark .stepper{…}` with `html.dark .stepper{background:var(--bg-input)}`; leave `html.dark .stepper input{…}` (flat via tokens). In the later `html.dark .stepper{background:var(--bg-input);border-color:var(--border);}` (~2227) drop `border-color:var(--border);`.

In `.ks-convention-stepper .step-btn.active,…{…}` (~649) replace its glass declarations with `background:var(--bg-card);border:0;box-shadow:var(--shadow-sm);color:var(--t1)`.

In `.response-select.is-open .response-select-trigger{…}` (~882) replace the green border/ring with `border-color:var(--border-s);box-shadow:0 0 0 3px color-mix(in srgb,var(--t1) 6%,transparent);`.

Remove `box-shadow:0 0 12px 0 var(--highlight-section-glow)` from `.bank-section.fader-linked{…}` (~764) and from `.bank-section.is-open.fader-linked{…}` (glow token is transparent; the declaration is dead).

- [ ] **Step 6: Run the probe**

Run: `npm test -- design-consistency-probe.mjs`
Expected: all PASS.

- [ ] **Step 7: Regression slice**

Run: `npm test -- step-btn-active-color-probe.mjs touch-target-stepper-specificity-probe.mjs roller-mode-timing-sync-probe.mjs send-btn-idle-state-probe.mjs k7-details-probe.mjs fader-response-menu-hide-probe.mjs button-zone-hover-probe.mjs`
Expected: all PASS. If `send-btn-idle-state-probe` compares `.idle` vs `.blocked` colours and now fails because both are flat, keep the `.blocked` resting border (it is its declared differentiator) – do not change the probe's intent.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/design-consistency-probe.mjs
git commit -m "feat(design/minimal): flat page and content surfaces, neutral open section

Ambient gradients and the Send halo are gone, bank card and panels are plain
--bg-card, compact controls use one flat --control-glass set, and the
section/controller link tint is neutral – green is live-only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Header – wordmark, status on the right, flat tabs, device dot (spec §2)

**Files:**
- Modify: `feel-fader.html` – header markup (~2251–2287), `.h-left` / `.h-title` / `.h-right` (~332–336), `.h-status-text` (~1105–1111), `.h-div` (~1121), `.bank-block-tab` (~2020–2036), `.bank-block-tabs .bank-block-tab.active` (~2079–2088), `renderBankTabs()` (~3220), `renderLiveStrip()` (~6351), new helpers next to `renderLiveHudBankDots()` (~6332)
- Modify: `scratch/bank-live-dot-probe.mjs`

**Interfaces:**
- Produces: `deviceBankIndex() -> number` (index of the bank the connected device is on, `-1` when not connected), `syncDeviceBankMarkers() -> void` (toggles `.is-on-device` on `#bank-tabs .bank-block-tab`, updates their `aria-label`/`title`, toggles `#bank-eyebrow-device` hidden). Task 4 renders `#bank-eyebrow-device` using `deviceBankIndex()`.

- [ ] **Step 1: Rewrite the probe (failing)**

Replace the body of `scratch/bank-live-dot-probe.mjs` from `const result = await p.evaluate(() => {` to the end with:

```js
const result = await p.evaluate(() => {
  addBank(); addBank();
  activeBank = 2;
  liveBank = 0;
  _midiState = 'granted';
  _ffConnected = true;
  render();
  renderConnState();
  const tabs = [...document.querySelectorAll('.bank-block-tab')];
  const bank = document.getElementById('live-hud-bank');
  const hud = document.getElementById('live-strip');
  const dot = tabs[0].querySelector('.bank-tab-device-dot');
  const out = {
    activeIsSelected: tabs[2].classList.contains('active'),
    activeShadow: getComputedStyle(tabs[2]).boxShadow,
    activeBf: getComputedStyle(tabs[2]).backdropFilter,
    deviceTabs: tabs.map(t => t.classList.contains('is-on-device')),
    dotVisible: !!dot && getComputedStyle(dot).display !== 'none',
    dotColor: dot && getComputedStyle(dot).backgroundColor,
    deviceAria: tabs[0].getAttribute('aria-label'),
    hudDotCount: bank.querySelectorAll('.live-hud-bank-dot').length,
    hudActiveDot: bank.querySelectorAll('.live-hud-bank-dot.is-active').length,
    hudLabel: bank.getAttribute('aria-label'),
    bankCount: cfg.banks.length,
    hudBankDisplay: getComputedStyle(bank).display,
    hudVisible: hud.classList.contains('is-contextual-visible'),
    hudState: hud.dataset.state,
  };
  const probe = document.createElement('span'); probe.style.color = 'var(--green)'; document.body.appendChild(probe);
  out.green = getComputedStyle(probe).color; probe.remove();
  // Device follows a Program Change to the edited bank while the config is dirty.
  dirty = true; liveBank = 2; renderLiveStrip();
  out.afterPc = [...document.querySelectorAll('.bank-block-tab')].map(t => t.classList.contains('is-on-device'));
  out.eyebrowShown = !document.getElementById('bank-eyebrow-device')?.hidden;
  // Disconnect clears the marker.
  _ffConnected = false; _serialPort = null; renderConnState();
  out.afterDisconnect = [...document.querySelectorAll('.bank-block-tab')].some(t => t.classList.contains('is-on-device'));
  return out;
});
P('editing bank is the flat selected pill (hairline, no glass)', result.activeIsSelected && result.activeShadow !== 'none' && result.activeBf === 'none', JSON.stringify(result));
P('only the device bank tab carries the green device dot', result.deviceTabs.join() === 'true,false,false' && result.dotVisible && result.dotColor === result.green, JSON.stringify(result));
P('device tab says "active on device" to assistive tech', /active on device/i.test(result.deviceAria || ''), result.deviceAria);
P('device dot follows a Program Change without a full render', result.afterPc.join() === 'false,false,true', JSON.stringify(result.afterPc));
P('card eyebrow shows "active on device" for the device bank', result.eyebrowShown === true, String(result.eyebrowShown));
P('disconnect clears the device dot', result.afterDisconnect === false);
P('Live HUD maps the active physical bank immediately on connection', result.hudVisible && result.hudState === 'CONNECTED_LIVE' && result.hudBankDisplay === 'flex' && result.hudDotCount === result.bankCount && result.hudActiveDot === 1 && result.hudLabel === `Active device bank: 1 of ${result.bankCount}`, JSON.stringify(result));
await p.close();
await b.close();
```

Also replace the file's header comment with:

```js
// Regression probe (minimal hybrid, spec 2026-09-26 §2/§4): the edited bank is
// the flat selected pill; the bank the device is on carries a green dot in its
// tab and "· active on device" in the card eyebrow; the HUD keeps its bank dots.
```

The eyebrow assert stays red until Task 4 – that is expected; note it in the task report.

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- bank-live-dot-probe.mjs`
Expected: FAIL on the flat pill (backdrop), device dot, aria, Program Change, eyebrow; PASS on HUD mapping and disconnect.

- [ ] **Step 3: Header markup**

In `<header>` (~2251–2287): delete `<span class="h-div" aria-hidden="true"></span>`, cut the whole `<div class="h-status-wrap">…</div>` block out of `.h-left` and paste it as the first child of `<div class="h-right">`. Result:

```html
<header>
  <div class="h-left">
    <span class="h-title">Feel Fader</span>
    <div class="bank-block-tabs" id="bank-tabs"></div>
  </div>
  <div class="h-right">
    <div class="h-status-wrap">
      <span class="h-status" id="h-status" aria-live="polite" tabindex="0" onclick="toggleStatusReveal(event)">
        <span class="h-status-dot" id="h-status-dot" aria-hidden="true"></span>
        <span class="h-status-text" id="h-status-text"></span>
      </span>
    </div>
    <!-- controller-toggle-wrap and dark-toggle unchanged -->
```

- [ ] **Step 4: Header CSS**

Replace `.h-left{…}` and `.h-title{…}` (~332–335, including the two-line comment above `.h-title`) with:

```css
.h-left{display:flex;align-items:center;gap:var(--space-6);flex:1 1 auto;min-width:0}
/* Wordmark in normal case (spec 2026-09-26 §2). 700 = heaviest embedded Mulish. */
.h-title{color:var(--t1);font-size:var(--fs-lg);font-weight:700;letter-spacing:-.01em;flex-shrink:0;white-space:nowrap;user-select:none}
```
Change `.h-right{…gap:var(--space-2)}` to `gap:var(--space-4)`. In `.h-status-text{…}` (~1105) change `font-size:var(--fs-sm);color:var(--t3);letter-spacing:.02em;` to `font-size:var(--fs-md);color:var(--t2);letter-spacing:0;`. Delete `.h-div{…}` (~1121).

In `.bank-block-tab{…}` (~2020) change `font-size:var(--fs-md);font-weight:600;color:var(--t3);` to `font-size:var(--fs-base);font-weight:600;color:var(--t2);`, and `padding:2px 9px` to `padding:2px 12px`.

Replace `.bank-block-tabs .bank-block-tab.active{…}` and its comment (~2076–2088) with:

```css
/* The edited bank is a flat card-white pill with a hairline (spec 2026-09-26 §2);
   the bank the hardware is on gets a small green dot (.is-on-device). */
.bank-block-tabs .bank-block-tab.active{
  color:var(--t1);
  font-weight:600;
  background:var(--bg-card);
  border-color:transparent;
  border-radius:var(--r-pill);
  box-shadow:0 0 0 1px var(--border);
}
.bank-tab-device-dot{display:none;width:5px;height:5px;border-radius:50%;background:var(--green);flex:0 0 auto;margin-left:var(--space-1)}
.bank-block-tab.is-on-device .bank-tab-device-dot{display:inline-block}
```
Delete `html.dark .bank-block-tabs .bank-block-tab.active{color:var(--t1);}` only if it is now redundant (it is – same colour); keep `html.dark .bank-block-tab{…}`.

- [ ] **Step 5: Device marker helpers**

Directly **above** `function renderLiveHudBankDots(` add:

```js
// Device context in the editor (spec 2026-09-26 §2/§4, Frank reversed the
// "HUD only" rule): the bank the hardware is on gets a green dot in its tab
// and "· active on device" in the card eyebrow. Same condition as the HUD bank
// dots (any CONNECTED_* state), so the three markers never disagree.
function deviceBankIndex() {
  return connState().startsWith('CONNECTED') ? liveBank : -1;
}
function syncDeviceBankMarkers() {
  const onDevice = deviceBankIndex();
  document.querySelectorAll('#bank-tabs .bank-block-tab').forEach((tab, i) => {
    const on = i === onDevice;
    const name = cfg.banks[i]?.name || `Bank ${i+1}`;
    tab.classList.toggle('is-on-device', on);
    tab.setAttribute('aria-label', `Edit ${name}${on ? ' (active on device)' : ''}`);
    if (on) tab.title = 'Active on device'; else tab.removeAttribute('title');
  });
  const eyebrow = document.getElementById('bank-eyebrow-device');
  if (eyebrow) eyebrow.hidden = activeBank !== onDevice;
}
```

In `renderLiveStrip()`, right after `renderLiveHudBankDots(cfg.banks.length, liveBank);` add `syncDeviceBankMarkers();`. `renderConnState()` and the Program Change path already call `renderLiveStrip()`, so connect, disconnect and device bank changes all update the markers.

In `renderBankTabs()`: inside the tab template, after `<span class="bank-tab-name">${nm}</span>` add `<span class="bank-tab-device-dot" aria-hidden="true"></span>`; after `el.innerHTML = tabsHtml + addHtml;` add `syncDeviceBankMarkers();`.

- [ ] **Step 6: Run the probe**

Run: `npm test -- bank-live-dot-probe.mjs`
Expected: all PASS except "card eyebrow shows…" (Task 4).

- [ ] **Step 7: Regression slice**

Run: `npm test -- safe-batch-2026-07-20-probe.mjs status-hover-reveal-probe.mjs status-pill-polish-probe.mjs connstate-probe.mjs connstate-flow-probe.mjs connstate-reconnect-probe.mjs skip-welcome-demo-badge-probe.mjs k7-details-probe.mjs bank-tab-blur-probe.mjs hide-controller-toggle-probe.mjs controller-toggle-speed-probe.mjs onb-wordmark-sync-probe.mjs mobile-ux-probe.mjs`
Expected: all PASS. `k7-details-probe` reads tab texts from visible children; the dot is `display:none` on non-device tabs and has no text – if the tab-text assert fails, the dot is being counted: confirm it has no `textContent`.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/bank-live-dot-probe.mjs
git commit -m "feat(design/minimal): header wordmark, status on the right, flat tabs with device dot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Flat Live HUD (spec §3, criterion 8)

**Files:**
- Modify: `feel-fader.html` – `.live-hud{…}` (~228–237) and the comment above `.live-hud.is-contextual-visible` about glass (~247–251)
- Modify: `scratch/live-hud-free-manipulation-probe.mjs` (~98–110), `scratch/live-hud-meter-value-gap-probe.mjs` (~52, ~60), `scratch/design-consistency-probe.mjs`

**Interfaces:** Consumes `--shadow-hud` (Task 1).

- [ ] **Step 1: Rewrite the "shared glass" asserts (failing)**

In `live-hud-free-manipulation-probe.mjs` replace the line

```js
    sameBg: hs.background===ls.background, sameBackdrop: hs.backdropFilter===ls.backdropFilter,
```
with
```js
    bgCard: (() => { const s = document.createElement('span'); s.style.color = 'var(--bg-card)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; })(),
    hudBg: ls.backgroundColor, hudBackdrop: ls.backdropFilter,
```
and replace
```js
P('HUD and header share the same glass surface', glass.sameBg && glass.sameBackdrop, JSON.stringify(glass));
```
with
```js
P('HUD is a flat card surface (no glass, --bg-card fill)', glass.hudBg === glass.bgCard && glass.hudBackdrop === 'none', JSON.stringify(glass));
```
Keep the neighbouring "full opacity even when idle" assert unchanged.

In `live-hud-meter-value-gap-probe.mjs` replace the `sharedGlass:` line with

```js
    flatCard: ls.backdropFilter === 'none' && ls.boxShadow !== 'none' && ls.borderTopStyle === 'solid',
```
and the assert `P('status capsule and header share the same glass surface', r.sharedGlass, r.sharedGlass);` with

```js
P('status capsule is a flat card with hairline and soft lift', r.flatCard, r.flatCard);
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- live-hud-free-manipulation-probe.mjs live-hud-meter-value-gap-probe.mjs`
Expected: FAIL on the two rewritten asserts only.

- [ ] **Step 3: HUD CSS**

In `.live-hud{…}` (~228–237) replace

```css
  border:1px solid var(--chrome-float-border);border-radius:var(--r-lg);
  background:var(--chrome-glass-bg);
  backdrop-filter:var(--chrome-glass-filter);-webkit-backdrop-filter:var(--chrome-glass-filter);
  box-shadow:var(--chrome-glass-shadow);
```
with
```css
  border:1px solid var(--border);border-radius:var(--r-lg);
  background:var(--bg-card);
  box-shadow:var(--shadow-hud);
```
Replace the comment block above `.live-hud.is-dragging` that starts `/* No idle dimming — the HUD's glass matches the header's translucency…` with:

```css
/* No idle dimming. Since the minimal hybrid pass (spec 2026-09-26 §3) the HUD is
   a flat --bg-card card with a hairline and --shadow-hud – the header is the only
   glass surface. Live vs not-live is conveyed by the content (values vs "–");
   .is-idle stays as a state hook but no longer changes opacity. */
```
Geometry, content, `data-state`, transitions and the square↔capsule logic are untouched.

- [ ] **Step 4: Guard in design-consistency**

In `scratch/design-consistency-probe.mjs`, inside the `surf` evaluate added in Task 1, add to the returned object:

```js
    hud: (() => { const h = cs(document.getElementById('live-strip')); return { bf: h.backdropFilter, sh: h.boxShadow }; })(),
```
and after the "header keeps its glass" assert add:

```js
P('HUD is flat (no backdrop-filter) with a soft lift', surf.hud.bf === 'none' && surf.hud.sh !== 'none', JSON.stringify(surf.hud));
```

- [ ] **Step 5: Run HUD probes**

Run: `npm test -- live-hud-free-manipulation-probe.mjs live-hud-meter-value-gap-probe.mjs live-hud-square-probe.mjs hud-readable-summaries-probe.mjs art-row-stable-height-probe.mjs design-consistency-probe.mjs connect-reveal-sync-probe.mjs`
Expected: all PASS (`live-hud-square-probe` still reads `borderRadius === '18px'` = `--r-lg`).

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/live-hud-free-manipulation-probe.mjs scratch/live-hud-meter-value-gap-probe.mjs scratch/design-consistency-probe.mjs
git commit -m "feat(design/minimal): flat Live HUD – card fill, hairline, soft lift

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bank card header – eyebrow, display name, Library setup · Browse… (spec §4, criterion 4)

**Files:**
- Modify: `feel-fader.html` – `bankNameRowHtml` in `renderPanels()` (~3287–3326), CSS `.bank-block-name*`, `.bank-quick-setup*`, `.quick-setup-picker`, `.library-quick-input*`, first-run cue (~2111–2142), `.bank-name-input` (~715–730), mobile block (~790–815), `refreshBankMenuLayer()` (~8197), `quickSetupInputKey()` (~8311), `openLibraryPreview()` (~8260), global `pointerdown` handler (~8341)
- Create: `scratch/bank-card-header-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`, `scratch/desktop-bank-actions-probe.mjs` (delete; see Step 1)

**Interfaces:**
- Consumes: `deviceBankIndex()` (Task 2).
- Produces: DOM `#bank-eyebrow-device` (span, `hidden` unless active bank is on the device), `#library-browse-${bi}` (button), `#library-popover-${bi}` (`role="dialog"`, `hidden` when closed), `toggleLibraryPopover(bi, force?) -> void`. Keeps `#quick-setup-picker-${bi}`, `#quick-setup-input-${bi}`, `#quick-setup-menu-${bi}`, `.bank-quick-setup`, `openQuickSetupMenu`, `closeQuickSetupMenu` unchanged in contract.
- Removes from the card top: `.bank-actions`, `.bank-action-btn`, the bank `.btn-remove-bank`, the `Save setup` button (moved to Task 7). **Task 7 must land before `npm test` is fully green** because Duplicate/Move/Delete are unreachable between Task 4 and Task 7 – do not ship or hand over between these tasks.

- [ ] **Step 1: Write the failing probe**

Create `scratch/bank-card-header-probe.mjs`:

```js
// Regression probe (minimal hybrid, spec 2026-09-26 §4): the bank card opens
// with "Bank N of M", a large editable name and a grey "Library setup ·
// Browse…" line; the searchable picker lives in a popover anchored to Browse….
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const head = await p.evaluate(() => {
  // Start from exactly 3 banks regardless of the default config.
  cfg.banks.splice(1); addBank(); addBank(); activeBank = 1; cfg.banks[1].name = 'Bank 2'; render();
  const card = document.querySelector('.bank-card');
  const name = card.querySelector('.bank-title-input');
  const cs = name && getComputedStyle(name);
  return {
    eyebrow: card.querySelector('.bank-eyebrow')?.textContent.replace(/\s+/g, ' ').trim(),
    deviceHidden: document.getElementById('bank-eyebrow-device')?.hidden,
    nameValue: name?.value, nameSize: cs && parseFloat(cs.fontSize), nameWeight: cs?.fontWeight, maxLength: name?.maxLength,
    iconBtn: !!card.querySelector('.icon-picker-trigger'),
    // label + link only – the hidden popover holds the whole option list
    sub: [...card.querySelectorAll('.bank-quick-setup-label, .library-browse-link')].map(el => el.textContent.trim()).join(' '),
    oldActions: card.querySelectorAll('.bank-actions, .bank-action-btn, .btn-remove-bank').length,
    saveSetupInCard: [...card.querySelectorAll('button')].some(el => el.textContent.trim() === 'Save setup'),
    inputVisible: (() => { const i = document.getElementById('quick-setup-input-1'); return !!i && i.getClientRects().length > 0; })(),
  };
});
P('eyebrow reads "Bank N of M"', /^Bank 2 of 3/.test(head.eyebrow || ''), head.eyebrow);
P('device suffix hidden when not connected', head.deviceHidden === true, String(head.deviceHidden));
P('bank name is the large editable title (32 px, 700, 24 chars)', head.nameValue === 'Bank 2' && head.nameSize === 32 && head.nameWeight === '700' && head.maxLength === 24, JSON.stringify(head));
P('bank icon picker stays next to the title', head.iconBtn);
P('subtitle is "Library setup Browse…"', head.sub === 'Library setup Browse…', head.sub);
P('no ‹ › ⧉ × or Save setup above the controls', head.oldActions === 0 && !head.saveSetupInCard, JSON.stringify(head));
P('search field is hidden until Browse…', head.inputVisible === false);

// Keyboard path: Browse… → input focused + menu open → Escape closes menu+popover → focus back on Browse….
await p.focus('#library-browse-1');
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 80));
const opened = await p.evaluate(() => ({
  popover: !document.getElementById('library-popover-1').hidden,
  expanded: document.getElementById('library-browse-1').getAttribute('aria-expanded'),
  focus: document.activeElement?.id,
  menu: !document.getElementById('quick-setup-menu-1').hidden,
  options: document.querySelectorAll('#quick-setup-menu-1 .quick-setup-option').length,
  cardLayer: document.querySelector('.bank-card').classList.contains('quick-menu-open'),
}));
P('Browse… opens the popover with the search focused and the list open', opened.popover && opened.expanded === 'true' && opened.focus === 'quick-setup-input-1' && opened.menu && opened.options > 0 && opened.cardLayer, JSON.stringify(opened));
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 50));
const closed = await p.evaluate(() => ({
  popover: !document.getElementById('library-popover-1').hidden,
  expanded: document.getElementById('library-browse-1').getAttribute('aria-expanded'),
  focus: document.activeElement?.id,
  cardLayer: document.querySelector('.bank-card').classList.contains('quick-menu-open'),
}));
P('Escape closes the popover and returns focus to Browse…', !closed.popover && closed.expanded === 'false' && closed.focus === 'library-browse-1' && !closed.cardLayer, JSON.stringify(closed));

// Choosing a setup: preview dialog opens, popover closes, Cancel returns focus to Browse….
await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
await p.evaluate(() => document.querySelector('#quick-setup-menu-1 .quick-setup-option')?.click());
await new Promise(r => setTimeout(r, 80));
const preview = await p.evaluate(() => ({
  overlay: !document.getElementById('library-preview-overlay').hidden,
  popover: !document.getElementById('library-popover-1').hidden,
}));
P('choosing a setup opens the preview dialog and closes the popover', preview.overlay && !preview.popover, JSON.stringify(preview));
await p.evaluate(() => closeLibraryPreview());
await new Promise(r => setTimeout(r, 50));
P('Cancel returns focus to Browse…', await p.evaluate(() => document.activeElement?.id === 'library-browse-1'));

// Outside click closes the popover.
await p.click('#library-browse-1');
await new Promise(r => setTimeout(r, 80));
await p.mouse.click(5, 450);
await new Promise(r => setTimeout(r, 50));
P('clicking outside closes the popover', await p.evaluate(() => document.getElementById('library-popover-1').hidden));

// Rename still works through the big title.
const renamed = await p.evaluate(() => {
  const el = document.querySelector('.bank-title-input');
  el.value = 'Strings'; el.dispatchEvent(new Event('change'));
  return { cfg: cfg.banks[activeBank].name, tab: document.querySelectorAll('.bank-block-tab')[activeBank]?.textContent.trim() };
});
P('renaming via the title updates cfg and the tab', renamed.cfg === 'Strings' && /Strings/.test(renamed.tab), JSON.stringify(renamed));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
```

In `scratch/run-all-probes.mjs` replace the entry `'desktop-bank-actions-probe.mjs',` with `'bank-card-header-probe.mjs',` and delete `scratch/desktop-bank-actions-probe.mjs` (`git rm`): its subject – icon actions at the card's right edge – no longer exists; the replacement coverage for Duplicate/Move/Delete is `bank-group-probe.mjs` in Task 7.

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- bank-card-header-probe.mjs`
Expected: FAIL (no `.bank-eyebrow`, no `#library-browse-1`, old actions present).

- [ ] **Step 3: New card header markup**

In `renderPanels()` replace the whole `const bankNameRowHtml = \`…\`;` template with:

```js
  const bankLabel = escHtml(b.name || 'Bank '+(bi+1));
  const bankNameRowHtml = `
    <div class="bank-block-name">
      <div class="bank-eyebrow">Bank ${bi+1} of ${cfg.banks.length}<span id="bank-eyebrow-device" ${deviceBankIndex() === bi ? '' : 'hidden'}> · active on device</span></div>
      <div class="bank-block-name-top">
        <button class="icon-picker-trigger ui-control ui-pill ui-glass" onclick="openIconPicker(${bi}, 'icon')" aria-label="Choose icon for bank ${bi+1}">
          ${b.icon
            ? `<span class="bank-icon-display">${escHtml(b.icon)}</span>`
            : /* keep the existing empty-icon SVG exactly as it is today */ ''}
        </button>
        <input class="bank-name-input bank-title-input" value="${bankLabel}"
          onchange="onBankRename(${bi}, this.value)" maxlength="24"
          placeholder="Bank name..." aria-label="Bank ${bi+1} name" />
      </div>
      <div class="bank-quick-setup">
        <span class="bank-quick-setup-label">Library setup</span>
        <button type="button" class="library-browse-link" id="library-browse-${bi}"
          aria-haspopup="dialog" aria-expanded="false" aria-controls="library-popover-${bi}"
          onclick="toggleLibraryPopover(${bi})">Browse…</button>
        <div class="library-popover" id="library-popover-${bi}" role="dialog" aria-label="Library setup" hidden>
          <div class="quick-setup-picker" id="quick-setup-picker-${bi}">
            <span class="library-quick-input-scale">
              <input class="library-quick-input" id="quick-setup-input-${bi}" placeholder="Search setups…" autocomplete="off"
                role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="quick-setup-menu-${bi}"
                aria-label="Search library and custom setups" onfocus="openQuickSetupMenu(${bi})"
                oninput="renderQuickSetupMenu(${bi},this.value)" onkeydown="quickSetupInputKey(event,${bi})" />
            </span>
            <div class="quick-setup-menu" id="quick-setup-menu-${bi}" role="listbox" hidden>${quickSetupMenuHtml('')}</div>
          </div>
        </div>
      </div>
    </div>
  `;
```
Important: for the `b.icon` false branch, copy the existing `<span class="bank-icon-empty"><svg …>…</svg></span>` literal from the current code unchanged (do not leave `''`).

- [ ] **Step 4: Popover behaviour**

Directly above `function openQuickSetupMenu(bi) {` add:

```js
// Library setup lives in a popover anchored to "Browse…" (spec 2026-09-26 §4).
// The picker inside (search, groups, keyboard, preview dialog, Apply) is the
// same component as before – this only owns open/close and focus return.
function toggleLibraryPopover(bi, force) {
  const pop = document.getElementById(`library-popover-${bi}`);
  const link = document.getElementById(`library-browse-${bi}`);
  if (!pop || !link) return;
  const open = force ?? pop.hidden;
  pop.hidden = !open;
  link.setAttribute('aria-expanded', String(open));
  if (open) document.getElementById(`quick-setup-input-${bi}`)?.focus();   // onfocus opens the list
  else closeQuickSetupMenu(bi);
  refreshBankMenuLayer();
}
```

Replace the body of `refreshBankMenuLayer()` with:

```js
  const open = document.querySelector('.quick-setup-menu:not([hidden]), .library-popover:not([hidden])');
  document.querySelector('.bank-card')?.classList.toggle('quick-menu-open', !!open);
```

In `quickSetupInputKey()` replace the Escape line with:

```js
  if (event.key === 'Escape') {
    event.preventDefault();
    toggleLibraryPopover(bi, false);
    document.getElementById(`library-browse-${bi}`)?.focus();
    return;
  }
```

In `openLibraryPreview()` replace
```js
  _libraryPreviewReturnFocus = document.getElementById(`quick-setup-input-${activeBank}`) || document.activeElement;
  closeQuickSetupMenu(activeBank);
```
with
```js
  _libraryPreviewReturnFocus = document.getElementById(`library-browse-${activeBank}`) || document.activeElement;
  toggleLibraryPopover(activeBank, false);
```

In the global `pointerdown` listener add, before the `.quick-setup-picker` loop:

```js
  document.querySelectorAll('.library-popover:not([hidden])').forEach(pop => {
    const bi = Number(pop.id.split('-').pop());
    if (!pop.contains(event.target) && !event.target.closest(`#library-browse-${bi}`)) toggleLibraryPopover(bi, false);
  });
```

- [ ] **Step 5: CSS**

Replace `.bank-block-name{…}`, `.bank-block-name-top{…}`, `.bank-quick-setup{…}`, `.bank-quick-setup-label{…}`, `.quick-setup-picker{…}` (~2107–2124) with:

```css
.bank-block-name{
  display:flex;flex-direction:column;gap:2px;
  padding:18px 18px 14px;
}
.bank-eyebrow{font-size:var(--fs-base);color:var(--t2)}
.bank-block-name-top{
  display:flex;align-items:center;gap:var(--space-2);
}
.bank-quick-setup{position:relative;display:flex;align-items:baseline;gap:6px;min-width:0;font-size:var(--fs-lg)}
.bank-quick-setup-label{color:var(--t2);white-space:nowrap}
.library-browse-link{border:1px solid transparent;border-radius:var(--r-pill);background:none;padding:0 4px;margin-left:-4px;color:var(--red);font:600 var(--fs-lg) 'Mulish',sans-serif;cursor:pointer}
.library-browse-link:hover{color:var(--red2)}
.library-popover{position:absolute;top:calc(100% + 6px);left:0;z-index:120;width:min(360px,calc(100vw - 40px));padding:8px;border-radius:var(--r);background:var(--bg-card);box-shadow:0 0 0 1px var(--border),var(--shadow)}
.library-popover[hidden]{display:none}
.quick-setup-picker{position:relative;width:100%}
```
In `.quick-setup-menu{left:0;width:…}` (~2149) set `position:static;margin-top:6px;width:100%;box-shadow:none;border:0;padding:0;background:none;backdrop-filter:none;-webkit-backdrop-filter:none` **only** for the library picker via a new rule placed after it (the RANGE PRESET menu shares `.quick-setup-menu` and must keep its floating look):

```css
.library-popover .quick-setup-menu{position:static;margin-top:6px;width:100%;max-height:310px;padding:0;border:0;background:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
```

Replace the first-run cue target: `.bank-quick-setup.is-first-run-highlight .library-quick-input{animation:…}` → `.bank-quick-setup.is-first-run-highlight .library-browse-link{animation:library-setup-cue 1.65s var(--ease-out)}`, and the same selector swap inside the `prefers-reduced-motion` rule. In `@keyframes library-setup-cue` change `0%,100%{border-color:var(--border-s);…}` to `0%,100%{border-color:transparent;…}`.

Add the display title rule after `.bank-name-input::placeholder{…}` (~730):

```css
/* Bank name as the card title (spec 2026-09-26 §4). Same input, same limits,
   display size; .fader-title-input shares .bank-name-input and stays small. */
.bank-title-input{font-size:var(--fs-display);font-weight:700;letter-spacing:-.025em;line-height:1.15;max-width:100%;padding:0}
```

Delete now-dead rules: `.bank-actions{…}`, `.bank-action-btn{…}`, `.bank-action-btn::before,.btn-remove-bank::before{…}` → keep only `.btn-remove-bank::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:auto}` (macro-clear still uses `.btn-remove-bank`), `.bank-action-btn svg{…}`, the whole `@media (min-width:768px) and (hover:hover){ .bank-actions … }` block, and in `@media(pointer:coarse)` (~1050) change `.btn-remove-bank,.bank-action-btn{…}` to `.btn-remove-bank{…}`. In the `@media(max-width:540px)` block (~790–815) delete `.bank-quick-setup{padding-left:0;flex-wrap:wrap;}`, `.bank-quick-setup-label{width:100%;}`, `.quick-setup-picker{max-width:none;}` and the comment about `.bank-actions` wrapping.

- [ ] **Step 6: Fix probes that pointed at the bank ×**

- `scratch/a1-mobile-bank-actions-probe.mjs`: it measures `.bank-actions` / `.btn-remove-bank` overflow at mobile width. Keep its viewport and bank setup (the Delete row only exists with > 1 bank – if the probe does not already add a bank, add `addBank(); render();` before measuring). Retarget to the Bank group from Task 7: replace `document.querySelector('.bank-actions')` with `document.querySelector('.settings-group[data-group="bank"]')` and `document.querySelector('.btn-remove-bank')` with `document.querySelector('.group-row[data-bank-action="delete"]')`, rename the three labels to "Delete bank row stays within its group", "Delete bank row stays within the viewport", "Bank group has no horizontal overflow". This probe stays red until Task 7.
- `scratch/k7-details-probe.mjs` line ~32 and `scratch/safe-batch-2026-07-20-probe.mjs` line ~63 read `.btn-remove-bank` for the bank ×. Make both set up an assigned macro first so the remaining `.btn-remove-bank` (macro clear, `#macro-clear`) exists: before the query add `DEVICE_INFO.hid_enabled = true; cfg.macro_global = true; cfg.macro_keys = [0x2C]; _openSections.add('macro'); render();` and query `#macro-clear` instead. Rename the k7 label to "macro × is neutral in dark mode too (danger only on hover)". Read each probe's surrounding lines first and keep its theme setup (dark toggle) intact.

- [ ] **Step 7: Run**

Run: `npm test -- bank-card-header-probe.mjs library-mechanism-label-probe.mjs library-names-bank-probe.mjs articulation-templates-unified-probe.mjs k7-details-probe.mjs safe-batch-2026-07-20-probe.mjs c10-bank-switch-preserves-edit-probe.mjs bank-fader-name-limits-match-firmware-probe.mjs mobile-ux-probe.mjs bank-live-dot-probe.mjs`
Expected: all PASS (including the eyebrow assert in `bank-live-dot-probe`). `mobile-ux-probe` scrolls to `.bank-quick-setup` and checks the first-run cue class – both still exist. `a1-mobile-bank-actions-probe` is expected red until Task 7.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/bank-card-header-probe.mjs scratch/run-all-probes.mjs scratch/a1-mobile-bank-actions-probe.mjs scratch/k7-details-probe.mjs scratch/safe-batch-2026-07-20-probe.mjs
git rm scratch/desktop-bank-actions-probe.mjs
git commit -m "feat(design/minimal): bank card header – eyebrow, display name, Library setup popover

Bank utility icons and Save setup leave the card top (they return as the Bank
group below the controls). Browse… opens the unchanged searchable picker in a
popover; Escape and preview Cancel return focus to Browse….

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Section headers – mark, one title, mono summary, chevron › (spec §5, criterion 5)

**Files:**
- Modify: `feel-fader.html` – `sectionHeaderHtml()` (~2757–2782), its callers `faderSectionContent()` (~3368–3374), `encoderPanel()` (~3637), `macroSectionContent()` (~3708); CSS `.section-toggle-*`, `.section-summary*`, `.section-chevron`, `.bank-section.is-open .section-chevron`, `.fader-side-cap`, `.fader-title-input`, `.section-head`, `.bank-section` (~760, ~1905–1990)
- Modify: `scratch/design-consistency-probe.mjs`

**Interfaces:**
- `sectionHeaderHtml(bi, key, title, summary, tip, extra)` – the `cap` parameter is removed; marks come from `SECTION_MARKS[key]`. All ids stay: `section-toggle-${bi}-${key}`, `section-title-${bi}-${key}`, `section-summary-${bi}-${key}`, `section-body-${bi}-${key}`.
- Macro section title changes from "Macro" to "Button".

- [ ] **Step 1: Failing asserts**

In `scratch/design-consistency-probe.mjs`, after the Task 1/3 `surf` asserts, add:

```js
const heads = await p.evaluate(async () => {
  // The K-1..K-5 block above leaves the roller in Keyswitch mode – reset to Articulation.
  cfg.banks[0].roller_mode = 'cc';
  _openSections.clear(); _openSections.add('roller'); render();
  const out = { rows: [] };
  for (const key of ['fader1', 'fader2', 'roller', 'macro']) {
    const head = document.querySelector(`.bank-section[data-fader="${key}"] > .section-head`);
    const upper = [...head.querySelectorAll('*')].filter(el => el.getClientRects().length && getComputedStyle(el).textTransform === 'uppercase' && el.textContent.trim());
    const summary = document.getElementById(`section-summary-0-${key}`);
    const title = document.getElementById(`section-title-0-${key}`);
    const chev = head.querySelector('.section-chevron');
    out.rows.push({
      key,
      upper: upper.map(el => el.textContent.trim()),
      title: title?.value ?? title?.textContent,
      summaryMono: summary ? /Plex Mono/.test(getComputedStyle(summary.querySelector('.section-summary-meta, .section-summary-label') || summary).fontFamily) : null,
      summaryBelow: summary && title ? summary.getBoundingClientRect().top >= title.getBoundingClientRect().bottom - 1 : false,
      chevron: chev ? getComputedStyle(chev).transform : null,
      mark: head.querySelector('.section-mark')?.textContent.trim() ?? null,
    });
  }
  return out;
});
P('section headers carry no uppercase caption', heads.rows.every(r => r.upper.length === 0), JSON.stringify(heads.rows.map(r => r.upper)));
P('section titles are Expression / Dynamics / Articulation / Button', heads.rows.map(r => r.title).join() === 'Expression,Dynamics,Articulation,Button', heads.rows.map(r => r.title).join());
P('summary sits under the title in Plex Mono', heads.rows.every(r => r.summaryBelow && r.summaryMono !== false), JSON.stringify(heads.rows));
P('marks are L / R and icons', heads.rows[0].mark === 'L' && heads.rows[1].mark === 'R', JSON.stringify(heads.rows.map(r => r.mark)));
P('open section chevron is rotated, closed is not', heads.rows[2].chevron !== 'none' && heads.rows[0].chevron === 'none', JSON.stringify(heads.rows.map(r => r.chevron)));
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- design-consistency-probe.mjs`
Expected: FAIL on the five new asserts.

- [ ] **Step 3: Header markup**

Above `function sectionHeaderHtml(` add:

```js
// Section marks (spec 2026-09-26 §5): quiet glyph on the left instead of the
// old uppercase LEFT FADER / RIGHT FADER / ROLLER / BUTTON caption.
const SECTION_MARKS = {
  fader1: 'L',
  fader2: 'R',
  roller: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="1.5" width="9" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 5h5M4.5 7h5M4.5 9h5" stroke="currentColor" stroke-width="1.1"/></svg>',
  macro: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>',
};
const SECTION_CHEVRON = '<svg class="section-chevron" viewBox="0 0 9 14" aria-hidden="true"><path d="M1.5 1.5L7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
```
(`rx="2"` inside an inline SVG attribute is not a CSS `border-radius` and is not matched by the radius guard.)

Replace `sectionHeaderHtml` with:

```js
function sectionHeaderHtml(bi, key, title, summary, tip, extra) {
  const open = isSectionOpen(key);
  const tipAttr = tip ? ` data-tip="${escHtml(tip)}"` : '';
  const mark = `<span class="section-mark" aria-hidden="true">${SECTION_MARKS[key]}</span>`;
  const summaryHtml = summary ? `<span class="section-summary" id="section-summary-${bi}-${key}">${sectionSummaryHtml(summary)}</span>` : '';
  if (key === 'fader1' || key === 'fader2') {
    const side = key === 'fader1' ? 'Left' : 'Right';
    return `<div class="section-head section-toggle section-head-editable" data-fader="${key}"${tipAttr}
      onclick="if(!event.target.closest('input,button'))toggleSection('${key}',event)">
      ${mark}
      <span class="section-toggle-title">
        <input class="bank-name-input fader-title-input" id="section-title-${bi}-${key}" value="${escHtml(title)}" maxlength="12"
          oninput="onFaderName(${bi},'${key}',this.value)"
          onblur="if(!this.value.trim()){this.value='${defaultFaderName(key)}';onFaderName(${bi},'${key}',this.value)}"
          onkeydown="if(event.key==='Enter')this.blur()" aria-label="${side} fader display name" />
        ${summaryHtml}
      </span>
      <button type="button" class="section-toggle-action" id="section-toggle-${bi}-${key}"
        onclick="toggleSection('${key}',event)" aria-expanded="${open}" aria-controls="section-body-${bi}-${key}" aria-label="${open?'Collapse':'Expand'} ${escHtml(title)} settings">
        ${SECTION_CHEVRON}
      </button>
    </div>`;
  }
  return `<button type="button" class="section-head section-toggle" id="section-toggle-${bi}-${key}" data-fader="${key}"${tipAttr}
    onclick="toggleSection('${key}',event)" aria-expanded="${open}" aria-controls="section-body-${bi}-${key}">
      ${mark}
      <span class="section-toggle-title"><span class="panel-name${key==='roller'?' roller-mode-title':''}" id="section-title-${bi}-${key}">${escHtml(title)}</span>${summaryHtml}</span>
      <span class="section-toggle-meta">${extra||''}${SECTION_CHEVRON}</span>
    </button>`;
}
```

Update callers:
- `faderSectionContent()`: delete `const sideCap = …;` and change the call to `sectionHeaderHtml(bi,key,displayLabel,faderSectionSummary(ctrl),'Sends a MIDI CC…')` (drop `sideCap`).
- `encoderPanel()`: `sectionHeaderHtml(bi,'roller',rollerModeTitle(rmode),rollerSectionSummary(cfg.banks[bi]),'Sends MIDI CC…')` (drop `'ROLLER'`).
- `macroSectionContent()`: `sectionHeaderHtml(bi,'macro','Button',summary,'A long-press…',headerWarn)` (drop `'BUTTON'`, title `'Macro'` → `'Button'`).

Check `markSectionIssues()` (~5087–5095): it inserts the issue dot into `.section-toggle-meta || .section-toggle-action || head` – still valid (fader: `.section-toggle-action`, others: `.section-toggle-meta`). No change.

- [ ] **Step 4: CSS**

Replace `.fader-side-cap{…}` (~760) with:

```css
.section-mark{width:22px;flex:none;display:flex;justify-content:center;font:500 var(--fs-md) 'IBM Plex Mono',monospace;color:var(--t3)}
```
Replace `.section-toggle-title{…}` with `.section-toggle-title{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}` and delete `.section-head-editable .section-toggle-title{flex:1}` (now redundant).
In `.fader-title-input{…}` change `font-size:var(--fs-base)` to `font-size:var(--fs-xl);font-weight:600`.
Add `.section-toggle-title .panel-name{font-size:var(--fs-xl);font-weight:600;letter-spacing:-.005em}` after it.
Replace `.section-summary{…}` with:

```css
.section-summary{display:inline-flex;align-items:baseline;gap:5px;min-width:0;max-width:100%;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:var(--fs-md);line-height:1.25}
```
In `.section-summary-label{…}` change `font:600 var(--fs-sm) 'Mulish',sans-serif` to `font:500 var(--fs-md) 'IBM Plex Mono',monospace`; in `.section-summary-meta{…}` change `var(--fs-sm)` to `var(--fs-md)` (spec: the whole secondary line is Plex Mono `--t2`).
Replace `.section-chevron{…}` and `.bank-section.is-open .section-chevron{…}` with:

```css
.section-chevron{width:9px;height:14px;flex:none;color:var(--t3);transition:transform .25s var(--ease-out)}
.bank-section.is-open .section-chevron{transform:rotate(90deg)}
```
In `.section-head{…}` (~1977) set `gap:14px;padding-bottom:0;border-bottom:0;margin-bottom:0;min-height:60px` and in `.section-head.section-toggle{…}` drop `border-bottom:1px solid var(--border)`. In `.bank-section{…}` (~1905) change `padding:11px 14px` to `padding:0 18px`; add `.bank-section.is-open>.section-collapse-body{padding:4px 0 18px 36px}`. Delete `.bank-section.is-collapsed .section-head{…}` and `html.dark .section-head{…}` (no bottom border any more). `.bank-section-encoder{padding:11px 14px}` → `padding:0 18px`. `.bank-section-divider{…}` keep, add `margin:0 0 0 18px` (inset hairline as in the mockup).
In the `@media(max-width:540px)` block, `.section-summary{max-width:145px;}` → delete (the summary now has its own line).

- [ ] **Step 5: Run**

Run: `npm test -- design-consistency-probe.mjs hud-readable-summaries-probe.mjs sections-independent-probe.mjs section-toggle-focus-ring-probe.mjs touch-target-stepper-specificity-probe.mjs fader-name-input-width-probe.mjs validation-single-signal-probe.mjs per-bank-macro-probe.mjs help-deep-links-probe.mjs mobile-ux-probe.mjs`
Expected: all PASS. If `fader-name-input-width-probe` asserts the old 13 px input width, keep its intent (field width follows content, capped at 190 px) and update only the numeric expectation that follows from the 16 px font – read the probe before changing it and state the change in the commit message.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/design-consistency-probe.mjs
git commit -m "feat(design/minimal): section headers – mark, single title, mono summary, chevron

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Roller order as a vertical list with live row (spec §6, criterion 6)

**Files:**
- Modify: `feel-fader.html` – `ccEncoderBody()` (~3408–3466), `keyswitchTagsHtml()` (~3477–3496), keyswitch add row in `keyswitchBody()` (~3591–3596), `renderEncChips()` (~3763), `onMidiMsg()` live paths (~5383–5402), `sequenceDragOver()` (~4718), CSS `.uacc-grid` … `.uacc-tag*`, `.ks-note-chip*`, `.ks-midi-number`, `.ks-note-actions`, `.uacc-num`, `.uacc-label`, `.enc-chip*`, `.uacc-add-row`, drag-state rules (~660–680, ~836–849, ~2216–2219, ~1067, ~813)
- Create: `scratch/roller-order-list-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:**
- Produces: `sequenceRowHtml({kind, bi, index, count, name, value, live, nameClass, valueClass, aria, extraAttrs}) -> string` and `syncUaccLiveRow() -> void` (replaces `renderEncChips`).
- Keeps (probes rely on them): `#uacc-grid`, `#ks-tags-${bi}`, `[data-sequence-kind]`, `[data-sequence-index]`, `[data-ksnote]`, `.uacc-label`, `.uacc-num`, `.ks-note-name`, `.ks-midi-number`, `.ks-name-input` (via `startKsNameEdit`), `.tag-order-btn`, `.tag-remove-btn`, `#uacc-input`, `#uacc-preset-btn`, `#uacc-preset-dropdown`, `#ks-note-input-${bi}`, aria-label wording "position N of M … Alt plus arrow keys".

- [ ] **Step 1: Write the failing probe**

Create `scratch/roller-order-list-probe.mjs`:

```js
// Regression probe (minimal hybrid, spec 2026-09-26 §6): roller order is a
// vertical list (index · name · value · ≡). Drag uses the vertical midpoint,
// Alt+↑/↓ reorders with focus following, Move/× are hidden at rest but stay
// in the tab order and show on focus, and the live row follows the value.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

const layout = await p.evaluate(() => {
  cfg.banks[0].roller_mode = 'cc'; cfg.banks[0].uacc_values = [20, 1, 42];
  activeBank = 0; _openSections.clear(); _openSections.add('roller'); render();
  const rows = [...document.querySelectorAll('#uacc-grid .seq-row')];
  const r = rows.map(el => el.getBoundingClientRect());
  const actions = rows[1].querySelector('.seq-actions');
  return {
    count: rows.length,
    vertical: r.every((x, i) => i === 0 || (x.top >= r[i-1].bottom - 1 && Math.abs(x.left - r[0].left) < 1)),
    cells: rows.map(el => [el.querySelector('.seq-index')?.textContent.trim(), el.querySelector('.uacc-label')?.textContent.trim(), el.querySelector('.uacc-num')?.textContent.trim(), !!el.querySelector('.seq-handle')]),
    restOpacity: getComputedStyle(actions).opacity,
    links: [...document.querySelectorAll('#section-body-0-roller .seq-link')].map(el => el.textContent.trim()),
  };
});
P('articulations render as one vertical list', layout.count === 3 && layout.vertical, JSON.stringify(layout));
P('row reads index · name · value · handle', JSON.stringify(layout.cells[0]) === JSON.stringify(['1', 'Legato', '20', true]), JSON.stringify(layout.cells));
P('row actions are hidden at rest', layout.restOpacity === '0', layout.restOpacity);
P('Add articulation… and Templates… are text links', layout.links.join() === 'Add articulation…,Templates…', layout.links.join());

// Tab from the row reaches Move earlier, and focus reveals the actions.
await p.focus('#uacc-grid .seq-row[data-sequence-index="1"]');
await p.keyboard.press('Tab');
await wait(200);
const tabbed = await p.evaluate(() => ({
  focusTitle: document.activeElement?.title,
  shown: getComputedStyle(document.querySelector('#uacc-grid .seq-row[data-sequence-index="1"] .seq-actions')).opacity,
}));
P('Tab reaches the row actions and focus shows them', tabbed.focusTitle === 'Move earlier' && tabbed.shown === '1', JSON.stringify(tabbed));

// Alt+ArrowDown reorders and focus follows.
await p.focus('#uacc-grid .seq-row[data-sequence-index="0"]');
await p.keyboard.down('Alt'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Alt');
await wait(60);
const moved = await p.evaluate(() => ({ values: cfg.banks[0].uacc_values.join(), focus: document.activeElement?.dataset?.sequenceIndex }));
P('Alt+ArrowDown moves the row and focus follows', moved.values === '1,20,42' && moved.focus === '1', JSON.stringify(moved));

// Drag uses the vertical midpoint: drop row 0 onto the lower half of row 2 → last.
const dragged = await p.evaluate(() => {
  const rows = () => [...document.querySelectorAll('#uacc-grid .seq-row')];
  const dt = new DataTransfer();
  const src = rows()[0], dst = rows()[2], rect = dst.getBoundingClientRect();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles:true, cancelable:true, dataTransfer:dt }));
  dst.dispatchEvent(new DragEvent('dragover', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:rect.left + 5, clientY:rect.bottom - 3 }));
  const after = dst.classList.contains('sequence-drop-after');
  dst.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:rect.left + 5, clientY:rect.bottom - 3 }));
  return { after, values: cfg.banks[0].uacc_values.join() };
});
P('drop position follows the vertical midpoint', dragged.after && dragged.values === '20,42,1', JSON.stringify(dragged));

// Live row follows the received value.
const live = await p.evaluate(() => {
  _midiState = 'granted'; _ffConnected = true; liveBank = 0;
  const bank = cfg.banks[0];
  onMidiMsg({ data: new Uint8Array([0xB0 | bank.encoder.channel, bank.encoder.cc, 42]) });
  const liveRows = () => [...document.querySelectorAll('#uacc-grid .seq-row.is-live')].map(el => el.dataset.value);
  const first = liveRows();
  moveUacc(1, -1);   // 42 moves to index 0 → render()
  return { first, afterMove: liveRows(), weight: getComputedStyle(document.querySelector('#uacc-grid .seq-row.is-live .uacc-label')).fontWeight };
});
P('live articulation row is marked and bold', live.first.join() === '42' && live.weight === '700', JSON.stringify(live));
P('live marker follows the value after a reorder', live.afterMove.join() === '42', JSON.stringify(live));

// Keyswitch list shares the component.
const ks = await p.evaluate(() => {
  const bank = cfg.banks[0];
  bank.roller_mode = 'keyswitch'; bank.ks_channel = 0; bank.ks_notes = [24, 25, 26];
  _openRollerAdvanced.add(0); render();
  onMidiMsg({ data: new Uint8Array([0x90, 25, 100]) });
  const rows = [...document.querySelectorAll('#ks-tags-0 .seq-row')];
  return { count: rows.length, live: rows.filter(el => el.classList.contains('is-live')).map(el => el.dataset.ksnote), handle: rows.every(el => el.querySelector('.seq-handle')) };
});
P('keyswitches use the same row list with a live row', ks.count === 3 && ks.live.join() === '25' && ks.handle, JSON.stringify(ks));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
```

Register `'roller-order-list-probe.mjs',` in `PROBES` right after `'articulation-templates-unified-probe.mjs',`.

Before writing Step 3, run `grep -n "^function onMidiMsg" feel-fader.html` and read its first ~15 lines to confirm it accepts an event with `.data` (the probe calls it directly, as other probes do – check `grep -rn "onMidiMsg(" scratch` for the existing call shape and copy it if it differs).

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- roller-order-list-probe.mjs`
Expected: FAIL (no `.seq-row`).

- [ ] **Step 3: Shared row markup**

Above `function ccEncoderBody(` add:

```js
// Roller order row shared by articulations and keyswitches (spec 2026-09-26 §6):
// index · name · value · ≡, Move/× revealed on hover/focus but always in the
// tab order. Class names inside (.uacc-label/.uacc-num, .ks-note-name/
// .ks-midi-number) are kept because probes and startKsNameEdit() use them.
function sequenceRowHtml({kind, bi, index, count, name, value, live, nameClass, valueClass, aria, extraAttrs = '', moveLabel, removeLabel, onMove, onRemove}) {
  return `
    <div class="seq-row${live ? ' is-live' : ''}" tabindex="0" draggable="true" data-sequence-kind="${kind}" data-sequence-index="${index}" ${extraAttrs}
      aria-label="${aria}"
      ondragstart="sequenceDragStart(event,'${kind}',${bi},${index})" ondragover="sequenceDragOver(event,${index})" ondrop="sequenceDrop(event,${index})" ondragend="sequenceDragEnd()">
      <span class="seq-index" aria-hidden="true">${index+1}</span>
      <span class="seq-name ${nameClass}">${name}</span>
      <span class="seq-value ${valueClass}">${value}</span>
      <span class="seq-actions" role="group" aria-label="Sequence controls">
        <button class="tag-order-btn" onclick="${onMove(-1)}" title="Move earlier" aria-label="Move ${moveLabel} earlier" ${index===0?'disabled':''}>‹</button>
        <button class="tag-order-btn" onclick="${onMove(1)}" title="Move later" aria-label="Move ${moveLabel} later" ${index===count-1?'disabled':''}>›</button>
        <button class="tag-remove-btn" onclick="${onRemove}" title="Remove" aria-label="${removeLabel}">✕</button>
      </span>
      <span class="seq-handle" aria-hidden="true">≡</span>
    </div>`;
}
```

In `ccEncoderBody()` replace the `const uaccTags = bankUacc.map(…).join('');` block with:

```js
  const uaccTags = bankUacc.map((v,i) => sequenceRowHtml({
    kind:'uacc', bi, index:i, count:bankUacc.length,
    name:uaccName(v), value:v, live: encLiveVal !== null && v === encLiveVal,
    nameClass:'uacc-label', valueClass:'uacc-num',
    aria:`${uaccName(v)}, value ${v}, position ${i+1} of ${bankUacc.length}. Drag or use Alt plus arrow keys to reorder.`,
    extraAttrs:`data-value="${v}" title="Value ${v}" onkeydown="sequenceChipKey(event,'uacc',${bi},${i})"`,
    moveLabel:uaccName(v), removeLabel:`Remove articulation value ${v}`,
    onMove:d => `moveUacc(${i},${d})`, onRemove:`removeUacc(${i})`,
  })).join('');
```
Note the remove label changes from "Remove articulation CC N" to "Remove articulation value N" – `articulation-value-wording-probe` requires chip labels describe a value, not a CC; run it in Step 7.

Replace the "enc-right" block's list and add row in `ccEncoderBody()` (from `<div class="ks-sequence-head">` through the closing `</div>` of `.uacc-add-row`) with:

```html
        <div class="ks-sequence-head"><span class="field-label">ROLLER ORDER</span><span class="uacc-note">Drag or Alt + ↑↓</span></div>
        <div class="seq-list" id="uacc-grid">${uaccTags}</div>
        <div class="seq-add-row">
          <input type="number" id="uacc-input" min="0" max="127" placeholder="Value 0–127" aria-label="Articulation value (0–127)"
            onkeydown="if(event.key==='Enter')addUacc()"/>
          <button type="button" class="seq-link" onclick="addUacc()">Add articulation…</button>
          <div class="uacc-presets-wrap">
            <button type="button" class="seq-link" onclick="toggleUaccPresets()" id="uacc-preset-btn">Templates…</button>
            <!-- #uacc-preset-dropdown block: keep the existing markup unchanged -->
          </div>
        </div>
```
Copy the existing `<div class="uacc-preset-dropdown" id="uacc-preset-dropdown" style="display:none">…</div>` block verbatim into the marked place. Check `toggleUaccPresets()` (~4429) for any text it writes into `#uacc-preset-btn` (e.g. "▾/▴"); if it does, make it only toggle the dropdown and `aria-expanded`, not the label.

In `keyswitchTagsHtml()` replace the `notes.map(…)` body with:

```js
  const tags = notes.map((n,i) => {
    // UX audit C-1: a named keyswitch leads with its articulation, note second.
    const name = bank.ks_names?.[n] ? escHtml(bank.ks_names[n]) : '';
    return sequenceRowHtml({
      kind:'keyswitch', bi, index:i, count:notes.length,
      name: name || noteName(n), value: name ? `${noteName(n)} · ${n}` : n,
      live: n === ksLiveNote, nameClass:'ks-note-name', valueClass:'ks-midi-number',
      aria:`${name ? `${name}, ` : ''}${noteName(n)}, MIDI ${n}, position ${i+1} of ${notes.length}. Press F2 to name. Drag or use Alt plus arrow keys to reorder.`,
      extraAttrs:`data-ksnote="${n}" title="${name ? `${name} · ` : ''}${noteName(n)} · MIDI ${n} · double-click to name" ondblclick="if(!event.target.closest('button, input'))startKsNameEdit(${bi},${i})" onkeydown="if(event.key==='F2'&&event.target===this){event.preventDefault();startKsNameEdit(${bi},${i});}else sequenceChipKey(event,'keyswitch',${bi},${i})"`,
      moveLabel:noteName(n), removeLabel:`Remove keyswitch MIDI note ${n}`,
      onMove:d => `moveKsNote(${bi},${i},${d})`, onRemove:`removeKsNote(${bi},${i})`,
    });
  }).join('');
```
Copy the `ondragstart` rest of the original keyswitch chip only if it differs from the shared handler (it does not – both call `sequenceDragStart(event,kind,bi,i)`; confirm by reading the truncated original line).

In `keyswitchBody()` replace `<div class="uacc-grid ks-sequence-grid" id="ks-tags-${bi}">` with `<div class="seq-list" id="ks-tags-${bi}">`, change the ROLLER ORDER hint `First → last` to `Drag or Alt + ↑↓`, and replace the add row with:

```html
        <div class="seq-add-row">
          <input type="number" id="ks-note-input-${bi}" placeholder="MIDI 0–127" min="0" max="127" aria-label="Keyswitch MIDI note" />
          <button type="button" class="seq-link" onclick="addKsNote(${bi})" aria-label="Add keyswitch note">Add note…</button>
        </div>
```

- [ ] **Step 4: Live marking and vertical drag**

Replace `renderEncChips()` with:

```js
// Live articulation row (spec 2026-09-26 §6): the row whose value the roller
// last sent is marked, same idiom as the keyswitch live row.
function syncUaccLiveRow() {
  document.querySelectorAll('#uacc-grid .seq-row').forEach(el => el.classList.toggle('is-live', encLiveVal !== null && +el.dataset.value === encLiveVal));
}
```
In `onMidiMsg()` replace `if(idx !== -1){ encIndex = idx; renderEncChips(); }` with `if(idx !== -1) encIndex = idx;` followed by `syncUaccLiveRow();` on its own line (the row un-marks when an unknown value arrives). Replace the keyswitch lines

```js
      document.querySelectorAll('.uacc-tag.ks-live').forEach(el => el.classList.remove('ks-live'));
      const cell = document.querySelector(`.uacc-tag[data-ksnote="${note}"]`);
      if (cell) cell.classList.add('ks-live');
```
with
```js
      document.querySelectorAll('.seq-row.is-live[data-ksnote]').forEach(el => el.classList.remove('is-live'));
      document.querySelector(`.seq-row[data-ksnote="${note}"]`)?.classList.add('is-live');
```
Run `grep -n "renderEncChips\|ks-live\|uacc-tag\|ks-note-chip\|articulation-chip\|enc-chip" feel-fader.html` and remove every remaining reference (CSS included); the grep must end empty.

In `sequenceDragOver()` replace `event.clientX > rect.left + rect.width/2` with `event.clientY > rect.top + rect.height/2`.

- [ ] **Step 5: CSS**

Delete the rules for `.enc-chip`, `.enc-chip.active`, `.uacc-grid`, `.uacc-tag*` (all, including the drag-state rules ~2216–2219 and `html.dark .uacc-tag`), `.uacc-add-row*`, `.ks-sequence-grid`, `.ks-note-chip*`, `.ks-midi-number`, `.ks-note-actions*`, `.ks-note-name`, `.uacc-num`, `.uacc-label`, and the mobile `.uacc-tag{…}` / coarse `.uacc-tag button{…}` lines. Keep `.ks-sequence-head`, `.ks-name-input`, `.uacc-presets-wrap`, `.uacc-preset-dropdown*`, `.uacc-note`. Add after `.ks-sequence-head{…}`:

```css
/* Roller order list (spec 2026-09-26 §6) – shared by articulations and keyswitches. */
.seq-list{border-top:1px solid var(--border)}
.seq-row{position:relative;display:flex;align-items:center;gap:var(--space-3);min-height:38px;padding:0 2px;border-bottom:1px solid var(--border);font-size:var(--fs-lg);color:var(--t1);cursor:grab}
.seq-row:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
.seq-index{width:20px;flex:none;text-align:right;font:400 var(--fs-md) 'IBM Plex Mono',monospace;color:var(--t3)}
.seq-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
.seq-value{flex:none;font:400 var(--fs-md) 'IBM Plex Mono',monospace;color:var(--t2);font-variant-numeric:tabular-nums}
.seq-handle{width:14px;flex:none;text-align:center;color:var(--t3);font-size:var(--fs-lg)}
.seq-actions{display:flex;align-items:center;gap:2px;opacity:0;transition:opacity var(--dur-fast) ease}
.seq-row:hover .seq-actions,.seq-row:focus-within .seq-actions{opacity:1}
.seq-actions button{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:var(--r-pill);background:none;color:var(--t3);font-size:var(--fs-md);cursor:pointer}
.seq-actions .tag-order-btn:hover{background:var(--bg-input);color:var(--t1)}
.seq-actions .tag-order-btn:disabled{opacity:.3;cursor:default;background:none;color:var(--t3)}
.seq-actions .tag-remove-btn:hover{background:var(--danger-bg);color:var(--danger)}
.seq-row.is-live .seq-name{font-weight:700}
.seq-row.is-live .seq-index{color:var(--green)}
.seq-row.is-live::before{content:'';position:absolute;left:-12px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--green)}
.seq-row.is-sequence-dragging{opacity:.42;cursor:grabbing}
.seq-row.sequence-drop-before{box-shadow:inset 0 2px 0 var(--red)}
.seq-row.sequence-drop-after{box-shadow:inset 0 -2px 0 var(--red)}
.seq-add-row{display:flex;align-items:center;gap:var(--space-4);margin-top:var(--space-3)}
.seq-add-row input{width:110px;height:30px;padding:0 10px;border:0;border-radius:var(--r-pill);background:var(--bg-input);color:var(--t1);font:var(--fs-md) 'Mulish',sans-serif;outline:none;-moz-appearance:textfield}
.seq-add-row input::-webkit-inner-spin-button,.seq-add-row input::-webkit-outer-spin-button{-webkit-appearance:none}
.seq-add-row input:focus-visible{box-shadow:0 0 0 2px color-mix(in srgb,var(--focus) 30%,transparent)}
.seq-link{border:0;background:none;padding:0;color:var(--red);font:600 var(--fs-lg) 'Mulish',sans-serif;cursor:pointer}
.seq-link:hover{color:var(--red2)}
@media(pointer:coarse){.seq-actions{opacity:1}.seq-actions button{width:32px;height:32px}}
```
`articulation-value-wording-probe` checks the placeholder "Value 0–127" is not clipped by the field width – 110 px at 12 px Mulish fits; if it fails, widen the input, do not shorten the text.

- [ ] **Step 6: Run the new probe**

Run: `npm test -- roller-order-list-probe.mjs`
Expected: all PASS.

- [ ] **Step 7: Regression slice**

Run: `npm test -- articulation-value-wording-probe.mjs keyswitch-names-probe.mjs articulation-templates-unified-probe.mjs cc-relative-panel-content-probe.mjs roller-mode-browse-no-dirty-probe.mjs uacc-v2-spec-probe.mjs sonuscore-lux-preset-probe.mjs design-consistency-probe.mjs live-hud-meter-value-gap-probe.mjs mobile-ux-probe.mjs audit/p1-xss-config-import.mjs audit/p1-macro-nav-xss.mjs`
Expected: all PASS. The XSS audits matter here – every name/value goes through `escHtml` or `uaccName` exactly as before; `sequenceRowHtml` must not add a new unescaped sink (the `name` for keyswitches is pre-escaped, `aria` strings reuse the same interpolations as the original code).

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/roller-order-list-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(design/minimal): roller order as a vertical list with live row

One row component for articulations and keyswitches; Move/× revealed on
hover and focus but kept in the tab order, drag uses the vertical midpoint,
and articulations now get the live marker keyswitches already had.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bank and Feel Fader groups, quiet footer (spec §7, criterion 7)

**Files:**
- Modify: `feel-fader.html` – end of `renderPanels()` template (~3329–3348), `reorderBank()` focus lookup (~4346–4351), static Device & Settings + Help markup (~2368–2487), `toggleDeviceSettings()` / `toggleHelp()` (~6032–6053), `updateDeviceInfo()` (~3944), `.advanced-toggle-btn` CSS (~2201), `.center-col>.panel-wide` (~549), `.site-footer` / `.footer-*` (~954–975)
- Create: `scratch/bank-group-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`, `scratch/hide-controller-toggle-probe.mjs` (~149)

**Interfaces:**
- Consumes: `duplicateBank(bi)`, `moveBank(bi, dir, focusAction)`, `removeBank(bi)`, `openCustomPresetDialog()`, `toggleDeviceSettings()`, `toggleHelp()`, `openHelpAt(id)`.
- Produces: `.group-cap`, `.settings-group[data-group="bank"|"feel-fader"]`, `.group-row`, `.group-row[data-bank-action="save-setup"|"duplicate"|"left"|"right"|"delete"]`, `#di-firmware-summary`. `reorderBank()` keeps focusing `[data-bank-action="left"|"right"][data-bank-index]` – the new Earlier/Later buttons carry exactly those attributes.

- [ ] **Step 1: Write the failing probe**

Create `scratch/bank-group-probe.mjs`:

```js
// Regression probe (minimal hybrid, spec 2026-09-26 §7): bank actions live in a
// "Bank" group under the controls; Device & Settings and Help & Guide are rows
// of one "Feel Fader" group and still expand like before.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

const one = await p.evaluate(() => {
  cfg.banks.splice(1); activeBank = 0; render();   // single bank, whatever the default config holds
  const g = document.querySelector('.settings-group[data-group="bank"]');
  const card = document.querySelector('.bank-card');
  return {
    below: !!g && g.getBoundingClientRect().top > card.getBoundingClientRect().bottom,
    rows: [...g.querySelectorAll('.group-row')].map(el => el.dataset.bankAction),
    earlierDisabled: g.querySelector('[data-bank-action="left"]')?.disabled,
    laterDisabled: g.querySelector('[data-bank-action="right"]')?.disabled,
    rowHeight: Math.round(g.querySelector('[data-bank-action="duplicate"]').getBoundingClientRect().height),
  };
});
P('Bank group sits under the controls card', one.below, JSON.stringify(one));
P('single bank: no Delete row, Move disabled at both ends', !one.rows.includes('delete') && one.earlierDisabled && one.laterDisabled, JSON.stringify(one));
P('Bank rows are 50 px', one.rowHeight === 50, String(one.rowHeight));

const dup = await p.evaluate(() => { document.querySelector('[data-bank-action="duplicate"]').click(); return { count: cfg.banks.length, active: activeBank }; });
P('Duplicate bank adds a copy', dup.count === 2, JSON.stringify(dup));

await p.evaluate(() => { activeBank = 1; render(); });
await p.focus('.group-row-inline[data-bank-action="left"]');
await p.keyboard.press('Enter');
await wait(60);
const moved = await p.evaluate(() => ({ active: activeBank, focus: document.activeElement?.dataset?.bankAction, idx: document.activeElement?.dataset?.bankIndex }));
P('Move Earlier moves the bank and keeps focus on a Move button', moved.active === 0 && ['left', 'right'].includes(moved.focus) && moved.idx === '0', JSON.stringify(moved));

const del = await p.evaluate(() => {
  const row = document.querySelector('[data-bank-action="delete"]');
  const probe = document.createElement('span'); probe.style.color = 'var(--danger)'; document.body.appendChild(probe);
  const danger = getComputedStyle(probe).color; probe.remove();
  const color = getComputedStyle(row).color;
  row.click();
  const confirmOpen = !document.getElementById('confirm-overlay').hidden;
  closeConfirm(true);
  return { color, danger, confirmOpen, count: cfg.banks.length };
});
P('Delete bank… is --danger and asks for confirmation', del.color === del.danger && del.confirmOpen && del.count === 1, JSON.stringify(del));

const save = await p.evaluate(() => { document.querySelector('[data-bank-action="save-setup"]').click(); const open = !document.getElementById('custom-preset-overlay').hidden; closeCustomPresetDialog(); return open; });
P('Save as setup… opens the custom setup dialog', save === true);

const ff = await p.evaluate(() => {
  const g = document.querySelector('.settings-group[data-group="feel-fader"]');
  const dev = document.getElementById('device-settings-toggle-btn');
  const help = document.getElementById('help-toggle-btn');
  dev.click();
  const devOpen = document.getElementById('device-settings-body').style.display !== 'none' && dev.getAttribute('aria-expanded') === 'true';
  const chev = getComputedStyle(dev.querySelector('.section-chevron')).transform;
  return {
    bothInGroup: !!g && g.contains(dev) && g.contains(help),
    devOpen, chev, chevText: document.getElementById('device-settings-chevron')?.textContent.trim(),
    fwSummary: document.getElementById('di-firmware-summary')?.textContent.trim(),
  };
});
P('Device & Settings and Help & Guide are rows of one Feel Fader group', ff.bothInGroup, JSON.stringify(ff));
P('Device & Settings still expands, chevron rotates, no ▼/▲ text', ff.devOpen && ff.chev !== 'none' && ff.chevText === '', JSON.stringify(ff));
P('Device row shows the firmware version slot', ff.fwSummary === '–' || /^Firmware /.test(ff.fwSummary || ''), ff.fwSummary);
await p.evaluate(() => openHelpAt('help-roller'));
await wait(400);
P('Help deep link still opens Help & Guide', await p.evaluate(() => document.getElementById('help-body').style.display !== 'none'));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
```

Register `'bank-group-probe.mjs',` in `PROBES` right after `'bank-card-header-probe.mjs',`.

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- bank-group-probe.mjs`
Expected: FAIL (no `.settings-group`).

- [ ] **Step 3: Bank group markup**

In `renderPanels()`, change the template assigned to `document.getElementById('panels-row').innerHTML` so that after the closing `</div>` of `.bank-card` it appends:

```js
    <div class="group-cap">Bank</div>
    <div class="settings-group" data-group="bank">
      <button type="button" class="group-row" data-bank-action="save-setup" data-bank-index="${bi}" onclick="openCustomPresetDialog()">Save as setup…</button>
      <button type="button" class="group-row" data-bank-action="duplicate" data-bank-index="${bi}" onclick="duplicateBank(${bi})" aria-label="Duplicate ${bankLabel}">Duplicate bank</button>
      <div class="group-row group-row-split">
        <span>Move</span>
        <span class="group-row-actions">
          <button type="button" class="group-row-inline" data-bank-action="left" data-bank-index="${bi}" onclick="moveBank(${bi},-1,'left')" aria-label="Move ${bankLabel} earlier" ${bi===0?'disabled':''}>‹ Earlier</button>
          <button type="button" class="group-row-inline" data-bank-action="right" data-bank-index="${bi}" onclick="moveBank(${bi},1,'right')" aria-label="Move ${bankLabel} later" ${bi===cfg.banks.length-1?'disabled':''}>Later ›</button>
        </span>
      </div>
      ${cfg.banks.length > 1 ? `<button type="button" class="group-row group-row-danger" data-bank-action="delete" data-bank-index="${bi}" onclick="removeBank(${bi})" aria-label="Delete ${bankLabel}">Delete bank…</button>` : ''}
    </div>
```
(`bankLabel` was introduced in Task 4.) The `.bank-card.bank-anim` fade stays on the card only.

Note: the Move row is a `<div class="group-row group-row-split">` holding two `.group-row-inline` buttons, so the probe's row list yields `undefined` for it – intended; the probe only checks that `delete` is absent with one bank.

- [ ] **Step 4: Feel Fader group markup**

Replace the two `<div class="panel panel-wide" style="padding:0;overflow:hidden;width:100%">…</div>` wrappers (Device & Settings and Help & Guide, ~2369–2487) with **one** wrapper; keep everything inside the two bodies unchanged:

```html
  <div class="group-cap">Feel Fader</div>
  <div class="settings-group panel-wide" data-group="feel-fader">
    <button class="advanced-toggle-btn group-row" onclick="toggleDeviceSettings()" id="device-settings-toggle-btn" aria-expanded="false" aria-controls="device-settings-body">
      <span class="group-row-label">Device &amp; Settings<span class="fw-update-dot" id="fw-update-dot" hidden title="Firmware update available"></span></span>
      <span class="group-row-value" id="di-firmware-summary">–</span>
      <span id="device-settings-chevron" aria-hidden="true"><svg class="section-chevron" viewBox="0 0 9 14" aria-hidden="true"><path d="M1.5 1.5L7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>
    <div id="device-settings-body" style="display:none;padding:12px 18px 18px">
      <!-- existing Device / Diagnostics / Backup & reset content, unchanged -->
    </div>
    <button class="advanced-toggle-btn group-row" onclick="toggleHelp()" id="help-toggle-btn" aria-expanded="false" aria-controls="help-body">
      <span class="group-row-label">Help &amp; Guide</span>
      <span id="help-chevron" aria-hidden="true"><svg class="section-chevron" viewBox="0 0 9 14" aria-hidden="true"><path d="M1.5 1.5L7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>
    <div id="help-body" style="display:none;padding:12px 18px 18px;font-size:var(--fs-md);line-height:1.6;color:var(--t2)">
      <!-- existing Help content, unchanged -->
    </div>
  </div>
```
Before editing, `grep -n "device-settings-chevron\|help-chevron\|fw-update-dot\|panel-dot" feel-fader.html scratch/*.mjs` and keep every id that code or probes read. `.panel-dot` is `display:none` and has no readers besides CSS – drop it.

- [ ] **Step 5: JS**

In `toggleDeviceSettings()` and `toggleHelp()` delete the `const chevron = …` line and the `chevron.textContent = …` line (rotation now comes from `.is-open`, which both functions already toggle on the button).

In `updateDeviceInfo()` after `setVal('di-firmware', firmware);` add:

```js
  setTxt('di-firmware-summary', firmware ? `Firmware ${firmware}` : '–');
```
(`setTxt` is the existing helper used across the file; confirm with `grep -n "^function setTxt" feel-fader.html`.)

- [ ] **Step 6: CSS**

Replace `.center-col>.panel-wide{flex:0 0 auto;}` with `.center-col>.panel-wide,.center-col>.settings-group{flex:0 0 auto;}`. Replace `.advanced-toggle-btn{…}` (~2201) with:

```css
.advanced-toggle-btn{
  display:flex;align-items:center;gap:var(--space-3);
  width:100%;background:none;border:none;
  cursor:pointer;font-family:'Mulish',sans-serif;
  -webkit-tap-highlight-color:transparent;text-align:left;
}
.advanced-toggle-btn.is-open .section-chevron{transform:rotate(90deg)}
```
Add after it:

```css
/* Settings-style groups under the controls (spec 2026-09-26 §7). */
.group-cap{margin:var(--space-4) 18px calc(-1 * var(--space-2));font-size:var(--fs-base);color:var(--t2)}
.settings-group{background:var(--bg-card);border-radius:var(--r);overflow:hidden;box-shadow:none}
.group-row{position:relative;display:flex;align-items:center;gap:var(--space-3);width:100%;min-height:50px;padding:0 18px;border:0;background:none;color:var(--t1);font:400 var(--fs-xl) 'Mulish',sans-serif;text-align:left;cursor:pointer;box-sizing:border-box}
.group-row+.group-row::before,.group-row+div:not(.group-row)::before,div:not(.group-row)+.group-row::before{content:'';position:absolute;top:0;left:18px;right:0;border-top:1px solid var(--border)}
.group-row:hover{background:color-mix(in srgb,var(--t1) 3%,transparent)}
.group-row:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
.group-row-label{flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-2)}
.group-row-value{font-size:var(--fs-lg);color:var(--t2)}
.group-row-danger{color:var(--danger)}
.group-row-split{cursor:default}
.group-row-split:hover{background:none}
.group-row-split>span:first-child{flex:1}
.group-row-actions{display:flex;gap:var(--space-4)}
.group-row-inline{border:0;background:none;padding:4px 0;color:var(--t2);font:400 var(--fs-lg) 'Mulish',sans-serif;cursor:pointer}
.group-row-inline:hover{color:var(--t1)}
.group-row-inline:disabled{opacity:.35;cursor:default}
```
Note `.group-row` inside `#device-settings-body` does not exist; the `::before` separators use `position:absolute`, so `.settings-group` rows need `position:relative` (set above).

Footer: in `.site-footer{…}` set text colour to `var(--t3)` and add `border-top:1px solid var(--border)`; in `.footer-links a{…}` set `color:var(--t3)`; do not change footer content or its pinned-to-bottom layout (`footer-pinned-to-bottom-probe`). Read the `.site-footer` block first and change only colour/border declarations.

- [ ] **Step 7: Retarget probes**

`scratch/hide-controller-toggle-probe.mjs` ~149: change the selector `'.center-col > .panel.panel-wide'` to `'.center-col > .settings-group'` and the label to "Bank / Feel Fader groups keep their natural height on a tall window (no balloon)"; the Feel Fader group has two 50 px rows, so change `h < 100` to `h < 260` (Bank group: 4 × 50 = 200 plus hairlines). State that change in the commit message.

- [ ] **Step 8: Run**

Run: `npm test -- bank-group-probe.mjs a1-mobile-bank-actions-probe.mjs hide-controller-toggle-probe.mjs help-deep-links-probe.mjs help-trim-probe.mjs fw-update-offer-probe.mjs fw-update-flow-probe.mjs fader-response-menu-hide-probe.mjs footer-pinned-to-bottom-probe.mjs design-consistency-probe.mjs mobile-ux-probe.mjs c11-connect-with-dirty-edits-probe.mjs`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add feel-fader.html scratch/bank-group-probe.mjs scratch/run-all-probes.mjs scratch/hide-controller-toggle-probe.mjs
git commit -m "feat(design/minimal): Bank and Feel Fader groups under the controls, quiet footer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Send note under the button (spec §8)

**Files:**
- Modify: `feel-fader.html` – `.send-anchor` (~416), `.send-change-note{…}` / `.is-visible` / `.is-swapping` (~455–471, ~490–493), `.change-popover` (~494–501), `@media(max-width:420px)` (~508–511), `updateChangeSummary()` (~3074–3080)
- Create: `scratch/send-note-below-probe.mjs`
- Modify: `scratch/run-all-probes.mjs`

**Interfaces:** none new. `#send-change-note`, `toggleChangePopover()`, `.send-anchor.docked` unchanged in contract.

- [ ] **Step 1: Write the failing probe**

Create `scratch/send-note-below-probe.mjs`:

```js
// Regression probe (minimal hybrid, spec 2026-09-26 §8): on desktop the change
// note reads "N changes · Review" on one line under Send; nothing shifts when it
// appears; the change popover opens below the note; docked Send keeps the
// note on its left.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());
const wait = ms => new Promise(r => setTimeout(r, ms));

const before = await p.evaluate(() => document.querySelector('.bank-card').getBoundingClientRect().top);
await p.evaluate(() => { stepCtrl(0, 'fader1', 'cc', 1); });
await wait(600);
const r = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return {
    text: document.getElementById('send-change-note').textContent.trim(),
    below: note.top >= btn.bottom, centered: Math.abs((note.left + note.right) / 2 - (btn.left + btn.right) / 2) < 2,
    oneLine: note.height < 24, cardTop: document.querySelector('.bank-card').getBoundingClientRect().top,
  };
});
P('note reads "1 change · Review"', r.text === '1 change · Review', r.text);
P('note sits centred under Send on one line', r.below && r.centered && r.oneLine, JSON.stringify(r));
P('showing the note does not shift the page', Math.abs(r.cardTop - before) < 1, `${before} → ${r.cardTop}`);
await p.evaluate(() => toggleChangePopover(true));
await wait(300);
const pop = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const popover = document.getElementById('change-popover').getBoundingClientRect();
  return { gap: popover.top - note.bottom };
});
P('change popover opens below the note, not over it', pop.gap >= 4, JSON.stringify(pop));
await p.evaluate(() => toggleChangePopover(false));
await p.evaluate(() => { document.getElementById('controller-toggle-input').click(); });
await wait(1500);
const docked = await p.evaluate(() => {
  const note = document.getElementById('send-change-note').getBoundingClientRect();
  const btn = document.getElementById('send-btn').getBoundingClientRect();
  return { leftOf: note.right <= btn.left + 1, sameRow: Math.abs((note.top + note.bottom) / 2 - (btn.top + btn.bottom) / 2) < 3 };
});
P('docked Send keeps the note on its left', docked.leftOf && docked.sameRow, JSON.stringify(docked));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
```
Register `'send-note-below-probe.mjs',` in `PROBES` right after `'send-dock-gap-symmetry-probe.mjs',`. Before running, confirm `stepCtrl(bi,key,field,delta)` is the stepper handler (`grep -n "^function stepCtrl" feel-fader.html`).

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- send-note-below-probe.mjs`
Expected: FAIL on text, position and popover gap; PASS on docked.

- [ ] **Step 3: Copy**

In `updateChangeSummary()` replace

```js
  if (note && dirty) setSendChangeNoteText(`${items.length} unsaved change${items.length===1?'':'s'}`);
```
with
```js
  if (note && dirty) setSendChangeNoteText(`${items.length} change${items.length===1?'':'s'} · Review`);
```
Also update the static fallback text in the markup `>Unsaved changes</button>` to `>Changes · Review</button>`.

- [ ] **Step 4: CSS**

Keep the existing `.send-change-note` rules (they now serve the docked layout) and add, **after** `.send-change-note.is-visible.is-swapping{…}`:

```css
/* Desktop, controller visible: the note is one quiet line under Send (spec
   2026-09-26 §8). .send-anchor already reserves 68px (38 button + 30 below),
   so the note fits inside the reserved height and nothing moves. The docked
   Send (.send-anchor.docked) keeps the left-of-button placement above. */
@media(min-width:601px){
  .send-anchor:not(.docked) .send-change-note{
    right:auto;left:50%;top:calc(100% + 6px);max-width:240px;
    font-size:var(--fs-md);font-weight:400;color:var(--t2);
    transform:translate(-50%,-4px) scale(.975);transform-origin:center top;
  }
  .send-anchor:not(.docked) .send-change-note.is-visible{transform:translate(-50%,0) scale(1)}
  .send-anchor:not(.docked) .send-change-note.is-visible.is-swapping{transform:translate(-50%,2px) scale(.985)}
  .send-anchor:not(.docked) .change-popover{top:calc(100% + 34px)}
}
```
`.send-callout` is the positioned parent of the note (`position:relative`, width = button), so `top:calc(100% + 6px)` places the note 6 px under the 38 px button – inside `.send-anchor`'s 68 px reserve. If `skip-welcome-send-entry-gap-probe` or `connect-reveal-sync-probe` fail, do **not** raise `.send-anchor` min-height blindly: measure the note bottom vs. the anchor bottom first and report.

- [ ] **Step 5: Run**

Run: `npm test -- send-note-below-probe.mjs send-dock-gap-symmetry-probe.mjs skip-welcome-send-entry-gap-probe.mjs skip-welcome-send-btn-probe.mjs connect-reveal-sync-probe.mjs send-btn-idle-state-probe.mjs i1-change-popover-probe.mjs validation-single-signal-probe.mjs vbar-aria-live-probe.mjs hide-controller-toggle-probe.mjs send-undo-shortcuts-probe.mjs`
Expected: all PASS. (`i1-change-popover-probe` is not in `PROBES`; run it directly with `node scratch/i1-change-popover-probe.mjs` while the `npm test` server is not running – or skip it and note that in the report if it needs a server.)

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/send-note-below-probe.mjs scratch/run-all-probes.mjs
git commit -m "feat(design/minimal): change note as one line under Send

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: WEBAPP.md, full suite, screenshots for Frank (criteria 9–11)

**Files:**
- Modify: `WEBAPP.md` – §0 (Barvy, Sdílené control primitivy, Typografie, Radii note), §3.2 Header, §3.5 Bank Tabs, §3.6 Bank Name Card, §3.7 Fader Sekce, §3.8 Roller sekce, §3.9 Device & Settings
- Create (scratchpad only, not committed): screenshot script + PNGs

- [ ] **Step 1: Token audit**

Run: `grep -n "ambient\|--chrome-float-border\|backdrop-filter" feel-fader.html | cut -c1-140`
Expected: no `ambient`; `backdrop-filter` only on `header`/`.top-sticky` chrome, overlays/modals/dialogs (`.modal`, `.icon-picker-*`, `.change-popover`, `.quick-setup-menu` for RANGE PRESET, toasts, sync banner, welcome/onboarding) and the `@supports` fallback. Any hit on a content card, section, HUD or chip is a bug – fix it in the owning task's style and re-run that task's probes.

Run: `grep -nE "^\.(seq-|group-|bank-eyebrow|library-(browse|popover)|section-mark|bank-tab-device|bank-title-input)[^{]*\{[^}]*(#[0-9a-fA-F]{3,6}\b|rgba?\()" feel-fader.html`
Expected: empty (new rules use tokens only).

- [ ] **Step 2: WEBAPP.md §0**

Update, in place, only what changed:
- Barvy table: `--control-glass-bg / --control-glass-border` row → "Plochá výplň kompaktních controls (od 2026-09-26 = `--bg-input`, bez okraje)"; `--control-glass-shadow*` row → "`none` (plochý styl)". Add rows: `--shadow-hud` ("Jemné zvednutí plovoucího HUD – jediný stín na ploché ploše", light `0 8px 24px rgba(0,0,0,.06)`, dark `… .35`), `--highlight-section-fill` ("Neutrální tónování sekce propojené s ovladačem na fotce – zelená je jen live").
- Sdílené control primitivy: `.ui-glass` is now a flat fill; glass (`backdrop-filter`) exists only in the header and overlays/dialogs. Add one sentence: "Zelená jen pro live signál (glow na fotce, tečka banku na zařízení, live řádek roller order) a success stavy."
- Typografie: add `--fs-display 32` (jen název banky v hlavičce karty); state that the wordmark is normal case Mulish 700 and that 800 is not embedded.
- Add a short "Minimal hybrid (2026-09-26)" paragraph at the end of §0 naming the four structures: bank card header (eyebrow + display name + Library setup · Browse… popover), section header anatomy (mark · title · mono summary · chevron ›), roller order list (`.seq-row`), settings groups (`.group-cap` + `.settings-group` + `.group-row`).

- [ ] **Step 3: WEBAPP.md §3.x**

Read each of §3.2, §3.5–§3.9 and replace sentences that describe removed UI (uppercase side captions, ▼ chevrons, icon actions ‹ › ⧉ × at the card edge, Library setup search field inline, chip grid for roller order, separate Device & Settings / Help panels, status on the left) with the new placement. Keep behaviour descriptions that did not change. Keep Czech, en dash only.

- [ ] **Step 4: Full suite**

Run: `npm test`
Expected: every probe PASS, 0 CRASH. Paste the final summary lines into the task report.

- [ ] **Step 5: Screenshots (scratchpad)**

Create `<scratchpad>/shots.mjs` (not in the repo) that, against the running `npm test`-style server or a manual `npx http-server -p 8100` from the repo root, captures for each theme (`light`, `dark` via `toggleDark()`):
- 1440 × 900 full page with the roller section open (`_openSections.add('roller'); render();`) after `skipWelcome()` and a poked connection (`_midiState='granted'; _ffConnected=true; _serialPort={}; connState(); renderConnState();`);
- 390 × 844 full page, same state.
Save as `<scratchpad>/minimal-{light,dark}-{1440,390}.png`. Compare 1440 light against `.superpowers/brainstorm/hybrid-2026-09-26/hybrid-full.png` by eye and list visible deviations (not pixel diff) in the report; known intentional deviation: subtitle shows "Library setup · Browse…" instead of a library name (spec §4).

- [ ] **Step 6: Commit docs**

```bash
git add WEBAPP.md
git commit -m "docs(design/minimal): WEBAPP.md design contract for the minimal hybrid variant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand over to Frank**

Serve the branch on `http://localhost:8100/feel-fader.html` (the repo's usual static server) and send Frank the four screenshots (`SendUserFile`) with the list of deviations from the mockup. Ask him to check light + dark at `localhost:8100`. **Stop here:** no merge to `main`, no demo deploy (`deploy-ff-demo.ps1`) until Frank explicitly says so (spec §Deploy, criterion 11).
