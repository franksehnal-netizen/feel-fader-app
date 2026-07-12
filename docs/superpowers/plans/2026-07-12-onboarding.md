# Onboarding (guided first-run) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run guided onboarding to the Feel Fader web app — orientation on the welcome screen, then a light contextual layer guiding configuration — branching on whether hardware is connected.

**Architecture:** All changes live in the single file `feel-fader.html`. Two sequenced phases reuse existing machinery (welcome fader animation, Help panel, `openHelpAt`, `pF`, `connState`/`liveAllowed`). A single `ff-onboarded` localStorage key gates first-run. Tests are standalone headless puppeteer probes in `scratch/` (the repo's established pattern), each printing PASS/FAIL with an exit code.

**Tech Stack:** Vanilla JS + CSS in one HTML file, no build step. `puppeteer-core` against local Chrome for probes.

## Global Constraints

- App-only: every change is in `feel-fader.html`. No protocol/firmware change.
- Branch: `onboarding` (already created from `main`). One commit per task.
- Copy is English only, wired via `data-i18n` keys under namespace `onb.*` added to `TRANSLATIONS.en` (ends at the closing `}` currently on line 3066), read through `t(key)`, applied by `applyLang()`.
- All colors/radii via tokens (`var(--…)`). Pulse/glow color = `--red` or `--green`. Must work in light and dark (dark overrides live near line 1063).
- Motion: `ease` only, durations ≤ .45s. Move elements with `transform`, never `top`/`left` (iOS ghost lesson). Wrap all decorative motion in `@media (prefers-reduced-motion: reduce)` off-switches.
- Single localStorage key: `ff-onboarded` = `"1"` once completed/skipped (convention matches `ff-dark`, `ff-cfg`, `ff-serial-pid`).
- **Invariant:** onboarding never sends MIDI and never fakes live data in the HW path. The decorative demo runs only in the no-HW branch and carries a visible "Demo" badge. Faders stay display-only (no drag added).
- New JS functions use the `onbXxx` naming style. Existing anchors: `liveAllowed()` (line 2969), `showWelcome()` (3133), `skipWelcome()` (3211), `connectTransitionWelcome()` (3154), `doStart()` (2808), `pF(tid,thid,v)` (2424), `openHelpAt(id)` (2954).
- Probe harness (copy from `scratch/help-probe.mjs`): `puppeteer-core`, `headless:'new'`, `pipe:true`, `executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'`, `file://` URL, collect `pageerror`/`console.error`, read DOM via `page.evaluate` (never screenshots), print `PASS`/`FAIL` per check + `ALL PASS`/`SOME FAILED`, `process.exit(allPass?0:1)`.

---

### Task 1: Foundation — first-run state, i18n keys, finish

**Files:**
- Modify: `feel-fader.html` (TRANSLATIONS.en before line 3066; new JS near the welcome functions ~3216)
- Test: `scratch/onb-probe1.mjs`

**Interfaces:**
- Produces:
  - `onbShouldRun() → boolean` — `true` when `localStorage['ff-onboarded']` is absent.
  - `onbFinish() → void` — sets `localStorage['ff-onboarded']='1'`, sets module guard `_onbDone=true`, removes any `.onb-pulse` classes, calls `onbDemoStop()` if defined, hides `#onb-intro-card` if present.
  - Module vars: `let _onbConfigStarted=false; let _onbDone=false;`
  - i18n keys `onb.*` in `TRANSLATIONS.en`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-probe1.mjs` (harness copied from `scratch/help-probe.mjs`; only the checks differ):

```js
// onb-probe1: foundation — onbShouldRun/onbFinish + ff-onboarded gate + i18n keys.
// Run: node scratch/onb-probe1.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'feel-fader.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

(async () => {
  let browser; const pageErrors = [];
  try {
    browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', pipe: true });
    const page = await browser.newPage();
    page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console.error: ' + m.text()); });
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    const r = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      const before = onbShouldRun();
      onbFinish();
      const after = onbShouldRun();
      return { before, after, flag: localStorage.getItem('ff-onboarded'),
               hasKey: typeof t === 'function' && t('onb.beat1.title') !== 'onb.beat1.title' };
    });

    const checks = [
      ['onbShouldRun() true when flag absent', r.before === true],
      ['onbFinish() sets ff-onboarded="1"', r.flag === '1'],
      ['onbShouldRun() false after finish', r.after === false],
      ['i18n key onb.beat1.title resolves', r.hasKey === true],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
    let ok = true; console.log('\nChecks:');
    for (const [n, p] of checks) { console.log(' ', p ? 'PASS' : 'FAIL', '-', n); if (!p) ok = false; }
    pageErrors.forEach(e => console.log('  ' + e));
    console.log('\n' + (ok ? 'ALL PASS' : 'SOME FAILED'));
    process.exit(ok ? 0 : 1);
  } catch (e) { console.log('ERROR:', e.message, e.stack); process.exit(1); }
  finally { if (browser) await browser.close(); }
})();
```

- [ ] **Step 2: Run the probe, verify it fails**

Run: `node scratch/onb-probe1.mjs`
Expected: FAIL — `onbShouldRun is not defined` (pageerror) and i18n check fails.

- [ ] **Step 3: Add the i18n keys**

In `TRANSLATIONS.en`, immediately before the closing `  }` of the `en` object (currently line 3066, after `'validate.cc_conflict': …,`), add:

```js
    // Onboarding
    'onb.beat1.title': 'Meet Feel Fader',
    'onb.beat1.sub': 'Two motorless faders and a roller for articulations — built for orchestral MIDI.',
    'onb.beat2.title': 'Configure & mirror',
    'onb.beat2.sub': 'This app sets up your device and mirrors it live. It is a configurator and display — not a controller.',
    'onb.beat3.title': 'Connect or explore',
    'onb.beat3.sub': 'Connect your Feel Fader to set it up — or explore the demo without one.',
    'onb.skip_intro': 'Skip intro',
    'onb.intro.hw': 'You are connected. Tap the pulsing points to learn each control, or move a hardware fader to see it mirror here.',
    'onb.intro.nohw': 'No device connected — this is a live demo. Tap the pulsing points to explore, then connect a Feel Fader to configure it.',
    'onb.intro.dismiss': 'Got it',
    'onb.demo_badge': 'Demo — no device',
    'onb.replay': '▶ Show intro again',
    'onb.hint.bank': 'Banks are presets — each has its own fader and roller mapping.',
    'onb.hint.fader': 'Assign a MIDI CC and channel. The on-screen fader mirrors the hardware (display only).',
    'onb.hint.roller': 'The roller has three modes: articulation, keyswitch, and navigation.',
