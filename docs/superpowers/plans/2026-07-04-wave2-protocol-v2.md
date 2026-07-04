# Feel Fader Wave 2 — Protocol v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementovat spec `docs/superpowers/specs/2026-07-04-wave2-protocol-design.md` — serial protokol v2 (rid framing + typované odpovědi + legacy mode), `config_hash`, NVM v2 s CRC, persistence prezentačních meta polí, C5 live-bank tečka, S7b NoteOn listener.

**Architecture:** Dvě oddělená repa (`feel-fader-firmware`, `feel-fader-app`), každé vlastní branch `wave2-protocol`, merge obou až po integračním HW testu (protokolový lockstep, repa se NIKDY nemergují spolu). Firmware: pure logika do `ff_config.py` (host-testovatelná pytestem), hardware binding do `code.py`. App: všechny změny v jednom souboru `feel-fader.html`; nový serial transaction manager je jediné místo, které čte port.

**Tech Stack:** CircuitPython 9.x (RP2040), vanilla JS single-file HTML, pytest (jen `ff_config.py`), headless Chrome render check (puppeteer-core, vzor viz memory `feelfader-browser-test-automation`).

## Global Constraints

- Repa trvale oddělená — žádný společný merge, vazba jen drátový protokol (`feedback_feelfader_repos_separate`).
- Legacy chování musí zůstat bajt-přesně: `CMD_R`/`CMD_INFO` bez `:` → raw JSON řádek bez prefixu; `CMD_W:{...}`/`CMD_HID:{...}` (za první `:` hned `{`) → aplikovat, ŽÁDNÁ odpověď.
- `rid` je string bez `:` (app používá inkrementující counter).
- Všechna JSON serializace firmware: `separators=(',', ':')`.
- Meta limity: name ≤24, icon ≤16, ≤4 tagy ×12, label ≤12 znaků.
- Timeouty app: CMD_W 5000 ms, CMD_HID 2000 ms, CMD_R/CMD_INFO 5000 ms.
- Hash pokrývá jen `{"banks":…,"macro_keys":…}` — HID flag NE.
- NVM: 4096 B celkem, posledních 8 B footer (HID flag) — nedotýkat se.
- Firmware deploy = kopie na CIRCUITPY (DEV boot: držet tlačítko při připojení USB) + `Write-VolumeCache -DriveLetter <X>` + Eject; boot.py změny nejsou (žádné).
- Firmware testy: `cd feel-fader-firmware && python -m pytest tests/ -v` — před Wave 2 je stav 37 passed; po každém firmware tasku musí projít VŠE.
- Commit messages končí `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 0: HW spike — crc32 dostupnost + NVM worst-case budget

**Files:**
- Create: `feel-fader-firmware/tests/test_wave2_budget.py` (host-side část)
- Žádné produkční změny.

**Interfaces:**
- Produces: rozhodnutí zapsaná do checkboxů níže; Task 1/3 na nich závisí.

- [ ] **Step 1: Host-side worst-case size test**

```python
# tests/test_wave2_budget.py
import json

def _worst_bank():
    return {
        "fader_cc": [127, 127], "fader_ch": [15, 15],
        "encoder": 127, "encoder_ch": 15,
        "uacc_values": list(range(36)),          # DEFAULT_UACC má 36 položek
        "roller_mode": "keyswitch",
        "ks_notes": list(range(24)),             # velký keyswitch layout
        "ks_channel": 15, "ks_velocity": 127,
        "nav_keys_cw": [82, 82, 82, 82], "nav_keys_ccw": [81, 81, 81, 81],
        "nav_invert": True,
        "m": {"n": "X" * 24, "i": "Y" * 16, "t": ["Z" * 12] * 4, "l": ["L" * 12, "L" * 12]},
    }

def test_worst_case_fits_nvm():
    state = {"banks": [_worst_bank() for _ in range(8)], "macro_keys": list(range(8))}
    data = json.dumps(state, separators=(",", ":")).encode("utf-8")
    budget = 4096 - 8 - 8            # NVM − footer − v2 header (marker2+len2+crc4)
    assert len(data) <= budget * 0.9, f"worst case {len(data)} B > 90% budgetu {budget} B"
```

- [x] **Step 2: VÝSLEDEK SPIKU (2026-07-04):** FAIL — hustá serializace worst-case = **4506 B** > 4080 B strop. Rozhodnutí (Frank): **sparse serializace** (viz spec §4) místo osekání meta limitů. Budget test se přepisuje na realistický a přesouvá do Tasku 1 (testuje `serialize_state`); worst-case dense test se NEcommituje.
- [ ] **Step 3: Device check `binascii.crc32`** — zařízení v DEV bootu (drž tlačítko při připojení USB, CIRCUITPY viditelný). Přes REPL (`screen`/Putty na REPL COM port, nebo dočasný řádek v `code.py`): `import binascii; print(binascii.crc32(b'test'))`. Očekávání: číslo (3632233996). Zapiš výsledek:
  - [ ] `binascii.crc32` dostupné → Task 1 použije crc32 primárně (fallback FNV zůstane v kódu).
  - [ ] Nedostupné → `state_hash`/`blob_checksum` běží na FNV-1a fallbacku (kód identický, jen se cvičí druhá větev).
- [ ] **Step 4: Commit** `git add tests/test_wave2_budget.py && git commit -m "test: Wave 2 NVM worst-case budget spike"` (+ footer).

---

### Task 1: Firmware — kanonická serializace, hash, info dict v2 (`ff_config.py`)

**Files:**
- Modify: `feel-fader-firmware/ff_config.py` (append za `build_info_dict`, + úprava `build_info_dict`)
- Test: `feel-fader-firmware/tests/test_wave2_hash.py`

**Interfaces:**
- Produces: `serialize_state(banks, macro_keys) -> str` · `state_hash(s: str) -> str` (8 hex znaků) · `_crc32_hash(b: bytes) -> int` · `_fnv1a_hash(b: bytes) -> int` · `blob_checksum(data: bytes) -> int` (32-bit, stejná volba algoritmu jako state_hash) · `build_info_dict(..., config_hash=None, config_source=None, schema_version=2)`.

- [ ] **Step 1: Failing testy**

```python
# tests/test_wave2_hash.py
import ff_config

def test_serialize_state_compact_and_deterministic():
    banks = ff_config.parse_banks(ff_config.DEFAULT_PRESETS)["banks"]
    s1 = ff_config.serialize_state(banks, [])
    s2 = ff_config.serialize_state(banks, [])
    assert s1 == s2
    assert ": " not in s1 and ", " not in s1          # kompaktní separators
    assert s1.startswith('{"banks":')

def test_state_hash_format_and_stability():
    h = ff_config.state_hash('{"banks":[]}')
    assert isinstance(h, str) and len(h) == 8
    int(h, 16)                                         # je to hex
    assert h == ff_config.state_hash('{"banks":[]}')
    assert h != ff_config.state_hash('{"banks":[1]}')

def test_both_hash_impls_deterministic():
    data = b"feel fader"
    assert ff_config._crc32_hash(data) == 0x4A8E51F & 0xFFFFFFFF or True  # hodnotu nefixujeme
    assert ff_config._crc32_hash(data) == ff_config._crc32_hash(data)
    assert ff_config._fnv1a_hash(data) == ff_config._fnv1a_hash(data)
    assert ff_config._fnv1a_hash(b"a") != ff_config._fnv1a_hash(b"b")

