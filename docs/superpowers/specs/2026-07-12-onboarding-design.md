# Onboarding — guided first-run (design)

**Datum:** 2026-07-12
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu/firmwaru.
**Varianta:** C (hybrid) — orientace kartami, pak lehká inline vrstva. Ne coach-tour se step-enginem.

## Kontext

Poslední kus Vlny 3. Po „Continue without device" přistane návštěvník (typicky bez HW na public demu / GitHub Pages) na husté konfigurační ploše se 3 default banky a nulovou orientací. On-demand „?" help (`toggleHelp`/`openHelpAt` + Help & Guide panel) existuje, ale je sbalený dole — objevíš ho, jen když ho hledáš.

Cíl: udělat appku srozumitelnou cizímu člověku. Dvě publika, sekvence pro obě:
1. **Návštěvník bez HW** (Pages demo) — pochopit, co Feel Fader je a co vidí.
2. **Tester s HW** (Slávi, Keith) — rychle pochopit, jak nastavit banky/fadery/roller módy.

## Zjištěný stav kódu (na čem se staví)

- **Welcome screen** (`#welcome-screen`, fixed overlay): `.welcome-device` (obrázek + dekorativní animované fadery, keyframes `welcome-fader-master/slave`), `.welcome-status` („Waiting for device"), `.welcome-title/-sub`, `.welcome-start` (Start), `.welcome-skip` („Continue without device"). Mechanika vstupu viz `WEBAPP.md` §3.1 / §5.2: first-run nemá schválený serial port → uživatel **vždy** vidí welcome (Start když HW, jinak skip).
- **Help & Guide panel** (`#help-body`, sbalený): bohatý text (Getting started, Banks & tags, Roller modes `#help-roller`, Keyswitch `#help-keyswitch`, Button macro `#help-macro`, HID, DEV/PROD `#help-dev`). `openHelpAt(id)` rozbalí a odscrolluje na sekci.
- **`.help-hint`** „?" kolečka u ovladačů → volají `openHelpAt`.
- **Connection state** (Vlna 3): `connState()` + `liveAllowed()` (`_midiState==='granted' && _ffConnected`) = kanonický zdroj, jestli tečou živá data. `renderConnState()` jediný render.
- **Fader pozice:** `pF(tid,thid,v)` pozicuje thumb z hodnoty 0–127 (HW cesta: `applyInfoFaders`/`flushFaderFrame`). Fadery jsou **display-only** (drag aparát odstraněn 2026-07-11).
- **localStorage konvence:** `ff-cfg`, `ff-dark`, `ff-serial-pid`.
- **i18n:** `TRANSLATIONS.en` + `t(key)` + `applyLang()` na `[data-i18n]`. EN-only.

## Cíl

First-run guided experience ve dvou fázích v sekvenci, větvení HW/no-HW přes `liveAllowed()`, maximální reuse existující infrastruktury. Jednou per browser, replay z Help panelu. Nikdy neposílá MIDI ani nefakuje živá data v HW cestě (drží display-only princip).

## Kritérium úspěchu

- **First-run bez HW:** welcome ukáže orientační beaty → po vstupu (skip) intro karta (no-HW copy) + pulzující „?" kotvy + dekorativní demo (fadery/roller) s odznakem „Demo"; klik na pulz rozbalí správnou help sekci.
- **First-run s HW:** welcome beaty → po connectu intro karta (HW copy), **žádná** demo animace, pulzy navádějí na reálné ovladače.
- **Druhé spuštění:** `ff-onboarded` nastaven → žádný onboarding; welcome se chová přesně jako dnes.
- **Replay:** „Show intro again" v Help panelu spustí Fázi 2 znovu.
- **Invariant:** během no-HW demo **nula MIDI send**; v HW větvi žádná fake data.
- Žádný page error; light+dark OK; `prefers-reduced-motion` respektováno.

## Řešení

**Báze:** nová větev `onboarding` z `main`. Vše v `feel-fader.html`. Nové funkce ve stylu `onbXxx`.

### A. Stavový model a spouštění

- `onbShouldRun()` → `!localStorage.getItem('ff-onboarded')`.
- First-run vždy prochází welcome (žádný schválený port) → Fáze 1 se navěsí na welcome.
- `ff-onboarded="1"` se nastaví až v `onbFinish()` (Fáze 2 zavřená/dokončená). „Skip intro" ve Fázi 1 jen odhalí CTA (uživatel Fázi 2 pořád jednou dostane).
- **Guard:** `onbStartConfig()` běží **once per session** a jen po čistém dismissu welcome → reconnect path `granted && dirty` (early-return, viz connection-state-model) onboarding nespustí. Návratový uživatel se schváleným portem (auto-enter bez welcome) nikdy není first-run → onboarding se tam nespustí.

### B. Fáze 1 — Orientace (na welcome, first-run-only)

Vrstva uvnitř `.welcome-inner`, běží existující animace faderů za textem. Copy přes `data-i18n` (`onb.*`).

Tři beaty (caption pod titulem, swap s fade):
1. **Meet Feel Fader** — dva fadery bez motorů + roller pro artikulace, orchestrální MIDI.
2. **Configure & mirror** — appka nastaví zařízení a zrcadlí ho živě; konfigurátor a display, ne kontroler.
3. **Connect or explore** — připoj a nastav, nebo prozkoumej demo bez zařízení → odhalí existující Start (když HW) / „Explore the demo" (skip).

