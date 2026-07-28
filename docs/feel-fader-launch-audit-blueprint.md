# Feel Fader — Launch Audit Blueprint

> Spusť tenhle postup před každým veřejným launchem `feel-fader.html`.
> Report ulož jako `docs/feel-fader-launch-audit-<YYYY-MM-DD>.md`.
> Design a zdůvodnění: `docs/superpowers/specs/2026-07-28-launch-audit-design.md`.

## Jak spustit

1. **Server:** `node scratch/audit/run-audit-probes.mjs` (spustí :8100 + audit probes).
2. **Pro každý pilíř P1–P6** proveď jeho checks (níže), zapiš nálezy do reportu.
3. **Security nálezy** nech cross-checknout Codexem (`codex:rescue`).
4. **Aplikuj go/no-go gate**, zapiš verdikt.

> Probes mají natvrdo zadrátovaný `executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'` (Frankův Windows box) — na jiném stroji/CI je potřeba tuhle cestu upravit.

---

## Severity model

| Severity | Význam |
|---|---|
| **Critical** | XSS s exekucí JS · white-screen na běžné cestě · ztráta configu · secret ve deployi |
| **High** | Pád na věrohodném malformovaném vstupu · celá třída prohlížečů dostane rozbitou stránku bez hlášky nebo tichý slepý konec na primární vstupní cestě pro celou třídu prohlížečů · únik dat třetí straně bez notice |
| **Medium** | Degradovaná UX v edge případech · perf regrese · chybějící hardening (žádné CSP) |
| **Low** | Kosmetika · defense-in-depth nice-to-have |

## Go/no-go gate

Launch **blokuje**:
- jakýkoli otevřený **Critical**, nebo
- jakýkoli otevřený **High v pilíři Security nebo Stabilita**.

Zbytek (Medium/Low, a High v ostatních pilířích) se **dokumentuje a vědomě akceptuje** ve verdiktu reportu.

## Metoda

- **Základ:** expert manuální review (grep-driven static pass nad `feel-fader.html`) + živé ověření přes Chrome DevTools / Playwright MCP + committed `.mjs` probes jako důkaz.
- **Security pilíř navíc:** Codex second-opinion cross-check nálezů (XSS, injection, prototype pollution) — nezávislé oči tam, kde chyba nejvíc bolí. V souladu s globálním pravidlem „Codex review před nasazením business-critical kódu".
- **Výkon:** Lighthouse jako rychlé objektivní číslo, ne celý scanner aparát.

**MCP/HW invariant:** Automatizace **NIKDY** nesahá na reálný Feel Fader hardware. Live testy běží **výhradně přes interní-stav-poke vzor** — poke interní stav appky přes `evaluate` volání (`skipWelcome(); _ffConnected=true; _serialPort={}; DEVICE_INFO.*; renderConnState();` apod.) — nikdy nevolá `navigator.serial.requestPort()` + SysEx ani autentické MIDI. Každý audit probe je sandbox a neinteraktivní s reálným zařízením. Operátor sledující tenhle blueprint vidí tuto bezpečnostní hranici explicitně a nezkusí jít dál.

---

### P1 — Security

#### Co kontrolovat

