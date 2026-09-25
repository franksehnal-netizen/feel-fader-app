// Regression probe (UX audit 2026-09-25, sprint 3, K-1..K-5): one visual
// language. Font sizes and radii go through tokens (so drift can't creep back
// with the next surface), Mulish uses 400/600/700 only, every on/off setting
// is the glass switch, key-capture buttons are one pill component, red CTA and
// destructive Reset look different, and the roller speaks one vocabulary.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);

// ── Static contract (source) ──
const src = fs.readFileSync(new URL('../feel-fader.html', import.meta.url), 'utf8');
const css = src.replace(/@font-face\{[^}]*\}/g, '');
const FS_SCALE = { '--fs-xs':'10px', '--fs-sm':'11px', '--fs-md':'12px', '--fs-base':'13px', '--fs-lg':'14px', '--fs-xl':'16px', '--fs-2xl':'20px', '--fs-3xl':'22px' };
const rawFontSizes = [...css.matchAll(/font-size:\s*([0-9.]+px)/g), ...css.matchAll(/font:\s*(?:[0-9]{3}\s+)?([0-9.]+px)/g)].map(m => m[0]);
const tokenDefs = Object.entries(FS_SCALE).filter(([k, v]) => !new RegExp(`${k}:\\s*${v}`).test(src)).map(([k]) => k);
// Device geometry mirrors the hardware photo (zones, glow, piano keys), not UI chrome.
const RADIUS_OK = /^(var\(--r(-sm|-lg|-pill)?\)|50%|0|inherit|0 var\(--r-pill\) var\(--r-pill\) 0)$/;
const DEVICE_GEOMETRY = /(\.ctrl-zone|#zone-roller|\.welcome-flash|\.ks-key-black)\b/;
const rawRadii = [];
for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
  for (const r of m[2].matchAll(/border-radius:\s*([^;}"]+)/g)) {
    if (!RADIUS_OK.test(r[1].trim()) && !DEVICE_GEOMETRY.test(m[1])) rawRadii.push(`${m[1].trim().slice(-40)} → ${r[1].trim()}`);
  }
}
for (const r of src.matchAll(/style="[^"]*border-radius:\s*([^;"]+)/g)) if (!RADIUS_OK.test(r[1].trim())) rawRadii.push(`inline → ${r[1]}`);

P('font sizes use the --fs-* scale, no raw px', rawFontSizes.length === 0, rawFontSizes.slice(0, 8).join(' | '));
P('the --fs-* scale is defined (10/11/12/13/14/16/20/22)', tokenDefs.length === 0, tokenDefs.join(','));
P('radii use --r-* tokens outside device geometry', rawRadii.length === 0, rawRadii.join(' | '));

const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(async () => {
  const out = {};
  const wait = ms => new Promise(res => setTimeout(res, ms));
  activeBank = 0; DEVICE_INFO.hid_enabled = true;
  _openSections.clear(); ['roller','macro','fader1','fader2'].forEach(k => _openSections.add(k));
  cfg.macro_global = false; cfg.banks[0].macro_keys = [];
  setRollerMode(0, 'track_nav'); await wait(400); render();

  // K-3 weights: Mulish 400/600/700 only (mono 500 is the one numeric exception).
  out.badWeights = [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length).map(el => {
    const cs = getComputedStyle(el);
    return /Mulish/.test(cs.fontFamily.split(',')[0]) && !['400','600','700'].includes(cs.fontWeight) ? `${el.tagName.toLowerCase()}.${el.className}:${cs.fontWeight}` : null;
  }).filter(Boolean).slice(0, 6);

  // K-1: no native checkbox is visible anywhere.
  const visibleCheckboxes = () => [...document.querySelectorAll('input[type=checkbox]')].filter(el => !el.closest('.hid-switch')).map(el => el.id || el.getAttribute('aria-label') || el.outerHTML.slice(0, 60));
  out.nativeMain = visibleCheckboxes();
  openCustomPresetDialog(); await wait(50);
  out.nativeDialog = visibleCheckboxes();
  document.getElementById('custom-preset-overlay')?.setAttribute('hidden', '');

  // K-2: key capture buttons are one pill component with an explicit empty and capture state.
  const caps = ['navcap-0-cw', 'navcap-0-ccw', 'macro-capture'].map(id => document.getElementById(id));
  out.capsKeycap = caps.map(el => !!el && el.classList.contains('ui-keycap') && !el.hasAttribute('style'));
  out.capsPill = caps.map(el => el && getComputedStyle(el).borderTopLeftRadius);
  out.macroEmpty = caps[2]?.textContent.trim();
  startKeyCapture(0, 'cw');
  out.captureText = document.getElementById('navcap-0-cw')?.textContent.trim();
  cancelKeyCapture();

  // K-4: Reset is destructive (outline + danger text), not a twin of Send.
  const send = document.getElementById('send-btn'), reset = document.querySelector('.backup-reset-btn');
  const probe = document.createElement('span'); probe.style.color = 'var(--danger)'; document.body.appendChild(probe);
  const danger = getComputedStyle(probe).color; probe.remove();
  const bg = el => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor;
  out.resetDiffers = !!reset && bg(reset) !== bg(send);
  out.resetColor = reset && getComputedStyle(reset).color === danger;

  // K-5: roller vocabulary.
  out.segments = [...document.querySelectorAll('.roller-mode-row button')].map(el => el.textContent.trim());
  out.titles = ROLLER_MODES.map(m => rollerModeTitle(m));
  setRollerMode(0, 'cc'); await wait(400);
  const body = document.getElementById('section-body-0-roller')?.textContent || '';
  out.saysEncoder = /Encoder steps/.test(body);
  out.claimsNonSpitfire = /East West|Orchestral Tools/.test(body);
  setRollerMode(0, 'keyswitch'); await wait(400);
  _openRollerAdvanced.add(0); render();
  const labels = [...document.querySelectorAll('#section-body-0-roller .field-label')].filter(el => el.getClientRects().length);
  out.labelStyles = [...new Set(labels.map(el => { const cs = getComputedStyle(el); return `${cs.fontSize}/${cs.textTransform}`; }))];
  out.helpModes = document.getElementById('help-body')?.textContent.match(/Articulation \(CC\)|Navigation \(keys\)/g) || [];
  out.libraryNames = Object.keys(LIBRARY_PRESETS);
  return out;
});

P('Mulish weights are 400/600/700 only', r.badWeights.length === 0, r.badWeights.join(' | '));
P('no native checkbox in the main UI (Invert, Global)', r.nativeMain.length === 0, r.nativeMain.join(','));
P('no native checkbox in the custom setup dialog', r.nativeDialog.length === 0, r.nativeDialog.join(','));
P('key capture buttons use .ui-keycap without inline style', r.capsKeycap.every(Boolean), JSON.stringify(r.capsKeycap));
P('key capture buttons are pills', r.capsPill.every(v => parseFloat(v) >= 14), r.capsPill.join(','));
P('an empty macro reads "Not assigned"', r.macroEmpty === 'Not assigned', r.macroEmpty);
P('capture shows "Press keys…"', r.captureText === 'Press keys…', r.captureText);
P('Reset does not look like Send', r.resetDiffers === true);
P('Reset uses the danger text colour', r.resetColor === true);
P('roller segments match the section titles', r.segments.join() === r.titles.join(), `${r.segments} vs ${r.titles}`);
P('roller help says Roller, not Encoder', r.saysEncoder === false);
P('UACC note credits Spitfire only', r.claimsNonSpitfire === false);
P('roller field labels share one size and case', r.labelStyles.length === 1 && /uppercase/.test(r.labelStyles[0]), r.labelStyles.join(' | '));
P('help uses the same mode names', r.helpModes.length === 0, r.helpModes.join(','));
// Real product names (Spitfire Symphony Orchestra, BBC Symphony Orchestra) or an
// explicit "Spitfire UACC — <section>" for generic lists, never a vague "Spitfire Brass".
const vague = r.libraryNames.filter(n => /Symphonic Orchestra|BBCSO|^Spitfire (Brass|Woodwinds)$/.test(n));
P('library names are real products or explicit generic UACC lists', vague.length === 0 && r.libraryNames.includes('Spitfire UACC — Brass') && r.libraryNames.includes('Spitfire UACC — Woodwinds'), vague.join(','));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
