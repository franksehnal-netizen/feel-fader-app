# Sticky bank bar — design (varianta B)

**Datum:** 2026-07-09
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu / formátu configu → firmware se netýká, repa oddělená.
**Kontext:** Frankův požadavek — mít *konstantně na očích, kterou banku edituji*. Návrh probrán jako mini-design (varianty V1/V2 tabů + koexistence se sticky stage A/B/C). Rozhodnuto: **V2 taby + koexistence B**. Cílová platforma primárně **desktop** (dost výšky).

## Cíl

Persistentní „která banka" jako **sticky pruh pod headerem**, který se nescrolluje pryč — zároveň zůstane zachovaná stávající sticky stage (zařízení + fadery + send parkují při scrollu). Uživatel při editaci vidí naráz: aktivní banku (lišta) i živé fadery + send (parkoviště).

## Kritérium úspěchu

Na desktopu, po odscrollování do editační plochy:
1. Pod headerem je vidět **slim bank lišta** s aktivní bankou (číslo + ikona + název) a ostatními taby (číslo + ikona); nescrolluje pryč.
2. Přepnutí banky v liště: aktivní tab se **plynule** roztáhne (získá název), bývalý smrskne — bez poskočení.
3. **Parkoviště** (spodek zařízení + fadery + send pilulka) zaparkuje **hned pod lištou**, bez překryvu a bez mezery; scroll-driven dojezd zůstává plynulý.
4. Živé fadery (T4) jsou při editaci dál vidět a tahatelné.
5. Na úzké obrazovce (mobil) layout nekolabuje — park se zkompaktní/vypne (viz Mobil).

## Varianta tabů (V2)

- **Aktivní tab:** `index · ikona · název` (např. `1 🎹 Bank 1`) — světlý chip (`--bg-card` light / lifted `#3a3a3c` dark), plná sytost textu.
- **Neaktivní tab:** `index · ikona` (např. `2 🎸`); když banka ikonu nemá → jen `index`. Ztlumené (`--t3`), transparentní.
- **Přepnutí:** animovaná **šířka + opacity** názvu (aktivní roztažení / bývalý smrsknutí) ~.18–.22s ease — stejný „seamless" princip jako T3. Žádný layout jump v liště.
- Live-bank tečka (C5) a scroll-fade přetékajících tabů (S9) se přenesou z dnešní karty do lišty.

## Umístění a styl lišty

- Nový prvek `.bank-bar` (kontejner pro `#bank-tabs`), `position:sticky; top:<výška headeru>; z-index:49` (pod headerem `z-50`, nad stage `z-40`; pod sync bannerem `z-250`).
- Frosted podklad jako header (`backdrop-filter:blur(...)`, poloprůhledné bg light/dark), hairline dole. Slim vertikální padding (~6px).
- Taby vlevo, horizontálně scrollovatelné při přetečení (`overflow-x:auto`, skryté scrollbary — jako dnes); aktivní tab `scrollIntoView` při přepnutí (mechanika už existuje v `renderBankTabs`).

## Přesun tabů z karty (jeden zdroj pravdy)

- Dnešní `.bank-block` (taby + divider + name-area, [feel-fader.html:1117-1122](../../feel-fader.html)) se **rozdělí**: taby jdou do sticky `.bank-bar`; **editovatelný název/ikona/tagy** (`#bank-name-area`) se stanou **vrškem obsahové karty** (`panels-row`/`.bank-card`).
- V liště je název banky **read-only indikátor** (jen aktivní). V kartě zůstává **editovatelné pole** (rename, icon picker, tagy). Dvě místa, dvě role — nepletou se.
- `renderBankTabs` renderuje nově do `.bank-bar`; `selectBank`, PC handler (0xC0 → bank sync, [feel-fader.html:2519-2528](../../feel-fader.html)) a live-bank tečka dál volají tentýž render → beze změny logiky, jen jiný cíl v DOM.
- T3 `bankFade` (name + card při přepnutí) zůstává na `.bank-block-name` + `.bank-card`; taby v liště mají vlastní width/opacity animaci.

## Přeladění parkoviště (stage)

- `.stage` zůstává `position:sticky` + scroll-driven `stageSettle` ([feel-fader.html:95-124](../../feel-fader.html)).
- Přeladit tak, aby stage zaparkovala **hned pod `.bank-bar`**, ne pod header: `top` (dnes `-348px` / `-408px` v scroll-driven bloku) a `animation-range` (dnes `457px 640px`) se posunou o výšku lišty (a znovu se ověří landing, protože park závisí na výšce lišty).
- Cíl: send pilulka + fadery přesně navazují pod lištou, bez mezery/překryvu, plynulý ease dojezd (kompozitor, žádný JS ve scroll dráze — poučení z 2026-07-03: nic JS ve scroll dráze).

## Mobil (levná pojistka)

- Media-query na úzké obrazovce: park **zkompaktnit nebo vypnout** (stage neparkuje / parkuje jen minimálně) → na telefonu se B chová spíš jako C (jen header + slim lišta), aby tři patra neukusovala výšku. Lišta zůstává slim.
- Není cílem plná mobilní parita — jen aby layout nekolaboval při Frankově testování.

## Co zůstává beze změny

- Send tlačítko = velká centrovaná pilulka v parkující stage (B ho **nepřesouvá** do lišty).
- Protokol, formát configu, `enc7/dec7`, firmware — netýká se.
- Live fader batching (T4), bankFade (T3), theme cross-fade, ghost fixy — beze změny.

## Ověření

- **Headless se scrollem** (puppeteer) na ≥2 výškách viewportu: po scrollu je `.bank-bar` přilepená pod headerem; `.stage` zaparkovaná **těsně pod lištou** (změřit gap = 0, žádný překryv); aktivní tab viditelný.
- Přepnutí banky (klik + simulovaný PC) → aktivní tab s názvem, plynulá šířková animace, žádný jump; live-bank tečka a scroll-fade fungují.
- Live CC flood (T4) → fadery se hýbou i po scrollu (parkoviště).
- Vizuální kontrola light + dark; mobilní media-query (úzký viewport) nekolabuje.
- Regrese: send pilulka funguje, dirty hint, sync banner nad vším.

## Mimo rozsah

- Konsolidace send do lišty (to byla varianta C — zamítnuta).
- Plná mobilní optimalizace parkoviště (jen pojistka proti kolapsu).
- Stavový model připojení a další Wave 3 položky — samostatné.

## Závislost / timing

Nezávisí na HW testu (app-only, layout). Implementovat **až po večerním HW testu Vlny 3a**, aby se netestovaný sticky layout nemíchal do testované verze. Samostatná větev nad `main` po mergi Vlny 3a.
