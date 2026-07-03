# Feel Fader — Produktový audit v2: intuitivnost & seamless experience

**Datum:** 2026-07-03 · **Rozsah:** app (`feel-fader.html`, 3 427 ř.) + firmware (`code.py`, `boot.py`, `ff_config.py`) · **Metoda:** reálný render (headless Chrome, 31 stavů, light/dark/360 px) + statický rozbor kódu obou rep · **Typ:** čistá diagnostika, bez zásahů do kódu.

> Stavy vyžadující hardware (connect transition, live sync, bank cycling) hodnoceny z kódu obou rep — označeno `zdroj: kód`. Screenshoty: `scratchpad/shots/01–31` (session scratchpad, reference `[shot NN]` níže).
> Navazuje na audit 2026-06-27 — vyřešené nálezy (V1–V7, A1–A5, S1–S4, I2) se neopakují, DROP položky (I1, V5, V6, I3, A6) se znovu neotvírají. UX pass 2026-07-01 (11 bodů) brán jako baseline.

---

## Status: Vlna 1 implementována 2026-07-03

**App (`feel-fader.html`) — hotovo, ověřeno headless renderem, mergnuto do main:**
S5 (debounced autosave + beforeunload) · I5 (drag ≠ dirty) · H5 (midi-text) · I7+V8+V9 (textové opravy) · V11 (subhead --t2) · A7 (44px ks-handle + capture tlačítka) · S7a (prázdná badge se nerenderuje) · C4 (toast při selhání auto-loadu) · I4 (key-capture: Esc/blur/klik mimo = zrušit, unsupported hint, `.capturing` styl) · S6 (Settings modal smazán, korektní DEV/PROD postup v Help & Guide).

**Firmware — implementováno na branchi `wave1-audit-fixes`, ČEKÁ NA HW TEST (nemergováno):**
C2 (ProgramChange při bank change — protokol zdokumentován v obou CLAUDE.md) · F1 (long-press bez makra = bank switch) · F2 (PROD `disable_usb_drive`). Pytest 37/37 zelených. Deploy blokován: zařízení bylo v PROD módu (disk write-protected) — nutný DEV boot (držet tlačítko při připojení USB), pak zkopírovat `code.py` + `boot.py` a projít Task 14 checklist v plánu.

**Plán:** `docs/superpowers/plans/2026-07-03-wave1-audit-fixes.md`

---

## 1. Executive summary

Vizuální vrstva drží úroveň z 27. 6. — post-audit disciplína (tokeny, typografie, focus, touch targety) se v nových featurách většinou udržela a appka na screenshotech působí hotově. Problém dnešního stavu není vzhled, ale **důvěryhodnost**: produkt slibuje seamless sync a tiše ho nedodržuje. Pět vzorců:

