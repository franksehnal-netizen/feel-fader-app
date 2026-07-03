# Feel Fader Web App — Instrukce pro Claude

## ⚠️ App ↔ Firmware jsou spřažené přes protokol — VŽDY měnit se znalostí OBOU

Web konfigurátor (`feel-fader-app/feel-fader.html`) a firmware (`feel-fader-firmware/code.py`)
sdílí SysEx/serial protokol a formát konfigurace. **Jakákoli změna na jedné straně, která se
dotýká protokolu, formátu configu nebo `enc7`/`dec7`, se MUSÍ promítnout i na druhé straně.**

Před úpravou kterékoli strany načti a zohledni druhou stranu:
- **App** (`feel-fader.html`): `normalizeFwConfig`, `sysexReadConfig`, `sysexWriteConfig`, `handleSysEx`, PC handler (0xC0 → bank sync), `dec7`/`enc7`
- **Firmware** (`code.py`): `apply_web_config`, `send_config_chunks`, serial `CMD_R`/`CMD_W`, `_parse_banks`, `dec7`/`enc7`

Nikdy needituj jen jednu stranu „naslepo" — rozbiješ round-trip config sync.

## Dokumentace

- Architektura a protokol web appky: `WEBAPP.md`
- Firmware + protokolová tabulka a formát configu: `../feel-fader-firmware/CLAUDE.md`
- GitHub: `github.com/franksehnal-netizen/feel-fader-app`
