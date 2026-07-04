# Feel Fader Vlna 2 — Cross-device seamlessness: design protokolu v2

**Datum:** 2026-07-04 · **Stav:** schváleno Frankem (brainstorming + Codex oponentura zapracována)
**Řeší audit nálezy:** C1 (P0), C3 (P1), C5 (P2), C6 (P3), F4 (P2), S7b (P2) — `docs/feel-fader-product-audit-2026-07-03.md`
**Repa:** `feel-fader-app` + `feel-fader-firmware` — trvale oddělená, mění se v protokolovém lockstepu (žádný společný merge).

## Cíl

Sync mezi appkou a zařízením přestane být slepý: zápis má potvrzení, config má hash, korupce NVM je viditelná, názvy/ikony/tagy přežívají na zařízení, appka ukazuje živou banku a keyswitch pozici. Starý firmware i starý app snapshot dál fungují beze změny chování.

## 1. Serial protokol v2 — transakční rámce

Transport beze změny: `\n`-terminated UTF-8 řádky na `usb_cdc.data`. Novinka: request ID (`rid`) a typované odpovědi.

| Request (app→fw) | Response (fw→app) |
|---|---|
| `CMD_R:<rid>` | `CFG:<rid>:{banks:[...],macro_keys:...}` |
| `CMD_INFO:<rid>` | `INFO:<rid>:{...}` |
| `CMD_W:<rid>:{cfg}` | `ACK:<rid>:<hash>` nebo `ERR:<rid>:<důvod>` |
| `CMD_HID:<rid>:{enabled}` | `ACK:<rid>` nebo `ERR:<rid>:<důvod>` |

- `rid` = krátký string bez `:` (app: inkrementující counter). Firmware ho jen echuje — žádná perzistence.
- `ERR` důvody: `parse` (nevalidní JSON), `invalid` (neprošla normalizace), `too_large` (nevejde se do NVM), `nvm_write` (zápis selhal), `hid` (HID přepnutí selhalo).
- **Legacy mode per-line:** firmware pozná starý tvar řádku a odpoví postaru — `CMD_R` / `CMD_INFO` (bez `:`) → raw JSON bez prefixu; `CMD_W:{...}` / `CMD_HID:{...}` (za první dvojtečkou `{`) → aplikovat beze změny, **žádná odpověď**. Starý app snapshot tedy s novým firmwarem funguje identicky jako dnes.
- **App transaction manager:** jediné místo, které čte serial. Jedna transakce naráz (fronta), párování odpovědi podle typu + `rid`; řádky s neočekávaným typem/rid se zahodí (zaloguje do konzole). Drain receive bufferu jen non-blocking před otevřením transakce (úklid, ne ochrana — ochranou je párování).
- **Bootstrap / detekce verze:** app po připojení pošle nejdřív **legacy** `CMD_INFO` (odpoví starý i nový firmware raw JSONem). `schema_version >= 2` a přítomný `config_hash` → `protocolVersion = 2`, všechna další komunikace v2 rámci. Jinak `protocolVersion = 1` → app degraduje na dnešní chování (optimistický send bez ACK, žádný hash banner, meta jen v localStorage). Detekce je explicitní z INFO, ne timeout-based.

## 2. CMD_INFO v2 — nová pole

```json
{ ..., "schema_version": 2, "config_hash": "<crc32 hex>", "config_source": "nvm" | "file" | "defaults" }
```

