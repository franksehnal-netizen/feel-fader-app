# Welcome screen blur overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the welcome↔app reparenting mechanism in `feel-fader.html` (device-wrap and Send button physically moved between welcome slots and app slots, propped up by a pixel-continuity system) with a single-mount architecture: both elements mount once, at page load, directly into their final app position; the welcome screen becomes a pure `position:fixed` blur overlay on top of the already-rendered app, with the Send button escaping visually via a `position:fixed` CSS class.

**Architecture:** `#device-wrap` stays in `#device-home` forever. `#send-btn` stays in `.send-callout` forever. `#welcome-screen`'s existing `::before` pseudo-element (already `position:fixed`, already the thing that fades out today) changes from an opaque solid-color fill to a `backdrop-filter:blur()` glass layer, reusing the existing fade timing/keyframe. `#send-btn` gets a `.welcome-floating` class while welcome is up, which uses `position:fixed` + a JS-measured `--welcome-float-top/left` pair (measured against an empty spacer div already in the welcome card) to visually center it on the card. All reparenting functions, the `--stage-entry-offset`/`--send-entry-gap` CSS custom properties, and their JS measurement machinery are deleted.

**Tech Stack:** Vanilla JS/CSS single-file app (`feel-fader.html`), puppeteer-core against local Chrome for headless regression probes, `python -m http.server 8100` as the static test server.

## Global Constraints

- Single target file for all production code changes: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html`.
- No protocol/config-format changes — firmware repo (`feel-fader-firmware`) is untouched, never referenced.
- Probe runtime: `python -m http.server 8100` from `c:\Users\Fanda Borec\Documents\feel-fader-app`, `puppeteer-core` with `executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'`, `headless:true, pipe:true, args:['--no-sandbox']` — copy this launch config verbatim in every new probe (matches every existing probe in `scratch/`).
- Before starting any server: kill whatever holds port 8100 first (`netstat -ano | grep ":8100" | awk '{print $5}' | sort -u | while read pid; do taskkill //F //PID "$pid" 2>/dev/null; done`) — a stray `TIME_WAIT` entry is not a live listener and does not need killing, only an actual `LISTENING` row does.
- Final regression gate: `node scratch/run-all-probes.mjs` must report exactly **254 passed** plus the same pre-existing, unrelated 3 fails / 6 crashes it already reports today (`faders-inert-probe.mjs` crash, `help-trim-probe.mjs` 1 fail, `livecolor-probe.mjs` 2 fail, `onb-probe1.mjs` through `onb-probe5.mjs` crash) — these are long-accepted, unrelated baseline noise, not something this plan fixes or is allowed to change the count of.
- Spec reference for every requirement below: `docs/superpowers/specs/2026-07-21-welcome-blur-overlay-design.md`.

---

### Task 1: Single-mount welcome/app architecture

**Files:**
- Modify: `feel-fader.html` (CSS lines ~207–1122, ~600–605; JS lines ~4841–5111, ~4770, ~5884–5909)
- Create: `scratch/welcome-blur-overlay-probe.mjs`
- Modify: `scratch/run-all-probes.mjs` (register the new probe)

