# feel-fader-app

Web configurator for **Feel Fader** – a MIDI hardware controller by Acoustic Empire s.r.o.
Configure banks, fader CC mappings, the roller (CC, Relative CC, keyswitch, track navigation)
and the button macro, then send the setup to the device.

## Requirements

- **Chrome or Edge** on desktop – the app needs Web Serial (config sync) and Web MIDI (live values).
  Firefox and Safari are not supported.
- Served over **HTTPS** or `localhost` (Web Serial requirement).
- Feel Fader connected over USB with matching firmware
  ([feel-fader-firmware](https://github.com/franksehnal-netizen/feel-fader-firmware)).

## Structure

`feel-fader.html` is the single source of truth – HTML, inline `<style>` and `<script>`,
fonts and images are all embedded. There is no build step.

| Path | Content |
|---|---|
| `feel-fader.html` | The app |
| `WEBAPP.md` | Architecture and design contract (CZ) |
| `docs/` | TODO log, audits, specs and plans |
| `scratch/` | Puppeteer regression probes (`*-probe.mjs`, `audit/`) |

## Tests

```sh
npm install
npm test                      # all probes (headless Chrome, local server on :8100)
npm test -- <probe.mjs>       # one probe, path as listed in scratch/run-all-probes.mjs
```

Probes never touch real hardware; real-device testing stays manual.

## Deploy

The public demo is a snapshot copy published to GitHub Pages
([feel-fader-demo](https://franksehnal-netizen.github.io/feel-fader-demo/)) by
`scripts/deploy-ff-demo.ps1` in the Acoustic Empire Drive.

© 2026 Acoustic Empire s.r.o. · support@acoustic-empire.cz