```

- [ ] **Step 4: Add foundation JS**

Immediately after `skipWelcome()` (ends line 3215), add:

```js
// ── Onboarding (guided first-run) ──────────────────────────────
let _onbConfigStarted = false;
let _onbDone = false;
function onbShouldRun() { return !localStorage.getItem('ff-onboarded'); }
function onbFinish() {
  try { localStorage.setItem('ff-onboarded', '1'); } catch (_) {}
  _onbDone = true;
  document.querySelectorAll('.onb-pulse').forEach(el => el.classList.remove('onb-pulse'));
  if (typeof onbDemoStop === 'function') onbDemoStop();
  const card = document.getElementById('onb-intro-card');
  if (card) card.style.display = 'none';
}
```

- [ ] **Step 5: Run the probe, verify it passes**

Run: `node scratch/onb-probe1.mjs`
Expected: `ALL PASS`.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/onb-probe1.mjs
git commit -m "feat(onboarding): foundation — first-run state, i18n, onbFinish"
```

---

### Task 2: Phase 1 — orientation beats on the welcome screen

**Files:**
- Modify: `feel-fader.html` — welcome HTML (`#welcome-text-block`, opens line 1296); welcome CSS (near line 722); welcome show hook (`showWelcome`, line 3133); new JS after Task 1's block.
- Test: `scratch/onb-probe2.mjs`