- **DOM sinky:** `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, template-literal injection do DOM. Každý trasovat proti untrusted zdroji: import JSON (jméno banku, ikona, label, název/JSON presetu), localStorage, serial/MIDI payload, URL parametry. Ověřit render přes `textContent` / sanitizaci.
- **Prototype pollution:** `JSON.parse` importu — klíče `__proto__`, `constructor.prototype`. Schema validace před použitím.
- **Trust boundary serial/MIDI:** device response jako untrusted; ověřit, že se nevrátil trust „shoda jména MIDI portu = autentizace".
- **CSP:** existuje Content-Security-Policy? Feasibility restriktivní CSP proti inline scriptům (nonces / hash).

#### Jak (přesné grep/probe/příkaz)

**Statický pass — DOM sinky:**
```bash
grep -nE "innerHTML|insertAdjacentHTML|outerHTML|document\.write" feel-fader.html
grep -nE "JSON\.parse|localStorage\.getItem|new Function|\beval\(" feel-fader.html
```

**Asertace bezpečnosti:**
- `scratch/audit/p1-xss-config-import.mjs` — importuje config s XSS payloadem v jméně banku, vyrenderuje a asertuje žádnou exekuci.
- `scratch/audit/p1-proto-pollution.mjs` — importuje JSON s `__proto__` klíčem a asertuje `Object.prototype` je čisté.

**CSP control:**
```bash
grep -E "Content-Security-Policy|<meta.*http-equiv" feel-fader.html
```

#### Důkaz

Anotované grep výsledky každého `innerHTML`/`JSON.parse` výskytu. Spusť: `node scratch/audit/run-audit-probes.mjs` — P1 probes musí být PASS. Security nálezy cross-checkni Codexem (`codex:rescue`).

---

### P2 — Stabilita / robustnost

#### Co kontrolovat

- **Malformovaný vstup:** oříznutý/garbage JSON, config se špatnými typy, chybějící `banks` pole → graceful reject, ne white-screen.
- **Serial round-trip:** partial reply, timeout, `ERR` frame, stale `rid` (v2), race při rychlém connect/disconnect na `_txnChain` (serializace transakcí).
- **localStorage failure modes:** quota exceeded, korupce `ff-cfg`, disabled localStorage (private mode) → degradace, ne pád.
- **Unhandled exceptions:** globální `error` / `unhandledrejection` — zabije jeden špatný handler UI?
- **App↔firmware coupling:** `normalizeFwConfig` zvládá v1/v2 + chybějící meta; kontrola driftu formátu configu.

#### Jak (přesné grep/probe/příkaz)

**Statický pass:**
```bash
grep -nE "addEventListener\('(error|unhandledrejection)'" feel-fader.html
grep -nE "try\s*\{|catch\s*\(" feel-fader.html | wc -l
grep -nE "JSON\.parse|localStorage\.(get|set)Item" feel-fader.html
```

**Robustness probes:**
- `scratch/audit/p2-malformed-import.mjs` — oříznutý JSON, špatné typy, chybějící `banks`. Asertuje UI žije, žádný raw JS error.
- `scratch/audit/p2-storage-failure.mjs` — korumpovaný `ff-cfg` při bootu, `QuotaExceededError` při zápisu. Asertuje fallback na `DEFAULT_CFG`, žádný crash.
- `scratch/audit/p2-serial-robustness.mjs` — fake serial s `ERR:` frame, stale `rid`, timeout. Asertuje `serialRequest` rejectuje, `_txnChain` není zaseknutý.

#### Důkaz

Probe suite pokrývající každou malformovanou cestu. Spusť: `node scratch/audit/run-audit-probes.mjs` — všechny P2 probes musí být PASS.

---

### P3 — Privacy / GDPR

#### Co kontrolovat

- **Externí requesty:** full network trace cold loadu → výčet všech externích hostů. Google Fonts = únik IP EU uživatele Googlu → self-host odstraní jediný consent trigger.
- **localStorage:** jen config, žádné PII — potvrdit.
- **Tracking/analytics:** potvrdit, že žádné není.

#### Jak (přesné grep/probe/příkaz)

**Network trace probe:**
```bash
node scratch/audit/p3-external-requests.mjs
```
(Zapne request interception, projde cold load + welcome + skip cestu, sběr všech cizích hostů mimo `localhost`.)

**localStorage audit:**
```bash
grep -nE "localStorage\.setItem" feel-fader.html
```
Potvrď, že ukládané klíče jsou jen `ff-*` (config/preference), žádný e-mail/jméno/IP.

#### Důkaz

HAR/network trace z probu + seznam externích hostů. Spusť: `node scratch/audit/run-audit-probes.mjs` — P3 probe.

---

### P4 — Browser kompatibilita / graceful degradation

#### Co kontrolovat

- **Safari/Firefox** (bez Web MIDI/Serial): čistá hláška „use Chrome/Edge" vs. mrtvé UI. Feature detection přítomná a správná.
- **Mobil:** jen neregresní/nerozbitý (neoptimalizovat).

#### Jak (přesné grep/probe/příkaz)

**Degradation probe:**
```bash
node scratch/audit/p4-no-webserial-degradation.mjs
```
(Smaž `navigator.serial` i `navigator.requestMIDIAccess` PŘED loadem, asertuj čistou hlášku o nepodporovaném prohlížeči.)

#### Důkaz

Probe smaže `navigator.serial` / `navigator.requestMIDIAccess` a ověří čitelnou hlášku („Chrome/Edge", „not supported"), ne mrtvé UI. Spusť: `node scratch/audit/run-audit-probes.mjs` — P4 probe.

---

### P5 — Výkon / dlouhá session

#### Co kontrolovat

- **Cold load:** Lighthouse perf skóre, 576 KB transfer/parse, TTI.
- **Memory leak:** listenery přidávané v každém `render()`? detached DOM nodes? MIDI message flood debounce. Serial transaction manager pod trvalou zátěží.

#### Jak (přesné grep/probe/příkaz)

**Heap-growth probe:**
```bash
node scratch/audit/p5-heap-growth.mjs
```
(Měř JS heap, prožeň 300 render/bank-switch cyklů + MIDI churn, znovu měř. Asertuj heap < 10 MB delta, DOM nodes < 200 delta.)

**Lighthouse (volitelně):**
```bash
npx lighthouse http://localhost:8100/feel-fader.html --only-categories=performance --quiet --chrome-flags="--headless" --output=json --output-path=scratch/audit/lighthouse-perf.json
```
Zaznamenej perf skóre a `first-contentful-paint`/`interactive` metriky.

#### Důkaz

Lighthouse report + heap-delta čísla z probu (before/after); MIDI churn pod kontrolou. Spusť: `node scratch/audit/run-audit-probes.mjs` — P5 probe.

---

### P6 — Deploy hygiena / co je opravdu venku

#### Co kontrolovat

- **Fetch reálného dema:** servíruje se **jen** `feel-fader.html`, nebo leakuje `.superpowers/`, `scratch/`, `docs/`, `node_modules/`, `.git/`?
- **Security headers:** HTTPS enforced, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`/`X-Frame-Options`.
- **Secrets:** žádné tokeny/klíče v servírovaném HTML.
- **Integrita:** deployed blob = zamýšlený commit.

