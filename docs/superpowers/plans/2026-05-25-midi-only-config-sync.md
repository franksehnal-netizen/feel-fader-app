# MIDI-only Config Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Odstranit Web Serial API a port picker — veškerá komunikace (čtení i zápis configu) přechází na MIDI SysEx s chunked protokolem.

**Architecture:** Firmware přidá `send_config_chunks()` (128-byte kousky, každý jako CMD_CHUNK SysEx), `send_ack()`, `send_err()`. App přidá chunk buffer + Promise-based `sysexReadConfig()` / `sysexWriteConfig()`. `doLoad()` a `doSend()` přestanou volat Serial a použijí nové SysEx funkce. Celý Serial blok (~80 řádků) se smaže z app i firmware.

**Tech Stack:** CircuitPython (Pico 2), Web MIDI API, vanilla JS (single HTML), adafruit_midi

---

## Existující protokol (reference)

```
SysEx formát: [0xF0, MFR, DEV_ID, CMD, ...enc7(payload)..., 0xF7]
MFR=0x7D, DEV_ID=0x01
CMD_W=0x01, CMD_R=0x02, CMD_INFO=0x03  ← existují
CMD_CHUNK=0x04, CMD_ACK=0x05, CMD_ERR=0x06  ← nové

enc7: každý byte → 2 MIDI bytes: [(b>>7)&1, b&0x7F]
dec7: každá dvojice → 1 byte: (hi<<7)|lo
```

---

## Task 1: Firmware — nové konstanty + update send_info_sysex

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-firmware\code.py:50-55`

- [ ] **Přidej CMD_CHUNK, CMD_ACK, CMD_ERR za existující konstanty**

Najdi blok (řádky ~50–54):
```python
MFR          = 0x7D   # non-commercial manufacturer ID (shodný s webovou appkou)
DEV_ID       = 0x01
CMD_W        = 0x01   # write config  (web → device nebo device → web)
CMD_R        = 0x02   # request config (web → device: "pošli mi svůj config")
CMD_INFO     = 0x03   # device info (SysEx)
FIRMWARE_VER = "1.0.0"
MODEL_ID     = "FF"
```

Nahraď za:
```python
MFR          = 0x7D   # non-commercial manufacturer ID (shodný s webovou appkou)
DEV_ID       = 0x01
CMD_W        = 0x01   # write config  (web → device nebo device → web)
CMD_R        = 0x02   # request config (web → device: "pošli mi svůj config")
CMD_INFO     = 0x03   # device info (SysEx)
CMD_CHUNK    = 0x04   # config chunk (device → web, odpověď na CMD_R)
CMD_ACK      = 0x05   # potvrzení CMD_W (device → web)
CMD_ERR      = 0x06   # chyba (device → web)
FIRMWARE_VER = "1.0.0"
MODEL_ID     = "FF"
```

- [ ] **Update send_info_sysex() — přidej serial a model do payloadu**

Najdi (řádky ~249–256):
```python
def send_info_sysex():
    """Odešle info o zařízení (odpověď na CMD_INFO). Jen info, config sync je přes serial."""
    try:
        payload = enc7(list(json.dumps({"firmware": FIRMWARE_VER}).encode("utf-8")))
        sysex = bytes([0xF0, MFR, DEV_ID, CMD_INFO] + payload + [0xF7])
        usb_midi.ports[1].write(sysex)
    except Exception:
        pass
```

Nahraď za:
```python
def send_info_sysex():
    """Odešle info o zařízení (odpověď na CMD_INFO)."""
    try:
        try:
            uid_bytes = bytes(microcontroller.cpu.uid)
            serial_str = "".join("{:02X}".format(b) for b in uid_bytes)
        except Exception:
            serial_str = None
        info = {"firmware": FIRMWARE_VER, "model": MODEL_ID}
        if serial_str:
            info["serial"] = serial_str
        payload = enc7(list(json.dumps(info).encode("utf-8")))
        sysex = bytes([0xF0, MFR, DEV_ID, CMD_INFO] + payload + [0xF7])
        usb_midi.ports[1].write(sysex)
    except Exception:
        pass
```

- [ ] **Ulož soubor, ověř že Pico se restartuje bez chyby**

  V Mu editoru / Thonny zkontroluj serial konzoli — nesmí být žádná SyntaxError ani NameError.

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
git add code.py
git commit -m "feat: add CMD_CHUNK/ACK/ERR constants, send serial+model in CMD_INFO"
```

