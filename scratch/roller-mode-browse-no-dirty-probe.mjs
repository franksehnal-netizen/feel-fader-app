// Regression probe (UX audit 2026-09-25, F-1): merely browsing roller modes
// must not create an unsaved change. Entering Keyswitch seeds a default range
// so the mode is usable, but leaving it untouched must restore the synced
// config. Any edit that returns the config to the synced state clears dirty.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?' – '+x:''}`);
const p = await b.newPage();
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil:'networkidle0' });
await p.evaluate(() => skipWelcome());

const r = await p.evaluate(() => {
  const out = { start: { dirty, items: configChangeItems() } };
  setRollerMode(0, 'keyswitch');
  out.inKs = { dirty, notes: [...(cfg.banks[0].ks_notes || [])] };
  setRollerMode(0, 'cc');
  out.back = { dirty, items: configChangeItems(), noteVisible: !!document.getElementById('send-change-note')?.classList.contains('is-visible') };
  setRollerMode(0, 'track_nav'); setRollerMode(0, 'keyswitch'); setRollerMode(0, 'cc_relative'); setRollerMode(0, 'cc');
  out.tour = { dirty, items: configChangeItems() };

  setRollerMode(0, 'keyswitch');
  cfg.banks[0].ks_notes = [24, 25, 26]; dirty = true; render();
  setRollerMode(0, 'cc');
  out.edited = { dirty, notes: [...cfg.banks[0].ks_notes] };
  setRollerMode(0, 'keyswitch'); cfg.banks[0].ks_notes = []; setRollerMode(0, 'cc');
  restoreSyncedConfig();

  stepCtrl(0, 'fader1', 'cc', 1);
  out.stepUp = dirty;
  stepCtrl(0, 'fader1', 'cc', -1);
  out.stepBack = { dirty, items: configChangeItems() };
  return out;
});
P('clean start', r.start.dirty === false && r.start.items.length === 0, JSON.stringify(r.start));
P('entering Keyswitch seeds the default C-2..B-2 range and is a real change', r.inKs.dirty === true && r.inKs.notes.join() === '0,1,2,3,4,5,6,7,8,9,10,11', JSON.stringify(r.inKs));
P('Keyswitch and back leaves no unsaved change', r.back.dirty === false && r.back.items.length === 0 && r.back.noteVisible === false, JSON.stringify(r.back));
P('touring all roller modes and back leaves no unsaved change', r.tour.dirty === false && r.tour.items.length === 0, JSON.stringify(r.tour));
P('an edited keyswitch range survives leaving the mode', r.edited.dirty === true && r.edited.notes.join() === '24,25,26', JSON.stringify(r.edited));
P('a CC step and its reverse leaves no unsaved change', r.stepUp === true && r.stepBack.dirty === false && r.stepBack.items.length === 0, JSON.stringify(r));
await p.close();
await b.close();
