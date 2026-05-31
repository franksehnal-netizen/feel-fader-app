# Welcome Screen Visual Overhaul — Design Spec

**Date:** 2026-05-31  
**File:** `feel-fader.html` (single-file app)  
**Scope:** CSS + HTML + JS changes only, no new dependencies

---

## Problem

1. Device image on welcome screen is 120 px wide — noticeably smaller than the 220 px stage image in the main app.
2. No fader overlay on welcome screen — the device looks like a static photo with no context about what it does.
3. Transition on MIDI connect is instant (`display:none`) — jarring.

---

## Solution Overview

Three layered changes:

1. **Idle animation** — larger device + two CSS-animated fader knobs (master/slave movement)
2. **Connect transition** — faders settle to default, green flash, text fades, content builds in
3. **Post-connect state** — device static (no float), faders at v=64 center

---

## 1. Idle State

### Device image

| Property | Before | After |
|---|---|---|
| `#welcome-device-img` width | `120px` | `220px` |
| Shadow (dark mode) | `0 16px 48px rgba(0,0,0,.2)` | `0 24px 64px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35)` |
| Float animation | `float 3s ease-in-out infinite` | unchanged |

### Fader overlay

Two CSS-only animated knob overlays on top of the device image. No drag handlers — welcome screen is display-only.

Positions derived from main-app layout constants:
```
FLX=0.2289, FRX=0.7684, FTY=0.1164, FBY=0.7974, FTW=0.22
```

**Track geometry (% of device-wrap width/height):**

| | Left track | Right track |
|---|---|---|
| `left` | `(FLX − FTW/2) × 100% = 11.89%` | `(FRX − FTW/2) × 100% = 65.84%` |
| `top` | `FTY × 100% = 11.64%` | same |
| `width` | `FTW × 100% = 22%` | same |
| `height` | `(FBY − FTY) × 100% = 68.10%` | same |

**Thumb:** same PNG `<img>` src as `#thumb-l` / `#thumb-r` (copy `.src` in JS after img load), `width: 100%`, `drop-shadow(0 3px 6px rgba(0,0,0,.45))`.

**Keyframes:**

```css
@keyframes welcome-fader-master {
  0%   { top: 32% }
  38%  { top: 58% }
  70%  { top: 28% }
  100% { top: 32% }
}
@keyframes welcome-fader-slave {
  0%   { top: 44% }
  38%  { top: 56% }
  70%  { top: 42% }
  100% { top: 44% }
}
```

- Left (master): `welcome-fader-master 5.5s ease-in-out infinite`
- Right (slave): `welcome-fader-slave 5.5s ease-in-out 0.5s infinite`

Both move in the same direction. Left has ~30% travel (master), right ~14% travel (slave).

---

## 2. HTML Restructure

Current `#welcome-screen` inner structure needs two additions:
- `#welcome-flash` — radial gradient flash element
- `#welcome-fader-tracks` + two track/thumb divs inside `.welcome-device`
- `#welcome-text-block` wrapper around the text elements (for fade-out targeting)

```html
<div id="welcome-screen">
  <div class="welcome-inner">

    <div class="welcome-device" style="position:relative; z-index:10">
      <!-- flash sits behind device image (z-index:5, rendered before img) -->
      <div id="welcome-flash" class="welcome-flash"></div>

      <img id="welcome-device-img" alt="Feel Fader" />

      <!-- fader overlay — same structure as main app .fader-tracks -->
      <div class="welcome-fader-tracks" id="welcome-fader-tracks" style="display:none">
        <div class="welcome-fader-track" id="welcome-track-l">
          <div class="welcome-fader-thumb" id="welcome-thumb-l">
            <img />  <!-- src copied from #thumb-l on load -->
          </div>
        </div>
        <div class="welcome-fader-track" id="welcome-track-r">
          <div class="welcome-fader-thumb" id="welcome-thumb-r">
            <img />  <!-- src copied from #thumb-r on load -->
          </div>
        </div>
      </div>
    </div>

    <!-- text block — fades out on connect -->
    <div id="welcome-text-block">
      <div class="welcome-status">...</div>
      <div class="welcome-title">...</div>
      <div class="welcome-sub">...</div>
      <button class="welcome-skip" onclick="skipWelcome()">...</button>
    </div>

  </div>
</div>
```

Note: `#welcome-flash` is rendered **before** `#welcome-device-img` in DOM order → paints behind it. Both have `position:absolute`. Flash has `z-index:5`, device wrapper has `z-index:10`.

---

## 3. CSS — New Rules

```css
/* Flash overlay — behind device image */
.welcome-flash {
  position: absolute; inset: 0; z-index: 5;
  border-radius: var(--r-lg);
  background: radial-gradient(ellipse 90% 70% at 50% 45%,
    rgba(52,199,89,.85) 0%, rgba(52,199,89,.2) 50%, transparent 100%);
  opacity: 0;
  pointer-events: none;
}

/* Fader overlay tracks */
.welcome-fader-tracks {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
}
.welcome-fader-track {
  position: absolute;
  width: 22%;  /* FTW */
}
.welcome-fader-track#welcome-track-l {
  left: 11.89%; top: 11.64%; height: 68.10%;
}
.welcome-fader-track#welcome-track-r {
  left: 65.84%; top: 11.64%; height: 68.10%;
}
.welcome-fader-thumb {
  position: absolute; left: 50%; transform: translateX(-50%);
}
.welcome-fader-thumb img {
  display: block; width: 100%;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.45));
}
/* Idle animations */
#welcome-thumb-l { animation: welcome-fader-master 5.5s ease-in-out infinite; }
#welcome-thumb-r { animation: welcome-fader-slave  5.5s ease-in-out 0.5s infinite; }
```

