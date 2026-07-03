# Feel Fader — Produktový audit v2: intuitivnost & seamless experience (prompt)

> Vlož celý tento soubor jako zadání agentovi (Claude Code s přístupem k oběma repům).
> Audit je **čistě diagnostický** — agent nesmí měnit žádný soubor v žádném repu.
> Výstupem je report + prioritizovaný backlog návrhů, o kterých rozhodne majitel.

---

## Role

Jsi **senior product designer + interaction engineer s Apple sensibility** — někdo, kdo posuzuje produkt jako celek: hardware, firmware chování i web UI jako jeden zážitek. Nehodnotíš jen „jak appka vypadá", ale **jak se celý produkt používá od vybalení po každodenní práci v DAW**.

Pracuješ jako kritik, ne implementátor. Buď konkrétní, ne zdvořilý. Cíl není pochválit — cíl je najít každé místo, kde uživatel zaváhá, tápe, čeká bez zpětné vazby, nebo kde se produkt chová jinak, než čekal.

---

## Cíl

**Absolutní intuitivnost a seamless experience.** Měřítko úspěchu:

- Uživatel **nikdy netápe, co dělat dál** — každý stav má zřejmý další krok.
- **Nulová mentální mezera mezi webem a zařízením** — co vidím v appce, to dělá hardware, a naopak; sync je neviditelný.
- **Každá akce má okamžitou, srozumitelnou odezvu** — na webu i na zařízení.
- Pokročilé featury (Keyswitch, Navigation, HID, macro) jsou **objevitelné bez manuálu**, ale nepřekáží základnímu flow (nastav CC → hraj).
- První 5 minut s produktem = žádný moment „a co teď?".

---

## Kontext produktu

**Feel Fader** = hardwarový MIDI kontrolér (2 fadery + roller/enkodér + tlačítko) pro orchestrální/DAW workflow. Dva trvale oddělené repozitáře:

| Repo | Cesta | Obsah |
|---|---|---|
| **App** | `c:\Users\Fanda Borec\Documents\feel-fader-app` | `feel-fader.html` — jednosouborový web konfigurátor (~3 000+ řádků, vanilla JS, žádný build). Web MIDI + Web Serial. |
| **Firmware** | `c:\Users\Fanda Borec\Documents\feel-fader-firmware` | CircuitPython na Raspberry Pi Pico (RP2040): `code.py` (~630 ř.), `boot.py` (DEV/PROD mód, HID descriptor), `ff_config.py`, `presets.json`, `tests/`. |

**Funkce zařízení:** 2 fadery (CC, per-control MIDI kanál), roller ve 3 módech — `cc` (UACC artikulace), `keyswitch` (note range), `track_nav` / „Navigation" (HID klávesy, gated na HID enable), tlačítko = cyklení bank (short press) + volitelné HID macro (long press). Banky (max 8) se konfigurují ve web appce a syncují přes SysEx/serial protokol (`CMD_W/R/INFO/CHUNK/ACK/ERR/HID`, enc7/dec7).

**Povinné čtení před startem (v tomto pořadí):**
1. `feel-fader-app/CLAUDE.md` + `feel-fader-firmware/CLAUDE.md` — pravidlo spřažení app↔firmware a protokolová tabulka.
2. `feel-fader-app/WEBAPP.md` — mapa appky. ⚠️ **Stav k 2026-06-27 — je zastaralý.** Nepopisuje: Roller módy (keyswitch/track-nav), HID toggle, button macro, Help & Guide, sloučený „Device & Settings" panel, welcome „Start" flow v aktuální podobě. Pro nové featury je zdroj pravdy `git log` + kód.
3. `feel-fader-app/docs/feel-fader-ux-audit-2026-06-27.md` — **předchozí audit, včetně statusu co je opraveno a co bylo záměrně DROPnuto.** Neopakuj vyřešené nálezy; DROP položky (I1 fader affordance, V5 stíny, V6, I3, A6) znovu neotvírej, pokud nemáš nový argument.
4. `feel-fader-app/docs/superpowers/specs/2026-07-01-feelfader-ux-pass-design.md` — poslední UX pass (11 bodů, implementováno). Ber jako baseline, ne jako otevřené téma.
5. `feel-fader-firmware/code.py`, `boot.py`, `ff_config.py` — chování zařízení.

---

## Co je NOVÉ od posledního auditu (primární terén tohoto auditu)

Tyto oblasti vznikly po 27. 6. a **nikdy neprošly UX auditem**:

1. **Roller módy** — přepínání CC / Keyswitch / Navigation, keyswitch range editor (dual slider + steppery + presety), mode-aware titul/badge.
2. **HID vrstva** — HID enable toggle (bez rebootu), gating Navigation módu a macra na HID, key-capture widgety (CW/CCW/invert, macro long-press).
3. **Button macro (long-press)** — konfigurace, capture, odeslání.
4. **Help & Guide** — collapsible statický text.
5. **Device & Settings** — sloučený panel (Device info + HID + macro + export/import/reset + JSON preview).
6. **Welcome „Start" flow** — auto-vstup vs. Start tlačítko vs. skip, serial grant, fallback timer.
7. **Firmware chování** — bank cycling tlačítkem, snapshoty při změně banky, rate-limit 8 ms, interpolace faderů, track-nav burst limit, DEV/PROD boot (držení tlačítka při připojení USB).

---

## Metoda

### A) Web app — reálný render
Spusť `feel-fader.html` v Chrome/Edge (headless render OK) a projdi + oscreenshotuj:

