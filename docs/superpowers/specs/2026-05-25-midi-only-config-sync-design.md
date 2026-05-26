# Design Spec: MIDI-only Config Sync

**Datum:** 2026-05-25  
**Repo:** feel-fader-app + feel-fader-firmware  
**Cíl:** Eliminovat Web Serial API a port picker. Veškerá komunikace jde přes MIDI SysEx.

---

## Problém

`doLoad()` a `doSend()` používají Web Serial API (`_serialCmd`), které při prvním připojení zobrazí picker se dvěma nejasně pojmenovanými porty:
- "CircuitPython CDC control (COM4)"
- "CircuitPython CDC2 control (COM5)"

Toto je matoucí pro uživatele a nelze to automatizovat — prohlížeč vyžaduje výběr portu uživatelem.

---

## Řešení

Přesunout **veškerou komunikaci** na MIDI SysEx. Web Serial zcela odstranit.

MIDI se připojuje automaticky — appka již má `isFeelFader()` logiku a Web MIDI connection handling. Po povolení MIDI přístupu (jednoduché "Allow" dialogové okno, jednou) funguje vše automaticky.

---

## Existující SysEx protokol

```
[0xF0, MFR, DEV_ID, CMD, ...enc7(payload)..., 0xF7]

MFR    = 0x7D  (non-commercial)
DEV_ID = 0x01
CMD:
  0x01 = CMD_W   (zápis konfigurace, app→pico)
  0x02 = CMD_R   (žádost o config, app→pico) — nové použití
  0x03 = CMD_INFO (info o zařízení, obousměrně)
```

Payload je JSON enkódovaný přes `enc7` (7-bit safe encoding, každý byte → 2 MIDI bytes).

---

## Proč velký SysEx Pico→Chrome nefunguje

USB MIDI posílá data v paketech po 64 bytech. Velká SysEx zpráva (config JSON = 500–2000 bytů) se fragmentuje. CircuitPython zřejmě neflushuje pakety správně, nebo Chrome/Windows neassembluje fragmenty správně.

**Řešení: chunked SysEx** — config se rozdělí na malé kusy, každý jako samostatná SysEx zpráva.

---

## Nový SysEx protokol — rozšíření

### Nové CMD hodnoty

```
CMD_R      = 0x02  (app→pico: "pošli mi config")
CMD_CHUNK  = 0x04  (pico→app: jeden chunk config dat)
CMD_ACK    = 0x05  (pico→app: potvrzení CMD_W)
CMD_ERR    = 0x06  (pico→app: chyba)
```

### Čtení konfigurace (CMD_R flow)

```
App → Pico:  [0xF0, MFR, DEV_ID, CMD_R, 0xF7]

Pico → App:  [0xF0, MFR, DEV_ID, CMD_CHUNK, idx_lo, idx_hi, total_lo, total_hi, ...enc7(chunk)..., 0xF7]
             (opakováno pro každý chunk)

idx   = index chunku (0-based), little-endian 2 byty (7-bit safe)
total = celkový počet chunků, little-endian 2 byty (7-bit safe)
```

Velikost jednoho chunky (JSON bytů před enc7): **128 bytů**. Po enc7 = max 256 MIDI bytů. Celková SysEx zpráva ~262 bytů — bezpečně pod USB MIDI limitem.

### Zápis konfigurace (CMD_W flow)

```
App → Pico:  [0xF0, MFR, DEV_ID, CMD_W, ...enc7(JSON)..., 0xF7]
             (existující, beze změny)

Pico → App:  [0xF0, MFR, DEV_ID, CMD_ACK, 0xF7]   ← nové
          nebo [0xF0, MFR, DEV_ID, CMD_ERR, 0xF7]
```

### Timeout

App čeká na CMD_CHUNK / CMD_ACK / CMD_ERR max **5 sekund**. Po timeoutu zobrazí chybu.

---

## Změny — App (feel-fader.html)

### Přidat