---

## Task 2: Firmware — send_config_chunks, send_ack, send_err + update handle_sysex

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-firmware\code.py` (sekce SYSEX ENCODE/DECODE a handle_sysex)

- [ ] **Přidej tři nové funkce za send_info_sysex()**

Za celý blok `send_info_sysex()` (přibližně řádek 257) vlož:

```python
def send_config_chunks():
    """Pošle aktuální config jako sekvenci CMD_CHUNK SysEx zpráv (128 bytů/chunk)."""
    CHUNK_SIZE = 128
    data = json.dumps({"banks": banks}).encode("utf-8")
    total = max(1, (len(data) + CHUNK_SIZE - 1) // CHUNK_SIZE)
    for idx in range(total):
        chunk = list(data[idx * CHUNK_SIZE:(idx + 1) * CHUNK_SIZE])
        payload = enc7(chunk)
        sysex = bytes([0xF0, MFR, DEV_ID, CMD_CHUNK, idx, total] + payload + [0xF7])
        usb_midi.ports[1].write(sysex)
        time.sleep(0.01)

def send_ack():
    try:
        usb_midi.ports[1].write(bytes([0xF0, MFR, DEV_ID, CMD_ACK, 0xF7]))
    except Exception:
        pass

def send_err():
    try:
        usb_midi.ports[1].write(bytes([0xF0, MFR, DEV_ID, CMD_ERR, 0xF7]))
    except Exception:
        pass
```

- [ ] **Update handle_sysex() — CMD_R a CMD_W větve**

Najdi (řádky ~273–285):
```python
    if cmd == CMD_W:
        try:
            web_cfg = json.loads(bytes(dec7(payload)).decode("utf-8"))
            if apply_web_config(web_cfg):
                save_presets()
        except Exception:
            pass

    elif cmd == CMD_R:
        pass  # SysEx odpověď Pico→Chrome na Windows nefunguje; config sync přes serial

    elif cmd == CMD_INFO:
        send_info_sysex()
```

Nahraď za:
```python
    if cmd == CMD_W:
        try:
            web_cfg = json.loads(bytes(dec7(payload)).decode("utf-8"))
            if apply_web_config(web_cfg):
                save_presets()
                send_ack()
            else:
                send_err()
        except Exception:
            send_err()

    elif cmd == CMD_R:
        send_config_chunks()

    elif cmd == CMD_INFO:
        send_info_sysex()
```

- [ ] **Ověř funkčnost — manuální test přes browser console**

  1. Připoj Feel Fader, otevři feel-fader.html v Chrome
  2. Otevři DevTools → Console
  3. Vyber MIDI output (musí být připojen), pak vlož do konzole:

```javascript
// Získej MIDI output pro Feel Fader
const acc = await navigator.requestMIDIAccess({sysex:true});
const out = [...acc.outputs.values()].find(o => o.name.toLowerCase().includes('feel'));
console.log('Output found:', out?.name);

// Pošli CMD_R (0x02) — Pico by měl odpovědět CMD_CHUNK zprávami
out.send([0xF0, 0x7D, 0x01, 0x02, 0xF7]);
console.log('CMD_R sent — sleduj příchozí MIDI zprávy');
```

  4. V MIDIInput listeneru (nebo přes `onmidimessage`) zkontroluj, že přicházejí zprávy začínající `[0xF0, 0x7D, 0x01, 0x04, ...]` (CMD_CHUNK=0x04)
  5. Pokud přicházejí chunky → Task 2 funguje ✓

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
git add code.py
git commit -m "feat: implement send_config_chunks, send_ack/err, wire CMD_R/CMD_W SysEx"
```

---

## Task 3: App — nové konstanty + chunk stav + handleSysEx rozšíření

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html:1907` (SysEx sekce)

- [ ] **Přidej nové konstanty a stav za existující řádek s konstantami**

Najdi (řádek ~1907):
```javascript
const MFR=0x7D,DEV_ID=0x01,CMD_W=0x01,CMD_R=0x02,CMD_INFO=0x03;
```

Nahraď za:
```javascript
const MFR=0x7D,DEV_ID=0x01,CMD_W=0x01,CMD_R=0x02,CMD_INFO=0x03,CMD_CHUNK=0x04,CMD_ACK=0x05,CMD_ERR=0x06;
let _pendingRead  = null;  // { resolve, reject, timer }
let _pendingWrite = null;  // { resolve, reject, timer }
let _chunkBuf     = null;  // { chunks: Array, received: number, total: number }
```

- [ ] **Přidej větve pro CMD_CHUNK, CMD_ACK, CMD_ERR do handleSysEx()**

Najdi konec handleSysEx — řádek s `if(cmd===CMD_INFO){...}` blokem (řádky ~1962–1972). Za celý tento blok (ale stále uvnitř funkce, před uzavírací `}`) vlož:

```javascript
  if(cmd===CMD_CHUNK){
    const idx        = payload[0];
    const total      = payload[1];
    const chunkBytes = payload.slice(2);
    if(!_chunkBuf || _chunkBuf.total !== total){
      _chunkBuf = { chunks: new Array(total).fill(null), received: 0, total };
    }
    if(_chunkBuf.chunks[idx] === null){
      _chunkBuf.chunks[idx] = chunkBytes;
      _chunkBuf.received++;
    }
    if(_chunkBuf.received === _chunkBuf.total && _pendingRead){
      clearTimeout(_pendingRead.timer);
      const all = [].concat(..._chunkBuf.chunks);
      const jsonStr = new TextDecoder().decode(new Uint8Array(dec7(all)));
      const pr = _pendingRead;
      _pendingRead = null; _chunkBuf = null;
      pr.resolve(jsonStr);
    }
  }
  if(cmd===CMD_ACK && _pendingWrite){
    clearTimeout(_pendingWrite.timer);
    const pw = _pendingWrite; _pendingWrite = null;
    pw.resolve();
  }
  if(cmd===CMD_ERR && _pendingWrite){
    clearTimeout(_pendingWrite.timer);
    const pw = _pendingWrite; _pendingWrite = null;
    pw.reject(new Error('Device rejected config'));
  }
