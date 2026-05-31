# Welcome Screen Visual Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add animated fader overlay to welcome screen, resize device image, and add a green-flash + fade connect transition.

**Architecture:** All changes are in the single file `feel-fader.html`. CSS changes add new keyframes and overlay classes. HTML restructures the welcome screen to add a flash div, fader overlay tracks, and a text wrapper. JS adds `initWelcomeFaderOverlay()` and `connectTransitionWelcome()`, and updates the existing `hideWelcome()` / `skipWelcome()`.

**Tech Stack:** Vanilla JS, CSS animations, single-file HTML app. No build step — edit and reload in browser.

---

## File Map

| File | Changes |
|---|---|
| `feel-fader.html` (CSS ~line 598) | `#welcome-device-img` width 120→220px, move float to wrapper |
| `feel-fader.html` (CSS ~line 620) | Add keyframes + new overlay/transition classes |
| `feel-fader.html` (HTML ~line 1137) | Restructure welcome screen inner HTML |
| `feel-fader.html` (JS ~line 2568) | Replace `hideWelcome`, update `skipWelcome` |
| `feel-fader.html` (JS ~line 2852) | Add `initWelcomeFaderOverlay()` + call site |

---

## Task 1: CSS — Resize device image, move float to wrapper

**File:** `feel-fader.html` CSS block `#welcome-device-img` (~line 598)

**Context:** Float animation currently lives on the `<img>` tag. We move it to the `.welcome-device` wrapper so that the fader overlay floats with the device image as one unit. Stopping the float in JS then targets the wrapper, not the img.

- [ ] **Step 1: Edit `#welcome-device-img` block**

Find this exact block (~line 598):
```css
#welcome-device-img{
  display:block;
  width:120px;
  height:auto;
  border-radius:18px;
  box-shadow:0 16px 48px rgba(0,0,0,.2),0 4px 16px rgba(0,0,0,.1);
  animation:float 3s ease-in-out infinite;
}
```

Replace with:
```css
#welcome-device-img{
  display:block;
  width:220px;
  height:auto;
  border-radius:18px;
  box-shadow:0 16px 48px rgba(0,0,0,.2),0 4px 16px rgba(0,0,0,.1);
}
```

(Float animation removed from img — will be on wrapper instead.)

- [ ] **Step 2: Add float to `.welcome-device` wrapper**

Find this block right above `#welcome-device-img` (~line 587):
```css
.welcome-inner{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:16px;
  text-align:center;
  width:260px;
  padding:0;
  margin:0 auto;
}
```

Add a new rule immediately after it:
```css
.welcome-device{
  position:relative;
  z-index:10;
  animation:float 3s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify in browser**

Open `feel-fader.html` in browser. Welcome screen should show device image at ~220px with float animation. No visual regression on main app.

---

## Task 2: CSS — Fader overlay + transition keyframes and classes

**File:** `feel-fader.html` — add after `html.dark #welcome-device-img` block (~line 620), before `/* ── LIVE FADER VISUAL ── */`

- [ ] **Step 1: Add all new CSS**

Find this comment (~line 624):
```css
/* ── LIVE FADER VISUAL ── */
```

Insert the following block immediately before it:

```css
/* ── WELCOME FADER OVERLAY ── */
.welcome-flash{
  position:absolute;inset:0;z-index:5;
  border-radius:18px;
  background:radial-gradient(ellipse 90% 70% at 50% 45%,
    rgba(52,199,89,.85) 0%,rgba(52,199,89,.2) 50%,transparent 100%);
  opacity:0;pointer-events:none;
}
.welcome-fader-tracks{
  position:absolute;top:0;left:0;right:0;bottom:0;
  pointer-events:none;
}
.welcome-fader-track{
  position:absolute;
  width:22%;
}
#welcome-track-l{left:11.89%;top:11.64%;height:68.10%;}
#welcome-track-r{left:65.84%;top:11.64%;height:68.10%;}
.welcome-fader-thumb{
  position:absolute;left:50%;transform:translateX(-50%);
}
.welcome-fader-thumb img{
  display:block;width:100%;
  filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));
}
#welcome-thumb-l{animation:welcome-fader-master 5.5s ease-in-out infinite;}
#welcome-thumb-r{animation:welcome-fader-slave  5.5s ease-in-out .5s infinite;}

@keyframes welcome-fader-master{
  0%  {top:32%}
  38% {top:58%}
  70% {top:28%}
  100%{top:32%}
}
@keyframes welcome-fader-slave{
  0%  {top:44%}
  38% {top:56%}
  70% {top:42%}
  100%{top:44%}
}

/* connect transition */
@keyframes welcome-flash-in{
  0%  {opacity:0}
  12% {opacity:1}
  55% {opacity:.6}
  100%{opacity:0}
}
@keyframes welcome-text-out{
  from{opacity:1;transform:translateY(0)}
  to  {opacity:0;transform:translateY(-8px)}
}
@keyframes welcome-screen-out{
  from{opacity:1}
  to  {opacity:0}
}
#welcome-screen.connecting{
  animation:welcome-screen-out .5s ease .3s forwards;
  pointer-events:none;
}
```

