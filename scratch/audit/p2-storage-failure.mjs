// Audit probe P2 — localStorage failure modes: (a) corrupted `ff-cfg` at boot,
// (b) setItem() throwing QuotaExceededError during cfgSave(). App must fall
// back gracefully (DEFAULT_CFG on boot; swallow the write error) with no crash.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
// (a) předplň korumpovaný ff-cfg PŘED načtením appky
await p.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ff-cfg','{ this is : not json'); }catch(e){} });
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const boot = await p.evaluate(()=>({ uiAlive: !!document.querySelector('main, header'), hasCfg: typeof cfg==='object' && Array.isArray(cfg.banks) }));
P('korumpovaný ff-cfg: appka nabootuje na fallback cfg', boot.uiAlive && boot.hasCfg, JSON.stringify(boot));

await p.evaluate(()=>{ skipWelcome(); });

// (b) QuotaExceeded při zápisu
const quota = await p.evaluate(()=>{
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = ()=>{ throw new DOMException('quota','QuotaExceededError'); };
  let threw=null; try{ cfgSave(); }catch(e){ threw=String(e); }
  Storage.prototype.setItem = orig;
  return { threw };
});
P('QuotaExceeded při cfgSave neshodí appku (chyba je odchycená)', quota.threw===null, JSON.stringify(quota));

// (b2) QuotaExceeded during cfgAutosave's debounced path (real user-facing trigger:
// any edit calls render() -> cfgAutosave() -> setTimeout(cfgSave, 400)) — confirm the
// deferred call is caught too, not just a direct cfgSave() call.
const quotaDeferred = await p.evaluate(()=>new Promise((resolve)=>{
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = ()=>{ throw new DOMException('quota','QuotaExceededError'); };
  window.addEventListener('error', function onErr(e){ window.removeEventListener('error', onErr); }, { once:true });
  let caughtByWindow = false;
  const prevOnError = window.onerror;
  window.onerror = () => { caughtByWindow = true; return true; };
  cfgAutosave();
  setTimeout(()=>{
    Storage.prototype.setItem = orig;
    window.onerror = prevOnError;
    resolve({ caughtByWindow });
  }, 600);
}));
P('QuotaExceeded v odloženém cfgAutosave()->cfgSave() neshodí appku', quotaDeferred.caughtByWindow===false, JSON.stringify(quotaDeferred));

P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
