# Feel Fader Launch Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provést první ostrý běh pre-launch auditu Feel Fader appky (6 pilířů) a zanechat znovupoužitelný blueprint + report s go/no-go verdiktem, každý potvrzený nález zamčený committed probem.

**Architecture:** Report-first audit. Statický grep pass najde kandidáty → live puppeteer probe / network trace / perf probe potvrdí a změří → potvrzené nálezy se zapíšou do reportu se severity a zamknou probem asertujícím *bezpečné* chování (FAIL = nález přítomen). Security nálezy nezávisle cross-checkne Codex. Opravy neproběhnou — pouze report + verdikt.

**Tech Stack:** Vanilla JS single-file app (`feel-fader.html`), `puppeteer-core` + headless Chrome (probes), Node stdlib http server (:8100), Codex rescue subagent, volitelně `npx lighthouse`.

## Global Constraints

- **Report-first:** žádná oprava `feel-fader.html` během auditu. Audit jen nachází, měří, dokumentuje. Fix loop je samostatná fáze po Frankově odsouhlasení.
- **MCP/HW invariant:** automatizace nikdy nesahá na reálný Feel Fader hardware. Live testy jedou přes interní-stav-poke (`skipWelcome(); _ffConnected=true; _serialPort={}; DEVICE_INFO.*; renderConnState();` přes `evaluate`), nikdy `navigator.serial.requestPort()` + SysEx.
- **Audit probes izolované:** audit probes žijí v `scratch/audit/` a běží vlastním runnerem `scratch/audit/run-audit-probes.mjs`. **Neregistrovat** je do `scratch/run-all-probes.mjs` (ten drží zelenou regresní suitu; audit probe asertující safe behavior u přítomného nálezu FAILuje záměrně a nesmí shodit `npm test`).
- **Probe harness vzor** (verbatim z existujících probes): `puppeteer-core` přes `createRequire`, `executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'`, `headless:true, pipe:true, args:['--no-sandbox']`, `goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'})`, `P=(l,ok,x='')=>console.log(\`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}\`)`.
- **Severity + gate** (ze spec): Critical / High / Medium / Low. Gate blokuje launch na jakémkoli otevřeném Critical, nebo High v Security/Stabilitě.
- **Deploy URL** čti při běhu z memory `reference_feelfader_demo_deploy` — v plánu značeno `<DEMO_URL>`.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commituj po každém tasku.
- Spec: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`.

---

## File Structure

- `docs/feel-fader-launch-audit-blueprint.md` — znovupoužitelný blueprint (Task 1)
- `docs/feel-fader-launch-audit-2026-07-28.md` — first-run report, plněný per pilíř (Task 2 skeleton, Tasks 3–10 obsah)
- `scratch/audit/run-audit-probes.mjs` — runner + static server pro audit probes (Task 2)
- `scratch/audit/p1-*.mjs … p6-*.mjs` — per-pilíř probes (Tasks 3–8)

---

## Task 1: Reusable blueprint document

**Files:**
- Create: `docs/feel-fader-launch-audit-blueprint.md`

**Interfaces:**
- Produces: znovupoužitelný audit postup, na který se odkazuje report i budoucí launche.

- [ ] **Step 1: Napiš blueprint z spec**

Přepiš spec sekce „Metoda", „Severity model", „Go/no-go gate", „Šest pilířů", „Průběh prvního běhu" do samostatného dokumentu psaného jako *návod ke spuštění* (imperativ: „Spusť grep …", „Otevři …"), ne jako design. Přidej na začátek:

```markdown
# Feel Fader — Launch Audit Blueprint

> Spusť tenhle postup před každým veřejným launchem `feel-fader.html`.
> Report ulož jako `docs/feel-fader-launch-audit-<YYYY-MM-DD>.md`.
> Design a zdůvodnění: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`.

## Jak spustit
1. Server: `node scratch/audit/run-audit-probes.mjs` (spustí :8100 + audit probes).
2. Pro každý pilíř P1–P6 proveď jeho checks (níže), zapiš nálezy do reportu.
3. Security nálezy nech cross-checknout Codexem (`codex:rescue`).
4. Aplikuj go/no-go gate, zapiš verdikt.
```

