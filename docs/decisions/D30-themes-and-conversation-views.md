# D30. Switchable themes (Command, Material) and conversation views

Status: accepted (2026-10-21, owner). The owner picked concepts 2, 11 and 13 and wants to switch
between more than one look.
Decision: Two themes, Command and Material, each with light and dark modes, implemented as
semantic design tokens over one component set (Base UI + Tailwind, D28). Density is a separate
setting. The spatial canvas (concept 13) is not a theme but a **third map in the Flow pane**
(Team, Timeline, Board), built on the Flow view's scene and renderer (D26, D27). There is no
separate Chat + Board layout. **Command ships first** (M0, with the full token system);
Material follows as a small slice that adds one token file and the documented structural
differences.
Why: Themes as token files keep one set of components, tests and accessibility behaviour, so a
second (or third) theme costs a CSS file instead of a parallel UI. Treating the board as a map in
the Flow pane keeps it usable in every theme and reuses the pane's resize, swap and close
behaviour.
Rejected: MUI for the Material theme (two component libraries, double the testing, and the
Command look would fight MUI's defaults); separate component trees per theme (every feature
built twice).
Consequences: Components may only use semantic tokens (lint-enforced). Structural differences
between themes are limited to a short, documented list. Visual snapshot tests run per theme
and mode. The theme setting is stored per browser in phase 1.
Resolved (owner, 2026-10-21): the Board joins the Flow pane as a third tab, so there is one
split screen with three maps instead of two competing side views; Command ships first.
Implemented in: `../design/themes.md`, `../design/concepts.md`, `../requirements/settings.md`
(UI-8.5), `../tasks/M0-skeleton.md`, `../tasks/M8-flow-view.md`, `../testing.md` §3.
