# User panel

> **Status: agreed in the M0 UI design review (2026-10-22).** The collapsed tooltip and menu
> header (§2) and the battery focus and text size (§3) agreed in the shell review (2026-10-30).
> Preview: `../previews/command-dark/user-panel.png` (and `.html`).

The panel floats over the bottom of the two-bar left bar (`left-bar.md`) and stays there while
the lists above it scroll (UI-1.13). The rail has no tools, so the menu below keeps all of them.

## 1. Expanded

Left to right: 32 px round owner avatar (a letter), owner name, **budget battery**,
Settings gear (36 px). Hover and keyboard focus: the row lightens and gets a 2 px `primary` ring.
No chevron: the avatar and name open the menu (owner 2026-10-22, kept in the shell review
2026-10-30).

Until the owner sets a display name, the name is **"Sir"** and the avatar letter **"S"**.

## 2. Menu

Opens upward from the avatar or name: Manage bots, Manage skills, Memory, Trash, Statistics, a
divider, Settings. **Trash** (M5b, round 15) shows the number of items in Trash at the right, in
`on-surface-muted`, and opens the Trash page (`trash-page.md`).
Arrow keys move, Esc closes. The current page is marked with a `primary` bar; on the
Settings page the gear stays lit.

Collapsed left bar: only the avatar shows. Hover and keyboard focus show the tooltip
"Sir · Menu" (the display name once set). Its menu opens to the right. The menu header is the name
and, when a total cap is set, what is left today: "Sir · 38% left today", the percent in the
battery's colour for that level (§3). No alert dot: the D40 banner and toast warn at 75% and 90%.

## 3. Budget battery

40 × 18 px battery that shows how much of today's **total** cap (D20, D42) is left: 100% = nothing
spent, 0% = cap reached.

| Left | Fill colour |
| --- | --- |
| above 25% | `success` |
| 25% or less | `waiting` (amber, after the 75% alert, D40) |
| 10% or less | `danger` |
| 0% | empty outline in `danger` |

- The percent is drawn inside in two tones: light text over the empty part, dark text clipped to
  the fill, so it reads at every level. The fill shrinks with the level. Text 10.5 px, weight 700
  (`../ui-rules.md` L2).
- **No total cap set: no battery.** Hidden when the left bar is collapsed; the percent then shows
  in the menu header (§2).
- The battery is a button. Tab reaches it, with the 2 px `primary` focus ring.
- Hover and keyboard focus show text rows `used / cap`: Total first, then each provider; the caps
  line up in one right-aligned column; "—" = provider has no cap of its own. Click or Enter opens
  Statistics. On touch, a tap opens Statistics, which shows the same numbers.

## 4. Floating placement (round 6.0)

Content and states are as above; only the placement changed.

- Floats over **both** bars, inset 8 px from the left, right and bottom edges, radius
  `radius-card`, `surface-raised`, 1 px `outline-strong`, shadow.
- Both lists scroll under it; the rail list ends 24 px above it (`left-bar.md` §1.3).
- When bar 2 is hidden (`left-bar.md` §4) it collapses to the avatar only, as in §2 "Collapsed".

## Requirement changes (requirements PR)

- New owner setting: display name (default "Sir").
- The battery and its hover in `app-shell.md`.
