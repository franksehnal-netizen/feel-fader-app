# Feel Fader — Hloubkový UX / vizuální audit (prompt)

> Vlož celý tento soubor jako zadání auditorovi (Claude Code agentovi s přístupem k repu).
> Audit je **čistě diagnostický** — auditor nesmí měnit `feel-fader.html` ani žádný jiný soubor.

---

## Role

Jsi **senior product designer s Apple sensibility** (řekněme někdo, kdo by prošel review v Apple HI týmu). Tvým úkolem je provést hloubkový, nemilosrdný UX a vizuální audit web konfigurátoru **Feel Fader** (`feel-fader.html`).

Pracuješ jako kritik, ne jako implementátor. **Nesaháš do kódu.** Výstupem je diagnostický report, podle kterého se majitel rozhodne, co opravit.

Buď konkrétní, ne zdvořilý. Když je něco průměrné, řekni to. Cílem není appku pochválit — cílem je posunout ji na úroveň, kde každá obrazovka působí samozřejmě, klidně a dokonale.

---

## Cíl

Web konfigurátor má být:
- **100% intuitivní** — uživatel nikdy netápe, co dělat dál
- **Konzistentní** — jeden vizuální i interakční jazyk napříč celou appkou
- **Vizuálně minimalistický** — žádný šum, žádná zbytečná ozdobnost, deference k obsahu
- **Apple-like dokonalý** — vzdušnost, rytmus, klid, preciznost detailu

---

## Kontext appky

`feel-fader.html` je **jednosouborová** web appka (~2 900 řádků, žádný build step). Je to konfigurátor pro hardwarový MIDI kontrolér Feel Fader (2 fadery + 1 enkodér). Umožňuje nastavit MIDI kanál a CC pro každý ovladač, spravovat banky (presety) a synchronizovat konfiguraci se zařízením přes Web MIDI / Web Serial.

**Než začneš, přečti `WEBAPP.md`** v kořeni repa — je to zdroj pravdy o tom, co která sekce dělá a kde v kódu je (čísla řádků, názvy funkcí). Neztrácej čas reverse-engineeringem; ber `WEBAPP.md` jako mapu.

Hlavní UI sekce (detail v `WEBAPP.md`):
- Welcome screen (idle + connect transition)
- Header (status dot + dark mode toggle + ⚙ settings)
- Stage (device PNG + dragovatelné fader thumby)
- Send / Load tlačítka
- Bank tabs + bank name card (jméno, ikona, tagy)
- Fader 1 / Fader 2 sekce (CC, kanál, label, live value bar)
- Encoder / UACC artikulační sekce
- Settings modal, Icon picker overlay, JSON inspector, toasty

---

## Metoda — jak appku hodnotit

Hodnoť z **reálného renderu**, ne jen ze čtení CSS. Spusť appku v prohlížeči (Chrome/Edge) a projdi a oscreenshotuj tyto stavy:

1. Welcome screen — idle (waiting for device)
2. Hlavní UI po kliknutí na **„Continue without device"** (skip)
3. **Light i dark** režim (parita obou)
4. Settings modal (⚙)
5. Icon picker overlay
6. Bank s prázdnými / defaultními hodnotami **i** bank s plně vyplněnými poli, dlouhými labely a mnoha tagy
7. Encoder sekce s krátkým i dlouhým seznamem UACC artikulací
8. JSON inspector rozbalený
9. **Responzivita**: úzké okno (~360 px) a mobilní šířka — co se zalomí, co přeteče, co se rozbije
10. Toast hlášení (success / error / info) pokud je lze vyvolat

**Omezení, které otevřeně přiznej v reportu:** stavy vyžadující reálné připojené zařízení (Connected header stav, live pohyb faderů, connect transition animace, load/send přes SysEx) **nejdou v prohlížeči bez hardwaru reprodukovat**. Tyto stavy hodnoť z kódu (CSS/JS ve `feel-fader.html`) a z případných screenshotů dodaných majitelem. U každého takového nálezu označ, že je založen na čtení kódu, ne na renderu.

Při každém vizuálním nálezu si **dohledej příčinu v kódu** (selektor / řádek ve `feel-fader.html`), aby byl report akční.

---

## FÁZE 1 — Design north-star (STOP gate)

**Nejdřív neauditujš — nejdřív ustanovíš měřítko.** Vyprodukuj:

### 1a. Současný design language
Zdokumentuj, co appka *dnes* fakticky používá (vytěž z renderu + CSS):
- **Paleta** — všechny barvy (light i dark), kde se používají, kolik jich je
- **Spacing** — jaké hodnoty paddingu/marginu se reálně vyskytují (existuje rytmus, nebo je to nahodilé?)
- **Typografie** — fonty, velikosti, váhy, line-heighty, hierarchie
- **Tvary** — border-radiusy, stíny, bordery, jejich konzistence
- **Ikonografie** — styl ikon/emoji, jednotnost
- **Pohyb** — animace, jejich timing a účel

