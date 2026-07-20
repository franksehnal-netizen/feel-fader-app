# Feel Fader Web App — Instrukce pro Claude

## ⚠️ App ↔ Firmware jsou spřažené přes protokol — VŽDY měnit se znalostí OBOU

Web konfigurátor (`feel-fader-app/feel-fader.html`) a firmware (`feel-fader-firmware/code.py`)
sdílí SysEx/serial protokol a formát konfigurace. **Jakákoli změna na jedné straně, která se
dotýká protokolu, formátu configu nebo `enc7`/`dec7`, se MUSÍ promítnout i na druhé straně.**

Před úpravou kterékoli strany načti a zohledni druhou stranu:
- **App** (`feel-fader.html`): `serialRequest`/`_readReply` (transaction manager, jediné místo čtoucí serial), `protocolVersion` (bootstrap z legacy CMD_INFO), `normalizeFwConfig` (vč. meta `m`), PC handler (0xC0 → bank sync), NoteOn handler (keyswitch live), `dec7`/`enc7`. Protokol v2 tabulka: `../feel-fader-firmware/CLAUDE.md`. POZOR: nikdy neposílat SysEx přes MIDI out (zasekává MIDI endpoint přes Windows MIDI Services — HW nález 2026-07-07).
- **Firmware**: `apply_web_config` (`code.py`), `send_config_chunks` (`code.py`), serial `CMD_R`/`CMD_W` (`code.py`), `parse_banks` (`ff_config.py` — ne `code.py`), `dec7`/`enc7` (`code.py`)

Nikdy needituj jen jednu stranu „naslepo" — rozbiješ round-trip config sync.

## Vývoj přes MCP (Chrome DevTools + Playwright)

Tři vrstvy, jasně oddělené role. **MCP zkoumá živě, probe je důkaz.**

| Nástroj | Role | Kdy |
|---|---|---|
| **Chrome DevTools MCP** | *oči* — live console/exceptions, network, performance, `evaluate` stavu | debug běžícího stavu („proč je to teď rozbité") |
| **Playwright MCP** | *ruce* — a11y snapshot (levný strukturovaný sken UI), robustní klik/klávesnice/wait | budování a ověřování interakčních flow |
| **`.mjs` puppeteer probe** (`scratch/`) | *důkaz* — committed, headless, deterministické PASS/FAIL | regrese: ověřené chování zakóduj sem a commitni |

Smyčka: Chrome DevTools MCP debug → Playwright MCP vyzkouší flow → `.mjs` probe zakóduje regresi → commit.

**Invariant — MCP nikdy nesahá na reálný HW.** MCP-driven session běží přes stejný interní-stav-poke vzor jako probes (`_midiState = 'granted'; _ffConnected = true; _serialPort = {}; connState(); renderConnState();` přes `evaluate`). **Nikdy** reálný `navigator.serial.requestPort()` + SysEx přes MCP → zasekne MIDI endpoint (chce replug, HW nález 2026-07-07). Reálný HW test zůstává ruční, mimo MCP.

**Mechanika:** zapínat per-task přes `/mcp` (ne oba trvale — tokeny + dva browsery) · Playwright cílit na `channel: chrome` (appka je Chrome/Edge-only kvůli Web Serial) · server na `:8100` (`http://localhost:8100/feel-fader.html`).

## Dokumentace

- Architektura a protokol web appky: `WEBAPP.md`
- Firmware + protokolová tabulka a formát configu: `../feel-fader-firmware/CLAUDE.md`
- GitHub: `github.com/franksehnal-netizen/feel-fader-app`