```

- [ ] **Ověř v browser console — chunk buffer správně sestavuje JSON**

  1. Otevři feel-fader.html, otevři DevTools Console
  2. Připoj Feel Fader (musí svítit MIDI banner)
  3. Vlož test:

```javascript
// Simuluj příchod 2 CMD_CHUNK zpráv ručně (bez fyzického zařízení)
_chunkBuf = null;
_pendingRead = { resolve: (j) => console.log('ASSEMBLED:', j), reject: console.error, timer: null };

// chunk 0/2
handleSysEx(new Uint8Array([0xF0, 0x7D, 0x01, 0x04, 0, 2, ...enc7(Array.from(new TextEncoder().encode('{"banks":['))), 0xF7]));
// chunk 1/2
handleSysEx(new Uint8Array([0xF0, 0x7D, 0x01, 0x04, 1, 2, ...enc7(Array.from(new TextEncoder().encode(']}'))) , 0xF7]));
// Očekávaný výstup: ASSEMBLED: {"banks":[]}
```

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add feel-fader.html
git commit -m "feat: add CMD_CHUNK/ACK/ERR handling and chunk buffer in app"
```

---

## Task 4: App — sysexReadConfig() a sysexWriteConfig()

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html` (SysEx sekce, za handleSysEx)

- [ ] **Vlož obě funkce za konec handleSysEx()**

Za uzavírací `}` funkce handleSysEx vlož:

```javascript
async function sysexReadConfig(){
  const out=getOut();
  if(!out) throw new Error('No MIDI output — connect Feel Fader first');
  return new Promise((resolve,reject)=>{
    _chunkBuf=null;
    _pendingRead={
      resolve,reject,
      timer:setTimeout(()=>{
        _pendingRead=null;_chunkBuf=null;
        reject(new Error('Timeout — no response from device'));
      },5000)
    };
    out.send([0xF0,MFR,DEV_ID,CMD_R,0xF7]);
  });
}

async function sysexWriteConfig(cfg){
  const out=getOut();
  if(!out) throw new Error('No MIDI output — connect Feel Fader first');
  return new Promise((resolve,reject)=>{
    _pendingWrite={
      resolve,reject,
      timer:setTimeout(()=>{
        _pendingWrite=null;
        reject(new Error('Timeout — no ACK from device'));
      },5000)
    };
    const bytes=Array.from(new TextEncoder().encode(JSON.stringify(cfg)));
    out.send([0xF0,MFR,DEV_ID,CMD_W,...enc7(bytes),0xF7]);
  });
}
```

- [ ] **Ověř sysexReadConfig() v browser console (se zapojeným zařízením)**

```javascript
// V DevTools Console — Feel Fader musí být připojen
try {
  const json = await sysexReadConfig();
  console.log('Config received:', JSON.parse(json));
} catch(e) {
  console.error('Failed:', e.message);
}
// Očekávaný výstup: Config received: { banks: [...] }
```

- [ ] **Ověř sysexWriteConfig() v browser console**

```javascript
// Pošli aktuální config zpět na zařízení a čekej na ACK
try {
  await sysexWriteConfig(cfg);
  console.log('Write ACK received');
} catch(e) {
  console.error('Write failed:', e.message);
}
// Očekávaný výstup: Write ACK received
```

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add feel-fader.html
git commit -m "feat: add sysexReadConfig() and sysexWriteConfig() Promise-based functions"
```

