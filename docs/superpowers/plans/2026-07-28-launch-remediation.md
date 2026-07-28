# Feel Fader Launch Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Opravit audit nálezy (Critical+High+Medium) v `feel-fader.html` tak, aby všechny audit probes přešly FAIL→PASS a launch se odblokoval, bez regrese round-trip config syncu s firmwarem.

**Architecture:** Chirurgické editace jednosouborové appky `feel-fader.html`. Fix-first: každý fix ověřen svým committed audit probem (FAIL→PASS), pak migrace probu do `scratch/run-all-probes.mjs`. XSS fix je data-layer clamp zrcadlící firmware (žádná firmware změna).

**Tech Stack:** Vanilla JS single-file app; puppeteer-core probes; `node scratch/audit/run-audit-probes.mjs` (audit runner) + `node scratch/run-all-probes.mjs` (green suite).

## Global Constraints

- **Nemodifikovat firmware repo** (`../feel-fader-firmware/`). Clamp range 0–255 int MUSÍ přesně odpovídat `ff_config.py:parse_macro_keys` / `_nav_keys` (zdroj pravdy pro range).
- **Chirurgické editace** `feel-fader.html`; každý změněný řádek stopovatelný k nálezu. Nedotýkat se nesouvisejícího chování.
- **Nestagovat** `CLAUDE.md` (má pre-existing lokální změnu) ani `.mcp.json` (untracked).
- Každý fix ověřit příslušným probem přes `node scratch/audit/run-audit-probes.mjs`; probe MUSÍ přejít FAIL→PASS. Ostatní audit probes nesmí regredovat.
- Commit po každém tasku; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch: `fix/launch-criticals` (už vytvořen z `main`).
- **Manuální HW test je mimo scope automatizace** — Task Final ho jen vlajkuje Frankovi.
- Spec: `docs/superpowers/specs/2026-07-28-launch-remediation-design.md`.

---

## Task 1: XSS clamp — macro_keys + nav_keys (P1-2, P1-3)

**Files:** Modify `feel-fader.html` (`normalizeFwConfig`, `applyLibraryPreset`, custom-preset import path).

**Interfaces:**
- Produces: helper `clampHidList(arr)` — `Array.isArray(arr) ? arr.map(v=>Number(v)).filter(v=>Number.isFinite(v)&&v>=0&&v<=255).map(v=>Math.trunc(v)) : []`. Mirrors firmware `parse_macro_keys`/`_nav_keys` (int, 0–255, drop invalid).

- [ ] **Step 1: Verify probe currently FAILs**

Run: `node scratch/audit/run-audit-probes.mjs`
Expected: `p1-macro-nav-xss.mjs` shows FAIL (confirms starting state).

- [ ] **Step 2: Add `clampHidList` helper**

Place next to `clampCcList` (~feel-fader.html:4283). Grep `clampCcList` to find exact spot.
```js
// HID usage IDs 0–255 (mirrors firmware ff_config.parse_macro_keys / _nav_keys).
function clampHidList(arr){ return Array.isArray(arr) ? arr.map(v=>Number(v)).filter(v=>Number.isFinite(v)&&v>=0&&v<=255).map(v=>Math.trunc(v)) : []; }
```

- [ ] **Step 3: Apply at every untrusted ingestion point**

Grep each and wrap the raw pass-through with `clampHidList(...)`:
- `normalizeFwConfig`: `macro_keys: Array.isArray(p.macro_keys) ? p.macro_keys : []` → `macro_keys: clampHidList(p.macro_keys)` (~4304).
- `normalizeFwConfig` per-bank: `nav_keys_cw: Array.isArray(b.nav_keys_cw) ? b.nav_keys_cw : [0x52]` → `nav_keys_cw: (clampHidList(b.nav_keys_cw).length ? clampHidList(b.nav_keys_cw) : [0x52])` and same for `nav_keys_ccw`/`[0x51]` (~4322–4323). Preserve the empty→default fallback exactly like firmware `_nav_keys`.
- `applyLibraryPreset`: `bank.nav_keys_cw = [...(preset.roller.nav_keys_cw || [0x52])]` → clamp the result; same for ccw (~6524–6525). If the preset carries `macro_keys`, clamp there too.
- Custom-preset import: find `importCustomPresets`/`isValidCustomPreset` and ensure any preset that reaches render has nav/macro keys clamped (either clamp on import or rely on the render-path normalize — verify by reading which path preset render uses).

