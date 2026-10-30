# UI concepts

> **Proposals for the owner to choose from, not final designs.** The canvas "Role Bots UI
> concepts" (https://claude.ai/artifact/QTNNJs1CgKqhR7BVYGHU8z, private to the owner) shows each
> one on the same scenario: conversation "Login redesign", BA has written stories, Designer is
> working, a handoff to QA waits for approval, bot turns 2 of 4. Concepts may be mixed (for
> example Workbench layout with Command's palette). The pick is recorded as a decision; if it
> changes the component library, that decision supersedes the library part of D28.

Every concept keeps the requirements in `../requirements/` (rail with round icons and "+", bot
bar, members-only @mention, approvals, provenance, turn budget). They differ in **what the
screen is organised around**, not in colour.

| # | Concept | Organised around | Library | Lineage | Density | Best at | Main risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Workbench | Chat plus a details panel (members, turns, files, spend) | shadcn/ui on Base UI | Slack | Medium | Familiar, everything visible, lowest build risk | Plain; right panel competes with Flow for space |
| 2 | Command | Keyboard: ⌘K palette for mentions and actions, status line | Base UI + cmdk | Linear, Raycast, terminals | High | Fast for a power user; very little chrome | Discoverability; dark-first needs a good light theme |
| 3 | Notebook | The conversation as a document: sections, rendered outputs inline, margin notes | Mantine | Notion, Obsidian, Tufte margins | Low | Reading and reviewing bot output; reads like a report | Live chatter feels heavy; layout work for streaming |
| 4 | Studio | Dockable panes: chat, file editor, Flow, runs table | Fluent UI 2 + Dockview | VS Code, JetBrains | Very high | Working on files and watching runs side by side | Complex to build and test; overwhelming at first |
| 5 | Stage | Members on a stage with live state; approvals as a spotlight bar | Chakra UI v3 | Video calls, game lobbies | Low | Seeing who is doing what; friendly; large targets | Stage takes vertical space; less for long threads |
| 6 | Triage | A cross-conversation "Needs you" queue; each item opens with context | Ant Design | Email, GitHub PR review, Superhuman | High | Never missing an approval, failure or question | Chat becomes secondary; enterprise look |
| 7 | Pixel office | Bots as characters in an office; RPG dialogue boxes | 8bitcn (shadcn registry) | Pixel games, PICO-8 | Medium | Memorable; previews the pixel renderer (D27) | Novelty wears off; readability of long text |

## Round 2: ten visual styles (owner rejected round 1)

Same scenario and requirements; this round varies the **visual language**, so no two share a
look with each other or with round 1. Canvas page "Round 2 (10 styles)".

| # | Style | Look in one line | Library or kit | Best at | Main risk |
| --- | --- | --- | --- | --- | --- |
| 8 | Swiss grid | Black and white, 12-column grid, huge bold type, one red | shadcn/ui, custom theme | Calm, very legible, timeless | Can feel cold; needs strict layout discipline |
| 9 | Neo-brutalist | Thick black outlines, pastel blocks, hard offset shadows | shadcn/ui + neobrutalism.dev registry | Playful but clear; strong hierarchy | Visually loud over long sessions |
| 10 | Hardware instrument | Grey device panel, LCD readouts, physical keys, orange | Custom on Base UI | Status at a glance; distinctive | Custom components = more build and test work |
| 11 | Material 3 Expressive | Tonal green surfaces, shape variety, nav rail, pill buttons | MUI or Material Web | Mature accessibility and motion system | Looks like a Google app |
| 12 | Retro desktop | Windows 98 bevels, title bars, dialogs per approval | 98.css | Nostalgic; approvals feel like real dialogs | Small text, dated affordances |
| 13 | Spatial canvas | Infinite dotted board, threads as frames, floating toolbars | tldraw or React Flow | Seeing parallel threads and handoffs spatially | Hard on small screens; harder keyboard access |
| 14 | Bento | Rounded tiles of different sizes, big numbers, one dark tile | shadcn/ui, custom theme | Overview of state, spend and turns at once | Chat gets less room |
| 15 | Sci-fi HUD | Dark grid, cyan lines, clipped corners, "authorise" | Arwes | Memorable, fun for a solo tool | Gimmicky; weaker readability |
| 16 | Whiteboard sketch | Hand-drawn borders, marker fonts, sticky notes | Rough.js or wired-elements | Friendly, feels like a draft | Handwritten fonts tire on long text |
| 17 | Market terminal | Black, amber mono text, numbered panels, function keys | Custom on Base UI | Maximum data density; keyboard driven | Steep learning curve; dense for casual use |

## Owner's pick

Concepts 2 (Command), 11 (Material 3) and 13 (Spatial canvas), as switchable themes plus a
Board map in the Flow pane. Worked out in `themes.md` (D30). Command ships first.

## How to choose

1. Pick the **organising idea** first (the column above), then the library. Most libraries can
   express most ideas; the idea decides daily use.
2. Prefer one primary concept plus at most one borrowed element. Mixing three becomes slop.
3. The pick feeds the M0 plan's UI design section (`../workflow.md` §2).

## Anti-slop rules used for all concepts

- No gradient washes, glassmorphism, emoji icons, or left-border accent cards as decoration.
- One accent colour per concept; every status is told apart by text or shape, not colour alone.
- Text contrast at least 4.5:1, touch targets at least 44 px for primary actions.
- Real copy from our scenario, no lorem ipsum, no invented metrics.
- Typefaces chosen for the concept (IBM Plex, Geist, Newsreader with Source Sans, Noto Sans,
  Manrope, Public Sans, Silkscreen with Space Mono), not one default font everywhere.
