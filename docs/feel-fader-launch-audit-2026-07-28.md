# Feel Fader — Launch Audit Report (2026-07-28)

Blueprint: `docs/feel-fader-launch-audit-blueprint.md` · Spec: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`  
Audit commitu: <git rev-parse --short HEAD při běhu> · Demo: <DEMO_URL>

## Souhrn nálezů

| ID | Pilíř | Severity | Nález | Probe | Stav |
|----|-------|----------|-------|-------|------|
| P1-1 | Security | Medium | Chybí Content-Security-Policy `<meta>` hlavička | p1-xss-config-import.mjs (kontext) | Open |
| P2-1 | Stabilita | Critical | Import backupu s `banks`, ale poškozeným `fader1`/chybějícím `fader2`/`encoder` shodí `render()`, `cfgSave()` už proběhl → korupce se persistuje; příští normální otevření appky má prázdný `#panels-row` a neodchycenou page error | p2-malformed-import.mjs | Open |
| P2-2 | Stabilita | Medium | Chybí globální `window.onerror`/`unhandledrejection` handler — žádná neodchycená chyba (např. P2-1) se nikam nereportuje, ani uživateli, ani do konzole mimo `console.error` na jednom místě | static grep (Krok 1) | Open |
| P3-1 | Privacy | Medium (viz zdůvodnění) | Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) je jediná externí závislost appky — každé otevření odešle IP EU návštěvníka Googlu bez consentu (GDPR trigger) | p3-external-requests.mjs | Open |
| P4-1 | Browser | High | Safari/Firefox návštěvník (chybí `navigator.serial` i `navigator.requestMIDIAccess`) nedostane na welcome screenu (první dojem) žádnou hlášku o nepodporovaném prohlížeči — jediný „Chrome & Edge" text je ve footeru schovaném za fixed welcome overlay | p4-no-webserial-degradation.mjs | Open |

## P1 Security

**Rozsah:** XSS přes import konfigurace (jméno banku, ikona, label faderu) a prototype-pollution přes `__proto__` klíč v importovaném JSON. Oba probe soubory asertují bezpečné chování (report-first — PASS = čisto, FAIL by byl potvrzený nález).

### Krok 1 — statický grep pass (DOM sinky a untrusted zdroje)

`grep -nE "innerHTML|insertAdjacentHTML|outerHTML|document\.write" feel-fader.html` — sinky (výběr, s posouzením untrusted vstupu):

| Řádek | Sink | Vstup do sinku | Escapováno? |
|---|---|---|---|
| 2155 | `el.innerHTML = sectionSummaryHtml(summary)` | interní summary objekt | ano — `sectionSummaryHtml()` volá `escHtml()` na `label`/`meta` (řádek 2148, 2150) |
| 2381 | `list.innerHTML = items...map(item => `<li>${escHtml(item)}</li>`)` | seznam položek | ano — `escHtml()` |
| 2543 | `el.innerHTML = tabsHtml + addHtml` (renderBankTabs) | **bank.name, bank.icon** (import config) | ano — `nm = escHtml(b.name...)` (2536), `escHtml(b.icon)` (2532) |
| 2559 | `s.innerHTML = '<svg...>'` | statický SVG literál | n/a (žádný user vstup) |
| 2638 | `panels-row.innerHTML = ...` (renderPanels) | **bank.name, bank.icon** (bankNameRowHtml), fader label (přes `faderSectionContent`→`sectionHeaderHtml`) | ano — `escHtml(b.name...)` (2608, 2612, 2615, 2618, 2621), `escHtml(b.icon)` (2605), `escHtml(title)` pro fader label (2165, 2172, 2179) |
| 3026 | `el.innerHTML = uacc_values.map(...)` | číselné CC hodnoty (ne string) | n/a — jen čísla |
| 3214 | `content.innerHTML = rollerModeBodyHtml(...)` | encoder config (čísla/enum) | n/a |
| 3709 | `el.innerHTML = keyswitchTagsHtml(bi)` | `ks_notes` (čísla), `noteName(n)` je odvozeno ze statické tabulky podle čísla | n/a — žádný user string |
| 3933/3949 | validation bar `bar.innerHTML=...escHtml(errs[0].msg)...` | validation message (interní string) | ano — `escHtml()` |
| 6050 | `grid.innerHTML = out` (icon picker) | statická sada ikon | n/a |
| 6224/6341 | `menu.innerHTML = quickSetupMenuHtml(query)` | uživatelský vyhledávací dotaz + preset názvy | vyžaduje ověření `quickSetupMenuHtml()` — mimo scope import-XSS vektoru testovaného zde (presets/quick-setup UI, ne config-import cesta); doporučeno zahrnout do budoucího cross-checku (Task 9) |
| 6285 | `body.innerHTML = libraryPresetPreviewRows(name,preset) + ...escHtml(note)` | preset name/note | částečně — `note` escapován, `libraryPresetPreviewRows` mimo scope (viz výše) |
| 6402 | `list.innerHTML = names.map(name => ...)` | custom preset names (`localStorage`) | vyžaduje ověření — mimo scope importní cesty testované zde |