- [ ] **Step 4: Verify probe PASSes, no regression**

Run: `node scratch/audit/run-audit-probes.mjs`
Expected: `p1-macro-nav-xss.mjs` all PASS; the other audit probes' fail-count unchanged except this one flipping.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "fix(sec): clamp macro_keys/nav_keys to HID 0-255 (P1-2/P1-3 stored XSS)"
```

---

## Task 2: Import validation before persist (P2-1)

**Files:** Modify `feel-fader.html` (`onImport`, and defensively `normalizeFwConfig`).

**Interfaces:**
- Consumes: `normalizeFwConfig`, `cfgSave`, `render`, `toast`.
- Produces: import path that rejects malformed config with a clean toast and never persists garbage; `normalizeFwConfig` always yields well-formed banks (both faders present, valid types) so `render` cannot throw.

- [ ] **Step 1: Verify probe currently FAILs**

Run: `node scratch/audit/run-audit-probes.mjs` → `p2-malformed-import.mjs` FAIL.

- [ ] **Step 2: Harden `normalizeFwConfig` to always produce renderable banks**

Read `normalizeFwConfig` (~4285–4328) and `faderSectionContent` (~2672, the crash site — `ctrl.cc` on undefined `fader2`). Ensure every normalized bank has well-typed `fader1`/`fader2`/`encoder` objects (default when missing/malformed), so `render` never dereferences undefined. Keep clamps from Task 1.

- [ ] **Step 3: Validate at import, reject before persist**

In `onImport` (~4636 — reads file JSON then `cfg=p; loaded=true; dirty=true; activeBank=0; cfgSave(); render();`): before assigning, validate the parsed object (has an array `banks`, each bank an object). On invalid → `toast('error', 'Neplatný config soubor')` (match existing toast API) and RETURN without `cfgSave`/`render`. Only persist after a successful `render` path, or validate-then-persist so a throw can't leave persisted garbage. Reading the crash order (`cfgSave` before `render`) is the root — reorder to persist only after a clean normalize+render, or guard render in try/catch that rolls back on failure.

- [ ] **Step 4: Verify probe PASSes, no regression**

Run: `node scratch/audit/run-audit-probes.mjs` → `p2-malformed-import.mjs` all PASS; others unchanged.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "fix(stability): validate config import before persist, never persist malformed cfg (P2-1)"
```

---

## Task 3: Browser-support hláška (P4-1)

**Files:** Modify `feel-fader.html` (welcome screen markup + startup feature-detect).

**Interfaces:**
- Consumes: welcome init, `navigator.serial`, `navigator.requestMIDIAccess`.
- Produces: on the welcome screen, a visible readable message when Web Serial/MIDI is absent (Safari/Firefox), asserted by the probe scoping to `#welcome-screen.innerText`.

- [ ] **Step 1: Verify probe currently FAILs**

Run: `node scratch/audit/run-audit-probes.mjs` → `p4-no-webserial-degradation.mjs` FAIL on the "readable message" assertion.

- [ ] **Step 2: Feature-detect at startup, render banner into welcome**

Read the welcome init (grep `showWelcome`, `#welcome-screen`). Add: if `!('serial' in navigator) || typeof navigator.requestMIDIAccess !== 'function'`, render a clear message INTO `#welcome-screen` (not the hidden footer), e.g. "Feel Fader potřebuje Chrome nebo Edge — Web Serial &amp; Web MIDI." Keep it inside the overlay so it's visible at first impression. Do not break the Chromium path (message only shows when APIs absent).

- [ ] **Step 3: Verify probe PASSes, no regression**

Run: `node scratch/audit/run-audit-probes.mjs` → `p4-no-webserial-degradation.mjs` all PASS. Also confirm existing `scratch/send-without-web-serial-probe.mjs` behavior isn't broken (it's in the green suite).

- [ ] **Step 4: Commit**

```bash
git add feel-fader.html
git commit -m "fix(compat): show Chrome/Edge required notice on welcome when Web Serial/MIDI missing (P4-1)"
```

