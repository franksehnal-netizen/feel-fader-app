# Feel Fader — Launch Audit Report (2026-07-28)

Blueprint: `docs/feel-fader-launch-audit-blueprint.md` · Spec: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`  
Audit commitu: <git rev-parse --short HEAD při běhu> · Demo: <DEMO_URL>

## Souhrn nálezů

| ID | Pilíř | Severity | Nález | Probe | Stav |
|----|-------|----------|-------|-------|------|
| P1-1 | Security | Medium | Chybí Content-Security-Policy `<meta>` hlavička | p1-xss-config-import.mjs (kontext) | Open |

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

**Závěr XSS/proto-pollution:** oba probes PASS → **žádný nález** (no finding) pro živý XSS ani prototype pollution na testovaném config-import vektoru. `escHtml()` (řádek 4275) je důsledně aplikován na `bank.name`, `bank.icon` a fader `label` ve všech nalezených render cestách (`renderBankTabs`, `renderPanels`/`bankNameRowHtml`, `faderSectionContent`/`sectionHeaderHtml`). `JSON.parse` nevytváří `__proto__` jako vlastní klíč (V8 sémantika) a `normalizeFwConfig()` nepoužívá rekurzivní merge/`Object.assign` způsobem, který by protopollution umožnil.

**Hardening observace (nezakládá samostatný nález, drženo jako regresní zámek):** `cfg.banks[i].name`/`.icon`/`.fader1.label` uchovávají v paměti syrový (needsanitizovaný) řetězec — bezpečnost stojí čistě na tom, že *každé* render místo důsledně volá `escHtml()`. Nový render kód přidaný v budoucnu bez `escHtml()` by XSS znovu otevřel. Probe `p1-xss-config-import.mjs` slouží jako regresní zámek přesně pro tento scénář. Sinky na řádcích 6224/6341/6285/6402 (quick-setup/library preset UI) nebyly touto sadou probes ověřeny (jiná vstupní cesta než config-import) — doporučeno pokrýt v Task 9 cross-checku.

**Nález P1-1 — chybí CSP (Medium, hardening):**
- **Zdroj:** grep `<meta[^>]*(csp|Content-Security)` na `feel-fader.html` (case-insensitive) → 0 výskytů. Žádná `Content-Security-Policy` `<meta>` hlavička v `<head>`.
- **Důkaz:** static grep, žádný probe nutný (negativní nález — absence tagu).
- **Riziko:** bez CSP nemá aplikace defense-in-depth vrstvu proti XSS, kdyby v budoucnu vznikla mezera v `escHtml()` pokrytí (viz hardening observace výše) nebo v nepokrytých sincích (6224/6341/6285/6402). Vzhledem k tomu, že appka je single-file HTML bez build kroku, CSP by šlo přidat jako `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; ...">` (nutno zohlednit inline `onclick=` atributy používané v celé appce — striktní CSP bez `unsafe-inline` by vyžadovalo větší refaktor event handlerů).
- **Návrh opravy:** přidat CSP `<meta>` tag do `<head>` jako hardening vrstvu (samostatná pozdější fáze — mimo scope report-first fixu).

## P2 Stabilita

## P3 Privacy/GDPR

## P4 Browser kompatibilita

## P5 Výkon / dlouhá session

## P6 Deploy hygiena

## Go/no-go verdikt

_(Task 10)_
