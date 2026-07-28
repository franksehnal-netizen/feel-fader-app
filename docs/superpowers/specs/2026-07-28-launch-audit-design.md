# Feel Fader Launch Audit — Design

*Datum: 2026-07-28 · Autor: Frank + Claude*

## Účel

Připravit **globální pre-launch audit** webové appky Feel Fader (`feel-fader.html`).
Cíl launche: appka je **stabilní** a **bezpečná** na veřejném demu.

Audit má dvojí formu:
1. **Znovupoužitelný blueprint** — spustitelný před každým launchem.
2. **První ostrý běh** — aplikovaný hned teď, s prioritizovanými nálezy.

**Report-first model:** audit nejdřív najde a odstupňuje nálezy; opravy až po
Frankově explicitním odsouhlasení, nikdy auto-fix během auditu.

## Kontext architektury (určuje threat surface)

- Jediný soubor `feel-fader.html` (~6 660 řádků, ~576 KB), **žádný build, žádný
  backend, žádná runtime závislost** — čistě client-side.
- Jediná externí věc za běhu: **Google Fonts** (`fonts.googleapis.com` /
  `fonts.gstatic.com`). `puppeteer-core` je jen devDep pro probes, nejde do produkce.
- Vstupy zvenčí (untrusted sources): **Web Serial + Web MIDI** (data ze zařízení),
  **JSON import** (device backup + custom presets), **localStorage** (`ff-cfg`,
  presety…), jména banků/labely psaná uživatelem, URL parametry.
- Deploy: veřejné demo (viz memory `reference_feelfader_demo_deploy`), kopírované
  přes `git show` (CRLF/marker kontroly).

**Důsledek:** nejsou tu serverové hrozby (SQLi, auth, session). Reálný security
povrch je úzký a konkrétní: client-side injection, robustnost vstupů, deploy hygiena.

## Výstupy

| Artefakt | Cesta | Obsah |
|---|---|---|
| Blueprint | `docs/feel-fader-launch-audit-blueprint.md` | Znovupoužitelný: 6 pilířů, checks, metoda, severity, gate |
| First-run report | `docs/feel-fader-launch-audit-2026-07-28.md` | Nálezy tohoto běhu: per pilíř, severity, důkaz, návrh opravy, verdikt |
| Probes | `scratch/audit/*.mjs` | Každý potvrzený nález zakódovaný jako regresní probe |

## Metoda provedení

- **Základ:** expert manuální review (grep-driven static pass nad `feel-fader.html`)
  + živé ověření přes Chrome DevTools / Playwright MCP + committed `.mjs` probes
  jako důkaz.
- **Security pilíř navíc:** Codex second-opinion cross-check nálezů (XSS, injection,
  prototype pollution) — nezávislé oči tam, kde chyba nejvíc bolí. V souladu
  s globálním pravidlem „Codex review před nasazením business-critical kódu".
- **Výkon:** Lighthouse jako rychlé objektivní číslo, ne celý scanner aparát.

**MCP/HW invariant (z `CLAUDE.md`):** automatizace nikdy nesahá na reálný Feel Fader
hardware. Live testy běží přes interní-stav-poke vzor
(`_midiState='granted'; _ffConnected=true; _serialPort={}; …` přes `evaluate`),
stejně jako probes.

## Severity model

| Severity | Význam |
|---|---|
| **Critical** | XSS s exekucí JS · white-screen na běžné cestě · ztráta configu · secret ve deployi |
| **High** | Pád na věrohodném malformovaném vstupu · celá třída prohlížečů dostane rozbitou stránku bez hlášky · únik dat třetí straně bez notice |
| **Medium** | Degradovaná UX v edge případech · perf regrese · chybějící hardening (žádné CSP) |
| **Low** | Kosmetika · defense-in-depth nice-to-have |

## Go/no-go gate

Launch **blokuje**:
- jakýkoli otevřený **Critical**, nebo
- jakýkoli otevřený **High v pilíři Security nebo Stabilita**.

Zbytek (Medium/Low, a High v ostatních pilířích) se **dokumentuje a vědomě akceptuje**
ve verdiktu reportu.

## Šest pilířů

### P1 — Security

- **DOM sinky:** grep `innerHTML`, `insertAdjacentHTML`, `outerHTML`,
  `document.write`, template-literal injection do DOM. Každý trasovat proti
  untrusted zdroji: import JSON (jméno banku, ikona, label, název/JSON presetu),
  localStorage, serial/MIDI payload, URL parametry. Ověřit render přes `textContent`
  / sanitizaci.