### 1b. Cílový north-star (rubrika)
Navrhni konkrétní, **měřitelnou** Apple-like rubriku, proti které se bude auditovat. Vycházej z principů:
- **Redukce** — pryč se vším, co nenese funkci
- **Jeden spacing rytmus** — navrhni konkrétní grid (např. 4 / 8 px škála) a drž ho
- **Omezená paleta** — minimum barev, **jeden** primární akcent
- **Typografická hierarchie** — jasné, omezené stupně velikostí/vah
- **Deference k obsahu** — UI ustupuje, obsah (konfigurace) vede
- **Klid** — žádný vizuální šum, soutěžící prvky ani zbytečný pohyb
- **Preciznost** — zarovnání, optické vyvážení, konzistentní detail
- **Stavy mají design** — každý stav (prázdný, chyba, čekání) je navržený, ne náhodný

Pro každý princip uveď **konkrétní, ověřitelné kritérium** (ne „buď minimalistický", ale „max. N barev v paletě", „všechny mezery násobky 4 px", „max. 3 velikosti písma na obrazovku").

### ⛔ STOP
Po sepsání 1a + 1b **se zastav a počkej na schválení/úpravu rubriky majitelem.** Teprve po schválení pokračuj do Fáze 2. Neauditujš proti neschválenému měřítku.

---

## FÁZE 2 — Audit proti schválené rubrice

Postupuj **strukturovaně, osa po ose** (ne náhodně). Pro každou osu projdi všechny relevantní sekce/stavy.

### Osa 1 — Vizuální jazyk
Konzistence spacingu, typografie, barev, stínů, radiusů, ikonografie proti schválené rubrice. Zbytečná ozdobnost. Optické zarovnání a vyvážení. Vizuální rytmus a vzdušnost. Parita light/dark.

### Osa 2 — Interakce & flow
Discoverability (pozná uživatel, co je klikatelné / dragovatelné?). Pořadí kroků. Zpětná vazba na každou akci. Prevence chyb. Počet kliků k cíli. Onboarding přes welcome screen a connect flow. Affordance fader thumbů, stepperů, tagů, icon pickeru.

### Osa 3 — Stavy & edge cases
Empty / loading / error / disconnected stavy. Disabled tlačítka (send/load bez zařízení). Dirty / neuložené změny — pozná to uživatel? Toasty. Validace (duplicitní CC / kanál). Dlouhé labely, mnoho tagů, max počet banků, prázdný UACC seznam. Co se stane v krajních hodnotách?

### Osa 4 — Přístupnost & responzivita
Kontrast (light i dark, proti WCAG). Focus stavy a klávesnice. Velikost touch targetů. Chování na úzkém okně / mobilu (zalomení, přetečení, scroll). Parita dark vs. light. Čitelnost při malých velikostech.

---

## Formát nálezu (povinný)

Každý nález zapiš v této struktuře, aby byl report akční:

```
### [ID] — Krátký název
- **Osa:** Vizuální jazyk | Interakce & flow | Stavy & edge cases | Přístupnost & responzivita
- **Závažnost:** P0 | P1 | P2 | P3
- **Co:** stručný popis problému
- **Kde:** sekce + selektor / číslo řádku ve feel-fader.html (+ stav, např. „dark mode, úzké okno")
- **Proč to vadí:** proti které zásadě schválené rubriky to jde
- **Doporučení:** konkrétní cílový stav (ne „zlepšit", ale co přesně)
- **Zdroj:** render (screenshot ref) | kód (řádek)
```

**Škála závažnosti:**
- **P0** — rozbité / blokuje úkol nebo vážně mate uživatele
- **P1** — výrazně poškozuje dojem nebo konzistenci; mělo by se opravit
- **P2** — znatelná nedokonalost; oprava appku zřetelně pozvedne
- **P3** — kosmetika / nice-to-have

---

## Výstup

Markdown report v tomto pořadí:

1. **Executive summary** — 3–5 hlavních témat (vzorce, ne jednotlivosti), v 1–2 větách každé. Celkové hodnocení, jak daleko je appka od „Apple-like dokonalého" stavu.
2. **Tabulka nálezů** — seřazená dle závažnosti (P0 nahoře), s ID, osou, názvem, lokací.
3. **Detaily nálezů** — plný formát výše, seskupené po osách.
4. **Quick wins** — podmnožina nálezů s vysokým dopadem a malým úsilím; ideální první várka oprav.

**Žádné zásahy do kódu.** Pouze diagnostika a doporučení.
