# Feel Fader – UX audit po minimal redesignu (očima skladatele)

**Datum:** 2026-09-28 · **Auditovaný soubor:** `feel-fader.html`, větev `design/minimal`, HEAD `f71e1e6` · **Typ:** čistě diagnostika, bez zásahů do kódu
**Metoda:** živě na `http://localhost:8100/feel-fader.html` v headless Chrome (puppeteer-core) – 1440×900 a 1080×800, light + dark, navíc 960 px (okno vedle DAW na 1920px monitoru). Připojení simulováno interním stav-poke (`_midiState`/`_ffConnected`/`_serialPort`), žádný reálný serial/MIDI/SysEx. Skriptované ověření chování + cílené čtení kódu.
**Screenshoty a skripty:** `Documents/feel-fader-scratch-archiv/2026-09-28/ux-audit-minimal-screenshots/` (mimo repo).

> **Navazuje na** [UX audit 2026-09-25](feel-fader-ux-audit-2026-09-25.md) – jeho body F-1…F-4, C-1…C-7, K-1…K-7 jsou vyřešené a zde se znovu neuvádějí. Zaměření: (1) vizuální a interakční konzistence po minimal redesignu a iteraci 2026-09-28 (dvousloupcový desktop, karta Feel Fader, DM Mono, sdílené controly), (2) přívětivost – pojmy, rychlost běžných úkonů (nový bank, library setup, send), chybové stavy, onboarding.
>
> **Přiznaná omezení:** header ukazuje „MIDI blocked“ a Device & Settings „Firmware –“, protože zařízení je jen simulované (artefakt). Full-page screenshoty mají artefakty sticky headeru a sloupce – nálezy jsou ověřené na snímcích viewportu. Tooltip hlavičky sekce visel v headless snímcích po programovém `toggleSection()`; se skutečnou myší (hover, klik, odjetí, scroll, Esc) se to nepotvrdilo → není nález.

---

## 1. Executive summary

Dvousloupcový layout na 1440 px funguje: controller, Send i HUD zůstávají při scrollu editoru na místě, validační navigace po Send / Ctrl+S skočí na chybu, dark mode nemá rozbité plochy a stránka nehodila žádnou JS chybu. Pro skladatele ale redesign nechal (nebo odhalil) několik míst, kde se běžný úkon zadrhne:

1. **Nový bank je rozbitý výchozí stav.** „+“ vytvoří bank s „Expression“ na CC1 (nápověda pod polem: „Dynamics“) a „Dynamics“ na CC2 („Breath“), kanál se posune na Ch 4 a appka na nový bank vůbec nepřepne.
2. **Keyswitch mód schovává to podstatné.** Seznam nota → artikulace (s jmény z C-1) je v režimu Keyswitch až pod „Advanced“, zatímco v režimu Articulation je stejný seznam hlavní obsah sekce.
3. **Pod 1100 px se appka špatně používá vedle DAW.** Editor začíná až v 671 px pod fotkou a řádek „N changes · Review“ je uříznutý.
4. **Review před Send je vágní** („Bank 1: Expression mapping“ bez hodnot) a při současné změně počtu banků přejmenování úplně vynechá.

Konzistence: DM Mono se rozlezl i do prózových souhrnů, jeho lomená nula a pomlčka zhoršují čitelnost čísel a rozsahů not; formát kanálu/CC existuje ve čtyřech variantách.

**Verdikt:** žádné přepracování. 1 nález P1, 6 × P2 (většina malé zásahy), 6 × P3 hygiena.

---

## 2. Tabulka nálezů