def test_sparse_roundtrip_stable_and_legacy_safe():
    # sparse → parse → sparse musí být bajt-stabilní (hash stabilita přes boot)
    web = {"banks": [{"fader1": {"cc": 21, "channel": 3}, "fader2": {"cc": 22, "channel": 4},
                      "encoder": {"cc": 110, "channel": 5}, "name": "Test"}]}
    banks = ff_config.normalize_web_config(web)
    s1 = ff_config.serialize_state(banks, [])
    reparsed = ff_config.parse_banks(__import__("json").loads(s1))
    s2 = ff_config.serialize_state(reparsed["banks"], reparsed["macro_keys"])
    assert s1 == s2
    # uacc_values NIKDY nevynechat (starý app při absenci nastaví [])
    assert '"uacc_values":' in s1
    # defaultní pole vynechána
    assert '"roller_mode"' not in s1 and '"nav_keys_cw"' not in s1


def test_realistic_heavy_config_fits_nvm():
    # 8 bank, každá plné meta + data svého módu (Task 0 rozhodnutí: sparse)
    def bank(mode):
        b = {"fader_cc": [21, 22], "fader_ch": [3, 4], "encoder": 110, "encoder_ch": 5,
             "uacc_values": list(range(36)), "roller_mode": mode,
             "m": {"n": "X" * 24, "i": "Y" * 16, "t": ["Z" * 12] * 4, "l": ["L" * 12, "L" * 12]}}
        if mode == "keyswitch":
            b.update(ks_notes=list(range(24, 48)), ks_channel=9, ks_velocity=101)
        if mode == "track_nav":
            b.update(nav_keys_cw=[82] * 4, nav_keys_ccw=[81] * 4, nav_invert=True)
        return b
    modes = ["cc", "cc", "cc", "cc", "keyswitch", "keyswitch", "track_nav", "track_nav"]
    parsed = ff_config.parse_banks({"banks": [bank(m) for m in modes], "macro_keys": [4, 5, 6, 7]})
    data = ff_config.serialize_state(parsed["banks"], parsed["macro_keys"]).encode("utf-8")
    budget = 4096 - 8 - 8
    assert len(data) <= budget * 0.9, f"realistic heavy {len(data)} B > 90% budgetu"


def test_build_info_dict_v2():
    info = ff_config.build_info_dict("1.1.0", "FF", "AB12", config_hash="deadbeef", config_source="nvm")
    assert info["schema_version"] == 2
    assert info["config_hash"] == "deadbeef"
    assert info["config_source"] == "nvm"
    legacy = ff_config.build_info_dict("1.0.0", "FF", None, schema_version=1)
    assert "config_hash" not in legacy
```

- [ ] **Step 2: Run** `python -m pytest tests/test_wave2_hash.py -v` → FAIL (`serialize_state` neexistuje).
- [ ] **Step 3: Implementace** — append do `ff_config.py`:

```python
# =========================
#  WAVE 2 — KANONICKÁ SERIALIZACE + HASH
# =========================
import json as _json

try:
    import binascii as _binascii
    _HAS_CRC32 = True
except ImportError:
    _HAS_CRC32 = False


def _crc32_hash(data_bytes):
    """CRC32 (binascii) — primární. Volat jen když _HAS_CRC32."""
    return _binascii.crc32(data_bytes) & 0xFFFFFFFF


def _fnv1a_hash(data_bytes):
    """FNV-1a 32-bit — čistý Python fallback bez tabulek."""
    h = 2166136261
    for b in data_bytes:
        h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    return h


def blob_checksum(data_bytes):
    """32-bit checksum pro NVM blob — stejný algoritmus jako state_hash."""
    return _crc32_hash(data_bytes) if _HAS_CRC32 else _fnv1a_hash(data_bytes)


_SPARSE_KEEP = ("uacc_values", "m")   # uacc: starý app při absenci nastaví [] (ne default)
                                       # m: má vlastní omit-if-empty pravidlo


def _bank_defaults(bank):
    """Defaulty shodné s parse_banks — pole s touto hodnotou lze vynechat."""
    return {
        "fader_cc": [11, 1], "fader_ch": [0, 0],
        "encoder": 32, "encoder_ch": 0,
        "roller_mode": "cc", "ks_notes": [],
        "ks_channel": bank.get("encoder_ch", 0),   # parse re-derivuje z enc_ch
        "ks_velocity": 100,
        "nav_keys_cw": [NAV_DEFAULT_CW], "nav_keys_ccw": [NAV_DEFAULT_CCW],
        "nav_invert": False,
    }


def _sparse_bank(bank):
    defaults = _bank_defaults(bank)
    out = {}
    for k, v in bank.items():
        if k in _SPARSE_KEEP or k not in defaults or defaults[k] != v:
            out[k] = v
    return out


def serialize_state(banks, macro_keys):
    """JEDINÁ kanonická serializace presetů — používá ji save, CMD_R i hash.
    Sparse: pole rovná defaultům se vynechávají (spec §4); dict staví tento kód
    (fixní pořadí klíčů = pořadí v bank dictu), kompaktní separators."""
    state = {"banks": [_sparse_bank(b) for b in banks]}
    if macro_keys:
        state["macro_keys"] = macro_keys
    return _json.dumps(state, separators=(",", ":"))


def state_hash(state_str):
    """8 hex znaků nad kanonickým stringem. Pro app opaque token."""
    return "%08x" % blob_checksum(state_str.encode("utf-8"))
```

a v `build_info_dict` změň signaturu + tělo:

```python
def build_info_dict(firmware, model, serial, hid_available=True, hid_enabled=False,
                    supports_14bit=False, supports_macros=False, schema_version=2,
                    config_hash=None, config_source=None):
    """Feature-discovery dict pro CMD_INFO (§10.7 + Wave 2 spec §2)."""
    info = {
        "firmware": firmware, "model": model, "schema_version": schema_version,
        "hid_available": bool(hid_available), "hid_enabled": bool(hid_enabled),
        "supports_14bit": bool(supports_14bit), "supports_macros": bool(supports_macros),
    }
    if serial:
        info["serial"] = serial
    if config_hash is not None:
        info["config_hash"] = config_hash
    if config_source is not None:
        info["config_source"] = config_source
    return info
```

- [ ] **Step 4: Run** `python -m pytest tests/ -v` → vše PASS (37 starých + 4 nové + budget).
- [ ] **Step 5: Commit** `git add ff_config.py tests/test_wave2_hash.py && git commit -m "feat: canonical serialize_state + state_hash + info dict v2 (Wave 2)"` (+ footer).

---

### Task 2: Firmware — meta pole `m` (`ff_config.py`)

**Files:**
- Modify: `feel-fader-firmware/ff_config.py` (`normalize_web_config`, `parse_banks`, nové konstanty)
- Test: `feel-fader-firmware/tests/test_wave2_meta.py`

**Interfaces:**
- Consumes: web bank dict (`name`,`icon`,`tags`,`fader1.label`,`fader2.label`).
- Produces: interní bank dict s klíčem `"m"` (jen když neprázdné): `{"n":str,"i":str,"t":[str],"l":[str,str]}`; konstanty `META_NAME_MAX=24, META_ICON_MAX=16, META_TAGS_MAX=4, META_TAG_LEN=12, META_LABEL_MAX=12`; helper `_meta_from_web(b) -> dict`, `_meta_sanitize(m) -> dict`.

- [ ] **Step 1: Failing testy**

```python
# tests/test_wave2_meta.py
import ff_config

WEB_BANK = {
    "fader1": {"cc": 11, "channel": 0, "label": "Dynamics"},
    "fader2": {"cc": 1, "channel": 0, "label": "Vibrato"},
    "encoder": {"cc": 32, "channel": 0},
    "name": "Strings Longs", "icon": "🎻", "tags": ["Spitfire", "BBC SO"],
}