`grep -nE "JSON\.parse|localStorage\.getItem|new Function|\beval\(" feel-fader.html`: žádný `eval()`/`new Function()` nalezen. `JSON.parse` volání na řádcích 2289, 2301, 3337, 3514, 4339, 4456, 4481, 4633 (import), 4649, 4805, 6165, 6185, 6490 — všechny čtou buď `localStorage` (self-controlled, ne cross-origin untrusted) nebo importovaný soubor (`onImport`, řádek 4629–4639, jediná cesta pro externí/uživatelský JSON).

**Relevantní kód importní cesty** (`onImport`, řádek 4629):
```
function onImport(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=ev=>{
    try{
      let p=JSON.parse(ev.target.result);
      if(!p.banks)throw new Error('Invalid device backup');
      p=normalizeFwConfig(p);
      cfg=p;loaded=true;dirty=true;activeBank=0;cfgSave();render();...
```
`normalizeFwConfig()` (řádek 4285) má dvě větve: pokud `p.banks[0].fader1` existuje (import už-normalizovaného exportu, tj. `exportP()` výstup ručně upravený uživatelem), jméno/ikona banku (`bank.name`, `bank.icon`) se **nedotýkají a projdou beze změny** — jediná sanitizace nastává až při `render()` přes `escHtml()`.

### Krok 2–4 — probes a výsledek běhu

`node scratch/audit/run-audit-probes.mjs`:
```
ok   p1-xss-config-import.mjs — 5 pass, 0 fail
ok   p1-proto-pollution.mjs — 5 pass, 0 fail

10 passed, 0 failed, 0 crashed (2 probes)
```

Detailní PASS/FAIL výstup (`p1-xss-config-import.mjs`, payload `<img src=x onerror="window.__xss=true">` v `banks[0].name`, `.icon`, `.fader1.label`):
```
PASS  onerror payload se nespustil (window.__xss=false)  — {"xss":false,"bodyHasRawImg":false,"nameEscaped":true,"cfgName":"<img src=x onerror=\"window.__xss=true\">","cfgLabel":"<img src=x onerror=\"window.__xss=true\">"}
PASS  žádný alert()/dialog z injektovaného skriptu
PASS  payload není v DOM jako živý <img onerror>  — {"xss":false,"bodyHasRawImg":false,"nameEscaped":true,...}
PASS  bank name/icon/label je v DOM jen jako escapovaný text  — {...,"nameEscaped":true,...}
PASS  no page errors
```

Detailní PASS/FAIL výstup (`p1-proto-pollution.mjs`, `__proto__` klíč na top-levelu, v `banks[0]` i `banks[0].fader1`):
```
PASS  Object.prototype není znečištěn top-level __proto__ klíčem  — {"polluted":false,"polluted2":false,"polluted3":false,"objProtoKeys":[]}
PASS  Object.prototype není znečištěn __proto__ v banks[i]  — {"polluted":false,"polluted2":false,"polluted3":false,"objProtoKeys":[]}
PASS  Object.prototype není znečištěn __proto__ v banks[i].fader1  — {"polluted":false,"polluted2":false,"polluted3":false,"objProtoKeys":[]}
PASS  Object.prototype nemá žádné nové vlastní klíče  — []
PASS  no page errors
```

**Závěr XSS/proto-pollution:** oba probes PASS → **žádný nález** (no finding) pro živý XSS ani prototype pollution na testovaném config-import vektoru. `escHtml()` (řádek 4275) je důsledně aplikován na `bank.name`, `bank.icon` a fader `label` ve všech nalezených render cestách (`renderBankTabs`, `renderPanels`/`bankNameRowHtml`, `faderSectionContent`/`sectionHeaderHtml`). `JSON.parse` vytvoří `__proto__` jako vlastní data-property, aniž sáhne na živý prototype accessor, takže samotný parse je inertní; pollution by vyžadoval následný merge, který indexuje přes accessor — což `normalizeFwConfig()` nedělá.

**Hardening observace (nezakládá samostatný nález, drženo jako regresní zámek):** `cfg.banks[i].name`/`.icon`/`.fader1.label` uchovávají v paměti syrový (needsanitizovaný) řetězec — bezpečnost stojí čistě na tom, že *každé* render místo důsledně volá `escHtml()`. Nový render kód přidaný v budoucnu bez `escHtml()` by XSS znovu otevřel. Probe `p1-xss-config-import.mjs` slouží jako regresní zámek přesně pro tento scénář. Sinky na řádcích 6224/6341/6285/6402 (quick-setup/library preset UI) nebyly touto sadou probes ověřeny (jiná vstupní cesta než config-import) — doporučeno pokrýt v Task 9 cross-checku.