- `CMD_R`, `CMD_CHUNK`, `CMD_ACK`, `CMD_ERR` konstanty
- `sysexReadConfig()` — pošle CMD_R, sbírá CMD_CHUNK zprávy, sestaví JSON, vrátí Promise
- `sysexWriteConfig(cfg)` — pošle CMD_W, čeká na CMD_ACK/CMD_ERR, vrátí Promise
- V `handleSysEx()`: větve pro CMD_CHUNK, CMD_ACK, CMD_ERR
- Chunk buffer: `let _chunkBuf = { chunks: [], total: null }` (reset při každém CMD_R)

### Upravit

- `doLoad()` — nahradit `_serialCmd('CMD_R')` voláním `sysexReadConfig()`
- `doSend()` — nahradit `_serialCmd('CMD_W:...')` voláním `sysexWriteConfig(cfg)`
- `doLoad()` — nahradit `_serialCmd('CMD_I')` voláním `requestInfoSysex()` (existuje)

### Smazat

- `_serialPort`, `_serialOpen()`, `_serialClose()`, `_serialCmd()` — celý blok (~40 řádků)
- `silentSerialHandshake()` — serial auto-handshake při MIDI connect
- Část `doLoad()` která volá `_serialCmd('CMD_I')`

---

## Změny — Firmware (code.py)

### Přidat

- `CMD_R = 0x02`, `CMD_CHUNK = 0x04`, `CMD_ACK = 0x05`, `CMD_ERR = 0x06` konstanty
- `send_config_chunks()` — načte config ze souboru, rozdělí na 128-bytové chunky, pošle každý jako CMD_CHUNK SysEx
- `send_ack()` / `send_err()` — odešle CMD_ACK nebo CMD_ERR SysEx

### Upravit

- `handle_sysex()`: přidat větev pro `CMD_R` → volá `send_config_chunks()`
- `handle_sysex()`: větev pro `CMD_W` → po uložení volá `send_ack()` místo `pass`

### Smazat

- Celý blok `if usb_cdc.data and usb_cdc.data.in_waiting:` v hlavní smyčce (~30 řádků)
- Import `usb_cdc` z `code.py` (zůstane pouze v `boot.py` pro console)

### Poznámka k boot.py

`usb_cdc.enable(console=True, data=True)` v `boot.py` — data port lze v PROD módu zakázat (`data=False`) jakmile Serial není potřeba. Toto je volitelná optimalizace po úspěšném přechodu.

---

## Změny — Firmware (boot.py)

Žádné nutné změny pro základní funkčnost. Volitelně: `usb_cdc.enable(console=True, data=False)` v PROD módu.

---

## Co se nezmění

- Web MIDI připojení a `isFeelFader()` logika — beze změny
- CMD_INFO / `send_info_sysex()` / `requestInfoSysex()` — beze změny  
- `enc7` / `dec7` encoding — beze změny
- `sendSysEx()` (existující CMD_W) — zachován, `doSend()` ho zavolá

---

## User experience po změně

| Situace | Dnes | Po změně |
|---|---|---|
| První připojení | Port picker (matoucí) | MIDI "Allow" dialog |
| Každé další připojení | Automatické (Serial již granted) | Automatické (MIDI) |
| Pojmenování zařízení | "CircuitPython CDC control" | "Feel Fader" (MIDI název) |
| Závislost na Chrome | Ano (Web Serial + Web MIDI) | Ano (jen Web MIDI) |

---

## Rizika a mitigace

| Riziko | Mitigace |
|---|---|
| CMD_CHUNK zprávy stále nefungují na Windows | Testovat hned v prvním kroku; chunk 128b je konzervativní |
| Race condition — chunky přijdou mimo pořadí | MIDI je ordered (USB MIDI = spolehlivá fronty), pořadí garantováno |
| Config příliš velký (>50 chunků) | Současný config je ~1KB → ~8 chunků. Nepravděpodobné. |
| Zpětná kompatibilita starého firmware | `doLoad()` může fallback na Serial pokud MIDI read selže (volitelné) |