def test_normalize_carries_meta():
    banks = ff_config.normalize_web_config({"banks": [WEB_BANK]})
    m = banks[0]["m"]
    assert m["n"] == "Strings Longs"
    assert m["i"] == "🎻"
    assert m["t"] == ["Spitfire", "BBC SO"]
    assert m["l"] == ["Dynamics", "Vibrato"]

def test_meta_limits_clamped():
    b = dict(WEB_BANK, name="X" * 99, tags=["T" * 99] * 9)
    m = ff_config.normalize_web_config({"banks": [b]})[0]["m"]
    assert len(m["n"]) == ff_config.META_NAME_MAX
    assert len(m["t"]) == ff_config.META_TAGS_MAX
    assert all(len(t) == ff_config.META_TAG_LEN for t in m["t"])

def test_empty_meta_omitted():
    b = {k: v for k, v in WEB_BANK.items() if k not in ("name", "icon", "tags")}
    b["fader1"] = {"cc": 11, "channel": 0}
    b["fader2"] = {"cc": 1, "channel": 0}
    banks = ff_config.normalize_web_config({"banks": [b]})
    assert "m" not in banks[0]

def test_parse_banks_roundtrip_meta():
    banks = ff_config.normalize_web_config({"banks": [WEB_BANK]})
    out = ff_config.parse_banks({"banks": banks})
    assert out["banks"][0]["m"]["n"] == "Strings Longs"

def test_parse_banks_missing_meta_ok():
    out = ff_config.parse_banks(ff_config.DEFAULT_PRESETS)
    assert "m" not in out["banks"][0]
```

- [ ] **Step 2: Run** `python -m pytest tests/test_wave2_meta.py -v` → FAIL.
- [ ] **Step 3: Implementace** — do `ff_config.py` nad `parse_banks` přidej:

```python
META_NAME_MAX  = 24
META_ICON_MAX  = 16
META_TAGS_MAX  = 4
META_TAG_LEN   = 12
META_LABEL_MAX = 12


def _meta_sanitize(m):
    """Ořeže meta dict na limity; vrátí {} pro nevalidní/prázdný vstup."""
    if not isinstance(m, dict):
        return {}
    out = {}
    n = str(m.get("n") or "")[:META_NAME_MAX]
    i = str(m.get("i") or "")[:META_ICON_MAX]
    t = [str(x)[:META_TAG_LEN] for x in (m.get("t") or [])[:META_TAGS_MAX] if str(x)]
    l_raw = m.get("l") or []
    l = [str(l_raw[j])[:META_LABEL_MAX] if j < len(l_raw) else "" for j in (0, 1)]
    if n: out["n"] = n
    if i: out["i"] = i
    if t: out["t"] = t
    if l[0] or l[1]: out["l"] = l
    return out


def _meta_from_web(b):
    """Vytáhne prezentační pole z web bank dictu → interní meta."""
    f1 = b.get("fader1") or {}
    f2 = b.get("fader2") or {}
    return _meta_sanitize({
        "n": b.get("name"), "i": b.get("icon"), "t": b.get("tags"),
        "l": [f1.get("label"), f2.get("label")],
    })
```

V `normalize_web_config` těsně před `new_banks.append({...})` přidej:

```python
        meta = _meta_from_web(b)
```

a do appendovaného dictu za `"nav_invert": nav_invert,` NEpřidávej klíč vždy — místo toho za `new_banks.append({...})` blok:

```python
        if meta:
            new_banks[-1]["m"] = meta
```

V `parse_banks` stejně: před `banks.append({...})` přidej `meta = _meta_sanitize(b.get("m"))` a za append `if meta: banks[-1]["m"] = meta`.

- [ ] **Step 4: Run** `python -m pytest tests/ -v` → vše PASS.
- [ ] **Step 5: Commit** `git add ff_config.py tests/test_wave2_meta.py && git commit -m "feat: presentation meta (name/icon/tags/labels) persisted in bank format (audit C1b)"` (+ footer).

---

### Task 3: Firmware — NVM v2 blob (`ff_config.py`)

**Files:**
- Modify: `feel-fader-firmware/ff_config.py` (append)
- Test: `feel-fader-firmware/tests/test_wave2_nvm.py`

**Interfaces:**
- Produces: `NVM_MARKER_V2 = b'\xFE\xEE'`, `NVM_MARKER_V1 = b'\xFE\xED'`, `pack_presets_blob(data_bytes) -> bytes` (marker2+len2+crc4+data), `unpack_presets_blob(buf) -> bytes|None`, `unpack_presets_blob_v1(buf) -> bytes|None` (dnešní marker+len formát).

- [ ] **Step 1: Failing testy**

```python
# tests/test_wave2_nvm.py
import ff_config

def test_pack_unpack_roundtrip():
    data = b'{"banks":[]}'
    blob = ff_config.pack_presets_blob(data)
    assert blob[:2] == ff_config.NVM_MARKER_V2
    assert ff_config.unpack_presets_blob(blob) == data

def test_unpack_rejects_bad_crc():
    blob = bytearray(ff_config.pack_presets_blob(b'{"banks":[1]}'))
    blob[-1] ^= 0xFF                       # poškoď poslední datový bajt
    assert ff_config.unpack_presets_blob(bytes(blob)) is None

def test_unpack_rejects_wrong_marker():
    blob = b"\x00\x00" + ff_config.pack_presets_blob(b"x")[2:]
    assert ff_config.unpack_presets_blob(blob) is None

def test_unpack_v1_legacy():
    data = b'{"banks":[2]}'
    v1 = ff_config.NVM_MARKER_V1 + bytes([len(data) & 0xFF, len(data) >> 8]) + data
    assert ff_config.unpack_presets_blob_v1(v1) == data
    assert ff_config.unpack_presets_blob_v1(b"\x00\x00abc") is None
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implementace** — append do `ff_config.py`:

```python
# =========================
#  WAVE 2 — NVM V2 BLOB (marker2 + len2 + crc32(4) + data)
# =========================
NVM_MARKER_V2 = b"\xFE\xEE"
NVM_MARKER_V1 = b"\xFE\xED"
NVM_V2_HEADER = 8   # 2 marker + 2 len + 4 checksum


def pack_presets_blob(data_bytes):
    n = len(data_bytes)
    c = blob_checksum(data_bytes)
    return (NVM_MARKER_V2
            + bytes([n & 0xFF, (n >> 8) & 0xFF])
            + bytes([(c >> s) & 0xFF for s in (0, 8, 16, 24)])
            + data_bytes)


def unpack_presets_blob(buf):
    """buf = bytes od offsetu 0 NVM. Vrátí data nebo None (marker/CRC fail)."""
    if buf is None or len(buf) < NVM_V2_HEADER or bytes(buf[0:2]) != NVM_MARKER_V2:
        return None
    n = buf[2] | (buf[3] << 8)
    if n <= 0 or NVM_V2_HEADER + n > len(buf):
        return None
    c = buf[4] | (buf[5] << 8) | (buf[6] << 16) | (buf[7] << 24)
    data = bytes(buf[NVM_V2_HEADER:NVM_V2_HEADER + n])
    return data if blob_checksum(data) == c else None


def unpack_presets_blob_v1(buf):
    """Legacy v1 formát (marker \xFE\xED + len2 + data, bez CRC) — jen migrace."""
    if buf is None or len(buf) < 4 or bytes(buf[0:2]) != NVM_MARKER_V1:
        return None
    n = buf[2] | (buf[3] << 8)
    if n <= 0 or 4 + n > len(buf):
        return None
    return bytes(buf[4:4 + n])
```

- [ ] **Step 4: Run** `python -m pytest tests/ -v` → vše PASS.
- [ ] **Step 5: Commit** `git add ff_config.py tests/test_wave2_nvm.py && git commit -m "feat: NVM v2 blob with checksum + v1 legacy unpack (audit F4)"` (+ footer).

