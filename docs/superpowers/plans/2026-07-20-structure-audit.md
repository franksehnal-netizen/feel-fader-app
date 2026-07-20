# Feel Fader — Hloubkový strukturní audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to run this plan task-by-task (this is a diagnostic/research plan, not code implementation — subagent-driven-development's code-review gate does not apply). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one diagnostic report, `docs/feel-fader-structure-audit-2026-07-20.md` (in `feel-fader-app` repo), covering 7 structural axes across `feel-fader-app` and `feel-fader-firmware` — no code changes to either repo.

**Architecture:** 5 research tasks feed one synthesis task. Two research tasks run directly (mechanical git/shell queries); three run as parallel diagnostic-only `Agent` dispatches (deep code reading, one per axis-cluster). Synthesis merges all findings into the report format defined in the spec.

**Tech Stack:** `git`, `pytest` (firmware repo, already has 70 passing tests), `grep`/`Read`/`Bash` tools, the `Agent` tool (subagent_type: `Explore`, diagnostic-only).

## Global Constraints

- **No writes to either repo's source/doc files during research** — `feel-fader-app` and `feel-fader-firmware` are read-only for this plan. Every dispatched agent must be told explicitly: diagnostic only, no Edit/Write in either repo.
- **Repos stay separate** — no cross-repo merge, no firmware writes ([[feedback_feelfader_repos_separate]] / `AGENTS.md` in both repos).
- Report goes in `feel-fader-app` repo at `docs/feel-fader-structure-audit-2026-07-20.md`, matching the location convention of the two prior audits.
- Severity rubric (from spec, verbatim):
  - **P0** — active risk: protocol can silently desync, security hole, or docs assert something demonstrably false that would misguide a future agent/developer
  - **P1** — real tech debt: dead code that confuses future reading, missing coverage on a critical path, doc drift with no security angle
  - **P2** — noticeable imperfection (repo hygiene, minor inconsistency)
  - **P3** — cosmetic
- Finding format (verbatim from spec):
  ```
  ### [ID] — Krátký název
  - **Osa:** Architektura | Protokol konzistence | Doc-vs-kód drift | Dead code | Test coverage | Repo hygiena | Bezpečnost
  - **Závažnost:** P0 | P1 | P2 | P3
  - **Co:** stručný popis
  - **Kde:** repo + soubor + řádek/funkce
  - **Proč to vadí:** konkrétní riziko
  - **Doporučení:** konkrétní akce
  - **Náročnost:** S | M | L — + ⚠️ pokud se dotýká drátového protokolu
  ```

---

### Task 1: Repo hygiena — přímý výzkum

**Files:**
- Create: none (findings go into a scratch note, then into the final report in Task 6)
- Read-only targets: `feel-fader-app/.git`, `feel-fader-app/.gitignore`, `feel-fader-app/scratch/`, `feel-fader-app/.superpowers/`, `feel-fader-app/docs/`, `feel-fader-firmware/.git`

**Interfaces:**
- Produces: a list of Repo-hygiena findings in the finding format above, held in-memory/scratch for Task 6 to consume (no intermediate file required — write directly into a section of your working notes).

- [ ] **Step 1: Enumerate branch state in both repos**