- **Prototype pollution:** `JSON.parse` importu — klíče `__proto__`,
  `constructor.prototype`. Schema validace před použitím.
- **Trust boundary serial/MIDI:** device response jako untrusted; ověřit, že se
  nevrátil trust „shoda jména MIDI portu = autentizace" (viz SEC-003/PR-001, kde
  byl SysEx config push odstraněn).
- **CSP:** existuje Content-Security-Policy? Feasibility restriktivní CSP proti
  inline scriptům (nonces / hash).
- **Důkaz:** anotované grep výsledky + probe s malicious JSON (`<img src=x
  onerror=…>` v názvu banku → assert žádná exekuce). **+ Codex cross-check.**

### P2 — Stabilita / robustnost

- **Malformovaný vstup:** oříznutý/garbage JSON, config se špatnými typy, chybějící
  pole → graceful reject, ne white-screen. Probe.
- **Serial round-trip:** partial reply, timeout, `ERR` frame, stale rid (v2), race
  při rychlém connect/disconnect na `_txnChain` (serializace transakcí).
- **localStorage failure modes:** quota exceeded, korupce `ff-cfg`, disabled
  localStorage (private mode) → degradace, ne pád.
- **Unhandled exceptions:** global `error` / `unhandledrejection` — zabije jeden
  špatný handler UI?
- **App↔firmware coupling:** `normalizeFwConfig` zvládá v1/v2 + chybějící meta;
  kontrola driftu formátu configu proti `../feel-fader-firmware/CLAUDE.md`.
- **Důkaz:** probe suite pokrývající každou malformovanou cestu.

### P3 — Privacy / GDPR

- **Externí requesty:** full network trace cold loadu → výčet všech externích hostů.
  Google Fonts = únik IP EU uživatele Googlu → **self-host** odstraní jediný consent
  trigger.
- **localStorage:** jen config, žádné PII — potvrdit.
- **Tracking/analytics:** potvrdit, že žádné není.
- **Důkaz:** HAR cold loadu + seznam externích hostů.

### P4 — Browser kompatibilita / graceful degradation

- **Safari/Firefox** (bez Web MIDI/Serial): čistá hláška „use Chrome/Edge" vs. mrtvé
  UI. Feature detection přítomná a správná.
- **Mobil:** jen neregresní/nerozbitý (per `CLAUDE.md` — neoptimalizovat).
- **Důkaz:** probe smaže `navigator.serial` / `navigator.requestMIDIAccess` a ověří,
  že se vykreslí graceful hláška.

### P5 — Výkon / dlouhá session

- **Cold load:** Lighthouse perf skóre, 576 KB transfer/parse, TTI.
- **Memory leak:** listenery přidávané v každém `render()`? detached DOM nodes?
  MIDI message flood debounce. Serial transaction manager pod trvalou zátěží.
- **Důkaz:** Lighthouse report + heap-delta probe přes mnoho render cyklů +
  simulovaný MIDI churn.

### P6 — Deploy hygiena / co je opravdu venku

- **Fetch reálného dema:** servíruje se **jen** `feel-fader.html`, nebo leakuje
  `.superpowers/`, `scratch/`, `docs/`, `node_modules/`, `.git/`?
- **Security headers:** HTTPS enforced, CSP, `X-Content-Type-Options`,
  `Referrer-Policy`, `frame-ancestors`/`X-Frame-Options`.
- **Secrets:** žádné tokeny/klíče v servírovaném HTML.
- **Integrita:** deployed blob = zamýšlený commit.
- **Důkaz:** curl deploye + probe, že citlivé cesty vrací 404.

## Průběh prvního běhu

1. **Static pass** — grep-driven code review napříč 6 pilíři → kandidátní nálezy.
2. **Live pass** — MCP browser + network trace + Lighthouse → potvrdí/změří.
3. **Probe pass** — každý potvrzený nález zakódovaný jako `.mjs` probe (zamkne regresi).
4. **Codex cross-check** — nezávislé ověření Security nálezů.
5. **Kompilace reportu** — nálezy + severity + go/no-go verdikt.
6. *(Odděleně, po Frankově odsouhlasení)* — fix loop.

## Success kritéria

- Blueprint dokument existuje a je znovupoužitelný (dá se spustit před dalším launchem
  bez dalšího designu).
- First-run report pokrývá všech 6 pilířů, každý nález má severity + důkaz + návrh opravy.
- Každý potvrzený nález má odpovídající committed `.mjs` probe.
- Report končí jednoznačným go/no-go verdiktem dle gate pravidla.
- Žádná oprava neproběhla bez Frankova odsouhlasení.
