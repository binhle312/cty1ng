# Library parts in a conversation

> **Status: agreed in the M6 UI design review, round 17 (2026-10-27):** boards C1–C7 and C7b
> (step 2, 15:49). Previews: `../previews/command-dark/library-cards.*` (C1–C7b), a `.png` and a
> `.html`. Follows D52, D54 and D61. The card look, the fold and the buttons come from
> `conversation-cards.md` §1 and §3, `plan-card.md` and `buttons.md`. The Library page is in
> `library-page.md`. The labels and messages use Simplified Technical English.

These parts show in the conversation when a run saves to the Library, when a run stops with
unsaved changes, and when a bot proposes a copy. Times in them use the 24-hour clock
(`time-format.md` §1, T2).

## 1. Overlap notice (C1, C2)

A system line (`conversation-cards.md` §1, the info icon, `on-surface-muted`) under the reply of
the run that saved, one line per overlap file (D52):

| Case | Text | Link |
| --- | --- | --- |
| Different lines: git merged both changes | "`{path}` also changed in {conversation}. Both changes were merged." | **View file** |
| Same lines: this run's version won | "`{path}` also changed in {conversation}. This version was saved." | **Restore other version** |

- **View file** opens the Library page on that file (`library-page.md` §1).
- **Restore other version** saves the other version as a new save "Owner restore", through the
  save queue (D52). Then the line ends with "· Restored {time}" and the link goes away. The toast:
  "Restored the version from {conversation} ✨".
- A binary file always uses the second row (D52).

## 2. Plan card mark (C5)

In a Home conversation, a planned write to a file that a run of another conversation saved last
gets one more line under its file row (D52 amendment 2026-10-25): the info icon and "last saved
in {conversation}" (the conversation is a link), 11 px `on-surface-muted`. It is a fact, not a
block, so it is not amber (C1). The owner approves, rejects or asks for another file name.

Cards in §3 and §4 draw from the run's save state (`api.md` §5d, `GET /runs/{id}/save`), so they
show the same after a refresh or in another tab.

## 3. Unsaved changes card (C3)

A failed or stopped run that wrote files shows this card under its failed (E1) or stopped (E2)
line (`conversation-page.md` §6). It is the same part as the card on the Library page
(`library-page.md` §5); only the head is shorter, because the conversation and the bot are
already above it:

- Head: **Unsaved changes**, then "{n} files are not saved" in `on-surface-muted`, and **Show** /
  **Hide** at the right (the diff of each file, loaded on Show from `GET /runs/{id}/save/diff`).
- The file rows: sign and path (`library-page.md` §5).
- Foot: "Discarded on {date} if you do nothing.", **Discard** (danger 30), **Save to Library**
  (primary 30).
- After a choice the card folds: "**Unsaved changes** [Saved] 12:52 · 2 files · Show" or
  "**Unsaved changes** [Discarded] 12:52 · 2 files". Discard has the Undo toast (B7). A card
  that the app discarded after `trash_days` folds to [Discarded] with "after {trash_days} days",
  where {trash_days} is the value that applied to that run (default 30). The text never has a fixed
  number.
- Retry is an action on the failed reply (the E1 line), not a separate chip in the Flow timeline.
  It queues the same run again (UI-3.7), so the Flow timeline keeps one run chip with "· retried
  once" (`flow-timeline.md` §4). The new try starts from the newest main. It does not use the
  unsaved changes of the failed try; they stay untouched until the owner chooses or the date
  comes (D52, owner 2026-10-28).

## 4. Save card: changes outside the plan (C4)

A delete or move that the approved plan did not list needs the owner's choice at save time
(D52, D54). The run ends, the save waits, and this card shows inside the bot's last reply:

- Head: **Save**, "{n} changes are not in the plan" in `on-surface-muted`, and the pill
  **Waiting for you**.
- The line: "{bot} is done. The app saves the {k} planned files with your choices. Nothing is saved
  until you press Save."
- One row per change: the sign (− delete in `danger`, → move), the path ("`a.md` → `b/a.md` ·
  move"), the bot's reason under it in 11.5 px `on-surface-muted` ("BA: the new
  sign-in-errors.md replaces it."), and a **Reject | Approve** segmented control at the right
  (P9). No choice is selected at first.
- Foot: **Save** (primary 30). It is off until each row has a choice (B5 tooltip "Choose Reject
  or Approve for each change."). Approve saves the change with the rest of the run. Reject saves
  the rest of the run without it (D52).
- The conversation shows "Waiting for you" for that bot until Save. The next run in this
  conversation waits for the save (D52, run order).
- After Save, the card folds: "**Save** [Saved] 11:18 · 2 files · 1 approved, 1 rejected · Show".

## 5. Copy card (C6, C7, C7b)

A bot that calls `propose_copy` (D61) shows this card inside its reply:

- Head: **Copy to another place** and a pill: **Waits for the save** (`surface-raised`,
  `on-surface-muted`) while its run has not saved, then **Waiting for you**.
- Rows, label column 90 px: **Source** (this place), **File** (mono), **Version** ("saved {time}
  by {bot}", the commit id in the tooltip; before the save: "the version that this run saves",
  in `on-surface-muted`), **Destination**.
- **Show file** (secondary 30) opens the pinned version on the Library page, with the "Older
  version" line when a newer one exists (`library-page.md` §3.4). It is not shown before the save.
- When the file changes again before the decision: "A newer version was saved at {time}.
  Approve still copies the {time} version." (D61)
- Buttons: **× Reject** and **✓ Approve** (primary, far right). No buttons before the save.
- Folded lines (`conversation-cards.md` §3), each in the reply that made the card:
  - "**Copy** [Approved] 11:33 · handoff/auth.md → Travel app · Show"
  - "**Copy** [Rejected] 11:36 · notes.md → Website · Show"
  - "**Copy** [Cancelled] 11:38 · the run did not save · tests/plan.md → Travel app · Show"
    (the run failed or the owner discarded its changes, D61)
- Approve copies the pinned version and posts the toast "Copied to {place} ✨" with **Open**
  (`library-page.md` §6). No bot starts in the destination.
- When the bot reaches `copy_proposals_max_per_conversation_24h`, the tool returns
  `{error: "limit_reached"}` and no card shows. The bot says so in its reply (D61).
