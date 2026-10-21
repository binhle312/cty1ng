# D30. Switchable themes (Command, Material) and conversation views

Status: proposed (2026-10-21). The owner picked concepts 2, 11 and 13 and wants to switch
between more than one look.
Decision: Two themes, Command and Material, each with light and dark modes, implemented as
semantic design tokens over one component set (Base UI + Tailwind, D28). Density is a separate
setting. The spatial canvas (concept 13) is not a theme but a conversation view: Chat,
Chat + Board, or Board, built on the Flow view's scene and renderer (D26, D27).
Why: Themes as token files keep one set of components, tests and accessibility behaviour, so a
second (or third) theme costs a CSS file instead of a parallel UI. Treating the board as a view
keeps it usable in every theme.
Rejected: MUI for the Material theme (two component libraries, double the testing, and the
Command look would fight MUI's defaults); separate component trees per theme (every feature
built twice).
Consequences: Components may only use semantic tokens (lint-enforced). Structural differences
between themes are limited to a short, documented list. Visual snapshot tests run per theme
and mode. The theme setting is stored per browser in phase 1.
Open: whether Chat + Board replaces the Flow pane or sits beside it; which theme ships first.
Implemented in: `../design/themes.md`, `../design/concepts.md`, `../requirements/settings.md`
(UI-8.5), `../tasks/M0-skeleton.md`, `../tasks/M8-flow-view.md`, `../testing.md` §3.
