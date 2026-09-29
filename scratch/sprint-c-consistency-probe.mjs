// Regression probe (UX audit 2026-09-28, sprint C: N-8 … N-13) – consistency
// after the minimal redesign. Decisions: Frank 2026-09-28.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P = (l, ok, x='') => console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

const p = await b.newPage();
p.on('pageerror', e => errs.push(String(e)));
p.on('dialog', d => d.accept());
await p.setViewport({ width:1440, height:900 });
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome()); await wait(1200);

// N-8: a note range never reads like a negative octave ("C-2–B-2").
const n8 = await p.evaluate(() => {
  const bank = cfg.banks[0];
  bank.roller_mode = 'keyswitch'; bank.ks_notes = [24,25,26,27,28,29,30,31]; bank.ks_channel = 0;
  render(); renderLiveStrip();
  const lux = LIBRARY_PRESETS['Sonuscore LUX – Violins 1'];
  return {
    summary: rollerSectionSummary(bank).meta,
    hud: document.getElementById('live-roller-tech').textContent,
    diag: diagnosticRollerMapping(bank),
    picker: [...new DOMParser().parseFromString(quickSetupMenuHtml('LUX – Violins 1'), 'text/html').querySelectorAll('.quick-setup-option-kind')].map(el => el.textContent)[0],
    luxNotes: lux.ks_notes.length,
  };
});
P('N-8: section summary range uses " → "', n8.summary === 'Ch 1 · C0 → G0', n8.summary);
P('N-8: HUD range uses a compact "→"', n8.hud === 'Ch1·C0→G0', n8.hud);
P('N-8: diagnostics range uses " → "', n8.diag.endsWith('C0 → G0'), n8.diag);
P('N-8: library picker range uses " → "', / → /.test(n8.picker) && !/[A-G]#?-?\d–/.test(n8.picker), n8.picker);

// N-9: prose and plain numbers in Mulish; Ch/CC and note tokens are Mulish 600
// with tabular figures (DM Mono dropped 2026-09-29); one "Ch 1 · CC11" format
// outside the HUD.
const n9 = await p.evaluate(() => {
  _openSections.add('roller'); _openSections.add('fader1'); render();
  const fam = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : 'missing'; };
  const num = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontVariantNumeric : 'missing'; };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('script,style')) texts.push(walker.currentNode.textContent);
  const diag = midiDiagnosticsData();
  return {
    label: fam('.section-summary-label'), meta: fam('.section-summary-meta'),
    metaWeight: getComputedStyle(document.querySelector('.section-summary-meta')).fontWeight, metaNum: num('.section-summary-meta'),
    labelWeight: getComputedStyle(document.querySelector('.section-summary-label')).fontWeight,
    monoLeft: [...document.querySelectorAll('*')].filter(el => /DM Mono|monospace/.test(getComputedStyle(el).fontFamily) && !el.closest('script,style,code,pre')).length,
    seqValue: fam('.seq-value'), seqIndex: fam('.seq-index'), ksKey: fam('.ks-key'), ksStep: fam('.ks-stepval'), stepper: fam('.stepper input'),
    seqNum: num('.seq-value'), stepperNum: num('.stepper input'),
    ccSpaced: texts.filter(t => /\bCC \d/.test(t)),
    musical: musicalCcName(3), diagLeft: diag.left,
    preview: libraryPresetPreviewRows('Spitfire BBC Symphony Orchestra', LIBRARY_PRESETS['Spitfire BBC Symphony Orchestra']),
  };
});
const mulish = f => /Mulish/.test(f) && !/DM Mono/.test(f);
P('N-9: prose summary ("8 keyswitches") in Mulish', mulish(n9.label), n9.label);
P('N-9: Ch/CC and note tokens in Mulish 600, heavier than the 400 prose', mulish(n9.meta) && n9.metaWeight === '600' && n9.labelWeight === '400' && /tabular-nums/.test(n9.metaNum), JSON.stringify({ meta: n9.meta, w: n9.metaWeight, lw: n9.labelWeight, num: n9.metaNum }));
P('no element renders in DM Mono / monospace any more', n9.monoLeft === 0, String(n9.monoLeft));
P('N-9: roller order values and index in Mulish', mulish(n9.seqValue) && mulish(n9.seqIndex), `${n9.seqValue} / ${n9.seqIndex}`);
P('N-9: keyboard labels and FROM/TO in Mulish', mulish(n9.ksKey) && mulish(n9.ksStep), `${n9.ksKey} / ${n9.ksStep}`);
P('N-9: stepper numbers (channel, CC, velocity) in Mulish', mulish(n9.stepper), n9.stepper);
P('N-9: numbers keep tabular figures', /tabular-nums/.test(n9.seqNum) && /tabular-nums/.test(n9.stepperNum), `${n9.seqNum} / ${n9.stepperNum}`);
P('N-9: no "CC 32" style text on the page', n9.ccSpaced.length === 0, JSON.stringify(n9.ccSpaced));
P('N-9: CC fallback name and diagnostics read "CC3" / "Ch 1 · CC11"', n9.musical === 'CC3' && n9.diagLeft.startsWith('Ch 1 · CC11'), `${n9.musical} | ${n9.diagLeft}`);
P('N-9: library preview reads "CC32"', /CC32/.test(n9.preview) && !/CC 32/.test(n9.preview), n9.preview.replace(/<[^>]+>/g, ' ').slice(0, 160));