#### Jak (přesné grep/probe/příkaz)

**Deploy-hygiene probe:**
```bash
node scratch/audit/p6-deploy-hygiene.mjs
```
(Fetchni demo URL, ověř headers, zkus citlivé cesty (`.git/`, `/.superpowers/`, `/scratch/`, `/docs/`, `/node_modules/`, `/package.json`) — musí vrátit 404/403.)

**Local secrets audit (před deployem):**
```bash
grep -nE "api[_-]?key|secret|token|-----BEGIN" feel-fader.html
```

#### Důkaz

Curl dema + probe ověřující 404 na citlivých cestách a security headers (HTTPS, CSP, `X-Content-Type-Options`). Spusť probe (cílí na internet, nikoli localhost runner). Zaznamenej status každé citlivé cesty.

---

## Průběh auditu (reference)

1. **Static pass** — grep-driven code review napříč 6 pilíři → kandidátní nálezy.
2. **Live pass** — MCP browser + network trace + Lighthouse → potvrzení.
3. **Probe pass** — každý potvrzený nález zakódovaný jako `.mjs` probe (zamkne regresi).
4. **Codex cross-check** — nezávislé ověření Security nálezů.
5. **Kompilace reportu** — nálezy + severity + go/no-go verdikt.
6. *(Odděleně, po Frankově odsouhlasení)* — fix loop.

---

## Success kritéria

- Blueprint pokrývá všech 6 pilířů, každý má **Co kontrolovat**, **Jak**, **Důkaz**.
- Report na konci obsahuje go/no-go verdikt dle gate pravidla.
- Každý potvrzený nález má odpovídající committed `.mjs` probe.
