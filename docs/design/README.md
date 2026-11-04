# Design

> **Status: mixed.** `components/` holds designs the owner has **agreed** (each file says when);
> builders follow them. Everything else here is a sketch or mockup for discussion: the owner
> decides the actual UI when a slice starts, in its plan, and a sketch is not a pixel spec.

## Files

| File | Contains |
| --- | --- |
| [screens.md](screens.md) | Text layout sketches for the shell, conversation page, statistics page and time range picker |
| [concepts.md](concepts.md) | UI concept proposals (7 layouts, then 10 visual styles), compared; the owner picked 2, 11 and 13 (D30) |
| [ui-rules.md](ui-rules.md) | **Every agreed UI rule in one list**, each with its check (auto or manual) and the file that owns it. Read it before a board, a UI spec or UI code |
| [themes.md](themes.md) | Theme system: Command and Material themes, modes, density, Board map, tokens (D30) |
| [mockups.md](mockups.md) | Links to visual mockups (Flow view Team, Timeline, Files) and what they illustrate |
| [components/](components/README.md) | **Agreed** component specs and the shared standards, theme-neutral; the list, the status of each file and the core-vs-theme rule are in its README |
| `assets/` | Exported images (PNG or SVG) referenced from the files above; only `avatars/` so far |
| `assets/avatars/` | Bot avatar art, SVG, one file per style and state (`flat-idle.svg` … `pixel-waiting.svg`); theme-neutral (`components/bot-avatar.md`) |
| `previews/command-dark/` | Agreed components rendered in the Command dark theme, each as `.png` and a self-contained `.html` (animated); each spec in `components/` names its previews. Illustrations; the spec in `components/` wins |

## How a design becomes final

1. The slice plan (see `../workflow.md` §2, step 2) includes a **UI design** section for any
   slice that adds or changes a screen: the proposed layout, components and states. The owner
   sees it visual first: a text wireframe, then a preview (`../workflow.md` §2, "Human
   review: visual first").
2. The owner discusses and approves it. That is a checkpoint, like a migration.
3. The approved design becomes a spec in `components/<name>.md` (status line "Agreed in
   <slice or review>"), with theme-neutral art in `assets/` and rendered pictures in
   `previews/<theme>-<mode>/`. The sketch it replaces is removed or points to it.
4. Acceptance criteria in `../requirements/` do not change because of a new look; if they must,
   the PR says so.

## Naming

- Sketch sections are numbered like the acceptance criteria group they illustrate
  (`screens.md` §3 goes with UI-3).
- Assets: `assets/<area>-<what>[-v<n>].png`, for example `assets/flow-team-v1.png`; avatar art
  `assets/avatars/<style>-<state>.svg`.
- Previews: `previews/<theme>-<mode>/<component>.png` and `.html`, regenerated when a spec or a
  theme changes.
- Keep files small and text first; an image without a sentence saying what it shows is not
  useful to an agent.