| ID | Záv. | Osa | Název | Lokace |
|---|---|---|---|---|
| N-1 | **P1** | Rychlost / důvěra | Nový bank: protichůdné mapování, posunutý kanál, bez přepnutí | `addBank()` ~4569, výchozí banky ~2943 |
| N-2 | P2 | Skladatel | Keyswitch: seznam nota → artikulace schovaný v Advanced | `<summary>Advanced keyswitch settings` ~3618 |
| N-3 | P2 | Layout | < 1100 px: „N changes · Review“ uříznutý | `.stage-collapse>.stage{overflow:hidden}` ~369 |
| N-4 | P2 | Layout | < 1100 px: editor až pod fotkou (od 671 px) | jednosloupcový layout |
| N-5 | P2 | Důvěra | Review bez hodnot před/po, přejmenování se ztrácí | `configChangeItems()` ~3053 |
| N-6 | P2 | Chyby | Konflikt CC hlášený jen u prvního ovladače | `validate()` ~5002 |
| N-7 | P2 | Rychlost | Library picker ukáže 8 ze 14 knihoven bez náznaku scrollu | `.library-popover .quick-setup-menu` ~2129 |
| N-8 | P3 | Jazyk | Rozsah keyswitchů v DM Mono čte jako „C-2-B-2“ | `rollerSectionSummary()` ~2800 |
| N-9 | P3 | Konzistence | DM Mono v prózových souhrnech, lomená nula, 4 formáty Ch/CC | souhrny, HUD, preview, picker |
| N-10 | P3 | Konzistence | Karta Feel Fader: dvě „settings“, jeden přepínač v celé skupině, souhrn „–“ | ~2359–2375 |
| N-11 | P3 | Vizuál | Záře tlačítka na controlleru ořezaná do obdélníku | `#zone-macro` ~758 |
| N-12 | P3 | Konzistence | Dvě barevné tečky na tabu banku bez legendy | bank taby |
| N-13 | P3 | Drobnosti | Preview knihovny jen s počtem, dark „Enable Keyboard…“, focus ring u Browse | různé |

---

## 3. Detaily

### P1

#### N-1 – Nový bank: protichůdné mapování, posunutý kanál, bez přepnutí
**Ověřeno skriptem + screenshotem (`new-bank-selected.png`):** po `addBank()` zůstává `activeBank === 0`, přibude jen tab „Bank 4“. Po ručním přepnutí: L = „Expression · Ch 4 · CC1“ s nápovědou pod polem „Dynamics“, R = „Dynamics · Ch 4 · CC2“ s nápovědou „Breath“.
**Příčina:** `addBank()` zakládá `fader1:{cc:1, label:'Expression'}`, `fader2:{cc:2, label:'Dynamics'}` a `channel: bi%16`. Výchozí banky navíc mají „Expression“ na CC11 / CC12 / CC21 – popisek „Expression“ tak v každém banku znamená jiný CC a v Bank 1 je CC1 naopak „Dynamics“.
**Dopad na skladatele:** „Nový bank pro další nástroj“ je nejčastější úkon. Výsledek má jméno faderu, které neodpovídá tomu, co posílá; posunutý kanál může v DAW s filtrem kanálu nebo v Kontakt multi tiše minout stopu. Protože appka nepřepne, skladatel snadno začne upravovat Bank 1 v domnění, že je v novém banku.
**Doporučení:** nový bank = kopie mapování aktuálního banku (nebo Bank 1) včetně kanálu; popisky odvozené z `musicalCcName` (nebo prázdné → výchozí jméno). Po vytvoření `selectBank(nový)` a rovnou otevřít Library setup („Na jakou knihovnu je tenhle bank?“). Zvážit sjednocení výchozích banků 2 a 3. Probe: po „+“ je aktivní nový bank a popisek faderu odpovídá `musicalCcName(cc)`.

### P2 – workflow skladatele

#### N-2 – Keyswitch: seznam nota → artikulace schovaný v Advanced
V režimu Articulation je ROLLER ORDER (jméno + hodnota, drag) hlavní obsah sekce. V režimu Keyswitch je stejný seznam až pod sbaleným `Advanced keyswitch settings`; souhrn „Velocity · naming · manual order“ navíc slovem *naming* myslí konvenci C-2/C-1, ne jména artikulací. Pojmenování dvojklikem / F2 (C-1 z auditu 09-25) nemá žádnou vizuální nápovědu.
**Dopad:** po aplikaci LUX presetu skladatel nevidí, která nota je Legato a která Staccato, dokud neotevře „pokročilé“ – přitom je to hlavní informace keyswitch banku.
**Doporučení:** ROLLER ORDER vykreslit pod klaviaturou stejně jako u artikulací; v Advanced nechat jen Velocity a Note naming (přejmenovat souhrn na „Velocity · note naming“). Na řádku při hoveru tužka nebo nápověda „Double-click to name“.