**Nález P1-1 — chybí CSP (Medium, hardening):**
- **Zdroj:** grep `<meta[^>]*(csp|Content-Security)` na `feel-fader.html` (case-insensitive) → 0 výskytů. Žádná `Content-Security-Policy` `<meta>` hlavička v `<head>`.
- **Důkaz:** static grep, žádný probe nutný (negativní nález — absence tagu).
- **Riziko:** bez CSP nemá aplikace defense-in-depth vrstvu proti XSS, kdyby v budoucnu vznikla mezera v `escHtml()` pokrytí (viz hardening observace výše) nebo v nepokrytých sincích (6224/6341/6285/6402). Vzhledem k tomu, že appka je single-file HTML bez build kroku, CSP by šlo přidat jako `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; ...">` (nutno zohlednit inline `onclick=` atributy používané v celé appce — striktní CSP bez `unsafe-inline` by vyžadovalo větší refaktor event handlerů).
- **Návrh opravy:** přidat CSP `<meta>` tag do `<head>` jako hardening vrstvu (samostatná pozdější fáze — mimo scope report-first fixu).

## P2 Stabilita

**Rozsah:** malformed config import, localStorage selhání (korupce / QuotaExceeded), a robustnost sériové transakční vrstvy (`serialRequest`/`_readReply`/`_txnChain`) proti `ERR` rámci, cizímu (stale) `rid` a no-response timeoutu. Probes asertují SAFE chování (report-first — PASS = appka je robustní, FAIL = potvrzený nález).

### Krok 1 — statický pass

```
grep -nE "addEventListener\('(error|unhandledrejection)'" feel-fader.html
```
→ **0 výskytů.** V celém souboru není žádný globální `error`/`unhandledrejection` handler. Jediné zachycení běhové chyby na úrovni bootstrapu je lokální `try/catch` kolem inicializačního `render()` volání (`feel-fader.html:6641-6646`, jen `console.error(...)`, žádný toast/UI signál, žádné odeslání kamkoli).

```
grep -nE "try\s*\{|catch\s*\(" feel-fader.html | wc -l
```
→ **55** výskytů `try{`/`catch(` napříč souborem — hustá lokální (per-call) error-handling praxe, ale bez jediného centrálního zachytávače.

```
grep -nE "JSON\.parse|localStorage\.(get|set)Item" feel-fader.html
```
→ 40+ výskytů (viz P1 sekce pro plný výpis `JSON.parse`). Relevantní pro P2:
- `cfgLoad()` (`feel-fader.html:2285-2298`) **obaluje `JSON.parse` v try/catch** (try na 2286, catch na 2296) a při chybě vrací `null`, což na řádku 2301 (`let cfg = _savedCfg || JSON.parse(JSON.stringify(DEFAULT_CFG));`) padá zpět na `DEFAULT_CFG`. → korupce syntakticky nevalidního JSON je ošetřená.
- `cfgSave()` (`feel-fader.html:2276-2279`) **obaluje `localStorage.setItem` v try/catch** (`catch(e){}`), takže `QuotaExceededError` je tichá no-op, ne pád.
- `onImport()` (`feel-fader.html:4629-4639`) obaluje celý import (parse + guard + `normalizeFwConfig` + `cfg=...;cfgSave();render()`) v jednom try/catch, ale **guard `if(!p.banks)throw...` (řádek 4634) kontroluje jen přítomnost klíče `banks`, ne tvar jeho obsahu** — a `cfgSave()` (řádek 4636) běží **před** `render()` ve stejném příkazu, takže i když `render()` na řádku 4636 shodí, poškozený `cfg` je už zapsaný do `localStorage`. Toto je kořen nálezu P2-1 níže.

**Závěr Kroku 1:** žádný globální error guard (→ P2-2, Medium) + `cfgLoad`/`cfgSave` jsou lokálně ošetřené (dobrý základ pro P2 storage-failure probe), ale `onImport()`'s persist-before-render pořadí je fragilní.

### Krok 2–4 — probes a výsledek běhu

`node scratch/audit/run-audit-probes.mjs`:
```
ok   p1-xss-config-import.mjs — 5 pass, 0 fail
ok   p1-proto-pollution.mjs — 5 pass, 0 fail
FAIL p2-malformed-import.mjs — 7 pass, 2 fail
ok   p2-storage-failure.mjs — 4 pass, 0 fail
ok   p2-serial-robustness.mjs — 6 pass, 0 fail

27 passed, 2 failed, 0 crashed (5 probes)
```