**Interfaces:**
- Produces: `finalizeWelcomeExit()` (new function, replaces `mountControllerInApp()` — called by both `connectTransitionWelcome()` and `skipWelcome()`), `positionWelcomeFloatingButton()` (new function, computes `--welcome-float-top`/`--welcome-float-left` from `#welcome-action-slot`'s live position).
- Removes entirely (must not appear anywhere in the file after this task): `mountControllerInWelcome`, `mountPrimaryActionInWelcome`, `handoffPrimaryActionToApp`, `alignAppControllerToWelcome`, `alignAppControllerToTarget`, `correctMountedControllerToTarget`, `_welcomeControllerTargetTop`, the `--stage-entry-offset` and `--send-entry-gap` CSS custom properties, the `.action-handoff` CSS class and its two rules, `#welcome-controller-slot` (HTML element + all CSS referencing it).
- Consumes (unchanged, do not touch): `sharedController()`, `layoutFaders()`, `positionThumbs()`, `pF()`, `onbAfterWelcome()`, `onbShouldRun()`, `onbStartWelcome()`, `showStartBtn()`, `updateWelcomeSkip()`, `resetAppScrollTop()`, `applyStageCollapse(hidden, animate)`, `applySendAnchorDock(hidden)`, `_controllerHidden`, `_welcomeStartTimer`, `_onbBeatTimer`, `runValidation()`, `markConfigSynced()`, `loadDefaultDemoConfig()`, `_savedCfg`.

- [ ] **Step 1: Write the new probe capturing every new invariant, against the CURRENT (unmodified) code**

Create `scratch/welcome-blur-overlay-probe.mjs`:

```js
// Regression probe: single-mount welcome/app architecture (2026-07-21 redesign,
// see docs/superpowers/specs/2026-07-21-welcome-blur-overlay-design.md).
// #device-wrap and #send-btn now mount ONCE, at page load, directly into their
// final app position (#device-home / .send-callout) and never reparent again.
// The welcome screen is a pure position:fixed blur overlay on top of the
// already-rendered app; #send-btn gets a `.welcome-floating` class (position:
// fixed, computed --welcome-float-top/left) to visually escape onto the
// welcome card while welcome is up. This replaces the old reparenting +
// --stage-entry-offset/--send-entry-gap pixel-continuity system entirely.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const errs=[];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
await p.setViewport({ width: 1280, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));

// 1. Fresh load, still on welcome: elements already live in their final app homes.
const atLoad = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const controller = document.getElementById('device-wrap');
  const before = getComputedStyle(document.getElementById('welcome-screen'), '::before');
  return {
    controllerParentId: controller.parentElement?.id,
    btnParentClass: btn.parentElement?.className,
    btnHasFloating: btn.classList.contains('welcome-floating'),
    btnPosition: getComputedStyle(btn).position,
    overlayBackdrop: before.backdropFilter || before.webkitBackdropFilter,
  };
});
P('#device-wrap already lives in #device-home at page load', atLoad.controllerParentId === 'device-home', JSON.stringify(atLoad));
P('#send-btn already lives in .send-callout at page load', atLoad.btnParentClass === 'send-callout', JSON.stringify(atLoad));
P('#send-btn carries .welcome-floating while welcome is up', atLoad.btnHasFloating, JSON.stringify(atLoad));
P('#send-btn is position:fixed while welcome is up', atLoad.btnPosition === 'fixed', atLoad.btnPosition);
P('welcome overlay uses backdrop-filter blur (not an opaque fill)', /blur/.test(atLoad.overlayBackdrop), atLoad.overlayBackdrop);

// 2. skipWelcome(): nothing reparents, .welcome-floating comes off.
await p.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));
const afterSkip = await p.evaluate(() => {
  const btn = document.getElementById('send-btn');
  const controller = document.getElementById('device-wrap');
  return {
    controllerParentId: controller.parentElement?.id,
    btnParentClass: btn.parentElement?.className,
    btnHasFloating: btn.classList.contains('welcome-floating'),
    btnPosition: getComputedStyle(btn).position,
  };
});
P('#device-wrap never moved after skipWelcome()', afterSkip.controllerParentId === 'device-home', JSON.stringify(afterSkip));
P('#send-btn never moved after skipWelcome()', afterSkip.btnParentClass === 'send-callout', JSON.stringify(afterSkip));
P('#send-btn drops .welcome-floating after skipWelcome()', !afterSkip.btnHasFloating, JSON.stringify(afterSkip));
P('#send-btn returns to normal in-flow position after skipWelcome()', afterSkip.btnPosition !== 'fixed', afterSkip.btnPosition);

// 3. Real connect transition: device image must not move AT ALL (nothing ever
//    left its position, so there is nothing to keep continuous — nil movement
//    is now the correct invariant, not just "no big jump").
const p2 = await b.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.setViewport({ width: 1280, height: 900 });
await p2.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p2.evaluate(() => localStorage.setItem('ff-onboarded', '1'));
await p2.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
async function imgTop() { return p2.evaluate(() => document.getElementById('device-img').getBoundingClientRect().top); }
const before0 = await imgTop();
await p2.evaluate(() => hideWelcome());
const samples = [];
for (const t of [100, 300, 600, 900, 1200, 1500, 2000]) {
  await new Promise(r => setTimeout(r, t === 100 ? 100 : 300));
  samples.push(await imgTop());
}
const maxDrift = Math.max(...samples.map(s => Math.abs(s - before0)));
P('device image never moves during the connect transition (max drift <=0.5px)', maxDrift <= 0.5, `${maxDrift.toFixed(2)}px`);

// 4. Faders are click-through-blocked by the overlay while welcome is up,
//    implicitly (no dedicated inert CSS/JS needed — the overlay just sits on
//    top in z-index and intercepts the hit-test).
const p3 = await b.newPage();
p3.on('pageerror', e => errs.push(String(e)));
await p3.setViewport({ width: 1280, height: 900 });
await p3.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const hitTest = await p3.evaluate(() => {
  const thumb = document.getElementById('thumb-l');
  const r = thumb.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { hitIsThumb: el === thumb, hitInsideWelcome: !!el?.closest('#welcome-screen') };
});
P('clicking where a fader sits hits the welcome overlay, not the fader', !hitTest.hitIsThumb && hitTest.hitInsideWelcome, JSON.stringify(hitTest));

// 5. Interplay with the "hide controller" toggle: a previously-hidden
//    preference must not hijack #send-btn's position:fixed containing block.
//    (.stage gets `transform` from .stage-collapse.is-collapsed>.stage — if
//    that class were applied before welcome closes, #send-btn.welcome-floating
//    would resolve `fixed` against the transformed .stage instead of the
//    viewport. Fix: applyStageCollapse() is deferred until finalizeWelcomeExit().)
const p4 = await b.newPage();
p4.on('pageerror', e => errs.push(String(e)));
await p4.setViewport({ width: 1280, height: 900 });
await p4.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p4.evaluate(() => localStorage.setItem('ff-controller-hidden', '1'));
await p4.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const whileWelcome = await p4.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const stage = document.querySelector('.stage');
  const btn = document.getElementById('send-btn');
  const r = btn.getBoundingClientRect();
  return {
    isCollapsedDeferred: !wrap.classList.contains('is-collapsed'),
    stageHasNoTransform: getComputedStyle(stage).transform === 'none',
    btnCenterX: r.left + r.width / 2,
    viewportCenterX: 1280 / 2,
  };
});
P('stage-collapse is deferred while welcome is still showing', whileWelcome.isCollapsedDeferred, JSON.stringify(whileWelcome));
P('.stage has no active transform while welcome is showing (would hijack position:fixed)', whileWelcome.stageHasNoTransform, JSON.stringify(whileWelcome));
P('#send-btn.welcome-floating is centered on the true viewport, not a transformed ancestor', Math.abs(whileWelcome.btnCenterX - whileWelcome.viewportCenterX) <= 2, JSON.stringify(whileWelcome));
await p4.evaluate(() => skipWelcome());
await new Promise(r => setTimeout(r, 200));
const afterSkipHidden = await p4.evaluate(() => document.getElementById('stage-collapse').classList.contains('is-collapsed'));
P('stage-collapse applies once welcome has actually closed', afterSkipHidden, String(afterSkipHidden));
await p4.evaluate(() => localStorage.removeItem('ff-controller-hidden'));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Run the new probe against the current, unmodified code and confirm it fails**

Run: `node scratch/welcome-blur-overlay-probe.mjs`
Expected: Several FAIL lines — in particular "`#device-wrap already lives in #device-home at page load`" (it's actually in `#welcome-controller-slot` today), "`#send-btn carries .welcome-floating`" (class doesn't exist yet), "`welcome overlay uses backdrop-filter blur`" (today's `::before` is an opaque fill), and the "`stage-collapse is deferred`" checks (today `applyStageCollapse` runs unconditionally at load). This confirms the probe actually exercises the old behavior before any code changes.

- [ ] **Step 3: CSS — turn the welcome overlay into a blur layer, add `.welcome-floating`, remove the continuity variables**

In `feel-fader.html`, replace the `.stage` rule (currently around line 207-221):

```css
.stage{
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:0;
  padding:32px 0 86px;
}
```

Replace the shared sizing rule (currently `.device-home,.welcome-controller-slot{...}` around line 222):

```css
.device-home{position:relative;width:min(65vw,clamp(120px,calc(44.24vh - 126px),220px));aspect-ratio:380/859;flex-shrink:0}
```

Replace the absolute-positioning rule (currently `.device-home > .device-wrap,.welcome-controller-slot > .device-wrap{...}` around line 992):

```css
.device-home > .device-wrap{position:absolute;top:0;left:0;width:100%}
```

Delete the `.welcome-controller-slot{z-index:10}` rule (around line 991) entirely.

In the `@media(max-width:600px)` block around line 603, replace `.device-home,.welcome-controller-slot{width:...}` with:

```css
  .device-home{width:min(55vw,clamp(120px,calc(44.24vh - 126px),196px));}
```

In the `@media(max-width:600px)` block around line 885, replace the mobile `.stage` rule:

```css
  .stage{position:static;top:auto;animation:none;margin-top:0;padding-bottom:96px;}
```

(This drops the mobile-only `transform:translate3d(0,var(--stage-entry-offset,0px),0)` — that transform was always active, even at its 0px default, and would have hijacked any `position:fixed` descendant's containing block regardless of the hide-controller-toggle edge case handled in Step 5.)

Replace the `.device-wrap.welcome-mode` interaction-hiding rule (around line 994) — remove `.send-anchor` from it (a `display:none` ancestor would prevent `#send-btn.welcome-floating`'s `position:fixed` from ever rendering, since `display:none` removes the whole subtree regardless of position):

```css
.device-wrap.welcome-mode .ctrl-zone{display:none}
```

Delete the two now-dead `.action-handoff` rules entirely (around lines 995-997):

```css
.device-wrap.welcome-mode.action-handoff .send-anchor{display:flex}
.device-wrap.welcome-mode.action-handoff .send-change-note,
.device-wrap.welcome-mode.action-handoff .change-popover{display:none}
```

Replace the welcome overlay's background pseudo-element (currently `#welcome-screen::before{...}` around line 1207) with a blur layer, matching the existing `.modal` glass treatment used elsewhere in this file:

```css
#welcome-screen::before{
  content:'';position:absolute;inset:0;z-index:0;
  background:linear-gradient(145deg,var(--glass-dialog),var(--glass-card));
  backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);
  opacity:1;
}
```

Add the floating-button CSS, directly after the `.welcome-flash` rule (around line 1063):

```css
#send-btn.welcome-floating{
  position:fixed;
  top:var(--welcome-float-top,50%);
  left:var(--welcome-float-left,50%);
  transform:translate(-50%,-50%);
  z-index:220;
}
body.welcome-connecting #send-btn.welcome-floating{
  animation:welcome-screen-out .34s ease .72s forwards;
}
@media(prefers-reduced-motion:reduce){
  #welcome-screen.connecting::before,
  body.welcome-connecting #send-btn.welcome-floating{animation:none}
}
```

(The reduced-motion override suppresses the two NEW animations this task adds — the blur fade and the floating-button fade — so they cut instantly at their rule-driven moment instead of easing. It does not rewrite `connectTransitionWelcome()`'s own 1100ms sequential timing, which is pre-existing and out of scope here — the same gap existed before this task, for the same decorative-flourish-only reduced-motion pattern already used elsewhere in this file, e.g. `.device-wrap.connect-success`'s override at line 1109.)

(`z-index:220` clears `#welcome-screen`'s own `z-index:200` so the button renders on top of the blur. The `body.welcome-connecting` hook reuses the exact existing `welcome-screen-out` keyframe/timing that already fades `#welcome-screen::before` out — `#send-btn` isn't a DOM descendant of `#welcome-screen`, so it needs its own class-driven hook rather than a `#welcome-screen.connecting` descendant selector, which would never match it.)

- [ ] **Step 4: JS — remove reparenting, add the new mount-once + floating-button logic**

Delete these four functions entirely: `mountControllerInWelcome()` (~4874-4887), `mountPrimaryActionInWelcome()` (~4842-4857), `handoffPrimaryActionToApp()` (~4858-4873), `alignAppControllerToWelcome()`/`alignAppControllerToTarget()`/`correctMountedControllerToTarget()` (~4941-4964) and the `let _welcomeControllerTargetTop = null;` line above them.

Replace `mountControllerInApp()` (~4888-4900) with:

```js
function finalizeWelcomeExit() {
  const controller = sharedController();
  if (controller) {
    controller.classList.remove('welcome-mode','connect-success');
    controller.querySelectorAll('.fader-thumb').forEach(thumb => {
      thumb.style.removeProperty('animation');
      thumb.style.removeProperty('transition');
    });
  }
  document.getElementById('send-btn')?.classList.remove('welcome-floating');
  document.body.classList.remove('welcome-connecting');
  applyStageCollapse(_controllerHidden, false);
  applySendAnchorDock(_controllerHidden);
  layoutFaders();
  positionThumbs();
}
function positionWelcomeFloatingButton() {
  const btn = document.getElementById('send-btn');
  const slot = document.getElementById('welcome-action-slot');
  if (!btn || !slot || !btn.classList.contains('welcome-floating')) return;
  const r = slot.getBoundingClientRect();
  btn.style.setProperty('--welcome-float-top', (r.top + r.height / 2) + 'px');
  btn.style.setProperty('--welcome-float-left', (r.left + r.width / 2) + 'px');
}
```

Replace `showWelcome()` (~4901-4929) with:

```js
function showWelcome() {
  resetAppScrollTop();
  const ws = document.getElementById('welcome-screen');
  if (ws) ws.classList.remove('hidden','connecting');
  document.body.classList.remove('welcome-connecting');
  const controller = sharedController();
  controller?.classList.remove('connect-success');
  controller?.classList.add('welcome-mode');
  const textBlock = document.getElementById('welcome-text-block');
  if (textBlock) {
    textBlock.style.removeProperty('animation');
    textBlock.classList.remove('welcome-onboarding','welcome-wordmark-beat');
  }
  const btn = document.getElementById('send-btn');
  btn?.classList.remove('sent','review');
  btn?.classList.add('welcome-floating');
  // Reset to the normal welcome state first — beats may have hidden these in an
  // earlier first-run this session, and a later reconnect must show normal copy.
  const beats = document.getElementById('onb-beats');
  updateWelcomeSkip();   // hide "Continue without device" if a device is already present
  if (beats) beats.style.display = 'none';
  clearTimeout(_onbBeatTimer);
  if (onbShouldRun() && beats) {
    onbStartWelcome();   // onboarding owns CTA timing — do NOT arm the fallback here
  } else {
    // Keep the primary action available immediately; returning users with a granted
    // serial port still auto-load without needing to click it.
    clearTimeout(_welcomeStartTimer);
    showStartBtn();
  }
  requestAnimationFrame(positionWelcomeFloatingButton);
}
```

Replace `connectTransitionWelcome()` (~4965-5040) with:

```js
function connectTransitionWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (!ws || ws.classList.contains('hidden') || ws.classList.contains('connecting')) return;

  // The fixed welcome overlay can hide an arbitrarily scrolled app underneath it.
  // Always reveal a deterministic top-of-app state.
  resetAppScrollTop();

  // 1. Freeze fader animations at their current rendered positions. Keep using
  //    transform so the frozen frame and the following move share one compositor path.
  const thumbL = document.getElementById('thumb-l');
  const thumbR = document.getElementById('thumb-r');
  const railL  = document.getElementById('track-l');
  const railR  = document.getElementById('track-r');
  if (thumbL && railL) {
    const curL = thumbL.getBoundingClientRect().top - railL.getBoundingClientRect().top;
    thumbL.style.animation = 'none';
    thumbL.style.transform = `translate3d(-50%,${curL}px,0)`;
  }
  if (thumbR && railR) {
    const curR = thumbR.getBoundingClientRect().top - railR.getBoundingClientRect().top;
    thumbR.style.animation = 'none';
    thumbR.style.transform = `translate3d(-50%,${curR}px,0)`;
  }

  // 2. Settle to the device snapshot already applied by serialReadInfo(). This uses
  //    the same 0–127 -> travel mapping as pF(), including the real rendered thumb height.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (thumbL && railL) {
      thumbL.style.transition = 'transform .72s cubic-bezier(.22,.8,.2,1)';
      pF('track-l','thumb-l',liveValues.f1);
    }
    if (thumbR && railR) {
      thumbR.style.transition = 'transform .72s cubic-bezier(.22,.8,.2,1)';
      pF('track-r','thumb-r',liveValues.f2);
    }
  }));

  // 3. Restrained success treatment: soft halo, hairline outline and one glass shimmer.
  const devWrap = sharedController();
  if (devWrap) {
    devWrap.classList.remove('connect-success');
    void devWrap.offsetWidth;
    devWrap.classList.add('connect-success');
  }

  // 4. Fade out welcome text
  setTimeout(() => {
    const tb = document.getElementById('welcome-text-block');
    if (tb) tb.style.animation = 'welcome-text-out 0.55s ease-in forwards';
  }, 100);
  setTimeout(() => runValidation(), 650);

  // 5. Fade the blur overlay (and the floating Send button, via the
  //    body.welcome-connecting CSS hook) after the shared faders reach the
  //    hardware snapshot.
  ws.classList.add('connecting');
  document.body.classList.add('welcome-connecting');
  setTimeout(() => {
    resetAppScrollTop();
    finalizeWelcomeExit();
    onbAfterWelcome();
    ws.classList.add('hidden');
  }, 1100);
}

function hideWelcome() {
  connectTransitionWelcome();
}
```

Replace `skipWelcome()` (~5061-5111) — keep the config-loading and demo-badge comments unchanged, remove the reparenting/gap-reset lines:

```js
function skipWelcome() {
  // Reset to predictable demo defaults only on a genuinely fresh browser
  // (no saved config yet, _savedCfg null). A returning user's saved config
  // must never be silently replaced just because no hardware happens to be
  // plugged in right now — confirmed as a real, irreversible data-loss bug
  // 2026-07-20 (S10): clicking "Continue without device" wiped a saved
  // bank name from both memory and the localStorage backup within ~700ms,
  // no undo, no warning. `cfg` is already the correct value here (set from
  // _savedCfg at module load) — just establish the synced baseline against it.
  if (_savedCfg) { markConfigSynced(); render(); } else { loadDefaultDemoConfig(); }
  // Bypass animation — instant hide
  const ws = document.getElementById('welcome-screen');
  resetAppScrollTop();
  finalizeWelcomeExit();
  if (ws) ws.classList.add('hidden');
  onbAfterWelcome();
  requestAnimationFrame(() => {
    resetAppScrollTop();
    positionThumbs();
  });
}
```

In `initControllerVisibility()` (around line 4769), remove the now-unsafe eager collapse call — the comment explains why:

```js
function initControllerVisibility() {
  _controllerHidden = localStorage.getItem('ff-controller-hidden') === '1';
  // Applying applyStageCollapse() here would put a `transform` on .stage
  // (via .stage-collapse.is-collapsed>.stage) while the page is still on the
  // welcome screen — and any transformed ancestor becomes the containing
  // block for position:fixed descendants, hijacking #send-btn.welcome-
  // floating's positioning. Deferred to finalizeWelcomeExit(), which runs
  // once welcome has actually closed (skipWelcome() or the real-connect path).
}
```

In `window.addEventListener('load', ...)` (~5884-5909), no change needed — it already calls `initControllerVisibility()` then `showWelcome()` in that order, which is correct.

Delete `#welcome-controller-slot` from the HTML entirely (the single line `<div class="welcome-controller-slot" id="welcome-controller-slot"></div>`, currently ~line 1804).

- [ ] **Step 5: Run the new probe and confirm it passes**

Kill anything on port 8100, start `python -m http.server 8100` from `feel-fader-app`, then:

Run: `node scratch/welcome-blur-overlay-probe.mjs`
Expected: All lines `PASS`, `no page errors` PASS.

- [ ] **Step 6: Commit**

```bash
git add feel-fader.html scratch/welcome-blur-overlay-probe.mjs
git commit -m "$(cat <<'EOF'
refactor: single-mount welcome/app architecture, replace reparenting with blur overlay

device-wrap and Send button now mount once at page load directly into their
final app position. Welcome becomes a position:fixed blur overlay on top of
the already-rendered app instead of a competing container that holds and
reparents these elements. Removes --stage-entry-offset/--send-entry-gap and
all associated pixel-continuity measurement code.
EOF
)"
```

---

### Task 2: Rewrite existing probes for the new behavior

**Files:**
- Modify: `scratch/skip-welcome-send-entry-gap-probe.mjs`
- Modify: `scratch/skip-welcome-demo-badge-probe.mjs`
- Modify: `scratch/mobile-ux-probe.mjs`
- Modify: `scratch/hide-controller-toggle-probe.mjs`
- Verify only (no functional change expected): `scratch/skip-welcome-send-btn-probe.mjs`

**Interfaces:**
- Consumes: `finalizeWelcomeExit()`, `positionWelcomeFloatingButton()`, `.welcome-floating` class, `--welcome-float-top`/`--welcome-float-left` (all from Task 1).

- [ ] **Step 1: Rewrite `skip-welcome-send-entry-gap-probe.mjs`'s stale-variable checks**

The `--send-entry-gap` custom property no longer exists anywhere in the file — checking `getPropertyValue('--send-entry-gap')` would trivially return `''` and prove nothing. Replace the whole file's header comment and state-check block:

```js
// Regression probe: after "Continue without device" (skipWelcome()), .stage's
// padding stays at its static CSS default. Historically this drifted because
// handoffPrimaryActionToApp() measured a stale --send-entry-gap value at a bad
// moment in the skip path (Frank screenshot 2026-07-20, "je tu strašně moc
// místa"). The single-mount welcome/app redesign (2026-07-21, see
// docs/superpowers/specs/2026-07-21-welcome-blur-overlay-design.md) removed
// --send-entry-gap and --stage-entry-offset entirely — .stage's padding is a
// fixed value now, so this probe checks the fixed value directly instead of
// checking that a since-deleted CSS variable got reset.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); skipWelcome(); });
await new Promise(r => setTimeout(r, 400));

const state = await p.evaluate(() => {
  const stage = document.querySelector('.stage');
  const image = document.getElementById('device-img');
  const btn = document.getElementById('send-btn');
  return {
    stagePaddingBottom: stage ? parseFloat(getComputedStyle(stage).paddingBottom) : null,
    stageMarginTop: stage ? parseFloat(getComputedStyle(stage).marginTop) : null,
    imageToButtonGap: btn && image ? btn.getBoundingClientRect().top - image.getBoundingClientRect().bottom : null,
  };
});
P('.stage bottom padding stays at the fixed CSS default (<=150px)', state.stagePaddingBottom <= 150, `${state.stagePaddingBottom}px`);
P('.stage has no leftover top margin', state.stageMarginTop === 0, `${state.stageMarginTop}px`);
P('device image and Send button stay visually close (<=100px gap)', state.imageToButtonGap <= 100, `${state.imageToButtonGap?.toFixed(1)}px`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Rewrite `skip-welcome-demo-badge-probe.mjs`'s `--stage-entry-offset` check**

Same reasoning — `--stage-entry-offset` is deleted. Replace the header comment and the `state`/assertion block:

```js
// Regression probe: "Demo — no device" badge must sit with a real gap below
// the sticky header after "Continue without device", not cramped against it
// (Frank screenshot 2026-07-20, "moc nalepené nahoře"). Root cause was
// skipWelcome() leaving a stale --stage-entry-offset applied to .stage, which
// #onb-demo-badge (a direct .stage child) inherited. The single-mount
// welcome/app redesign (2026-07-21) removed --stage-entry-offset entirely —
// .stage's margin-top is a static 0 now, so this probe checks that directly.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 390, height: 700 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { localStorage.removeItem('ff-onboarded'); });
await p.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));
await p.click('.welcome-skip');
await new Promise(r => setTimeout(r, 800));

const state = await p.evaluate(() => {
  const stage = document.querySelector('.stage');
  const badge = document.getElementById('onb-demo-badge').getBoundingClientRect();
  const header = document.querySelector('header').getBoundingClientRect();
  return {
    stageMarginTop: parseFloat(getComputedStyle(stage).marginTop),
    gapFromHeader: badge.top - header.bottom,
    badgeVisible: getComputedStyle(document.getElementById('onb-demo-badge')).display === 'block',
  };
});
P('.stage has no top-margin offset (static CSS default, nothing to reset)', state.stageMarginTop === 0, `${state.stageMarginTop}px`);
P('demo badge shown', state.badgeVisible, state.badgeVisible);
P('demo badge sits with a real gap below the header (>=20px, <150px)', state.gapFromHeader >= 20 && state.gapFromHeader < 150, `${state.gapFromHeader.toFixed(1)}px`);

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 3: Fix `mobile-ux-probe.mjs`'s manual welcome-skip shortcut (lines ~100-104)**

Find:

```js
  await page.evaluate(() => {
    loadDefaultDemoConfig();
    handoffPrimaryActionToApp();
    mountControllerInApp();
    document.getElementById('welcome-screen').classList.add('hidden');
    render();
    window.scrollTo(0, 0);
  });
```

Replace with:

```js
  await page.evaluate(() => {
    loadDefaultDemoConfig();
    finalizeWelcomeExit();
    document.getElementById('welcome-screen').classList.add('hidden');
    render();
    window.scrollTo(0, 0);
  });
```

- [ ] **Step 4: Rewrite `mobile-ux-probe.mjs`'s pixel-continuity transition checks (~lines 654-728)**

This block asserted the OLD "handed off without moving much" continuity model. In the new architecture, the controller never moves at all (stronger guarantee), and the button's welcome-time position is *intentionally* different from its docked app position (floating/centered vs. in-flow) — the old "Send replaces Connect & load on the same pixels" check is now testing something that's true by old design and false by new design, not a regression. Replace the whole block from `const transitionStart = await page.evaluate(() => {` through the `addCheck(checks, 'Shared action handoff adds no second onboarding card', ...)` line (~654-728) with:

```js
  const transitionStart = await page.evaluate(() => {
    liveValues = { f1:23, f2:108 };
    liveSeen = { f1:true, f2:true };
    positionThumbs();
    showWelcome();
    const controller = document.getElementById('device-wrap');
    const rect = document.getElementById('device-img').getBoundingClientRect();
    const primaryAction = document.getElementById('send-btn');
    window.__sharedControllerRef = controller;
    window.__sharedActionRef = primaryAction;
    connectTransitionWelcome();
    return {
      controllerCount: document.querySelectorAll('#device-wrap').length,
      imageCount: document.querySelectorAll('#device-img').length,
      faderCount: document.querySelectorAll('#thumb-l,#thumb-r').length,
      actionCount: document.querySelectorAll('#send-btn').length,
      parentId: controller.parentElement?.id || '',
      top: rect.top,
      width: rect.width,
    };
  });
  await settle(page, 800);
  const transitionSettled = await page.evaluate(() => {
    const trackL = document.getElementById('track-l').getBoundingClientRect();
    const trackR = document.getElementById('track-r').getBoundingClientRect();
    const thumbL = document.getElementById('thumb-l').getBoundingClientRect();
    const thumbR = document.getElementById('thumb-r').getBoundingClientRect();
    const expected = (track,thumb,value) => track.top + Math.round((1-value/127)*(track.height-thumb.height));
    return {
      leftGap: Math.abs(thumbL.top - expected(trackL,thumbL,23)),
      rightGap: Math.abs(thumbR.top - expected(trackR,thumbR,108)),
    };
  });
  await page.screenshot({ path: path.join(outputDir, `${profile.name}-transition.png`) });
  await settle(page, 350);
  const transitionEnd = await page.evaluate(() => {
    const rect = document.getElementById('device-img').getBoundingClientRect();
    const btn = document.getElementById('send-btn');
    return {
      sameNode: window.__sharedControllerRef === document.getElementById('device-wrap'),
      sameActionNode: window.__sharedActionRef === btn,
      parentId: document.getElementById('device-wrap').parentElement?.id || '',
      welcomeHidden: document.getElementById('welcome-screen').classList.contains('hidden'),
      top: rect.top,
      width: rect.width,
      btnHasFloating: btn.classList.contains('welcome-floating'),
      btnPosition: getComputedStyle(btn).position,
      introCardAbsent: !document.getElementById('onb-intro-card'),
    };
  });
  transitionEnd.topGap = Math.abs(transitionEnd.top - transitionStart.top);
  const transitionWidthGap = Math.abs(transitionEnd.width - transitionStart.width);
  addCheck(checks, 'Welcome uses one shared controller and fader pair, already mounted in the app',
    transitionStart.controllerCount === 1 && transitionStart.imageCount === 1 && transitionStart.faderCount === 2
      && transitionStart.parentId === 'device-home',
    `${transitionStart.controllerCount} controller / ${transitionStart.imageCount} image / ${transitionStart.faderCount} faders / parent ${transitionStart.parentId}`);
  addCheck(checks, 'Welcome faders settle onto the hardware snapshot before dissolve',
    transitionSettled.leftGap <= 1.5 && transitionSettled.rightGap <= 1.5,
    `left ${transitionSettled.leftGap.toFixed(2)} px / right ${transitionSettled.rightGap.toFixed(2)} px`);
  addCheck(checks, 'Welcome and app use one shared primary action',
    transitionStart.actionCount === 1 && transitionEnd.sameActionNode,
    `${transitionStart.actionCount} button / same ${transitionEnd.sameActionNode}`);
  addCheck(checks, 'The device image never moves — it was never reparented in the first place',
    transitionEnd.sameNode && transitionEnd.parentId === 'device-home' && transitionEnd.welcomeHidden
      && transitionEnd.topGap <= 0.5 && transitionWidthGap <= 0.5,
    `same ${transitionEnd.sameNode} / top ${transitionEnd.topGap.toFixed(2)} px / width ${transitionWidthGap.toFixed(2)} px`);
  addCheck(checks, 'Send button sheds its welcome-floating escape once the app is revealed',
    !transitionEnd.btnHasFloating && transitionEnd.btnPosition !== 'fixed',
    `floating ${transitionEnd.btnHasFloating} / position ${transitionEnd.btnPosition}`);
  addCheck(checks, 'Shared action handoff adds no second onboarding card',
    transitionEnd.introCardAbsent,
    String(transitionEnd.introCardAbsent));
```

- [ ] **Step 5: Add a new check block to `hide-controller-toggle-probe.mjs` covering the deferred stage-collapse fix**

Insert the following block right before the final `P('bug repro: Send survives a fresh load with a previously-saved hidden preference', ...)` line's cleanup (`await p3.evaluate(() => localStorage.removeItem('ff-controller-hidden'));`), reusing the same `p3` page (already at a fresh load with `ff-controller-hidden` set, before `skipWelcome()` was called at that point in the file):

```js
// New with the 2026-07-21 blur-overlay redesign: a previously-hidden
// preference must not hijack #send-btn.welcome-floating's position:fixed
// containing block. .stage-collapse.is-collapsed>.stage gets a `transform`,
// and any transformed ancestor becomes the containing block for `fixed`
// descendants — so this state must stay deferred until welcome actually closes.
const p5 = await b.newPage();
p5.on('pageerror', e => errs.push(String(e)));
await p5.setViewport({ width: 1280, height: 900 });
await p5.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
await p5.evaluate(() => localStorage.setItem('ff-controller-hidden', '1'));
await p5.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const whileWelcome = await p5.evaluate(() => {
  const wrap = document.getElementById('stage-collapse');
  const stage = document.querySelector('.stage');
  const btn = document.getElementById('send-btn');
  const r = btn.getBoundingClientRect();
  return {
    isCollapsedDeferred: !wrap.classList.contains('is-collapsed'),
    stageHasNoTransform: getComputedStyle(stage).transform === 'none',
    btnCenterX: r.left + r.width / 2,
    viewportCenterX: 640,
  };
});
P('stage-collapse stays deferred while welcome is still showing', whileWelcome.isCollapsedDeferred, JSON.stringify(whileWelcome));
P('#send-btn.welcome-floating centers on the true viewport, not a transformed ancestor', Math.abs(whileWelcome.btnCenterX - whileWelcome.viewportCenterX) <= 2, JSON.stringify(whileWelcome));
await p5.evaluate(() => localStorage.removeItem('ff-controller-hidden'));
await p5.close();
```

- [ ] **Step 6: Verify `skip-welcome-send-btn-probe.mjs` still passes unchanged**

Run: `node scratch/skip-welcome-send-btn-probe.mjs`
Expected: all 4 `PASS` lines, `no page errors` PASS — no code change needed in this file (its `inSendCallout`/`!inWelcomeScreen`/`welcome-start`/`show` assertions hold in both the old and new architecture, since `#send-btn` was always inside `.send-callout` immediately after `skipWelcome()` either way). Optionally update its header comment's mention of `handoffPrimaryActionToApp()` (deleted in Task 1) to reference `finalizeWelcomeExit()` instead, for accuracy — not required for the probe to pass.

- [ ] **Step 7: Run each rewritten probe individually and confirm PASS**

Run each of:
```bash
node scratch/skip-welcome-send-entry-gap-probe.mjs
node scratch/skip-welcome-demo-badge-probe.mjs
node scratch/mobile-ux-probe.mjs
node scratch/hide-controller-toggle-probe.mjs
```
Expected: all PASS, no page errors, for each.

- [ ] **Step 8: Commit**

```bash
git add scratch/skip-welcome-send-entry-gap-probe.mjs scratch/skip-welcome-demo-badge-probe.mjs scratch/mobile-ux-probe.mjs scratch/hide-controller-toggle-probe.mjs
git commit -m "$(cat <<'EOF'
test: update probes for the single-mount welcome/app architecture

Replaces assertions on the deleted --send-entry-gap/--stage-entry-offset
variables and the old reparenting continuity model with checks matching
the new blur-overlay design: nothing ever reparents, and .welcome-floating
must resolve position:fixed against the true viewport even when the
hide-controller toggle's saved state would otherwise transform .stage.
EOF
)"
```

---

### Task 3: Full regression run, visual verification, cleanup

**Files:**
- Modify: `scratch/run-all-probes.mjs` (register `welcome-blur-overlay-probe.mjs`)
- No other file changes expected — this task is verification only.

**Interfaces:**
- Consumes: everything from Task 1 and Task 2.

- [ ] **Step 1: Register the new probe in the master list**

In `scratch/run-all-probes.mjs`, add `'welcome-blur-overlay-probe.mjs'` to the probe list array, in the same style as the other entries added this session (`live-hud-meter-value-gap-probe.mjs`, `footer-pinned-to-bottom-probe.mjs`, `hide-controller-toggle-probe.mjs`, `status-pill-polish-probe.mjs`).

- [ ] **Step 2: Run the full regression suite**

Kill anything on port 8100 first, then:

Run: `node scratch/run-all-probes.mjs`
Expected: `2XX passed, 3 failed, 6 crashed (34 probes)` — the pass count will be a few higher than the previous 254 baseline (new assertions added in Tasks 1-2), the fail/crash breakdown must be EXACTLY the pre-existing baseline (`faders-inert-probe.mjs` crash, `help-trim-probe.mjs` 1 fail, `livecolor-probe.mjs` 2 fail, `onb-probe1.mjs` through `onb-probe5.mjs` crash) — any NEW fail or crash outside that list means something in Task 1 or 2 broke a previously-passing behavior and must be fixed before proceeding.

- [ ] **Step 3: Visual check — welcome screen composition**

Using a throwaway script (not committed — same pattern as this session's earlier `_shot_welcome.mjs` ad-hoc checks), screenshot the welcome screen at 1280×900 with `localStorage.setItem('ff-onboarded','1')` set (returning-user, no onboarding beats) and confirm visually: the blur is visible, the app (header, faintly-blurred controller) is visible through it, the floating card (wordmark, Connect & load button, Continue without device) reads as one cohesive centered block. Repeat at a 390×844 mobile viewport.

- [ ] **Step 4: Visual check — connect transition has no jump**

Using a throwaway script, call `hideWelcome()` on a returning-user session and sample `#device-img`'s `getBoundingClientRect()` every ~300ms from t=0 to t=2000ms (same methodology as this session's `_measure_connect_symmetry.mjs`). Confirm the position is bit-for-bit identical at every sample (already covered by the automated probe's `maxDrift <= 0.5px` check in Task 1 — this step is a human-visible confirmation of the same fact via screenshots taken at t=0, 700, 1100, 1600ms).

- [ ] **Step 5: Delete any leftover throwaway scripts from Steps 3-4**

These are one-off verification aids, not permanent probes — remove them from `scratch/` once the visual check is done, same discipline as this session's earlier `_measure_*.mjs`/`_shot_*.mjs` cleanups.

- [ ] **Step 6: Commit**

```bash
git add scratch/run-all-probes.mjs
git commit -m "$(cat <<'EOF'
test: register welcome-blur-overlay-probe.mjs in the full regression suite
EOF
)"
```

- [ ] **Step 7: Report to Frank and await the push/redeploy go-ahead**

Per this project's established workflow, do not push or redeploy the public demo until Frank explicitly confirms (typically "ano") — summarize what shipped, show the visual check screenshots, and only then copy `feel-fader.html` → `feel-fader-demo/index.html`, commit both repos, push, and poll `gh api .../pages/builds/latest` for `"status":"built"`.
