# User panel

> **Status: agreed in the M0 UI design review (2026-10-22).** Preview:
> `../previews/command-dark/user-panel.png` (and `.html`).

The panel sits at the bottom of the left bar and stays there while the list above it scrolls
(UI-1.13). Which items its menu holds may shrink once the left bar design is agreed (canvas
round 6 puts the tools on the bar).

## 1. Expanded

Left to right: 32 px round owner avatar (a letter), owner name, chevron, **budget battery**,
Settings gear (36 px). Hover and keyboard focus: the row lightens and gets a 2 px `primary` ring.

Until the owner sets a display name, the name is **"Sir"** and the avatar letter **"S"**.

## 2. Menu

Opens upward from the avatar or name: Manage bots, Manage skills, Memory, Statistics, a divider,
Settings. Arrow keys move, Esc closes. The current page is marked with a `primary` bar; on the
Settings page the gear stays lit.

Collapsed left bar: only the avatar shows; its menu opens to the right with the name as a header.
No tooltip, no alert dot.

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
  the fill, so it reads at every level. The fill shrinks with the level.
- **No total cap set: no battery.** Hidden when the left bar is collapsed.
- Hover shows text rows `used / cap`: Total first, then each provider; the caps line up in one
  right-aligned column; "—" = provider has no cap of its own. Click opens Statistics.

## Requirement changes (requirements PR)

- New owner setting: display name (default "Sir").
- The battery and its hover in `app-shell.md`.
