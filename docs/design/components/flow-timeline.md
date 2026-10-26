# Flow pane: Timeline map

> **Status: agreed in the Flow view sketch round, round 11 (2026-10-25).** The owner approved the
> Timeline board F2 ("timeline look good", 13:01) and chose "Timeline only, Team map later"
> (D26 amendment 2026-10-25). On 2026-10-26 the owner approved the PR #33 review fixes (finished steps
> only, one chip per run after a Retry, the lane and overflow rules in §3) and the run card R3
> with tries, step times and a footer (from the owner's mockup). The **Animations switch** (§6) is **New, not agreed**: it waits for the owner in the PR
> review. Previews: `../previews/command-dark/flow-timeline.png` (and `.html`, which shows the
> breathing outline) and `flow-timeline-overflow.png` (7 bots, the map scrolled sideways).

The Flow pane shows how the work in one conversation happened. In M8 it has one map, the
Timeline. Requirements: `../../requirements/flow-view.md` FL-1, FL-3, FL-4, UI-12.1 to UI-12.9
(UI-12.4 is parked). Behaviour, animations and budgets: `../../flow-view.md`. Status words and
colours: `bot-status.md`. Times: `time-format.md` (the conversation exception: 24-hour clock).

## 1. Pane

| Part | Rule |
| --- | --- |
| Place | Beside the conversation, after the draggable divider (`../../flow-view.md` §2). The Flow button in the conversation header is pressed while the pane is open |
| Fill | `surface-container` |
| Header | Height 52 px, 1 px `outline` line under it. Left: Flow icon and "Flow · Timeline" (600 weight). Right: the Animations switch (§6), then the ⇄ "Swap sides" and ✕ "Close Flow" icon buttons (30 px, `buttons.md` §2) |
| Tabs | None while there is one map. When the Board ships (M8b), the header shows a tab strip "Timeline · Board" in place of the map name |
| Footer | None. Labels explain the map, so there is no legend |

## 2. Lane heads

One lane per participant: **You** first, then the bots in the order they joined.

| Part | Rule |
| --- | --- |
| Head | Avatar 24 px (`bot-avatar.md`) with its live status badge (`bot-status.md`: spinner = running, clock = queued, amber "?" = waiting for you), the name under it in 11 px `on-surface-muted` |
| Lifeline | A 1.5 px vertical line in `outline` from the head to the bottom of the pane |
| Removed or deleted bot | The head and lifeline are greyed (40% opacity). Items before the removal stay |
| Click on a bot head | Filters the conversation to that bot's messages, with a removable filter chip (UI-12.6) |

## 3. Layout

| Part | Rule |
| --- | --- |
| Time column | Left, 11 px `on-surface-muted`, tabular numbers, 24-hour clock ("09:12"). A time shows on the row where a new owner or bot action starts; the run chip that follows it has no time |
| Rows | One item per row, about 24 to 30 px apart, oldest at the top, newest at the bottom |
| Top line | "Active branch only · Load earlier" in 11 px `on-surface-muted`, centred. "Load earlier" is a link that loads 50 more items (`../../flow-view.md` §5 rule 7) |
| Lane width | The lanes share the pane width. Each lane is at least 72 px wide |
| Sideways scroll | When the lanes do not fit, the lanes scroll sideways (a thin scroll bar at the bottom). The time column stays fixed, 50 px wide, with a `surface-container` fill and a 1 px `outline` line at its right, so lanes, arrows and labels pass under it |
| Labels | One line each. An arrow label starts 6 px right of the left end of its arrow, never under the time column, and stops at the far end of the arrow. Text that does not fit ends with "…", and a tooltip on hover or focus shows the full text. Lane names longer than the lane end with "…" too |
| Chips | A run chip is centred on its lane. When a centred chip would pass the pane edge, it moves inward until it fits (at the right edge it ends near its lane) |
| Run card | 264 px wide. It starts 12 px left of its lane and grows to the right. If it would pass the right edge of the pane, it moves left until it fits, but never under the time column. It sits above the lanes and arrows it covers. While a card is open, the rows after it move down |
| Keyboard | The map itself is not a tab stop for each item. Keyboard and screen reader users use the list alternative (UI-12.9), which has the same items and clicks. With focus on the map, the left and right arrow keys scroll it sideways |

## 4. Items

| Item | Look | Example |
| --- | --- | --- |
| Message | Arrow (1.5 px, `on-surface-muted`, filled head) from the sender's lane to each mentioned bot. Label above it: the start of the message in quotes, 11 px, one line, cut with "…" | 09:12 You → BA "write the sign-in stories" |
| Message to two bots | One arrow per bot, on the same row | 10:02 You → Designer and QA "@Designer 2FA screen, @QA tests" |
| Handoff, approved | Solid arrow from the bot to the target bot. Label "Handoff · 2 files" and a `success` ✓ "approved" | 09:26 Designer → Writer |
| Handoff, rejected | Dashed arrow in `on-surface-muted` at lower contrast. Label "Handoff · ✕ rejected by you" | 09:31 BA → QA |
| Handoff, waiting for you | Dashed arrow in `primary` (amber). Label "Handoff · Waiting for you" in `primary` | Designer → QA |
| Run chip (finished) | One chip per run, on the bot's lifeline, on the row of the run's first start. Padding 2 × 8 px, `radius-control`, 1 px `outline-strong` border, `surface-raised` fill, 11 px. ✓, "Run" in `on-surface`, then "4 steps · 1:02 · $0.07" in `on-surface-muted`. A run after a handoff adds "· turn 2 of 6" (bot turn n of limit) | BA "Run 4 steps · 1:02 · $0.07" |
| Run chip (failed) | `danger` border and tint, "!" icon, "Run failed" in `danger`, then the short reason and the time: "· no answer in time · 0:31". Never the raw error | Designer, before a Retry |
| Run chip after a Retry | Retry queues the **same** run again (UI-3.7, `../../conversation-rules.md` §2), so the run keeps its one chip. The chip shows the latest state and adds "· retried once" (or "· retried 2 times") with a redo icon. Steps, time and cost count all tries. The count is the run's `run_slots` rows minus one. A click opens the run card, which shows each try (below) | 09:40 Designer "Run 2 steps · 1:09 · $0.05 · retried once" |
| Run chip (stopped) | Same as finished, with a grey square and "Stopped by you" | — |
| Queued | Pill (`radius-pill`, `surface-raised`, 11 px `on-surface-muted`) with the clock icon and "Queued", on the bot's lifeline under the message that queued it (D11) | 10:02 QA |
| Run card | A click on any run chip opens its card; "Hide" folds it back to the chip ("Show" opens it again; fold links say only Show or Hide). The running run's card is open by default. Padding 9 × 10 px, `radius-card`, 1 px `outline-strong` border, `surface-raised` fill, 11.5 px. **Header:** the run's current or end state: ✓ "Run · Finished", spinner "Run · Running", red "!" "Run failed", grey square "Stopped by you". No run numbers and no coloured badges. **Rows**, in time order, each with its local time with seconds ("09:40:05", `time-format.md`) in `on-surface-muted`: a finished step: ✓ (or a red "!" for an error) and the tool and its target ("Read `wireframes/sign-in.md`", paths in mono; never what the bot meant); a failed try: red "!" and "Try 1 failed · no answer in time" in `danger`; the owner's Retry: redo icon and "You pressed Retry · same run" in `on-surface`; a try that finished: ✓ and "Try 2 finished" in `success`. The try rows show only when the run has more than one try. While running, the last row is the same as the conversation's working state L2 (`conversation-page.md` §5): a spinner in the bot colour and "Working · last step 0:12 ago"; the app learns about a step only when its tool call ends (`run.step`), so the card never names a tool in progress. **Footer** (1 px `outline` line above it): clock icon, "2 tries · 1:09 · $0.05" ("1 try · 0:58 · $0.04 so far" while running), "Hide" at the right | 09:40 Designer (retried), 10:02 Designer (running) |
| Notice | Centred text in 11 px `on-surface-muted`, no arrow ("Bot turns used up: 6 of 6") | — |

Status colours follow `bot-status.md`: amber only for "Waiting for you", red only for a problem,
running in the normal text colour with a spinner in the bot colour, idle and queued grey.

## 5. Clicks

| Click on | Result |
| --- | --- |
| A bot lane head | Filter the conversation to that bot (UI-12.6) |
| A message arrow, run chip, run step or handoff | Scroll the conversation to it and highlight it |
| Scrolling the conversation | Highlights the matching item in the Timeline |
| A run chip | Opens its run card (and scrolls the conversation to the reply) |
| Hide / Show on a run card | Fold or open the card. It does not change the run |

The accessible list alternative (UI-12.9) lists the same items in the same order with the same
click results.

## 6. Animations switch (**New, not agreed**)

| Part | Rule |
| --- | --- |
| Place | Pane header, left of ⇄. Text "Animations" in 12 px `on-surface-muted`, then a switch 30 × 18 px |
| Switch | On: `primary` track, knob at the right. Off: `outline-strong` track, `on-surface-muted` knob at the left |
| Default | On |
| Value | The same per-browser value as Settings → Appearance → "Always reduce motion" (UI-8.5), the other way round: On = reduce motion off. A change in one place shows in the other at once |
| On | The Timeline animations in `../../flow-view.md` §4: a new row slides in, the running run card has a slow breathing outline in the bot colour (opacity only), a waiting handoff badge pulses |
| Off | Nothing moves, and spinners stop turning. The map shows the same state: the same rows, badges, colours and steps |
| System reduced motion | When the OS asks for reduced motion, the switch shows Off and is disabled. Tooltip: "Your system asks for reduced motion" |

## 7. Tokens used

`surface-container`, `surface-raised`, `outline`, `outline-strong`, `on-surface`,
`on-surface-muted`, `primary`, `danger`, `success`, `running` (spinner, from the bot colour),
`radius-control`, `radius-card`, `radius-pill`, `duration-fast`, `duration-medium`.