Každý pilíř dostane sekci s: **Co kontrolovat**, **Jak (přesné grep/probe/příkaz)**, **Důkaz**. Obsah zkopíruj ze spec pilířů, ale doplň konkrétní grep vzory z Tasků 3–8 tohoto plánu (např. `grep -nE "innerHTML|insertAdjacentHTML|outerHTML|document\.write"`).

- [ ] **Step 2: Ověř úplnost**

Run: `grep -c "^### P" docs/feel-fader-launch-audit-blueprint.md`
Expected: `6` (všech šest pilířů má sekci).

- [ ] **Step 3: Commit**

```bash
git add docs/feel-fader-launch-audit-blueprint.md
git commit -m "docs: add reusable Feel Fader launch audit blueprint"
```

---

## Task 2: Audit probe runner + report skeleton

**Files:**
- Create: `scratch/audit/run-audit-probes.mjs`
- Create: `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Produces: `run-audit-probes.mjs` startuje static server na :8100 a spouští každý probe v `AUDIT_PROBES`, agreguje PASS/FAIL (stejný kontrakt jako `scratch/run-all-probes.mjs`). Report skeleton má sekci na pilíř + tabulku nálezů + placeholder verdiktu.

- [ ] **Step 1: Napiš audit runner**

Zkopíruj strukturu `scratch/run-all-probes.mjs` (server na PORT 8100, `startServer`, `runProbe`, agregace), ale `__dirname`/root uprav na dvě úrovně (`path.resolve(__dirname,'..','..')`) a `AUDIT_PROBES` nech prázdné pole s komentářem „naplní Tasky 3–8":

```js
// Runs audit probes (scratch/audit/) against a throwaway :8100 static server.
// Separate from run-all-probes.mjs on purpose: report-first audit probes assert
// SAFE behavior, so a probe FAILs where a finding is present — that must NOT
// break the green regression suite (npm test). Migrate a probe into
// run-all-probes.mjs only after its finding is fixed.
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url'; import { spawn } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const PORT = 8100;
const AUDIT_PROBES = [ /* filled by Tasks 3–8 */ ];
function startServer(){return new Promise((resolve)=>{const s=http.createServer((req,res)=>{const rp=req.url==='/'?'/feel-fader.html':req.url.split('?')[0];fs.readFile(path.join(root,decodeURIComponent(rp)),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':rp.endsWith('.html')?'text/html':'application/octet-stream'});res.end(d);});});s.listen(PORT,()=>resolve(s));});}
function runProbe(name){return new Promise((resolve)=>{const c=spawn(process.execPath,[path.join(__dirname,name)],{cwd:root});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>resolve({name,code,out}));});}
const server=await startServer();let tp=0,tf=0,crashed=[];
for(const probe of AUDIT_PROBES){const{code,out}=await runProbe(probe);const pass=(out.match(/^\s*PASS /gm)||[]).length;const fail=(out.match(/^\s*FAIL /gm)||[]).length;tp+=pass;tf+=fail;if(pass===0&&fail===0){crashed.push(probe);console.log(`CRASH ${probe} (exit ${code})`);console.log(out.split('\n').slice(0,8).join('\n'));}else{console.log(`${fail===0?'ok  ':'FAIL'} ${probe} — ${pass} pass, ${fail} fail`);}}
server.close();console.log(`\n${tp} passed, ${tf} failed, ${crashed.length} crashed (${AUDIT_PROBES.length} probes)`);
```

(Bez `process.exit(1)` — u auditu je FAIL očekávaný signál nálezu, ne chyba běhu.)

- [ ] **Step 2: Ověř, že runner běží naprázdno**

Run: `node scratch/audit/run-audit-probes.mjs`
Expected: `0 passed, 0 failed, 0 crashed (0 probes)` a proces skončí sám (server se zavře).

- [ ] **Step 3: Napiš report skeleton**

```markdown
# Feel Fader — Launch Audit Report (2026-07-28)

Blueprint: `docs/feel-fader-launch-audit-blueprint.md` · Spec: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`
Audit commitu: <git rev-parse --short HEAD při běhu> · Demo: <DEMO_URL>

## Souhrn nálezů

| ID | Pilíř | Severity | Nález | Probe | Stav |
|----|-------|----------|-------|-------|------|
| _(plní pilíře)_ | | | | | |

## P1 Security
## P2 Stabilita
## P3 Privacy/GDPR
## P4 Browser kompatibilita
## P5 Výkon / dlouhá session
## P6 Deploy hygiena

## Go/no-go verdikt
_(Task 10)_
```

Každý pilíř sekce zatím prázdná (plní Tasky 3–8). Formát nálezu v každé sekci: `**[ID] Severity — název.** Zdroj (grep/probe). Důkaz. Návrh opravy.`

- [ ] **Step 4: Commit**

```bash
git add scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "chore: scaffold launch audit runner and report skeleton"
```

---

## Task 3: P1 Security

**Files:**
- Create: `scratch/audit/p1-xss-config-import.mjs`
- Create: `scratch/audit/p1-proto-pollution.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs` (přidat oba do `AUDIT_PROBES`)
- Modify: `docs/feel-fader-launch-audit-2026-07-28.md` (sekce P1)

**Interfaces:**
- Consumes: `run-audit-probes.mjs` server (:8100), poke vzor.
- Produces: nálezy P1-x v reportu; seznam DOM-sink lokací pro Codex cross-check (Task 9).

- [ ] **Step 1: Statický pass — DOM sinky a untrusted zdroje**

Run:
```bash
grep -nE "innerHTML|insertAdjacentHTML|outerHTML|document\.write|\.срmaster" feel-fader.html   # sinky
grep -nE "JSON\.parse|localStorage\.getItem|new Function|\beval\(" feel-fader.html               # untrusted parse
```
U každého `innerHTML`/`insertAdjacentHTML` výskytu zjisti, zda do něj teče uživatelský řetězec (jméno banku `m.n`, label `m.l`, ikona, název presetu, `uaccName`). Kandidáty vypiš do reportu s číslem řádku.

- [ ] **Step 2: Napiš XSS probe (asertuje bezpečné chování)**

`scratch/audit/p1-xss-config-import.mjs` — importuje config s XSS payloadem v jméně banku i labelu, vyrenderuje a asertuje, že se žádný skript nespustil a payload je escapovaný text:

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; const alerts=[];
p.on('pageerror',e=>errs.push(String(e)));
p.on('dialog', async d=>{ alerts.push(d.message()); await d.dismiss(); }); // alert() z XSS by se chytil sem
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
await new Promise(r=>setTimeout(r,300));
const res = await p.evaluate(async ()=>{
  window.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  const evil = { banks:[{ name:payload, icon:payload, fader1:{cc:1,channel:0,label:payload}, fader2:{cc:2,channel:0,label:'x'}, encoder:{cc:32,channel:0}, uacc_values:[1] }] };
  // Projdi skutečnou import cestou appky (onImport / importP), ne přímým přiřazením:
  cfg = normalizeFwConfig ? normalizeFwConfig(evil) : evil;
  cfgSave(); render();
  await new Promise(r=>setTimeout(r,100));
  return { xss: window.__xss, bodyHasRawImg: /<img[^>]+onerror/i.test(document.body.innerHTML) };
});
P('onerror payload se nespustil (window.__xss=false)', res.xss===false, JSON.stringify(res));
P('žádný alert()/dialog z injektovaného skriptu', alerts.length===0, alerts.join(' | '));
P('payload není v DOM jako živý <img onerror>', res.bodyHasRawImg===false, JSON.stringify(res));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

> Pozn.: pokud appka nemá programově volatelnou import funkci (jen `<input type=file>` handler), použij v probe stejnou transformační cestu, kterou handler volá (`normalizeFwConfig`/`onImport` interní část). Cíl: projít reálnou render cestou, ne obejít ji.

- [ ] **Step 3: Napiš prototype-pollution probe**

`scratch/audit/p1-proto-pollution.mjs` — importuje JSON s `__proto__` klíčem a asertuje, že se neznečistil `Object.prototype`:

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
const res = await p.evaluate(()=>{
  const evil = '{"__proto__":{"polluted":true},"banks":[]}';
  const parsed = JSON.parse(evil);
  try { cfg = normalizeFwConfig ? normalizeFwConfig(parsed) : parsed; } catch(e){}
  return { polluted: ({}).polluted === true };
});
P('Object.prototype není znečištěn po importu', res.polluted===false, JSON.stringify(res));
P('no page errors', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 4: Spusť oba probes**

Přidej `'p1-xss-config-import.mjs'`, `'p1-proto-pollution.mjs'` do `AUDIT_PROBES`.
Run: `node scratch/audit/run-audit-probes.mjs`
Expected: proběhnou; PASS = clean, FAIL = potvrzený nález. Zaznamenej výsledek.

- [ ] **Step 5: Zapiš nálezy P1 do reportu**

Pro každý FAIL: řádek do souhrnné tabulky (`P1-1 | Security | <severity> | <název> | p1-*.mjs | Open`) + odstavec v sekci P1 se severity dle modelu (živý XSS = Critical), grep/probe důkazem a návrhem opravy (např. „render `m.n` přes `textContent`, ne `innerHTML`"). Přidej i CSP zjištění (grep `Content-Security-Policy` v HTML `<meta>` → chybí-li, Medium hardening nález).

- [ ] **Step 6: Commit**

```bash
git add scratch/audit/p1-*.mjs scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p1): security — XSS/proto-pollution probes + findings"
```

---

## Task 4: P2 Stabilita

**Files:**
- Create: `scratch/audit/p2-malformed-import.mjs`
- Create: `scratch/audit/p2-storage-failure.mjs`
- Create: `scratch/audit/p2-serial-robustness.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs`, `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Consumes: server, poke vzor, `serialRequest`/`_readReply`/`_txnChain`, `normalizeFwConfig`, `cfgLoad`.
- Produces: nálezy P2-x.

- [ ] **Step 1: Statický pass**

Run:
```bash
grep -nE "addEventListener\('(error|unhandledrejection)'" feel-fader.html   # global guardy
grep -nE "try\s*\{|catch\s*\(" feel-fader.html | wc -l                       # hustota error handlingu
grep -nE "JSON\.parse|localStorage\.(get|set)Item" feel-fader.html
```
Zaznamenej, zda existuje globální `error`/`unhandledrejection` handler a zda `cfgLoad` obaluje `JSON.parse` v try/catch.

- [ ] **Step 2: Malformed-import probe**

`scratch/audit/p2-malformed-import.mjs` — projde třemi vadnými vstupy (oříznutý JSON, špatné typy, chybějící `banks`) a asertuje, že appka nezbělá (root UI stále v DOM) a neleakne raw JS chybu uživateli:

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
for (const [label, raw] of [
  ['truncated JSON', '{"banks":[{"name":"a"'],
  ['wrong types', '{"banks":[{"name":123,"fader1":"nope","uacc_values":"x"}]}'],
  ['missing banks', '{"foo":1}'],
]) {
  const res = await p.evaluate((raw)=>{
    let threw=null;
    try { const parsed = JSON.parse(raw); cfg = normalizeFwConfig ? normalizeFwConfig(parsed) : parsed; render(); }
    catch(e){ threw = String(e); }
    return { threw, uiAlive: !!document.querySelector('main, #device-wrap, header') };
  }, raw);
  P(`[${label}] UI nezbělá (root elementy v DOM)`, res.uiAlive===true, JSON.stringify(res));
}
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 3: Storage-failure probe**

`scratch/audit/p2-storage-failure.mjs` — (a) korupce `ff-cfg` (nevalidní JSON) při startu, (b) `setItem` házející QuotaExceededError. Asertuje graceful fallback na `DEFAULT_CFG` a žádný crash:

```js
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
// (b) QuotaExceeded při zápisu
const quota = await p.evaluate(()=>{
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = ()=>{ throw new DOMException('quota','QuotaExceededError'); };
  let threw=null; try{ cfgSave(); }catch(e){ threw=String(e); }
  Storage.prototype.setItem = orig;
  return { threw };
});
P('QuotaExceeded při cfgSave neshodí appku (chyba je odchycená)', quota.threw===null, JSON.stringify(quota));
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 4: Serial-robustness probe**

`scratch/audit/p2-serial-robustness.mjs` — nastrč fake serial transport, který vrací `ERR:` frame, stale `rid`, a nikdy neodpoví (timeout). Asertuje, že `serialRequest`/`_readReply` každý případ vyřeší (reject/timeout) bez zaseknutí `_txnChain` a bez page error. Přesné háky (`serialRequest`, `_readReply`, `_serialEnsureOpen`, `protocolVersion`) ověř greppem v `feel-fader.html` a probe napiš proti reálným jménům; drž se poke vzoru (`_serialPort={}`), reálný port neotvírej.

```js
// Skeleton — konkrétní stub dolaď podle skutečné signatury serialRequest/_readReply.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
const res = await p.evaluate(async ()=>{
  const out = {};
  // ERR frame → serialRequest musí rejectnout, ne viset
  // (dolaď dle reálného transportu: přepiš čtecí vrstvu tak, aby vrátila 'ERR:rid:boom')
  try { /* wire ERR reply, then: */ await serialRequest('CMD_R', null, 500); out.err='resolved-unexpected'; }
  catch(e){ out.err='rejected'; }
  // timeout → do 600 ms reject, ne trvalé zaseknutí
  const t0=Date.now();
  try { await serialRequest('CMD_R', null, 300); out.timeout='resolved'; }
  catch(e){ out.timeout='rejected'; }
  out.timeoutMs = Date.now()-t0;
  return out;
});
P('ERR frame → serialRequest rejectuje', res.err==='rejected', JSON.stringify(res));
P('timeout → serialRequest rejectuje v čase (ne zaseknutí _txnChain)', res.timeout==='rejected' && res.timeoutMs < 2000, JSON.stringify(res));
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 5: Spusť probes, zapiš nálezy, přidej do `AUDIT_PROBES`**

Run: `node scratch/audit/run-audit-probes.mjs`. Zaznamenej PASS/FAIL. Každý FAIL → řádek tabulky + odstavec P2 se severity (white-screen na běžné cestě = Critical; pád na malformed vstupu = High; zaseknutý `_txnChain` = High).

- [ ] **Step 6: Commit**

```bash
git add scratch/audit/p2-*.mjs scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p2): stability — malformed input, storage, serial probes + findings"
```

---

## Task 5: P3 Privacy / GDPR

**Files:**
- Create: `scratch/audit/p3-external-requests.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs`, `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Consumes: server (:8100).
- Produces: nález P3-x (externí hosty, GDPR expozice).

- [ ] **Step 1: External-requests probe (network trace)**

`scratch/audit/p3-external-requests.mjs` — zapni request interception, načti stránku, projdi welcome i skip cestu, seber všechny requesty na cizí hosty (mimo `localhost`):

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage();
const external = new Set();
p.on('request', req => { try { const h = new URL(req.url()).host; if (!/^localhost(:\d+)?$/.test(h) && !req.url().startsWith('data:')) external.add(h); } catch(e){} });
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{ skipWelcome(); });
await new Promise(r=>setTimeout(r,500));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const hosts=[...external];
console.log('EXTERNAL HOSTS: '+JSON.stringify(hosts));
P('žádné neočekávané externí hosty (jen fonts.* pokud vůbec)', hosts.every(h=>/fonts\.(googleapis|gstatic)\.com$/.test(h)), JSON.stringify(hosts));
P('zcela bez externích requestů (ideál po self-hostu fontů)', hosts.length===0, JSON.stringify(hosts));
await b.close();
```

(Druhý řádek je záměrně přísnější „ideál" — FAIL dokud fonty nejsou self-hostované; slouží jako GDPR nález, ne jako blocker.)

- [ ] **Step 2: Ověř localStorage bez PII**

Run: `grep -nE "localStorage\.setItem" feel-fader.html` — potvrď, že ukládané klíče jsou jen `ff-*` (config/preference), žádný e-mail/jméno/IP. Zaznamenej do reportu.

- [ ] **Step 3: Spusť probe, zapiš nález, přidej do `AUDIT_PROBES`**

Run: `node scratch/audit/run-audit-probes.mjs`. Google Fonts host přítomen → `P3-1 | Privacy | Medium/High | Únik IP EU uživatele Googlu přes Google Fonts | p3-external-requests.mjs | Open`, návrh opravy = self-host fontů (odstraní jediný consent trigger).

- [ ] **Step 4: Commit**

```bash
git add scratch/audit/p3-external-requests.mjs scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p3): privacy — external request trace + GDPR finding"
```

---

## Task 6: P4 Browser kompatibilita / graceful degradation

**Files:**
- Create: `scratch/audit/p4-no-webserial-degradation.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs`, `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Consumes: server, `doSend`, `_serialEnsureOpen`, welcome cesta.
- Produces: nález P4-x.

> Pozn.: `send-without-web-serial-probe.mjs` už pokrývá `doSend` bez `navigator.serial`. Tento probe cílí na **první dojem** — co uvidí Safari/Firefox uživatel na welcome/connect, ne až při Send.

- [ ] **Step 1: Degradation probe**

`scratch/audit/p4-no-webserial-degradation.mjs` — smaž `navigator.serial` i `navigator.requestMIDIAccess` PŘED loadem, načti appku a asertuj čistou hlášku o nepodporovaném prohlížeči (ne mrtvé UI, ne raw chyba):

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.evaluateOnNewDocument(()=>{
  try { Object.defineProperty(navigator,'serial',{value:undefined,configurable:true}); } catch(e){}
  try { navigator.requestMIDIAccess = undefined; } catch(e){}
});
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const res = await p.evaluate(()=>{
  const text = document.body.innerText;
  return {
    uiAlive: !!document.querySelector('main, #welcome-screen, header'),
    mentionsBrowser: /chrome|edge|not supported|unsupported|nepodporov/i.test(text),
  };
});
P('UI žije i bez Web Serial/MIDI (žádná mrtvá stránka)', res.uiAlive===true, JSON.stringify(res));
P('uživatel dostane čitelnou hlášku o prohlížeči', res.mentionsBrowser===true, JSON.stringify(res));
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: Spusť, zapiš, přidej do `AUDIT_PROBES`**

Run: `node scratch/audit/run-audit-probes.mjs`. FAIL na druhém asertu (chybí hláška) = `P4-1 | Browser | High | Safari/Firefox uživatel bez vodítka | p4-*.mjs | Open`, návrh = feature-detect + banner „Use Chrome/Edge".

- [ ] **Step 3: Commit**

```bash
git add scratch/audit/p4-no-webserial-degradation.mjs scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p4): browser compat — unsupported-browser degradation probe + finding"
```

---

## Task 7: P5 Výkon / dlouhá session

**Files:**
- Create: `scratch/audit/p5-heap-growth.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs`, `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Consumes: server, `render`, `onMidiMsg`, `selectBank`.
- Produces: nález P5-x + perf čísla.

- [ ] **Step 1: Heap-growth probe (memory leak / long session)**

`scratch/audit/p5-heap-growth.mjs` — změř JS heap, prožeň mnoho render/bank-switch cyklů + simulovaný MIDI churn, znovu změř; asertuj, že heap neroste neúměrně (proxy na leaknuté listenery/detached nodes):

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, pipe:true, args:['--no-sandbox','--js-flags=--expose-gc'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8100/feel-fader.html',{waitUntil:'networkidle0'});
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
await p.evaluate(()=>{ skipWelcome(); });
const measure = async ()=>{ await p.evaluate(()=>{ if(window.gc) window.gc(); }); const m = await p.metrics(); return m.JSHeapUsedSize; };
const before = await measure();
const listenersBefore = await p.evaluate(()=>document.querySelectorAll('*').length);
await p.evaluate(async ()=>{
  for (let i=0;i<300;i++){
    render();
    if (typeof selectBank==='function') selectBank(i % (cfg.banks.length||1));
    if (typeof onMidiMsg==='function') onMidiMsg({ data:new Uint8Array([0xB0, 11, i%127]) });
  }
});
await new Promise(r=>setTimeout(r,300));
const after = await measure();
const nodesAfter = await p.evaluate(()=>document.querySelectorAll('*').length);
const growthMB = (after-before)/1048576;
const nodeGrowth = nodesAfter - listenersBefore;
console.log(`HEAP before=${(before/1048576).toFixed(1)}MB after=${(after/1048576).toFixed(1)}MB Δ=${growthMB.toFixed(1)}MB; DOM nodes Δ=${nodeGrowth}`);
P('heap po 300 cyklech neroste přes 10 MB', growthMB < 10, `Δ=${growthMB.toFixed(1)}MB`);
P('DOM nodes po 300 render cyklech nerostou (< 200)', nodeGrowth < 200, `Δ=${nodeGrowth}`);
P('žádná neodchycená page error', errs.length===0, errs.join(' | '));
await b.close();
```

- [ ] **Step 2: (Volitelně) Lighthouse rychlé číslo**

Run (mimo audit runner, potřebuje běžící server): `npx lighthouse http://localhost:8100/feel-fader.html --only-categories=performance --quiet --chrome-flags="--headless" --output=json --output-path=scratch/audit/lighthouse-perf.json 2>/dev/null; node -e "console.log('perf', require('./scratch/audit/lighthouse-perf.json').categories.performance.score)"`
Zaznamenej perf skóre a `first-contentful-paint`/`interactive` do reportu jako číslo (ne blocker). Pokud `npx lighthouse` není dostupné offline, vynech a spolehni se na heap probe + `p.metrics()`.

- [ ] **Step 3: Spusť heap probe, zapiš, přidej do `AUDIT_PROBES`**

Run: `node scratch/audit/run-audit-probes.mjs`. FAIL na heap/node growth = `P5-1 | Výkon | Medium | Leak listenerů/nodes v render loopu | p5-heap-growth.mjs | Open`. Perf skóre a heap čísla vlož do sekce P5.

- [ ] **Step 4: Commit**

```bash
git add scratch/audit/p5-heap-growth.mjs scratch/audit/run-audit-probes.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p5): performance — heap growth probe + perf numbers"
```

---

## Task 8: P6 Deploy hygiena / co je opravdu venku

**Files:**
- Create: `scratch/audit/p6-deploy-hygiene.mjs`
- Modify: `scratch/audit/run-audit-probes.mjs`, `docs/feel-fader-launch-audit-2026-07-28.md`

**Interfaces:**
- Consumes: `<DEMO_URL>` z memory `reference_feelfader_demo_deploy`.
- Produces: nález P6-x.

> Tento probe cílí na **živé demo**, ne na localhost. Neběží nutně přes audit runner — je to samostatný fetch skript. Přidej ho do `AUDIT_PROBES` jen pokud demo funguje bez lokálního serveru (fetch absolutní URL).

- [ ] **Step 1: Přečti demo URL**

Přečti memory `reference_feelfader_demo_deploy`, vytáhni `<DEMO_URL>` (a base host). Zapiš do hlavičky reportu.

- [ ] **Step 2: Deploy-hygiene probe**

`scratch/audit/p6-deploy-hygiene.mjs` — fetchni hlavní stránku (hlavičky), pak zkus citlivé cesty a asertuj 404/nedostupnost:

```js
// Nahraď BASE reálným <DEMO_URL> base hostem z reference_feelfader_demo_deploy.
const BASE = 'https://<DEMO_HOST>';
const P=(l,ok,x='')=>console.log(`${ok?'PASS':'FAIL'}  ${l}${x?'  — '+x:''}`);
const main = await fetch(BASE + '/feel-fader.html');
const h = main.headers;
console.log('HEADERS: '+JSON.stringify(Object.fromEntries(h.entries())));
P('HTTPS + 200 na hlavní stránce', main.ok && BASE.startsWith('https://'), String(main.status));
P('X-Content-Type-Options: nosniff', h.get('x-content-type-options')==='nosniff', h.get('x-content-type-options')||'chybí');
P('má nějaké Referrer-Policy', !!h.get('referrer-policy'), h.get('referrer-policy')||'chybí');
P('má Content-Security-Policy header nebo <meta>', !!h.get('content-security-policy'), h.get('content-security-policy')||'chybí (ověř i <meta> v HTML)');
const body = await main.text();
P('žádné zjevné secrets v HTML', !/(api[_-]?key|secret|token|-----BEGIN)/i.test(body), 'grep hit — prověřit');
for (const path of ['/.git/config','/.superpowers/','/scratch/','/docs/','/package.json','/node_modules/']) {
  const r = await fetch(BASE + path).catch(()=>({status:'neterr',ok:false}));
  P(`citlivá cesta ${path} nedostupná (404/403/neterr)`, !r.ok, 'status '+r.status);
}
```

- [ ] **Step 3: Spusť probe**

Run: `node scratch/audit/p6-deploy-hygiene.mjs` (samostatně, cílí na internet). Zaznamenej každý FAIL jako P6 nález se severity (leaklý `/.git/` nebo secret = Critical; chybějící security header = Medium).

- [ ] **Step 4: Zapiš nálezy + commit**

```bash
git add scratch/audit/p6-deploy-hygiene.mjs docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit(p6): deploy hygiene — live demo header/path probe + findings"
```

---

## Task 9: Codex cross-check na Security nálezy

**Files:**
- Modify: `docs/feel-fader-launch-audit-2026-07-28.md` (sekce P1 — doplnit Codex verdikt)

**Interfaces:**
- Consumes: P1 nálezy + DOM-sink seznam z Tasku 3, relevantní řezy `feel-fader.html`.
- Produces: nezávislé potvrzení/vyvrácení P1 nálezů + případné nové.

- [ ] **Step 1: Dispatchni Codex rescue na security review**

Přes `codex:rescue` (agent `codex:codex-rescue`) předej: (a) seznam DOM-sink lokací a untrusted zdrojů z Tasku 3, (b) konkrétní řezy `feel-fader.html` kolem každého `innerHTML`/`JSON.parse` výskytu, (c) otázku: „Nezávisle ověř tyto XSS / prototype-pollution / injection nálezy a najdi, co jsme minuli. Report-only, neopravuj." Poskytni Codexu jen čtení, žádné zápisy.

- [ ] **Step 2: Reconciliuj do reportu**

Do sekce P1 přidej pod-blok „Codex cross-check": potvrzené nálezy (✓), vyvrácené (s důvodem), nové nálezy od Codexu (přidej řádek do souhrnné tabulky + probe pokud se dá zamknout). Konflikty (my vs Codex) vyřeš čtením kódu, ne hlasováním — zapiš rozhodnutí.

- [ ] **Step 3: Commit**

```bash
git add docs/feel-fader-launch-audit-2026-07-28.md scratch/audit/
git commit -m "audit(p1): reconcile Codex security cross-check into report"
```

---

## Task 10: Go/no-go verdikt

**Files:**
- Modify: `docs/feel-fader-launch-audit-2026-07-28.md` (sekce „Go/no-go verdikt")

**Interfaces:**
- Consumes: souhrnná tabulka nálezů (všechny pilíře).
- Produces: finální verdikt dle gate pravidla.

- [ ] **Step 1: Aplikuj gate a napiš verdikt**

Projdi souhrnnou tabulku. Verdikt = **NO-GO**, pokud existuje jakýkoli otevřený **Critical** nebo **High v Security/Stabilitě**; jinak **GO s podmínkami** (vyjmenuj akceptované Medium/Low + High v ostatních pilířích). Napiš:

```markdown
## Go/no-go verdikt

**Rozhodnutí:** GO / NO-GO
**Blokující nálezy:** <seznam Critical + High Sec/Stab, nebo „žádné">
**Akceptováno pro launch:** <Medium/Low + High mimo Sec/Stab, s důvodem>
**Doporučené pořadí oprav:** <Critical → High → …>
**Ověření po opravách:** znovu spusť `node scratch/audit/run-audit-probes.mjs` — všechny audit probes musí být PASS; pak migruj opravené probes do `scratch/run-all-probes.mjs`.
```

- [ ] **Step 2: Ověř konzistenci reportu**

Run: `grep -cE "^\| P[1-6]-" docs/feel-fader-launch-audit-2026-07-28.md` — počet řádků nálezů v tabulce ≥ počet odstavců nálezů v sekcích (žádný nález bez řádku a naopak).

- [ ] **Step 3: Commit**

```bash
git add docs/feel-fader-launch-audit-2026-07-28.md
git commit -m "audit: go/no-go verdict for launch"
```

---

## Self-Review (autor plánu — hotovo)

- **Spec coverage:** 6 pilířů → Tasky 3–8; blueprint → Task 1; report → Task 2/10; Codex cross-check → Task 9; severity/gate → Task 10; report-first (žádné fixy) → Global Constraints. ✓
- **Placeholders:** probe skeletony obsahují reálný spustitelný kód; investigativní kroky (které nálezy vzniknou) jsou z povahy auditu emergentní, ale *metoda* (grep vzory, payloady, aserty) je konkrétní. `<DEMO_URL>`/`<DEMO_HOST>` je explicitně vázán na memory čtenou v Task 8 Step 1. ✓
- **Type/název konzistence:** `AUDIT_PROBES`, `run-audit-probes.mjs`, `P()` printer, poke jména (`skipWelcome`, `_serialPort`, `DEVICE_INFO`, `normalizeFwConfig`, `serialRequest`, `onMidiMsg`) konzistentní napříč tasky a ověřené proti existujícím probes. Jména, která je nutno potvrdit greppem v `feel-fader.html` před použitím (`_readReply`, `_txnChain`, `cfgSave`, `selectBank`), jsou tak označena. ✓