1. **Persistence je slib, který drží jen půlka produktu.** Help tvrdí „names, icons and tags are saved both in this browser and on the device" — firmware ale tato pole zahazuje (`normalize_web_config` je nezná). Důsledek: **tichý auto-load při každém reconnectu přepíše názvy, ikony, tagy i labely na „Bank 1–N"** a rovnou to uloží do localStorage (C1). K tomu se běžné edity do localStorage vůbec neukládají — refresh taby = ztráta všeho od posledního send, bez varování (S5). Uživatelova práce se ztrácí dvěma nezávislými cestami.
2. **Sync je jednosměrný — device je pro appku němý.** App má hotový handler na Program Change pro sledování banky, firmware ale žádný PC neposílá (C2): přepnutí banky tlačítkem na zařízení appka nikdy nezaregistruje, `liveBank` zamrzne a live fadery přestanou odpovídat. Send přes serial nemá potvrzení — „✓ sent" je optimistická fikce i při chybě na zařízení (C3). „Neviditelný sync" je dnes fakticky „neexistující sync".
3. **Power featury nemají navržené okraje.** Key-capture nejde zrušit — Esc se chytí jako klávesa, nenamapovaná klávesa nechá stav „press a key…" viset (I4). Navigation mód nejde nakonfigurovat offline (I6). Hlášky odkazují na už neexistující názvy „Track-nav" a „Device Info" (I7).
4. **Firmware má precizní signálovou cestu, ale překvapivé interakční hrany.** Filtrace, interpolace a 8ms rate-limit jsou na „seamless" pocit nastavené dobře. Ale: dlouhý stisk bez nakonfigurovaného makra spolkne bank switch a neudělá nic (F1); přepnutí banky okamžitě vystřelí pozici faderů do DAW, zatímco boot je záměrně tichý (F3); PROD mód nechává CIRCUITPY disk viditelný a oboustranně zapisovatelný, ačkoli dokumentace tvrdí opak (F2).
5. **Mrtvoly z předchozích iterací podkopávají jinak čistý celek.** Osiřelý Settings modal s neplatnými instrukcemi (1–10 bank, „edit boot.py"), mrtvé footer odkazy, Cloudflare e-mail artefakt, dead code cesty (`sendSysEx`, `midi-text`).

**Vzdálenost od cíle „absolutní intuitivnost":** vizuálně ~90 %, interakčně ~75 %, **cross-device seamlessness ~45 %**. První pětiminutovka je dobrá (Start flow funguje, základní flow CC→send nevyžaduje chápat HID — R13 splněno). Denní práce s hardwarem je ale místo neviditelného syncu loterie: dva P0 nálezy sedí přesně v deklarované hlavní hodnotě produktu.

---

## 2. User journey mapa

### Fáze A — první použití (vybalení → první CC v DAW)
Dělí ho **2 gesta** (Start + výběr portu v pickeru) — dobré. Defaultní banky fungují okamžitě, pokročilé featury nepřekáží.

| Pořadí | Tření | Nález |
|---|---|---|
| 1 | Welcome slibuje „configuration loads automatically", ale první použití vyžaduje klik na Start + picker | V12 (P3) |
| 2 | Po vstupu žádné vodítko, že thumby na fotce zařízení jsou interaktivní (DROP I1 — neotvírám, jen konstatuji návaznost) | — |
| 3 | Navigation mód šedý s vysvětlením jen v `title` tooltipu — na touch neviditelné | I6 (P2) |

### Fáze B — denní práce (reconnect, editace, send, hraní)
Nejtvrdší fáze — zde sedí oba P0.

| Pořadí | Tření | Nález |
|---|---|---|
| 1 | Reconnect tiše přepíše názvy/ikony/tagy/labely bank defaulty | **C1 (P0)** |
| 2 | Přepnutí banky tlačítkem na zařízení appka nevidí — live hodnoty zamrznou | **C2 (P0)** |
| 3 | „✓ sent" bez potvrzení ze zařízení — chyba zápisu se nikdy nedozví | C3 (P1) |
| 4 | F5/zavření taby = ztráta všech editů od posledního send, bez varování | S5 (P1) |
| 5 | Testovací drag fadaru nastaví falešné „Unsaved changes" → navíc zablokuje tichý auto-load při reconnectu | I5 (P1) |
| 6 | Držení tlačítka >0,5 s bez makra = nic (spolknutý bank switch) | F1 (P1) |
| 7 | Selhání auto-loadu je tiché — uživatel neví, že kouká na lokální stav | C4 (P2) |
| 8 | V tabech není vidět, která banka je aktivní **na zařízení** | C5 (P2) |
| 9 | Přepnutí banky skočí parametrem v DAW (fader snapshot) | F3 (P2) |

### Fáze C — power-user (keyswitch, HID, macro, 8 bank)
Keyswitch editor je nejsilnější nová plocha (dual slider + edge-edit + presety — drží se dobře i na 360 px, [shot 31]).

| Pořadí | Tření | Nález |
|---|---|---|
| 1 | Key-capture: Esc se chytí jako klávesa, nejde zrušit, nenamapovaná klávesa → visící stav | I4 (P1) |
| 2 | Navigation nejde připravit offline (gating na živém HID stavu) | I6 (P2) |
| 3 | Hlášky odkazují na stará jména („Track-nav", „Device Info") | I7 (P2) |
| 4 | V keyswitch/nav módu žádná live zpětná vazba pozice rolleru + prázdná badge pilulka | S7 (P2) |
| 5 | Tichý factory fallback při korupci NVM — zařízení se „samo přenastaví" | F4 (P2) |
| 6 | PROD mód: viditelný disk, oboustranný zápis, dokumentace tvrdí opak | F2 (P1) |
| 7 | 8 bank → tab overflow bez scroll affordance | S9 (P3) |
| 8 | Osiřelý Settings modal s neplatným návodem na DEV/PROD | S6 (P2) |

---

## 3. Tabulka nálezů

| ID | Osa | Záv. | Náročnost | Protokol ⚠ | Název |
|---|---|---|---|---|---|
| **C1** | Cross-device | **P0** | M–L | ⚠ (plná oprava; app-only mitigace bez ⚠) | Auto-load při reconnectu tiše maže názvy/ikony/tagy/labely |
| **C2** | Cross-device | **P0** | S | ⚠ (jen firmware přidává; app handler už existuje) | Přepnutí banky na zařízení je pro appku neviditelné |
| C3 | Cross-device | P1 | M | ⚠ | Send přes serial nemá potvrzení — „✓ sent" je fikce |
| S5 | Stavy & edge | P1 | S | — | Edity se neukládají do localStorage; refresh = ztráta práce |
| I4 | Interakce | P1 | S–M | — | Key-capture nejde zrušit; Esc se chytí jako klávesa |
| I5 | Interakce | P1 | S | — | Drag fader thumbu nastavuje falešné dirty |
| F1 | Firmware UX | P1 | S | — | Long-press bez makra spolkne bank switch |
| F2 | Firmware UX | P1 | S–M | — | PROD mód: disk viditelný + oboustranný zápis vs. dokumentace |
| C4 | Cross-device | P2 | S | — | Tiché selhání auto-loadu při reconnectu |
| C5 | Cross-device | P2 | M | ⚠ (závisí na C2) | Chybí indikace „tahle banka je živá na zařízení" |
| I6 | Interakce | P2 | S–M | — | Navigation mód nelze nakonfigurovat offline |
| I7 | Interakce | P2 | S | — | Stale názvy v hláškách („Track-nav", „Device Info") |
| S6 | Stavy & edge | P2 | S | — | Osiřelý Settings modal s neplatnými instrukcemi |
| S7 | Stavy & edge | P2 | M | ⚠ (live feedback keyswitch) | Prázdná Roller badge + žádná live vazba v keyswitch/nav módu |
| F3 | Firmware UX | P2 | S–M | — | Bank change snapshot skočí parametrem v DAW; boot je naopak tichý |
| F4 | Firmware UX | P2 | M | ⚠ (config hash v CMD_INFO) | Korupce NVM → tichý factory fallback |
| A7 | A11y & resp. | P2 | S | — | ks-handle 26 px chybí v touch-target passu |
| V8 | Vizuální jazyk | P3 | S | — | „= 12 not" místo „notes" při dragu keyswitch slideru |
| V9 | Vizuální jazyk | P3 | S | — | „Bank Bank 1" — zdvojené slovo ve validaci |
| V10 | Vizuální jazyk | P3 | S | — | Mrtvé footer odkazy + Cloudflare e-mail artefakt |
| V11 | Vizuální jazyk | P3 | S | — | `.settings-subhead` v `--t3` — obchází rozhodnutí A4 |
| V12 | Vizuální jazyk | P3 | S | — | Welcome copy „loads automatically" vs. nutný Start |
| I8 | Interakce | P3 | S–M | — | HID toggle přes nativní `confirm()` |
| S8 | Stavy & edge | P3 | S | — | Badge „Legato" při odpojení vypadá jako live stav |
| S9 | Stavy & edge | P3 | S | — | 8 bank → tab overflow bez scroll affordance |
| C6 | Cross-device | P3 | S | ⚠ | ACK na serial CMD_HID odchází přes MIDI, které nikdo nečte |

**Souhrn: 2× P0 · 6× P1 · 9× P2 · 9× P3** (+ code-hygiene níže).

---

## 4. Detaily nálezů

### Osa: Cross-device seamlessness

### [C1] — Auto-load při reconnectu tiše maže názvy/ikony/tagy/labely
- **Osa:** Cross-device seamlessness
- **Závažnost:** P0
- **Co:** Firmware neukládá `name`, `icon`, `tags` ani `fader.label` — `normalize_web_config` je zahazuje a `send_config_chunks`/serial `CMD_R` vrací jen interní formát. App při načtení ze zařízení celý `cfg` **nahradí** výstupem `normalizeFwConfig` (name → „Bank N", icon/tags/label prázdné) a hned volá `cfgSave()` — přepíše tedy i localStorage zálohu. Protože returning user s grantnutým portem projde `onDeviceConnected → !dirty → loadConfigFromDevice` **automaticky při každém startu session**, uživatel o pojmenování bank přijde tiše a opakovaně. Help & Guide přitom výslovně tvrdí: *„Names, icons and tags are saved both in this browser and on the device."*
- **Kde:** app `feel-fader.html`: `loadConfigFromDevice()` ř. 2726–2739 (`cfg = p; cfgSave()`), `normalizeFwConfig()` ř. 2504–2526 (name/icon/tags reset), `onDeviceConnected()` ř. 2772–2776 (tichý auto-load), Help text ř. 1164 · firmware `ff_config.py`: `normalize_web_config()` ř. 84–127 (pole nezná), `code.py`: `send_config_chunks()` ř. 284–297, serial `CMD_R` ř. 526.
- **Proč to vadí:** R11 (stav se tiše rozjede — hůř: tiše se zničí), R14 (ztráta práce bez cesty zpět). Přímý zásah do hlavní hodnoty „nulová mentální mezera mezi webem a zařízením". Navíc Help lže — nejhorší kombinace.
- **Doporučení:** Dvě úrovně. **(a) Mitigace bez protokolu (app-only):** při `normalizeFwConfig` mergovat prezentační pole (`name`, `icon`, `tags`, `label`) z dosavadního `cfg`/localStorage podle indexu banky — funkční data ze zařízení, prezentační z prohlížeče; opravit text v Help. **(b) Plná oprava (⚠ obě repa):** firmware persistuje a vrací i prezentační pole (`parse_banks`/`normalize_web_config`/`send_config_chunks` + NVM) — pak platí slib z Helpu i mezi počítači.
- **Náročnost:** (a) M · (b) L ⚠ změna formátu configu v OBOU repech
- **Zdroj:** kód

### [C2] — Přepnutí banky na zařízení je pro appku neviditelné
- **Osa:** Cross-device seamlessness
- **Závažnost:** P0
- **Co:** App má hotový handler: příchozí Program Change přepne `liveBank` i `activeBank` a překreslí UI. Firmware ale při bank cycle **žádný Program Change (ani nic jiného) neposílá** — `on_bank_changed()` pošle jen CC snapshoty. Důsledek: `liveBank` zůstane navždy 0; jakmile uživatel na zařízení přepne banku s jinými CC/kanály, příchozí data přestanou odpovídat `cfg.banks[liveBank]` a live thumby, hodnoty i articulation badge **zamrznou bez jakéhokoli vysvětlení**. UI navíc nesleduje HW banku, což byla celá pointa handleru.
- **Kde:** app `feel-fader.html`: `onMidiMsg()` ř. 2445–2454 (PC handler čeká marně), ř. 2423 (`cfg.banks[liveBank]` matching) · firmware `code.py`: `on_bank_changed()` ř. 470–478 (žádný PC), button release ř. 625–629.
- **Proč to vadí:** R11 (stav zařízení a appky se rozjedou při každém stisku tlačítka), R12 (akce na zařízení nemá v appce žádnou odezvu). Metoda B se na tento šev explicitně ptá — odpověď je „šev je díra".
- **Doporučení:** Firmware v `on_bank_changed()` odešle `ProgramChange(bank_index)` (kanál např. 0). App stranu netřeba měnit — handler existuje. Zvážit i chování `activeBank = pc` při rozeditované jiné bance (dnes by skočilo — po opravě C2 řešit: přepnout jen `liveBank` + zvýraznit, `activeBank` přepnout pouze pokud uživatel needituje).
- **Náročnost:** S (1–2 řádky ve firmware) ⚠ rozšíření drátového chování — jednostranně kompatibilní (app už poslouchá), přesto zdokumentovat v protokolové tabulce obou CLAUDE.md
- **Zdroj:** kód

### [C3] — Send přes serial nemá potvrzení — „✓ sent" je fikce
- **Osa:** Cross-device seamlessness
- **Závažnost:** P1
- **Co:** `doSend()` zapíše `CMD_W:{json}\n` do serial portu a **okamžitě** označí úspěch (toast, „✓ sent", `dirty=false`, `cfgSave`). Firmware na serial `CMD_W` nic neodpovídá a chyby tiše spolkne (`apply_web_config` → False se zahodí, výjimky `except: pass`). Když zařízení config odmítne nebo parsování selže, uživatel žije v přesvědčení, že je uloženo — dirty flag lže.
- **Kde:** app `feel-fader.html`: `doSend()` ř. 2790–2802 · firmware `code.py`: serial větev `CMD_W` ř. 538–541 (bez odpovědi), hlavní `try/except: pass` ř. 548–549. (SysEx cesta ACK/ERR má — `sysexWriteConfig` ř. 2614 — ale `doSend` ji nepoužívá.)
- **Proč to vadí:** R11 (dirty není pravdivý), R12 (odezva je fake, ne optimistická-s-korekcí), R14 (selhání nemá recovery cestu, protože o něm nikdo neví).
- **Doporučení:** Firmware na serial `CMD_W` odpoví `ACK\n` / `ERR:<důvod>\n`; app po zápisu čeká (timeout ~2 s) a teprve pak potvrdí; při timeoutu/ERR nechá dirty a ukáže chybu s tlačítkem „retry". Optimistický stav tlačítka může zůstat, ale musí umět couvnout.
- **Náročnost:** M ⚠ změna drátového protokolu (serial odpověď) — nutná změna OBOU rep
- **Zdroj:** kód

### [C4] — Tiché selhání auto-loadu při reconnectu
- **Osa:** Cross-device seamlessness
- **Závažnost:** P2
- **Co:** V auto-vstupní větvi `onDeviceConnected` je `try { await loadConfigFromDevice(); … } catch(e) {}` — když čtení selže (timeout, port drží DAW), appka **stejně** schová welcome a vpustí uživatele na hlavní stránku s lokálním configem, bez jediné hlášky. Uživatel předpokládá sync („vždyť to samo naskočilo").
- **Kde:** app `feel-fader.html`: `onDeviceConnected()` ř. 2774–2777.
- **Proč to vadí:** R11 (desync bez viditelnosti), R14 (žádná cesta k nápravě, protože chybí signál).
- **Doporučení:** Při selhání zobrazit nenásilný banner „Couldn't sync with device — showing local config" s akcí „Retry sync"; header dot nechat v „searching" stavu, ne v „connected".
- **Náročnost:** S
- **Zdroj:** kód

### [C5] — Chybí indikace „tahle banka je živá na zařízení"
- **Osa:** Cross-device seamlessness
- **Závažnost:** P2
- **Co:** Zařízení nemá displej — jediné místo, kde jde vidět aktivní HW banku, je appka. `renderBankTabs()` ale zvýrazňuje jen `activeBank` (UI výběr); `liveBank` se nikde nezobrazuje. Ani po opravě C2 nebude rozdíl „koukám na banku 3, ale zařízení hraje banku 1" nikde vidět. Taby navíc nenesou pozici (1., 2., …), takže mentální mapování „N stisků tlačítka → moje banka" u pojmenovaných bank nefunguje ([shot 21]: pořadí „Spitfire BBC…, Bank 2, Bank 3, Bank 1, Bank 4…").
- **Kde:** app `feel-fader.html`: `renderBankTabs()` ř. 1445–1455 (jen `activeBank`), `liveBank` ř. 1412/2448.
- **Proč to vadí:** R11 (kontinuita), C-sekce metody (kompenzace hardwarového limitu — zařízení nemá zpětnou vazbu o bance).
- **Doporučení:** (1) Malý index `1–8` v každém tabu (pořadí = pořadí cyklení). (2) Po C2: zelená tečka/podtržení na tabu `liveBank`, odlišené od `activeBank` výběru; klik na ni = skok na živou banku.
- **Náročnost:** M (vizuální část S; závislost na C2 pro live data) ⚠ nepřímo (potřebuje C2)
- **Zdroj:** kód + render (shot 21)

### [C6] — ACK na serial CMD_HID odchází přes MIDI, které nikdo nečte
- **Osa:** Cross-device seamlessness
- **Závažnost:** P3
- **Co:** `apply_hid_request()` potvrzuje `send_ack()`/`send_err()` — ty píší do **USB MIDI** portu. Požadavek ale přichází po **serialu** a app žádný SysEx ACK nečeká; místo toho spí 200 ms a re-fetchne info. Funguje to, ale potvrzovací kanál je zapojený do zdi.
- **Kde:** firmware `code.py`: `apply_hid_request()` ř. 311–320, serial `CMD_HID` ř. 542–547 · app `feel-fader.html`: `sendHidRequest()` ř. 1836–1856.
- **Proč to vadí:** R11/R12 — křehké; když firmware zpracování zpomalí, 200ms okno mine a UI ukáže starý stav (fallback toast to přizná, ale je to loterie).
- **Doporučení:** Serial `CMD_HID` → serial odpověď `ACK\n`/`ERR\n` (sjednotit s C3); app čeká na odpověď místo fixního sleep.
- **Náročnost:** S ⚠ protokol (spolu s C3)
- **Zdroj:** kód

---

### Osa: Interakce & flow

### [I4] — Key-capture nejde zrušit; Esc se chytí jako klávesa
- **Osa:** Interakce & flow
- **Závažnost:** P1
- **Co:** Po kliknutí na capture tlačítko (ROLL UP/DOWN, macro) je jediná cesta ven stisknout mapovanou klávesu. **Esc je v `HID_CODES`**, takže instinktivní „zrušit" přiřadí Escape jako navigační klávesu (ověřeno renderem: `nav_keys_cw = [41]`, [shot 13]). Nenamapovaná klávesa (média, F13+) tiše nic neudělá a stav „press a key…" visí donekonečna ([shot 12]); klik jinam capture nezruší a handler mezitím hltá všechny klávesy v celém okně (`preventDefault`), takže „rozbité psaní" vypadá jako bug appky.
- **Kde:** app `feel-fader.html`: `startKeyCapture()`/`startMacroCapture()` ř. 1915–1925, globální `keydown` ř. 1926–1947, `HID_CODES.Escape` ř. 1355.
- **Proč to vadí:** R8 (stav bez návrhu), R14 (žádná cesta ven), R6 (preciznost — capture je přesně to místo, kde power-user pozná kvalitu).
- **Doporučení:** Esc = zrušit capture (vrátit původní label); klik mimo / blur = zrušit; nenamapovaná klávesa = krátký shake + hint „unsupported key"; Esc jako hodnotu umožnit přes explicitní volbu (např. dlouhý stisk nebo malé „assign Esc" tlačítko). Capture stav vizuálně odlišit (pulzující border), ne jen textem.
- **Náročnost:** S–M
- **Zdroj:** render (shots 12, 13) + kód

### [I5] — Drag fader thumbu nastavuje falešné dirty
- **Osa:** Interakce & flow
- **Závažnost:** P1
- **Co:** Tažení thumbu na fotce zařízení nemění config ani neposílá MIDI (`mF()` jen přepíše `liveValues` a UI) — přesto nastaví `dirty=true`. Uživatel si „jen sáhne" na fader a dostane „Unsaved changes — send to device". Horší řetězový efekt: `onDeviceConnected` při `dirty` **přeskočí tichý auto-load**, takže nevinný drag změní chování příštího reconnectu.
- **Kde:** app `feel-fader.html`: `mF()` ř. 2313–2319 (`dirty=true`), guard ř. 2774. (Pozn.: WEBAPP.md tvrdí, že drag odesílá CC — kód to nedělá; buď obnovit odesílání jako „test mode", nebo přiznat, že jde o čistou vizualizaci.)
- **Proč to vadí:** R11 (dirty musí být pravdivý — tady lže opačným směrem než C3).
- **Doporučení:** Odstranit `dirty=true` z `mF()`. Následně rozhodnout, co drag znamená: (a) nic → thumby jen zobrazují live stav (pak zvážit `pointer-events:none`), nebo (b) test-send CC do DAW přes MIDI out (užitečnější).
- **Náročnost:** S
- **Zdroj:** kód

### [I6] — Navigation mód nelze nakonfigurovat offline
- **Osa:** Interakce & flow
- **Závažnost:** P2
- **Co:** Tlačítko „Navigation (keys)" je `disabled`, dokud `DEVICE_INFO.hid_enabled` není true — tedy **vždy bez připojeného zařízení**. Uživatel, který si chce doma připravit config (nebo po C1 kdokoli v druhém prohlížeči), mód ani neotevře a nevidí jeho nastavení. Vysvětlení je jen v `title` tooltipu — na touch zařízení neexistuje.
- **Kde:** app `feel-fader.html`: `encoderPanel()` ř. 1757–1763 (`disabled` + `title`), `setRollerMode()` ř. 1902–1905.
- **Proč to vadí:** R13 (progressive disclosure ≠ zamčené dveře — konfiguraci a runtime gating je třeba oddělit), R9 (tooltip-only vysvětlení).
- **Doporučení:** Mód dovolit zvolit a konfigurovat vždy; HID gate ukázat jako inline stav uvnitř panelu („Navigation needs Keyboard (HID) — enable in Device & Settings" + přímý link/tlačítko). Firmware stejně track_nav bez HID tiše ignoruje, takže to nic nerozbije.
- **Náročnost:** S–M
- **Zdroj:** render (shot 04 — disabled stav) + kód

### [I7] — Stale názvy v hláškách („Track-nav", „Device Info")
- **Osa:** Interakce & flow
- **Závažnost:** P2
- **Co:** UX pass 7. bodem přejmenoval mód na „Navigation (keys)" a panel na „Device & Settings" — ale toasty a tooltipy vedou uživatele na stará jména: „Track-nav requires HID enabled (Device Info → Keyboard)" ([shot 11] — zachyceno živě), „Macro requires HID enabled (Device Info → Keyboard)", tooltip na disabled tlačítku „Requires HID enabled (Device Info → Keyboard)". Uživatel hledá panel „Device Info", který neexistuje.
- **Kde:** app `feel-fader.html`: ř. 1904 (`setRollerMode` toast), ř. 1921 (`startMacroCapture` toast), ř. 1759 (title).
- **Proč to vadí:** R6/R8 — navigační instrukce ukazuje do prázdna; přesně ten moment „tápání", který audit hledá.
- **Doporučení:** Sjednotit na „Navigation requires Keyboard (HID) — enable it in Device & Settings"; ideálně toast s klikací akcí, která panel rozbalí a scrollne na HID řádek.
- **Náročnost:** S
- **Zdroj:** render (shot 11) + kód

### [I8] — HID toggle přes nativní `confirm()`
- **Osa:** Interakce & flow
- **Závažnost:** P3
- **Co:** Zapnutí HID otevře systémový `confirm()` dialog s víceřádkovým textem (macOS Keyboard Setup Assistant, focus). Funkčně správná prevence, ale nativní dialog v jinak plně customizovaném UI působí jako cizí těleso a nejde stylovat.
- **Kde:** app `feel-fader.html`: `onHidToggle()` ř. 1828–1835.
- **Proč to vadí:** R5/R6 (deference, preciznost) — jediné místo v appce s nativním dialogem.
- **Doporučení:** Lehký in-app potvrzovací popover u toggle řádku (stejná slova, tlačítka Enable/Cancel), vzor overlay už existuje (modal/icon-picker).
- **Náročnost:** S–M
- **Zdroj:** kód

---

### Osa: Stavy & edge cases

### [S5] — Edity se neukládají do localStorage; refresh = ztráta práce
- **Osa:** Stavy & edge cases
- **Závažnost:** P1
- **Co:** `cfgSave()` se volá pouze v `doSend`, `loadConfigFromDevice` a `onImport`. Všechny běžné editace (CC/kanály, názvy, tagy, ikony, roller mode, keyswitch range, macro capture, add/remove bank…) žijí **jen v paměti**. F5, zavření taby nebo pád prohlížeče zahodí vše od posledního send — a `beforeunload` guard neexistuje. WEBAPP.md tvrdí „ukládá se do localStorage po každé změně" — už neplatí.
- **Kde:** app `feel-fader.html`: `cfgSave()` volání ř. 2734, 2795, 2827 (nic jiného); mutační funkce ř. 1886–2230 bez persistence; `beforeunload` — 0 výskytů.
- **Proč to vadí:** R14 (obnovitelnost) — nejobyčejnější nehoda (refresh) ničí práci. Dvojnásob nebezpečné v kombinaci s C1 (localStorage je dnes jediné místo, kde názvy přežívají).
- **Doporučení:** Volat `cfgSave()` v každé mutaci (nejjednodušeji: debounced volání v `render()`/`runValidation()` když `dirty`); `dirty` pak reprezentuje jen rozdíl vůči **zařízení**, ne vůči disku. Doplnit `beforeunload` varování při `dirty` jako druhou síť.
- **Náročnost:** S
- **Zdroj:** kód

### [S6] — Osiřelý Settings modal s neplatnými instrukcemi
- **Osa:** Stavy & edge cases
- **Závažnost:** P2
- **Co:** `openModal()` nemá žádného volajícího (gear z headeru zmizel) — modal je dosažitelný jen z konzole. Jeho obsah je navíc trojnásobně zastaralý: „Number of banks (1–10)" a `max="10"` vs. `MAX_BANKS = 8`; „Switch mode by editing boot.py on the device" vs. skutečné držení tlačítka při připojení USB; „Current mode" se nikdy nenaplní (firmware `build_info_dict` pole `mode` neposílá). [shot 26]
- **Kde:** app `feel-fader.html`: modal ř. 1213–1240 (ř. 1219/1222 „1–10", ř. 1233 boot.py text), `openModal()` ř. 2880 bez callera · firmware `ff_config.py`: `build_info_dict()` ř. 178–188 (bez `mode`) · `boot.py` ř. 27–32 (DEV = držení GP22).
- **Proč to vadí:** R8 (mrtvé UI s nepravdivým návodem je časovaná past — až ho někdo znovu zapojí), R1 (redukce).
- **Doporučení:** Rozhodnout: buď modal smazat (počet bank řeší +/✕ v tabech, DEV/PROD info patří do Help & Guide s korektním postupem „hold the button while plugging USB"), nebo ho zapojit a opravit obsah. Nenechávat třetí stav.
- **Náročnost:** S
- **Zdroj:** render (shot 26) + kód

### [S7] — Prázdná Roller badge + žádná live vazba v keyswitch/nav módu
- **Osa:** Stavy & edge cases
- **Závažnost:** P2
- **Co:** Mode-aware badge (bod 6 UX passu) byla implementována jako „nic" — `badge=''` vyrenderuje prázdnou `section-live-val` pilulku (drobný šedý artefakt vpravo v hlavičce Roller, [shoty 06/11]). Hlavně ale v keyswitch módu app **neposlouchá NoteOn**, takže na webu není vidět, na kterém keyswitchi roller aktuálně stojí — v CC módu live vazba existuje (badge z příchozího CC), v keyswitch módu úplně chybí.
- **Kde:** app `feel-fader.html`: `encoderPanel()` ř. 1745 (`badge=''`), `onMidiMsg()` ř. 2425–2443 (jen CC, žádný NoteOn handler) · firmware `code.py` ř. 561–575 (keyswitch posílá NoteOn/NoteOff).
- **Proč to vadí:** R8 (prázdný element místo navrženého stavu), R11/R12 (live feedback existuje jen pro jeden ze tří módů).
- **Doporučení:** (1) Badge při prázdném obsahu nerenderovat (podmíněně vynechat span). (2) V keyswitch módu poslouchat NoteOn na `ks_channel` a zvýraznit odpovídající notu v gridu + ukázat `noteName` v badge. Nav mód: badge schovat úplně (klávesy nemají „stav").
- **Náročnost:** M (badge fix S; NoteOn listener M) ⚠ ne — NoteOn už firmware posílá, jen ho app číst
- **Zdroj:** render (shots 06, 11) + kód

### [S8] — Badge „Legato" při odpojení vypadá jako live stav
- **Osa:** Stavy & edge cases
- **Závažnost:** P3
- **Co:** V CC módu badge zobrazuje `uaccName(bankUacc[0])` — staticky první položku seznamu — i bez zařízení ([shot 04]). Vypadá to jako „zařízení je na Legato", ale je to jen default. Podobně live hodnoty „64" u faderů bez zařízení.
- **Kde:** app `feel-fader.html`: `encoderPanel()` ř. 1741–1745; `liveValues` default ř. 1413.
- **Proč to vadí:** R8 — nenavržený rozdíl mezi „live" a „placeholder" stavem.
- **Doporučení:** Bez připojení tlumit (opacity/`—`) live prvky, nebo prefixovat („starts at Legato"). Po připojení plná sytost.
- **Náročnost:** S
- **Zdroj:** render (shot 04) + kód

### [S9] — 8 bank → tab overflow bez scroll affordance
- **Osa:** Stavy & edge cases
- **Závažnost:** P3
- **Co:** Při 8 bankách se poslední taby uříznou hranou karty („Ban…") a nic nenaznačuje, že řada scrolluje ([shot 21], 1280 px). Ellipsis dlouhých názvů (S2) funguje.
- **Kde:** app `feel-fader.html`: `.bank-block-tabs` (overflow-x bez fade/šipek), `renderBankTabs()` ř. 1445.
- **Proč to vadí:** R8/R10.
- **Doporučení:** Gradient fade na pravé hraně při přetečení (CSS mask / `::after`), volitelně auto-scroll na aktivní tab po `selectBank`.
- **Náročnost:** S
- **Zdroj:** render (shot 21)

---

### Osa: Firmware UX

### [F1] — Long-press bez makra spolkne bank switch
- **Osa:** Firmware UX
- **Závažnost:** P1
- **Co:** Stavový automat tlačítka nastaví `button_long_fired = True` po 500 ms **vždy** — i když `button_macro` je prázdné nebo HID vypnuté. Release pak bank switch přeskočí. Uživatel, který podrží tlačítko o chlup déle (500 ms je málo — nervózní / rukavice / přemýšlí), nedostane **nic**: žádné makro, žádné přepnutí banky, žádný signál. Vzhledem k tomu, že makro je opt-in featura, je defaultní chování zařízení „dlouhý stisk = mrtvá zóna".
- **Kde:** firmware `code.py`: ř. 614–624 (`button_long_fired = True` před kontrolou `hid_enabled and _kbd and button_macro`), ř. 625–629 (release guard).
- **Proč to vadí:** R12 (akce bez odezvy), R8. První dojem z hardwaru se láme na tlačítku, které „občas nefunguje".
- **Doporučení:** `button_long_fired` nastavovat jen pokud makro reálně existuje a HID je aktivní (`if hid_enabled and _kbd and button_macro: fire; else: nechat short-press logiku`). Tím dlouhý stisk bez makra degraduje na bank switch při release — vždy se něco stane.
- **Náročnost:** S
- **Zdroj:** kód

### [F2] — PROD mód: disk viditelný + oboustranný zápis vs. dokumentace
- **Osa:** Firmware UX
- **Závažnost:** P1
- **Co:** `boot.py` volá `storage.enable_usb_drive()` v **obou** větvích — v PROD navíc `remount("/", readonly=False, disable_concurrent_write_protection=True)`. Důsledky: (1) koncovému uživateli v PROD vyskočí USB disk FEELFADER, ačkoli Settings modal, firmware CLAUDE.md i komentáře tvrdí „drive hidden"; (2) vypnutá ochrana proti souběžnému zápisu znamená, že PC i firmware smí zapisovat na stejný FAT současně — dokumentovaný recept na korupci filesystému (firmware zapisuje `presets.json` při každém sendu configu).
- **Kde:** firmware `boot.py`: ř. 60–66 · app `feel-fader.html`: modal text ř. 1233 („PROD mode: USB MIDI only, drive hidden") · firmware `CLAUDE.md` ř. 21–22.
- **Proč to vadí:** R8 (výrazně jiné chování, než produkt deklaruje), bezpečnost dat uživatele. Vyskočivší disk u „hotového" MIDI kontroléru působí jako debug artefakt.
- **Doporučení:** Rozhodnout cílový stav: PROD = `storage.disable_usb_drive()` (skutečně skrytý disk; NVM je primární persistence, soubor je stejně jen „bonus") — a sladit dokumentaci. Pokud má disk zůstat viditelný (např. kvůli README pro zákazníka), pak host read-only **bez** vypnuté write-protekce a opravit texty. Ověřit na HW (chování remount/enable kombinace se liší podle verze CircuitPythonu).
- **Náročnost:** S–M (změna malá, ale vyžaduje HW test)
- **Zdroj:** kód

### [F3] — Bank change snapshot skočí parametrem v DAW; boot je naopak tichý
- **Osa:** Firmware UX
- **Závažnost:** P2
- **Co:** Při přepnutí banky firmware okamžitě odešle aktuální **fyzickou** pozici obou faderů na CC/kanály nové banky (`SEND_FADER_SNAPSHOT_ON_BANK_CHANGE = True` → `snapshot()`), plus encoder snapshot v CC módu. Fyzická pozice ale nemá žádný vztah k poslední hodnotě, kterou nová banka v DAW nastavila — expression/vibrato/dynamics skočí bez doteku uživatele. Boot přitom volí opačnou filozofii (`SEND_INITIAL_*_ON_BOOT = False` + arming s `ARM_DELTA`): „nic neposílej, dokud se uživatel nedotkne". Nekonzistence = nepředvídatelnost; a přepínač existuje jen jako konstanta v kódu, ne v konfiguraci.
- **Kde:** firmware `code.py`: ř. 28–31 (settings), `on_bank_changed()` ř. 470–478, `Fader.snapshot()` ř. 445–446, arming ř. 393–401.
- **Proč to vadí:** R8/R12 — „každá akce má srozumitelnou odezvu" nesmí znamenat „nevyžádaný skok parametru". Pro orchestrální workflow (expression rides!) je nechtěný skok slyšitelná chyba v nahrávce.
- **Doporučení:** Default změnit na boot chování: po bank change re-arm bez snapshotu (faders pošlou až po ARM_DELTA pohybu). Snapshot nabídnout jako volbu v appce („Send fader position on bank switch: on/off" per config) — vyžaduje přidat pole do configu ⚠. Minimálně: sjednotit obě chování a zdokumentovat v Help.
- **Náročnost:** S (změna defaultu) / M (konfigurovatelnost ⚠ formát configu)
- **Zdroj:** kód

### [F4] — Korupce NVM → tichý factory fallback
- **Osa:** Firmware UX
- **Závažnost:** P2
- **Co:** `load_presets()` při jakékoli chybě (poškozený JSON v NVM, chybějící soubor) spadne tiše až na `DEFAULT_PRESETS`. Zařízení se po korupci probudí „z fabriky" — jiné CC, jiné kanály — a nikomu to neřekne: CMD_INFO nenese verzi/hash configu, app nemá jak poznat, že zařízení drží něco jiného, než co mu poslala. Uživatel to zjistí až tím, že mu fader hýbe špatným parametrem. (Footer HID flagu CRC má — presety ne.)
- **Kde:** firmware `code.py`: `load_presets()` ř. 135–149, `_nvm_load()` ř. 102–113 (marker+délka, bez CRC) · `ff_config.py`: `build_info_dict()` ř. 178–188 (bez config hash).
- **Proč to vadí:** R11 (tichý rozjezd stavů), R14 (chybový stav bez signálu).
- **Doporučení:** (1) CRC8 nad NVM preset blokem (vzor ve footeru existuje). (2) Do CMD_INFO přidat `config_hash` (např. CRC32 JSON) ⚠ — app porovná s hashem svého posledního sendu a při rozdílu nabídne „device config differs — Load / Overwrite". Řeší i obecnou otázku „je dirty pravdivý?" z metody B.
- **Náročnost:** M ⚠ rozšíření CMD_INFO (obě repa)
- **Zdroj:** kód

---

### Osa: Vizuální jazyk

### [V8] — „= 12 not" místo „notes" při dragu keyswitch slideru
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Statický render píše `= ${n} notes`, ale live refresh během tažení handle přepíše text na `'= ' + n.length + ' not'` — anglickému uživateli se počítadlo mění na „12 not".
- **Kde:** app `feel-fader.html`: `ksLiveRefresh()` ř. 2184 vs. `keyswitchBody()` ř. 1719.
- **Proč to vadí:** R6 (preciznost) — viditelné přesně v momentě interakce.
- **Doporučení:** Sjednotit na `' notes'`.
- **Náročnost:** S
- **Zdroj:** kód

### [V9] — „Bank Bank 1" — zdvojené slovo ve validaci
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Validace keyswitch módu skládá `Bank ${b.name}` — a `b.name` je „Bank 1" → vbar hlásí „⚠ Bank Bank 1: keyswitch mode needs at least one note" ([shot 09]).
- **Kde:** app `feel-fader.html`: `validate()` ř. 2246 (i ř. 2248).
- **Proč to vadí:** R6.
- **Doporučení:** `` `${b.name || 'Bank '+(i+1)}: …` `` (bez prefixu), sjednotit se vzorem `validate.cc_range`, který používá uvozovky.
- **Náročnost:** S
- **Zdroj:** render (shot 09) + kód

### [V10] — Mrtvé footer odkazy + Cloudflare e-mail artefakt
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Privacy Policy, Terms of Use a čtyři sociální ikony vedou na `href="#"`; support e-mail je zakódovaný Cloudflare email-protection (`/cdn-cgi/l/email-protection` + `data-cfemail`) — mimo Cloudflare hosting (lokální soubor, GitHub Pages snapshot) je odkaz rozbitý a zobrazí „[email protected]" (applyLang to zamaskuje textem, ale href zůstává mrtvý).
- **Kde:** app `feel-fader.html`: ř. 1183–1198.
- **Proč to vadí:** R8 — mrtvé odkazy v patičce „hotového" produktu; kliknutí na support v demu nikam nevede.
- **Doporučení:** Buď reálné URL, nebo odkazy do doby existence obsahu odstranit; e-mail jako prostý `mailto:`.
- **Náročnost:** S
- **Zdroj:** kód + render

### [V11] — `.settings-subhead` v `--t3` — obchází rozhodnutí A4
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** A4 fix (27. 6.) promotoval informační popisky na `--t2`, `--t3` zůstal jen pro dekoraci. Nové komponenty Device & Settings a Help & Guide zavedly `.settings-subhead` (DEVICE, PRESET & DATA, Getting started…) v `--t3` — strukturální navigační text pod AA kontrastem.
- **Kde:** app `feel-fader.html`: CSS ř. 432; použití ř. 1090, 1113, 1161–1169.
- **Proč to vadí:** R9 (kontrast ≥4.5:1), eroze čerstvě zavedeného pravidla.
- **Doporučení:** `.settings-subhead{color:var(--t2)}` (vzor: section eyebrows z A4).
- **Náročnost:** S
- **Zdroj:** kód

### [V12] — Welcome copy „loads automatically" vs. nutný Start
- **Osa:** Vizuální jazyk
- **Závažnost:** P3
- **Co:** Podtitulek „Plug in via USB-C — configuration loads automatically." platí až pro druhé a další použití; poprvé musí uživatel kliknout Start a potvrdit picker. Drobný rozpor v nejcitlivější minutě.
- **Kde:** app `feel-fader.html`: ř. 1271; logika `onDeviceConnected()` ř. 2766–2783.
- **Proč to vadí:** R8 — text neodpovídá prvnímu reálnému průchodu.
- **Doporučení:** Kontextová copy: před grantem „Plug in via USB-C, then press Start."; s grantnutým portem stávající text.
- **Náročnost:** S
- **Zdroj:** render (shot 02) + kód

---

### Osa: A11y & responzivita

### [A7] — ks-handle 26 px chybí v touch-target passu
- **Osa:** A11y & responzivita
- **Závažnost:** P2
- **Co:** A3 fix zavedl `@media(pointer:coarse)` blok se zvětšením cílů ≥44 px — keyswitch slider vznikl později a jeho handle (26×26 px) v bloku chybí. Na dotyku je to nejjemnější interakce v appce (drag hranice range) s podlimitním cílem. Capture tlačítka (`navcap-*`, `macro-capture`) mají výšku ~30 px a v coarse bloku také nejsou.
- **Kde:** app `feel-fader.html`: `.ks-handle` CSS ř. 202 vs. `@media(pointer:coarse)` ř. 548–555; `#macro-capture` ř. 1105, `navcap` ř. 1782–1788.
- **Proč to vadí:** R9 (≥44 px touch), regrese vůči vlastnímu A3 rozhodnutí u nových komponent.
- **Doporučení:** Do coarse bloku přidat `.ks-handle{width:44px;height:44px;margin-left:-22px}` (nebo neviditelný hit-area padding) a `min-height:44px` pro capture tlačítka.
- **Náročnost:** S
- **Zdroj:** kód

---

## 5. Code-hygiene (mimo UX rubriku, na vyžádání)

| ID | Co | Kde |
|---|---|---|
| H5 | `document.getElementById('midi-text')` neexistuje → latentní TypeError v error větvi SysEx `CMD_W` (cesta dnes mrtvá — device CMD_W neposílá) | app ř. 2548 |
| H6 | Mrtvé přenosové cesty: `sendSysEx()` (ř. 2492) a `sysexWriteConfig()` (ř. 2614) nemají volajícího — `doSend` jede jen po serialu; SysEx ACK/ERR handling (ř. 2586–2595) je tím pádem také mrtvý | app |
| H7 | `WEBAPP.md` neodpovídá kódu v zásadních bodech (localStorage „po každé změně", drag „odesílá CC", „Serial = backup transport" — realita je opačná: serial je primární pro load/send) — po tomto auditu aktualizovat | app repo |
| H8 | `renderBankIndicator` window-export na neexistující funkci (ř. 3393), `json-sec` prázdný div (ř. 1149), `hidLabel` fallback `0x..` unese neznámé kódy z importu — drobnosti | app |
| H9 | Firmware `README.txt` tvrdí „Serial Number: 250001" a CircuitPython 10.0.3/Pico 2 — ověřit soulad s reálnou sérií (CMD_INFO posílá CPU UID) | firmware |

---

## 6. Quick wins (vysoký dopad / náročnost S)

1. **C2** — 1–2 řádky ve firmware (`ProgramChange` v `on_bank_changed`): odemkne celý existující app handler, P0 pryč. *(⚠ zapsat do protokolové tabulky.)*
2. **S5** — debounced `cfgSave()` při každé mutaci + `beforeunload` při dirty: konec ztrát práce refreshем.
3. **I5** — smazat `dirty=true` z `mF()`: konec falešného dirty a blokování auto-loadu.
4. **F1** — podmínit `button_long_fired` existencí makra: tlačítko na zařízení vždy něco udělá.
5. **I7 + V8 + V9** — textové opravy (stale názvy panelů, „not", „Bank Bank").
6. **A7** — doplnit ks-handle a capture tlačítka do `pointer:coarse` bloku.
7. **S6** — smazat osiřelý Settings modal (nebo aspoň jeho lživé texty).
8. **C4** — banner „Couldn't sync — Retry" místo `catch(e){}`.
9. **S7a** — nerenderovat prázdnou badge pilulku.

---

## 7. Návrh 3 vln implementace

### Vlna 1 — Quick wins + P0/P1 bez změny protokolu
**Obsah:** C2 (firmware PC), S5, I5, F1, I4 (capture cancel), I7, C4, S6, A7, V8, V9, V11, S7a, F2 (rozhodnutí + boot.py), H5.
**Rozsah:** ~1–2 dny práce; převážně app (jednosouborové změny), firmware 3 malé zásahy (C2, F1, F2).
**Riziko:** nízké. C2 je jednostranně kompatibilní (app handler existuje); F2 vyžaduje HW test boot chování; I4 potřebuje krátký návrh interakce (Esc/blur sémantika).
**Efekt:** oba P0 fakticky umrtveny (C2 zcela; C1 přestane bolet po S5+mitigaci ve Vlně 2), tlačítko zařízení přestane mít mrtvou zónu, práce se přestane ztrácet.

### Vlna 2 — Cross-device seamlessness (protokolové změny ⚠, obě repa v lockstepu změny protokolu — repa zůstávají oddělená)
**Obsah:** C1 (nejdřív app-only merge prezentačních polí; poté plná persistence name/icon/tags/labels ve firmware formátu), C3 + C6 (serial ACK/ERR pro CMD_W a CMD_HID), F4 (CRC nad NVM presety + `config_hash` v CMD_INFO → pravdivý dirty), C5 (live-bank indikace v tabech + pozice 1–8), S7b (NoteOn listener pro keyswitch live feedback).
**Rozsah:** ~3–5 dní vč. HW testů round-tripu; každá protokolová změna se navrhne v protokolové tabulce obou CLAUDE.md předem.
**Riziko:** střední — dotýká se `enc7/dec7` payloadů ne, ale formátu configu a serial rámců ano; nutný integrační test app↔firmware na fyzickém zařízení (postup v firmware CLAUDE.md). Zpětná kompatibilita: starý firmware + nová app musí degradovat na dnešní chování.
**Efekt:** sync přestane být slepý — appka vidí banku, potvrzený zápis i rozjetý config; slib z Help & Guide začne platit.

### Vlna 3 — Koncepční návrhy
**Obsah:**
- **Stavový model připojení** — jeden zdroj pravdy pro `disconnected / connected-unsynced / synced / dirty / sending / error` a z něj odvozený header, banner, send button i dirty hint (dnes 4 nezávislé mechanismy: setBanner, updateStatus, reflectDirty, btn stavy).
- **F3** — „send on bank switch" jako uživatelská volba v appce (⚠ nové pole configu), default tichý re-arm.
- **I6** — oddělit konfiguraci od runtime gatingu (Navigation editovatelný offline, inline HID výzva s akcí).
- **I8** — in-app potvrzení HID; **S8** — návrh „placeholder vs. live" vizuálního rozlišení; **S9** — tab overflow fade; **V12** — kontextová welcome copy.
- **Onboarding pro power featury** — Help & Guide rozšířit o DEV/PROD (korektní button-hold postup, převzít ze smazaného modalu) a o macro/keyswitch mini-návody; zvážit kontextové „?" odkazy z panelů do příslušné Help sekce (discoverability Helpu, když uživatel tápe přímo u komponenty).
- **V10 / legal** — reálné odkazy nebo redukce patičky.
**Rozsah:** ~1 týden, převážně app; žádná závislost na Vlně 2 kromě stavového modelu (těží z config_hash).
**Riziko:** nízké technicky, střední designově (stavový model chce krátký design doc stejným procesem jako UX pass 2026-07-01).
**Efekt:** poslední vrstva „Apple pocitu" — produkt nejen funguje synchronně, ale je vždy jasné, v jakém stavu je a co bude následovat.

---

*Audit proveden bez zásahů do kódu obou rep. O implementaci rozhodne triáž nad tímto reportem.*
