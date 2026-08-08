# UI backlog z HW testu — design

**Datum:** 2026-08-08
**Zdroj požadavků:** Frank, během ručního HW testu; sbírané v Obsidian vaultu `[[feel-fader-app-ui-backlog]]`
**Repa:** `feel-fader-app` (A, B, C, D) + `feel-fader-firmware` (D)

## Kontext a rozsah

Čtyři nálezy z HW testu konfigurátoru. A/B/C jsou čistě UI opravy v appce a tvoří jednu vlnu.
D je cross-repo featura se změnou config schématu a jde jako samostatná druhá vlna s ručním HW ověřením.

### Zdroj pravdy

Implementuje se **výhradně do `feel-fader.html`** (single-file). Necommitnuté `app.js`, `styles.css`
a `assets/` z Codexova refaktoru jsou zastaralá extrakce (chybí v nich commit `767eaf4`) a
`feel-fader.html` na ně nikdy neodkazoval — v této vlně se jich nedotýkáme ani je nemažeme.
`AGENTS.md` / `CLAUDE.md` / `WEBAPP.md` mají v pracovní kopii necommitnuté úpravy popisující
rozdělenou strukturu; ty do této vlny také nepatří. Rozseknutí refaktoru je samostatný budoucí úkol.

Čísla řádků níže odkazují na `app.js` / `styles.css` jen jako na čitelnou navigaci — obsah je
identický s inline blokem v `feel-fader.html` (ověřeno diffem, liší se pouze o commit `767eaf4`).

---

## A. Zrušit akordeon sekcí

### Problém

Rozbalení sekce (LEFT FADER / RIGHT FADER / ROLLER / BUTTON) sbalí tu, která byla otevřená předtím,
a stav se navíc drží per banka, takže přepnutí banky rozložení resetuje.

Stav dnes (`app.js:60–68`):

```js
const _openBankSections = new Map();                       // bankIndex -> key | null
function openBankSection(bi) { return _openBankSections.has(bi) ? _openBankSections.get(bi) : 'fader1'; }
function isBankSectionOpen(bi, key) { return openBankSection(bi) === key; }
function toggleBankSection(bi, key) { _openBankSections.set(bi, isBankSectionOpen(bi,key) ? null : key); ... }
```

Jedna hodnota na banku = akordeon i per-bank reset v jednom.

### Řešení

Nahradit jedním sdíleným `Set` otevřených klíčů, nezávislým na bance:

```js
const _openSections = new Set();                           // key ∈ {fader1,fader2,roller,macro}
function isSectionOpen(key) { return _openSections.has(key); }
function toggleSection(key) {
  _openSections.has(key) ? _openSections.delete(key) : _openSections.add(key);
  renderPanels(); runValidation();
  requestAnimationFrame(() => document.getElementById(`section-toggle-${activeBank}-${key}`)?.focus());
}
```

- **Výchozí stav: všechny sekce zavřené** (prázdný `Set`). Dnes se otevírá `fader1`.
- Přejmenovat `isBankSectionOpen`/`toggleBankSection` → `isSectionOpen`/`toggleSection` a upravit
  všechny call sites (~14, `app.js:62–118`, `565–584`, `597`, `862`, `918`). Ponechat starou
  signaturu s ignorovaným `bi` by bylo méně řádků, ale lhalo by o povaze stavu.
- Šablony s `onclick="toggleBankSection(${bi},'${key}')"` ztrácejí argument `bi`
  (`app.js:86`, `95`, `101`).
- Stav přes přepnutí banky drží sám: `selectBank()` volá `renderPanels()`, ta čte sdílený `Set`.
- **`focusValidationError` (`app.js:1816`) musí `add()`, ne `set()`.** Dnes stav přepisuje; kdyby
  zůstal, skok na chybu by zavřel ostatní sekce a zavedl akordeon zadními vrátky.
- Stav se **nepersistuje** (žádný `localStorage`) — po reloadu opět všechno zavřené.

### Neověřené návaznosti (ověřit při implementaci)

- `updateStickySectionHeads()` (voláno na konci `renderPanels`, `app.js:587`) — může počítat
  s jedinou otevřenou sekcí.
- `ksRevealRange` gated na `isBankSectionOpen(bi,'roller')` (`app.js:584`).

---

## B. Šířka inline rename inputu