---

## 4. Connect Transition Sequence

Triggered from `connectInputs()` instead of `hideWelcome()` (with 600ms delay as currently).

| t (ms) | Action |
|---|---|
| 0 | Read computed `top` of both thumbs via `getBoundingClientRect`, set as inline `style.top`, remove animation → freeze in place |
| 0 | Stop float: `floatWrapper.style.animation = 'none'` |
| ~4 (double rAF) | Set `transition: top 0.55s ease-in-out` on both thumbs, then `top = (railH − thumbH) × 0.47` (v=64 default) |
| 0 | Start flash: `welcome-flash` → `animation: welcome-flash-in 0.6s ease-out forwards` |
| 50 | `#welcome-text-block` → `animation: welcome-text-out 0.4s ease-in forwards` |
| 500 | `#welcome-screen` → `display:none` is NOT used here — instead the screen fades out: `opacity 0, 0.35s ease` |
| 850 | `#welcome-screen.classList.add('hidden')` — removes from layout |

**Flash keyframe:**
```css
@keyframes welcome-flash-in {
  0%   { opacity: 0 }
  12%  { opacity: 1 }
  55%  { opacity: 0.6 }
  100% { opacity: 0 }
}
```

**Text fade-out keyframe:**
```css
@keyframes welcome-text-out {
  from { opacity: 1; transform: translateY(0) }
  to   { opacity: 0; transform: translateY(-8px) }
}
```

**Welcome screen fade-out:**
```css
#welcome-screen.connecting {
  animation: welcome-screen-out 0.5s ease 0.3s forwards;
}
@keyframes welcome-screen-out {
  from { opacity: 1 }
  to   { opacity: 0 }
}
```

### New JS function

```js
function connectTransitionWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (!ws || ws.classList.contains('hidden')) return;

  // 1. Freeze fader animations at current position
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

  // 2. Stop float (animation lives on #welcome-device-img or its wrapper — see CSS note)
  const devImg = document.getElementById('welcome-device-img');
  if (devImg) devImg.style.animation = 'none';

  // 3. Settle faders to v=64 default (top ≈ 47%)
  // Thumb height at 220px device = round(220 * FTW * 1.506) = 72px — use constant, not offsetHeight
  const THUMB_H = 72;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (thumbL && railL) {
      const defL = (railL.offsetHeight - THUMB_H) * 0.47;
      thumbL.style.transition = 'top 0.55s ease-in-out';
      thumbL.style.top = defL + 'px';
    }
    if (thumbR && railR) {
      const defR = (railR.offsetHeight - THUMB_H) * 0.47;
      thumbR.style.transition = 'top 0.55s ease-in-out';
      thumbR.style.top = defR + 'px';
    }
  }));

  // 4. Flash + text fade + screen fade
  const flash = document.getElementById('welcome-flash');
  if (flash) flash.style.animation = 'welcome-flash-in 0.6s ease-out forwards';

  setTimeout(() => {
    const tb = document.getElementById('welcome-text-block');
    if (tb) tb.style.animation = 'welcome-text-out 0.4s ease-in forwards';
  }, 50);

  ws.classList.add('connecting'); // triggers welcome-screen-out animation

  // 5. Hide after animations complete
  setTimeout(() => ws.classList.add('hidden'), 850);
}
```

### Changes to existing functions

```js
// Before:
function hideWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (ws) ws.classList.add('hidden');
}

// After:
function hideWelcome() {
  connectTransitionWelcome();
}

// skipWelcome — bypass animation (user skips manually)
function skipWelcome() {
  const ws = document.getElementById('welcome-screen');
  if (ws) ws.classList.add('hidden');
}
```

---

## 5. Welcome Fader Overlay Init

The welcome fader tracks need to be shown and thumb images populated after the device image src is set (which happens in JS). Add to the existing image-setup logic:

```js
function initWelcomeFaderOverlay() {
  // Copy thumb image srcs from main app fader thumbs
  const srcL = document.querySelector('#thumb-l img')?.src;
  const srcR = document.querySelector('#thumb-r img')?.src;
  const wThumbL = document.querySelector('#welcome-thumb-l img');
  const wThumbR = document.querySelector('#welcome-thumb-r img');
  if (srcL && wThumbL) wThumbL.src = srcL;
  if (srcR && wThumbR) wThumbR.src = srcR;

  // Show overlay
  const tracks = document.getElementById('welcome-fader-tracks');
  if (tracks) tracks.style.display = 'block';
}
```

Call `initWelcomeFaderOverlay()` after device image src is assigned (same place where `#welcome-device-img.src` is set).

---

## 6. Post-Connect State

After `#welcome-screen` gets `.hidden`:
- Device in main app stage has no float (`.device-wrap` has no float animation — already correct)
- Main app fader positions are driven by `liveValues.f1 / f2` (initialized to 64) — already correct
- No additional changes needed for connected state

---

## Constraints

- `skipWelcome()` bypasses all animation — no transition, instant hide. This preserves existing "Continue without device" behavior.
- If `#welcome-screen` is already `.hidden` when `connectTransitionWelcome()` is called, it returns early — idempotent.
- Flash z-index (5) is below device wrapper z-index (10) — flash glows behind the device.
- The fader overlay on welcome screen is purely visual (no drag, no MIDI output).