Detailní výstup (`p2-malformed-import.mjs`):
```
PASS  [truncated JSON] UI nezbělá (root elementy v DOM)  — {"threw":"SyntaxError: ...","guardWouldBlock":false,"uiAlive":true,"persistedBroken":false}
PASS  [truncated JSON] localStorage ff-cfg nezůstal zkorumpovaný (chybí fader1/fader2/encoder)  — ...
PASS  [wrong types (reachable via real Import Config button)] UI nezbělá (root elementy v DOM)  — {"threw":"TypeError: Cannot read properties of undefined (reading 'cc')","guardWouldBlock":false,"uiAlive":true,"persistedBroken":true}
FAIL  [wrong types (reachable via real Import Config button)] localStorage ff-cfg nezůstal zkorumpovaný (chybí fader1/fader2/encoder)  — {"threw":"TypeError: Cannot read properties of undefined (reading 'cc')","guardWouldBlock":false,"uiAlive":true,"persistedBroken":true}
PASS  [missing banks (blocked by onImport/loadConfigFromDevice guard in practice)] UI nezbělá (root elementy v DOM)  — {"threw":"Error: Invalid device backup","guardWouldBlock":true,"uiAlive":true,"persistedBroken":false}
PASS  [missing banks (blocked by onImport/loadConfigFromDevice guard in practice)] localStorage ff-cfg nezůstal zkorumpovaný (chybí fader1/fader2/encoder)  — ...
PASS  nové otevření appky po perzistované korupci: root elementy v DOM  — {"uiAlive":true}
FAIL  nové otevření appky po perzistované korupci: žádná neodchycená page error  — TypeError: Cannot read properties of undefined (reading 'channel')
PASS  žádná neodchycená page error (celkem)
```

Detailní výstup (`p2-storage-failure.mjs`) — **čistý PASS, žádný nález**:
```
PASS  korumpovaný ff-cfg: appka nabootuje na fallback cfg  — {"uiAlive":true,"hasCfg":true}
PASS  QuotaExceeded při cfgSave neshodí appku (chyba je odchycená)  — {"threw":null}
PASS  QuotaExceeded v odloženém cfgAutosave()->cfgSave() neshodí appku  — {"caughtByWindow":false}
PASS  žádná neodchycená page error
```

Detailní výstup (`p2-serial-robustness.mjs`) — **čistý PASS, žádný nález**:
```
PASS  ERR frame -> serialRequest rejectuje  — {"err":"rejected: ERR:boom","errChainOk":true,"staleRid":"resolved-correctly","timeout":"rejected: timeout","timeoutMs":305,"timeoutChainOk":true}
PASS  po ERR frame _txnChain přijme další request (nezaseknuto)  — ...
PASS  stale/cizí rid je zahozen, korektní rid frame stále resolvne  — ...
PASS  timeout -> serialRequest rejectuje v čase (< 2000ms)  — ...
PASS  po timeoutu _txnChain přijme další request (nezaseknuto)  — ...
PASS  žádná neodchycená page error
```

### Nález P2-1 — malformed import přežije jako perzistovaná korupce, appka na příštím otevření ztratí celý editační panel (Critical)

- **Trigger:** import backup souboru (reálné tlačítko "Import config" → `onImport()`, `feel-fader.html:4629-4639`) s JSON, kde `banks` existuje (guard `if(!p.banks)` na řádku 4634 tedy propustí), ale některá banka má `fader1` jako string/scalar místo objektu a chybí jí `fader2`/`encoder` klíče — např. ručně upravený nebo z jiné verze pocházející export. Ekvivalentní vstup: `{"banks":[{"name":123,"fader1":"nope","uacc_values":"x"}]}`.
- **Mechanismus (ověřeno, ne teoreticky):**
  1. `normalizeFwConfig()` (`feel-fader.html:4285-4302`) tuto banku nechá projít beze změny tvaru (`fader1` zůstane string, `fader2`/`encoder` chybí).
  2. `onImport()` (`feel-fader.html:4636`) provede `cfg=p; ...; cfgSave(); render();` — **`cfgSave()` běží před `render()`**, takže poškozená struktura je zapsaná do `localStorage['ff-cfg']` bez ohledu na to, co se stane dál.
  3. `render()` → `renderPanels()` → `faderSectionContent()` shodí `TypeError: Cannot read properties of undefined (reading 'cc')` (stack: `faderSectionContent` `feel-fader.html:2672` ← `renderPanels` `2647` ← `render` `2516`), protože přistupuje na `bank.fader2.cc`/`bank.encoder.cc` bez guardu.
  4. Tento pád je uvnitř `onImport()`'s vlastního `try/catch`, takže se ukáže uživateli jako `toast('e', err.message)` s **syrovým JS textem chyby** ("Cannot read properties of undefined (reading 'cc')") — ne jako srozumitelná zpráva.
  5. **Reálný dopad ale nastává až při příštím normálním otevření appky** (žádná další akce uživatele není potřeba): `cfgLoad()` na startu úspěšně naparsuje tuto (synteticky validní) poškozenou JSON strukturu a přiřadí ji jako `cfg` (obchází `DEFAULT_CFG` fallback, protože `_savedCfg` je truthy). Bootstrap `render()` (`feel-fader.html:6642`) je sice obalený v try/catch (`6641-6646`), ale ten crash zachytí až **po** částečném provedení — `#panels-row` (`feel-fader.html:1831`, celý editační panel fader/encoder) skončí s **prázdným `innerHTML` (0 bajtů)**, protože pád nastane dřív, než proběhne přiřazení na řádku 2638. Navíc jinde v init sekvenci (mimo tento try/catch) proběhne **další, neodchycená** `pageerror`: `TypeError: Cannot read properties of undefined (reading 'channel')` — potvrzeno živě otevřením nové stránky s předem nasazeným poškozeným `ff-cfg` v `localStorage`.
  6. Bez manuálního smazání `localStorage['ff-cfg']` (žádná in-app cesta k obnově) zůstává appka v tomto stavu trvale — hlavička, bank-tabs a `#device-wrap` jsou v DOM (`uiAlive===true`), ale hlavní konfigurační plocha je prázdná.
