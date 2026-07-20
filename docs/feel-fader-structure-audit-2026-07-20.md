# Feel Fader — Strukturní audit (app + firmware): 2026-07-20

> Diagnostický, read-only audit. Doplňuje předchozí UX/product audity
> (`feel-fader-ux-audit-2026-06-27.md`, `feel-fader-product-audit-2026-07-03.md`),
> které řešily zážitek/vizuál. Tento audit řeší strukturu a technický stav.
> Žádné zásahy do kódu — o dalších krocích rozhoduje majitel.
>
> Metoda: 3 paralelní diagnostičtí subagenti (Architektura+Dead code,
> Protokol konzistence+Bezpečnost, Doc-vs-kód drift) + přímý výzkum
> (Repo hygiena, Test coverage). Viz `docs/superpowers/specs/2026-07-20-structure-audit-design.md`
> a `docs/superpowers/plans/2026-07-20-structure-audit.md`.

## Executive summary

1. **Dokumentace soustavně zaostává za rychlostí vývoje — a na dvou místech je to nebezpečné, ne jen zastaralé.** `WEBAPP.md` si sám odporuje (§1 tvrdí SysEx transport configu, §5 správně říká Serial-only) a `feel-fader-firmware/CLAUDE.md` instruuje čtenáře, ať v appce zkontroluje funkce (`sysexReadConfig`/`sysexWriteConfig`), které byly odstraněny přesně kvůli HW nálezu z 2026-07-07 (SysEx zápis zasekává MIDI endpoint). Agent, který by dokumentaci uvěřil, riskuje reintrodukci už jednou vyřešeného hardwarového problému (DOC-001, DOC-002).
2. **Appka nemá žádnou skutečnou bezpečnostní hranici mezi „data zvenčí" a „co jde do DOM/configu".** Tři nálezy tvoří jeden řetězec: config hodnoty z JSON importu, custom presetů i (teoreticky) SysEx tečou nesanitizované do `innerHTML` (SEC-001, XSS, P0); `validate()` propustí `NaN`/non-numeric hodnoty beze zjištění (SEC-002); a MIDI-port „identifikace" zařízení je substring match bez autentizace, takže libovolný lokální proces se správně pojmenovaným virtuálním portem může appku donutit aplikovat cizí config (SEC-003, P0).
3. **Primární config-transport ve firmwaru je nejhůř strukturovaná část kódu.** Serial dispatch (dnes jediná produkční cesta configu) žije rozlitý přímo v hlavní `while True:` smyčce (~150 řádků, 5 nesouvisejících odpovědností), zatímco vedlejší SysEx cesta má vlastní čistou `handle_sysex()` funkci — přesně obráceně, než by risk profil čekal (A-4).
4. **Appka má nulové automatizované testy** a spoléhá na ad-hoc probe skripty bez jednotného runneru. To je přímá příčina, proč SEC-002 (chyba ve `validate()`) nikdy nebyl odhalen (TC-1, TC-4).
5. **Mrtvý kód se hromadí kolem odstraněných featur rychleji, než se uklízí.** Celý JSON inspector byl podle vlastní dokumentace „odstraněn", ale zanechal 3 funkce, 12 podmíněných volání a osiřelé HTML uzly (D-3); 61 CSS tříd (~16 % stylesheetu) nemá jediný výskyt mimo `<style>`, včetně celé `.m-*` modal komponenty, kterou `WEBAPP.md` pořád popisuje jako existující (D-4).

**4 nálezy P0** (2× bezpečnost, 2× dokumentace s rizikem HW regrese) — doporučeno vyřešit přednostně, mimo pořadí vln níže.

## Tabulka nálezů

| ID | Osa | Závažnost | Náročnost | Protokol ⚠️ |
|---|---|---|---|---|
| DOC-001 | Doc-vs-kód drift | P0 | S | ⚠️ |
| DOC-002 | Doc-vs-kód drift | P0 | S | ⚠️ |
| SEC-001 | Bezpečnost | P0 | M | |
| SEC-003 | Bezpečnost | P0 | M | ⚠️ |
| A-4 | Architektura | P1 | L | |
| A-5 | Architektura | P1 | M | |
| PR-001 | Protokol konzistence | P1 | M | ⚠️ |
| PR-003 | Protokol konzistence | P1 | S | ⚠️ |
| DOC-003 | Doc-vs-kód drift | P1 | M | |
| DOC-004 | Doc-vs-kód drift | P1 | M | |
| DOC-005 | Doc-vs-kód drift | P1 | S | ⚠️ |
| D-3 | Dead code | P1 | M | |
| TC-1 | Test coverage | P1 | M | |
| TC-3 | Test coverage | P1 | M | |
| TC-4 | Test coverage | P1 | M | |
| SEC-002 | Bezpečnost | P1 | S | |
| A-1 | Architektura | P2 | M | |
| A-2 | Architektura | P2 | M | |
| A-3 | Architektura | P2 | M | |
| DOC-006 | Doc-vs-kód drift | P2 | S | ⚠️ |
| DOC-007 | Doc-vs-kód drift | P2 | S | |
| D-1 | Dead code | P2 | S | |
| D-4 | Dead code | P2 | M | |
| D-6 | Dead code | P2 | S | |
| TC-2 | Test coverage | P2 | M | |
| RH-1 | Repo hygiena | P2 | S | |
| RH-2 | Repo hygiena | P2 | S | |
| RH-3 | Repo hygiena | P2 | S | |
| RH-4 | Repo hygiena | P2 | S | |
| RH-5 | Repo hygiena | P2 | S | |
| PR-002 | Protokol konzistence | P3 | S | |
| D-2 | Dead code | P3 | S | |
| D-5 | Dead code | P3 | S | |
| TC-5 | Test coverage | P3 | S | |

---

## Detaily nálezů

### Architektura

#### A-4 — Firmware main loop je jeden ~150řádkový nestrukturovaný blok mísící 5 nesouvisejících odpovědností
- **Osa:** Architektura
- **Závažnost:** P1
- **Co:** `while True:` (`code.py` L567–716) v jednom bloku dělá: plánování note-off (keyswitch), příjem a dispatch MIDI SysEx, **inline dispatch celého serial protokolu** (`CMD_R`/`CMD_INFO`/`CMD_W`/`CMD_HID`, ~35 řádků přímo ve smyčce, L600–630), hardware I/O faderů, 3-větvenou logiku enkodéru (cc/keyswitch/track_nav, ~45 řádků) a stavový automat tlačítka. Vše sdílí globály (`bank_index`, `encoder_state`, `button_pressed_at`, `_serial_buf`...) bez jediného vlastníka.
- **Kde:** `feel-fader-firmware/code.py` L567–716, konkrétně serial dispatch L588–632 a encoder branching L640–684.
- **Proč to vadí:** Na rozdíl od SysEx cesty, zapouzdřené v `handle_sysex()` (testovatelná, čitelná), je serial dispatch — dnes **primární** transportní cesta configu — rozlitý v hlavní smyčce a nelze ho volat/testovat izolovaně. Je to přesně ta cesta, o které `CLAUDE.md` říká „nikdy needituj naslepo" — a je nejhůř strukturovaná ze všech.
- **Doporučení:** Vytáhnout serial dispatch do `handle_serial_line(line) -> None` (analogicky k `handle_sysex`) a encoder-tick logiku do `handle_encoder_delta(delta)`; smyčka pak jen volá tyto funkce. Čistě interní refaktor, protokol beze změny.
- **Náročnost:** L

