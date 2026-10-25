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
| [bot-avatar.md](bot-avatar.md) | Bot avatar: styles, sizes, state faces, badges, animation setting, colour row (Custom, Random), change and upload on the bot page | `../previews/command-dark/avatars.*`, `../assets/avatars/` |
| [top-header.md](top-header.md) | Top header: bot roster, overflow, hover, focus, drag, ordering, pinned zone, empty state | `../previews/command-dark/top-header.*`, `header-pins.*` |
| [bot-card.md](bot-card.md) | Bot card opened from a header avatar, with its pin button and status row | `../previews/command-dark/top-header.*` (card 7 and 7a–7h), `pin.*` (P2) |
| [user-panel.md](user-panel.md) | Bottom-left user panel, its menu, the budget battery and the floating placement | `../previews/command-dark/user-panel.*` |
| [left-bar.md](left-bar.md) | Left bar: rail (Home, New project, pinned projects, scroll) and bar 2 (project header, Memory, Library, Conversations, Home, first run) | `../previews/command-dark/left-bar-rail.*`, `../previews/command-dark/left-bar.*` |
| [memory-pane.md](memory-pane.md) | Memory pane in the right pane: order, conflicts, outside projects, memory check card, open conflicts | `../previews/command-dark/left-bar.*` (cards M1–M6), `../previews/command-dark/memory-check-plan.*` (cards S4, S4b) |
| [new-project-page.md](new-project-page.md) | New project page: layout A, greetings, fields, errors, leave dialog | `../previews/command-dark/new-project.*` |
| [project-settings-page.md](project-settings-page.md) | Project settings page: fields, save bar, memory check line, Memory history, leave dialog, Delete project and after delete | `../previews/command-dark/project-settings.*`, `../previews/command-dark/delete-project.*` |
| [buttons.md](buttons.md) | Button kinds, sizes, default button, order, icons on buttons, labels, check boxes, Undo rule. Every page uses it | `../previews/command-dark/skills-editor.*` (card C0), `handoff-buttons.*` |
| [skills-page.md](skills-page.md) | Skills page (layout B): list, editor, History, new skill, errors, bot cards after a save, deprecate, delete to Trash, clone, import, export | `../previews/command-dark/skills-layout.*`, `skills-editor.*`, `skills-lifecycle.*`, `skills-delete.*` |
| [pin.md](pin.md) | **Standard.** Pin glyph, its four states, where it shows, pin, unpin and reorder rules | `../previews/command-dark/pin.*` |
| [bot-status.md](bot-status.md) | **Standard.** Bot state words, icons and colours (amber only for Waiting for you), most urgent state for a bot in several conversations | `../previews/command-dark/bot-status.*`, `bot-card-v3.*` (M1) |
| [dashed-slot.md](dashed-slot.md) | **Standard.** Dashed slot (rest, active) for empty places to fill, and the gap and drop line of a drag | `../previews/command-dark/dashed-slot.*` |
| [time-format.md](time-format.md) | **Standard.** Time format ("3 h ago" under 1 day, else local ISO time) and the sort icon and sort buttons | `../previews/command-dark/bot-card-v3.*`, `bots-grid-states.*` (S5) |
| [bots-page.md](bots-page.md) | Bots page grid: page, V3 card, ⋯ menu, health, sort, pin and reorder, search, empty state | `../previews/command-dark/bots-grid.*`, `bots-grid-states.*`, `bot-card-v3.*` |
| [create-bot-page.md](create-bot-page.md) | Create bot page: 4 steps, live preview card, Tools list, errors, sending, leave dialog, Clone | `../previews/command-dark/create-bot.*`, `create-bot-errors.*`, `create-bot-tools.*`, `clone-bot.*` |
| [bot-page.md](bot-page.md) | Bot page: edit layout (list and page), page top, tabs, Profile tab and save bar, colour band, Model, Skills, Activity and Usage tabs | `../previews/command-dark/bot-page.*`, `bot-avatar-change.*`, `bot-page-tabs.*`, `bot-usage.*` |
| [plan-card.md](plan-card.md) | Plan card before a task that changes something: steps, files, memory, skill drafts, conflict questions, Approve, Request changes, Reject | `../previews/command-dark/memory-check-plan.*` (cards S4b–S4e), `conversation-cards.*` (S3), `plan-progress.*` (progress after Approve, D57) |
| [conversation-page.md](conversation-page.md) | Conversation page: layout, header with the add slot and members menu, skill chips, Good and Bad, queued reactions, live states, failed, stopped and not sent, Edit, branches, New divider, Markdown | `../previews/command-dark/conversation-page.*`, `conversation-header.*`, `conversation-skills.*`, `conversation-reactions.*`, `conversation-live.*`, `conversation-errors.*`, `message-parts.*` |
| [composer.md](composer.md) | Composer: box, keys, no bots, no-mention hint, @ list, attachments, file drop, secrets panel, lines under the box, Stop, Markdown keys and the format bar | `../previews/command-dark/composer.*`, `composer-lines.*`, `composer-format-send.*`, `conversation-stop.*` (P1) |
| [conversation-cards.md](conversation-cards.md) | System lines, join card, cards inside a reply and how they fold, handoff card (not a member, stale), memory lines and the Remember offer | `../previews/command-dark/conversation-cards.*`, `handoff-buttons.*`, `handoff-choices.*` |

Files marked **Standard** are shared rules that many pages use; a page spec links to them and
does not repeat them.

Still in review (not here yet): the Trash page, the Library page content, the Flow pane (canvas round 7), Command light values.
