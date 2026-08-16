# Feel Fader Web App — kontextový router

## Rozpočet kontextu

- Nikdy nenačítej celý zdrojový soubor. Nejdřív použij `rg -n` na jméno funkce,
  selektor nebo viditelný text a pak čti jen okolní blok.
- `WEBAPP.md`, `docs/`, `scratch/` a historii gitu načítej pouze pro konkrétní
  otázku; nejsou povinným vstupním kontextem.
- Historické Superpowers plány, audity a `.superpowers/` jsou archivní důkaz,
  ne aktuální specifikace. Při jejich cíleném hledání použij `rg --no-ignore`.
- Výchozí režim je jeden agent, jeden cílový výřez a jeden relevantní probe.

## Router podle tématu

| Téma | Otevři |
|---|---|
| HTML struktura / text | cílový výřez `feel-fader.html` |
| Vzhled / responsivita | cílový selektor v inline `<style>` v `feel-fader.html` |
| UI stav / render / interakce | cílovou funkci v inline `<script>` v `feel-fader.html` |
| Regrese | jeden odpovídající `scratch/*-probe.mjs`; seznam viz `scratch/run-all-probes.mjs` |
| Design contract nebo širší architektura | pouze relevantní sekci `WEBAPP.md` |
| Protokol / config round-trip / MIDI / Serial | níže uvedený protocol gate + firmware protokol |

`feel-fader.html` je jediný zdroj pravdy a stránka nemá build krok. Kvůli úspoře
kontextu čti vždy jen cílový výřez; nevytvářej pracovní kopie `app.js`,
`styles.css` ani extrahované assety.

## Protocol gate — kdy je nutný firmware kontext

Firmware (`../feel-fader-firmware`) načti pouze pokud změna zasahuje
`serialRequest`, `_readReply`, `protocolVersion`, `normalizeFwConfig`, config schema,
Program Change/NoteOn handlery nebo `dec7`/`enc7`. Pak otevři protokolovou část
`../feel-fader-firmware/CLAUDE.md` a jen odpovídající symboly v `code.py` či
`ff_config.py` (`apply_web_config`, `send_config_chunks`, `CMD_R`/`CMD_W`,
`parse_banks`, `dec7`/`enc7`). Změna protokolu nebo config formátu se musí
promítnout na obou stranách; cross-repo zápis ale vyžaduje explicitní scope.

Nikdy neposílej SysEx přes MIDI out — na Windows MIDI Services zasekává endpoint
a vyžaduje replug (HW nález 2026-07-07).

## Produktový kontext — appka je desktop-first

Feel Fader web app dává smysl **jen na desktopu s fyzicky připojeným controllerem** (Web Serial + reálné zařízení). Mobil není produktový scénář.

- UI/UX návrhy a audity **prioritizuj pro desktop s připojeným HW**.
- Mobil držet jen regresně funkční a nerozbitý — **neoptimalizovat** ho jako samostatný pracovní workflow.
- Konkrétně: mobilní překryv status baru není problém k řešení (Frank 2026-07-14).

## Browser ověření — eskalační žebřík

1. Statická kontrola cílového výřezu.
2. Nejmenší existující `.mjs` Puppeteer probe přes
   `npm test -- <probe.mjs>` (včetně případného prefixu `audit/`).
3. Nový/rozšířený probe, pokud chybí regresní důkaz.
4. `npm test` před předáním širší změny.
5. Chrome DevTools MCP zapni pouze pro živý problém, který probe nevysvětluje
   (console, network, performance nebo interaktivní stav).

**Invariant — MCP nikdy nesahá na reálný HW.** MCP-driven session běží přes stejný interní-stav-poke vzor jako probes (`_midiState = 'granted'; _ffConnected = true; _serialPort = {}; connState(); renderConnState();` přes `evaluate`). **Nikdy** reálný `navigator.serial.requestPort()` + SysEx přes MCP → zasekne MIDI endpoint (chce replug, HW nález 2026-07-07). Reálný HW test zůstává ruční, mimo MCP.

**Mechanika:** `.mcp.json` obsahuje jen Chrome DevTools a je cwd-scoped. Server
pro probes běží na `:8100` (`http://localhost:8100/feel-fader.html`).

## Dokumentace

- Architektura a design contract web appky: `WEBAPP.md`
- Firmware + protokolová tabulka a formát configu: `../feel-fader-firmware/CLAUDE.md`
- GitHub: `github.com/franksehnal-netizen/feel-fader-app`
