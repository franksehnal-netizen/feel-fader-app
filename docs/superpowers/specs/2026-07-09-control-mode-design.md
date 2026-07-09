# Control mód — appka jako softwarový MIDI kontroler (design, v1)

**Datum:** 2026-07-09
**Rozsah:** app-only (`feel-fader.html`), **žádná změna protokolu ani firmwaru**, repa oddělená.
**Kontext:** Dnes jsou on-screen fadery jen vizualizace — zrcadlí CC přicházející z HW (`onMidiMsg` → `mF`/`liveValues`), ven appka posílá jen SysEx config po serialu. Frank chce druhý mód: bez HW jde s fadery v appce manipulovat a appka **posílá MIDI** → softwarový kontroler.

## Cíl

Když **není připojený hardware**, umožnit používat web appku jako **softwarový MIDI kontroler** — tahni fadery myší/touchem a appka pošle CC (z aktivní banky) na uživatelem vybraný MIDI výstup (typicky virtuální port do DAWu).

## Kritérium úspěchu

1. Bez HW jde v appce zapnout **control mód**; při zapnutí se vybere cílový MIDI výstupní port (zapamatuje se).
2. Tah faderem v control módu pošle **CC** s číslem + kanálem z **aktivní banky** na vybraný port; hodnotu ověříš v DAW / MIDI monitoru.
3. Je jasně vidět, že appka je v control módu a na který port posílá.
4. Připojení HW během control módu **automaticky** přepne zpět na display (zrcadlení).
5. Nikdy se neposílá SysEx přes MIDI out (respekt k endpoint-wedge nálezu 2026-07-07).

## Dva módy

- **Display (default, dnešek):** on-screen fadery jsou **read-only** zrcadlo — pohybují se podle CC z HW (`onMidiMsg`). Nic neposílá.
- **Control (nový):** on-screen fadery jsou **interaktivní** — tah posílá CC ven. Dostupný **jen když není připojený HW**.

## Aktivace (in-app toggle)

- **Welcome obrazovka beze změny** — „Continue without device" vede do appky v display módu jako dnes.
- **Uvnitř appky** je přepínač control módu, **viditelný/aktivní jen bez připojeného HW**. Umístění: přepínač v oblasti hlavičky (u theme toggle) — globální mód. *(Přesné umístění doladit v implementaci / rychlým mockupem; default = header.)*
- Zapnutí control módu → **výběr portu** (viz níže) → fadery zinteraktivní.

## Výběr výstupního portu

- Při zapnutí control módu appka vylistuje MIDI **výstupy** (`navigator.requestMIDIAccess().outputs`) a nechá uživatele vybrat cílový port (typicky virtuální loopMIDI / IAC).
- Volba se **zapamatuje** (localStorage); příště se předvybere, když existuje.
- **Žádný výstup k dispozici** → nápověda: „Zapni si virtuální MIDI port (loopMIDI na Windows / IAC na Macu) a zkus znovu." Control mód zůstane nedostupný, dokud port není.
- Port jde **později přepnout** z control-mode UI.

## Fadery v control módu

- Tah (myš/touch) přes existující `mF` → nově kromě vizuálu **pošle CC**: `[0xB0 | channel, cc, value]`, kde `cc`/`channel` = z aktivní banky (`fader1`/`fader2`), `value` 0–127.
- **Throttle / coalescing:** CC se odesílá decimovaně (rAF nebo min-interval), vždy **poslední hodnota** — stejný princip jako T4 batching, ale směrem ven. Cíl: neplnit DAW stovkami zpráv/s, žádné zaseknuté fronty.
- **Hodnota zůstává**, kde ji pustíš (absolutní fader, žádný snap-back).
- **Přepnutí banky** mění, jaké CC/kanál fadery posílají (čte z aktivní banky za běhu).
- Enkodér/roller, keyswitch, tlačítko — **mimo v1** (roller v nav módu i macro jsou stejně jen HID/klávesy, ty appka poslat neumí).

## Indikace módu a návrat

- Jasný **indikátor „CONTROL MODE"** + název cílového portu (aby bylo poznat, že appka aktivně streamuje MIDI, ne jen zrcadlí).
- Fadery vizuálně **„živé/aktivní"** (grab kurzor, jemný akcent) vs. read-only mirror v display módu (rozlišení à la audit S8).
- **HW se připojí během control módu** → **auto-přepnutí na display** + toast „Feel Fader připojen — přepínám na zrcadlení". (Control mód = režim bez HW.)
- Uživatel může control mód **ručně vypnout** / změnit port.

## Bezpečnost a hranice

- Posílá se **výhradně CC (0xB0)** na vybraný výstupní port. **Nikdy SysEx přes MIDI out** (Chrome/Windows MIDI Services endpoint wedge, 2026-07-07).
- Control mód je **striktně vázaný na „bez HW"** — s připojeným HW se nenabízí (a auto-vypne), takže nehrozí zdvojení CC (HW + appka naráz) ani posílání do zařízení.
- **App-only:** žádná změna protokolu, formátu configu, `enc7/dec7`, firmwaru.

## Ověření

- **Bez HW:** zapnout control mód → vybrat port (a ověřit chování při 0 dostupných výstupech) → tah faderem → CC dorazí na port se správným CC#/kanálem/hodnotou (MIDI monitor / DAW).
- **Throttle:** rychlý tah / oba fadery → rozumná frekvence zpráv, poslední hodnota vždy doručena, žádné zamrznutí.
- **Přepnutí banky** v control módu → fadery posílají CC/kanál nové banky.
- **HW connect** během control módu → auto-přepnutí na display + toast; on-screen fadery zpět zrcadlí.
- **Regrese display módu:** s HW se nic nezměnilo (fadery zrcadlí, nic neposílají), T4 batching příchozích CC beze změny.
- Headless (puppeteer): control-mode toggle gating na „bez HW", odesílání přes stub MIDI output (zachytit `output.send` volání a ověřit rámce/decimaci).

## Mimo rozsah (v1)

- Roller/enkodér (CC i keyswitch noty), tlačítko/macro.
- Ovládání s **připojeným** HW zároveň (to by chtělo firmware relay — samostatný firmware kus).
- Plná mobilní optimalizace control módu.

## Vztah k ostatní práci

Nezávislé na Vlně 3a i sticky bank baru. Samostatná featura → vlastní větev nad `main` (po mergi Vlny 3a). Implementovat po HW testu.