**Interfaces:**
- Consumes: `onbShouldRun` (Task 1), `showStartBtn()` (2799).
- Produces:
  - `onbStartWelcome() → void` — first-run only: hides `#welcome-status-row` + title/sub, shows `#onb-beats`, starts at beat 0.
  - `onbBeatGo(i) → void` — shows beat `i` (0..2), updates dots; at beat 2 calls `onbBeatShowCTA()`.
  - `onbBeatNext() → void` — advance by one (clamped); used by click and auto-timer.
  - `onbSkipIntro() → void` — jump to beat 2 (reveals CTA); does NOT set the flag.
  - `onbBeatShowCTA() → void` — restores normal Start/skip affordance (calls `showStartBtn()` if a device is present, otherwise just reveals skip).

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-probe2.mjs` (same harness). Body:

```js
    await page.evaluate(() => { localStorage.removeItem('ff-onboarded'); showWelcome(); onbStartWelcome(); });
    await new Promise(r => setTimeout(r, 50));
    const beat0 = await page.evaluate(() => {
      const beats = document.getElementById('onb-beats');
      return { beatsVisible: beats && getComputedStyle(beats).display !== 'none',
               dots: document.querySelectorAll('#onb-beats .onb-dots span').length,
               ctaHidden: !document.getElementById('welcome-start').classList.contains('show') };
    });
    // advance to CTA
    const beat2 = await page.evaluate(() => { onbSkipIntro(); return {
      title: document.querySelector('#onb-beats .onb-beat-title')?.textContent || '',
      skipInIntro: !!document.querySelector('#onb-beats')
    }; });
    // no-HW: skip reveals "Explore the demo" path; Start not forced
    const checks = [
      ['#onb-beats visible on first-run welcome', beat0.beatsVisible === true],
      ['3 step dots rendered', beat0.dots === 3],
      ['CTA (Start) hidden during beats', beat0.ctaHidden === true],
      ['onbSkipIntro jumps to final beat (title = Connect or explore)', beat2.title.includes('Connect')],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
```

(Wrap with the same launch/report/exit scaffold as `onb-probe1.mjs`.)

- [ ] **Step 2: Run the probe, verify it fails**

Run: `node scratch/onb-probe2.mjs`
Expected: FAIL — `onbStartWelcome is not defined`, `#onb-beats` missing.

- [ ] **Step 3: Add the beats HTML**

In `#welcome-text-block` (line 1296), wrap the existing status row in an id and add the beats block. Replace lines 1297–1300 (the `.welcome-status` div) with:

```html
      <div class="welcome-status" id="welcome-status-row">
        <div class="welcome-status-dot"></div>
        <span style="font-size:11px;color:var(--t2);letter-spacing:.04em;text-transform:uppercase" data-i18n="welcome.waiting">Waiting for device</span>
      </div>
      <div id="onb-beats" style="display:none">
        <div class="onb-beat-title" data-i18n="onb.beat1.title">Meet Feel Fader</div>
        <div class="onb-beat-sub" data-i18n="onb.beat1.sub"></div>
        <div class="onb-dots"><span class="on"></span><span></span><span></span></div>
        <button class="onb-skip" onclick="onbSkipIntro()" data-i18n="onb.skip_intro">Skip intro</button>
      </div>
```

- [ ] **Step 4: Add the beats CSS**

After `.welcome-skip{…}` (near line 722), add:

```css
.onb-beat-title{font-size:22px;font-weight:700;color:var(--t1);letter-spacing:-.02em;line-height:1.2;transition:opacity .3s ease;}
.onb-beat-sub{font-size:13px;color:var(--t2);line-height:1.5;margin-top:6px;min-height:38px;transition:opacity .3s ease;}
.onb-dots{display:flex;gap:6px;justify-content:center;margin:14px 0 10px;cursor:pointer;}
.onb-dots span{width:6px;height:6px;border-radius:var(--r-pill);background:var(--border-s);transition:background .2s ease;}
.onb-dots span.on{background:var(--red);}
.onb-skip{background:none;border:none;color:var(--t3);font-size:11px;cursor:pointer;font-family:'Mulish',sans-serif;padding:4px;}
.onb-skip:hover{color:var(--t2);}
.onb-beats-fade{opacity:0;}
```

- [ ] **Step 5: Add the beats JS**

After Task 1's `onbFinish`, add:

```js
let _onbBeat = 0, _onbBeatTimer = null;
const _ONB_BEATS = [
  { t: 'onb.beat1.title', s: 'onb.beat1.sub' },
  { t: 'onb.beat2.title', s: 'onb.beat2.sub' },
  { t: 'onb.beat3.title', s: 'onb.beat3.sub' },
];
function onbStartWelcome() {
  const beats = document.getElementById('onb-beats');
  const statusRow = document.getElementById('welcome-status-row');
  const title = document.querySelector('#welcome-text-block .welcome-title');
  const sub = document.querySelector('#welcome-text-block .welcome-sub');
  if (!beats) return;
  if (statusRow) statusRow.style.display = 'none';
  if (title) title.style.display = 'none';
  if (sub) sub.style.display = 'none';
  beats.style.display = 'block';
  const dots = beats.querySelector('.onb-dots');
  if (dots) dots.onclick = onbBeatNext;
  onbBeatGo(0);
}
function onbBeatGo(i) {
  _onbBeat = Math.max(0, Math.min(2, i));
  const beats = document.getElementById('onb-beats');
  const tEl = beats.querySelector('.onb-beat-title');
  const sEl = beats.querySelector('.onb-beat-sub');
  const dots = beats.querySelectorAll('.onb-dots span');
  tEl.classList.add('onb-beats-fade'); sEl.classList.add('onb-beats-fade');
  setTimeout(() => {
    tEl.textContent = t(_ONB_BEATS[_onbBeat].t);
    sEl.textContent = t(_ONB_BEATS[_onbBeat].s);
    tEl.classList.remove('onb-beats-fade'); sEl.classList.remove('onb-beats-fade');
  }, 180);
  dots.forEach((d, k) => d.classList.toggle('on', k === _onbBeat));
  clearTimeout(_onbBeatTimer);
  if (_onbBeat < 2) _onbBeatTimer = setTimeout(onbBeatNext, 4000);
  else onbBeatShowCTA();
}
function onbBeatNext() { onbBeatGo(_onbBeat + 1); }
function onbSkipIntro() { clearTimeout(_onbBeatTimer); onbBeatGo(2); }
function onbBeatShowCTA() {
  // Reveal the normal connect affordance; Start appears if a device is present (showStartBtn),
  // the skip link is always available regardless.
  if (_ffConnected || _serialPort) showStartBtn();
}
```

- [ ] **Step 6: Hook first-run into `showWelcome`**

In `showWelcome()` (line 3133), after `if (ws) ws.classList.remove('hidden');`, add:

```js
  if (onbShouldRun() && document.getElementById('onb-beats')) onbStartWelcome();
```

- [ ] **Step 7: Run the probe, verify it passes**

Run: `node scratch/onb-probe2.mjs`
Expected: `ALL PASS`.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/onb-probe2.mjs
git commit -m "feat(onboarding): phase 1 orientation beats on welcome"
```

---

### Task 3: Phase 2 — intro card, help anchors, pulses, branching

**Files:**
- Modify: `feel-fader.html` — intro card HTML (after `<div class="center-col">`, line 1099); help-hint in `faderSectionContent` (line 1613); reuse roller hint (line 1832); add `help-banks`/`help-faders` help sections (help-body, ~1213); a bank help-hint (bank name card render); CSS (`.onb-pulse`, `#onb-intro-card`); JS `onbStartConfig`; dismissal hooks in `skipWelcome` (3211), `connectTransitionWelcome` (3204), `doStart` (2817).
- Test: `scratch/onb-probe3.mjs`

**Interfaces:**
- Consumes: `onbShouldRun`, `onbFinish`, `_onbConfigStarted`, `_onbDone` (Task 1); `liveAllowed()` (2969); `openHelpAt` (2954).
- Produces:
  - `onbMaybeStartConfig() → void` — guarded entry: runs `onbStartConfig()` once per session, only if `onbShouldRun()` and not `_onbConfigStarted`.
  - `onbStartConfig() → void` — renders `#onb-intro-card` (copy per `liveAllowed()`), adds `.onb-pulse` to `[data-onb]` help-hints, and (no-HW only) calls `onbDemoStart()` (defined in Task 4; guard with `typeof`).
  - `#onb-intro-card` element; `.onb-pulse` class; `[data-onb="bank|fader|roller"]` anchors; help sections `#help-banks`, `#help-faders`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-probe3.mjs`. Two scenarios via internal-state poke:

```js
    // --- no-HW branch ---
    const nohw = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      _onbConfigStarted = false; _onbDone = false;
      skipWelcome(); render(); onbMaybeStartConfig();
      const card = document.getElementById('onb-intro-card');
      return {
        cardShown: !!card && getComputedStyle(card).display !== 'none',
        copy: card ? card.textContent : '',
        pulses: document.querySelectorAll('.onb-pulse').length,
        anchors: ['bank','fader','roller'].map(k => !!document.querySelector(`[data-onb="${k}"]`)),
        helpBanks: !!document.getElementById('help-banks'),
        helpFaders: !!document.getElementById('help-faders'),
      };
    });
    // clicking a pulse expands help + clears that pulse
    const afterClick = await page.evaluate(() => {
      const a = document.querySelector('[data-onb="roller"]'); a && a.click();
      return { helpOpen: document.getElementById('help-body').style.display !== 'none',
               pulseCleared: !a.classList.contains('onb-pulse') };
    });
    // --- HW branch: no demo, HW copy ---
    const hw = await page.evaluate(() => {
      onbFinish(); localStorage.removeItem('ff-onboarded');
      _ffConnected = true; _serialPort = {}; _midiState = 'granted';
      _onbConfigStarted = false; _onbDone = false;
      document.getElementById('onb-intro-card')?.remove();
      onbMaybeStartConfig();
      const card = document.getElementById('onb-intro-card');
      return { hwCopy: card ? card.textContent.includes('connected') : false,
               demoBadge: !!document.getElementById('onb-demo-badge') };
    });
    const checks = [
      ['no-HW: intro card shown', nohw.cardShown === true],
      ['no-HW: card uses no-device copy', nohw.copy.includes('live demo')],
      ['3 pulse anchors present', nohw.anchors.every(Boolean)],
      ['pulses applied (3)', nohw.pulses === 3],
      ['help sections help-banks + help-faders exist', nohw.helpBanks && nohw.helpFaders],
      ['click pulse opens help', afterClick.helpOpen === true],
      ['click pulse clears its pulse', afterClick.pulseCleared === true],
      ['HW: card uses connected copy', hw.hwCopy === true],
      ['HW: no demo badge', hw.demoBadge === false],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
```

- [ ] **Step 2: Run the probe, verify it fails**

Run: `node scratch/onb-probe3.mjs`
Expected: FAIL — `onbMaybeStartConfig is not defined`, no card/anchors.

- [ ] **Step 3: Add the intro card HTML**

Immediately after `<div class="center-col">` (line 1099), insert:

```html
  <div id="onb-intro-card" style="display:none">
    <span id="onb-intro-text"></span>
    <button class="onb-intro-x" onclick="onbFinish()" data-i18n="onb.intro.dismiss">Got it</button>
  </div>
```

- [ ] **Step 4: Add the fader + banks help anchors and help sections**

(a) In `faderSectionContent` (line 1616), replace the `section-live-val` span line with a version that appends a help-hint on `fader1` only:

```js
      <span class="section-live-val${liveAllowed() ? '' : ' live-placeholder'}" id="${valId}-val">${lv}</span>
      ${key==='fader1' ? `<button class="help-hint" data-onb="fader" title="Faders — help" onclick="openHelpAt('help-faders')">?</button>` : ''}
```

(b) On the existing roller hint (line 1832) add the `data-onb` marker:

```html
      <button class="help-hint" data-onb="roller" title="Roller modes — help" onclick="openHelpAt('help-roller')">?</button>
```

(c) In the Help panel body (line 1213, the `Banks & tags` subhead) add an id and a new Faders section. Replace the `Banks & tags` subhead line with:

```html
      <div class="settings-subhead" id="help-banks">Banks &amp; tags</div>
```

and immediately after the `Getting started` paragraph (line 1212) add:

```html
      <div class="settings-subhead" id="help-faders">Faders</div>
      <p style="margin:0 0 12px">Each fader sends a MIDI <b>CC</b> on a <b>channel</b> you choose (Expression / Dynamics by default). The on-screen faders <b>mirror the hardware</b> — they are display only and cannot be dragged.</p>
```

(d) Add the bank help-hint to the bank name card. In the bank name card render (the sticky bank name/tags row produced around `renderBankTabs`/bank-name), add next to the bank name, following the existing `.help-hint` pattern:

```html
<button class="help-hint" data-onb="bank" title="Banks — help" onclick="openHelpAt('help-banks')">?</button>
```

Place it inside the bank name card header row so it sits beside the editable name. The probe only asserts `[data-onb="bank"]` exists and pulses — exact placement is cosmetic.

- [ ] **Step 5: Add CSS (intro card + pulse)**

After the `.help-hint` rules (line 1045), add:

```css
#onb-intro-card{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--green-bg);border:1px solid var(--green-border);color:var(--t1);border-radius:var(--r);padding:10px 14px;margin:0 0 12px;font-size:12px;line-height:1.5;}
#onb-intro-text{flex:1;}
.onb-intro-x{background:none;border:1px solid var(--border-s);color:var(--t2);border-radius:var(--r-sm);padding:4px 10px;font-size:11px;cursor:pointer;font-family:'Mulish',sans-serif;flex-shrink:0;}
.onb-intro-x:hover{color:var(--t1);border-color:var(--t2);}
.onb-pulse{position:relative;color:var(--t1);border-color:var(--red);}
.onb-pulse::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:1.5px solid var(--red);animation:onb-pulse-ring 1.6s ease-out infinite;pointer-events:none;}
@keyframes onb-pulse-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}
@media (prefers-reduced-motion: reduce){.onb-pulse::after{animation:none;opacity:.5;transform:scale(1.3);}}
```

- [ ] **Step 6: Add `onbStartConfig` + guarded entry**

After the beats JS (Task 2), add:

```js
function onbMaybeStartConfig() {
  if (_onbConfigStarted || _onbDone || !onbShouldRun()) return;
  _onbConfigStarted = true;
  onbStartConfig();
}
function onbStartConfig() {
  const card = document.getElementById('onb-intro-card');
  const txt = document.getElementById('onb-intro-text');
  const live = liveAllowed();
  if (txt) txt.textContent = t(live ? 'onb.intro.hw' : 'onb.intro.nohw');
  if (card) card.style.display = 'flex';
  document.querySelectorAll('[data-onb]').forEach(el => {
    el.classList.add('onb-pulse');
    el.addEventListener('click', () => {
      el.classList.remove('onb-pulse');
      if (!document.querySelector('.onb-pulse') && document.getElementById('onb-intro-card')?.style.display === 'none') onbFinish();
    }, { once: true });
  });
  if (!live && typeof onbDemoStart === 'function') onbDemoStart();
}
```

- [ ] **Step 7: Hook Phase 2 after welcome dismissal**

Three dismissal paths, each guarded by `onbMaybeStartConfig()`:

In `skipWelcome()` (3211), after `if (ws) ws.classList.add('hidden');` add:
```js
  onbMaybeStartConfig();
