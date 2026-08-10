# Feel Fader — Launch Audit Report (2026-08-11)

Blueprint: `docs/feel-fader-launch-audit-blueprint.md` · Předchozí audit: `docs/feel-fader-launch-audit-2026-07-28.md`
Audit commitu: `2929fda` (main, po mergu PR #8 „TODO batch 2026-08-10" + živý HW-test follow-up) · Demo: `https://franksehnal-netizen.github.io/feel-fader-demo/` — redeploynuto 2026-08-10 na tentýž obsah (demo commit `ac15acb`, blob `8be92107` shodný s `feel-fader.html` v tomto commitu), takže nálezy platí i pro živé demo.

**Rozsah tohoto běhu:** od posledního auditu (2026-07-28, commit `1cf1521`) přibylo hodně kódu — vlna 1+2 UI oprav, per-bank BUTTON makro (`schema_version` 3), UTF-8 fix na serial lince, „quick setup"/custom presets feature, TODO batch 2026-08-10 (9 UX nálezů) a dnešní živý HW-test follow-up (6 dalších). Audit se soustředí na **deltu**: co je nové od 07-28, plus explicitní uzavření mezery, kterou minulý report nechal otevřenou (viz P1 níže). Existující, už dřív ověřené vektory (macro/nav-key XSS, prototype pollution, malformed import, atd.) jsou re-verifikovány přes committed probe suite, ne znovu ručně od nuly.

## Souhrn nálezů

| ID | Pilíř | Severity | Nález | Stav |
|----|-------|----------|-------|------|
| P1-gap | Security | — (uzávěr) | Minulý audit nechal otevřenou mezeru: `quickSetupMenuHtml`, `libraryPresetPreviewRows`, `renderCustomPresetList` (custom-preset/quick-setup feature) nebyly prověřeny na XSS. Ručně ověřeno + Codex cross-check (viz níže). | **CLOSED — CONFIRMED SAFE** |
| P3-1 | Privacy | — (dřívější nález) | Google Fonts (externí host, GDPR trigger) — byl Medium nález v 07-28 reportu. | **Potvrzeno FIXED** — fonty jsou teď self-hosted (`@font-face` s `data:` URI), `grep fonts.googleapis.com` = 0 hitů, `p3-external-requests.mjs` 3/3 PASS včetně „zcela bez externích requestů". |
| Toast-locale | Konzistence | Low | Jediná uživatelsky viditelná hláška pro neodchycenou chybu (`window.onerror`/`unhandledrejection` handler, řádek 2124–2125) byla česky („Něco se pokazilo — zkuste to prosím znovu"), zbytek appky je celá anglicky (demo je pro anglicky mluvící testery, např. Slávi). | **Fixed (6ff7b41)** — přeloženo do EN |
| P6-probe-msg | Deploy (probe hygiena) | Low | `p6-deploy-hygiene.mjs` měl u 2 PASS asercí (secrets grep, meta CSP tag) natvrdo napsaný `x` text formulovaný jako FAIL zpráva („grep hit — prověřit ručně" / „chybí meta CSP tag") — na PASSu se stejně vypsal, matoucí při rychlém čtení výstupu. Žádný skutečný nález, jen čitelnost probu. | **Fixed (6ff7b41)** — text teď podmíněný na výsledek |
| P6-headers | Deploy | Low (akceptováno již 07-28) | `X-Content-Type-Options`, `Referrer-Policy`, HTTP `Content-Security-Policy` hlavička chybí na živém demu — GitHub Pages neumožňuje custom response headers, platform limit. Kompenzováno `<meta http-equiv="Content-Security-Policy">` tagem (potvrzeno přítomný). | Accepted (nezměněno od 07-28) |

Žádný nový Critical ani High nález. Go/no-go gate (blokuje jen otevřený Critical, nebo High v Security/Stabilita) **není spuštěn**.

---

## P1 — Security

### Uzávěr mezery z 07-28: quick-setup / custom presets

Minulý report (řádek 41–43 jeho P1 tabulky) explicitně vynechal `quickSetupMenuHtml`/`libraryPresetPreviewRows`/custom-preset-list jako „mimo scope, doporučeno zahrnout do budoucího cross-checku". Ručně prošito (`feel-fader.html`):

| Funkce | Sink | Vstup | Escapováno? |
|---|---|---|---|
| `quickSetupMenuHtml(query)` (~6582) | `menu.innerHTML` (6610, 6727) | uživatelský search `query` | `query` se používá **jen** pro `.includes()` filtr, nikdy se neediteruje do vráceného HTML — reflected-XSS vektor neexistuje. Vykreslené `name` (preset název) i `icon` jdou přes `escHtml()` (6588–6589). |
| `libraryPresetPreviewRows(name, preset)` (~6634) | `body.innerHTML` (6671) | preset název, `preset.icon`, fader/roller/sequence odvozené texty | Celé pole `rows` (včetně `preset.icon`, což může být uživatelem uložený custom preset) prochází `escHtml(label)`/`escHtml(value)` v jediném finálním `.map().join()` kroku (6657) — bezpečné bez ohledu na to, co jednotlivé řádky obsahují. |
| `renderCustomPresetList()` (~6851) | `list.innerHTML` (6855) | `Object.keys(customLibraryPresets)` — uživatelem zadané názvy uložených presetů | `escHtml(name)` na všech 3 místech výskytu (title, text, `data-name` atribut). |

**Codex cross-check (nezávislé oči, per blueprint):** CONFIRMED SAFE. Codex nezávisle prošel `escHtml()` (4481, jedno-průchodové `&<>"'` encodování), oba `quickSetupMenuHtml` call sites (6610, 6727), `libraryPresetPreviewRows`'s finální `rows.map` escape (6657, včetně `preset.icon` přidaného na 6639–6650) i všechny 3 výskyty v `renderCustomPresetList` (6857–6859, `title`/text/`data-name` atribut — dvojité uvozovky escapovány, takže žádný attribute-breakout). Navíc dotrasoval, odkud se custom presety berou — localStorage read (6538–6545), UI save (6823–6849, 6905–6924), import (6940–6956) — a potvrdil, že do těchto tří render cest vstupují jen přes výše uvedené escape body. Mezera z 07-28 je tím uzavřená.

### Delta static pass (co je nové od 07-28)

`grep -nE "innerHTML|insertAdjacentHTML|outerHTML|document\.write" feel-fader.html` — 13 sinků (dřív 12); nový je jen quick-setup/custom-preset trio výše, zbytek beze změny oproti 07-28 tabulce a stále platí (bank name/icon přes `escHtml`, validation msg přes `textContent`, čísla bez user stringů).

`grep -nE "JSON\.parse|localStorage\.(get|set)Item" feel-fader.html`: 15 `JSON.parse` míst, 17 `localStorage` klíčů — všechny `ff-*`/`ff_*` prefixované, jen config/preference (žádné jméno/e-mail/IP). Jediný borderline: `ff-dark-${serial}` (5819, 5835) ukládá per-zařízení theme preferenci klíčovanou USB sériovým číslem — zůstává lokálně v prohlížeči, nikdy se nepřenáší (potvrzeno P3 network trace), nepovažuji za PII nález.

**Existující probes (re-run, žádná regrese):**
```
ok   p1-xss-config-import.mjs — 5 pass, 0 fail
ok   p1-proto-pollution.mjs — 5 pass, 0 fail
ok   p1-macro-nav-xss.mjs — 8 pass, 0 fail
```

CSP meta tag potvrzen přítomný (`default-src 'none'; script-src 'unsafe-inline'; ...`), beze změny od 07-28 fixu.

---

## P2 — Stabilita / robustnost

Beze změny v přístupu od 07-28 — globální error handlery (`window.addEventListener('error'/'unhandledrejection', ...)`, řádek 2124–2125) stále přítomné, 86 `try`/`catch` bloků (nárůst z předešlého auditu, konzistentní s přibylým kódem). Nový povrch od 07-28 (per-bank makro schema v3, serial reconnect retry z dnešního HW testu) prošel vlastními probes v rámci TODO-batch práce, ne touto audit sadou — viz `docs/TODO.md` 2026-08-10 sekce.

```
ok   p2-malformed-import.mjs — 7 pass, 0 fail
ok   p2-storage-failure.mjs — 4 pass, 0 fail
ok   p2-serial-robustness.mjs — 6 pass, 0 fail
```

---

## P3 — Privacy / GDPR

**Nejvýznamnější změna od 07-28:** Google Fonts nález (Medium, 07-28) je potvrzeně **fixed** — fonty jsou teď embedded jako `data:` URI přes `@font-face`, žádný externí request. `p3-external-requests.mjs` teď prochází i svou nejpřísnější asercí („zcela bez externích requestů — ideál po self-hostu fontů"), která v 07-28 reportu byla očekávaně FAIL.

```
ok   p3-external-requests.mjs — 3 pass, 0 fail
```

localStorage audit: viz P1 sekce výše (žádné PII, vše `ff-*`).

---

## P4 — Browser kompatibilita / graceful degradation

Beze změny — feature detection (`navigator.serial`, `navigator.requestMIDIAccess`) přítomná na welcome screenu i v `_serialEnsureOpen()`. Probe beze změny výsledku od 07-28 fixu.

```
ok   p4-no-webserial-degradation.mjs — 4 pass, 0 fail
```

---

## P5 — Výkon / dlouhá session

```
ok   p5-heap-growth.mjs — 3 pass, 0 fail
```

300 render/bank-switch cyklů + MIDI churn beze zjevného heap leaku i po přibylém kódu (per-bank makra, hover-tip delegace, live-hud reveal timing atd. z dnešního dne). Lighthouse nebyl v tomto běhu spouštěn (nice-to-have, ne blokující — poslední číslo z 07-28 zůstává referenční).

---

## P6 — Deploy hygiena / co je opravdu venku

Spuštěno proti živému demu (`https://franksehnal-netizen.github.io/feel-fader-demo/`), redeploynutému včera na tentýž `2929fda` obsah:

```
PASS  HTTPS + 200 na hlavní stránce  — 200
FAIL  X-Content-Type-Options: nosniff  — chybí
FAIL  má nějaké Referrer-Policy  — chybí
FAIL  má Content-Security-Policy HTTP header  — chybí (GH Pages limit, očekávané)
PASS  žádné zjevné secrets v served HTML  — žádný hit
PASS  má <meta http-equiv="Content-Security-Policy"> tag v HTML  — přítomný
PASS  citlivá cesta /.git/config nedostupná — 404
PASS  citlivá cesta /.superpowers/ nedostupná — 404
PASS  citlivá cesta /scratch/ nedostupná — 404
PASS  citlivá cesta /docs/ nedostupná — 404
PASS  citlivá cesta /package.json nedostupná — 404
PASS  citlivá cesta /node_modules/ nedostupná — 404
```
(zprávy u secrets/meta-CSP zaznamenané po fixu `6ff7b41` — probe teď hlásí podmíněný text i na PASSu)

3 FAIL jsou stejný, dřív akceptovaný GitHub Pages platform limit (07-28 P6-1) — kompenzováno meta CSP tagem. Žádné citlivé cesty nejsou dostupné, žádné secrets v servírovaném HTML.

---

## Verdikt

**GO.** Žádný Critical, žádný nový High. Otevřená security mezera z minulého auditu je uzavřená (potvrzeno bezpečné, plus Codex cross-check). Oba Low nálezy (locale nekonzistence v error toastu, kosmetika jednoho probu) opraveny stejný den (`6ff7b41`) — report je uzavřen beze zbývajících otevřených položek.
