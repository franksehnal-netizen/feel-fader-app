# Stavový model připojení (Vlna 3) — design

**Datum:** 2026-07-11
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu/firmwaru.

## Kontext / problém

Produktový audit (2026-07-03) označil **cross-device seamlessness (45 %)** za hlavní slabinu — ne vzhled, ale důvěryhodnost stavu připojení. Dnes se stav odvozuje **nekonzistentně z více zdrojů**:

- `setBanner(type,m)` — header dot/text z MIDI přítomnosti (`_ffConnected`) + transientní „synced" hlášky.
- `updateStatus()` — header dot/text z `loaded` (config načten). **Bug:** ukáže „connected", i když je zařízení odpojené, jen protože config zůstal v UI.
- `.live-placeholder` — dim živých hodnot z `_ffConnected` (render-time).
- `showSyncBanner()` — sync differs/defaults zvlášť (ponecháno beze změny).

Tyto zdroje se můžou rozejít a chybí poctivé přiznání stavů, kdy **config jede po serialu, ale MIDI ne** → živé pozice faderů jsou tiše mrtvé (zavádějící; varování z větve `midi-denied-visibility` se nikdy nemergovalo).

## Cíl

Jeden kanonický stav připojení odvozený ze surových signálů + jedna render funkce obsluhující všechny surface. Header nikdy nelže; nedostupnost živého náhledu je poctivě přiznaná.

## Kritérium úspěchu

- Header dot/text vychází **výhradně** z `connState()` (ne z `loaded`).
- Odpojení zařízení (i s načteným configem) → header ukáže „No device", ne „Connected".
- Serial-linked + MIDI denied/unsupported → stav „Connected · no live view" + inline pozn. u faderů; živé hodnoty dimované.
- MIDI denied/unsupported bez linku → „MIDI blocked" s akční hláškou.
- Žádná změna protokolu; ověřitelné headless (nasimulovat signály → zkontrolovat stav + surface).

## Model

### Surové signály (stav modulu)
- `_midiState`: `'pending' | 'granted' | 'denied' | 'unsupported'` — **nový** modulový var, **init `'pending'`** (před resolvem grantu → mapuje na DISCONNECTED, ne na blocked). Nastavovaný v `initMidi`: `'unsupported'` když chybí `requestMIDIAccess`; `'denied'` v catch; `'granted'` při úspěchu. `liveAllowed()` vyžaduje přesně `'granted'`.
- `_ffConnected` (existuje) — Feel Fader MIDI vstup otevřen (živé hodnoty IN).
- `_serialPort` (existuje) — Web Serial port otevřen (config R/W + CMD_INFO).
- `loaded` (existuje) — config v UI. **Nepoužívá se** pro odvození headline (jen pro rozhodnutí neničit UI při odpojení).

### `connState()` → enum
Jediný vzorec „tečou živé hodnoty" žije v helperu `liveAllowed()` a používá ho i `connState()` i render placeholderů (žádná duplicita):
```
function liveAllowed(){ return _midiState === 'granted' && _ffConnected; }

function connState(){
  const linked = _ffConnected || !!_serialPort;
  if (linked)  return liveAllowed() ? 'CONNECTED_LIVE' : 'CONNECTED_BLIND';
  if (_midiState === 'denied' || _midiState === 'unsupported') return 'MIDI_BLOCKED';
  return 'DISCONNECTED';
}
```

Pozn.: když je `_ffConnected` true, je MIDI granted → `live` true → `CONNECTED_LIVE`. `CONNECTED_BLIND` proto nastává jen při **serial-linked bez živého MIDI** (denied/unsupported/jen ne-Feel-Fader MIDI). Serial se otevírá on-demand (Start/load) — otevření nemění headline, jen povyšuje `linked`.

### `renderConnState()` — jediná render funkce
Zavolá `connState()` a nastaví všechny surface:

| Stav | Header dot | Header text | Živé hodnoty | Inline pozn. |
|---|---|---|---|---|
| `DISCONNECTED` | neutrální (`.h-status-dot` bez třídy) | „No device" | dim (placeholder) | skrytá |
| `CONNECTED_LIVE` | zelený (`.on`) | „Connected" (auto-hide 3 s) | živé | skrytá |
| `CONNECTED_BLIND` | **amber** (`.warn`, nová třída) | „Connected · no live view" (drží) | dim | **viditelná** u faderů |
| `MIDI_BLOCKED` | červený (`.err`) | akční: denied → jak povolit; unsupported → Chrome/Edge only | dim | skrytá |

- **Živé hodnoty (dim):** centralizovat do helperu `liveAllowed()` = `_midiState==='granted' && _ffConnected`; `render*` používá `liveAllowed()` místo přímého `_ffConnected` pro třídu `.live-placeholder` (fader val spany, enc badge). `renderConnState` navíc přepne body třídu / zobrazí inline pozn.
- **Inline poznámka:** nový skrytý element u fader stage (`<div id="live-note" hidden>`), text „Live positions unavailable — MIDI not connected". Zobrazí se jen v `CONNECTED_BLIND`.

### Náhrada volání (retire `setBanner` + `updateStatus`) — přesná mapa
Ověřeno proti evidence (všech 18 míst); po migraci **smazat def `updateStatus()` (3002) i `setBanner()` (2573)**:

| Ř. | Dnes | Náhrada |
|---|---|---|
| 2444 | `setBanner('error','')` (unsupported) | `_midiState='unsupported'; renderConnState()` |
| 2445 | `setBanner('searching','')` (init start) | `renderConnState()` (→ DISCONNECTED, `_midiState='pending'`) |
| 2461 | `setBanner('error', midi.denied)` (catch) | `_midiState='denied'; renderConnState()` |
| 2491 | `setBanner('connected', names)` (FF nalezen) | `_midiState='granted'; renderConnState()` (`_ffConnected` už nastaven níže) |
| 2512 | `setBanner('searching', not_feel_fader)` | `renderConnState()` (DISCONNECTED — viz F3) |
| 2514 | `setBanner('searching', none)` | `renderConnState()` |
| 2516 | `updateStatus()` | `renderConnState()` |
| 2605 | `setBanner('connected', synced)` (+toast) | drop banner, ponechat toast, `renderConnState()` |
| 2664/2665 | `setBanner('connected', synced)` + `updateStatus()` (+toast 2666) | drop obě, ponechat toast, `renderConnState()` |
| 2669 | `setBanner('connected','')` (v catch, prázdný text) | drop (spurious), `renderConnState()` |
| 2827 | `updateStatus()` (po serial load) | `renderConnState()` — **viz F2** |
| 2849 | `setBanner('connected', synced)` (+toast 2850) | drop banner, ponechat toast, `renderConnState()` |
| 2875 | `showSyncBanner('defaults'); setBanner('searching','')` | ponechat showSyncBanner; banner→`renderConnState()` |
| 2878 | `showSyncBanner('differs'); setBanner('searching','')` | totéž |
| 2881 | `setBanner('connected', synced)` (+toast) | drop banner, ponechat toast, `renderConnState()` |
| 2885 | `setBanner('searching','')` | `renderConnState()` |

- `showSyncBanner`/`hideSyncBanner` (differs/defaults) → jinak **beze změny**.
- **F2:** na ř.2828 už je one-shot toast „Loaded over USB serial, but MIDI is blocked — live fader display won't update…" = přesně stav `CONNECTED_BLIND`. Nový perzistentní stav (amber dot + `#live-note`) ho nahrazuje → **tento toast (2828) odstranit** (jinak duplicita zprávy).
- **F3 (minor):** DISCONNECTED má dnes dvě varianty textu (`midi.none` vs `midi.not_feel_fader`). Sjednotit na „No device" (rozlišení ne-FF MIDI je málo hodnotné); pokud Frank chce nuanci, `renderConnState()` může vzít volitelný detail — default sjednoceno.

### Nové/upravené prvky
- CSS: `.h-status-dot.warn` (amber bg, jemný puls volitelně); `.live-note` (drobná, `--t3`, u stage).
- i18n klíče: `status.no_device`, `status.no_live_view`, `live.note_unavailable`; ponechat `status.connected`, `midi.denied`, `midi.unavailable`. Odstranit osiřelé po retire (`status.disconnected` pokud nikde jinde; ověřit grepem).

## Ověření (headless, puppeteer-core, pipe:true)
Nasimulovat kombinace signálů a zkontrolovat `connState()` + surface:
- `_midiState='granted'`, `_ffConnected=true` → `CONNECTED_LIVE`; header dot `.on`, text „Connected"; `#live-note` hidden; `liveAllowed()===true`.
- odpojení: `_ffConnected=false`, `_serialPort=null`, `loaded=true` → `DISCONNECTED`; header „No device" (NE „Connected"); živé hodnoty placeholder.
- serial-only: `_serialPort={}`, `_midiState='denied'`, `_ffConnected=false` → `CONNECTED_BLIND`; dot `.warn`, text „…no live view"; `#live-note` visible; `liveAllowed()===false`.
- MIDI blocked: `_midiState='denied'`, `_ffConnected=false`, `_serialPort=null` → `MIDI_BLOCKED`; dot `.err`, akční hláška.
- unsupported: `_midiState='unsupported'`, nic linked → `MIDI_BLOCKED` (text „Chrome/Edge only").
- Žádný page error; grep: `updateStatus` a stavové `setBanner(` volání = 0 (kromě retire shim, pokud zvolen).

## Self-review (2026-07-11, bez Codexu)

Verdikt SOUND-WITH-GAPS; mezery F1/F2/F3 zapracované výše. Ověřeno proti `docs/superpowers/review/2026-07-11-connstate-evidence.md`: `connState()` odvození exhaustivní (transient plug = CONNECTED_LIVE hned; ne-FF MIDI = DISCONNECTED); všech 18 `setBanner`/`updateStatus` míst má náhradu; „synced" flashe mají vedle sebe existující `toast` (nic se neztrácí); `_serialPort` spolehlivý (na failu vždy `close()`+`=null` — ř.1946/2851); oba `.live-placeholder` sinky přepnutelné na `liveAllowed()`.

## Mimo rozsah
- Viditelný connection panel (byla varianta 2 — nebráno).
- Sync differs/defaults banner (beze změny).
- Změna protokolu / firmware / auto-grant MIDI.
- Footer V10.

## Otevřené (doladit v plánu)
- Přesné UI texty (finalizovat s Frankem při review specu).
- Umístění `#live-note` (u stage vs pod header) — implementer zvolí dle layoutu, decentní.