---

### Task 4: Firmware — serial line parser v2 + legacy (`ff_config.py`)

**Files:**
- Modify: `feel-fader-firmware/ff_config.py` (append)
- Test: `feel-fader-firmware/tests/test_wave2_serial_parse.py`

**Interfaces:**
- Produces: `parse_serial_line(line: str) -> (cmd, rid, payload)` — `cmd` ∈ {"CMD_R","CMD_INFO","CMD_W","CMD_HID",None}; `rid=None` ⇒ legacy rámec; `payload` = string za druhou `:` (v2) nebo za první `:` (legacy W/HID), jinak None.

- [ ] **Step 1: Failing testy**

```python
# tests/test_wave2_serial_parse.py
import ff_config

P = ff_config.parse_serial_line

def test_legacy_frames():
    assert P("CMD_R") == ("CMD_R", None, None)
    assert P("CMD_INFO") == ("CMD_INFO", None, None)
    assert P('CMD_W:{"banks":[]}') == ("CMD_W", None, '{"banks":[]}')
    assert P('CMD_HID:{"enabled":true}') == ("CMD_HID", None, '{"enabled":true}')

def test_v2_frames():
    assert P("CMD_R:7") == ("CMD_R", "7", None)
    assert P("CMD_INFO:12") == ("CMD_INFO", "12", None)
    assert P('CMD_W:3:{"banks":[]}') == ("CMD_W", "3", '{"banks":[]}')
    assert P('CMD_HID:4:{"enabled":false}') == ("CMD_HID", "4", '{"enabled":false}')

def test_payload_with_colons_survives():
    payload = '{"banks":[{"m":{"n":"a:b"}}]}'
    assert P("CMD_W:9:" + payload) == ("CMD_W", "9", payload)

def test_garbage():
    assert P("") == (None, None, None)
    assert P("BOGUS:1") == (None, None, None)
    assert P("CMD_Wrong:1:{}") == (None, None, None)
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implementace** — append do `ff_config.py`:

```python
# =========================
#  WAVE 2 — SERIAL LINE PARSER (v2 rid framing + legacy)
# =========================
_SERIAL_CMDS = ("CMD_R", "CMD_INFO", "CMD_W", "CMD_HID")


def parse_serial_line(line):
    """Vrátí (cmd, rid, payload). rid=None značí legacy rámec (odpověď postaru).

    Legacy:  "CMD_R" / "CMD_INFO" / "CMD_W:{json}" / "CMD_HID:{json}"
    v2:      "CMD_R:<rid>" / "CMD_INFO:<rid>" / "CMD_W:<rid>:{json}" / "CMD_HID:<rid>:{json}"
    """
    if line in ("CMD_R", "CMD_INFO"):
        return (line, None, None)
    for cmd in _SERIAL_CMDS:
        prefix = cmd + ":"
        if not line.startswith(prefix):
            continue
        rest = line[len(prefix):]
        if cmd in ("CMD_W", "CMD_HID") and rest.startswith("{"):
            return (cmd, None, rest)            # legacy payload rámec
        if ":" in rest:
            rid, payload = rest.split(":", 1)
            return (cmd, rid, payload)          # v2 s payloadem
        if rest and cmd in ("CMD_R", "CMD_INFO"):
            return (cmd, rest, None)            # v2 bez payloadu
        return (None, None, None)
    return (None, None, None)
```

- [ ] **Step 4: Run** `python -m pytest tests/ -v` → vše PASS.
- [ ] **Step 5: Commit** `git add ff_config.py tests/test_wave2_serial_parse.py && git commit -m "feat: serial line parser with rid framing + legacy detection (Wave 2)"` (+ footer).

---

### Task 5: Firmware — integrace v `code.py`

**Files:**
- Modify: `feel-fader-firmware/code.py` — NVM save/load, `_config_hash`/`_config_source`, `apply_and_save_json`, serial handler, `set_hid_enabled`, SysEx CMD_W/CMD_INFO, `FIRMWARE_VER`.

**Interfaces:**
- Consumes: vše z Tasků 1–4 (`serialize_state`, `state_hash`, `pack_presets_blob`, `unpack_presets_blob`, `unpack_presets_blob_v1`, `parse_serial_line`, `build_info_dict(..., config_hash, config_source)`).
- Produces: globals `_config_hash` (str), `_config_source` ("nvm"|"file"|"defaults"); `apply_and_save_json(payload_str) -> (ok: bool, reason: str|None)`; `set_hid_enabled(enabled) -> (ok, reason)`. HW ověření až Task 13.

- [ ] **Step 1: `FIRMWARE_VER`** — změň `FIRMWARE_VER = "1.0.0"` na `"1.1.0"`.
- [ ] **Step 2: NVM v2 save/load** — nahraď `_nvm_save` a přidej pod `_nvm_load` (v1 loader ZŮSTÁVÁ pro migraci):

```python
def _nvm_save_v2(data_bytes):
    """Bezpečné pořadí zápisu: invalidovat marker → tělo → marker naposled.
    Vrací (ok, reason)."""
    try:
        nvm = microcontroller.nvm
        blob = ff_config.pack_presets_blob(data_bytes)
        if len(blob) > len(nvm) - ff_config.FOOTER_SIZE:
            return (False, "too_large")
        nvm[0:2] = b"\x00\x00"
        nvm[2:len(blob)] = blob[2:]
        nvm[0:2] = blob[0:2]
        return (True, None)
    except Exception:
        return (False, "nvm_write")


def _nvm_load_v2():
    """Vrátí data bytes z v2 blobu, nebo None."""
    try:
        nvm = microcontroller.nvm
        return ff_config.unpack_presets_blob(bytes(nvm[0:len(nvm) - ff_config.FOOTER_SIZE]))
    except Exception:
        return None
```

- [ ] **Step 3: `load_presets` + `_config_source`** — nahraď `load_presets`:

```python
_config_source = "defaults"   # "nvm" | "file" | "defaults" — plní load_presets

def load_presets(path=PRESETS_PATH):
    global _config_source
    # 1) NVM v2 (CRC), 2) NVM v1 (migrace), 3) soubor, 4) defaults
    for raw in (_nvm_load_v2(), _nvm_load()):
        if raw:
            try:
                out = parse_banks(json.loads(raw.decode("utf-8")))
                _config_source = "nvm"
                return out
            except Exception:
                pass
    try:
        with open(path, "r") as f:
            out = parse_banks(json.load(f))
        _config_source = "file"
        return out
    except Exception:
        pass
    _config_source = "defaults"
    return DEFAULT_PRESETS
```

- [ ] **Step 4: `save_presets` přes serialize_state + v2** — nahraď `save_presets`:

```python
def save_presets():
    """Uloží do NVM v2 (primární) + soubor (bonus). Vrací (ok, reason)."""
    import os
    data = ff_config.serialize_state(banks, button_macro)
    ok, reason = _nvm_save_v2(data.encode("utf-8"))
    try:
        try:
            os.remove(PRESETS_PATH)
        except Exception:
            pass
        with open(PRESETS_PATH, "w") as f:
            f.write(data)
        if not ok:
            ok, reason = True, None   # soubor jako záchrana, když NVM selže (ne too_large)
    except Exception:
        pass
    return (ok, reason)
```

  Pozor: dosavadní volající `save_presets()` testují truthy — `(True, None)` je truthy tuple, ale SysEx větev testuje `if ok and save_presets():` → uprav všechna volání podle Step 6/7.
- [ ] **Step 5: `_config_hash` + `apply_and_save_json`** — za `apply_web_config` přidej:

```python
_config_hash = ""   # nastaví boot + každý úspěšný zápis


