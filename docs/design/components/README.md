# Components

> **Status: agreed in the M0 UI design review (2026-10-22)**, except where a file says otherwise.
> These are the specs builders follow. They describe anatomy, sizes, states and behaviour; the
> look comes from the active theme.

## Core components and themed previews

The rule from `../themes.md` §2 (one component set, a theme is a token file) also decides how the
design docs are organised:

| Kind | Where | What it holds | Changes when |
| --- | --- | --- | --- |
| **Core component spec** | `components/<name>.md` | Anatomy, sizes in px, states, behaviour, copy, and the **semantic tokens** each part uses (`surface-raised`, `primary`, …). Never a hex colour, font name or radius value. | The component's behaviour or structure changes |
| **Theme-neutral art** | `../assets/avatars/*.svg` | Bot avatar art. Its colours come from the bot's own colour, not from the theme, so it is the same in every theme | The art changes |
| **Theme token values** | `../themes.md` §3 | The value of every token per theme and mode | A theme changes |
| **Themed preview** | `../previews/<theme>-<mode>/` | Rendered pictures (`.png`) and self-contained pages (`.html`) of the components in one theme. Illustrations only | Regenerated after a spec or theme change |

If a preview and a spec disagree, **the spec wins** and the preview is regenerated. A new theme
(Material, T2) needs no new component spec, only new token values and, if wanted, a new preview
folder. A structural difference between themes is allowed only through `../themes.md` §2 rule 3.

The previews were generated from the review canvas in the Command dark theme. The `.html` files
open in any browser with no build step and show the animations; they are pictures to compare
against, not code to copy.

## Files

| File | Component | Previews |
| --- | --- | --- |
| [bot-avatar.md](bot-avatar.md) | Bot avatar: styles, sizes, state faces, badges, animation setting | `../previews/command-dark/avatars.*`, `../assets/avatars/` |
| [top-header.md](top-header.md) | Top header: bot roster, overflow, hover, focus, drag, ordering, empty state | `../previews/command-dark/top-header.*` |
| [bot-card.md](bot-card.md) | Bot card opened from a header avatar, with its status row | `../previews/command-dark/top-header.*` (card 7 and 7a–7h) |
| [user-panel.md](user-panel.md) | Bottom-left user panel, its menu, the budget battery and the floating placement | `../previews/command-dark/user-panel.*` |
| [left-bar.md](left-bar.md) | Left bar: rail (Home, New project, pinned projects, scroll) and bar 2 (project header, Memory, Library, Chats, Home, first run) | `../previews/command-dark/left-bar-rail.*`, `../previews/command-dark/left-bar.*` |
| [memory-pane.md](memory-pane.md) | Memory pane in the right pane: order, conflicts, outside projects | `../previews/command-dark/left-bar.*` (cards M1–M6) |
| [new-project-page.md](new-project-page.md) | New project page: layout A, greetings, fields, errors, leave dialog | `../previews/command-dark/new-project.*` |

Still in review (not here yet): the Library page content, the Flow
pane (canvas round 7), the Create bot page (M2 checkpoint), Command light values.
