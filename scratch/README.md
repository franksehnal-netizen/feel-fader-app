# scratch/

Puppeteer probe scripts and one-off diagnostic artifacts (screenshots, reports)
produced during development.

**Commit a probe** if it verifies a regression that a future change could
reintroduce — connection-state handling, onboarding flow, mobile layout,
live-value display, etc. These are the app's closest thing to an automated
regression suite (see `package.json` `test:mobile` and `AGENTS.md`: "ověř
změnu nejmenším relevantním committed `.mjs` probe").

**Leave a probe untracked** if it was a one-off check for a specific bug or
question during a single session and has no ongoing regression value.

`.gitignore` only excludes `scratch/mobile-ux-output/` — everything else in
this directory is either intentionally tracked (the regression suite) or
intentionally left untracked (session scratch). If in doubt, don't commit;
it's easy to add later, harder to tell apart from real scratch once mixed in.

`npm test` starts one shared headless Chrome and runs up to four probes at a
time. `shared-browser-hook.cjs` gives every probe its own incognito context, so
storage, pages and permissions remain isolated. Set `FF_PROBE_CONCURRENCY=1`
when debugging order/timing, or run one listed probe via
`npm test -- <probe.mjs>`. Running a probe directly still launches its own
browser as before.