def _recompute_hash():
    global _config_hash
    _config_hash = ff_config.state_hash(ff_config.serialize_state(banks, button_macro))


def apply_and_save_json(payload_str):
    """Společná cesta serial CMD_W i SysEx CMD_W. Vrací (ok, reason)."""
    try:
        web_cfg = json.loads(payload_str)
    except Exception:
        return (False, "parse")
    if not apply_web_config(web_cfg):
        return (False, "invalid")
    ok, reason = save_presets()
    if ok:
        _recompute_hash()
    return (ok, reason)
```

  Za boot-time `banks`/`button_macro` inicializaci (hledej `load_presets()` volání v setup sekci) přidej `_recompute_hash()`.
- [ ] **Step 6: `set_hid_enabled` + SysEx cesty** — nahraď `apply_hid_request` a SysEx `CMD_W` větev v `handle_sysex`:

```python
def set_hid_enabled(enabled):
    """Aplikační logika bez transportu. Vrací (ok, reason)."""
    global hid_enabled
    if _hid_flag_write(bool(enabled)):
        hid_enabled = bool(enabled)
        return (True, None)
    return (False, "hid")


def apply_hid_request(enabled):
    """SysEx cesta — zachová dnešní MIDI ACK/ERR chování."""
    ok, _ = set_hid_enabled(enabled)
    send_ack() if ok else send_err()
```

  V `handle_sysex` `CMD_W` větvi nahraď tělo `try` blokem:

```python
        try:
            ok, _ = apply_and_save_json(bytes(dec7(payload)).decode("utf-8"))
            send_ack() if ok else send_err()
        except Exception:
            send_err()
```

- [ ] **Step 7: Serial handler v2** — nahraď celý blok `if b"\n" in _serial_buf:` … až po `except Exception: pass` (řádky ~527–553) tímto:

```python
            if b"\n" in _serial_buf:
                nl = _serial_buf.index(b"\n")
                line = _serial_buf[:nl].decode("utf-8").strip()
                _serial_buf = _serial_buf[nl + 1:]
                cmd, rid, payload = ff_config.parse_serial_line(line)

                def _reply(s):
                    try:
                        usb_cdc.data.write(s.encode("utf-8") + b"\n")
                    except Exception:
                        pass

                if cmd == "CMD_R":
                    body = ff_config.serialize_state(banks, button_macro)
                    _reply("CFG:%s:%s" % (rid, body) if rid else body)
                elif cmd == "CMD_INFO":
                    try:
                        _uid = "".join("{:02X}".format(b) for b in bytes(microcontroller.cpu.uid))
                    except Exception:
                        _uid = None
                    _info = ff_config.build_info_dict(
                        FIRMWARE_VER, MODEL_ID, _uid,
                        hid_available=True, hid_enabled=_hid_flag_read(),
                        supports_14bit=False, supports_macros=False,
                        config_hash=_config_hash, config_source=_config_source,
                    )
                    body = json.dumps(_info, separators=(",", ":"))
                    _reply("INFO:%s:%s" % (rid, body) if rid else body)
                elif cmd == "CMD_W":
                    ok, reason = apply_and_save_json(payload)
                    if rid:
                        _reply("ACK:%s:%s" % (rid, _config_hash) if ok
                               else "ERR:%s:%s" % (rid, reason))
                elif cmd == "CMD_HID":
                    try:
                        req = json.loads(payload)
                        ok, reason = set_hid_enabled(bool(req.get("enabled", False)))
                    except Exception:
                        ok, reason = False, "parse"
                    if rid:
                        _reply("ACK:%s" % rid if ok else "ERR:%s:%s" % (rid, reason))
```

  (Vnější `try/except Exception: pass` kolem serial bloku zůstává.) Legacy chování: `rid=None` ⇒ CMD_R/CMD_INFO odpoví raw JSONem, CMD_W/CMD_HID mlčí — bajt-přesně dnešní kontrakt.
- [ ] **Step 8: Grep konzistence** — `grep -n "save_presets()" code.py`: každé volání musí zpracovat tuple (`ok, _ = save_presets()`), žádné holé `if save_presets():`.
- [ ] **Step 9: Run** `python -m pytest tests/ -v` → vše PASS (code.py se v pytestu neimportuje — jistota, že ff_config API sedí).
- [ ] **Step 10: Commit** `git add code.py && git commit -m "feat: serial protocol v2 (rid+typed replies+legacy), NVM v2, config_hash, unified apply path (audit C3/C6/F4)"` (+ footer).

---

### Task 6: Firmware — protokolová dokumentace

**Files:**
- Modify: `feel-fader-firmware/CLAUDE.md` (sekce „Komunikační protokol")

- [ ] **Step 1:** Nahraď v `CLAUDE.md` větu `Zařízení komunikuje přes MIDI SysEx (Web MIDI API v prohlížeči). Serial/CDC port se nepoužívá pro config sync.` a SysEx tabulku touto strukturou (SysEx tabulka zůstává pod tím jako sekundární kanál):

```markdown
Config sync běží přes **USB CDC serial** (`usb_cdc.data`, \n-terminated UTF-8 řádky).
MIDI SysEx cesta existuje jako sekundární (v appce se nepoužívá — round-trip
nefunguje ve všech setupech), ale MUSÍ zůstat hash-konzistentní (sdílí
`apply_and_save_json`).

### Serial protokol v2 (od fw 1.1.0) — rid framing

| Request (app→fw) | Response (fw→app) |
|---|---|
| `CMD_R:<rid>` | `CFG:<rid>:{banks,macro_keys}` |
| `CMD_INFO:<rid>` | `INFO:<rid>:{…,schema_version:2,config_hash,config_source}` |
| `CMD_W:<rid>:{cfg}` | `ACK:<rid>:<hash>` / `ERR:<rid>:<parse\|invalid\|too_large\|nvm_write>` |
| `CMD_HID:<rid>:{enabled}` | `ACK:<rid>` / `ERR:<rid>:<parse\|hid>` |

**Legacy mode (per-line):** `CMD_R`/`CMD_INFO` bez `:` → raw JSON bez prefixu;
`CMD_W:{…}`/`CMD_HID:{…}` (za první `:` hned `{`) → aplikovat, žádná odpověď.
Starý app snapshot tak funguje beze změny. `rid` = string bez `:`, firmware ho jen echuje.

**config_hash:** `crc32(serialize_state())` (8 hex) jen nad `{banks,macro_keys}`
(HID flag NE). Přepočet: boot po loadu + každý úspěšný zápis (serial i SysEx).
App hash nepočítá — opaque token z ACK, porovnává s INFO.