#### A-5 — `parse_banks()` a `normalize_web_config()` v `ff_config.py` duplikují ~45 řádků normalizační logiky
- **Osa:** Architektura
- **Závažnost:** P1
- **Co:** Obě funkce (L69–114 a L117–163) strukturálně identicky clampují `cc`/`channel`/`uacc_values`/`roller_mode`/`ks_notes`/`ks_velocity`/`nav_keys_cw/ccw`/`nav_invert`/meta a poskládají stejný interní bank dict — jen čtou z jiného vstupního tvaru (`parse_banks` = interní/NVM formát s legacy `channel` fallbackem, `normalize_web_config` = web formát s `fader1/2/encoder` objekty).
- **Kde:** `feel-fader-firmware/ff_config.py` L69–114 (`parse_banks`) vs L117–163 (`normalize_web_config`).
- **Proč to vadí:** Jedna cesta zpracovává config z NVM/souboru (boot), druhá config příchozí od appky (`CMD_W`/SysEx). Pokud se validační pravidlo opraví jen v jedné funkci, zařízení se bude chovat jinak podle toho, odkud config přišel — přesně ten typ tichého rozjetí, který `CLAUDE.md` varuje.
- **Doporučení:** Sjednotit do jedné `_normalize_bank(raw, *, legacy_channel=None)` s malým adaptérem na vstupu pro každý tvar dat; obě veřejné funkce jen namapují vstup a zavolají sdílenou implementaci.
- **Náročnost:** M

#### A-1 — Duplicitní stepper markup pro MIDI CHANNEL/CC na 3 místech
- **Osa:** Architektura
- **Závažnost:** P2
- **Co:** Identický vzor stepperu (−/+ tlačítka + `<input type=number>` s `stepCtrl`/`stepKs` a `onCtrl`/`onKs` handlerem) je ručně opsaný 3×, pokaždé s mírně jinými parametry místo sdílené template funkce.
- **Kde:** `feel-fader-app/feel-fader.html` — `faderSectionContent()` L2549–2556 (channel) a L2558–2564 (CC), `ccEncoderBody()` L2600–2607/2609–2616, `keyswitchBody()` L2716–2723.
- **Proč to vadí:** Jakákoli úprava stepperu (a11y label, min/max, vzhled) se musí ručně synchronizovat na 3 místech; už teď se drobně liší (keyswitchBody nemá CC pole). Riziko, že příští úprava jeden výskyt vynechá.
- **Doporučení:** Vytáhnout do `stepperFieldHtml(label, id, value, {min,max}, onChangeExpr)` a nahradit všechny 3 výskyty.
- **Náročnost:** M

#### A-2 — `validate()` se počítá 4× redundantně na jeden `render()`, se dvěma nezávislými cestami zápisu chybových DOM elementů
- **Osa:** Architektura
- **Závažnost:** P2
- **Co:** `render()` (L2376) volá `renderPanels()`, která přes `faderSectionContent()` (×2) a `ccEncoderBody()` pokaždé znovu spustí plný `validate()` jen kvůli jedné chybě pro danou sekci. Hned poté `render()` volá `runValidation()` (L3732), která `validate()` spustí počtvrté a navíc znovu ručně přepíše texty stejných `err-b{bi}-{key}` elementů, které už dřívější šablony jednou naplnily.
- **Kde:** `feel-fader-app/feel-fader.html` — `render()` L2376, `renderPanels()` L2457, `faderSectionContent()` L2536, `ccEncoderBody()` L2574, `runValidation()` L3732–3759.
- **Proč to vadí:** Dvě nezávislé implementace stejné logiky se musí shodovat, jinak se UI rozejde. Zatím náhodou obě čtou ze stejného `validate()` výstupu, ale přidání pole do validace vyžaduje pamatovat na oba zápisové body.
- **Doporučení:** Spočítat `validate()` jednou na začátku `render()`/`renderPanels()` a předat výsledek dolů; zrušit duplicitní `forEach` v `runValidation()`.
- **Náročnost:** M

#### A-3 — `setRollerMode()` obchází `render()` a mutuje DOM přímo vedle state mutace
- **Osa:** Architektura
- **Závažnost:** P2
- **Co:** `setRollerMode(bi, mode)` (L3026–3066) v jedné funkci mutuje `cfg.banks[bi].roller_mode`/`ks_notes`, nastavuje `dirty`, volá `reflectDirty()`+`cfgAutosave()` — a pak místo `render()` ručně patchuje DOM (`classList`/`aria-pressed`, CSS custom property, `setTimeout` s vlastní cross-fade animací, teprve v callbacku `innerHTML` + `runValidation()`).
- **Kde:** `feel-fader-app/feel-fader.html` — `setRollerMode()` L3026–3066.
- **Proč to vadí:** Appka má jinak jeden jasný render model (`cfg` → `render()` → DOM). Tahle funkce zavádí druhou, paralelní cestu jen kvůli plynulé animaci — riziko, že `cfg` a zobrazený DOM se dostanou mimo synchronizaci při rychlém opakovaném přepnutí (částečně ošetřeno `clearTimeout`, ale ručně, ne garantovaně render pipeline).
- **Doporučení:** Izolovat animaci do vlastní no-side-effect helper funkce, která nemutuje `cfg`/nevolá `cfgAutosave` — oddělit „co se uloží" od „jak se to animuje".
- **Náročnost:** M

### Protokol konzistence

#### PR-001 — App implementuje jen 2 ze 6 dokumentovaných SysEx příkazů; mrtvá `CMD_W` větev je aktivní riziko
- **Osa:** Protokol konzistence
- **Závažnost:** P1
- **Co:** Firmware `CLAUDE.md` popisuje 6-příkazový obousměrný SysEx protokol (`CMD_W`, `CMD_R`, `CMD_INFO`, `CMD_CHUNK`, `CMD_ACK`, `CMD_ERR`). App nikdy neposílá `CMD_R` přes SysEx (žádný odchozí `0xF0...` zápis v celém souboru) a `handleSysEx()` má větve jen pro `CMD_W` a `CMD_INFO` — `CMD_CHUNK`/`CMD_ACK`/`CMD_ERR` nemají žádné ošetření. Firmware naopak nikdy neposílá `CMD_W` odchozí (`code.py:357,366,372` posílá jen `CMD_CHUNK`/`CMD_ACK`/`CMD_ERR`/`CMD_INFO`) — appčina `CMD_W` větev je dnes mrtvá, ale při spuštění provede plný tichý přepis stavu (`cfg=p; ...dirty=false;`) bez kontroly původu (souvisí se SEC-003).
- **Kde:** `feel-fader-app/feel-fader.html:4138-4169` (`handleSysEx`); `feel-fader-firmware/code.py:349-372` (`send_config_chunks`, `send_ack`, `send_err`).
- **Proč to vadí:** Dokument čte se, jako by SysEx round-trip read/write configu byl podporovaný fallback. Ve skutečnosti existuje jen info-push a nedosažitelná/riziková write větev. Kdokoli by SysEx cestu rozšiřoval, předpokládal by, že `CMD_CHUNK`/`CMD_ACK`/`CMD_ERR` jsou už na app straně zapojené — nejsou.
- **Doporučení:** Buď implementovat `CMD_CHUNK` reassembly + `CMD_ACK`/`CMD_ERR` handling v `handleSysEx`, nebo v CLAUDE.md explicitně označit SysEx read (`CMD_R`/`CMD_CHUNK`) a ack/err jako „jen firmware, appka nepoužívá" — stejně jako dokument už dnes označuje write round-trip za nespolehlivý. Odstranit nebo zajistit mrtvou příchozí `CMD_W` větev.
- **Náročnost:** M ⚠️ (dotýká se sémantiky drátového protokolu)