- **Proč Critical, ne jen High:** finální stav (prázdný `#panels-row` + neodchycená `pageerror`) nastává na **nejběžnější možné cestě — prostém (znovu)otevření appky** — ne jen v okamžiku importu. Jde o white-screen-třídy selhání hlavní funkční plochy appky, trvalé napříč reloady, bez jakékoli signalizace uživateli (viz P2-2 — chybí globální error handler, takže se to nikam neloguje ani neukáže).
- **Důkaz:** `scratch/audit/p2-malformed-import.mjs` (2 FAIL, viz výstup výše) + ruční ověření (`b.newPage()` s `evaluateOnNewDocument` nasazujícím poškozený `ff-cfg`, `#panels-row.innerHTML.length === 0`, `pageerror` "reading 'channel'").
- **Návrh opravy (mimo scope report-first):** (a) `normalizeFwConfig()`/`onImport()` validovat tvar každé banky (fader1/fader2/encoder musí být objekty s `cc`/`channel`) před `cfgSave()`, ne až v `render()`; (b) přesunout `cfgSave()` až za úspěšný `render()`, ne před něj — perzistovat jen to, co se prokazatelně dá vykreslit; (c) přidat globální `window.onerror`/`unhandledrejection` handler (řeší i P2-2) jako poslední záchrannou síť, která by aspoň ukázala uživateli srozumitelnou zprávu a/nebo nabídla reset na `DEFAULT_CFG`.

### Nález P2-2 — chybí globální error/unhandledrejection handler (Medium)

- **Zdroj:** static grep, Krok 1 — `addEventListener('error'` / `addEventListener('unhandledrejection'` → 0 výskytů v celém `feel-fader.html`.
- **Riziko:** libovolná neodchycená výjimka (např. P2-1, nebo budoucí regrese) zmizí beze stopy — žádný toast, žádný log, žádná telemetrie. Jediné existující zachycení (`feel-fader.html:6641-6646`) je lokální, jen pro bootstrap `render()`/`applyLang()`, a jde jen do `console.error` (neviditelné mimo DevTools).
- **Návrh opravy:** přidat `window.addEventListener('error', ...)` a `window.addEventListener('unhandledrejection', ...)` s minimálním non-blokujícím toastem ("Something went wrong — try reloading") jako poslední záchrannou vrstvu; nemusí feature-fixovat konkrétní pády, jen zabránit tichému selhání bez signálu uživateli.

### Nález (hardening observace, ne samostatný P2-x) — `normalizeFwConfig()` nemá vlastní obranu proti chybějícímu `banks`

- `normalizeFwConfig()` (`feel-fader.html:4286`: `if (!p.banks) return p;`) sám o sobě nevaliduje, jen prostrčí vstup beze změny — následné `cfg.banks.map(...)` v `renderBankTabs()` (`feel-fader.html:2530`) by na takovém vstupu spadlo.
- **Aktuálně nedosažitelné přes UI:** oba reálné volací body (`onImport()` řádek 4634, `loadConfigFromDevice()` řádek 4482) mají vlastní `if(!p.banks) throw` guard **před** voláním `normalizeFwConfig()` — potvrzeno probe casem "missing banks" (`guardWouldBlock:true`, `PASS`, žádný nález).
- Držet jako regresní zámek (probe case "missing banks" v `p2-malformed-import.mjs`) pro případ, že budoucí/alternativní volací místo guard vynechá — pak by reprodukovalo pád stejného tvaru jako P2-1.

### Storage-failure a serial-robustness — žádný nález

