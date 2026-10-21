# Design

> **Status: everything here is a sketch or mockup for discussion, not a final design.** The
> owner decides the actual UI (layout, visual style, components, motion) when a slice starts,
> in its plan. Builders must not treat a sketch as a pixel spec.

## Files

| File | Contains |
| --- | --- |
| [screens.md](screens.md) | Text layout sketches for the shell, conversation page, statistics page and time range picker |
| [concepts.md](concepts.md) | UI concept proposals (7 layouts, then 10 visual styles), compared; the owner picks one before M0 |
| [themes.md](themes.md) | Theme system: Command and Material themes, modes, density, Board map, tokens (D30) |
| [mockups.md](mockups.md) | Links to visual mockups (Flow view Team, Timeline, Files) and what they illustrate |
| `assets/` | Exported images (PNG or SVG) referenced from the files above |

## How a design becomes final

1. The slice plan (see `../workflow.md` §2, step 2) includes a **UI design** section for any
   slice that adds or changes a screen: the proposed layout, components and states.
2. The owner discusses and approves it. That is a checkpoint, like a migration.
3. The approved design replaces the sketch here (same file, status line changed to
   "Agreed in <slice>"), with images in `assets/`.
4. Acceptance criteria in `../requirements/` do not change because of a new look; if they must,
   the PR says so.

## Naming

- Sketch sections are numbered like the acceptance criteria group they illustrate
  (`screens.md` §3 goes with UI-3).
- Assets: `assets/<area>-<what>[-v<n>].png`, for example `assets/flow-team-v1.png`.
- Keep files small and text first; an image without a sentence saying what it shows is not
  useful to an agent.