#### PR-003 — `faders` sync-on-connect pole je dokumentované jako dostupné na obou CMD_INFO cestách, appka ho aplikuje jen na serial cestě
- **Osa:** Protokol konzistence
- **Závažnost:** P1
- **Co:** Firmware `CLAUDE.md:63` tvrdí, že volitelné pole `faders:[v1,v2]` bylo „přidáno v obou CMD_INFO cestách (serial + SysEx)". Firmware ho skutečně posílá v obou (`send_info_sysex()` i serial handler, `code.py:336-342` a `608-615`). Appka ale `applyInfoFaders(info)` (`feel-fader.html:3795-3803`) volá jen ze `serialReadInfo()` (`4281`) — SysEx `CMD_INFO` větev v `handleSysEx()` (`4154-4168`) `applyInfoFaders` nikdy nevolá a taky neaplikuje `config_hash`/`config_source`.
- **Kde:** `feel-fader-app/feel-fader.html:4154-4168` (chybí volání `applyInfoFaders`) vs `feel-fader-firmware/CLAUDE.md:63`.
- **Proč to vadí:** Dokument tvrdí paritu napříč transporty, kód ji nemá. Nízký praktický dopad dnes (appka se na SysEx `CMD_INFO` odpověď pro tenhle účel nespoléhá), ale je to jasný „doc říká X, kód dělá Y" případ.
- **Doporučení:** Buď zavolat `applyInfoFaders(info)` (+ aplikovat `config_hash`/`config_source`) i v SysEx `CMD_INFO` větvi, nebo opravit dokument, že se pole dnes konzumuje jen přes serial.
- **Náročnost:** S ⚠️ (malá změna kódu, ale mění pozorovatelné chování dokumentované wire featury)

#### PR-002 — Firmware CLAUDE.md odkazuje na app funkce, které už neexistují
- **Osa:** Protokol konzistence
- **Závažnost:** P3
- **Co:** `feel-fader-firmware/CLAUDE.md:11` odkazuje na `sysexReadConfig`, `sysexWriteConfig` v appce — ani jedna neexistuje (0 výskytů). App vlastní `CLAUDE.md:10` má správné aktuální názvy (`serialRequest`/`_readReply`, `normalizeFwConfig`).
- **Kde:** `feel-fader-firmware/CLAUDE.md:11` vs `feel-fader-app/feel-fader.html` (funkce neexistuje).
- **Proč to vadí:** Dva dokumenty stejného faktu se rozešly — viz i DOC-002, se kterým tenhle nález sdílí příčinu (stejná řádka 11).
- **Doporučení:** Sjednotit se seznamem funkcí z `feel-fader-app/CLAUDE.md`.
- **Náročnost:** S

### Doc-vs-kód drift

#### DOC-001 — `WEBAPP.md` §1 „Technologie" tabulka odporuje vlastní §5 (Transport)
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P0
- **Co:** Tabulka „Technologie" v §1 tvrdí `Serial | Web Serial API — fallback/doplněk pro čtení dat ze zařízení` a `Transport | SysEx zprávy přes MIDI výstup`. To je přesný opak §5 (přepsané 2026-07-12): config se **nepřenáší SysEx**, Serial je **jediný** kanál pro čtení i zápis, SysEx je jen vedlejší příjmový kanál. Přepis §5 se do §1 nikdy nepropsal.
- **Kde:** `feel-fader-app/WEBAPP.md` řádky 80 a 82 (proti §5, řádek 388+); kód: config transport je `serialRequest()`/`_readReply()` (~4209/4230), SysEx (`handleSysEx`, ~4138) je jen pro příjem.
- **Proč to vadí:** Agent, který si přečte jen §1 (rychlý přehled), dostane opačnou informaci o tom, kudy jde config — v oblasti, kde WEBAPP.md sám varuje, že špatné SysEx chování zasekává MIDI endpoint na HW. Riziko regrese do nebezpečného stavu.
- **Doporučení:** Přepsat řádky 80 a 82 dle §5: `Serial | Web Serial API — jediný transport configu (read/write)`, `Transport | line-based textový protokol po Web Serial; MIDI jen pro detekci a live hodnoty`.
- **Náročnost:** S ⚠️ (popis drátového protokolu)

#### DOC-002 — Firmware CLAUDE.md popisuje app stranu protokolu starým (odstraněným) API
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P0
- **Co:** Úvodní blok „App ↔ Firmware jsou spřažené přes protokol" (`firmware/CLAUDE.md:11`) tvrdí, že app má funkce `normalizeFwConfig`, `sysexReadConfig`, `sysexWriteConfig`, `handleSysEx`, `dec7`/`enc7`. `sysexReadConfig`/`sysexWriteConfig` v kódu neexistují (odstraněny refaktorem 2026-06-27). Tenhle blok navíc přímo protiřečí sekci „Komunikační protokol" ve stejném souboru (opravené commitem `80542dd`, 2026-07-08), která správně říká „MIDI SysEx cesta... v appce se nepoužívá". Oprava se do úvodního bloku nikdy nepropsala.
- **Kde:** `feel-fader-firmware/CLAUDE.md` řádek 11 (proti řádkům 45-47 stejného souboru); `feel-fader-app/feel-fader.html` — `sysexReadConfig`/`sysexWriteConfig` = 0 výskytů.
- **Proč to vadí:** Tohle je přesně ten dokument, co má agenta v firmware repu upozornit, co v appce zkontrolovat před úpravou protokolu. Pokud uvěří, že app pořád má `sysexWriteConfig`, riskuje návrat SysEx zápisu do detekce/configu — scénář, který podle HW nálezu z 2026-07-07 zasekává MIDI endpoint.
- **Doporučení:** Sjednotit úvodní bullet s aktuálním stavem app strany (kopírovat/odkázat na `feel-fader-app/CLAUDE.md:10`), odstranit `sysexReadConfig`/`sysexWriteConfig` a `enc7` (viz DOC-006).
- **Náročnost:** S ⚠️ (popis drátového protokolu)