- **Storage:** korumpovaný `ff-cfg` (nevalidní JSON) při bootu i `QuotaExceededError` (synchronní `cfgSave()` i odložený `cfgAutosave()`→`cfgSave()` přes `setTimeout`) jsou plně ošetřené existujícím `try/catch` v `cfgLoad()`/`cfgSave()` — appka padá zpět na `DEFAULT_CFG` / tiše ignoruje neúspěšný zápis. Žádná akce nutná.
- **Serial:** `ERR:` rámec, cizí/stale `rid` (zahozen, čeká na korektní rámec), a úplné ticho (timeout `_readReply`, `feel-fader.html:4419`) — všechny tři cesty korektně `reject()`ují svůj `serialRequest()` promise a **`_txnChain` (`feel-fader.html:4272`, `.catch(()=>{})` na řádku 4410) zůstává funkční** — ověřeno kontrolním requestem hned po každém fault-case, který proběhl normálně. Žádná akce nutná.

## P3 Privacy/GDPR

**Rozsah:** network trace všech requestů na cizí hosty (mimo `localhost`/`data:`) přes welcome flow i `skipWelcome()` cestu, plus statická kontrola `localStorage` klíčů proti PII. Probe asertuje ideál (report-first — PASS = čisto, FAIL = potvrzený nález).

### Krok 1 — network trace probe

`scratch/audit/p3-external-requests.mjs`: request interception (`page.on('request', ...)`) sbírá `host` každého requestu, který není `localhost(:port)` ani `data:` URI; stránka se otevře, projde `skipWelcome()`, počká 500 ms na doběhnutí async requestů.

**Zjištěné externí hosty:**
```
EXTERNAL HOSTS: ["fonts.googleapis.com","fonts.gstatic.com"]
```

Detailní PASS/FAIL výstup:
```
EXTERNAL HOSTS: ["fonts.googleapis.com","fonts.gstatic.com"]
PASS  žádné neočekávané externí hosty (jen fonts.* pokud vůbec)  — ["fonts.googleapis.com","fonts.gstatic.com"]
FAIL  zcela bez externích requestů (ideál po self-hostu fontů)  — ["fonts.googleapis.com","fonts.gstatic.com"]
PASS  žádná neodchycená page error  — []
```

Přes `run-audit-probes.mjs` (spolu s P1/P2 sadou):
```
ok   p1-xss-config-import.mjs — 5 pass, 0 fail
ok   p1-proto-pollution.mjs — 5 pass, 0 fail
FAIL p2-malformed-import.mjs — 7 pass, 2 fail
ok   p2-storage-failure.mjs — 4 pass, 0 fail
ok   p2-serial-robustness.mjs — 6 pass, 0 fail
FAIL p3-external-requests.mjs — 2 pass, 1 fail

29 passed, 3 failed, 0 crashed (6 probes)
```
(P2 FAILy jsou beze změny — viz Task 5 brief, tento probe se soustředí jen na P3; potvrzeno, že přidání `p3-external-requests.mjs` do `AUDIT_PROBES` nic v P1/P2 sadě nerozbilo.)

**Žádné jiné externí hosty nalezeny** — žádná analytika, telemetrie, CDN skript ani třetí strana mimo Google Fonts. Aplikace komunikuje s hardwarem výhradně přes Web Serial (lokální USB), žádný síťový request tam nesměřuje.

### Krok 2 — statická kontrola `localStorage` proti PII

`grep -nE "localStorage\.setItem" feel-fader.html` — všechny klíče:

| Řádek | Klíč | Obsah |
|---|---|---|
| 2214 | `ff_note_convention` | preference (note-naming convention) |
| 2278 | `LS_CFG_KEY` = `ff-cfg` (řádek 2265) | fader/encoder konfigurace (device backup) |
| 4464, 4486 | `LS_SERIAL_PID_KEY` = `ff-serial-pid` (řádek 2266) | USB product ID zařízení |
| 4489, 4597 | `LS_HASH_KEY` = `ff-last-hash` (řádek 4273) | hash konfigurace potvrzený zařízením |
| 4726 | `LIVE_HUD_POS_KEY` = `ff_live_hud_pos` (řádek 4700) | pozice HUD prvku v UI |
| 5455 | `ff-controller-hidden` | UI preference (zobrazit/skrýt panel) |
| 5503, 5507, 5523 | `ff-dark`, `ff-dark-${serial}` | dark-mode preference (per-zařízení) |
| 5954 | `ff-library-setup-cue-seen` | one-time onboarding cue flag |
| 5964 | `ff-onboarded` | onboarding-dokončeno flag |
| 6180 | `CUSTOM_PRESETS_STORAGE_KEY` = `ff-custom-library-presets-v1` (řádek 6156) | uživatelem uložené presety (fader configy) |
| 6191 | `QUICK_RECENT_STORAGE_KEY` = `ff-recent-quick-setups-v1` (řádek 6157) | naposledy použité quick-setup presety |

