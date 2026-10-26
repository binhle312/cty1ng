# D62. One Trash page for every deleted item, memory items included

Status: proposed (2026-10-26). From the M5b UI design review, round 15: the owner approved the
Memory page boards (13:28, "deleted memory item goes to Trash"), the Trash page boards with
multi-select and the label **Delete** (13:40, 13:43), the purge check interval (13:43) and the
Move dialog (13:52). The owner moves it to `accepted`.
Amends: D38, D49, D60

Decision:

- **Memory items go to Trash.** Delete on a memory item (Memory page, Memory pane, bot page
  Memory tab) moves it to Trash (`memory_items.deleted_at`) for `trash_days` (D49). The toast
  says "The item is in Trash." with Trash as a link, and has no Undo (D49 Undo rule). This
  replaces the fixed "30 days" of D38 for the items that the owner leaves behind when a
  conversation moves into a project: they go to Trash too, for `trash_days`.
- **One Trash page.** Trash lists projects, conversations, bots, skills and memory items in one
  list, newest delete first, with a kind filter (All items, Projects, Conversations, Bots,
  Skills, Memory items). Each row shows the kind, the name, its place, when it was deleted, and
  "Deletes on {date}" (`deleted_at + trash_days`, local date). The way in is **Trash** in the
  user panel menu, after Memory, with the count of items.
- **Two buttons per row: Restore and Delete.** The label is **Delete**, not "Delete now": the
  row is already in Trash, so "now" adds nothing (owner 2026-10-26 13:40, UI rule W2). Delete is
  a permanent delete and is the only delete with an Undo toast (D49).
- **Several items at once.** Each row has a check box. With one or more ticked, a bar shows
  "{n} selected · Clear · Restore {r} · Delete {d}". An item that cannot be restored (its place is
  in Trash, D60) is not counted in Restore, and the button tooltip says why. Ticking its place
  too makes it restorable, because the app restores places first. One Undo toast covers a
  multi-delete.
- **Undo of a permanent delete.** The page holds the delete for the toast time and sends it
  when the toast closes. Undo cancels it, so nothing was deleted. If the page closes before
  that, the delete is not sent and the item stays in Trash. The toast time is the setting
  `undo_seconds` (default 10).
- **Restore when the place is in Trash.** The D60 rule applies to every item that has a place:
  a conversation, a memory item of a project, conversation or bot in Trash. Restore is off, the
  tooltip says "Restore {place} first", and the row links to the place's row. The server
  refuses with 409 `place_in_trash`, which replaces `project_in_trash`.
- **Items that went with their place.** A project delete moves its conversations and memory as
  one item (D47); they are not separate rows. An item deleted before its place keeps its own row
  and deadline (D60), and is purged with its place at the latest.
- **When the purge runs.** The purge job runs at start and every `PURGE_INTERVAL_HOURS` (an
  environment variable, default 24). It purges each item whose `deleted_at + trash_days` is at
  or before now, read from the clock port, one item per transaction. It is idempotent: a second
  run finds nothing. `trash_days` stays the time an item is kept; the interval is only how often
  the app looks. So an item can stay up to one interval longer than `trash_days`, never shorter.

Example: The owner deletes "The app supports English and Vietnamese." from Login app memory on
2026-10-26. Trash shows it as "Memory item · Login app · Deleted 1 min ago · Deletes on
2026-11-25". The owner ticks it with two other items and presses **Delete 3**. The toast says
"3 items are deleted for good. Undo". The owner does nothing for 10 seconds, so the app deletes
the 3 items.

Why: One place for deleted things is easier to learn than a different rule per kind. D49, D50
and D60 already send projects, skills, bots and conversations to Trash; memory items were the
last kind with their own rule (30 days, only on the Memory page). A Trash page with no
multi-select made the owner press Delete once per row.

Rejected:

- **Memory items keep their own 30 days on the Memory page.** Two rules and two places for
  deleted items.
- **"Delete now".** It breaks W2. The row is in Trash, so the word "now" says nothing new.
- **A server-side Undo** (mark the item, purge it later). It needs a second timer next to the
  purge job, for a gain only when the owner closes the page inside 10 seconds. The page-held
  delete fails safe: the item stays in Trash.
- **A purge interval as a Settings item.** The owner does not need to tune it; an environment
  variable keeps it configurable (AGENTS.md §10).

Consequences: `memory_items` purge deletes the row and its versions. The Trash page needs one
list endpoint over five tables and batch restore and delete endpoints (`../api.md` §5c). D49's
and D60's "Delete now" wording is read as **Delete**. `project_in_trash` becomes
`place_in_trash`.

Implemented in: `../design/components/trash-page.md`, `../design/components/memory-page.md`,
`../domain-model.md` §10, §14, `../api.md` §5c, task M5b.
