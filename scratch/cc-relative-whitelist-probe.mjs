// SEC-004-class regression guard: roller_mode='cc_relative' must survive
// all 3 places that whitelist-check it, or it silently reverts to 'cc' on
// reload/import/preset-apply with no error shown. Spec §4.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });

const r = await p.evaluate(() => {
  skipWelcome();

  // Path 1: JSON backup import (app-shape banks, normalizeFwConfig branch A)
  const appShape = normalizeFwConfig({banks:[{
    fader1:{cc:11,channel:0}, fader2:{cc:1,channel:0}, encoder:{cc:40,channel:2},
    roller_mode:'cc_relative',
  }]});

  // Path 2: live device read (SysEx/serial, flat NVM shape, branch B)
  const deviceShape = normalizeFwConfig({banks:[{
    fader_cc:[11,1], fader_ch:[0,0], encoder:40, encoder_ch:2,
    roller_mode:'cc_relative',
  }]});

  // Path 3: custom preset apply (applyLibraryPreset, 'custom' branch)
  activeBank = 0;
  cfg.banks[0].roller_mode = 'cc';
  customLibraryPresets['__probe_cc_relative__'] = { custom:true, roller:{ roller_mode:'cc_relative' } };
  applyLibraryPreset('__probe_cc_relative__', 'all');
  const presetResult = cfg.banks[0].roller_mode;
  delete customLibraryPresets['__probe_cc_relative__'];

  // Bonus: cc_relative has nothing mode-specific to validate — an empty
  // uacc_values/ks_notes on a cc_relative bank must not raise a b0.uacc error.
  cfg.banks[0].roller_mode = 'cc_relative';
  cfg.banks[0].uacc_values = [];
  cfg.banks[0].ks_notes = [];
  const hasUaccError = validate().some(e => e.field === 'b0.uacc');

  return {
    appShapeMode: appShape.banks[0].roller_mode,
    deviceShapeMode: deviceShape.banks[0].roller_mode,
    presetResult,
    hasUaccError,
  };
});

P('normalizeFwConfig preserves cc_relative on app-shape (backup import) input', r.appShapeMode === 'cc_relative', JSON.stringify(r));
P('normalizeFwConfig preserves cc_relative on device-shape (SysEx/serial) input', r.deviceShapeMode === 'cc_relative', JSON.stringify(r));
P('applyLibraryPreset preserves cc_relative from a custom preset', r.presetResult === 'cc_relative', JSON.stringify(r));
P('an empty-list cc_relative bank raises no validation error', r.hasUaccError === false, JSON.stringify(r));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
