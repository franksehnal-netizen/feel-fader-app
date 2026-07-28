# Feel Fader Launch Remediation — Design

*Datum: 2026-07-28 · Autor: Frank + Claude · Navazuje na: `2026-07-28-launch-audit-design.md` + report `docs/feel-fader-launch-audit-2026-07-28.md`*

## Účel

Opravit nálezy pre-launch auditu (Critical + High + Medium) tak, aby se **launch odblokoval**: každý audit probe přejde z FAIL na PASS, appka zůstane funkčně nedotčená v round-trip config syncu s firmwarem.

**Rozsah (Frankovo rozhodnutí):** vše — Critical + High + Medium. Fix branch `fix/launch-criticals` z `main` (audit už je v main, `c443075`).

## Nálezy k opravě

| ID | Severity | Fix | Acceptance probe (FAIL→PASS) |
|----|----------|-----|------------------------------|
| P1-2 | Critical | Clamp `macro_keys` | `scratch/audit/p1-macro-nav-xss.mjs` |
| P1-3 | Critical | Clamp `nav_keys_cw/ccw` | `scratch/audit/p1-macro-nav-xss.mjs` |
| P2-1 | Critical | Validace importu před persist | `scratch/audit/p2-malformed-import.mjs` |
| P4-1 | High | Browser-support hláška | `scratch/audit/p4-no-webserial-degradation.mjs` |
| P1-1 | Medium | CSP `<meta>` | (grep `<meta http-equiv="Content-Security-Policy"` v HTML) |
| P2-2 | Medium | Globální error handler | (nová aserce v p2 probe / manuální) |
| P3-1 | Medium | Self-host fontů | `scratch/audit/p3-external-requests.mjs` |
| P6-1 | Low | Řeší CSP `<meta>` (GH Pages neumí headers) | — |

**Navíc — pre-existing red probe (mimo audit):** `scratch/controller-toggle-speed-probe.mjs` selhává 4/6 na `main` (kosmetické CSS transition timingy controller-toggle animace, rozešlé s očekáváním probu z 2026-07-26). Není to audit nález; reconcile ho v rámci téhle fáze (buď doladit animaci na očekávané hodnoty, nebo aktualizovat zastaralý probe — rozhodnout čtením, co je pravda).

## Klíčová rozhodnutí

### D1 — XSS fix = CLAMP, ne escape (ověřeno proti firmwaru)

`macro_keys` a `nav_keys_cw/ccw` jsou **numerické HID usage IDy (0–255)**, ne stringy. Firmware je clampuje:
- `ff_config.py:parse_macro_keys` → `[int(v) for v in raw if 0 <= int(v) <= 255]`
- `ff_config.py:_nav_keys` → totéž, fallback na default když prázdné.

Správný app-side fix = nový helper **`clampHidList(arr)`** zrcadlící firmware (int coercion, ponech jen 0–255, nevalidní/nenumerické zahoď). Aplikovat na **každém místě příjmu z nedůvěryhodného vstupu**:
- `normalizeFwConfig` — `macro_keys` (~4304), `nav_keys_cw`/`nav_keys_ccw` (~4322–4323)
- `applyLibraryPreset` — `nav_keys_cw`/`nav_keys_ccw` (~6524–6525), + `macro_keys` pokud ho preset nese
- import custom presetů (`importCustomPresets` / `isValidCustomPreset`)

Zdůvodnění: hodnota nikdy nemá být string; firmware string stejně zahodí. Clamp = data-layer fix konzistentní se stávajícím SEC-001/SEC-002 (`clampCc`/`clampCcList`, které clampují na 0–127). Escape na render sinku by byl méně robustní (sink jich je víc) a nechal by nevalidní data v cfg.

**App↔firmware invariant:** firmware clamp **neměním** — už existuje a je zdroj pravdy pro range. App ho jen dohání. Žádný cross-repo zápis.

### D2 — CSP = pragmatické s `'unsafe-inline'`

Appka je jeden velký inline `<script>` + inline styly; nonce se do statického GH Pages souboru doplňuje těžko. Politika:
```
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data:;
connect-src 'self';
base-uri 'none';
form-action 'none'
```
(Po self-hostu fontů — D3 — odpadá `fonts.googleapis.com`/`fonts.gstatic.com`, takže `style-src`/`font-src` nepotřebují externí hosty.) Je to **defense-in-depth**, ne primární XSS obrana (tou je clamp D1). Blokuje externí script injection, `object`/`embed`, inline event-handler navigaci mimo.

### D3 — Self-host fontů

Stáhnout Mulish + IBM Plex Mono (jen reálně použité váhy) jako `woff2`, vložit přes `@font-face` (lokální soubory nebo `data:` URI kvůli single-file distribuci), odstranit Google `<link>`. Odstraní GDPR consent trigger (P3-1), umožní přísnější CSP (D2) a **zrychlí load** (pomůže LCP 5.1s z P5). Pozn.: single-file distribuce (`index.html` na GH Pages) → preferovat `data:` URI nebo potvrdit, že GH Pages servíruje i font soubory vedle.

## Constraints (na každém tahu)

- **Byte-exact / chirurgické editace `feel-fader.html`** — malé změny, každý řádek stopovatelný k nálezu.
- **App↔firmware coupling:** jakákoli změna dotýkající se protokolu/formátu configu/`normalizeFwConfig` se posuzuje se znalostí obou stran (`../feel-fader-firmware/`). Clamp D1 je sync-safe (firmware už clampuje). Žádný zápis do firmware repa.
- **Report-first → fix-first přechod:** teď se `feel-fader.html` MĚNÍ. Každý fix ověřen svým probem FAIL→PASS; teprve pak se probe migruje z `scratch/audit/` do `scratch/run-all-probes.mjs` (zelená regresní suita).
- **MCP/HW invariant:** automatizace nesahá na reálný HW; live testy přes interní-stav-poke.
- **Manuální HW test (Frank):** po opravách ověřit round-trip config sync app↔zařízení (load → edit → send → reload) — to automatizace nesmí.
- Nemergovat app a firmware společně; nepushovat/nenasazovat bez Frankova pokynu.

## Success kritéria

1. `node scratch/audit/run-audit-probes.mjs` → **0 failed** (všechny audit probes PASS).
2. `feel-fader.html` obsahuje `<meta http-equiv="Content-Security-Policy">`; žádný externí host v network trace (self-host fontů).
3. Opravené audit probes migrované do `scratch/run-all-probes.mjs`; `controller-toggle-speed-probe.mjs` reconciled.
4. `node scratch/run-all-probes.mjs` → **0 failed** (celá zelená suita zelená).
5. `normalizeFwConfig` produkuje well-formed cfg i pro malformovaný vstup (render nikdy nespadne); malformovaný import se nepersistuje.
6. Round-trip config sync ověřen ručně na reálném HW (Frank) — žádná regrese.
7. Žádná změna ve firmware repu.