### Problém

`styles.css:1398`: `.fader-title-input{width:min(190px,100%);...}` — pevných 190 px bez ohledu na text.
Název „Dynamics" zabírá ~70 px, zbylých ~120 px je klikací plocha inputu. Klik napravo od názvu,
kterým chce Frank sekci rozbalit, místo toho spustí editaci názvu.

### Řešení

Pouze CSS:

```css
.fader-title-input{
  field-sizing:content; width:auto;
  min-width:5ch; max-width:min(190px,100%);
  font-size:13px; padding:0; flex:0 1 auto; cursor:text;
}
```

- `field-sizing:content` je Chrome 123+ / Edge; appka bez Web Serial stejně nedává smysl
  (desktop-first, viz `CLAUDE.md`), takže žádný fallback problém. `max-width` drží nejhorší
  případ na dnešní šířce.
- **JS se nemění.** Hlavička už má `onclick="if(!event.target.closest('input,button'))toggleSection('${key}')"`
  (`app.js:86`) — jakmile input přestane zabírat prázdné místo, klik vpravo od názvu spadne na toggle sám.
- `min-width:5ch` drží použitelný cíl i pro krátký nebo prázdný název (`onblur` stejně dosadí default).

---

## C. Notifikace nesmí posouvat layout

### Problém

`#vbar` je první dítě `.center-col` uvnitř `<main>` a přepíná se `display:none → block`
(`styles.css:840–841`, plněno v `app.js:1872`). Při duplicitním CC vstoupí do flow a posune dolů
**všechno pod sebou** — včetně stepperu `+`/`−`, na kterém uživatel právě drží kurzor.

### Řešení

`#vbar` mimo flow. `position:sticky` nestačí — sticky prvek v flow pořád zabírá místo, takže `fixed`.

**Nevymýšlet nový vzor** — appka už má přesně tenhle případ vyřešený u `.sync-banner`
(`styles.css:914`): `position:fixed; top:50px; left:50%; transform:translateX(-50%); z-index:250`,
tedy pod jednořádkovým headerem a nad stage. `.vbar` převezme stejnou geometrii i stacking:

```css
.vbar{display:none}
.vbar.err{
  display:block;
  position:fixed; top:50px; left:50%; transform:translateX(-50%);
  width:min(668px, calc(100vw - 32px));   /* .center-col je max-width:700px s paddingem 16px */
  z-index:250;
  animation:vbar-in .18s ease-out;
}
@media (prefers-reduced-motion: reduce){ .vbar.err{animation:none} }
```

- `.top-sticky` je **sticky s proměnnou výškou** (roste, když je controller schovaný, aby pojal
  dokovaný Send řádek) — proto se `top` neváže na jeho změřenou výšku, ale kopíruje ověřenou
  konstantu ze `.sync-banner`. Finální hodnota se doladí okem.
- `.top-sticky` je `pointer-events:none` kontejner (z-50) a pointer vrací jen `<header>`;
  `.vbar` je samostatný fixed prvek, takže se ho to netýká — stejně jako dokovaného Send pillu.
- Pozor na gotchu zdokumentovanou u `.sync-banner[hidden]`: `display` nastavený přes třídu přebije
  UA pravidlo pro `[hidden]`. `.vbar` se dnes řídí třídou `.err`, ne atributem, takže je to čisté —
  ale nepřidávat `[hidden]` jako druhý mechanismus.
- Kolize se `.sync-banner`, když by byly viditelné naráz (oba `top:50px`): ověřit ručně;
  v praxi sync banner naskakuje jen při (re)connectu. Pokud kolidují, `.vbar` posunout níž.
- `role="alert"` / `aria-live="assertive"` beze změny → stávající `vbar-aria-live-probe.mjs` musí projít dál.

### C-navíc: rezervovat výšku inline chyby

`#err-b{bi}-{key}` (`app.js:626`, `677`) sedí na konci těla sekce a při zobrazení posouvá sekce
**pod** sebou stejným mechanismem. Frankův konkrétní zásah to netrefil (byl nad ní), ale po zrušení
akordeonu (A) bude otevřených sekcí víc naráz a projeví se to častěji.

Řešení: dát tomu divu pevnou rezervovanou výšku (~18 px) v otevřené sekci, aby výška sekce
nezávisela na tom, jestli je chyba zobrazená. Přesunout inline styl do třídy `.section-error`.

