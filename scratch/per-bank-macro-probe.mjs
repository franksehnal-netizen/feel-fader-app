// Regression probe: the BUTTON long-press macro can be per-bank, with a
// "Global" checkbox collapsing all banks to one shared value. Transition
// rules matter more than the storage: turning Global ON adopts the currently
// displayed bank's macro (what you see stays), turning it OFF seeds every
// bank from the global value (nothing changes until you edit something).
// Spec: 2026-08-08-ui-backlog-design.md §D.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'networkidle0' });
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);

await p.evaluate(() => { skipWelcome(); });
await new Promise(r => setTimeout(r, 300));

const dflt = await p.evaluate(() => ({ global: cfg.macro_global, perBank: cfg.banks.map(x => x.macro_keys) }));
P('macro_global defaults to true', dflt.global === true, String(dflt.global));
P('every bank has a macro_keys array', dflt.perBank.every(Array.isArray), JSON.stringify(dflt.perBank));

const globalRead = await p.evaluate(() => {
  cfg.macro_global = true; cfg.macro_keys = [0xE0, 0x16];
  cfg.banks[0].macro_keys = [0x2C];
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('Global on: every bank reads the shared value',
  JSON.stringify(globalRead.b0) === JSON.stringify([224,22]) && JSON.stringify(globalRead.b1) === JSON.stringify([224,22]),
  JSON.stringify(globalRead));

const seeded = await p.evaluate(() => { selectBank(0); setMacroGlobal(false); return cfg.banks.map(x => x.macro_keys); });
P('Global off seeds every bank from the global value',
  seeded.every(k => JSON.stringify(k) === JSON.stringify([224,22])), JSON.stringify(seeded));

const perBank = await p.evaluate(() => {
  setActiveMacroKeys(1, [0x2C]);
  return { b0: activeMacroKeys(0), b1: activeMacroKeys(1) };
});
P('per-bank edit touches only that bank',
  JSON.stringify(perBank.b0) === JSON.stringify([224,22]) && JSON.stringify(perBank.b1) === JSON.stringify([44]),
  JSON.stringify(perBank));

const adopted = await p.evaluate(() => { selectBank(1); setMacroGlobal(true); return { keys: cfg.macro_keys, shown: activeMacroKeys(1) }; });
P('Global on adopts the displayed bank\'s macro',
  JSON.stringify(adopted.keys) === JSON.stringify([44]) && JSON.stringify(adopted.shown) === JSON.stringify([44]),
  JSON.stringify(adopted));

const empty = await p.evaluate(() => { setMacroGlobal(false); setActiveMacroKeys(0, []); return activeMacroKeys(0); });
P('empty per-bank macro stays empty (no fallback to global)', empty.length === 0, JSON.stringify(empty));

P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