---

## Task 4: Self-host fonts (P3-1)

**Files:** Modify `feel-fader.html` (`<head>` — replace Google Fonts `<link>` with local `@font-face`).

**Interfaces:**
- Produces: zero external network requests; fonts embedded (data: URI or same-origin files).

- [ ] **Step 1: Verify probe currently FAILs**

Run: `node scratch/audit/run-audit-probes.mjs` → `p3-external-requests.mjs` FAIL (fonts.googleapis/gstatic present).

- [ ] **Step 2: Identify used font weights**

Grep the Google Fonts `<link href>` in `feel-fader.html` `<head>` to see exactly which families/weights are requested (Mulish, IBM Plex Mono). Only self-host those weights.

- [ ] **Step 3: Embed fonts, remove Google link**

Fetch the needed `woff2` files, base64-encode, add `@font-face` blocks with `src:url(data:font/woff2;base64,...)` at the top of the `<style>` (or a same-origin file if data-URI bloats too much — but single-file distribution favors data URI). Remove the `<link rel="preconnect">`/`<link href="https://fonts.googleapis.com...">` lines. Keep the exact `font-family` names so all `font-family` references still resolve.

- [ ] **Step 4: Verify probe PASSes + fonts still render**

Run: `node scratch/audit/run-audit-probes.mjs` → `p3-external-requests.mjs` all PASS (zero external hosts). Manually/probe-confirm the app still renders with the correct fonts (no fallback-to-serif). No other audit probe regresses.

- [ ] **Step 5: Commit**

```bash
git add feel-fader.html
git commit -m "fix(privacy): self-host Mulish + IBM Plex Mono, drop Google Fonts (P3-1 GDPR)"
```

---

## Task 5: CSP meta (P1-1, P6-1)

**Files:** Modify `feel-fader.html` (`<head>`).

**Interfaces:**
- Consumes: self-hosted fonts (Task 4 done first, so no external font hosts in policy).

- [ ] **Step 1: Add CSP `<meta>` in `<head>`**

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'">
```
Place early in `<head>`.

- [ ] **Step 2: Verify app still fully works under CSP**

Run: `node scratch/audit/run-audit-probes.mjs` — ALL audit probes must still behave (CSP must not break inline script/styles/data-URI fonts/`data:` images). If any probe newly breaks (e.g. a blocked resource), the policy is too strict — loosen the specific directive minimally and note why. Load the app in the browser probe path and confirm no CSP violation kills functionality.

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html
git commit -m "fix(sec): add pragmatic CSP meta (P1-1, mitigates P6-1 on GitHub Pages)"
```

---

## Task 6: Global error handler (P2-2)

**Files:** Modify `feel-fader.html` (early in `<script>`).

- [ ] **Step 1: Add global handlers**

Early in the main script, add:
```js
window.addEventListener('error', e => { try{ toast('error','Něco se pokazilo — zkuste to znovu'); }catch(_){} console.error('[ff] uncaught', e.error||e.message); });
window.addEventListener('unhandledrejection', e => { try{ toast('error','Něco se pokazilo — zkuste to znovu'); }catch(_){} console.error('[ff] unhandled rejection', e.reason); });
```
Verify `toast` is defined by the time these can fire (they attach at parse; toast is called only on an actual error). Match the real `toast(type, msg)` signature (grep it).

- [ ] **Step 2: Verify no regression**

Run: `node scratch/audit/run-audit-probes.mjs` — all probes still PASS (this shouldn't fire in normal flows). The handler is a safety net; there is no dedicated FAIL→PASS probe, so confirm nothing regresses and that a deliberately-thrown error surfaces a toast rather than a silent break (can spot-check via the p2 probe's error path).

- [ ] **Step 3: Commit**

```bash
git add feel-fader.html
git commit -m "fix(stability): global error + unhandledrejection handler (P2-2)"
```

---

## Task 7: Migrate probes + reconcile controller-toggle-speed

**Files:** Modify `scratch/run-all-probes.mjs` (add migrated audit probes); investigate `scratch/controller-toggle-speed-probe.mjs` vs `feel-fader.html` animation.

**Interfaces:**
- Consumes: all fixes from Tasks 1–6 (audit runner now all-PASS).