#### N-3 – Pod 1100 px je „N changes · Review“ uříznutý
**Ověřeno:** 1080×800, reálné přejmenování banku psaním do pole → poznámka `bottom 666 px`, `.stage` končí na 655 px, text je vidět jen z horní poloviny (`1080-note.png`).
**Příčina:** `.stage-collapse>.stage{overflow:hidden}` (~369) a v jednosloupcovém režimu chybí spodní rezerva pro poznámku (dvousloupcový ji má – `padding-bottom:120px` ~341).
**Dopad:** jediný vstup do Review a textový signál neuložených změn je na úzkém okně nečitelný.
**Doporučení:** spodní padding `.stage` i v jednosloupcovém layoutu; `two-column-layout-probe` rozšířit o kontrolu clipu na 1080 px (dnes ji dělá jen pro 1100 a 1440).

#### N-4 – Pod 1100 px začíná editor až pod fotkou
**Ověřeno:** na 1080 i 960 px je `#settings-col` top = 671 px. První obrazovka je fotka controlleru, Send a HUD odtržený v levém horním rohu; z karty banku je vidět jen hlavička (`w960.png`).
**Dopad:** typické rozložení „DAW vlevo, configurator vpravo“ na 1920px monitoru = 960 px. Každá úprava znamená scroll přes ~600 px fotky a při scrollu zmizí controller s živou zpětnou vazbou. Přepínač „Controller“ v hlavičce to řeší, ale není objevitelný.
**Doporučení:** buď posunout dvousloupcový layout níž (≈ 900 px s menším controllerem), nebo v jednom sloupci controller automaticky zmenšit (scale ~0,6) a HUD dokovat vedle něj.

#### N-5 – Review bez hodnot před/po, přejmenování se ztrácí
**Ověřeno:** změna CC Expression, přepnutí rolleru na Keyswitch, přejmenování Bank 2 → „Horns“ a přidání banku dá seznam: `Banks: 3 → 4 · Bank 1: Expression mapping · Bank 1: Roller · Bank 1: articulations / keyswitches · Bank 4: new bank`. Přejmenování chybí.
**Příčina:** `configChangeItems()` (~3053) hlásí přejmenování jen jako `else if` za změnou počtu banků („Bank order or names“); položky mapování nenesou hodnoty. Jedno přepnutí módu dá 2 položky (Roller + articulations / keyswitches), protože se automaticky doplní rozsah not.
**Dopad:** před Send chce skladatel ověřit „CC11 → CC7“, ne číst kategorie; přejmenování, které se pošle do zařízení, v přehledu není.
**Doporučení:** hodnoty před → po („Expression CC11 → CC7“, „Roller: Articulation → Keyswitch“, „Bank 2 renamed → Horns“); přejmenování vyhodnocovat per bank nezávisle na počtu; automatické doplnění rozsahu při změně módu sloučit do jedné položky.

#### N-6 – Konflikt CC hlášený jen u prvního ovladače
**Ověřeno:** Dynamics přepnuto na CC11 (stejné jako Expression) → červená tečka i text chyby jen u Expression, v HUD červeně L. V otevřené sekci Dynamics, kterou skladatel právě upravuje, není nic. Send navede na Expression (`err-cc-conflict*.png`).
**Příčina:** `validate()` (~5002) vloží chybu jen pro `ctrls[a]` (první z dvojice).
**Doporučení:** chybu vložit pro oba ovladače s textem z pohledu každého („Same CC as Expression“ / „Same CC as Dynamics“); navigace na ten, který se měnil naposledy.

#### N-7 – Library picker ukáže 8 ze 14 knihoven bez náznaku scrollu
**Ověřeno:** `LIBRARY_PRESETS` má 14 položek, popover (`max-height:310px`, ~2129) jich ukáže 8. Pod okrajem je LUX Basses a všech 5 presetů Spitfire Symphony Orchestra; pořadí míchá Spitfire → Sonuscore → Spitfire, SSO Violins 1 je až poslední.
**Dopad:** skladatel s SSO jeho presety vůbec neuvidí, pokud nezačne psát do hledání.
**Doporučení:** nadpisy skupin podle výrobce (Spitfire / Sonuscore), řazení v rámci skupiny, vyšší `max-height` (14 řádků se na 900 px vejde) a spodní fade maska jako náznak dalšího obsahu.

### P3 – konzistence po redesignu

#### N-8 – Rozsah keyswitchů v DM Mono čte jako „C-2-B-2“
Souhrn sekce (`rollerSectionSummary()` ~2800) a HUD skládají rozsah jako `C-2–B-2` s en-dash; v monospace vypadá en-dash stejně jako minus u záporné oktávy. Totéž v pickeru „Keyswitch C-1–A#-1“.
**Doporučení:** oddělovač, který nejde zaměnit: „C-2 → B-2“ nebo „C-2 to B-2“; stejně v pickeru a HUD.