- [ ] **Step 2: Verify in browser**

Reload. Fader thumbs won't be visible yet (no HTML or JS wiring), but no CSS errors in DevTools console.

---

## Task 3: HTML — Restructure welcome screen

**File:** `feel-fader.html` HTML block `#welcome-screen` (~line 1137)

- [ ] **Step 1: Replace welcome screen HTML**

Find this exact block (~line 1137):
```html
<div id="welcome-screen">
  <div class="welcome-inner">

    <!-- Controller photo with float animation -->
    <div class="welcome-device">
      <img id="welcome-device-img" alt="Feel Fader" />
    </div>

    <!-- Waiting status -->
    <div class="welcome-status">
      <div class="welcome-status-dot"></div>
      <span style="font-size:11px;color:var(--t3);letter-spacing:.04em;text-transform:uppercase" data-i18n="welcome.waiting">Waiting for device</span>
    </div>

    <!-- Instruction -->
    <div class="welcome-title" data-i18n="welcome.connect">Connect Feel Fader</div>
    <div class="welcome-sub" data-i18n="welcome.sub">Plug in via USB-C — configuration loads automatically.</div>

    <!-- Skip -->
    <button class="welcome-skip" onclick="skipWelcome()">
      <span data-i18n="welcome.skip">Continue without device</span>
    </button>

  </div>
</div>
```

Replace with:
```html
<div id="welcome-screen">
  <div class="welcome-inner">

    <!-- Device + fader overlay + flash (flash is z-index:5, behind device image) -->
    <div class="welcome-device">
      <div id="welcome-flash" class="welcome-flash"></div>
      <img id="welcome-device-img" alt="Feel Fader" />
      <div class="welcome-fader-tracks" id="welcome-fader-tracks" style="display:none">
        <div class="welcome-fader-track" id="welcome-track-l">
          <div class="welcome-fader-thumb" id="welcome-thumb-l"><img alt=""/></div>
        </div>
        <div class="welcome-fader-track" id="welcome-track-r">
          <div class="welcome-fader-thumb" id="welcome-thumb-r"><img alt=""/></div>
        </div>
      </div>
    </div>

    <!-- Text block — fades out on connect -->
    <div id="welcome-text-block">
      <div class="welcome-status">
        <div class="welcome-status-dot"></div>
        <span style="font-size:11px;color:var(--t3);letter-spacing:.04em;text-transform:uppercase" data-i18n="welcome.waiting">Waiting for device</span>
      </div>
      <div class="welcome-title" data-i18n="welcome.connect">Connect Feel Fader</div>
      <div class="welcome-sub" data-i18n="welcome.sub">Plug in via USB-C — configuration loads automatically.</div>
      <button class="welcome-skip" onclick="skipWelcome()">
        <span data-i18n="welcome.skip">Continue without device</span>
      </button>
    </div>

  </div>
</div>
```

- [ ] **Step 2: Verify in browser**

Reload. Welcome screen shows larger device image with float. Fader thumbs not yet visible (tracks still `display:none`). Text layout identical to before. "Continue without device" still works.

---

## Task 4: JS — `initWelcomeFaderOverlay()`

**File:** `feel-fader.html` JS init block (~line 2852)

This function copies thumb image srcs from the main app fader thumbs (which have inline base64 in the HTML) to the welcome overlay thumbs, then shows the tracks.

- [ ] **Step 1: Add `initWelcomeFaderOverlay` function**

Find this function (~line 2568):
```js
function hideWelcome() {
```

Add the following **before** it:

```js
function initWelcomeFaderOverlay() {
  const srcL = document.querySelector('#thumb-l img');
  const srcR = document.querySelector('#thumb-r img');
  const wL   = document.querySelector('#welcome-thumb-l img');
  const wR   = document.querySelector('#welcome-thumb-r img');
  if (srcL && wL) wL.src = srcL.src;
  if (srcR && wR) wR.src = srcR.src;
  const tracks = document.getElementById('welcome-fader-tracks');
  if (tracks) tracks.style.display = 'block';
}
```

- [ ] **Step 2: Call `initWelcomeFaderOverlay` in the init block**

Find this line (~line 2852):
```js
  if (deviceImg && welcomeImg) welcomeImg.src = deviceImg.src;
```

Add the call on the next line:
```js
  if (deviceImg && welcomeImg) welcomeImg.src = deviceImg.src;
  initWelcomeFaderOverlay();
```

- [ ] **Step 3: Verify in browser**

Reload. Welcome screen now shows animated fader knobs over device image. Left fader travels more (master), right less (slave), both moving in same direction with 0.5s phase offset. Float continues.

---

## Task 5: JS — `connectTransitionWelcome()`, update `hideWelcome` and `skipWelcome`

**File:** `feel-fader.html` JS ~line 2568

- [ ] **Step 1: Replace `hideWelcome` and `skipWelcome`**

Find this exact block (~line 2568):
```js
function hideWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (ws) ws.classList.add('hidden');
}
function skipWelcome() {
  hideWelcome();
}
```