- [ ] **Step 1: Confirm audit runner fully green**

Run: `node scratch/audit/run-audit-probes.mjs`
Expected: `0 failed` across all audit probes (p6 is standalone — run `node scratch/audit/p6-deploy-hygiene.mjs` separately; its header findings are GH-Pages platform limits, not code-fixable, so it may still report those — record, don't block).

- [ ] **Step 2: Migrate fixed audit probes into the green suite**

Add the now-passing audit probe filenames to the `PROBES` array in `scratch/run-all-probes.mjs` (p1-xss-config-import, p1-proto-pollution, p1-macro-nav-xss, p2-malformed-import, p2-storage-failure, p2-serial-robustness, p3-external-requests, p4-no-webserial-degradation, p5-heap-growth). NOTE: `run-all-probes.mjs` resolves probes in `scratch/` (one level); audit probes live in `scratch/audit/`. Either move them to `scratch/` or adjust the runner path handling — pick the smaller change and keep the audit runner working too. Do NOT add `p6-deploy-hygiene.mjs` (needs live internet).

- [ ] **Step 3: Reconcile `controller-toggle-speed-probe.mjs`**

This probe FAILs 4/6 on `main` (pre-existing, cosmetic controller-toggle CSS transition timings). Read the probe's expected values (0.55s box, `0.55s, 0.55s` content, hide `0.32s, 0.55s`, squish < 0.25, reduced-motion 0s) against the current `feel-fader.html` CSS (grep `stage-collapse`, `is-collapsed`, the transition rules). Decide by reading which is truth: if the animation intentionally changed since 2026-07-26, UPDATE the probe's expected values to match current intended behavior; if the animation regressed, FIX the CSS to the documented values. Record the decision in the commit message. (Do not silently delete the probe.)

- [ ] **Step 4: Full green suite**

Run: `node scratch/run-all-probes.mjs`
Expected: `0 failed` (all migrated audit probes PASS + controller-toggle reconciled + everything else still green).

- [ ] **Step 5: Commit**

```bash
git add scratch/
git commit -m "test: migrate audit probes into green suite, reconcile controller-toggle-speed probe"
```

---

## Task Final: Verify + flag HW test

- [ ] **Step 1: Full verification**

Run both: `node scratch/audit/run-audit-probes.mjs` and `node scratch/run-all-probes.mjs` — both `0 failed`. Confirm `<meta http-equiv="Content-Security-Policy"` present (`grep`), and `feel-fader.html` has no `fonts.googleapis`/`fonts.gstatic` reference (`grep`).

- [ ] **Step 2: Update audit report statuses**

In `docs/feel-fader-launch-audit-2026-07-28.md`, mark the fixed findings' Stav from `Open` to `Fixed` (P1-2, P1-3, P2-1, P4-1, P1-1, P2-2, P3-1) with the fix commit refs. Leave the go/no-go verdict but append a "Remediation" note that blockers are addressed pending HW verification.

- [ ] **Step 3: Flag mandatory manual HW test to Frank**

Report to Frank: automation cannot touch real hardware. He must run the round-trip on a physical Feel Fader: connect → load config → edit → send → reload → confirm config persisted and matches, and that macro/nav keys still work on device. Only after that is the NO-GO cleared to GO.

- [ ] **Step 4: Commit**

```bash
git add docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "docs: mark remediated findings, note pending HW verification"
```

## Self-Review (autor plánu)

- **Spec coverage:** P1-2/P1-3→T1, P2-1→T2, P4-1→T3, P3-1→T4, P1-1/P6-1→T5, P2-2→T6, probe migration + controller-toggle→T7, verify+HW flag→Final. ✓
- **Placeholders:** clamp helper is concrete; edit sites named by function + approx line (implementers grep to confirm — file is 6600 lines and shifts). Font base64 + CSP string are concrete. ✓
- **Type consistency:** `clampHidList` used consistently; firmware range 0–255 int matches `ff_config.parse_macro_keys`/`_nav_keys`. Ordering: Task 4 (fonts) before Task 5 (CSP) so policy needs no external hosts. ✓
- **Coupling:** only `feel-fader.html` + `scratch/` change; no firmware edits; clamp mirrors firmware. ✓