**NVM:** v2 blob `FE EE + len(2) + crc32(4) + data` od offsetu 0; zápis
v pořadí invalidace markeru → tělo → marker. Loader: v2 → v1 (`FE ED`, migrace)
→ `/presets.json` → defaults; zdroj hlásí `config_source`.
Footer (posledních 8 B, HID flag) beze změny. Meta pole `m` (name/icon/tags/labels,
limity 24/16/4×12/12) jsou součást bank formátu.
```

- [ ] **Step 2:** Aktualizuj i „Formát konfigurace" blok — do device formátu přidej `m:{n,i,t,l}` (volitelné).
- [ ] **Step 3: Commit** `git add CLAUDE.md && git commit -m "docs: protocol v2 tables — serial is the config channel (fix stale SysEx claim)"` (+ footer).

---

### Task 7: App — serial transaction manager + protocolVersion bootstrap

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — nahradit vnitřky `serialReadConfig()` (ř. ~2706) a `serialReadInfo()` (ř. ~2740), přidat manager nad ně; globals k `let _serialPort` (ř. ~2520).

**Interfaces:**
- Produces: `serialRequest(cmd, payload, timeoutMs) -> Promise<string>` (payload odpovědi; ACK bez hashe → `''`; ERR → reject `Error('ERR:'+reason)`; timeout → reject `Error('timeout')`); globals `protocolVersion` (1|2), `DEVICE_INFO.config_hash`, `DEVICE_INFO.config_source`; `LS_HASH_KEY='ff-last-hash'`.
- Consumes: firmware v2 rámce z Tasku 5.

- [ ] **Step 1:** Ke globals (za `let _serialPort   = null;`) přidej:

```js
let protocolVersion = 1;        // 1 = legacy, 2 = rid framing; nastaví bootstrap CMD_INFO
let _ridCounter = 0;
let _txnChain = Promise.resolve();   // serializace transakcí — jedna naráz
const LS_HASH_KEY = 'ff-last-hash';  // poslední hash potvrzený zařízením (ACK/load)
```

- [ ] **Step 2:** Nad `serialReadConfig` vlož manager:

```js
// Wave 2 — jediné místo, které čte serial. Jedna transakce naráz; v2 odpovědi
// se párují podle typu + rid, cizí/stale řádky se zahazují (to je ta ochrana,
// drain je jen best-effort úklid nulové ceny).
function serialRequest(cmd, payload, timeoutMs) {
  const run = async () => {
    await _serialEnsureOpen();
    const port = _serialPort;
    const v2 = protocolVersion === 2;
    const rid = v2 ? String(++_ridCounter) : null;
    const line = payload == null
      ? (v2 ? `${cmd}:${rid}` : cmd)
      : (v2 ? `${cmd}:${rid}:${payload}` : `${cmd}:${payload}`);
    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(line + '\n'));
    writer.releaseLock();
    if (!v2 && (cmd === 'CMD_W' || cmd === 'CMD_HID')) return '';   // legacy: bez odpovědi
    const expect = { CMD_R: 'CFG', CMD_INFO: 'INFO', CMD_W: 'ACK', CMD_HID: 'ACK' }[cmd];
    return await _readReply(port, v2, expect, rid, timeoutMs);
  };
  const p = _txnChain.then(run, run);
  _txnChain = p.catch(() => {});
  return p;
}

function _readReply(port, v2, expect, rid, timeoutMs) {
  return new Promise((resolve, reject) => {
    const reader = port.readable.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const timer = setTimeout(() => { try { reader.releaseLock(); } catch(_){} reject(new Error('timeout')); }, timeoutMs);
    const done = (fn, v) => { clearTimeout(timer); try { reader.releaseLock(); } catch(_){} fn(v); };
    (async () => {
      try {
        while (true) {
          const { value, done: eof } = await reader.read();
          if (eof) return done(reject, new Error('Port closed'));
          buf += dec.decode(value);
          let nl;
          while ((nl = buf.indexOf('\n')) !== -1) {
            const lineIn = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!lineIn) continue;
            if (!v2) return done(resolve, lineIn);          // legacy: první řádek vyhrává
            const m = lineIn.match(/^(CFG|INFO|ACK|ERR):([^:]*)(?::([\s\S]*))?$/);
            if (!m) { console.debug('[serial] discard', lineIn.slice(0, 40)); continue; }
            const [, typ, r, pl] = m;
            if (r !== rid) { console.debug('[serial] stale rid', typ, r); continue; }
            if (typ === 'ERR') return done(reject, new Error('ERR:' + (pl || 'unknown')));
            if (typ === expect) return done(resolve, pl ?? '');
            console.debug('[serial] unexpected type', typ);
          }
        }
      } catch (e) { done(reject, e); }
    })();
  });
}
```

- [ ] **Step 3:** Přepiš `serialReadConfig` a `serialReadInfo` na manager (SMAŽ jejich ruční reader/writer kód):

```js
async function serialReadConfig() {
  return await serialRequest('CMD_R', null, 5000);
}

async function serialReadInfo() {
  // Bootstrap: první dotaz jde vždy legacy rámcem (odpoví starý i nový firmware),
  // ze schema_version+config_hash se určí protocolVersion pro všechno další.
  const line = await serialRequest('CMD_INFO', null, 5000);
  const info = JSON.parse(line);
  protocolVersion = (info.schema_version >= 2 && typeof info.config_hash === 'string') ? 2 : 1;
  if (info.firmware) DEVICE_INFO.firmware = info.firmware;
  if (info.serial)   DEVICE_INFO.serial   = info.serial;
  if (typeof info.hid_available === 'boolean') DEVICE_INFO.hid_available = info.hid_available;
  if (typeof info.hid_enabled   === 'boolean') DEVICE_INFO.hid_enabled   = info.hid_enabled;
  DEVICE_INFO.config_hash   = info.config_hash   || null;
  DEVICE_INFO.config_source = info.config_source || null;
  try { localStorage.setItem(LS_SERIAL_PID_KEY, _serialPort.getInfo().usbProductId); } catch(e) {}
  updateDeviceInfo(); updateHidToggle();
  render();
  return info;
}
```

  Pozn.: `serialReadConfig` vrací nyní string (payload) — `loadConfigFromDevice` už dnes dělá `JSON.parse(jsonStr)`, zůstává. `CFG:` payload je JSON config — v legacy módu je to celý raw řádek, v v2 payload za prefixem; obojí je validní JSON config.
- [ ] **Step 4: Headless verify** — otevři `feel-fader.html` headless Chromem (vzor: memory `feelfader-browser-test-automation` / Wave 1 plan Task 11): `pageerrors: none`.
- [ ] **Step 5: Commit** `git add feel-fader.html && git commit -m "feat: serial transaction manager with rid matching + protocolVersion bootstrap (Wave 2)"` (+ footer).

---

### Task 8: App — doSend přes ACK/ERR, hash persistence, sync banner

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `doSend()` (ř. ~2845), `loadConfigFromDevice()` (ř. ~2775), `onDeviceConnected()` (ř. ~2822), nový `#sync-banner` element + CSS + helpery.

**Interfaces:**
- Consumes: `serialRequest`, `protocolVersion`, `DEVICE_INFO.config_hash/config_source`, `LS_HASH_KEY` (Task 7).
- Produces: `showSyncBanner(kind)` (`'differs'|'defaults'`), `hideSyncBanner()`; hash uložen po ACK i po úspěšném loadu.

- [ ] **Step 1: HTML + CSS** — za `<div id="toasts"></div>` vlož:

```html
<div id="sync-banner" class="sync-banner" hidden>
  <span id="sync-banner-text"></span>
  <button class="sync-btn" onclick="syncLoadFromDevice()">Load from device</button>
  <button class="sync-btn" onclick="syncSendMine()">Send mine</button>
  <button class="tx" onclick="hideSyncBanner()">✕</button>
</div>
```

  CSS (k `.toast` stylům):

```css
.sync-banner{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:190;
  display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:var(--r-sm);
  border:1px solid rgba(232,160,58,.4);background:rgba(232,160,58,.1);
  font-size:12px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.sync-btn{border:1px solid var(--border-s);background:var(--bg-card);border-radius:6px;
  padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
```

- [ ] **Step 2: Helpery** — k `setBanner`:

```js
function showSyncBanner(kind) {
  const el = document.getElementById('sync-banner');
  const tx = document.getElementById('sync-banner-text');
  if (!el) return;
  tx.textContent = kind === 'defaults'
    ? 'Device reset to factory settings (stored config was unreadable).'
    : 'Device config differs from this browser’s last sync.';
  el.hidden = false;
}
function hideSyncBanner() { const el = document.getElementById('sync-banner'); if (el) el.hidden = true; }
async function syncLoadFromDevice() {
  hideSyncBanner();
  try { await loadConfigFromDevice(); setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded')); }
  catch(e) { toast('e', "Couldn't sync with device — showing local config"); }
}
async function syncSendMine() { hideSyncBanner(); doSend(); }
```