Replace with:
```js
function connectTransitionWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (!ws || ws.classList.contains('hidden')) return;

  // 1. Freeze fader animations at current rendered position
  const thumbL = document.getElementById('welcome-thumb-l');
  const thumbR = document.getElementById('welcome-thumb-r');
  const railL  = document.getElementById('welcome-track-l');
  const railR  = document.getElementById('welcome-track-r');
  if (thumbL && railL) {
    const curL = thumbL.getBoundingClientRect().top - railL.getBoundingClientRect().top;
    thumbL.style.animation = 'none';
    thumbL.style.top = curL + 'px';
  }
  if (thumbR && railR) {
    const curR = thumbR.getBoundingClientRect().top - railR.getBoundingClientRect().top;
    thumbR.style.animation = 'none';
    thumbR.style.top = curR + 'px';
  }

  // 2. Stop float on .welcome-device wrapper
  const devWrap = document.querySelector('#welcome-screen .welcome-device');
  if (devWrap) devWrap.style.animation = 'none';

  // 3. Settle faders to default v=64 (top ≈ 47% of rail)
  //    Thumb height at 220px device width = round(220 * 0.22 * 1.506) = 72px
  const THUMB_H = 72;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (thumbL && railL) {
      thumbL.style.transition = 'top 0.55s ease-in-out';
      thumbL.style.top = ((railL.offsetHeight - THUMB_H) * 0.47) + 'px';
    }
    if (thumbR && railR) {
      thumbR.style.transition = 'top 0.55s ease-in-out';
      thumbR.style.top = ((railR.offsetHeight - THUMB_H) * 0.47) + 'px';
    }
  }));

  // 4. Green flash (z-index:5, behind device image)
  const flash = document.getElementById('welcome-flash');
  if (flash) flash.style.animation = 'welcome-flash-in 0.6s ease-out forwards';

  // 5. Fade out welcome text
  setTimeout(() => {
    const tb = document.getElementById('welcome-text-block');
    if (tb) tb.style.animation = 'welcome-text-out 0.4s ease-in forwards';
  }, 50);

  // 6. Fade out entire welcome screen, then hide
  ws.classList.add('connecting');
  setTimeout(() => ws.classList.add('hidden'), 850);
}

function hideWelcome() {
  connectTransitionWelcome();
}

function skipWelcome() {
  // Bypass animation — instant hide
  const ws = document.getElementById('welcome-screen');
  if (ws) ws.classList.add('hidden');
}
```

- [ ] **Step 2: Verify transition in browser**

Reload. Open DevTools console — no errors. Simulate connect by calling `hideWelcome()` in the DevTools console. You should see:
1. Fader knobs freeze, then glide to center
2. Green radial glow behind device (device stays sharp in front)
3. "Waiting for device" text slides up and fades
4. Welcome screen fades out (~850ms total)
5. Main app visible underneath

Also verify "Continue without device" button still instantly hides the welcome screen with no animation.

- [ ] **Step 3: Verify with real device (if available)**

Plug in Feel Fader. The connect transition should fire automatically (~600ms after device detected, per existing `setTimeout(() => { hideWelcome(); ... }, 600)` in `connectInputs()`).

---

## Task 6: Commit

- [ ] **Step 1: Review the diff**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git diff feel-fader.html
```

Check: only `feel-fader.html` changed, no unrelated lines touched.

- [ ] **Step 2: Commit**

```bash
git add feel-fader.html
git commit -m "feat: welcome screen animated faders + connect transition

- Resize welcome device image 120px → 220px
- Add CSS-animated fader overlay (master/slave, 5.5s, same direction)
- Add connectTransitionWelcome(): freeze faders, settle to v=64,
  green flash behind device, text fade, screen fade-out
- skipWelcome() bypasses animation (instant hide)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Device image 120→220px | Task 1 |
| Float moves to wrapper (stops cleanly) | Task 1 |
| Fader overlay keyframes (master/slave, 5.5s, 0.5s offset) | Task 2 |
| Track positions from FLX/FRX/FTY/FBY/FTW constants | Task 2 (positions hardcoded as %) |
| Flash CSS (z-index:5, behind device) | Task 2 |
| Transition CSS keyframes | Task 2 |
| HTML restructure (flash div, fader tracks, text-block wrapper) | Task 3 |
| initWelcomeFaderOverlay() copies thumb srcs | Task 4 |
| connectTransitionWelcome() full sequence | Task 5 |
| hideWelcome() delegates to transition | Task 5 |
| skipWelcome() bypasses animation | Task 5 |
| Post-connect: device static, faders at v=64 | Task 5 (float stopped, thumbs settled) |

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `initWelcomeFaderOverlay`, `connectTransitionWelcome`, `hideWelcome`, `skipWelcome` — all consistent across tasks. `welcome-thumb-l/r`, `welcome-track-l/r`, `welcome-flash`, `welcome-text-block` — IDs consistent between Task 3 (HTML) and Tasks 4–5 (JS).