1. Welcome idle → skip → hlavní UI (light i dark)
2. Roller ve **všech třech módech** — včetně keyswitch editoru a Navigation s HID off (gated stav!) i HID on
3. Key-capture flow (nav klávesy, macro) — co vidí uživatel během capture, jak zruší, co když stiskne nesmysl
4. Device & Settings rozbalený — HID toggle oba stavy, macro řádek, export/import/reset
5. Help & Guide — odpovídá obsah aktuálním featurám? Najde ho uživatel, když tápe?
6. Bank flow — přidání, přejmenování, ikona, tagy (návrhy z historie), smazání, max 8 bank
7. Edge stavy: dlouhé labely, plný počet bank, prázdný UACC seznam, keyswitch krajní range
8. Úzké okno (~360 px)
9. Dirty stav / send flow bez zařízení

### B) Cross-device flow — z kódu (přiznaný limit)
Stavy vyžadující hardware (connect transition, live fadery, sync, bank cycling odezva) hodnoť z kódu obou rep. Každý takový nález označ `zdroj: kód`. Zaměř se na **švy**:

- Co se stane, když uživatel změní banku **na zařízení**, zatímco má v appce rozeditovanou jinou? (`liveBank` vs `activeBank`)
- Co se stane při odpojení uprostřed práce / uprostřed send? Recovery flow?
- Je dirty stav pravdivý? (localStorage vs. NVM zařízení — kdy se rozjedou a pozná to uživatel?)
- Round-trip: pošlu config → přepnu banku na HW → odpovídá to, co vidím v appce?
- První použití: kolik gest/potvrzení dělí uživatele od „fader hýbe parametrem v DAW"?

### C) Firmware jako součást UX — z kódu
- Latence a pocit: rate-limit, interpolace, ADC filtrace — jsou defaulty správně pro „seamless" pocit? Jsou konfigurovatelné tam, kde mají být?
- Zpětná vazba zařízení: pozná uživatel bez pohledu na web, jaká banka je aktivní / jaký mód roller má? Pokud ne, je to přiznaný hardwarový limit — navrhni, jak to kompenzovat v appce.
- Chybové cesty: co dělá zařízení při corrupted NVM configu, neplatném CMD_W, HID bez descriptoru?
- DEV/PROD mód — je pro koncového uživatele bezpečný/nepřekvapivý?

Při každém nálezu **dohledej příčinu v kódu** (soubor + řádek / funkce), aby byl akční.

---

## Rubrika

Použij **schválenou rubriku z auditu 2026-06-27** (redukce, 4px grid, omezená paleta + jeden akcent, max 6 velikostí / 3 váhy písma, deference, klid, preciznost, navržené stavy, a11y ≥4.5:1 + focus + 44px touch). Nezřizuj novou — jen ji **rozšiř o osy seamlessness**:

- **R11 — Kontinuita:** stav app ↔ stav zařízení se nikdy tiše nerozjede; každá desynchronizace je viditelná a má jednoklikovou opravu.
- **R12 — Odezva:** každá akce má odezvu < 100 ms (aspoň optimistickou), delší operace mají průběh.
- **R13 — Progressive disclosure:** základní flow (CC + kanál + send) nevyžaduje pochopení HID/keyswitch/maker; pokročilé featury se odhalují, až když jsou relevantní.
- **R14 — Obnovitelnost:** z každého chybového/přerušeného stavu vede zřejmá cesta zpět bez ztráty práce.

---

## Formát nálezu (povinný)

```
### [ID] — Krátký název
- **Osa:** Vizuální jazyk | Interakce & flow | Cross-device seamlessness | Stavy & edge cases | A11y & responzivita | Firmware UX
- **Závažnost:** P0 | P1 | P2 | P3
- **Co:** stručný popis
- **Kde:** repo + soubor + řádek/funkce (+ stav)
- **Proč to vadí:** proti kterému bodu rubriky (R1–R14) to jde
- **Doporučení:** konkrétní cílový stav (ne „zlepšit", ale co přesně)
- **Náročnost:** S (minuty) | M (hodiny) | L (dny) — a zda se dotýká drátového protokolu (⚠️ pak nutná změna OBOU rep)
- **Zdroj:** render (screenshot) | kód (řádek)
```

P0 = blokuje/vážně mate · P1 = poškozuje dojem, opravit · P2 = znatelná nedokonalost · P3 = kosmetika.

---

## Výstup

Markdown report `docs/feel-fader-product-audit-2026-07-03.md` (v app repu):

1. **Executive summary** — 3–5 vzorců (ne jednotlivostí) + celkové hodnocení vzdálenosti od cíle „absolutní intuitivnost".
2. **User journey mapa** — první použití → denní práce → power-user; u každé fáze momenty tření seřazené podle závažnosti.
3. **Tabulka nálezů** — P0 nahoře; sloupce ID, osa, závažnost, náročnost, protokol ⚠️.
4. **Detaily nálezů** — plný formát, seskupené po osách.
5. **Quick wins** — vysoký dopad / náročnost S.
6. **Návrh 3 vln implementace** — Vlna 1: quick wins + P0/P1; Vlna 2: cross-device seamlessness; Vlna 3: větší koncepční návrhy. U každé vlny odhad rozsahu a rizika.

**Žádné zásahy do kódu ani protokolu. Pouze diagnostika a návrhy.** O implementaci rozhodne majitel triáží nad reportem (stejný proces jako 27. 6.).
