# AGENTS.md — Feel Fader web app

Před jakoukoli prací přečti celý `CLAUDE.md` v tomto repozitáři a řiď se jím.

## Hranice repozitáře

- Toto repo je trvale oddělené od `feel-fader-firmware`; repozitáře nikdy neslučuj ani necommituj společně.
- Firmware můžeš číst kvůli kompatibilitě protokolu, ale nezapisuj do něj bez explicitního pokynu uživatele.
- Pokud změna appky vyžaduje změnu firmware, zastav před cross-repo zápisem, popiš nutný dopad a vyžádej si rozšíření scope.
- Před editací zkontroluj `git status` a zachovej všechny existující uživatelské změny.

## Práce a ověření

- Dělej malé, chirurgické změny v souladu se stávající single-file architekturou.
- Pro browser testy dodržuj MCP/HW invarianty z `CLAUDE.md`; automatizace nikdy nesmí sahat na reálný Feel Fader hardware.
- Ověř změnu nejmenším relevantním committed `.mjs` probe nebo existující testovací cestou.
- Deploy demo verze, commit, push ani externí publikaci neprováděj bez explicitního pokynu.
