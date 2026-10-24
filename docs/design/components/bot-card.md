# Bot card

> **Status: agreed in the M0 UI design review (2026-10-22).** Changed in the M2 Bots review,
> round 9 (2026-10-23): pin button (`pin.md`), "Add here", status words and colours from
> `bot-status.md`. Previews: `../previews/command-dark/top-header.png`, card 7 and the "7 in
> depth" row (7a–7h); `pin.png` (P2) for the pin button and "Add here".

Opens when the owner clicks a bot avatar in the top header. Only one card is open at a time:
clicking another avatar swaps it; clicking the same avatar, Esc or a click outside closes it.

## 1. Anatomy

260 px wide, `surface-raised`, 1 px `outline-strong`, radius `radius-card`, shadow. Three parts
divided by 1 px `outline-strong` lines:

1. **Identity row:** 36 px avatar with **no badge**; bot name (semibold); under it the bot's
   **short description** on one line, cut with "…". At the right edge of the name row: a 22 px
   **pin button** (`pin.md` §1: "Pin to top" / "Unpin") and a 20 px gear button that opens the
   bot's settings in a new tab.
2. **Status row:** state icon + state word (line 1); under it a **description of what the bot is
   doing**, up to 3 lines (`line-clamp: 3`), then "…".
3. **Actions:** **Message** (opens the owner's one 1:1 with this bot, creating it the first time)
   and **Add here** (adds the bot to the open conversation; the keyboard and touch alternative to
   dragging; greyed with the reason, such as "Already here", when it cannot).

## 2. Status row by state

Words, icons and colours come from `bot-status.md` (amber only for Waiting for you, red for a
problem). The row shows the state in the open conversation.

| State | Icon | Line 1 | Click on the row |
| --- | --- | --- | --- |
| Idle | Grey dot | Idle (`on-surface-muted`) | Nothing |
| Queued | Clock | Queued (`on-surface-muted`) | Opens the conversation it is queued in |
| Running | Spinner in the bot colour | Running (`on-surface`) | Opens the conversation it is working in |
| Waiting for you | Amber "?" | Waiting for you (`primary`) | Opens the conversation at the question it asked |
| Waiting on another bot | Hourglass | Waiting for BA (`on-surface-muted`) | Opens the conversation where it waits |
| Paused at the cap | Red square | Paused · daily cap (`danger`) | Opens Settings → Limits |
| Last run failed | Red "!" | Last run failed (`danger`) | Opens the conversation at the message that explains the failure |
| Not in this conversation | Dashed circle | Not in this conversation (`on-surface-muted`) | Nothing; Add here is enabled |

A clickable row lightens on hover and uses `cursor: pointer` (the system pointer, no custom
cursor). It holds no buttons and no conversation name. Failure text is a short reason, never the
raw error.

## Data this needs (requirements PR)

- A bot **short description** field (shown on one line here).
- A short **activity description** of the current run, taken from the label of the step that is
  running (for example "Reading stories.md to draft the login screen flows"). No extra model call.