```
In `connectTransitionWelcome()` (3204), change `setTimeout(() => ws.classList.add('hidden'), 1350);` to:
```js
  setTimeout(() => { ws.classList.add('hidden'); onbMaybeStartConfig(); }, 1350);
```
In `doStart()` (line 2817, after `hideWelcome();`) — no change needed; `hideWelcome` → `connectTransitionWelcome` already carries the hook.

- [ ] **Step 8: Run the probe, verify it passes**

Run: `node scratch/onb-probe3.mjs`
Expected: `ALL PASS`.

- [ ] **Step 9: Commit**

```bash
git add feel-fader.html scratch/onb-probe3.mjs
git commit -m "feat(onboarding): phase 2 intro card, help anchors, pulses, branching"
```

---

### Task 4: Phase 2 — no-HW decorative demo + display-only invariant

**Files:**
- Modify: `feel-fader.html` — demo badge HTML (in `.stage`, near line 1106); CSS; JS `onbDemoStart`/`onbDemoStop`/`onbDemoTick`; stop-on-connect hook in `connectInputs` (line 2491, the `if (!_ffConnected)` block).
- Test: `scratch/onb-probe4.mjs`

**Interfaces:**
- Consumes: `pF(tid,thid,v)` (2424), `uaccName(v)` (1361), `liveAllowed()`.
- Produces:
  - `onbDemoStart() → void` — no-HW only; shows `#onb-demo-badge`, starts an interval animating `#thumb-l`/`#thumb-r` via `pF` and cycling the roller label; respects `prefers-reduced-motion` (badge only, no motion).
  - `onbDemoStop() → void` — clears interval, hides badge, resets thumbs to v=64 via `pF`.
  - `_onbDemoTimer`, `#onb-demo-badge`.

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-probe4.mjs`:

```js
    const run = await page.evaluate(async () => {
      localStorage.removeItem('ff-onboarded');
      _ffConnected = false; _serialPort = null; _midiState = 'pending';
      _onbConfigStarted = false; _onbDone = false;
      const badge0 = !!document.getElementById('onb-demo-badge');
      skipWelcome(); render(); onbMaybeStartConfig();
      const badgeShown = () => { const b = document.getElementById('onb-demo-badge'); return b && getComputedStyle(b).display !== 'none'; };
      const before = document.getElementById('thumb-l')?.style.top;
      await new Promise(r => setTimeout(r, 900));
      const after = document.getElementById('thumb-l')?.style.top;
      // INVARIANT: the demo tick must never reach a MIDI output — assert its source
      // contains no send() call (display-only). This inspects the real function body,
      // so it fails loudly if a future edit wires MIDI into the decorative animation.
      const noSend = !/\bsend\s*\(/.test(onbDemoTick.toString());
      onbDemoStop();
      const badgeAfterStop = badgeShown();
      return { badge0, moved: before !== after, badgeAfterStop, noSend };
    });
    const checks = [
      ['no demo badge before start', run.badge0 === false],
      ['no-HW demo moves a fader thumb', run.moved === true],
      ['onbDemoStop hides badge', run.badgeAfterStop === false],
      ['INVARIANT: onbDemoTick source contains no send() call', run.noSend === true],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
```

- [ ] **Step 2: Run the probe, verify it fails**

Run: `node scratch/onb-probe4.mjs`
Expected: FAIL — `onbDemoStart is not defined`, thumb does not move.

- [ ] **Step 3: Add the demo badge HTML**

In `.stage` (after line 1106, the `#live-note` div), add:

```html
    <div id="onb-demo-badge" style="display:none" data-i18n="onb.demo_badge">Demo — no device</div>
```

- [ ] **Step 4: Add the demo badge CSS**

After the intro-card CSS (Task 3), add:

```css
#onb-demo-badge{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:6;background:var(--bg-card);border:1px solid var(--border-s);color:var(--t2);border-radius:var(--r-pill);padding:3px 10px;font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;}
```

- [ ] **Step 5: Add the demo JS**

After `onbStartConfig` (Task 3), add:

```js
let _onbDemoTimer = null, _onbDemoPhase = 0;
function onbDemoStart() {
  const badge = document.getElementById('onb-demo-badge');
  if (badge) badge.style.display = 'block';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                 // badge only, no motion
  _onbDemoPhase = 0;
  clearInterval(_onbDemoTimer);
  _onbDemoTimer = setInterval(onbDemoTick, 700);
  onbDemoTick();
}
function onbDemoTick() {
  _onbDemoPhase++;
  // gentle, opposing sweeps — decorative only, never touches config or MIDI
  const l = 64 + Math.round(38 * Math.sin(_onbDemoPhase * 0.6));
  const r = 64 + Math.round(22 * Math.sin(_onbDemoPhase * 0.6 + 1.1));
  pF('track-l', 'thumb-l', l);
  pF('track-r', 'thumb-r', r);
  const bank = cfg.banks[activeBank];
  const list = (bank && bank.uacc_values) || [];
  if (list.length) {
    const v = list[_onbDemoPhase % list.length];
    setTxt('enc-artic-badge', uaccName(v)); liveOn('enc-artic-badge');
  }
}
function onbDemoStop() {
  clearInterval(_onbDemoTimer); _onbDemoTimer = null;
  const badge = document.getElementById('onb-demo-badge');
  if (badge) badge.style.display = 'none';
  pF('track-l', 'thumb-l', 64);
  pF('track-r', 'thumb-r', 64);
}
```

- [ ] **Step 6: Stop demo when hardware connects**

In `connectInputs()` inside `if (!_ffConnected) { … }` (line 2491), as the first line of that block, add:

```js
      if (_onbDemoTimer) onbDemoStop();
```

- [ ] **Step 7: Run the probe, verify it passes**

Run: `node scratch/onb-probe4.mjs`
Expected: `ALL PASS`.

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/onb-probe4.mjs
git commit -m "feat(onboarding): no-HW decorative demo + display-only invariant"
```

---

### Task 5: Replay entry + completion persistence + final light/dark/reduced-motion check

**Files:**
- Modify: `feel-fader.html` — replay link at top of `#help-body` (line 1210); `onbReplay` JS.
- Test: `scratch/onb-probe5.mjs`

**Interfaces:**
- Consumes: `onbStartConfig`, `onbFinish`, `onbShouldRun`.
- Produces: `onbReplay() → void` — resets session guards and re-runs `onbStartConfig()` regardless of the stored flag.

- [ ] **Step 1: Write the failing probe**

Create `scratch/onb-probe5.mjs`:

```js
    // completion persists across reload
    const persist = await page.evaluate(() => {
      localStorage.removeItem('ff-onboarded');
      _onbConfigStarted = false; _onbDone = false;
      skipWelcome(); render(); onbMaybeStartConfig();
      onbFinish();
      // simulate "reload": onbShouldRun should now be false and a re-entry must not re-show
      _onbConfigStarted = false;
      onbMaybeStartConfig();
      return { flag: localStorage.getItem('ff-onboarded'),
               cardHidden: document.getElementById('onb-intro-card').style.display === 'none' };
    });
    const replay = await page.evaluate(() => {
      onbReplay();
      return { cardShown: getComputedStyle(document.getElementById('onb-intro-card')).display !== 'none' };
    });
    const checks = [
      ['completion sets ff-onboarded', persist.flag === '1'],
      ['after completion, re-entry does not re-show', persist.cardHidden === true],
      ['onbReplay re-shows intro card', replay.cardShown === true],
      ['no pageerror / console.error', pageErrors.length === 0],
    ];
```

- [ ] **Step 2: Run the probe, verify it fails**

Run: `node scratch/onb-probe5.mjs`
Expected: FAIL — `onbReplay is not defined`.

- [ ] **Step 3: Add the replay link HTML**

As the first child of `#help-body` (line 1210, before the `Getting started` subhead), add:

```html
      <button class="onb-replay-btn" onclick="onbReplay()" data-i18n="onb.replay">▶ Show intro again</button>
```

- [ ] **Step 4: Add replay CSS**

After the demo badge CSS (Task 4), add:

```css
.onb-replay-btn{background:none;border:1px solid var(--border-s);color:var(--t2);border-radius:var(--r-sm);padding:4px 10px;font-size:11px;cursor:pointer;font-family:'Mulish',sans-serif;margin:0 0 12px;}
.onb-replay-btn:hover{color:var(--t1);border-color:var(--t2);}
```

- [ ] **Step 5: Add `onbReplay` JS**

After `onbDemoStop` (Task 4), add:

```js
function onbReplay() {
  _onbDone = false; _onbConfigStarted = true;   // bypass the once-per-session/flag guards
  onbStartConfig();
}
```

- [ ] **Step 6: Run the probe, verify it passes**

Run: `node scratch/onb-probe5.mjs`
Expected: `ALL PASS`.

- [ ] **Step 7: Full-suite + light/dark screenshot sanity**

Run all probes and capture one light + one dark screenshot of the no-HW first-run for visual sanity (matches repo habit of committing evidence PNGs):

```bash
node scratch/onb-probe1.mjs && node scratch/onb-probe2.mjs && node scratch/onb-probe3.mjs && node scratch/onb-probe4.mjs && node scratch/onb-probe5.mjs
```
Expected: all `ALL PASS`. (Screenshots are optional evidence; if captured, save to `scratch/onb-*.png`.)

- [ ] **Step 8: Commit**

```bash
git add feel-fader.html scratch/onb-probe5.mjs
git commit -m "feat(onboarding): replay entry + completion persistence"
```

---

## Self-Review

**Spec coverage:**
- §A state model / first-run gate → Task 1 (`onbShouldRun`, `ff-onboarded`, `onbFinish`) + guards in Task 3 (`onbMaybeStartConfig` once-per-session).
- §B Phase 1 beats → Task 2 (all three beats, dots, skip, auto-timer+click, welcome hook).
- §C1 intro card + branching → Task 3 (`onbStartConfig` via `liveAllowed`).
- §C2 pulses + help anchors (bank/fader/roller) + missing help sections → Task 3.
- §C3 no-HW decorative demo + badge → Task 4; stop-on-connect → Task 4 Step 6.
- §D data/i18n/replay → Task 1 (key) + Task 5 (`onbReplay`).
- §E edge cases: connect-during-beats (Task 2 `onbBeatShowCTA` reveals Start on `_ffConnected`); skip→connect stop demo (Task 4 Step 6); reduced-motion (Task 3 pulse CSS + Task 4 `onbDemoStart` guard); dark mode (tokens throughout); fallback timer unchanged (no edit to `_welcomeStartTimer`).
- §F probes A–D + invariant → probes 1–5 collectively (A=probe2, B=probe3 no-HW, C=probe3 HW, D=probe5, invariant=probe4).

**Placeholder scan:** No TBD/TODO. The only prose-not-code instruction is Task 3 Step 4(d) bank hint placement — intentionally cosmetic; exact code snippet is provided, only the host row is left to the implementer because the bank name card is a runtime template and the probe asserts the outcome (`[data-onb="bank"]` present + pulses).

**Type consistency:** `onbStartConfig`, `onbMaybeStartConfig`, `onbFinish`, `onbDemoStart/Stop/Tick`, `onbStartWelcome`, `onbBeatGo/Next`, `onbSkipIntro`, `onbBeatShowCTA`, `onbReplay` — names identical across definitions and call sites. Guards `_onbConfigStarted`/`_onbDone`/`_onbDemoTimer`/`_onbBeat`/`_onbBeatTimer` consistent. `data-onb` values `bank|fader|roller` consistent between HTML anchors and `onbStartConfig` selector. Help ids `help-banks`/`help-faders`/`help-roller` consistent between anchors' `openHelpAt` calls and the added sections.