---

## Task 5: App — update doLoad() a doSend()

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html:2038-2091`

- [ ] **Nahraď doLoad() celou funkcí**

Najdi a nahraď celou funkci `doLoad()` (řádky ~2038–2071):

```javascript
async function doLoad() {
  const btn = document.getElementById('load-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…loading'; }
  try {
    const jsonStr = await sysexReadConfig();
    let p = JSON.parse(jsonStr);
    if (!p.banks) throw new Error('Invalid structure');
    p = normalizeFwConfig(p);
    cfg = p; loaded = true; dirty = false; activeBank = 0;
    render();
    setBanner('connected', t('midi.synced'));
    updateStatus();
    toast('s', t('toast.config_loaded'));
    if (btn) { btn.textContent = '✓ loaded'; setTimeout(() => { btn.disabled = false; btn.textContent = 'load from device'; }, 1500); }
  } catch(e) {
    console.warn('[SysEx] load failed:', e);
    toast('e', 'Load failed: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'load from device'; }
  }
}
```

- [ ] **Nahraď doSend() celou funkcí**

Najdi a nahraď celou funkci `doSend()` (řádky ~2073–2092):

```javascript
async function doSend() {
  if (validate().length) { toast('e', t('toast.fix_errors')); return; }
  const btn = document.getElementById('send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…sending'; btn.style.background = ''; }
  try {
    await sysexWriteConfig(cfg);
    dirty = false;
    toast('s', t('toast.config_sent'));
    if (btn) {
      btn.textContent = '✓ sent'; btn.style.background = '#3a7a3a';
      setTimeout(() => { btn.disabled = false; btn.textContent = t('btn.send'); btn.style.background = ''; }, 1500);
    }
  } catch(e) {
    console.warn('[SysEx] send failed:', e);
    toast('e', 'Send failed: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = t('btn.send'); btn.style.background = ''; }
  }
}
```

- [ ] **Ověř v prohlížeči — klikni "load from device" a "send to device"**

  - Load: konfigurační data se načtou, banner zobrazí "Connected and synchronized"
  - Send: konfigurace se odešle, toast "Config sent"
  - Nesmí se zobrazit žádný port picker

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add feel-fader.html
git commit -m "feat: doLoad/doSend now use SysEx instead of Serial"
```

---

## Task 6: App — smaž celý Serial blok

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html:1975-2036`

- [ ] **Smaž celý blok Web Serial API (přibližně 60 řádků)**

Najdi a smaž vše od komentáře po funkci `_tryFetchDeviceInfo`:

```javascript
// ═══════════════════════════════════════════════════════════
// SERIAL (Web Serial API — config sync Pico→browser)
// ═══════════════════════════════════════════════════════════
let _serialPort = null;

async function _serialOpen() {
  ...
}

async function _serialClose() {
  ...
}

async function _serialCmd(cmd, timeoutMs = 4000) {
  ...
}

// Auto-handshake: called on MIDI connect. Uses only getPorts() (no user gesture needed).
// Silently skips if port not yet paired — data will populate on first doLoad() instead.
async function _tryFetchDeviceInfo() {
  ...
}
```

(Smaž celý tento blok — od řádku `// SERIAL` po uzavírající `}` funkce `_tryFetchDeviceInfo`.)

- [ ] **Ověř že soubor nemá SyntaxError**

  Otevři feel-fader.html v Chrome, zkontroluj Console — nesmí být žádná chyba.

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add feel-fader.html
git commit -m "feat: remove Web Serial API code (_serialPort, _serialCmd, _tryFetchDeviceInfo)"
```

---

## Task 7: App — nahraď _tryFetchDeviceInfo voláním CMD_INFO přes SysEx v connectInputs()

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-app\feel-fader.html` (funkce connectInputs, řádek ~1809)

- [ ] **Přidej helper _requestDeviceInfoSysex() do SysEx sekce**

Za konstanty (řádek s `const MFR=...`) přidej:

```javascript
function _requestDeviceInfoSysex(){
  const out=getOut();
  if(out) try{ out.send([0xF0,MFR,DEV_ID,CMD_INFO,0xF7]); }catch(e){}
}
```

- [ ] **Nahraď volání _tryFetchDeviceInfo() za _requestDeviceInfoSysex() v connectInputs()**

Najdi v connectInputs() (řádek ~1809):
```javascript
      _tryFetchDeviceInfo(); // fire-and-forget — populates Device Info without user clicking load
```

Nahraď za:
```javascript
      _requestDeviceInfoSysex(); // request CMD_INFO via SysEx — no Serial needed
```

- [ ] **Ověř v prohlížeči — Device Info sekce se vyplní po připojení**

  Připoj Feel Fader → v Device Info panelu se zobrazí firmware verze, serial number a model — bez jakéhokoli port pickeru.

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git add feel-fader.html
git commit -m "feat: request CMD_INFO via SysEx on MIDI connect, remove Serial handshake"
```

---

## Task 8: Firmware — smaž Serial smyčku + usb_cdc import

**Files:**
- Modify: `c:\Users\Fanda Borec\Documents\feel-fader-firmware\code.py`

- [ ] **Smaž celý blok Serial config sync v hlavní smyčce**

Najdi a smaž (řádky ~460–489):

```python
    # --- SERIAL CONFIG SYNC (usb_cdc.data port, Web Serial API) ---
    if usb_cdc.data and usb_cdc.data.in_waiting:
        try:
            usb_cdc.data.timeout = 0.5   # dej čas na příchod celého řádku (velký CMD_W)
            line = usb_cdc.data.readline().decode("utf-8").strip()
            usb_cdc.data.timeout = 0     # vrať na non-blocking
            if line == "CMD_I":
                ...
            elif line == "CMD_R":
                ...
            elif line.startswith("CMD_W:"):
                ...
        except Exception as e:
            try:
                usb_cdc.data.write(b"ERR\n")
            except Exception:
                pass
```

- [ ] **Smaž import usb_cdc z code.py**

Najdi (řádek ~6):
```python
import usb_cdc
```
Smaž tento řádek. (usb_cdc zůstane v boot.py pro console — v code.py již není potřeba.)

- [ ] **Ověř že Pico se restartuje bez chyby**

  Serial konzole Pica nesmí zobrazit NameError ani ImportError.

- [ ] **Commit**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
git add code.py
git commit -m "feat: remove Web Serial (usb_cdc.data) handling from main loop"
```

---

## Task 9: End-to-end integrační test

- [ ] **Test A — první připojení (čistý profil)**

  1. Otevři Chrome v Incognito okně (žádná MIDI oprávnění)
  2. Otevři feel-fader.html (nebo acoustic-empire.cz verzi)
  3. Připoj Feel Fader přes USB
  4. Chrome zobrazí MIDI permission dialog → klikni "Allow"
  5. Banner přejde na "Connected"
  6. Klikni "load from device"
  7. **Ověř:** Nenabídne se žádný port picker. Config se načte.

- [ ] **Test B — opakované připojení**

  1. Zavři a znovu otevři tab
  2. Připoj Feel Fader
  3. **Ověř:** Žádný dialog, žádný picker — banner přejde automaticky na "Connected".

- [ ] **Test C — zápis konfigurace**

  1. Změň MIDI CC hodnotu v UI
  2. Klikni "Send to device"
  3. **Ověř:** Toast "Config sent", žádný picker, fader na zařízení reaguje na nový CC.

- [ ] **Test D — Device Info**

  1. V Device Info panelu zkontroluj firmware verze, serial number, model
  2. **Ověř:** Hodnoty jsou vyplněné (ne "—") ihned po připojení.

- [ ] **Test E — pojmenování v Chrome MIDI permission dialogu**

  1. V Incognito — zkontroluj text MIDI permission dialogu
  2. **Ověř:** Zařízení se jmenuje "Feel Fader" (ne "CircuitPython CDC control")

- [ ] **Pokud všechny testy projdou — push obou repozitářů**

```
cd "c:\Users\Fanda Borec\Documents\feel-fader-app"
git push

cd "c:\Users\Fanda Borec\Documents\feel-fader-firmware"
git push
```