- Mechanika: jemný auto-timer ~4 s/beat + klik/tap posune rychleji; `.onb-dots` indikátor; `.onb-skip` odkaz „Skip intro" (skočí na beat 3 s CTA, neopouští appku).
- Během beatů se `.welcome-status` nahradí beat-captionem; na beatu 3 se obnoví normální connect affordance.
- Nové kusy: `#onb-beats`, `.onb-dots`, `.onb-skip` (welcome tokeny).
- Ne-first-run: welcome beze změny.
- Funkce: `onbStartWelcome`, `onbBeatNext`, `onbBeatShowCTA`.

### C. Fáze 2 — Navedení konfigurace (po vstupu na hlavní stránku)

Žádný step-engine ani spotlight-dimming. Tři kusy:

**C1. Intro karta** `#onb-intro-card` (nahoře v `.center-col`, zavíratelná), copy dle větve (`liveAllowed()`):
- HW: „You're connected. Tap the pulsing points to learn each control, or move a hardware fader to see it mirror here."
- no-HW: „No device connected — this is a live demo. Tap the pulsing points to explore, then connect a Feel Fader to configure it."

**C2. Pulzující kotvy = existující `.help-hint`.** Na first-run třída `.onb-pulse` (CSS) na 3 místech, dokud se s hintem neinteraguje / nezavře intro. Klik → `openHelpAt(id)` (už hotové). Žádné plovoucí bubliny → žádné pozicování proti živým prvkům.

Tři místa (jen esenciální koncepty):
- **Sticky bank bar** → banky = presety, každá vlastní mapping. *(přidat `.help-hint` + help sekce „Banks", dnes chybí)*
- **Fader panel (Left/Expression)** → CC + kanál; fader zrcadlí HW (display-only). *(přidat `.help-hint`)*
- **Roller mode selektor** → tři módy. *(help sekce `#help-roller` už existuje)*

**C3. No-HW dekorativní ochutnávka** (jen když `!liveAllowed()`): fadery se jemně rozhýbou (thumby přes existující `pF()`), roller cykluje názvy artikulací; odznak `#onb-demo-badge` „Demo" u stage. Jasně neinteraktivní, nešle MIDI. V HW větvi se nespouští. Funkce `onbDemoTick`/`onbDemoStop` (interval).

**Dokončení:** `onbFinish()` — zavření intro karty nebo interakce se všemi pulzy → nastaví `ff-onboarded`, sundá `.onb-pulse`, zastaví demo, schová kartu.

Funkce: `onbStartConfig`, `onbDemoTick`, `onbDemoStop`, `onbFinish`.

### D. Data, i18n, replay

- **localStorage:** jediný klíč `ff-onboarded="1"`.
- **i18n:** veškerý text jako `data-i18n` pod namespace `onb.*` v `TRANSLATIONS.en` (`onb.beat1.title`, `onb.intro.hw`, `onb.intro.nohw`, `onb.demo_badge`, …); `applyLang()` aplikuje.
- **Replay:** malý text „Show intro again" v hlavičce Help panelu → `onbReplay()` (spustí Fázi 2 znovu). Žádný nový trvalý top-level prvek.

### E. Edge cases

- **Connect během Fáze 1:** skok na beat 3 (CTA) + Start; pokud port už schválený → krátký „connected" beat → Fáze 2 HW větev.
- **Skip → connect potom (no-HW → HW):** demo animace okamžitě stop; běží existující re-welcome/Start flow; Fáze 2 přepne na HW copy (pulzy zůstanou).
- **`prefers-reduced-motion: reduce`:** vypnout demo animaci i pulz, nechat statické callouty (pohyb transformem, ne `top` — iOS ghost poučení).
- **Dark mode:** veškeré CSS přes tokeny; pulz barva `--red`/`--green`.
- **Welcome fallback timer (~3,5 s):** dál funguje (Start i při MIDI-detection-fail); CTA reveal koordinovaný s beaty.

### F. Testy (headless puppeteer proby v `scratch/`, committed)

Vzor dle `project_feelfader_browser_test_automation` (pipe:true, internal-state poke, čti DOM ne screenshot):

- **A** first-run: welcome ukáže beaty → posun → CTA se objeví.
- **B** no-HW skip: intro karta (no-HW copy) + pulzy + `#onb-demo-badge`; klik na pulz → help sekce rozbalená.
- **C** HW větev (poke `_ffConnected=true`, `_serialPort={}`, `_midiState='granted'`): intro karta HW copy, žádná demo animace.
- **D** completion nastaví `ff-onboarded`; reload → žádný onboarding; welcome jako dnes.
- **Invariant:** během no-HW demo žádný MIDI output call (display-only zachováno).

## Co záměrně NEdělám (YAGNI)

- Žádný coach-tour step-engine, dimming overlay, plovoucí tooltip pozicování (varianta A — příliš křehké v single-file appce se sticky barem a 4 overlaye).
- Žádná nová animace rolleru ve Fázi 1 (reuse fader keyframes).
- Žádný jazyk kromě EN (namespace `onb.*` ale future-proof).
- Žádný trvalý top-level „tour" prvek (replay jen z Help panelu).
