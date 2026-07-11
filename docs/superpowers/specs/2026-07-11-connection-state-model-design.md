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
- `_midiState`: `'granted' | 'denied' | 'unsupported'` — **nový** modulový var, nastavovaný v `initMidi` (unsupported když chybí `requestMIDIAccess`; denied v catch; granted při úspěchu).
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

### Náhrada volání (retire `setBanner` + `updateStatus`)
- `updateStatus()` (odvození z `loaded`) → **smazat**; oba callery (`connectInputs` not-found větev, `handleSysEx`) → `renderConnState()`.
- `setBanner(...)` pro stav připojení (`initMidi` start/denied/unsupported, `connectInputs` found/not-found) → nastavit surový signál + `renderConnState()`.
- `setBanner('connected', t('midi.synced'))` a spol. (transientní „synced"/„config loaded" potvrzení, ~5 míst) → `toast()` (už se vedle většiny volá) — dot/text drží `renderConnState`.
- `showSyncBanner`/`hideSyncBanner` (differs/defaults) → **beze změny**; místo doprovodného `setBanner('searching','')` volat `renderConnState()`.

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

## Mimo rozsah
- Viditelný connection panel (byla varianta 2 — nebráno).
- Sync differs/defaults banner (beze změny).
- Změna protokolu / firmware / auto-grant MIDI.
- Footer V10.

## Otevřené (doladit v plánu)
- Přesné UI texty (finalizovat s Frankem při review specu).
- Umístění `#live-note` (u stage vs pod header) — implementer zvolí dle layoutu, decentní.
