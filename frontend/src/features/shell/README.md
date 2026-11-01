# shell

The frame around every page: the left bar (rail, bar 2, user panel) and the top header
(`docs/requirements/app-shell.md`; specs `left-bar.md`, `top-header.md`, `user-panel.md` in
`docs/design/components/`). M0 shows their first-run state (M0c plan §2).

| File | What it is for |
| --- | --- |
| `app-shell.tsx` | The layout: only the main area scrolls; Ctrl+B |
| `rail.tsx` | The rail: Home and the New project tile (turned off until M5b) |
| `bar-two.tsx` | Bar 2 on Home, first run, with its ⋯ menu |
| `bar-two-state.ts` | Whether bar 2 shows: the owner's saved choice, a page that hides it, the Ctrl+B rule |
| `user-panel.tsx` | The floating user panel and its menu, expanded and collapsed |
| `top-header.tsx` | The bot roster: pinned zone, drag to pin and reorder, ‹ › scroll, the add slot |
| `header-order.ts` | Deferred reordering of the others, and what a drop in the header does (pure) |
| `header-bot-card.tsx` | The bot card that opens from a header avatar |
| `turned-off.tsx` | A control that is in the design but does not work yet (`ui-rules.md` B5) |

Start here: `app-shell.tsx`. Do not: add tools to the rail (they live in the user panel menu).