---

## D. BUTTON per banka + Global (cross-repo)

### Problém

`macro_keys` je top-level v configu (`app.js:171`), firmware drží `button_macro` jako globální
(`code.py:185`, použití `code.py:712–715`). UI ho ale vykresluje uvnitř panelu banky vedle
LEFT FADER / RIGHT FADER / ROLLER (`app.js:577–578`, `917–930`), což čte jako bank-scoped.

### Cílové schéma (obě strany)

```json
{
  "macro_global": true,
  "macro_keys": [ 224, 8 ],
  "banks": [ { "…": "…", "macro_keys": [ 224, 9 ] } ]
}
```

`macro_global` chybí ve starém configu → `true` = dnešní chování. Zpětná kompatibilita bez migrace.

### Appka

- `macroSectionContent(bi)` dostane checkbox `Global`.
- Zdroj i cíl zápisu: `cfg.macro_global ? cfg.macro_keys : cfg.banks[bi].macro_keys`.
- `startMacroCapture()` / `_keyCapture` (`app.js:1146–1190`) musí nést `bi` a commitovat do správného cíle.
- **Přechodová pravidla** (aby přepnutí checkboxu nepřekvapilo):
  - `Global` ON → převezme makro **právě zobrazené banky** jako novou globální hodnotu („co vidíš, to zůstane").
  - `Global` OFF → naseje globální hodnotu do `macro_keys` všech bank; chování se nezmění, dokud se něco nepřepíše.
- Change-summary (`app.js:294`) rozšířit: hlásit „Button macro (Bank N)" per banka + změnu `macro_global`.
- `clampHidList` aplikovat i na per-bank `macro_keys` (`app.js:2235`, `2239`).

### Firmware

- `ff_config.parse_banks` čte per-bank `macro_keys` přes stávající `parse_macro_keys` (`ff_config.py:64`).
- `ff_config.parse_config` (`ff_config.py:133`) vrací navíc `macro_global`.
- `ff_config.serialize_state` (`ff_config.py:288`) dostane `macro_global` a per-bank makra.
- `code.py:712` vybírá `button_macro if macro_global else banks[bank_index].get("macro_keys")`;
  prázdný per-bank seznam = žádná akce (ne fallback na globální — jinak by nešlo makro pro banku vypnout).
- `schema_version` 2 → 3 (`ff_config.py:209`).

### Dopady

- **`config_hash` mění tvar** → po upgradu jednou blikne sync banner „differs". Očekávané, zdokumentovat.
- **Appka hlásí nesoulad**, když zařízení reportuje `schema_version < 3` a `macro_global` je vypnuté.
  Bez toho si uživatel nastaví per-bank makra a starý firmware je tiše ignoruje. ~5 řádků na každé straně.

---

## Pořadí a ověření

**Vlna 1 (A → B → C):** čistě UI, žádný firmware, shipnutelné dohromady.
**Vlna 2 (D):** cross-repo, vlastní commit v obou repech, ruční HW test.

### Kritérium hotovo

| Co | Důkaz |
|---|---|
| A | Nový probe: otevřít 2 sekce, přepnout banku, obě zůstávají otevřené; třetí otevření nezavře předchozí |
| B | Nový probe: šířka `.fader-title-input` ≤ šířka textu + tolerance, a klik napravo od textu rozbalí sekci |
| C | Nový probe: `getBoundingClientRect().top` stepper tlačítka `+` je identický před a po vyvolání duplicitního CC |
| A/B/C | `npm test` zelený včetně stávajícího `vbar-aria-live-probe.mjs` a `c10-bank-switch-preserves-edit-probe.mjs` |
| D | `pytest` zelený, rozšířené `tests/test_macro.py` a `tests/test_wave2_hash.py` |
| D | Ruční HW test (Frank): per-bank makro na Bank 2 vs Bank 3, pak `Global` ON → stejné makro všude |

Po shipnutí vlny 1 i vlny 2 se zeptat na redeploy `feel-fader-demo`.

### Mimo rozsah

- Rozseknutí Codexova single-file → `app.js`/`styles.css` refaktoru.
- 14-bit hi-res CC, `code.py` coverage a další body z `[[feel-fader]]` NEXT SW.