**Závěr:** všech 15 zápisových míst používá klíče s prefixem `ff-`/`ff_` (config/preference/onboarding stav zařízení). Žádný klíč neobsahuje e-mail, jméno, IP adresu ani jiný přímý identifikátor osoby — `serial` v `ff-dark-${serial}` je sériové číslo/USB identifikátor MIDI zařízení (hardware), ne uživatele. **Pozitivní nález: žádné PII v `localStorage`.**

### Nález P3-1 — Google Fonts jako jediná externí závislost (GDPR consent trigger)

- **Zdroj:** `p3-external-requests.mjs`, `EXTERNAL HOSTS: ["fonts.googleapis.com","fonts.gstatic.com"]`.
- **Mechanismus:** appka natahuje webfonty přímo z Google (`fonts.googleapis.com` pro CSS, `fonts.gstatic.com` pro binární font soubory) — standardní `<link>`/`@import` na Google Fonts CDN. Každé načtení stránky odešle požadavek na Google servery s IP adresou návštěvníka (a dalšími HTTP hlavičkami — user-agent, referrer) ještě před jakoukoli interakcí s consent bannerem (appka žádný consent banner nemá).
- **Riziko (GDPR):** dle rozsudku LG München I (2020, "Google Fonts Fall") a navazující praxe je přenos IP adresy na Google servery při načtení webfontu bez souhlasu považován za nezákonné zpracování osobních údajů (IP = osobní údaj) — základ desítek tisíc výzev/žalob v EU. Feel Fader je nasazen jako veřejné demo pro EU návštěvníky → přímá expozice.
- **Proč Medium (s vahou k High):** appka nemá žádnou jinou externí závislost, žádnou analytiku, žádné trackery — Google Fonts je **jediný** consent trigger v celé aplikaci. To snižuje rozsah (jen jeden vektor, ne plošný problém) → Medium jako výchozí hodnocení. Zvažoval jsem High, protože (a) fix je triviální (self-host, žádná funkční ztráta) a (b) demo je veřejně přístupné bez jakéhokoli consent mechanismu, takže expozice je aktivní od prvního requestu, ne podmíněná. Ponechávám **Medium** jako primární hodnocení, protože nejde o zpracování citlivých/rozsáhlých dat (jen IP, jednorázově, bez cross-site trackingu či profilování) a náprava nevyžaduje redesign — ale **doporučuji řešit před spuštěním veřejného demo provozu**, ne odkládat do post-launch.
- **Návrh opravy:** self-host fonty (stáhnout `.woff2` soubory, servírovat z vlastního originu, nahradit `<link href="https://fonts.googleapis.com/...">` za lokální `@font-face`) — odstraní jediný externí request a tím i jediný GDPR consent trigger v appce. Po fixu by měl `p3-external-requests.mjs` přepnout oba PASS řádky na zelenou (regresní zámek).

## P4 Browser kompatibilita

**Rozsah:** appka je Chrome/Edge-only (Web Serial + Web MIDI). Cíl: ověřit, co uvidí Safari/Firefox návštěvník veřejného demo — konkrétně **první dojem** (welcome screen při loadu, před jakýmkoli Send). Existující `scratch/send-without-web-serial-probe.mjs` (regresní, nemodifikováno) už pokrývá `doSend()`/`_serialEnsureOpen()` cestu — ta je v pořádku (čistý toast/Error, žádná raw JS chyba). Tento probe (`p4-no-webserial-degradation.mjs`, report-first, nový) cílí na to, co se stane HNED po loadu.

### Krok 1 — statický grep pass (feature-detect a user-facing hlášky)

`grep -nE "navigator\.serial|requestMIDIAccess|not supported|unsupported|nepodporov|Chrome|Edge|Web Serial" feel-fader.html`:

