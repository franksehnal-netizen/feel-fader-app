# Feel Fader — Hloubkový strukturní audit (app + firmware): design

> Diagnostický audit, čistě read-only. Doplňuje předchozí UX/product audity
> (`docs/feel-fader-ux-audit-2026-06-27.md`, `docs/feel-fader-product-audit-2026-07-03.md`),
> které řešily zážitek/vizuál. Tento audit řeší **strukturu a technický stav**
> obou repozitářů.

## Cíl

Zjistit skutečný technický stav `feel-fader-app` (single-file web konfigurátor,
aktuálně 5821 řádků `feel-fader.html`) a `feel-fader-firmware` (CircuitPython,
`code.py`/`ff_config.py`/`boot.py`) napříč sedmi osami, a vyprodukovat
prioritizovaný diagnostický report. **Žádné zásahy do kódu** — o dalších
krocích (fix, refactor, cleanup) rozhodne majitel nad reportem.

Motivace: appka mezitím výrazně narostla (dokumentace `WEBAPP.md` deklaruje
stav „3 466 řádků" k 2026-07-12, aktuální soubor má 5 821) a existují dvě
opuštěné-ale-nesmazané feature větve (`control-mode`, `help-onboarding`) i
13 mergnutých větví, které nikdo neuklidil — signál, že strukturní/hygienický
dluh se mohl nahromadit i jinde, beze zápisu do UX auditů, které se dívaly
jinam.

## Osy auditu

1. **Architektura & organizace kódu** — hranice odpovědností, velikost
   souborů/funkcí, těsně provázaný stav, kandidáti na rozdělení.
2. **Protokol app↔fw konzistence** — shoduje se protokolová tabulka v obou
   `CLAUDE.md` se skutečným kódem (`serialRequest`, `apply_web_config`,
   `_parse_banks`, `CMD_*` handlery, `config_hash`, v1/v2 framing)?
3. **Doc-vs-kód drift** — `WEBAPP.md`/`CLAUDE.md`/`AGENTS.md` tvrzení
   (čísla řádků, názvy funkcí, popsané chování) vs. realita kódu.
4. **Dead code & nepoužité větve** — mrtvé funkce/konstanty/CSS v obou
   repech; navazuje na dřívější dílčí `.superpowers/sdd/dead-code-report.md`
   (jen i18n klíče + pár SysEx konstant), který od té doby appka o ~2300
   řádků přerostla.
5. **Test coverage & ověřitelnost** — fw má 70 passing pytest testů; app nemá
   žádné automatizované testy (jen ad-hoc `scratch/*.mjs` probes). Kde chybí
   pokrytí nejvíc bolí.
6. **Repo hygiena** — mergnuté/opuštěné větve, nekonzistentní `scratch/`
   gitignore, `node_modules` v repu, růst `.superpowers/sdd`/`docs/`.
7. **Bezpečnost & validace vstupů** — validace configu na obou stranách
   protokolu, zacházení s nedůvěryhodnými řetězci (např. MIDI port names —
   XSS pattern byl opraven na needitované větvi `control-mode`; existuje
   podobný pattern i na `main`?).

## Metoda

Provedeno **v této konverzaci** (ne jako samostatná fresh session jako
předchozí dva audity) — audit se vyplatí protáhnout kontextem, který už tato
session má (git historie, WEBAPP.md, oba CLAUDE.md, precedens dead-code
reportu).

**Hybrid: 3 paralelní subagenti + přímá práce v hlavním vlákně.**

Subagenti dostanou explicitní **diagnostic-only** instrukci (žádné Edit/Write
do repozitářů) a vrátí nálezy v jednotném formátu (viz níže) pro syntézu.

| Agent | Osy | Rozsah |
|---|---|---|
| **Agent 1** | Architektura, Dead code | Oba repa: strukturální mapa `feel-fader.html` (CSS/JS sekce, velikost funkcí) + fw moduly; mrtvý kód nad rámec dřívějšího reportu |
| **Agent 2** | Protokol konzistence, Bezpečnost | Oba repa současně: `CLAUDE.md` tabulky vs. skutečné `CMD_*`/`serialRequest`/`apply_web_config`; validace vstupů, XSS-pattern kontrola i mimo `control-mode` větev |
| **Agent 3** | Doc-vs-kód drift | `WEBAPP.md` + oba `CLAUDE.md` + oba `AGENTS.md` vs. aktuální kód — každé tvrzení s číslem řádku/funkcí ověřit |

**Hlavní vlákno přímo** (mechanické, git/shell dotazy, ne hluboké čtení):

- **Repo hygiena** — `git branch --merged/--no-merged`, `.gitignore` pokrytí `scratch/`, `node_modules` tracked?, velikost `.superpowers/sdd`.
- **Test coverage** — `pytest` výstup rozebraný po modulech; identifikace kritických netestovaných cest v appce (protocol parsing, `validate()`, `normalizeFwConfig`).

Po dokončení subagentů syntetizuji všech 7 os do jednoho reportu.

## Rubrika a formát nálezu

```
### [ID] — Krátký název
- **Osa:** Architektura | Protokol konzistence | Doc-vs-kód drift | Dead code | Test coverage | Repo hygiena | Bezpečnost
- **Závažnost:** P0 | P1 | P2 | P3
- **Co:** stručný popis
- **Kde:** repo + soubor + řádek/funkce
- **Proč to vadí:** konkrétní riziko (rozjetý protokol, mezera v testech, matoucí doc pro dalšího agenta/vývojáře, bezpečnostní díra…)
- **Doporučení:** konkrétní akce
- **Náročnost:** S (minuty) | M (hodiny) | L (dny) — + ⚠️ pokud se dotýká drátového protokolu (nutná změna obou rep)
```

**Závažnost (strukturní sémantika, odlišná od UX auditů):**

- **P0** — aktivní riziko: protokol se může tiše rozejít, bezpečnostní díra, nebo dokumentace tvrdí něco prokazatelně nepravdivého, čím by se řídil další agent/vývojář
- **P1** — reálný tech-debt: mrtvý kód matoucí čtení, chybějící pokrytí kritické cesty, doc drift bez bezpečnostního rizika
- **P2** — znatelná nedokonalost (repo hygiena, drobná nekonzistence)
- **P3** — kosmetika

## Výstup

`docs/feel-fader-structure-audit-2026-07-20.md` (v `feel-fader-app` repu, konzistentně s předchozími audity):

1. **Executive summary** — 3–5 vzorců (ne jednotlivostí)
2. **Tabulka nálezů** — řazená dle závažnosti, sloupce ID/osa/závažnost/náročnost/protokol ⚠️
3. **Detaily nálezů** — plný formát, seskupené po osách
4. **Quick wins** — vysoký dopad / náročnost S
5. **Návrh úklidových vln** — Vlna 1: bezpečné/nízkoriziko (mrtvé větve, dead code, doc drift opravy); Vlna 2: test coverage doplnění; Vlna 3: větší strukturální úvahy (rozdělení souboru apod.) — pouze pokud audit najde skutečný důvod, ne YAGNI refactor

**Žádné zásahy do kódu.** Report je vstup pro majitelovo rozhodnutí, stejně jako u předchozích dvou auditů.