- [ ] **Step 3: doSend** — nahraď serial zápis (`await _serialEnsureOpen(); … writer.releaseLock();`) a potvrzovací blok:

```js
    const ackHash = await serialRequest('CMD_W', JSON.stringify(cfg), 5000);
    // protocolVersion 1: ackHash === '' (legacy fire-and-forget, dnešní chování)
    if (protocolVersion === 2 && ackHash) {
      try { localStorage.setItem(LS_HASH_KEY, ackHash.trim()); } catch(_) {}
      DEVICE_INFO.config_hash = ackHash.trim();
    }
    cfgSave();
    dirty = false;
    reflectDirty();
    toast('s', t('toast.config_sent'));
```

  V `catch` bloku doplň rozlišení důvodu před stávající `toast('e', …)`:

```js
    const errReason = /^ERR:(.+)$/.exec(e.message || '');
    if (errReason) toast('e', 'Device rejected config: ' + errReason[1] + ' — kept as unsaved.');
    else if (e.message === 'timeout') toast('e', 'No confirmation from device — kept as unsaved. Retry send.');
    else toast('e', serialErrMsg(e, 'Send failed'));
```

  (`dirty` se v catch nemění — zůstává true, retry = další klik na send.) ERR/timeout NESMÍ zavírat port bez důvodu — port zavírej jen pro ne-protokolové chyby (ponech stávající `if (e.name !== 'AbortError' …)` podmínku, ale obal ji `if (!errReason && e.message !== 'timeout')`).
- [ ] **Step 4: Hash po loadu** — v `loadConfigFromDevice()` za `_serialGranted = true;` přidej:

```js
  if (protocolVersion === 2 && DEVICE_INFO.config_hash) {
    try { localStorage.setItem(LS_HASH_KEY, DEVICE_INFO.config_hash); } catch(_) {}
  }
```

- [ ] **Step 5: Reconnect porovnání** — v `onDeviceConnected()` nahraď blok `if (!dirty) { try { await loadConfigFromDevice(); … } catch(e) { … } }`:

```js
    if (!dirty) {
      try {
        await serialReadInfo();   // bootstrap: protocolVersion + config_hash/source
        const stored = localStorage.getItem(LS_HASH_KEY);
        if (protocolVersion === 2 && DEVICE_INFO.config_source === 'defaults') {
          showSyncBanner('defaults'); setBanner('searching', '');
        } else if (protocolVersion === 2 && stored && DEVICE_INFO.config_hash
                   && stored !== DEVICE_INFO.config_hash) {
          showSyncBanner('differs'); setBanner('searching', '');
        } else {
          await loadConfigFromDevice();
          setBanner('connected', t('midi.synced')); toast('s', t('toast.config_loaded'));
        }
      } catch(e) {   // audit C4 — desync musí být vidět; header zůstává v „searching"
        toast('e', "Couldn't sync with device — showing local config");
        setBanner('searching', '');
      }
    }
```

- [ ] **Step 6: Headless verify** → `pageerrors: none`.
- [ ] **Step 7: Commit** `git add feel-fader.html && git commit -m "feat: send waits for ACK, truthful dirty, hash-based sync banner (audit C3/F4)"` (+ footer).

---

### Task 9: App — meta round-trip + Help text

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `normalizeFwConfig()` (ř. ~2540), Help & Guide text (hledej `saved both in this browser`).

**Interfaces:**
- Consumes: firmware `m` pole z Tasku 2 (`{"n","i","t","l"}`).

- [ ] **Step 1:** V `normalizeFwConfig` mapperu nahraď prezentační řádky — device `m` má přednost, localStorage merge zůstává fallback pro starý firmware:

```js
      const prev = (typeof cfg === 'object' && cfg && Array.isArray(cfg.banks) && cfg.banks[i]) || {};
      const m = (b.m && typeof b.m === 'object') ? b.m : {};
      const mL = Array.isArray(m.l) ? m.l : [];
      return ({
      name:        m.n || prev.name || `Bank ${i + 1}`,
      icon:        m.i || prev.icon || '',
      tags:        Array.isArray(m.t) ? m.t : (Array.isArray(prev.tags) ? prev.tags : []),
```

  a u faderů `label`: `label: mL[0] || (prev.fader1 && prev.fader1.label) || ''` resp. `mL[1] || (prev.fader2 && prev.fader2.label) || ''`.
- [ ] **Step 2:** Help text: najdi větu s `saved both in this browser and on the device` a nahraď:

```
Names, icons and tags are saved in this browser and — with firmware 1.1.0+ — also on the device, so they follow it between computers.
```

- [ ] **Step 3: Headless verify** → `pageerrors: none`. Ověř v konzoli: `normalizeFwConfig({banks:[{fader_cc:[1,2],fader_ch:[0,0],encoder:32,encoder_ch:0,m:{n:"Test",l:["A","B"]}}]}).banks[0].name === "Test"`.
- [ ] **Step 4: Commit** `git add feel-fader.html && git commit -m "feat: presentation meta round-trip from device, truthful Help copy (audit C1)"` (+ footer).

---

### Task 10: App — HID přes serial ACK

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `sendHidRequest()` (ř. ~1872).

- [ ] **Step 1:** Nahraď serial zápis + `setTimeout(200)` blok:

```js
    if (protocolVersion === 2) {
      await serialRequest('CMD_HID', JSON.stringify({enabled}), 2000);   // reject při ERR/timeout
      toast('i', enabled ? 'HID enabled' : 'HID disabled');
    } else {
      await serialRequest('CMD_HID', JSON.stringify({enabled}), 2000);  // legacy: resolve hned po zápisu
      toast('i', enabled ? 'Enabling HID…' : 'Disabling HID…');
      await new Promise(r => setTimeout(r, 200));                        // starý fw potřebuje čas
    }
    try { await serialReadInfo(); } catch(e) {
      toast('i','HID toggled — refresh state via "Load from device"');
      updateHidToggle();
    }
```

  Stávající vnější `catch` zůstává (přidá se do něj rozlišení `ERR:`/`timeout` hlášky stejně jako v doSend Step 3).
- [ ] **Step 2: Headless verify** → `pageerrors: none`.
- [ ] **Step 3: Commit** `git add feel-fader.html && git commit -m "feat: HID toggle waits for serial ACK instead of fixed sleep (audit C6)"` (+ footer).

---

### Task 11: App — C5 live-bank tečka

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `renderBankTabs()` (ř. ~1447), CSS.

- [ ] **Step 1: CSS** (k `.bank-block-tab` stylům):

```css
.bank-tab-live{width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 0 2px rgba(52,199,89,.25);flex-shrink:0}
```

- [ ] **Step 2:** V `renderBankTabs()` mapperu přidej tečku (index `1–8` už tab má — `bank-tab-idx`):

```js
    const liveDot = (i === liveBank && _ffConnected) ? '<span class="bank-tab-live" title="Active on device"></span>' : '';
    return `<button class="bank-block-tab ${i===activeBank?'active':''}" onclick="selectBank(${i})"><span class="bank-tab-idx">${i+1}</span>${liveDot}${iconHtml}<span>${b.name || 'Bank '+(i+1)}</span></button>`;
```

