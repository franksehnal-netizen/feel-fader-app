# AGENTS.md — Feel Fader web app

Před prací přečti krátký router `CLAUDE.md` v tomto repozitáři. Další dokumentaci
otevírej pouze tehdy, když ji router přiřazuje k aktuálnímu tématu.

## Hranice repozitáře

- Toto repo je trvale oddělené od `feel-fader-firmware`; repozitáře nikdy neslučuj ani necommituj společně.
- Firmware můžeš číst kvůli kompatibilitě protokolu, ale nezapisuj do něj bez explicitního pokynu uživatele.
- Pokud změna appky vyžaduje změnu firmware, zastav před cross-repo zápisem, popiš nutný dopad a vyžádej si rozšíření scope.
- Před editací zkontroluj `git status` a zachovej všechny existující uživatelské změny.

## Práce a ověření

- Před editací najdi cílový symbol přes `rg` a čti jen malý relevantní výřez.
  Nenačítej celé velké zdrojové ani historické soubory do kontextu.
- Dělej malé, chirurgické změny v odpovídající inline vrstvě
  `feel-fader.html` (`<style>`, HTML struktura nebo `<script>`). Tento soubor je
  jediný zdroj pravdy; nevytvářej vedle něj pracovní extrakty CSS/JS.
- Pro browser testy dodržuj MCP/HW invarianty z `CLAUDE.md`; automatizace nikdy nesmí sahat na reálný Feel Fader hardware.
- Ověř změnu nejmenším relevantním committed `.mjs` probe nebo existující testovací cestou.
- Jeden probe spusť přes `npm test -- <cesta-ze-seznamu-v-scratch/run-all-probes.mjs>`;
  runner sám nastartuje a ukončí lokální server.
- Nikdy nespouštěj probe přímo `node scratch/<probe>.mjs`: každý start plného Chrome s čistým profilem
  = 1 neúspěšné přihlášení do Windows (4625) a 10 za 10 min zamkne Frankův účet i RDP.
  `npm test` (i `npm test -- a.mjs b.mjs`) jede v jednom sdíleném chrome-headless-shell = 0 neúspěšných
  přihlášení (AE-FB-20261001-01). Ad-hoc screenshoty také v chrome-headless-shell (`headless: 'shell'`,
  `executablePath` z `~/.cache/puppeteer/chrome-headless-shell`); plný Chrome max 2 starty za 10 min.
- Plný `npm test` spouštěj před předáním větší změny nebo když zásah protíná více oblastí; ne po každé drobné iteraci.
- Nepoužívej subagenty ani rozsáhlý spec/plan/review workflow jako výchozí režim. Zapoj je jen na explicitní žádost nebo u skutečně nezávislých velkých větví práce.
- Deploy demo verze, commit, push ani externí publikaci neprováděj bez explicitního pokynu.