#### DOC-003 — `WEBAPP.md` tvrdí „ověřeno k 2026-07-12 / 3466 řádků", reálně 5821 řádků a dokument byl od té doby 18× editován
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P1
- **Co:** Hlavička (řádek 5) i §1 (řádek 71) tvrdí stav „aktuální k 2026-07-12" a „~3466 řádků". `feel-fader.html` má teď **5821 řádků** (+2355, +68 %) — mezi 2026-07-12 a dnes (2026-07-20) přibylo 32 commitů měnících soubor. `WEBAPP.md` samotný má za stejné období 18 commitů, ale žádný nepřepočítal čísla řádků ani hlavičkové tvrzení.
- **Kde:** `feel-fader-app/WEBAPP.md` řádky 5 a 71; kód `feel-fader.html` (5821 řádků).
- **Proč to vadí:** Dokument aktivně tvrdí čerstvost, kterou nemá — nejzavádějivější typ driftu, protože agent nemá důvod číslům nedůvěřovat.
- **Doporučení:** Buď přepočítat a datovat znovu, nebo přejít na strukturální odkazy (jméno funkce/sekce) bez `Lxxxx`, jak už dokument udělal v §3.5/§3.6/§3.8.
- **Náročnost:** M

#### DOC-004 — Čísla řádků v §6 „Klíčové funkce" a inline `Lxxxx` jsou systematicky posunutá o ~700–1900 řádků
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P1
- **Co:** Přímý důsledek DOC-003. Ukázka (doc → skutečnost): `render()` 1473→**2376**, `selectBank(i)` 2065→**3122**, `doSend()` 2862→**4387**, `doStart()` 2808→**4329**, `handleSysEx()` 2624→**4138**, `loadConfigFromDevice()` 2781→**4293**, `toggleDark()` 3090→**4767**, `hideWelcome()` 3207→**5005**, `openIconPicker()` 3262→**5179**, `cfgSave()` 1432→**2137**, `DEFAULT_CFG` 1412→**2108**, fader konstanty (§7) 2385→**3765**, `TRANSLATIONS` (§8) 3018→**4636**. Funkce samotné existují a chování odpovídá popisu (ověřeno u ~30 funkcí) — jde čistě o čísla řádků, ale v rozsahu daleko za tolerovanou „desítkami" driftu.
- **Kde:** `feel-fader-app/WEBAPP.md` §2, §4, §5, §6, §7, §8; kód `feel-fader.html`.
- **Proč to vadí:** Odkazy na konkrétní řádky jsou v tomto rozsahu prakticky nepoužitelné pro rychlou orientaci a matou důvěru v přesnost zbytku dokumentu.
- **Doporučení:** Doplnit skript/checklist pro přepočet při release, nebo (levněji a odolněji) odstranit `Lxxxx` z většiny míst a nechat jen jméno funkce, jak už dokument udělal v §3.5/3.6/3.8/3.9/3.10.
- **Náročnost:** M

#### DOC-005 — Firmware funkce `_parse_banks` neexistuje (ani jméno, ani umístění)
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P1
- **Co:** Oba `CLAUDE.md` uvádí firmware funkci `_parse_banks` jako součást `code.py`. Skutečná funkce se jmenuje `parse_banks` (bez podtržítka) a je v `ff_config.py`, ne v `code.py` — `code.py` ji jen importuje a volá.
- **Kde:** `feel-fader-app/CLAUDE.md:11`; `feel-fader-firmware/CLAUDE.md` řádky 10 a 115; kód `feel-fader-firmware/ff_config.py:69` (`def parse_banks`).
- **Proč to vadí:** Agent hledající `_parse_banks` v `code.py` ho nenajde a může usoudit, že byla odstraněna, místo aby zjistil, že je v jiném modulu pod jiným jménem.
- **Doporučení:** V obou souborech opravit na `parse_banks()` v `ff_config.py`.
- **Náročnost:** S ⚠️ (formát configu je součást drátového protokolu)

#### DOC-006 — `enc7` uvedena jako funkce appky, appka ji nemá
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P2
- **Co:** Oba `CLAUDE.md` u „App" bulletu uvádí `dec7`/`enc7`. `feel-fader.html` má jen `dec7()` (4098) — `enc7` v appce neexistuje (0 výskytů), správně, protože appka „SysEx nikdy neposílá" (§5.7). `enc7` existuje jen na firmware straně (`code.py:259`).
- **Kde:** `feel-fader-app/CLAUDE.md:10`; `feel-fader-firmware/CLAUDE.md:11`.
- **Proč to vadí:** Stejná kategorie zmatení jako DOC-002/DOC-005.
- **Doporučení:** V obou souborech u „App" bullet nechat jen `dec7`.
- **Náročnost:** S ⚠️ (protokolová funkce)

#### DOC-007 — `WEBAPP.md` §2 „Struktura souboru": hranice `<style>`/`<script>` bloků neodpovídají skutečnosti
- **Osa:** Doc-vs-kód drift
- **Závažnost:** P2
- **Co:** §2 tvrdí `<style> CSS (řádky 10–1071)` a `<script>... (řádky 1325–3465)`. Skutečnost: `<style>` 10–1563, `<script>` 1941–5819. Stejná příčina jako DOC-003/DOC-004.
- **Kde:** `feel-fader-app/WEBAPP.md` řádky 94 a 101.
- **Proč to vadí:** Kosmeticky nižší riziko než DOC-001/002, ale další indikátor, že sekce po §5-rewrite nikdo neprošel číslo po čísle.
- **Doporučení:** Přepočítat spolu s DOC-003 v rámci jednoho update passu.
- **Náročnost:** S

### Dead code

#### D-3 — Odstraněný JSON inspector zanechal mrtvou stopu napříč JS/HTML/CSS
- **Osa:** Dead code
- **Závažnost:** P1
- **Co:** `WEBAPP.md` §3.9 tvrdí, že „původní viditelný JSON inspector byl odstraněn". Zůstaly: `toggleJson()`, `refreshJson()`, `copyJson()` (L4460, 4492, 4493, dvě z nich exportované na `window`, žádný `onclick` na ně neukazuje); globální `jsonOpen` (L2177), kterou nic nemůže nastavit na `true`, se přesto testuje na **12 místech** (`render()`, `onCtrl()`, `onFaderName()`, `setRollerMode()`, `selectBank()`, `addKsNote()`, `removeKsNote()`, `setKsBound()`, `moveKsNote()`, `ksKeyboardSelect()`, `ksKeyboardKey()`, `applyKsPreset()`, `resetKs()`); v HTML zůstaly osiřelé `#json-body`, `#json-pre`, `#json-lbl`, prázdné `#json-sec` (L1740, 1743).
- **Kde:** `feel-fader-app/feel-fader.html` L4460–4493, `jsonOpen` na 12 místech, HTML L1740/1743.
- **Proč to vadí:** Kdokoli narazí na `if(jsonOpen) refreshJson()` na tuctu míst a musí si domyslet, že jde o mrtvou větev — zvyšuje kognitivní zátěž a riziko, že příští refaktor omylem „opraví" nefunkční featuru místo aby ji smazal.
- **Doporučení:** Smazat `jsonOpen`, všech 12 podmíněných volání, `toggleJson`/`refreshJson`/`copyJson`, jejich `window.*` exporty a osiřelé HTML uzly.
- **Náročnost:** M

