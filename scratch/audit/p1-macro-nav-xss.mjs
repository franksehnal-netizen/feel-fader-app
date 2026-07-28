// P1 Security — Codex cross-check (launch audit 2026-07-28, Task 9).
// Codex's independent second opinion challenged the Task-3 "no XSS" conclusion,
// naming NEW sinks: cfg.macro_keys and bank.nav_keys_cw/ccw flow through
// keyComboLabel()/hidLabel() (~2234-2242) with NO escHtml(), then get raw-
// interpolated into macroSectionContent() (~3007) and trackNavBody() (~2969-
// 2984), both of which land in the innerHTML sink at renderPanels() (~2638).
//
// Code trace confirmed by static read before writing this probe:
//   hidLabel(code): numeric range checks (code>=0x04 etc.) all evaluate false
//   for a non-numeric string (ToNumber coercion -> NaN), falling through to
//   `return '0x'+code.toString(16)`. String.prototype.toString ignores the
//   radix arg, so a string payload passes through UNCHANGED, just prefixed
//   with "0x". keyComboLabel() joins these with '+'. Neither function calls
//   escHtml. The template literals at macroSectionContent()/trackNavBody()
//   interpolate the result directly (no escHtml wrapper), and renderPanels()
//   assigns the whole bank-card HTML to `panels-row.innerHTML` unconditionally
//   on every render() -- the macro section and the roller-mode content for
//   the active bank are always built into that HTML, not gated by the
//   collapsed/hidden CSS state, so no click/open is required.
//
// Reachability of the payload into cfg (verified by reading normalizeFwConfig
// ~4285-4328 and applyLibraryPreset ~6508-6534):
//   - cfg.macro_keys: BOTH normalizeFwConfig branches leave it untouched
//     (legacy branch ~4288 never references macro_keys at all; modern branch
//     ~4304 does `Array.isArray(p.macro_keys) ? p.macro_keys : []` -- an
//     array-type check only, no per-element clamping) -> reachable via
//     config-file import (onImport).
//   - bank.nav_keys_cw/ccw: modern branch ~4322-4323 does the same
//     array-type-only check (no clampCcList). Legacy branch never touches it.
//     -> reachable via config-file import.
//   - bank.nav_keys_cw/ccw via custom-preset apply: applyLibraryPreset()
//     ~6522-6527 clamps fader/encoder cc+channel (~6520) and clamps
//     articulation values via clampCcList (~6529-6530) but copies
//     preset.roller.nav_keys_cw/ccw with a bare array spread and NO clamp
//     (~6524-6525). isValidCustomPreset() (~6175) only checks for a
//     `custom:true` marker + one of a few top-level keys -- it never inspects
//     array element types. -> reachable via importCustomPresets() (JSON file
//     import) AND via a hand-edited localStorage
//     'ff-custom-library-presets-v1' blob (loadCustomPresets() ~6163 applies
//     the identical structural-only check).
//
// This probe drives the two vectors that don't require a live serial device
// through the app's REAL functions (normalizeFwConfig + applyLibraryPreset),
// exactly as onImport()/confirmLibraryPreview() call them, then renders and
// checks whether the payload executed / landed live in the DOM.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; const alerts=[];
p.on('pageerror',e=>errs.push(String(e)));
p.on('dialog', async d=>{ alerts.push(d.message()); await d.dismiss(); });
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
await new Promise(r=>setTimeout(r,300));

// --- Vector A: cfg.macro_keys via config import (onImport's real statements) ---
const resMacro = await p.evaluate(async () => {
  window.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  const evil = { banks:[{ fader1:{cc:1,channel:0}, fader2:{cc:2,channel:0}, encoder:{cc:32,channel:0}, uacc_values:[1] }], macro_keys:[payload] };
  let parsed = evil; // stand-in for JSON.parse(ev.target.result)
  if (!parsed.banks) throw new Error('Invalid device backup');
  parsed = normalizeFwConfig(parsed);
  cfg = parsed; loaded = true; dirty = true; activeBank = 0;
  cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  return {
    xss: window.__xss,
    bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML),
    macroKeysAfterNormalize: cfg.macro_keys,
    macroButtonHtml: document.getElementById('macro-capture')?.outerHTML || null,
  };
});
P('[macro_keys/config-import] onerror payload se nespustil (window.__xss=false)', resMacro.xss===false, JSON.stringify(resMacro));
P('[macro_keys/config-import] payload neni v DOM jako zivy <img onerror>', resMacro.bodyHasRawImg===false, JSON.stringify(resMacro));

// --- Vector B: bank.nav_keys_cw via config import, roller_mode:'track_nav' ---
const resNavImport = await p.evaluate(async () => {
  window.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  const evil = { banks:[{ fader1:{cc:1,channel:0}, fader2:{cc:2,channel:0}, encoder:{cc:32,channel:0}, uacc_values:[1], roller_mode:'track_nav', nav_keys_cw:[payload] }] };
  let parsed = evil;
  if (!parsed.banks) throw new Error('Invalid device backup');
  parsed = normalizeFwConfig(parsed);
  cfg = parsed; loaded = true; dirty = true; activeBank = 0;
  cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  return {
    xss: window.__xss,
    bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML),
    navKeysAfterNormalize: cfg.banks[0].nav_keys_cw,
    rollerMode: cfg.banks[0].roller_mode,
    navcapHtml: document.getElementById('navcap-0-cw')?.outerHTML || null,
  };
});
P('[nav_keys_cw/config-import] onerror payload se nespustil (window.__xss=false)', resNavImport.xss===false, JSON.stringify(resNavImport));
P('[nav_keys_cw/config-import] payload neni v DOM jako zivy <img onerror>', resNavImport.bodyHasRawImg===false, JSON.stringify(resNavImport));

// --- Vector C: bank.nav_keys_cw via custom-preset apply (real applyLibraryPreset) ---
const resNavPreset = await p.evaluate(async () => {
  window.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  // Reset to a clean known bank state first (independent of Vector B's mutation).
  loadDefaultDemoConfig();
  activeBank = 0;
  const presetName = '__codex_xss_probe_preset__';
  customLibraryPresets[presetName] = {
    custom: true,
    saved_at: new Date().toISOString(),
    roller: { roller_mode:'track_nav', nav_keys_cw:[payload], nav_keys_ccw:[0x51], nav_invert:false },
  };
  // Same call confirmLibraryPreview() makes after the user clicks "Apply":
  applyLibraryPreset(presetName, 'all');
  dirty = true; cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  delete customLibraryPresets[presetName];
  return {
    xss: window.__xss,
    bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML),
    navKeysAfterApply: cfg.banks[0].nav_keys_cw,
    rollerMode: cfg.banks[0].roller_mode,
    navcapHtml: document.getElementById('navcap-0-cw')?.outerHTML || null,
  };
});
P('[nav_keys_cw/custom-preset-apply] onerror payload se nespustil (window.__xss=false)', resNavPreset.xss===false, JSON.stringify(resNavPreset));
P('[nav_keys_cw/custom-preset-apply] payload neni v DOM jako zivy <img onerror>', resNavPreset.bodyHasRawImg===false, JSON.stringify(resNavPreset));

P('zadny alert()/dialog z injektovaneho skriptu (all vectors)', alerts.length===0, alerts.join(' | '));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