UX reaguje jen na `config_source: "defaults"` (banner „device reset to factory"); rozlišení `nvm`/`file` je debug info v Device Info panelu.

## 3. Config formát — prezentační meta pole (C1b)

Interní bank dict přibude klíč `"m"`:

```json
"m": { "n": "<name ≤24>", "i": "<icon-id ≤16>", "t": ["<tag ≤12>", …max 4], "l": ["<label1 ≤12>", "<label2 ≤12>"] }
```

- `normalize_web_config` mapuje z web formátu (`name`/`icon`/`tags`/`fader1.label`/`fader2.label`) a **ořezává na limity** (znaky přes limit tiše zahodí); `parse_banks` čte s defaulty — chybějící `m` = dnešní chování (name „Bank N", prázdné ikony/tagy).
- `CMD_R` vrací `m` v interním formátu; app `normalizeFwConfig` mapuje zpět na web pole.
- **App-only merge (C1a) zůstává** jako fallback: při loadu z firmware bez `m` (starý fw / protocolVersion 1) se prezentační pole mergují z localStorage podle indexu banky. Nikdy víc tiché smazání.
- Help & Guide text „saved both in this browser and on the device" začne platit; pro protocolVersion 1 app zobrazí „(names stay in this browser — update firmware to store them on the device)".

## 4. NVM v2 (F4)

- Preset blok od offsetu 0: `marker2(2) + len(2) + crc(4|1) + data`. CRC32 (`binascii.crc32`), pokud na CP 9.x/RP2040 dostupné — ověří úvodní spike; fallback stávající `crc8`.
- **Pořadí zápisu** (mitigace brownoutu, vědomé reziduum): invalidovat marker → zapsat data → len+CRC → marker naposled. Dvouslotový journal zamítnut — 2× ~2,5 kB se do 4 kB NVM nevejde. Brownout přesně během zápisu → CRC fail → defaults + **viditelný** `config_source:"defaults"` banner; config je v localStorage appky k okamžitému re-sendu.
- Loader: v2 (validní CRC) → fallback v1 marker (jednorázová migrace, první save přepíše na v2) → soubor → `DEFAULT_PRESETS`; výsledek do `config_source`.
- Footer (HID flag, 8 B na konci NVM) beze změny.
- `json.dumps(..., separators=(',',':'))` všude (dnešní default přidává mezery).
- Překročení rozpočtu při `CMD_W` → `ERR:<rid>:too_large`, stav zařízení se nemění.

## 5. `config_hash` — sémantika

- `hash = crc32(serialize_state())` kde `serialize_state()` je **jediná** kanonická serializace presetů: `{"banks":…,"macro_keys":…}`, dict stavěný ve fixním pořadí klíčů v kódu, kompaktní separators. Používá ji save, CMD_R, hash. **HID flag do hashe nepatří** (žije ve footeru, mění se přes CMD_HID).
- Firmware drží `_config_hash` v RAM: přepočet po bootu (nad stavem načteným z libovolného zdroje) a po každém **úspěšném** apply+save — serial CMD_W i SysEx CMD_W shodně. Neúspěšný zápis hash nemění.
- App hash nikdy nepočítá — je to opaque token: uloží si ho z `ACK` do localStorage (`ff_last_hash`), při reconnectu porovná s `INFO.config_hash`:
  - shoda → tichý auto-load (dnešní chování);
  - rozdíl, nebo `config_source:"defaults"` → banner **„Device config differs — Load from device / Send mine"**, žádné tiché přepsání;
  - hash v INFO chybí → protocolVersion 1 → dnešní chování.

## 6. App chování

- **doSend (C3):** zápis → čekání na `ACK`/`ERR` (timeout **5 s**). ACK → `dirty=false`, uložit hash, „✓ sent". ERR/timeout → **dirty zůstává**, error toast s důvodem, tlačítko zpět na „send" (retry = klik). ProtocolVersion 1 → dnešní optimistická cesta beze změny.
- **sendHidRequest (C6):** čekání na serial `ACK` (timeout **2 s**) místo `sleep(200)`; pak re-fetch INFO. Firmware: `set_hid_enabled(enabled) -> (ok, reason)` oddělené od transportu — MIDI ACK větev z `apply_hid_request` se ruší.
- **C5 (app-only):** tab banky zobrazí index `1–8` (pořadí cyklení) a zelenou live tečku na `liveBank` (z PC handleru Vlny 1), vizuálně odlišnou od výběru `activeBank`. Klik = normální výběr tabu.
- **S7b (app-only):** NoteOn listener na `ks_channel` v keyswitch módu → zvýraznit notu v gridu + noteName v badge (drží se do dalšího NoteOn); nav mód badge skrytá.

## 7. Kompatibilita — matice

| | starý firmware | nový firmware |
|---|---|---|
| **starý app** | dnešní stav | legacy mode per-line → identické chování (žádné ACK, raw JSON odpovědi) |
| **nový app** | bootstrap legacy INFO → protocolVersion 1 → degradace na dnešní chování, meta jen localStorage | plný v2 |

## 8. Úvodní HW spike (před implementací, ~hodina)

1. `binascii.crc32` dostupnost na CircuitPython 9.x / RP2040 → volba CRC32 vs crc8.
2. Worst-case NVM budget: 8 bank × plné `uacc_values` + keyswitch noty + nav + macro + meta na limitech, kompaktní dumps → musí ≤ 4096 − 8 (footer) B s rezervou ≥ 10 %; jinak se limity meta polí zmenší.
3. RAM při `json.dumps` ~3 kB stringu + orientační trvání `usb_cdc.data.write()` bloku (nesmí viditelně zaseknout fader loop).

## 9. Testy

- **pytest (`ff_config`, host):** meta round-trip + ořez limitů, parse_banks defaulty, NVM header v2 pack/unpack + v1 migrace + CRC fail, serialize_state determinismus, build_info_dict v2, legacy/v2 rozpoznání řádku, ERR případy.
- **App (headless render):** žádné pageerrors; transaction manager unit-testovatelný v konzoli.
- **Integrační HW checklist:** send→ACK+hash; ERR:too_large (umělý velký config); power-cycle → hash shoda → tichý load; ruční korupce NVM bajtu (DEV) → `defaults` banner; starý app snapshot (demo) + nový firmware → beze změny chování; nový app + starý firmware → degradace; HID toggle přes ACK; C5 tečka sleduje tlačítko na zařízení; S7b zvýraznění při otočení rolleru v keyswitch módu.

## 10. Dokumentace (součást implementace)

- Obě `CLAUDE.md` protokolové tabulky přepsat na v2 (firmware tabulka dnes lživě tvrdí „serial se pro config nepoužívá" — opravit; doplnit serial řádkový protokol, legacy mode, hash sémantiku).
- `WEBAPP.md` — transaction manager, protocolVersion, hash workflow.
- Help & Guide text dle §3.

## Mimo scope Vlny 2

Stavový model připojení (Vlna 3, těží z config_hash) · F3 send-on-bank-switch · I6/I8/S8/S9/V10/V12 · SysEx cesta se nerozšiřuje (jen zachová hash konzistenci při CMD_W).

## Záznam oponentury (Codex 2026-07-04)

Přijato: rid + typované odpovědi, legacy mode per-line, oddělení `set_hid_enabled` od transportu, přesná hash sémantika (bez HID flagu), kanonický serialize_state, timeouty 5/2 s, kompaktní dumps, CRC32 preferován, worst-case NVM spike, explicitní detekce verze z INFO. Zamítnuto: A/B journal (nevejde se do 4 kB NVM — místo něj safe write order + viditelná recovery), YAGNI na meta pole (Frankovo rozhodnutí: plná persistence). Půl: `config_source` tri-state zůstává, UX reaguje jen na `defaults`.