#### D-1 — Tři JS funkce bez jediného volání
- **Osa:** Dead code
- **Závažnost:** P2
- **Co:** `faderPanel(key,ctrl,bi)` (L2531–2533, pass-through na `faderSectionContent`), `addUaccFromPreset(values)` (L3397–3402), `setBar(id,v){}` (L4604, prázdné tělo, komentář „value bar removed"). Žádná nemá výskyt jinde (ani `onclick=`, ani `window.*`).
- **Kde:** `feel-fader-app/feel-fader.html` L2531, L3397, L4604.
- **Proč to vadí:** `faderPanel` je matoucí duplicitní alias; `setBar` je prázdný stub po odstraněné featuře.
- **Doporučení:** Smazat všechny tři.
- **Náročnost:** S

#### D-4 — 61 CSS tříd (~16 % stylesheetu) bez výskytu mimo `<style>`, včetně celé `.m-*` (modal) komponenty
- **Osa:** Dead code
- **Závažnost:** P2
- **Co:** Systematický grep 392 unikátních tříd proti zbytku souboru ukázal 61 tříd s nulovým výskytem v HTML/JS. Hlavní shluky: `.m-head/.m-title/.m-close/.m-body/.m-section/.m-row/.m-lbl/.m-note/.m-foot` (celá „modal" komponenta — `WEBAPP.md` §2 pořád uvádí `#modal` jako existující element, ten ale v HTML není), `.midi-banner`/`.midi-dot` (nahrazeno header status dotem), `.val-bar-wrap/.val-bar/.val-num` (viz D-1), `.json-section/.json-toggle/.json-copy-btn` (viz D-3), a menší zbytky (`.enc-current-wrap`, `.artic-val-row`, `.advanced-wrap/.advanced-item*`, `.bank-tabs-wrap`, `.faders-row`, `.full-width-panel`).
- **Kde:** `feel-fader-app/feel-fader.html` CSS blok L10–1563 (`.m-*` L837–846, `.midi-banner`/`.midi-dot` L199–207, `.val-bar*` L420–422+1552).
- **Proč to vadí:** Falešný signál toho, co je aktivní — konkrétně `.m-*` blok aktivně podporuje nesprávný řádek ve `WEBAPP.md` (že `#modal` existuje).
- **Doporučení:** Smazat po skupinách (modal, midi-banner, val-bar, json-*); u zbylých ~35 menších tříd ověřit jednotlivě (možné false positivy z dynamicky skládaných class stringů).
- **Náročnost:** M

#### D-6 — `unpack_presets_blob_v1()` je mrtvý v produkci; `code.py` má duplicitní inline implementaci
- **Osa:** Dead code
- **Závažnost:** P2
- **Co:** `unpack_presets_blob_v1()` (`ff_config.py` L334–341) je testovaná (`tests/test_wave2_nvm.py`), ale `code.py` ji nikde nevolá. Legacy v1 NVM loader v provozu je `_nvm_load()` (`code.py` L90–101), který stejnou logiku (marker `\xFE\xED`, 2-bajtové délkové pole, validace) implementuje znovu ručně.
- **Kde:** `feel-fader-firmware/ff_config.py` L334–341 vs `code.py` L88–101.
- **Proč to vadí:** Testovaná funkce netestuje to, co skutečně běží na zařízení — falešný pocit jistoty o v1-migrační cestě; reálně používaný kód svůj test nemá. Souvisí s A-5 vzorcem duplikace.
- **Doporučení:** Buď `_nvm_load()` přepsat na volání `ff_config.unpack_presets_blob_v1(...)`, nebo `unpack_presets_blob_v1`/její test smazat.
- **Náročnost:** S

#### D-2 — Vestigiální guard `window.renderBankIndicator` pro neexistující funkci
- **Osa:** Dead code
- **Závažnost:** P3
- **Co:** `window.renderBankIndicator = typeof renderBankIndicator === 'function' ? renderBankIndicator : ()=>{};` — `renderBankIndicator` není nikde definovaná, výraz vždy vyhodnotí no-op.
- **Kde:** `feel-fader-app/feel-fader.html` L5779.
- **Proč to vadí:** Matoucím způsobem naznačuje existující API.
- **Doporučení:** Smazat řádek; pokud na `window.renderBankIndicator` spoléhá nějaký `scratch/*.mjs` probe, opravit tam.
- **Náročnost:** S

#### D-5 — `.ui-primary` CSS třída definovaná, nikde nepoužitá — v rozporu s vlastním design-system kontraktem
- **Osa:** Dead code
- **Závažnost:** P3
- **Co:** `.ui-primary{...}`/`.ui-primary:hover{...}` (L111–112) bez výskytu v HTML/JS. `WEBAPP.md` §0 tvrdí, že `.ui-primary`/`.ui-danger` jsou používané barevné varianty — `.ui-danger` je použitá (L1737), `.ui-primary` ne.
- **Kde:** `feel-fader-app/feel-fader.html` L111–112.
- **Proč to vadí:** Dokumentace tvrdí něco, co kód nedělá.
- **Doporučení:** Buď smazat, nebo skutečně nasadit tam, kde design-system dokument tvrdí, že je.
- **Náročnost:** S

### Test coverage

#### TC-1 — App má nulová automatizovaná testy, žádný jednotný test runner
- **Osa:** Test coverage
- **Závažnost:** P1
- **Co:** `package.json` `scripts.test` je stub (`echo "Error: no test specified" && exit 1`). Jediná existující verifikace jsou ad-hoc Puppeteer probes ve `scratch/` — 12 z nich je trackovaných v gitu (`connstate-probe.mjs`, `connstate-flow-probe.mjs`, `connstate-reconnect-probe.mjs`, `faders-inert-probe.mjs`, `help-trim-probe.mjs`, `livecolor-probe.mjs`, `mobile-ux-probe.mjs`, `onb-probe1-5.mjs`) a fungují jako neformální regression suite, ale `package.json` `test:mobile` spouští jen jeden z nich a neexistuje příkaz, který by spustil všechny.
- **Kde:** `feel-fader-app/package.json`; `feel-fader-app/scratch/*.mjs` (12 trackovaných probes).
- **Proč to vadí:** `AGENTS.md` appky nařizuje „ověř změnu nejmenším relevantním committed `.mjs` probe" — je to jediný sankcionovaný test mechanismus appky, ale bez jednotného runneru se snadno stane, že se probe zapomene spustit, nebo že po refaktoru přestane platit a nikdo si toho nevšimne (žádné CI, žádný `npm test` co by to zachytilo).
- **Doporučení:** Přidat `npm test` skript, který postupně spustí všech 12 trackovaných probes a selže na první chybě; zvážit přesun probes z `scratch/` do `tests/` aby bylo jasné, že jsou to sankcionované regression testy, ne dočasný odpad.
- **Náročnost:** M

#### TC-3 — HID enable/disable cesta ve firmwaru zcela bez testů
- **Osa:** Test coverage
- **Závažnost:** P1
- **Co:** `_hid_flag_read()`, `_hid_flag_write()`, `set_hid_enabled()`, `apply_hid_request()` (`code.py`) nemají žádný výskyt v `tests/*.py`.
- **Kde:** `feel-fader-firmware/code.py` (funkce výše); `feel-fader-firmware/tests/` (chybí odpovídající test soubor).
- **Proč to vadí:** HID toggle je reálná uživatelská featura (gatuje Navigation mód a macro dle `WEBAPP.md` §3.9) bez rebootu — regrese by se projevila jen ručním testem na HW.
- **Doporučení:** Přidat `tests/test_hid_flag.py` pokrývající flag read/write round-trip a `apply_hid_request` chybové cesty (viz vzor existujících `test_wave2_*.py`).
- **Náročnost:** M

#### TC-4 — Appčiny klíčové protokol/validační funkce bez pokrytí — přímá příčina, proč SEC-002 nebyl odhalen
- **Osa:** Test coverage
- **Závažnost:** P1
- **Co:** `validate()` (L3665), `normalizeFwConfig()` (L4101), `serialRequest()` (L4209), `_readReply()` (L4230) — appčiny nejkritičtější, nejrizikovější funkce (protocol parsing, config validace) — nemají žádné automatizované testy. Firmware ekvivalent (`apply_web_config`/`_parse_banks`) má pytest pokrytí; appka ne.
- **Kde:** `feel-fader-app/feel-fader.html` L3665, 4101, 4209, 4230.
- **Proč to vadí:** `validate()`'s typová díra (SEC-002) je přesně to, co by jednotkový test s `NaN`/string vstupem okamžitě odhalil — místo toho zůstala nepovšimnutá, dokud ji nenašel tento audit.
- **Doporučení:** Extrahovat tyhle funkce do samostatného modulu (nebo alespoň zpřístupnit na `window` pro test) a napsat headless-Node harness po vzoru existujících probes, který je volá přímo s edge-case vstupy (NaN, mimo rozsah, chybějící pole).
- **Náročnost:** M

#### TC-2 — `handle_sysex()` a `dec7`/`enc7` bez firmware testů
- **Osa:** Test coverage
- **Závažnost:** P2
- **Co:** SysEx handler a 7-bit (de)kódovací funkce nemají přímé test reference v `tests/*.py`.
- **Kde:** `feel-fader-firmware/code.py` (`handle_sysex`, `dec7`, `enc7`).
- **Proč to vadí:** SysEx je dnes sekundární kanál (viz DOC-002), ale `CLAUDE.md` požaduje, aby zůstal „hash-konzistentní" se serial cestou — beze změny se to nedá ověřit automaticky.
- **Doporučení:** Přidat alespoň encode/decode round-trip test pro `dec7`/`enc7`; `handle_sysex` test nižší priorita vzhledem k sekundární roli kanálu.
- **Náročnost:** M

#### TC-5 — ADC čtecí funkce inherentně těžko testovatelné (přiznaný, ne opravitelný gap)
- **Osa:** Test coverage
- **Závažnost:** P3
- **Co:** `read_adc_7bit_avg()`, `read_fader_7bit_inverted_filtered()` (`code.py`) čtou skutečný hardware ADC — bez mock vrstvy nejdou smysluplně jednotkově testovat.
- **Kde:** `feel-fader-firmware/code.py` (funkce výše).
- **Proč to vadí:** Není to nedbalost, je to hardwarová závislost — zmiňuji jen pro úplnost obrazu pokrytí.
- **Doporučení:** Nechat jako přiznaný limit, případně dokumentovat v `tests/` proč tu není test.
- **Náročnost:** S

### Repo hygiena

#### RH-1 — 20 mergnutých větví v `feel-fader-app` neuklizeno
- **Osa:** Repo hygiena
- **Závažnost:** P2
- **Co:** `git branch --merged main` (mimo `main`) vrací 20 lokálních větví: `fader-slot-glow`, `feelfader-ux-pass`, `fix-card-flash`, `hid-checkbox-polish`, `macro-head-pattern`, `macro-semicircle-glow`, `midi-denied-visibility`, `onboarding`, `p3-track-nav`, `p4-button-longpress`, `roller-head-pattern`, `section-tint-hl`, `serial-busy-hint`, `stage-ease`, `sticky-stage`, `ui-feedback-round1`, `ui/bank-bar-inline-header`, `usb-descriptor-stable`, `wave1-audit-fixes`, `wave2-app-prep`. (`control-mode` a `help-onboarding` jsou vědomě ponechané pro referenci — viz `docs/superpowers/plans/...` a Obsidian log 2026-07-11 — nejsou součástí tohoto nálezu.)
- **Kde:** `feel-fader-app` repo, lokální větve.
- **Proč to vadí:** Čistě hygienické — žádné riziko, ale ztěžuje orientaci v `git branch` výstupu.
- **Doporučení:** `git branch -d` pro všechny výše (jsou fully-merged, bezpečné smazat).
- **Náročnost:** S

#### RH-2 — 3 remote větve v `feel-fader-app` fully merged, neuklizeny
- **Osa:** Repo hygiena
- **Závažnost:** P2
- **Co:** `origin/p3-track-nav`, `origin/p4-button-longpress`, `origin/usb-descriptor-stable` jsou plně obsaženy v `origin/main`.
- **Kde:** `feel-fader-app` repo, `origin` remote.
- **Proč to vadí:** Stejné jako RH-1, na remote úrovni.
- **Doporučení:** `git push origin --delete p3-track-nav p4-button-longpress usb-descriptor-stable` (po potvrzení, že nikdo jiný na nich nestaví).
- **Náročnost:** S

#### RH-3 — `feel-fader-firmware`: `wave1-audit-fixes` a `p5-midi-rate` větve jsou redundantní (obsah už je na `main` pod jinými commit hashi)
- **Osa:** Repo hygiena
- **Závažnost:** P2
- **Co:** `wave1-audit-fixes` (4 commity) obsahuje `chore: add .gitignore`, `feat: send Program Change on bank switch (audit C2)`, `fix: long-press without macro falls back to bank switch (audit F1)`, `fix: PROD mode hides USB drive (audit F2)` — všechny se stejným autorem/timestampem a **bajtově identickým diffem** jako odpovídající commity už na `main` (`1831f51`, `2e0360b`, `d37cd4d`), jen s jiným commit hashem (přepsáno/cherry-pick). `p5-midi-rate` má jediný commit (`a9051b0`, `.gitignore`), jehož obsah je taky už na `main`.
- **Kde:** `feel-fader-firmware` repo, lokální větve `wave1-audit-fixes`, `p5-midi-rate`; ověřeno `git diff <branch-commit> <main-commit>` = prázdný diff.
- **Proč to vadí:** Vypadají jako rozpracovaná práce čekající na merge, ale obsahově už jsou na `main` — matoucí pro kohokoliv, kdo by je chtěl mergovat znovu.
- **Doporučení:** `git branch -d` pro obě (bezpečné — obsah je verifikovaně na `main`).
- **Náročnost:** S

#### RH-4 — `feel-fader-firmware`: 2 remote větve fully merged, `p5-midi-rate` remote neuklizen
- **Osa:** Repo hygiena
- **Závažnost:** P2
- **Co:** `origin/p3-track-nav`, `origin/p4-button-longpress` jsou fully merged do `origin/main`. `origin/p5-midi-rate` obsahuje jen redundantní `.gitignore` commit (viz RH-3).
- **Kde:** `feel-fader-firmware` repo, `origin` remote.
- **Proč to vadí:** Stejné jako RH-3, na remote úrovni.
- **Doporučení:** Smazat po potvrzení.
- **Náročnost:** S

#### RH-5 — `scratch/` gitignore pokrývá jen jednu podsložku, 12 trackovaných probes bez zdokumentované politiky
- **Osa:** Repo hygiena
- **Závažnost:** P2
- **Co:** `.gitignore` v `feel-fader-app` ignoruje jen `scratch/mobile-ux-output/`. Ve `scratch/` je 12 trackovaných `.mjs` probes (regression-style, viz TC-1) vedle ~45 netrackovaných jednorázových probes/screenshotů. Rozdíl mezi „trackovat" a „netrackovat" existuje fakticky (podle toho, co bylo commitnuto), ale není zapsaný nikde (`AGENTS.md` mluví jen o „nejmenším relevantním committed probe", nevysvětluje kdy nový probe commitnout).
- **Kde:** `feel-fader-app/.gitignore`; `feel-fader-app/scratch/`.
- **Proč to vadí:** Bez psané konvence je snadné buď omylem commitnout jednorázový odpad, nebo zapomenout commitnout skutečně užitečný regression probe.
- **Doporučení:** V `AGENTS.md` nebo `scratch/README` krátce zapsat konvenci (např. „commitni probe, pokud ověřuje regresi featury, kterou lze rozbít budoucí změnou; jednorázové diagnostické probes nech netrackované").
- **Náročnost:** S

### Bezpečnost

#### SEC-001 — Nesanitizované config hodnoty (import/SysEx) tečou do `innerHTML` — DOM XSS
- **Osa:** Bezpečnost
- **Závažnost:** P0
- **Co:** `normalizeFwConfig()` (L4101–4136) a custom-preset merge cesta neprovádí žádnou typovou koerzi/sanitizaci `fader_cc`/`fader_ch`/`encoder`/`encoder_ch`/`uacc_values`/`ks_notes` — hodnoty jdou přímo z parsovaného JSON (device response, SysEx payload, nebo importovaný soubor). Tyhle hodnoty se pak **bez `escHtml`** interpolují do stringů přiřazovaných přes `.innerHTML =`:
  - `feel-fader.html:2552` — `value="${ctrl.channel+1}"` v `faderSectionContent()`, jejíž výstup jde do `panels-row.innerHTML` (L2502).
  - `feel-fader.html:2561` — `value="${ctrl.cc}"`, stejný sink.
  - `feel-fader.html:2580-2589` — `ccEncoderBody()`'s `uaccTags` interpoluje `${v}` (prvek `uacc_values`) nesanitizovaně do `title=`/`aria-label=`, taky do `panels-row.innerHTML`.
  - `feel-fader.html:2885-2887` — `renderEncChips()`: `el.innerHTML = ...uacc_values.map((v,i)=>`<div>${v}</div>`)`.
  - `feel-fader.html:2664-2672` — `keyswitchTagsHtml()` interpoluje `ks_notes` prvky do `data-ksnote=`/`title=`/`aria-label=`.

  Tři potvrzené cesty dosahu, obě končící v `render()`/`renderPanels()`:
  1. **JSON backup import** — `onImport()` (4428–4438): parsuje libovolný soubor, kontroluje jen že `p.banks` existuje, pak `cfg=p; render()`.
  2. **Custom preset import** — `importCustomPresets()` (5639–5658) → `isValidCustomPreset()` (5337–5340) kontroluje jen `preset.custom===true` a přítomnost jednoho z `mapping/roller/articulations/icon` — bez validace typů vnořených `cc`/`channel`/`uacc_values` — pak `applyLibraryPreset()` (5660–5699) mergne `preset.mapping.fader1` přes spread přímo do `bank.fader1`.
  3. **Device/SysEx response** — `loadConfigFromDevice()` (4293–4309) a `handleSysEx()`'s `CMD_W` větev (4141–4153) obě volají `normalizeFwConfig(p)` na parsovaném device/SysEx JSON.

  Vytvořená hodnota `cc`/`channel`/`uacc_values`/`ks_notes` jako `0"><img src=x onerror=alert(1)>` unikne z atributového kontextu v `panels-row.innerHTML`.
- **Kde:** `feel-fader-app/feel-fader.html`: 2552, 2561, 2580-2589, 2664-2672, 2885-2887 (sinky); 4101-4136 (chybějící sanitizace); 4428-4438, 5337-5340, 5660-5699 (import zdroje); 4141-4153, 4293-4309 (device/SysEx zdroje).
- **Proč to vadí:** Otevření útočníkem připraveného `.json` backupu nebo „custom setup" souboru, nebo přijetí spoofnuté device/SysEx odpovědi, spustí libovolný skript na stránce — stránce, která navíc drží grantnutý `navigator.serial` handle na fyzické zařízení a může do něj tiše zapisovat configy. Stejná třída chyby, jakou needitovaná větev `control-mode` opravila pro MIDI port names — na `main` existuje přes config numerická pole a je dosažitelná i přes file import.
- **Doporučení:** V `normalizeFwConfig` (analogicky k `ff_config.py`'s `_clamp(int(...))`) coercovat/clampovat `cc`→Number 0-127, `channel`→Number 0-15, `uacc_values`/`ks_notes` prvky→Number 0-127 (odmítnout/zahodit non-finite). Navíc jako defense-in-depth zabalit zbylé raw `${...}` interpolace config hodnot do `escHtml` přímo u sinku; `isValidCustomPreset` by měla validovat i vnořené typy, ne jen top-level tvar.
- **Náročnost:** M

#### SEC-003 — SysEx „identifikace" zařízení je substring match na jméno portu, ne autentizace — libovolný lokální MIDI port může poslat `CMD_W`
- **Osa:** Bezpečnost
- **Závažnost:** P0
- **Co:** `connectInputs()` napojí `onmidimessage = onMidiMsg` na **jakýkoliv** MIDI vstup, jehož `.name` matchne `isFeelFader()` — prostý substring test: `n.includes('feel fader') || n.includes('circuitpython audio')` (3962–3973). Jakýkoliv lokální proces, co umí vytvořit virtuální MIDI port s odpovídajícím jménem (triviální na Windows přes loopMIDI), dostane své zprávy routnuté do `onMidiMsg` → `handleSysEx`. `handleSysEx` (4138–4139) navíc kontroluje jen `data[1]===MFR` (`0x7D`, MIDI-spec sdílené „non-commercial" manufacturer ID, ne appce-specifické) a `data[2]===DEV_ID` (`0x01`, jediný konstantní bajt) — obojí triviálně uhodnutelné/zfalšovatelné. Žádná kryptografická nebo session-based kontrola, že SysEx skutečně přišel z reálného Feel Fader hardwaru.
- **Kde:** `feel-fader-app/feel-fader.html:3962-3973` (`isFeelFader`, `connectInputs`), `4138-4139` (manufacturer/device check), `4092` (`MFR=0x7D,DEV_ID=0x01`).
- **Proč to vadí:** V kombinaci se SEC-001 mění klient-side rendering bug na vzdáleně-spustitelný i bez file importu: jakýkoliv jiný software na stejném stroji, co (a) vystaví virtuální MIDI port pojmenovaný např. „Feel Fader Bridge" a (b) pošle vytvořenou SysEx zprávu `[0xF0,0x7D,0x01,0x01,...enc7(malicious JSON)...,0xF7]`, dostane svůj payload auto-aplikovaný přes `handleSysEx`'s `CMD_W` větev (`cfg=p; ...; render()`) v jakémkoliv otevřeném Feel Fader tabu, co má grantnutý MIDI sysex přístup — spustí SEC-001 XSS a tiše přepíše uživatelský config (`dirty=false`, tedy to vypadá i jako uložené/synchronizované) bez jakéhokoliv gesta uživatele.
- **Doporučení:** Minimálně gatovat `CMD_W`/config-mutující SysEx za potvrzení, že v této session už proběhl skutečný serial `CMD_INFO` handshake (např. přijmout SysEx config push jen když je `DEVICE_INFO.serial` známé a sedí), a/nebo vyžadovat přesnou shodu jména zařízení místo substring matche. Dlouhodobě: SEC-001 fix je nutný stejně tak — port-name matching nikdy nebude bezpečnostní hranice.
- **Náročnost:** M ⚠️ (dotýká se SysEx trust modelu)

#### SEC-002 — `validate()` přijme non-numerické `cc`/`channel` hodnoty (asymetrické vůči přísné firmware `int()` validaci)
- **Osa:** Bezpečnost
- **Závažnost:** P1
- **Co:** `validate()` (3665–3701) kontroluje rozsahy prostými relačními operátory: `if (c.cc < 0 || c.cc > 127)` (3684) a `if (c.channel < 0 || c.channel > 15)` (3686). Pokud je `c.cc`/`c.channel` non-numerický string nebo `NaN` (např. z malformovaného importu — viz SEC-001), obě porovnání vyhodnotí `false` (`NaN < 0` i `NaN > 127` jsou `false`) — **žádná validační chyba se nevyvolá**, tlačítko Send zůstane aktivní. Firmware naopak (`ff_config.py:69-163`) dělá explicitní `int(...)` koerzi v try/except (`code.py` `apply_and_save_json`, 299-310) a celý config odmítne s `ERR:...:invalid` při selhání koerze.
- **Kde:** `feel-fader-app/feel-fader.html:3680-3688` (`validate()`) vs `feel-fader-firmware/ff_config.py:69-163`.
- **Proč to vadí:** Dokumentované tvrzení „cc clampnut 0–127, channel 0–15 na obou stranách" čte se jako symetrické chování; ve skutečnosti appka vůbec neclampuje (jen gatuje Send tlačítko) a i tahle brána má typovou díru, co propustí odpad nepovšimnutý, dokud neselže firmware round-trip (nebo hůř, dokud se to nevyrenderuje — SEC-001).
- **Doporučení:** Přidat `Number.isFinite(c.cc)`/`Number.isFinite(c.channel)` kontrolu do `validate()` před porovnáním rozsahu, validovat i typy prvků `uacc_values`/`ks_notes`.
- **Náročnost:** S

---

## Quick wins

Vysoký dopad / náročnost S:

- **DOC-001, DOC-002** — 2× oprava pár řádků v dokumentaci, eliminuje riziko HW regrese (SysEx wedge).
- **DOC-005, DOC-006** — oprava jmen funkcí v obou CLAUDE.md (`_parse_banks`→`parse_banks`, odstranit `enc7` z app bulletu).
- **SEC-002** — přidat `Number.isFinite` kontrolu do `validate()` (app-only, netýká se protokolu).
- **D-1, D-2, D-5** — smazat 3 mrtvé funkce + 1 vestigiální guard + 1 nepoužitou CSS třídu.
- **D-6** — buď zapojit `unpack_presets_blob_v1`, nebo ji s testem smazat.
- **RH-1 až RH-4** — úklid 20+3 (app) a 2+2 (firmware) mergnutých/redundantních větví.

## Návrh úklidových vln

**Vlna 1 — bezpečné/nízkoriziko (žádná z těchto změn se nedotýká protokolu, kromě označených ⚠️):**
Doc opravy (DOC-001 až DOC-007), dead-code úklid (D-1 až D-6), branch cleanup (RH-1 až RH-5), `SEC-002` fix. `SEC-001` fix (sanitizace v `normalizeFwConfig` + `escHtml` na sincích) je app-only a technicky sem patří náročností, ale vzhledem k P0 závažnosti doporučuju ho neschovávat na konec vlny — řešit hned na začátku spolu s `SEC-002`.

**Vlna 2 — test coverage:**
`TC-1` (test harness pro appku — spustit všech 12 trackovaných probes jedním příkazem, zvážit přesun do `tests/`), `TC-4` (extrahovat/zpřístupnit `validate()`/`normalizeFwConfig()`/`serialRequest()`/`_readReply()` pro testy, pokrýt edge-case vstupy), `TC-3` (HID flag round-trip testy ve firmwaru), `TC-2` (dec7/enc7 round-trip test).

**Vlna 3 — větší strukturální/protokolové úvahy (⚠️ dotýkají se drátového protokolu nebo trust modelu — chtějí Frankovo rozhodnutí, ne automatický fix):**
- `SEC-003` — přepracovat SysEx trust model (gate na známé `DEVICE_INFO.serial`, přesná shoda jména). Nejvyšší riziko v téhle vlně vzhledem k P0.
- `PR-001` — rozhodnout, jestli SysEx read round-trip (`CMD_CHUNK`/`CMD_ACK`/`CMD_ERR`) doimplementovat, nebo protokol oficiálně zúžit jen na info-push a zablokovat mrtvou `CMD_W` příchozí větev.
- `PR-003` — sjednotit `faders`/hash/source aplikaci mezi serial a SysEx `CMD_INFO`, nebo doc opravit.
- `A-4` — vytáhnout firmware serial dispatch do `handle_serial_line()`/`handle_encoder_delta()`. Čistě interní refaktor (protokol beze změny), ale je to největší (`L`) položka celého auditu.
- `A-5` — sjednotit `parse_banks`/`normalize_web_config` duplicitní normalizační logiku.

Audit nenašel důvod pro rozdělení `feel-fader.html` do víc souborů nad rámec výše — jednosouborová architektura je vědomá volba (žádný build step) a žádný nález netvrdí, že jí samotné škodí; bolavá místa jsou konkrétní funkce (A-1/A-2/A-3), ne velikost souboru jako taková.
