# Feel Fader — Text/Copy Audit (2026-08-11)

Rozsah: veškerý uživatelsky viditelný text v `feel-fader.html` — `TRANSLATIONS.en` slovník, `toast()` hlášky, validační zprávy, `title`/`aria-label`/`placeholder` atributy, statický HTML text (welcome/header/footer/Help & Guide modal), JS-generovaný text (bank sekce, roller/macro obsah, quick-setup dialog). Cíl: jasnost a konzistence pro uživatele (Frank, 2026-08-11 — „vsechno maximalne optimalizovane a jasne").

Metoda: systematický grep přes všechny text-nesoucí konstrukty (`aria-label=`, `title=`, `placeholder=`, `toast(...)`, `t('...')`, `data-i18n=`, statický HTML text), cross-referencováno s live-usage (které `t()` klíče se skutečně volají/renderují), plus manuální čtení content-hustých oblastí (Help & Guide, welcome/onboarding, quick-setup dialog).

## Nálezy — opraveno

| # | Kde | Nález | Oprava |
|---|---|---|---|
| 1 | `onImport()`, řádek ~4912/4924 | **Česky, ne anglicky.** `toast('e','Neplatný config soubor')` — appka je jinak celá anglická (demo pro anglicky mluvící testery); stejná třída bugu jako dřívější `window.onerror`/`unhandledrejection` handler (opraveno launch auditem 2026-08-11, commit `6ff7b41`), tady to unikl v jiné funkci. | → `'Invalid config file'` (2×) |
| 2 | `TRANSLATIONS.en`, `validate.missing_def` | Jediná validační zpráva bez uvozovek kolem `{b}` (`'Bank {b} {k}: missing definition'` vs. sesterské `'Bank "{b}" {k}: ...'`) A jediná, co ignoruje vlastní název banky — `.replace('{b}', i+1)` místo `.replace('{b}', b.name||i+1)` jako všechny ostatní. Pojmenovaná banka („Strings") by v tomhle jednom případě ukázala číslo místo jména. | Sjednoceno formát i zdroj dat s ostatními `validate.*` zprávami |
| 3 | `quickSetupMenuHtml()`, řádek ~6583 | Prázdný stav vyhledávání říkal „No matching **presets**", zatímco celý zbytek quick-setup UI důsledně používá „**setup(s)**" (nadpisy „My setups", placeholder „Search setups…", popisky „Recent"/„My setup"/„Starting point"). | → „No matching setups" |
| 4 | Custom-setup dialog, řádek 2088 | Field label „MY **PRESETS**" — jediné místo v celém dialogu, který jinak důsledně říká „setup": titulek „Save custom setup", pole „SETUP NAME", text „Your setups stay in this browser…", tlačítko „Save setup". Nejviditelnější nález — je to nadpis přímo v UI, ne edge-case hláška. | → „MY SETUPS" |
| 5 | `TRANSLATIONS.en`, 13 klíčů | **Mrtvé překladové klíče** (ověřeno: nula výskytů přes `t('key')` i `data-i18n="key""`): `settings`, `device.show`, `device.hide`, `welcome.found`, `toast.copied`, `onb.demo_badge`, `btn.export`, `btn.import`, `btn.reset`, `btn.copy`, `advanced.export_desc`, `advanced.import_desc`, `advanced.reset_desc`. 7 z nich sedělo pod komentářem tvrdícím „referenced via data-i18n" — to už neplatí (Backup & reset sekce byla mezitím předělaná na hardcoded text „Export"/"Import"/"Reset", data-i18n hooky ztratila) a komentář by zmátl příštího čtenáře, že je bezpečné/žádoucí je zachovat. Navíc nesly zastaralou terminologii („Export **preset**") oproti živé UI („Device **backup**"). | Smazáno, komentář opraven aby popisoval jen skutečně živé klíče pod ním |

Všech 5 nálezů opraveno, `npm test` beze změny (522 passed / 2 failed pre-existing / 0 crashed), žádný probe na smazané/změněné texty nezávisel.

## Prošlé a potvrzené v pořádku

- **Terminologie:** po opravě #3/#4 je teď důsledná — „**setup(s)**" pro per-bank quick-setup feature (Library/My setups), „**backup**" pro celo-zařízení export/import (Device & Settings), „**preset**" zůstává jen v kódu (proměnné/funkce jako `customLibraryPresets`, nikdy user-facing) plus jedno legitimně odlišné použití „RANGE PRESET" u keyswitch range zkratek (jiná, úzká funkce — v pořádku, nekoliduje).
- **Help & Guide modal:** kompletně přečteno — jasné, dobře strukturované, technické termíny (CC, channel, HID) vysvětlené v kontextu. Beze změny.
- **Welcome/onboarding text:** jasné, krátké, žádný žargon bez vysvětlení.
- **aria-label pokrytí** (73 výskytů, celé prošité): důkladné, popisné, konzistentní vzorce („Decrease/Increase X", „Move Y earlier/later"). Bez nálezů.
- **Dark-mode toggle label:** vypadalo staticky („Switch to dark mode" i po přepnutí do tmavého módu) — ověřeno, že `syncThemeToggle()` ho dynamicky mění na „Switch to light mode"; false alarm, ne nález.
- **Czech-text sweep:** systematický grep na české diakritické znaky napříč `toast()`/`title=`/`aria-label=`/`placeholder=` — po opravě #1 nula zbývajících výskytů.

## Neřešeno / mimo rozsah tohoto běhu

- Necelý přehled *veškerého* JS-generovaného textu (roller-mode/macro-mode content, library preview řádky) — hlavní vzorce (escaping, terminologie) ověřeny namátkově a v rámci bezpečnostního auditu 2026-08-11, ale ne řádek po řádku jako sekce výše.
- `docs/TODO.md`, commit zprávy, `AGENTS.md`/`CLAUDE.md`/`WEBAPP.md` — vývojářská dokumentace, ne uživatelsky viditelný text appky, mimo rozsah tohoto auditu.
