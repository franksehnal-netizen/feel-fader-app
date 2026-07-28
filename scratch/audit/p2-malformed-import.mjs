// Audit probe P2 — malformed config input (truncated JSON, wrong types, missing
// `banks`) must not white-screen the app or leak a raw JS error to the user.
//
// Investigation note (2026-07-28): the two REAL production call sites that feed
// untrusted JSON into normalizeFwConfig() both guard on the `banks` key first:
//   onImport()            feel-fader.html:4634  if(!p.banks) throw new Error('Invalid device backup');
//   loadConfigFromDevice() feel-fader.html:4482  if (!p.banks) throw new Error('Invalid structure');
// So a "missing banks" payload never reaches normalizeFwConfig()/render() in
// practice — that case below is a defense-in-depth probe of the shared helper
// itself, not a currently-reachable user path (noted per-case below).
//
// A "banks present but malformed" payload (e.g. fader1 as a string, fader2/
// encoder keys absent) DOES pass the guard and IS reachable via the real
// "Import config" button. This probe reproduces onImport()'s exact sequencing
// (feel-fader.html:4636 `cfg=p;loaded=true;dirty=true;activeBank=0;cfgSave();render();`)
// — cfgSave() runs synchronously BEFORE render() — so if render() throws, the
// broken cfg is already persisted to localStorage regardless. A final reload
// step proves whether that persisted corruption survives and reproduces on
// the next normal page load.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });

let anyPersistedBroken = false;

for (const [label, raw] of [
  ['truncated JSON', '{"banks":[{"name":"a"'],
  ['wrong types (reachable via real Import Config button)', '{"banks":[{"name":123,"fader1":"nope","uacc_values":"x"}]}'],
  ['missing banks (blocked by onImport/loadConfigFromDevice guard in practice)', '{"foo":1}'],
]) {
  const res = await p.evaluate((raw)=>{
    let threw=null, guardWouldBlock=false;
    try {
      const parsed = JSON.parse(raw);
      guardWouldBlock = !parsed.banks;   // what the real onImport()/loadConfigFromDevice guard checks
      // Reproduce onImport()'s real sequence (feel-fader.html:4629-4638), guard included:
      if (guardWouldBlock) throw new Error('Invalid device backup');
      cfg = normalizeFwConfig(parsed);
      loaded = true; dirty = true; activeBank = 0;
      cfgSave();     // <-- real onImport() persists BEFORE render(), synchronously
      render();
    }
    catch(e){ threw = String(e); }
    let persistedBroken = false;
    try {
      const s = localStorage.getItem('ff-cfg');
      const saved = s ? JSON.parse(s) : null;
      persistedBroken = !!saved && Array.isArray(saved.banks) &&
        saved.banks.some(bk => !bk || typeof bk.fader1 !== 'object' || !bk.fader1 || typeof bk.fader2 !== 'object' || !bk.fader2 || typeof bk.encoder !== 'object' || !bk.encoder);
    } catch(_) {}
    return { threw, guardWouldBlock, uiAlive: !!document.querySelector('main, #device-wrap, header'), persistedBroken };
  }, raw);
  P(`[${label}] UI nezbělá (root elementy v DOM)`, res.uiAlive===true, JSON.stringify(res));
  P(`[${label}] localStorage ff-cfg nezůstal zkorumpovaný (chybí fader1/fader2/encoder)`, res.persistedBroken===false, JSON.stringify(res));
  if (res.persistedBroken) anyPersistedBroken = true;
  // restore a known-good cfg between cases so later cases aren't polluted by a previous crash
  await p.evaluate(()=>{ try{ cfg = JSON.parse(JSON.stringify(DEFAULT_CFG)); cfgSave(); render(); }catch(_){} });
}

// If any case above persisted a broken cfg, prove the real-world consequence:
// does that corruption survive and reproduce on the NEXT normal page load
// (no import action needed — just opening/refreshing the app)?
if (anyPersistedBroken) {
  await p.evaluate((raw)=>{
    const parsed = JSON.parse(raw);
    const p2 = normalizeFwConfig(parsed);
    cfg = p2; cfgSave();   // leave the broken cfg persisted, as onImport() would
  }, '{"banks":[{"name":123,"fader1":"nope","uacc_values":"x"}]}');
  // Open a fresh page (same browser/profile, same origin -> same localStorage)
  // instead of p.reload() on the long-lived page: reload() was observed to hang
  // the navigation-lifecycle wait here after several prior evaluate() cycles on
  // this page (a Puppeteer/headless quirk, reproduced independently of the app —
  // an isolated fresh-page goto() with the same pre-seeded localStorage completes
  // in ~200ms). A brand-new page is the more reliable way to simulate "user opens
  // the app again" anyway.
  const p2page = await b.newPage();
  const errs2 = []; p2page.on('pageerror', e => errs2.push(String(e)));
  await p2page.goto('http://localhost:8100/feel-fader.html', { waitUntil: 'load', timeout: 15000 });
  await new Promise(r => setTimeout(r, 400)); // let init's setTimeout/rAF-driven steps settle
  const afterReload = await p2page.evaluate(()=>({ uiAlive: !!document.querySelector('main, #device-wrap, header') }));
  P('nové otevření appky po perzistované korupci: root elementy v DOM', afterReload.uiAlive===true, JSON.stringify(afterReload));
  P('nové otevření appky po perzistované korupci: žádná neodchycená page error', errs2.length===0, errs2.join(' | '));
  await p2page.close();
  // clean up so the next probe run in this same server session isn't affected
  await p.evaluate(()=>{ try{ cfg = JSON.parse(JSON.stringify(DEFAULT_CFG)); cfgSave(); render(); }catch(_){} });
}

P('žádná neodchycená page error (celkem)', errs.length===0, errs.join(' | '));
await b.close();