// N-10: display options live together in the header; one "Device" row.
const n10 = await p.evaluate(() => {
  const header = document.querySelector('header');
  const row = document.getElementById('device-settings-toggle-btn');
  const before = document.getElementById('di-firmware-summary').textContent.trim();
  _midiState = 'granted'; _ffConnected = true; _serialPort = {}; DEVICE_INFO.firmware = '1.3.0'; connState(); renderConnState(); render();
  const after = document.getElementById('di-firmware-summary').textContent.trim();
  _ffConnected = false; _serialPort = null; connState(); renderConnState(); render();
  return {
    liveInHeader: header.contains(document.getElementById('live-hud-switch')),
    controllerInHeader: header.contains(document.getElementById('controller-toggle-input')),
    appGroup: !!document.getElementById('app-settings-toggle-btn'),
    label: row.querySelector('.group-row-label').firstChild.textContent.trim(),
    before, after, disconnected: document.getElementById('di-firmware-summary').textContent.trim(),
    settingsWording: document.body.innerHTML.includes('Device &amp; Settings'),
  };
});
P('N-10: Live monitor switch sits in the header, Controller switch is gone', n10.liveInHeader && !n10.controllerInHeader, JSON.stringify(n10));
P('N-10: no separate Application settings group', !n10.appGroup);
P('N-10: device row is called "Device"', n10.label === 'Device', n10.label);
P('N-10: device summary says "Not connected" / "Firmware 1.3.0"', n10.before === 'Not connected' && n10.after === 'Firmware 1.3.0' && n10.disconnected === 'Not connected', JSON.stringify(n10));
P('N-10: help and toasts no longer say "Device & Settings"', !n10.settingsWording);
await p.evaluate(() => { const sw = document.getElementById('live-hud-switch'); sw.click(); });
P('N-10: header switch turns the live monitor off and persists', await p.evaluate(() => !document.getElementById('live-strip').classList.contains('is-contextual-visible') && localStorage.getItem('ff_live_hud_enabled') === '0'));
await p.evaluate(() => setLiveHudEnabled(true));

// N-11: the macro button glow (32 + 17 px spread) is not cut into a box.
const n11 = await p.evaluate(() => getComputedStyle(document.getElementById('zone-macro')).clipPath);
const insets = (n11.match(/-?\d+(\.\d+)?px/g) || []).map(parseFloat);
P('N-11: glow clip leaves ≥49px on the round side', insets.length >= 3 && insets[0] <= -49 && insets[1] <= -49 && insets[2] <= -49 && (insets[3] ?? 0) === 0, n11);

// N-12: a bank tab with an error shows "!", the dot stays the device state.
const n12 = await p.evaluate(() => {
  cfg.banks[0].fader2.cc = cfg.banks[0].fader1.cc; render(); runValidation();
  const mark = document.querySelector('#bank-tabs .bank-block-tab .bank-tab-issue');
  const out = { text: mark?.textContent, bg: mark && getComputedStyle(mark).backgroundColor, radius: mark && getComputedStyle(mark).borderRadius };
  cfg.banks[0].fader2.cc = 1; render(); runValidation();
  return out;
});
P('N-12: bank tab error mark is "!" without a dot', n12.text === '!' && /rgba\(0, 0, 0, 0\)|transparent/.test(n12.bg), JSON.stringify(n12));

// N-13a: the library preview names the first articulations.
const n13 = await p.evaluate(() => {
  const strip = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return {
    lux: strip(libraryPresetPreviewRows('Sonuscore LUX – Violins 1', LIBRARY_PRESETS['Sonuscore LUX – Violins 1'])),
    bbc: strip(libraryPresetPreviewRows('Spitfire BBC Symphony Orchestra', LIBRARY_PRESETS['Spitfire BBC Symphony Orchestra'])),
  };
});
P('N-13: keyswitch preview lists names and "+N more"', /Legato/.test(n13.lux) && /\+\d+ more/.test(n13.lux), n13.lux);
P('N-13: UACC preview lists articulation names', new RegExp(await p.evaluate(() => uaccName(LIBRARY_PRESETS['Spitfire BBC Symphony Orchestra'].uacc_values[0]))).test(n13.bbc), n13.bbc);

// N-13b: "Enable Keyboard…" stands out in dark mode – since 2026-09-29 the
// notice is flat, so the filled pill (not an extra border) carries it.
const n13b = await p.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  cfg.banks[0].roller_mode = 'track_nav'; DEVICE_INFO.hid_enabled = false; _openSections.add('roller'); render();
  const btn = document.querySelector('.hid-inline-action');
  const cs = btn && getComputedStyle(btn);
  const card = getComputedStyle(document.querySelector('.bank-card')).backgroundColor;
  const out = { found: !!btn, bg: cs?.backgroundColor, card };
  document.documentElement.removeAttribute('data-theme'); cfg.banks[0].roller_mode = 'cc'; render();
  return out;
});
P('N-13: "Enable Keyboard…" is a filled pill distinct from the card in dark mode', n13b.found && n13b.bg !== n13b.card && !/rgba\(0, 0, 0, 0\)/.test(n13b.bg), JSON.stringify(n13b));

// N-13c: the Browse… focus ring does not cover "Library setup".
const n13c = await p.evaluate(() => {
  const link = document.getElementById(`library-browse-${activeBank}`);
  link.focus({ focusVisible: true });
  const cs = getComputedStyle(link);
  const ring = link.getBoundingClientRect().left - parseFloat(cs.outlineOffset) - parseFloat(cs.outlineWidth);
  const label = document.querySelector('.bank-quick-setup-label').getBoundingClientRect().right;
  return { ring: Math.round(ring * 10) / 10, label: Math.round(label * 10) / 10 };
});
P('N-13: Browse… focus ring stays clear of the "Library setup" label', n13c.ring >= n13c.label, JSON.stringify(n13c));

P('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