| Řádek | Nález | Kdy se spustí |
|---|---|---|
| 4097 | `if(!navigator.requestMIDIAccess){ _midiState='unsupported'; renderConnState(); return; }` | při MIDI init — mění jen header connection-status pill, **ne** welcome screen |
| 4365 | `if (!navigator.serial) throw new Error('Web Serial not supported in this browser — use Chrome or Edge.')` | uvnitř `_serialEnsureOpen()` — voláno až z `doSend()`/`loadConfigFromDevice()`, tj. **po** akci uživatele |
| 4589 | `toast('e', 'Web Serial not supported in this browser — use Chrome or Edge to send to your device.')` | v `doSend()` — stejně, až po kliknutí Send |
| 1953 | `data-i18n="footer.compat"` → „Works with Chrome & Edge · Web Serial & Web MIDI required" | statický text v `<footer>` uvnitř `<main>` — ale `<main>` je při loadu **za** `#welcome-screen` (position:fixed, inset:0, z-index 200, celý viewport), takže návštěvník ho fyzicky nevidí, dokud overlay neopustí |
| 1970–1997 | `#welcome-screen` markup (wordmark, onboarding beaty, `#welcome-start-msg`, tlačítko „Continue without device") | **žádná** browser-support podmínka nikde v tomto bloku |

**Závěr grepu:** support-hláška existuje v kódu (`footer.compat`, `Web Serial not supported...`), ale je buď (a) skrytá za welcome overlayem, nebo (b) se ukáže až po akci uživatele. Na samotném welcome screenu — první věc, kterou Safari/Firefox návštěvník vidí — není nic.

### Krok 2 — probe

`scratch/audit/p4-no-webserial-degradation.mjs`: `page.evaluateOnNewDocument()` smaže `navigator.serial` i `navigator.requestMIDIAccess` PŘED loadem (simulace Safari/Firefox), appka se načte, probe čte `#welcome-screen.innerText` (ne `document.body.innerText` — to by triviálně PASSnulo na skrytém footer textu, viz komentář v souboru).

Výstup (`node scratch/audit/p4-no-webserial-degradation.mjs`, samostatně přes throwaway server na :8100):
```
PASS  UI žije i bez Web Serial/MIDI (žádná mrtvá stránka)  — {"uiAlive":true,"wsVisible":true}
PASS  welcome screen (první dojem) je zobrazený  — {"wsVisible":true}
FAIL  uživatel dostane NA WELCOME SCREENU čitelnou hlášku o prohlížeči  — welcome text: "Feel Fader\nMeet Feel Fader\nTwo motorless faders and a roller for articulations — built for orchestral MIDI.\nContinue without device" | (info) match anywhere on page incl. hidden footer: true
PASS  žádná neodchycená page error
```

Přes `run-audit-probes.mjs` (celá sada P1–P4):
```
ok   p1-xss-config-import.mjs — 5 pass, 0 fail
ok   p1-proto-pollution.mjs — 5 pass, 0 fail
FAIL p2-malformed-import.mjs — 7 pass, 2 fail
ok   p2-storage-failure.mjs — 4 pass, 0 fail
ok   p2-serial-robustness.mjs — 6 pass, 0 fail
FAIL p3-external-requests.mjs — 2 pass, 1 fail
FAIL p4-no-webserial-degradation.mjs — 3 pass, 1 fail

32 passed, 4 failed, 0 crashed (7 probes)
```
(P2/P3 FAILy beze změny — viz Task 4/5 briefy; přidání `p4-no-webserial-degradation.mjs` nic v P1–P3 sadě nerozbilo.)

### Nález P4-1 — Safari/Firefox návštěvník bez vodítka na welcome screenu

- **Zdroj:** `p4-no-webserial-degradation.mjs`, druhý assert FAIL.
- **Mechanismus:** appka nedělá feature-detect na `navigator.serial`/`navigator.requestMIDIAccess` při vykreslení welcome screenu. UI samo o sobě zůstává živé (žádná mrtvá stránka, žádná neodchycená JS chyba — to je pozitivní), ale návštěvník ve Safari/Firefoxu vidí přesně to samé uvítání jako Chrome/Edge uživatel: wordmark, onboarding text, „Continue without device". Nic mu neřekne, že zařízení se nikdy nepřipojí, dokud to nezkusí a nenarazí na hlášku až při Send (`Web Serial not supported...`) — a i to jen když si všimne toastu.
- **Proč High:** jde o **první kontaktní bod** veřejného demo — Safari (macOS/iOS default) a Firefox dohromady tvoří netriviální podíl návštěvníků. Ten typ uživatele stráví čas prokliknutím onboardingu v domnění, že appka funguje, než narazí na tichý/pozdní fail. Není to crash ani bezpečnostní díra, ale je to přímá ztráta konverze/důvěry hned na vstupu — odpovídá „confirmed high-severity UX regression on first impression", ne jen kosmetický nedostatek.
- **Návrh opravy:** feature-detect (`!navigator.serial && !navigator.requestMIDIAccess`, nebo šířeji `!('serial' in navigator)`) spuštěný před/při zobrazení `#welcome-screen`, který vykreslí jasný banner/blok („Tento prohlížeč není podporovaný — otevři appku v Chrome nebo Edge") uvnitř welcome screenu samotného (ne jen ve footeru za overlayem). `footer.compat` řetězec už existuje a lze ho reużít jako text banneru. Po fixu by `p4-no-webserial-degradation.mjs` měl přepnout FAIL řádek na PASS (regresní zámek).

## P5 Výkon / dlouhá session

## P6 Deploy hygiena

## Go/no-go verdikt

_(Task 10)_