#### N-9 – DM Mono v prózových souhrnech, lomená nula, čtyři formáty Ch/CC
- DM Mono kreslí přeškrtnutou nulu: hodnoty v ROLLER ORDER „2Ø“, „1Ø“, velocity „1ØØ“, klaviatura „CØ“. Pro hudebníka to působí jako kód a „CØ“ se čte špatně.
- Mono je i na prózových souhrnech „17 articulations“, „No articulations“, „Keyboard off“.
- Formát kanálu/CC: „Ch 1 · CC11“ (hlavičky sekcí), „Ch1·CC11“ (HUD), „CC 32“ (preview knihovny), „UACC · CC32“ (picker).

**Doporučení:** mono jen pro technické tokeny (Ch/CC, noty), prózu v Mulish. Ověřit, zda vložená sada DM Mono nese alternativní nulu; jinak čísla v Mulish s `font-variant-numeric: tabular-nums`. Sjednotit na „Ch 1 · CC11“ a hlídat v `design-consistency-probe`.

#### N-10 – Karta Feel Fader: dvě „settings“ a prázdné souhrny
- „Application settings“ je celá sbalovací skupina pro jediný přepínač (Live monitor); druhá volba zobrazení („Controller“) je v hlavičce.
- „Application settings“ vedle „Device & Settings“ – dvakrát „settings“.
- Souhrn „–“ u Device & Settings bez zařízení nic neříká; „Bank actions“ opakuje jméno banku, popisky řádků „Copy → Duplicate“ duplikují text tlačítka.

**Doporučení:** „Device & Settings“ → „Device“, souhrn „Not connected“ / „Firmware 1.3.0“; volby zobrazení (Live monitor, Controller) na jedno místo.

#### N-11 – Záře tlačítka na controlleru ořezaná do obdélníku
`#zone-macro{clip-path:inset(-24px -24px -24px 0)}` (~758), ale třetí vrstva `box-shadow` sahá ~49 px (32 + 17). Při otevřené sekci Button je u pravé hrany controlleru vidět ostrý zelený obdélník – v dark výrazně, v light slabě (`glow-dark.png`). V onboardingu to nenastává.
**Doporučení:** inset rozšířit na ~−50px (plochá strana zůstává 0), nebo zmenšit spread poslední vrstvy.

#### N-12 – Dvě barevné tečky na tabu banku
Validační chyba = červená tečka vlevo od jména, bank aktivní na zařízení = zelená tečka vpravo („• Bank 1 •“). Liší se jen barvou a pozicí, bez legendy.
**Doporučení:** chybu značit symbolem „!“ nebo červeným podtržením, tečky nechat jen pro stav zařízení.

#### N-13 – Drobnosti
- Preview knihovny ukazuje jen počet („15 UACC articulation values“); seznam jmen (prvních ~6 + „+9 more“) by ušetřil apply → otevřít sekci → undo.
- Dark mode: „Enable Keyboard…“ v HID upozornění nemá viditelnou plochu tlačítka (v light ano).
- Focus ring „Browse…“ po zavření preview překrývá slovo „setup“.

---

## 4. Doporučené pořadí

**Sprint A – rychlé úkony a důvěra:** N-1 (nový bank), N-3 (clip poznámky + probe), N-6 (konflikt CC u obou), N-5 (Review s hodnotami).
**Sprint B – workflow:** N-2 (keyswitch seznam), N-7 (picker), N-4 (layout pod 1100 px – rozhodne Frank vizuálně).
**Sprint C – hygiena:** N-8 až N-13 v jednom průchodu, s rozšířením `design-consistency-probe` o formát Ch/CC a mono jen na tokenech.

---

## 5. Co funguje (neměnit)

- Dvousloupcový desktop na 1440 px: controller, Send i HUD drží místo při scrollu editoru, HUD slot neposouvá controller.
- Validační navigace po Send i Ctrl/⌘+S skočí na chybné pole; prázdný seznam artikulací má jasnou chybu přímo u pole a „No articulations“ v souhrnu.
- Bank actions mají čitelnou gramatiku Settings (popisek + pill), Delete je outline + danger a ptá se.
- HID upozornění s akcí „Enable Keyboard…“ přímo v kontextu (Navigation, Button).
- Dark mode parita bez rozbitých ploch; řez písma je v obou režimech stejný (400/700).