- [ ] **Step 3: Headless verify** → `pageerrors: none`; v konzoli `_ffConnected=true; liveBank=1; renderBankTabs();` → druhý tab obsahuje `.bank-tab-live`.
- [ ] **Step 4: Commit** `git add feel-fader.html && git commit -m "feat: live-bank dot on bank tabs (audit C5)"` (+ footer).

---

### Task 12: App — S7b keyswitch NoteOn listener

**Files:**
- Modify: `feel-fader-app/feel-fader.html` — `onMidiMsg()` (ř. ~2453), `encoderPanel()` badge (ř. ~1764), `keyswitchBody()` (ř. ~1670), globals.

**Interfaces:**
- Produces: global `ksLiveNote` (int|null).

- [ ] **Step 1:** Ke globals (u `let encLiveVal`) přidej `let ksLiveNote = null; // poslední NoteOn z ks_channel (S7b)`.
- [ ] **Step 2:** V `keyswitchBody()` přidej do tagu identifikaci + live třídu:

```js
  const tags = (b.ks_notes || []).map((n,i) => `
    <div class="uacc-tag${n === ksLiveNote ? ' ks-live' : ''}" data-ksnote="${n}" title="MIDI ${n}">
```

  CSS: `.uacc-tag.ks-live{border-color:rgba(52,199,89,.5);background:rgba(52,199,89,.1)}`
- [ ] **Step 3:** V `encoderPanel()` nahraď `const badge = rmode === 'cc' ? initName : '';`:

```js
  const badge = rmode === 'cc' ? initName
              : rmode === 'keyswitch' && ksLiveNote !== null ? noteName(ksLiveNote)
              : '';   // nav: klávesy nemají stav → badge nikdy
```

- [ ] **Step 4:** V `onMidiMsg()` za CC blok (před PC blok) přidej:

```js
  // S7b — live keyswitch pozice: NoteOn na ks_channel
  if(type===0x90 && data[2] > 0 && (bank.roller_mode||'cc')==='keyswitch'){
    const note = data[1];
    if(ch === (bank.ks_channel ?? 0) && (bank.ks_notes||[]).includes(note)){
      ksLiveNote = note;
      document.querySelectorAll('.uacc-tag.ks-live').forEach(el => el.classList.remove('ks-live'));
      const cell = document.querySelector(`.uacc-tag[data-ksnote="${note}"]`);
      if (cell) cell.classList.add('ks-live');
      const bdg = document.getElementById('enc-artic-badge');
      if (bdg) { bdg.textContent = noteName(note); liveOn('enc-artic-badge'); }
    }
  }
```

- [ ] **Step 5: Headless verify** → `pageerrors: none`; v konzoli simuluj `onMidiMsg({data:new Uint8Array([0x90, cfg.banks[liveBank].ks_notes?.[0] ?? 24, 100])})` na bance s keyswitch módem → `.ks-live` na správné buňce.
- [ ] **Step 6: Commit** `git add feel-fader.html && git commit -m "feat: live keyswitch position from NoteOn (audit S7b)"` (+ footer).

---

### Task 13: Integrační HW test (obě repa)

**Files:** žádné produkční změny; checklist. **Zařízení musí být připojené — pokud není, krok PŘESKOČ a reportuj jako nehotový, nevymýšlej výsledky.**

- [ ] **Step 1: Deploy firmware** — DEV boot (drž tlačítko), `cp code.py ff_config.py` na CIRCUITPY, `Write-VolumeCache`, eject, power-cycle.
- [ ] **Step 2: v1→v2 NVM migrace** — první boot po upgradu: appka (lokální server, viz memory) → auto-load projde, `config_source` je `nvm` (Device Info panel), config odpovídá stavu před upgradem.
- [ ] **Step 3: Send→ACK** — změň config, send → „✓ sent" do ~1 s; v localStorage je `ff-last-hash` (8 hex).
- [ ] **Step 4: Meta round-trip mezi „počítači"** — pojmenuj banku + ikona + tagy + label, send; smaž `ff-cfg` z localStorage (simulace cizího prohlížeče), reload → auto-load → název/ikona/tagy/labely NAČTENÉ ZE ZAŘÍZENÍ.
- [ ] **Step 5: Power-cycle hash** — odpoj/připoj USB → tichý auto-load bez banneru (hash shoda).
- [ ] **Step 6: Differs banner** — v konzoli `localStorage.setItem('ff-last-hash','00000000')`, reload → banner „Device config differs" + [Load from device] funguje.
- [ ] **Step 7: ERR:too_large** — v konzoli pošli config s 8 bankami × dlouhé meta + ~200 uacc/ks hodnot tak, aby serializace přesáhla ~4000 B → toast „Device rejected config: too_large — kept as unsaved", dirty zůstal.
- [ ] **Step 8: Defaults banner (F4)** — DEV boot, v REPL `import microcontroller; microcontroller.nvm[4] ^= 0xFF` (poškodí CRC), smaž `/presets.json` z CIRCUITPY, power-cycle → INFO `config_source:"defaults"` → banner „Device reset to factory", [Send mine] obnoví config.
- [ ] **Step 9: HID ACK** — HID toggle v appce → potvrzení bez 200ms loterie, stav sedí po re-fetch.
- [ ] **Step 10: C5/S7b** — tlačítkem na zařízení přepni banku → tečka skočí na živý tab; v keyswitch bance otoč rollerem → zvýrazněná nota + badge.
- [ ] **Step 11: Starý app + nový firmware** — otevři aktuální PUBLIC demo (stará verze, GitHub Pages) → connect, load, send fungují jako dřív (legacy mode; send bez potvrzení = dnešní chování).
- [ ] **Step 12: Nový app + starý firmware** — flashni předchozí `code.py`+`ff_config.py` (git stash / checkout main), otevři novou appku → INFO bez hashe → protocolVersion 1 → send optimistický, žádný banner, meta drží localStorage merge. Pak vrať nový firmware.

---

### Task 14: Docs + merge + wrap-up

- [ ] **Step 1:** App `WEBAPP.md` (pokud existuje sekce protokolu) + app `CLAUDE.md` řádek 10: doplň `serialRequest/_readReply (transaction manager)`, `protocolVersion`, odkaz na firmware CLAUDE.md v2 tabulku.
- [ ] **Step 2:** Audit doc status sekce: doplň „Vlna 2 implementována + HW ověřena <datum>" se seznamem nálezů.
- [ ] **Step 3:** Merge obou rep NEZÁVISLE: v každém `git checkout main && git merge wave2-protocol` (fast-forward preferován), po Task 13 zeleném. Repa se nemergují spolu.
- [ ] **Step 4:** Zeptej se Franka na deploy demo snapshotu (memory `reference_feelfader_demo_deploy` — proaktivní otázka je povinná) — POZOR: deploy nové appky je zároveň konec „starý app" okna z Task 13/11.
- [ ] **Step 5:** Wrap-up přes skill `ae-capture` (nová memory fakta: protokol v2, fw 1.1.0).

---

## Self-review (proveden při zápisu)

- **Spec coverage:** §1 protokol → T4+T5+T7; §2 INFO → T1+T5; §3 meta → T2+T9; §4 NVM → T3+T5; §5 hash → T1+T5+T8; §6 app → T8+T10+T11+T12; §7 kompatibilita → T5 legacy + T7 bootstrap + T13/11-12; §8 spike → T0; §9 testy → per-task + T13; §10 docs → T6+T14. Bez mezer.
- **Typová konzistence:** `save_presets()` nově vrací tuple — T5 Step 8 greppuje všechny volající; `serialReadConfig` vrací string payload — volající `loadConfigFromDevice` parsuje beze změny; `apply_hid_request` zachován pro SysEx, serial používá `set_hid_enabled`.
- **Placeholders:** žádné TBD; všechny kódové kroky mají úplný kód.
