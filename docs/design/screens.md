# Screen sketches

> **Status: sketches for discussion, not final designs.** The owner will decide the actual UI
> (layout, visual style, components) at the start of implementation, in each slice's plan.
> Until then these only show which elements exist and roughly where. Acceptance criteria live
> in `../requirements/`.

## §1. App shell, rail and header

```
┌────┬──────────────────────────────────────────────────────────────────┐
│ ＋ │  (BA)(Des)(QA) …   bot avatars, draggable        Bots  Skills  ⚙ │  header
│────├──────────────────────────────────────────────────────────────────┤
│ ◉  │                                                                  │
│ ◎  │                    page content                                  │
│ ◎  │                                                                  │
│    │                                                                  │
└────┴──────────────────────────────────────────────────────────────────┘
 rail (72 px)
```

## §3. Conversation page

```
┌─────────────────────────────────────────────────────────────┬─────────────┐
│ Login redesign   (BA)(Des)  [+ Add bot]  Discussion: on 3/5  [■ Stop] [⚙]│ Files       │
├─────────────────────────────────────────────────────────────┤ out/ba/…    │
│ (B) Binh                                       ‹ 2/2 › Edit │ inbox/…     │
│     @BA write stories for the login page                    │             │
│ (BA) BA                                                      │             │
│     Here are the stories…                                    │             │
│     [write-user-stories v3] [team-style v1 · always]         │             │
│ ┌ system ─────────────────────────────────────────────────┐  │             │
│ │ Designer joined. What can it read?  [Full] [From here on]│  │             │
│ └──────────────────────────────────────────────────────────┘  │             │
├─────────────────────────────────────────────────────────────┤             │
│ [📎] Message…  (@ opens member list)                  [Send] │             │
└─────────────────────────────────────────────────────────────┴─────────────┘
```

## §10. Statistics page

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Statistics  Conversation: [All ▾]  [‹‹][⏱ Last 30 days Local ▾][››][⊖][⟳][Off▾] │
├──────────┬──────────┬──────────┬──────────┬───────────────────────────────┤
│ Cost     │ Runs     │ Tokens   │ Failed   │                               │
│ $4.21    │ 312      │ 2.1 M    │ 1.9 %    │   (each with change vs previous period)
├──────────┴──────────┴──────────┴──────────┴───────────────────────────────┤
│ Models   [Cost | Tokens | Requests]   stacked bars per day, one colour per model │
│ table: model · requests · in/out/cache tokens · cache hit % · cost · p50 latency · errors │
├──────────────────────────────────────────────────────────────────────────┤
│ Bots     horizontal bars ranked by [Runs | Cost | Tokens | Active time]   │
│ table: bot · runs · bot turns · handoffs · cost · avg run duration · failure % │
├──────────────────────────────────────────────────────────────────────────┤
│ Skills   horizontal bars: runs that loaded each skill, split always/on-demand │
│ table: skill · runs · bots using · version mix · last used                │
│ "Pinned but never loaded" list                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## §11. Time range picker

```
[‹‹]  [⏱ Last 30 days   Local ▾]  [››]  [⊖]  [⟳ Refresh] [Off ▾]
        │
        ▼ popover
┌──────────────────────────────────────┬───────────────────────────┐
│ Absolute time range                  │ 🔍 Search quick ranges     │
│ From [now-30d              ] [📅]    │ Last 15 minutes            │
│ To   [now                  ] [📅]    │ Last 1 hour                │
│ [⧉ copy] [📋 paste] [Apply time range]│ Last 6 hours               │
│                                      │ Last 24 hours              │
│ Recently used absolute ranges        │ ▌Last 7 days   (selected)  │
│ 2026-10-18 00:42 to 2026-10-18 01:07 │ Last 30 days               │
│ …                                    │ Today / Yesterday / …      │
├──────────────────────────────────────┴───────────────────────────┤
│ Local time (Asia/Ho_Chi_Minh) UTC+07:00        [Change time settings] │
└──────────────────────────────────────────────────────────────────┘
```
