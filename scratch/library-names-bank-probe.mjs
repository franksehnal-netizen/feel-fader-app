// Regression probe (UX audit 2026-09-25, C-4): applying a library to a bank
// that still has its default "Bank N" name renames it after the library, so
// the composer cycling banks on the device knows "bank 2 = BBCSO". Names the
// composer chose are never touched, and the preview says what will happen.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' — '+x:''}`);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(() => {
  const out = {};
  const reset = name => { activeBank = 0; cfg.banks[0].name = name; render(); };
  const previewText = name => {
    openLibraryPreview(name);
    const text = document.getElementById('library-preview-body')?.textContent || '';
    closeLibraryPreview(false);
    return text;
  };

  reset('Bank 1');
  out.previewDefault = previewText('Spitfire BBCSO');
  applyLibraryPreset('Spitfire BBCSO');
  out.afterAll = cfg.banks[0].name;
  undoLastConfigChange();
  out.afterUndo = cfg.banks[0].name;

  reset('Bank 3');   // default name that no longer matches its position
  applyLibraryPreset('Sonuscore LUX — Violins 1', 'articulations');
  out.afterArticulations = cfg.banks[0].name;

  reset('My Strings');
  out.previewCustomName = previewText('Spitfire BBCSO');
  applyLibraryPreset('Spitfire BBCSO');
  out.keptCustom = cfg.banks[0].name;

  const longName = 'Film Strings Legato Template XL';
  customLibraryPresets[longName] = { custom: true, articulations: { uacc_values: [20, 1] } };
  reset('Bank 1');
  applyLibraryPreset(longName);
  out.fromMySetup = cfg.banks[0].name;
  delete customLibraryPresets[longName];

  out.builtInNames = Object.entries(LIBRARY_PRESETS).map(([n, v]) => [n, v.bank_name]);
  return out;
});

P('default-named bank takes the library name', r.afterAll === 'BBCSO', r.afterAll);
P('undo restores the default name', r.afterUndo === 'Bank 1', r.afterUndo);
P('articulations-only apply also names a default bank', r.afterArticulations === 'LUX Violins 1', r.afterArticulations);
P('a name the composer chose is kept', r.keptCustom === 'My Strings', r.keptCustom);
P('my setup names the bank after itself within the 24-char limit', r.fromMySetup === 'Film Strings Legato Temp', r.fromMySetup);
P('preview announces the rename for a default-named bank', /Bank name\s*Bank 1 → BBCSO/.test(r.previewDefault), r.previewDefault);
P('preview does not announce a rename for a custom-named bank', !/Bank name/.test(r.previewCustomName), r.previewCustomName);
const bad = r.builtInNames.filter(([, bn]) => !bn || bn.length > 24);
P('every built-in library has a bank name of at most 24 chars', bad.length === 0, JSON.stringify(bad));
P('no page errors', errs.length === 0, errs.join(' | '));
await p.close();
await b.close();
