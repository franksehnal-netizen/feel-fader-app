# Sync-on-connect — fader pozice hned při připojení (design, v1)

**Datum:** 2026-07-10
**Rozsah:** cross-repo — `feel-fader-firmware` (`ff_config.py`, `code.py`) + `feel-fader-app` (`feel-fader.html`). Repa zůstávají oddělená (žádný společný merge); změna je **zpětně kompatibilní**.
**Kontext:** Dnes appka po připojení ukazuje fadery na defaultu (64), dokud zařízení nepošle CC — což dělá až při **přepnutí banky** (`on_bank_changed` → `fader*.snapshot`). Proto při prvním stisku HW tlačítka fadery „skočí" na reálné pozice. Frank chce, aby appka ukázala reálné pozice **hned při connectu**.

Rozhodnutí z brainstormingu: **varianta A2** — fader pozice se přenesou v **serial CMD_INFO odpovědi** (JSON info), kterou appka čte při každém connectu. Ne přes MIDI (žádný timing/wedge risk). Scope: **jen fadery**.

## Cíl

Po připojení appka rovnou zobrazí **reálné pozice obou faderů** (ne default 64), takže první přepnutí banky už neposkočí a stav sedí od začátku.

## Kritérium úspěchu

1. Připojím zařízení → on-screen fadery jsou **na reálných pozicích** (odpovídají fyzickým faderům), ne na 64.
2. První stisk HW tlačítka (přepnutí banky) už fadery **viditelně nepohne** (jsou už synchronizované).
3. Zpětná kompatibilita: nová appka + **starý** firmware → chování jako dnes (žádné `faders` pole → fallback na default). Starý app + **nový** firmware → app extra JSON pole ignoruje.
4. Bez SysEx přes MIDI out; bez bumpu protokolu (aditivní JSON pole).

## Mechanismus (A2)

Firmware přidá do **CMD_INFO** odpovědi (JSON info, kterou appka čte přes serial při connectu) pole s aktuálními hodnotami faderů; appka je při `serialReadInfo` přečte a nastaví pozice on-screen faderů.

### Firmware (`feel-fader-firmware`)

- **`ff_config.py` — `build_info_dict(...)`:** přidat nový volitelný parametr `faders` (list dvou intů 0–127) a zapsat ho do vráceného dictu jako `"faders": [v1, v2]` (jen když je předán). Aditivní, nemění stávající pole.
- **`code.py` — volající místa CMD_INFO** (serial handler ~ř.603 i `send_info_sysex` ~ř.336): před sestavením info přečíst aktuální hodnoty faderů a předat je do `build_info_dict(..., faders=[fv1, fv2])`.
  - Hodnoty: čerstvý read přes `read_fader_7bit_inverted_filtered(fader1_adc)` / `(fader2_adc)` (ř.238) — zaručeně aktuální; alternativně `fader1_obj.prev_out` / `fader2_obj.prev_out` (poslední odeslaná). Doporučeno **čerstvý read** (nezávislé na tom, zda hlavní smyčka už proběhla).
  - Kanál/CC se do info **nedává** — appka pozici mapuje na aktivní banku sama (hodnota 0–127 je pozice faderu, nezávislá na CC).
- Nemění config, config_hash, ani schema_version (aditivní info pole).

### App (`feel-fader-app` — `feel-fader.html`)

- **`serialReadInfo()`** (~ř.2878) už parsuje `info` JSON a plní `DEVICE_INFO.*`. Přidat: pokud `Array.isArray(info.faders) && info.faders.length >= 2`:
  - `liveValues.f1 = clamp0..127(info.faders[0])`, `liveValues.f2 = clamp0..127(info.faders[1])`.
  - Napozicovat palce z `liveValues` (`positionThumbs()` — pF čte cache `_faderTravel`, fallback na měření když layout ještě neproběhl) a přepsat hodnoty (`setTxt('f1-val',…)`, `setTxt('f2-val',…)`).
  - Odznačit placeholder stav (`liveOn('f1-val')`, `liveOn('f2-val')`) — S8: reálná data ze zařízení = plná sytost, ne default.
- Když `info.faders` chybí (starý FW) → nic se nemění (dnešní chování, default 64).
- Aplikuje se ve **všech** connect cestách, protože `serialReadInfo` se volá v každé z nich (bootstrap na ř.~2899, 2957).
- Pozor na timing: pokud se `serialReadInfo` zavolá dřív, než je fader-tracks geometrie hotová, `liveValues` se přesto nastaví a palce se dopozicují při nejbližším `positionThumbs`/layoutu (hodnota persistuje). `positionThumbs` volané zde je best-effort.

## Ověření

- **HW test (Frank, obě strany nasazené):**
  1. Fyzicky nastav fadery na nedefaultní pozice → připoj zařízení → on-screen fadery **hned sedí** na reálných pozicích (ne 64).
  2. Stiskni HW tlačítko (přepnutí banky) → fadery se **viditelně nepohnou** (už synchronizované). Levý ADC jitter ±1 je OK.
- **Zpětná kompatibilita:** nová appka + starý firmware (bez `faders`) → fallback na 64, žádná chyba. (Ověřit: buď starým FW, nebo dočasně vypnout přidání pole.)
- **App headless:** stub serial info s `faders:[100,20]` → `serialReadInfo` nastaví `liveValues` a napozicuje palce; bez `faders` → beze změny; žádné page errors.
- **Firmware:** `build_info_dict(..., faders=[100,20])` vrací dict s `"faders":[100,20]`; bez parametru pole chybí. Serial parse test (`tests/test_wave2_serial_parse.py` vzor).

## Mimo rozsah (v1)

- Enkodér/roller pozice (šlo by přidat stejně přes další info pole).
- Sync po každém pohybu (řeší už živé zrcadlení / snapshot na bank change).
- Control mód (samostatná featura).

## Vztah k ostatní práci / repa

Cross-repo, ale **zpětně kompatibilní a aditivní** → repa se nasazují nezávisle (nemusí lockstep). Protokolová tabulka v `feel-fader-firmware/CLAUDE.md` + app `CLAUDE.md` doplnit o `faders` pole v CMD_INFO. Větve: `sync-on-connect` v obou repech. HW test na konci.
