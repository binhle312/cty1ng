# Design

> **Status: mixed.** `components/` holds designs the owner has **agreed** (each file says when);
> builders follow them. Everything else here is a sketch or mockup for discussion: the owner
> decides the actual UI when a slice starts, in its plan, and a sketch is not a pixel spec.

## Files

| File | Contains |
| --- | --- |
| [screens.md](screens.md) | Text layout sketches for the shell, conversation page, statistics page and time range picker |
| [concepts.md](concepts.md) | UI concept proposals (7 layouts, then 10 visual styles), compared; the owner picks one before M0 |
| [themes.md](themes.md) | Theme system: Command and Material themes, modes, density, Board map, tokens (D30) |
| [mockups.md](mockups.md) | Links to visual mockups (Flow view Team, Timeline, Files) and what they illustrate |
| [components/](components/README.md) | **Agreed** component specs (bot avatar, top header, bot card, user panel, left bar, memory pane, new project page, project settings, plan card, buttons, skills page, Bots page, Create bot page, bot page, conversation page, composer, conversation system lines and cards) and the shared standards (pin, bot status, dashed slot, time format and sort), theme-neutral; index and the core-vs-theme rule in its README |
| `assets/` | Exported images (PNG or SVG) referenced from the files above |
| `assets/avatars/` | Bot avatar art, SVG, one file per style and state (`flat-idle.svg` … `pixel-waiting.svg`); theme-neutral (`components/bot-avatar.md`) |
| `previews/command-dark/` | Agreed components rendered in the Command dark theme: `avatars`, `top-header`, `user-panel`, `left-bar-rail`, `left-bar`, `new-project`, `project-settings`, `memory-check-plan`, `delete-project`, `skills-layout`, `skills-editor`, `skills-lifecycle`, `skills-delete`, `bots-grid`, `bots-grid-states`, `bot-card-v3`, `pin`, `header-pins`, `bot-status`, `dashed-slot`, `create-bot`, `create-bot-errors`, `create-bot-tools`, `conversation-page`, `conversation-header`, `conversation-skills`, `conversation-reactions`, `conversation-live`, `conversation-stop`, `conversation-errors`, `message-parts`, `composer`, `conversation-cards`, `handoff-buttons`, `handoff-choices`, each as `.png` and a self-contained `.html` (animated). Illustrations; the spec in `components/` wins |

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
