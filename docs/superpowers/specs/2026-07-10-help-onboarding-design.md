# Help & Guide rozšíření + kontextové „?" odkazy (design)

**Datum:** 2026-07-10
**Rozsah:** app-only (`feel-fader.html`), žádná změna protokolu/firmwaru.
**Kontext:** Audit („onboarding pro power featury") chtěl rozšířit Help & Guide o macro/keyswitch mini-guides + DEV/PROD postup + kontextové „?" odkazy z panelů. Navíc přibyly featury (**control mód**, sticky bank bar), které Help nezmiňuje. Cíl: discoverability — uživatel snadno najde, jak power featury fungují.

**Branch strategie:** postaveno na větvi `help-onboarding` z `control-mode` (control mód existuje → lze ho v Helpu zdokumentovat + „?" na jeho toggle). `control-mode` zůstává zmražený/čistý (61a2339). Merge pořadí do `main`: nejdřív `control-mode` (po HW testu), pak `help-onboarding`.

## Cíl

1. Help & Guide (`#help-body`) obsahuje jasné mini-guides pro všechny power featury (roller módy, button macro, keyswitch, control mód, DEV/PROD servis) + zmínku o sticky liště.
2. U panelů power featur (Roller, Button Macro, případně Control toggle) je malá „?" ikonka, která **otevře Help a odscrolluje na příslušnou sekci**.

## Kritérium úspěchu

- Rozbalený Help obsahuje sekce (každá s `id`): `help-roller`, `help-macro`, `help-keyswitch`, `help-control`, `help-dev`.
- Klik na „?" u Rolleru → Help se rozbalí (byl-li sbalený) + plynulý scroll na `#help-roller`. Totéž Button Macro → `#help-macro`.
- Žádný layout regres; app-only.

## Obsah Help (`#help-body`)

Rozšířit stávající `#help-body` (~ř.1206). Zachovat *Getting started*, *Switching banks*; do *Banks & tags* přidat větu o **sticky liště** (pruh pod headerem ukazuje, kterou banku edituješ). Sekce (`<div class="settings-subhead" id="…">`):

- **Roller modes** (`id="help-roller"`) — CC (roller kroká UACC artikulace) · Keyswitch (posílá note keyswitche) · Navigation (posílá klávesu per detent, vyžaduje HID). Odkaz na keyswitch/HID sekce.
- **Button macro** (`id="help-macro"`, NOVÉ) — dlouhý stisk (≥0,5 s) tlačítka pošle definovaný key combo (např. play/stop, DAW zkratka); **vyžaduje Keyboard (HID)**; krátký stisk dál přepíná banky; makro se zapíná/objeví po zapnutí HID.
- **Keyswitch** (`id="help-keyswitch"`, NOVÉ) — roller v keyswitch módu posílá MIDI noty (keyswitche) na nastaveném kanálu; jak nastavit noty a kanál.
- **Control mode** (`id="help-control"`, NOVÉ) — **bez připojeného zařízení** appka funguje jako softwarový MIDI kontroler: zapni „Control mode" (v hlavičce, nabízí se jen bez HW), vyber MIDI výstupní port (virtuální loopMIDI/IAC do DAWu); tah faderů posílá CC z aktivní banky. Při připojení zařízení se přepne zpět na zrcadlení.
- **Keyboard (HID) & Service (DEV/PROD)** (`id="help-dev"`) — HID zapnout pro Navigation/macro. **DEV mód:** drž bank tlačítko při připojení USB → objeví se FEELFADER disk (firmware update); normální připojení = PROD (disk skrytý). Recovery: BOOTSEL při USB → RPI-RP2.

Styl beze změny (settings-subhead + odstavce), jen doplnit `id` na příslušné subheady + nový obsah.

## Kontextové „?" odkazy

- **Helper `openHelpAt(id)`:** rozbalí Help (když je `#help-body` skrytý, zavolat `toggleHelp()`); pak `document.getElementById(id)?.scrollIntoView({behavior:'smooth', block:'start'})` (v `requestAnimationFrame`, ať je po rozbalení layout hotový). Bezpečné když id chybí.
- **„?" ikonky:** malé nenápadné tlačítko (`.help-hint`, `?` glyf, `--t3`, hover `--t1`) v hlavičce panelů:
  - Roller sekce head (`encoderSectionContent`/`trackNavBody` — Grep `.section-head` v roller sekci) → `onclick="openHelpAt('help-roller')"`.
  - Button Macro sekce head (`macroSectionContent`) → `openHelpAt('help-macro')`.
  - (Volitelně) Control mode toggle/indikátor → `openHelpAt('help-control')`.
- Ikonka nesmí kolidovat s existujícími prvky v hlavičce sekce (live-val badge apod.) — umístit vedle titulku.

## Ověření (headless)

- Help rozbalen → existují `#help-roller`, `#help-macro`, `#help-keyswitch`, `#help-control`, `#help-dev`; obsahují očekávaný text (macro long-press, control mode port, DEV button-hold).
- `openHelpAt('help-macro')` když je Help sbalený → `#help-body` se zobrazí a `#help-macro` je ve viewportu (scroll). Když už rozbalený → jen scroll.
- „?" ikonky přítomné u Roller + Button Macro hlaviček; klik volá `openHelpAt` se správným id.
- Žádné page errors; screenshot rozbaleného Helpu (light + dark) — čitelné.

## Mimo rozsah

- V10/legal patička (samostatné, chce URL).
- Interaktivní onboarding tour / coach marks (jen statický Help + „?").

## Vztah / merge

Na `help-onboarding` (z `control-mode`). Do `main` až po `control-mode` (Frankův HW test). Pak Help pokrývá i control mód, který v main bude.
