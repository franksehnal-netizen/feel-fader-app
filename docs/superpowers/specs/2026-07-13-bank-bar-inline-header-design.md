# Bank bar → inline header (V3b)

**Date:** 2026-07-13
**Component:** `feel-fader.html` — header + bank tab bar
**Goal:** Make the bank tab bar more subtle by removing the separate second row entirely and folding the bank tabs inline into the header, dropping the index numbers.

## Motivation

The bank tabs currently live in a dedicated `.bank-bar` strip stacked below the header — a whole second sticky row. Frank wants the bar subtler along three axes he selected: thinner, blended into the header, and quieter numbers/icons. Collapsing the two rows into one and dropping the index numbers satisfies all three at once: the second row disappears, the tabs share the header surface, and the numeric noise is gone.

## Target layout (single header row)

Left → right, all on one line:

```
[● status]  Feel Fader  │  [🎸] [🎸 Bank 2] [+]        (flex spacer)        [☀ dark toggle]
  corner      title     div   inline bank tabs                              pinned right
```

- **Status dot + text** (`#h-status`) moves to the **far-left corner**, before the title. In the healthy `CONNECTED_LIVE` state the text auto-hides after 3 s, so it reads as just a dot in the corner (matches the current screenshot). In `CONNECTED_BLIND` / `MIDI_BLOCKED` / `DISCONNECTED` the text shows and pushes the title right — same information as today, `renderConnState()` logic unchanged.
- **Title** `Feel Fader` after the status group.
- **Divider** — a thin 1px vertical rule (~16px tall, `var(--border)`) between the brand and the bank group so the tabs read as their own cluster (this is the V3b choice over the flush V3).
- **Bank tabs** inline, horizontally scrollable (hidden scrollbar), **no index numbers**. Active tab keeps the original filled pill (`--bg-input` bg, `--t1` text) with the name expanding; inactive tabs are icon-only. The per-bank live dot (which bank is active on the device) is unchanged.
- **Dark-mode toggle** stays pinned to the far right via a flex spacer / `margin-left:auto` on `.h-right`.

The standalone `.bank-bar` row is removed.

## Changes

### Markup (around lines 1092–1113)
1. Move `#h-status` (dot + text) to be the **first child of `.h-left`**, before `.h-title`.
2. Add a divider element (e.g. `<span class="h-div"></span>`) after `.h-title`.
3. Move the `#bank-tabs` container into `.h-left` (after the divider); **delete** the `<div class="bank-bar">…</div>` wrapper.
4. Ensure `.h-right` (dark toggle) is pushed right — spacer element or `margin-left:auto`.

### CSS
5. `.h-left`: `display:flex; align-items:center; min-width:0` with a small gap (tuned, ~8–10px) so brand and bank region sit together and the bank region can shrink/scroll.
6. Bank tab container inside header: `display:flex; align-items:center; overflow-x:auto; scrollbar-width:none` (+ `::-webkit-scrollbar{display:none}`), `min-width:0`.
7. Bank tab chips: reuse existing `.bank-block-tab` sizing/behavior (active pill, name max-width expand), tuned to sit in the header row. **Remove the index (`.bank-tab-idx`) presentation.**
8. New `.h-div` divider: `width:1px; height:16px; background:var(--border); flex:0 0 auto`.
9. Remove now-dead `.bank-bar` rules (lines ~67–75). Header vertical padding tuned so the single row stays subtle.

### JS
10. `renderBankTabs()` (~line 1520): drop `<span class="bank-tab-idx">${i+1}</span>` from the tab template. Keep the icon, the live dot, and the name span. `updateBankLiveDots()` (~1537) unchanged.

### Dependent offsets
11. `.sync-banner` `top:98px` (line 592) assumed the two-row `header + bank-bar` (~88px). Recompute to the new single-row header height (measure at implementation, ~54px) and update the inline comment.
12. Confirm `.stage` `top:-348px` (line 109) is unaffected — it is stage-height parking, not header-height dependent. No change expected; verify visually.
13. Mobile styles (lines ~402–406, `.bank-tab`, `.bank-tab-add`, `.h-status-text`): revisit so the single header row does not overflow on narrow widths — title `flex-shrink:0`, banks scroll, toggle stays pinned.

## Unchanged behavior (must stay working)

- `connState()` / `renderConnState()` — dot + text states, 3 s auto-hide on live, `live-note` toggle. Only the DOM location of `#h-status` changes.
- Bank select (`selectBank`), add bank (`+`), active-tab name expansion, per-bank live dot, config sync banner logic.

## Success criteria

1. Only one sticky row at the top; no separate `.bank-bar` strip.
2. Status dot sits in the far-left corner; in live state only the dot shows (no text).
3. Bank tabs are inline to the right of the title, separated by the divider, with **no index numbers**; active tab shows the filled pill + name.
4. Dark toggle remains pinned at the far right.
5. Sync banner appears just below the new single-row header (not floating with a gap or overlapping).
6. Works in light + dark; degrades cleanly on a narrow (mobile) width with banks scrolling.
7. No regression in connection-state display across all four states.

## Out of scope

- Changing bank icons, the icon picker, or bank data model.
- Numbered fallback for banks sharing an icon (Frank: banks normally use distinct icons — deferred; revisit only if it becomes a real problem).
- Any restyle of the stage, sections, or other header controls.
