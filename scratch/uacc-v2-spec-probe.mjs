// Regression probe (UX audit 2026-09-25, F-4 + F-2): articulation names must
// follow the published UACC v2 spec (Spitfire Chamber Strings manual,
// Appendix E), and only libraries that really support UACC may ship as UACC
// presets. EW Opus is keyswitch-based and OT SINE uses its own CC values, so
// those presets (and the generic "Kontakt Factory" one) must not exist.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

// UACC v2: value → pattern the composer-facing name must match.
const SPEC = {
  1:/^Long$/, 2:/^Long.*Alternative/, 3:/^Long.*Octave$/, 4:/^Long.*Octave Muted/, 5:/^Long.*Small/,
  6:/^Long.*Small Muted/, 7:/^Long.*Muted/, 8:/^Long.*Soft/, 9:/^Long.*Hard/, 10:/^Long.*Harmonic/,
  11:/^Tremolo/, 12:/^Tremolo.*Muted/, 13:/^Tremolo.*Soft/, 14:/^Tremolo.*Hard/, 15:/^Tremolo.*Muted/,
  16:/^Long.*Vibrato/, 17:/^Long.*(Higher|Tasto)/, 18:/^Long.*(Lower|Pont)/, 19:/^Long.*Lower Muted/,
  20:/^Legato$/, 21:/^Legato.*Alternative/, 22:/^Legato.*Octave$/, 23:/^Legato.*Octave Muted/,
  24:/^Legato.*Small/, 25:/^Legato.*Small Muted/, 26:/^Legato.*Muted$/, 27:/^Legato.*Soft/,
  28:/^Legato.*Hard/, 29:/^Legato.*Harmonic/, 30:/^Legato.*Tremolo/, 31:/^Legato.*(Slow|Portamento)/,
  32:/^Legato.*Fast/, 33:/^Legato.*Run/, 34:/^Legato.*D[ée]tach[ée]/, 35:/^Legato.*Higher/, 36:/^Legato.*Lower/,
  40:/^Short$/, 41:/^Short.*Alternative/, 42:/^Short.*Spiccato$/, 43:/^Short.*Spiccato Soft/,
  44:/^Short.*Staccato/, 45:/^Short.*Octave$/, 46:/^Short.*Octave Muted/, 47:/^Short.*Muted$/,
  48:/^Short.*Soft/, 49:/^Short.*Hard/, 50:/^Short.*Tenuto$/, 51:/^Short.*Tenuto Soft/,
  52:/^Short.*Marcato$/, 53:/^Short.*Marcato Soft/, 54:/^Short.*Marcato Hard/, 55:/^Short.*Marcato Long/,
  56:/^Short.*Pizzicato$/, 57:/^Short.*Bart[óo]k/, 58:/^Short.*Col Legno/, 59:/^Short.*Higher/,
  60:/^Short.*Lower/, 61:/^Short.*Harmonic/,
  70:/^Trill.*Minor 2nd/, 71:/^Trill.*Major 2nd/, 72:/^Trill.*Minor 3rd/, 73:/^Trill.*Major 3rd/,
  74:/^Trill.*Perfect 4th/, 75:/^Multitongue$/, 76:/^Multitongue.*Muted/,
  80:/^Synced.*120/, 81:/^Synced.*150/, 82:/^Synced.*180/,
  90:/^FX 1$/, 91:/^FX 2$/, 92:/^FX 3$/, 93:/^FX 4$/, 94:/^FX 5$/, 95:/^FX 6$/, 96:/^FX 7$/, 97:/^FX 8$/, 98:/^FX 9$/, 99:/^FX 10$/,
  100:/Up/, 101:/Down/, 102:/^Crescendo$/, 103:/^Decrescendo$/, 104:/^Arc/, 105:/^Slides$/,
  110:/^Disco Up/, 111:/^Disco Down/, 112:/^Single String/,
};

const r = await p.evaluate(() => {
  const names = { ...UACC_NAMES };
  const presets = Object.fromEntries(Object.entries(LIBRARY_PRESETS).map(([k,v]) => [k, { mode: v.roller_mode || 'cc', uacc: v.uacc_values || null }]));
  const dropdown = [...document.querySelectorAll('#uacc-preset-dropdown button')].map(el => el.getAttribute('onclick'));
  const templates = { ...UACC_TEMPLATES };
  const preview = name => {
    openLibraryPreview(name);
    const text = document.getElementById('library-preview-body')?.textContent || '';
    closeLibraryPreview?.();
    document.getElementById('library-preview-overlay').hidden = true;
    return text;
  };
  _openSections.clear(); _openSections.add('roller'); render();
  return {
    names, presets, templates,
    dropdown: [...document.querySelectorAll('#uacc-preset-dropdown button')].map(el => el.getAttribute('onclick')),
    uaccPreview: preview('Spitfire BBCSO'),
    ksPreview: preview('Sonuscore LUX — Violas'),
  };
});

const wrong = Object.entries(SPEC).filter(([v, re]) => !re.test(r.names[v] || '')).map(([v]) => `${v}=${r.names[v] || '∅'}`);
P('every UACC v2 value has its spec name', wrong.length === 0, wrong.join(', '));
const extra = Object.keys(r.names).filter(v => !SPEC[v]);
P('no names for values the spec leaves undefined', extra.length === 0, extra.join(', '));

const bogus = Object.keys(r.presets).filter(n => /\bEW\b|Hollywood|\bOT\b|Berlin|Kontakt Factory/.test(n));
P('no UACC presets for libraries without UACC support', bogus.length === 0, bogus.join(', '));
const offSpec = Object.entries(r.presets).filter(([, v]) => v.uacc).flatMap(([n, v]) => v.uacc.filter(x => !SPEC[x]).map(x => `${n}:${x}`));
P('built-in UACC presets use only spec values', offSpec.length === 0, offSpec.join(', '));
const uaccLibs = Object.entries(r.presets).filter(([, v]) => v.uacc);
P('every built-in UACC preset is a Spitfire library', uaccLibs.every(([n]) => /^Spitfire/.test(n)), uaccLibs.map(([n]) => n).join(', '));
const pizzFirst = uaccLibs.filter(([n]) => /Strings|BBCSO/.test(n)).every(([, v]) => v.uacc.includes(20) && v.uacc.includes(56) && !v.uacc.includes(43));
P('string presets reach legato at 20 and pizzicato at 56', pizzFirst, JSON.stringify(uaccLibs));

const dead = r.dropdown.map(s => /applyArticulationList\('(.+)'\)/.exec(s || '')?.[1]).filter(n => n && !r.presets[n]);
P('articulation dropdown lists only existing presets', dead.length === 0, dead.join(', '));
const tplOff = Object.entries(r.templates).flatMap(([n, vals]) => vals.filter(x => !SPEC[x]).map(x => `${n}:${x}`));
P('articulation templates use only spec values', tplOff.length === 0, tplOff.join(', '));
P('legato template holds only legato values', r.templates.legato?.every(v => /^Legato/.test(r.names[v] || '')), JSON.stringify(r.templates.legato));
P('shorts template holds only short values', r.templates.shorts?.every(v => /^Short/.test(r.names[v] || '')), JSON.stringify(r.templates.shorts));

P('UACC preset preview tells the composer to lock the plugin to UACC', /Locked to UACC/.test(r.uaccPreview), r.uaccPreview);
P('keyswitch preset preview does not mention UACC locking', !/Locked to UACC/.test(r.ksPreview), r.ksPreview);
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