Run in `feel-fader-app`:
```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git branch --merged main
git branch --no-merged main
git branch -a | grep remotes/origin
```
Expected: list of merged branches (cleanup candidates — but recall `control-mode`/`help-onboarding` were explicitly kept for reference per Frank's decision, so exclude those two from any "should delete" framing even though they show as no-merged) and any remote branches fully merged into `origin/main`.

Repeat the same three commands in `feel-fader-firmware`.

- [ ] **Step 2: Check `scratch/` gitignore coverage**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
cat .gitignore
git status --short | grep scratch/ | wc -l
git ls-files scratch/ | wc -l
```
Expected: shows how many `scratch/` files are tracked vs. untracked vs. ignored. Compare against `.gitignore` content (currently only `scratch/mobile-ux-output/` is ignored — confirm if that's still true and whether the volume of untracked probe files (30+) is worth a broader ignore rule).

- [ ] **Step 3: Check for committed build artifacts / dependency dirs**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git ls-files node_modules/ | wc -l
git ls-files __pycache__/ .pytest_cache/ 2>/dev/null | wc -l
```
```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
git ls-files __pycache__/ .pytest_cache/ 2>/dev/null | wc -l
```
Expected: 0 for all — confirm nothing generated is tracked. If any count is nonzero, that's a P1/P2 finding (Kde: exact path, Doporučení: add to `.gitignore` + `git rm --cached`).

- [ ] **Step 4: Measure growth of process-doc directories**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
find docs/superpowers -name "*.md" | wc -l
find .superpowers/sdd -name "*.md" 2>/dev/null | wc -l
du -sh docs .superpowers 2>/dev/null
```
Expected: raw counts/sizes. Not automatically a finding — only write one up if the volume looks unmanaged (e.g., no index, no pruning of superseded plans) rather than just "large but fine, matches process".

- [ ] **Step 5: Write up Repo hygiena findings**

Using the counts/lists from Steps 1-4, write findings in the exact format from Global Constraints. Expect roughly 3-6 findings (e.g., stale merged local branches, stale merged remote branches, `scratch/` gitignore gap, any tracked artifacts found). Assign severity per the rubric — branch/scratch clutter is P2, tracked build artifacts would be P1.

---

### Task 2: Test coverage & ověřitelnost — přímý výzkum

**Files:**
- Read-only targets: `feel-fader-firmware/tests/*.py`, `feel-fader-firmware/code.py`, `feel-fader-firmware/ff_config.py`, `feel-fader-app/feel-fader.html`, `feel-fader-app/package.json`, `feel-fader-app/scratch/*.mjs`

**Interfaces:**
- Produces: Test-coverage findings in the finding format, for Task 6.

- [ ] **Step 1: Run firmware test suite and confirm baseline**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
python -m pytest -q
```
Expected: `70 passed` (matches the count already observed during brainstorming — if the number differs, note the discrepancy as a finding).

- [ ] **Step 2: Map firmware test files to the functions they exercise**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
grep -h "^def test_" tests/*.py
grep -n "^def \|^class " code.py ff_config.py
```
Cross-reference: for each top-level function/class in `code.py`/`ff_config.py`, check whether any test file references it (`grep -l "<function_name>" tests/*.py`). List functions with zero test references — focus especially on anything touching the serial protocol (`CMD_*` handling, `apply_web_config`, hash computation) since that's the highest-risk untested surface per the spec's Protokol/Bezpečnost axes.

- [ ] **Step 3: Confirm the app has zero automated tests**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
cat package.json
ls scratch/*.mjs | wc -l
```
Expected: `package.json` `scripts.test` is the `echo "Error: no test specified"` stub; probe count in `scratch/` confirms testing currently only happens via ad-hoc Puppeteer probes, not a repeatable suite.

- [ ] **Step 4: Identify the highest-risk untested app-side logic**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
grep -n "function validate(\|function normalizeFwConfig(\|function serialRequest(\|function _readReply(" feel-fader.html
```
Read each matched function's body (use the Read tool with an offset/limit around the matched line). These are the functions the spec calls out as the app's critical, currently-unverified paths (protocol parsing, config validation, request/reply matching). Note their approximate line-count/complexity as context for the finding.

- [ ] **Step 5: Write up Test coverage findings**

Write findings in the exact format. Expect at least one P1 finding for "app has zero automated coverage of protocol-parsing/validation logic" (Doporučení: concrete — e.g. "extract `validate()`/`normalizeFwConfig()` into a testable module or add a headless-Node harness that loads the script and calls them directly, mirroring the existing probe pattern"). Any firmware function found with zero test references in Step 2 gets its own finding, severity based on whether it's on the protocol-write path (P1) or cosmetic (P2/P3).

---

### Task 3: Agent dispatch — Architektura + Dead code

**Files:** none written by the main thread in this task; the dispatched agent only reads.

**Interfaces:**
- Consumes: nothing from other tasks (fully self-contained prompt below).
- Produces: a findings block (Architektura + Dead code axes) returned in the agent's final report, for Task 6 to consume.

- [ ] **Step 1: Dispatch the agent**

Use the `Agent` tool with `subagent_type: "Explore"`, `run_in_background: true` (this will run in parallel with Tasks 4 and 5 — dispatch all three in the same message), with this exact prompt:

```
Diagnostický, READ-ONLY audit dvou repozitářů. Nesmíš nic editovat ani
vytvářet soubory v žádném z nich (žádný Edit/Write nástroj na cestách pod
těmito repy). Cílem je vrátit strukturované nálezy, ne opravovat cokoliv.

Repozitáře:
- App: c:\Users\Fanda Borec\Documents\feel-fader-app
  (feel-fader.html — jednosouborová web appka, aktuálně 5821 řádků, vanilla JS/CSS/HTML, žádný build)
- Firmware: c:\Users\Fanda Borec\Documents\feel-fader-firmware
  (CircuitPython na RP2040: code.py ~716 řádků, ff_config.py ~371, boot.py ~70)

Přečti nejdřív feel-fader-app/WEBAPP.md (mapa appky se jmény funkcí a čísly
řádků) a feel-fader-app/CLAUDE.md + feel-fader-firmware/CLAUDE.md (protokol
a app↔fw vazba) pro orientaci — ale nevěř jim naslepo, tvým úkolem je
ověřovat realitu kódu, ne opakovat dokumentaci.

## Osa 1 — Architektura & organizace kódu

V obou repech zmapuj:
- feel-fader.html: hranice CSS bloku vs. JS bloku (řádkové rozsahy), hlavní
  funkční sekce v JS (render/state, MIDI, serial protokol, UI handlery,
  welcome/onboarding, validace) — najdi jejich přibližné řádkové rozsahy.
  Najdi nejdelší jednotlivé funkce (grep "^function " nebo "^  function "
  a změř vzdálenost k další deklaraci) — vypiš top 5-10 podle délky.
  Posuzuj, jestli je some funkce/blok evidentně dělá víc věcí najednou
  (např. jedna funkce co renderuje UI i validuje i ukládá do localStorage).
- code.py/ff_config.py: totéž — hlavní funkční sekce, nejdelší funkce,
  místa s těsně provázaným globálním stavem.
- Nehodnoť to jako "soubor je dlouhý, rozděl ho" bez konkrétního důvodu —
  jednosouborová architektura je vědomá volba (žádný build step). Hledej
  konkrétní bolavá místa: funkce dělající 3+ nesouvisející věci, duplicitní
  logiku (stejný vzorec kódu na 2+ místech), stav mutovaný z mnoha
  nesouvisejících míst bez jasného vlastníka.

## Osa 2 — Dead code

- Zkontroluj feel-fader-app/.superpowers/sdd/dead-code-report.md — to už
  vyřešilo 54 mrtvých i18n klíčů a pár SysEx konstant (CMD_CHUNK, CMD_ACK,
  CMD_ERR, enc7). NEOPAKUJ tyhle nálezy — appka od té doby (report byl při
  ~3466 řádcích, teď má 5821) mohla nabrat nové mrtvé místo.
  Zkus totéž systematicky znovu: pro každou top-level `function` a `const`
  v <script> bloku over přes grep počet výskytů v souboru (1 = jen definice
  = mrtvé, pokud to není export/event handler volaný z HTML atributu).
  Pozor na falešné pozitivy: onclick="fn()" v HTML, window.fn = ... exporty,
  a funkce volané dynamicky přes název stringu.
- V CSS: hledej selektory/třídy definované ale nikde v HTML/JS nepoužité
  (grep třídy z CSS pravidel, pak grep výskyt v HTML/JS mimo definici).
- V code.py/ff_config.py: totéž pro Python funkce/konstanty — grep výskyty,
  ověř že nejsou volané z testů (tests/*.py) ani z boot.py.

## Formát výstupu (povinný pro každý nález)

### [ID] — Krátký název
- **Osa:** Architektura | Dead code
- **Závažnost:** P0 | P1 | P2 | P3
  (P0 = aktivní riziko rozjetí protokolu/bezpečnostní díra/prokazatelně
  nepravdivá dokumentace; P1 = reálný tech-debt, mrtvý kód matoucí čtení,
  chybějící pokrytí kritické cesty; P2 = znatelná nedokonalost; P3 = kosmetika)
- **Co:** stručný popis
- **Kde:** repo + soubor + řádek/funkce
- **Proč to vadí:** konkrétní riziko, ne obecná fráze
- **Doporučení:** konkrétní akce
- **Náročnost:** S (minuty) | M (hodiny) | L (dny) — + ⚠️ pokud se nález
  dotýká drátového protokolu (nutná změna obou rep)

ID prefix pro tuhle osu: "A-" pro Architekturu, "D-" pro Dead code
(např. A-1, A-2, D-1, D-2...).

Vrať v závěrečné zprávě jen tyhle formátované nálezy (očekávej 5-15
nálezů celkem), žádné shrnutí navíc, žádné návrhy na opravy nad rámec
"Doporučení" pole.
```

- [ ] **Step 2: Hold the returned findings**

Keep the agent's returned findings text (with `A-` and `D-` prefixed IDs) — Task 6 needs it verbatim as input.

---

### Task 4: Agent dispatch — Protokol konzistence + Bezpečnost

**Files:** none written by the main thread; dispatched agent only reads.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a findings block (Protokol konzistence + Bezpečnost axes), for Task 6.

- [ ] **Step 1: Dispatch the agent**

Dispatch alongside Tasks 3 and 5 in the same message (`run_in_background: true`, `subagent_type: "Explore"`), with this exact prompt:

```
Diagnostický, READ-ONLY audit dvou repozitářů. Nesmíš nic editovat ani
vytvářet soubory v žádném z nich. Cílem je vrátit strukturované nálezy.

Repozitáře:
- App: c:\Users\Fanda Borec\Documents\feel-fader-app (feel-fader.html)
- Firmware: c:\Users\Fanda Borec\Documents\feel-fader-firmware (code.py, ff_config.py, boot.py)

Přečti feel-fader-app/CLAUDE.md a feel-fader-firmware/CLAUDE.md celé —
oba obsahují protokolové tabulky (serial CMD_R/CMD_INFO/CMD_W/CMD_HID s
rid framingem v2 + legacy v1, MIDI SysEx jako sekundární kanál,
config_hash výpočet, NVM v2 formát). Považuj je za TVRZENÍ k ověření,
ne za fakt.

## Osa 1 — Protokol app↔fw konzistence

Pro každý řádek protokolové tabulky v obou CLAUDE.md ověř v kódu:
- feel-fader.html: najdi `serialRequest`, `_readReply`, `serialReadConfig`,
  `serialReadInfo`, `doSend`, `normalizeFwConfig`, `handleSysEx` — přečti
  jejich těla. Sedí skutečné odesílané/očekávané prefixy (CMD_R, CMD_W,
  CMD_INFO, CMD_HID), formát rid framingu a expect-mapa (CFG/INFO/ACK/ERR)
  s tím, co tvrdí CLAUDE.md?
- code.py/ff_config.py: najdi handler pro příchozí serial řádky (hledej
  "CMD_R", "CMD_W", "CMD_INFO", "CMD_HID", "apply_web_config",
  "_parse_banks", funkci co počítá config_hash). Sedí to s tabulkou?
- Konkrétně ověř: (a) je legacy v1 (bez rid) fire-and-forget pro CMD_W/
  CMD_HID skutečně implementován na obou stranách tak, jak popisuje
  dokument? (b) odpovídá algoritmus config_hash (crc32 nebo FNV-1a
  fallback) na fw straně tomu, co app očekává/ukládá jako opaque token?
  (c) NVM v2 formát (FE EE header, migrace z FE ED) — čte ho loader přesně
  tak, jak popsáno? (d) faders[] pole v CMD_INFO (sync-on-connect) —
  existuje na obou stranách a je volitelné/zpětně kompatibilní jak
  dokument tvrdí?
- Každou neshodu (dokument říká X, kód dělá Y) zapiš jako nález s
  Osa: Protokol konzistence.

## Osa 2 — Bezpečnost & validace vstupů

- Na needitované větvi `control-mode` (feel-fader-app) byl commit
  "fix: escape MIDI output names in control-port picker (XSS via crafted
  virtual-port name)" — ta větev NENÍ mergnutá do main. Zkontroluj main:
  existuje na `main` nějaké místo, kde se MIDI port name, device info
  string, nebo jiný string ze zařízení/browseru vkládá do DOM bez escapování
  (hledej `.innerHTML =` a `.innerHTML +=` v feel-fader.html, pak ověř u
  každého výskytu, jestli vkládaná hodnota může pocházet z MIDI portName,
  bank name, JSON importu, nebo jiného nedůvěryhodného zdroje)?
- Validace configu: co dělá `validate()` v feel-fader.html a odpovídající
  validace v code.py (`apply_web_config` cesta) při: CC mimo 0-127, channel
  mimo 0-15, prázdné/chybějící pole, příliš velký config (too_large cesta),
  malformed JSON? Je validace symetrická na obou stranách, nebo appka
  spoléhá, že firmware validaci nemá a naopak?
- JSON.parse nedůvěryhodných dat: kde appka parsuje odpověď ze zařízení
  (serial/MIDI) bez try/catch nebo bez ověření struktury před použitím?

## Formát výstupu (povinný pro každý nález)

### [ID] — Krátký název
- **Osa:** Protokol konzistence | Bezpečnost
- **Závažnost:** P0 | P1 | P2 | P3
  (P0 = aktivní riziko rozjetí protokolu/bezpečnostní díra/prokazatelně
  nepravdivá dokumentace; P1 = reálný tech-debt; P2 = znatelná nedokonalost;
  P3 = kosmetika)
- **Co:** stručný popis
- **Kde:** repo + soubor + řádek/funkce
- **Proč to vadí:** konkrétní riziko
- **Doporučení:** konkrétní akce
- **Náročnost:** S | M | L — + ⚠️ pokud se dotýká drátového protokolu

ID prefix: "PR-" pro Protokol konzistence, "SEC-" pro Bezpečnost.

Vrať jen formátované nálezy (očekávej 4-12 celkem), žádné shrnutí navíc.
```

- [ ] **Step 2: Hold the returned findings**

Keep the agent's returned findings text (`PR-`/`SEC-` prefixed IDs) for Task 6.

---

### Task 5: Agent dispatch — Doc-vs-kód drift

**Files:** none written by the main thread; dispatched agent only reads.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a findings block (Doc-vs-kód drift axis), for Task 6.

- [ ] **Step 1: Dispatch the agent**

Dispatch alongside Tasks 3 and 4 in the same message (`run_in_background: true`, `subagent_type: "Explore"`), with this exact prompt:

```
Diagnostický, READ-ONLY audit dvou repozitářů. Nesmíš nic editovat ani
vytvářet soubory v žádném z nich. Cílem je vrátit strukturované nálezy.

Repozitáře:
- App: c:\Users\Fanda Borec\Documents\feel-fader-app
- Firmware: c:\Users\Fanda Borec\Documents\feel-fader-firmware

Zkontroluj KAŽDÉ faktické tvrzení (číslo řádku, název funkce, popsané
chování) v těchto souborech proti aktuálnímu kódu:
- feel-fader-app/WEBAPP.md (celý — má tabulku "Klíčové funkce" s čísly
  řádků v sekci 6, a čísla řádků roztroušená po celém dokumentu v textu
  jako "L3144" apod.)
- feel-fader-app/CLAUDE.md
- feel-fader-app/AGENTS.md
- feel-fader-firmware/CLAUDE.md
- feel-fader-firmware/AGENTS.md (pokud existuje — pokud ne, přeskoč)

Pro každé tvrzení typu "funkce X je na řádku Y":
```
grep -n "^function X\|function X(" feel-fader.html
```
a porovnej se skutečným řádkem. I malá odchylka (desítky řádků) je OK a
NENÍ nález — dokument explicitně říká, že čísla řádků driftují s dalšími
commity. Nález piš jen když:
(a) funkce/proměnná zmíněná v dokumentu už v kódu vůbec neexistuje
    (byla přejmenována/smazána a dokument o tom neví — hledej i možné
    nové jméno, než to označíš za nález),
(b) popsané CHOVÁNÍ neodpovídá tomu, co kód skutečně dělá (ne jen číslo
    řádku, ale sémantika — např. dokument popisuje krok, který kód už
    nedělá, nebo dělá jinak),
(c) dokument tvrdí "aktuální stav k DATUM, X řádků" a skutečný počet
    řádků (`wc -l`) se výrazně liší (řádově stovky+ řádků) — to signalizuje,
    že dokument nebyl po tom datu reálně srovnán, i když tvrdí opak.

Zvlášť pozorně: WEBAPP.md tvrdí "Stav (2026-07-12): Všechny odkazy Lxxxx
srovnané proti aktuálnímu souboru (3 466 řádků)" — aktuální feel-fader.html
má teď 5821 řádků. Over, kolik commitů mezi 2026-07-12 a teď (`git log
--oneline --since=2026-07-12`) reálně mohlo přidat ~2350 řádků, a jestli
WEBAPP.md byl od 07-12 vůbec aktualizován (`git log --oneline -- WEBAPP.md
--since=2026-07-12`). Napiš to jako konkrétní nález s jasným rozsahem
(které sekce/tvrzení jsou nejvíc zastaralé).

Zkontroluj taky, jestli firmware CLAUDE.md protokolová tabulka odpovídá
poslední verzi popsané ve feel-fader-app/CLAUDE.md nebo WEBAPP.md sekci 5
(Transport) — jsou to dva nezávislé popisy stejného protokolu v různých
repech, mohly se rozejít jeden od druhého i nezávisle na kódu.

## Formát výstupu (povinný pro každý nález)

### [ID] — Krátký název
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P0 | P1 | P2 | P3
  (P0 = dokument tvrdí něco prokazatelně nepravdivého co by zmátlo
  budoucího agenta/vývojáře v kritické oblasti jako protokol; P1 = reálný
  drift bez bezpečnostního rizika; P2 = drobná nekonzistence; P3 = kosmetika)
- **Co:** stručný popis
- **Kde:** repo + soubor + řádek (dokumentu i kódu)
- **Proč to vadí:** konkrétní riziko
- **Doporučení:** konkrétní akce (co v dokumentu opravit)
- **Náročnost:** S | M | L — + ⚠️ pokud se dotýká drátového protokolu

ID prefix: "DOC-".

Vrať jen formátované nálezy (očekávej 5-15 celkem), žádné shrnutí navíc.
```

- [ ] **Step 2: Hold the returned findings**

Keep the agent's returned findings text (`DOC-` prefixed IDs) for Task 6.

---

### Task 6: Syntéza — finální report

**Files:**
- Create: `c:\Users\Fanda Borec\Documents\feel-fader-app\docs\feel-fader-structure-audit-2026-07-20.md`

**Interfaces:**
- Consumes: Repo-hygiena findings (Task 1), Test-coverage findings (Task 2), Architektura+Dead-code findings (Task 3, IDs `A-`/`D-`), Protokol+Bezpečnost findings (Task 4, IDs `PR-`/`SEC-`), Doc-drift findings (Task 5, IDs `DOC-`).
- Produces: the final report file, committed to `feel-fader-app`.

- [ ] **Step 1: Wait for all three background agents (Tasks 3-5) to complete**

Do not proceed until all three have returned. Do not fabricate or predict their findings.

- [ ] **Step 2: Deduplicate and cross-check**

Some findings from different agents may overlap (e.g., Agent 1's dead-code pass might flag something Agent 3 also flags as doc drift, or Task 2's untested-function list might overlap with Agent 2's protocol-risk findings). Merge duplicates into a single finding, keep the more specific/actionable wording, and note in the merged finding if it spans axes.

- [ ] **Step 3: Assemble the report**

Write `docs/feel-fader-structure-audit-2026-07-20.md` in `feel-fader-app` with this structure (from the spec):

```markdown
# Feel Fader — Strukturní audit (app + firmware): 2026-07-20

> Diagnostický, read-only audit. Doplňuje předchozí UX/product audity
> (feel-fader-ux-audit-2026-06-27.md, feel-fader-product-audit-2026-07-03.md).
> Žádné zásahy do kódu — o dalších krocích rozhoduje majitel.

## Executive summary

[3-5 vzorců napříč nálezy, ne výčet jednotlivostí — např. "dokumentace
soustavně zaostává za rychlostí commitů (X nálezů)", "protokol je
konzistentní/nekonzistentní v bodech Y", "test coverage appky je 0 na
kritické cestě Z"]

## Tabulka nálezů

| ID | Osa | Závažnost | Náročnost | Protokol ⚠️ |
|---|---|---|---|---|
[jeden řádek na nález, řazeno: P0 první, pak P1, P2, P3; v rámci stejné
závažnosti řazeno podle osy]

## Detaily nálezů

### Architektura
[všechny A- nálezy v plném formátu]

### Dead code
[všechny D- nálezy]

### Protokol konzistence
[všechny PR- nálezy]

### Doc-vs-kód drift
[všechny DOC- nálezy]

### Test coverage
[nálezy z Task 2]

### Repo hygiena
[nálezy z Task 1]

### Bezpečnost
[všechny SEC- nálezy]

## Quick wins

[podmnožina nálezů s vysokou důležitostí a náročností S — ideální první
dávka, pokud se majitel rozhodne cokoliv opravit]

## Návrh úklidových vln

**Vlna 1 — bezpečné/nízkoriziko:** [mrtvé větve, dead code, doc drift
opravy — žádná z těchto změn se nedotýká protokolu]

**Vlna 2 — test coverage:** [konkrétní návrh, co a jak pokrýt testy,
založený na Task 2 nálezech]

**Vlna 3 — větší strukturální úvahy:** [POUZE pokud audit našel skutečný,
konkrétní důvod — jinak tuhle sekci napiš jako "Audit nenašel důvod pro
větší strukturální zásah nad rámec Vln 1-2" a nevymýšlej refactor bez
opory v nálezech]
```

- [ ] **Step 4: Commit the report**

```bash
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add docs/feel-fader-structure-audit-2026-07-20.md
git commit -m "docs: structural audit — app + firmware, 7 axes"
```
Expected: clean commit, one new file.

- [ ] **Step 5: Report back to Frank**

Summarize in chat: total finding count by severity, the 3-5 executive-summary patterns, and explicitly flag any P0 findings first. Do not propose starting fixes — the report is the deliverable; Frank decides what happens next (matches the diagnostic-only precedent from the two prior audits).

---

## Self-Review Notes

- **Spec coverage:** all 7 axes from the spec map onto tasks — Architektura/Dead code → Task 3, Protokol/Bezpečnost → Task 4, Doc-drift → Task 5, Test coverage → Task 2, Repo hygiena → Task 1. Rubric and finding format copied verbatim into Global Constraints and into every agent prompt. Output structure in Task 6 matches the spec's "Výstup" section exactly.
- **Placeholder scan:** no TBD/TODO; every step has literal commands or literal prompt text, not descriptions of what to do.
- **Type/ID consistency:** ID prefixes (`A-`, `D-`, `PR-`, `SEC-`, `DOC-`) are defined once in each dispatch task and reused identically in Task 6's report skeleton.
