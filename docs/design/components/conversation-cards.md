# System lines and cards in a conversation

> **Status: agreed in the M3 UI design review, round 10 (2026-10-24 and 2026-10-25)**, step 5
> (E4) and step 7 (S1–S5, handoff buttons, open choices Q1–Q3). Previews in
> `../previews/command-dark/`: `conversation-cards.*` (S1–S5), `conversation-errors.*` (E4),
> `handoff-buttons.*` (the chosen B and R4) and `handoff-choices.*` (the chosen Q1-A, Q2-A,
> Q3-A). Labels use Simplified Technical English.

This file covers what the app writes into the conversation: system lines, the join card, and
where the plan card and the handoff card sit. The plan card itself is in `plan-card.md`.
Requirements: UI-3.3, UI-13.4. Rules: `../../conversation-rules.md` §3, §5.

## 1. System lines (S1, E4)

Every system line has one look: a small pill in the centre of the column.

| Part | Rule |
| --- | --- |
| Pill | Padding 6 × 12 px, radius 999 px, 1 px `outline` border, `surface-container` fill, 12 px text, a line icon at the left |
| Colour | `on-surface-muted`. `danger` only for a problem: a run that a cap refused, a run that cannot start |
| Link | An action in the pill is a text link in `on-surface` with an underline ("Open Limits", "Undo") |

Examples:

| Event | Text | Colour |
| --- | --- | --- |
| A bot leaves | "Designer left" | muted |
| A setting changes | "Bot discussion limit changed to 8" | muted |
| A daily cap refuses a run (D20) | "BA did not run. Daily cap reached ($10.02 / $10). Raise it in Settings or wait until midnight." and the link **Open Limits**. BA gets the red square badge (`bot-status.md`, "Paused · daily cap") | `danger` |
| The discussion limit is reached | "Discussion limit reached (5/5). Reply to continue." | muted |
| A join choice was made | "Designer joined · reads the full history · chosen 10:06" (§2) | muted |
| A bot saves memory | §5 | muted |

A run refused by a limit has no reaction on the message, so the system line is the only place
that says why.

## 2. Join card (S2)

When the owner adds a bot (the add slot in the header, or a drag onto it), the app posts a card
in the centre of the column (`conversation-rules.md` §3):

1. The bot avatar (grey while pending), **Designer** "joined. What can it read?" and the pill
   **Waiting for you** (`primary-tint` fill, `primary` text).
2. "Full history: Designer reads every message and file note so far. From here on: only messages
   after this line. You cannot mention Designer until you choose."
3. **From here on** (secondary) and **Full history** (primary, far right).

Until the owner chooses, the bot avatar is grey in the header, and the @ list shows it greyed
(`composer.md` §2). After the choice, the card folds into a system line: "Designer joined ·
reads the full history · chosen 10:06".

M3 has no join card: the add slot adds with full history (M3 brief). The card comes with M4.

## 3. Cards inside a bot reply (S3, S4)

The plan card (`plan-card.md`) and the handoff card sit **inside the reply** of the bot that
makes them, under its text, indented like the text.

**Data.** The handoff card stays a separate message (`kind = handoff`, `domain-model.md` §6).
It carries the `run_id` of the run that made it. The page shows a card message under the bot
reply with the same `run_id`, so the place is the same after a reload, an event replay or a
branch switch. No new column or migration is needed. The plan card follows the same rule. Its
data contract (message kind and card fields) comes with the plan card slice (D48, the D57
proposal), not with this design.

| Part | Rule |
| --- | --- |
| Card | Padding 12 × 14 px, radius 10 px, 1 px `outline-strong` border, `surface-container` fill |
| Section title | 11 px, weight 600, `on-surface-muted` ("Files", "Memory") |
| File row | The path in mono 12 px, then "new", "changed" or "pinned at a1b2c3" in `on-surface-muted` |
| Buttons | Under a 1 px `outline` line, at the right, 30 px (`buttons.md`): **× Reject** (secondary, with an × icon), **Request changes** (secondary, with a pencil icon), then the primary button at the far right: **✓ Approve** (check icon) or **+ Add <bot> and start** |

The icons make Reject and Request changes different at a glance without a new colour (owner,
2026-10-25 00:02, option R4). Reject is not `danger`: it removes nothing.

**After a decision the card folds** to one line (8 × 12 px, radius 8 px, `outline` border,
`surface-container` fill, 12 px). The line has the card name, a status pill, then the facts in
`on-surface-muted`, and a link to open the card again. The line does not repeat the word in the
pill. The link is only **Show** (and **Hide** on the open card): the card name is already on the
line, so the link does not repeat it (owner, 2026-10-25 02:28, a rule for every show/hide link). Examples:

- "**Plan** [Approved] 11:12 · 3 steps · 2 files · Show"
- "(BA) → (Designer) **Handoff** [Approved] 11:31 · Designer started · 1 file · Show"

Status pills: Approved and Done (§4, handoff to the owner) = `success` text on a `success` tint; Changes requested and Rejected =
`on-surface-muted` on `surface-raised`; Files changed = `danger` text on a `danger` tint. A
decided card has no buttons (UI-3.3).

The result of the approved work comes as a new reply under the folded line.

## 4. Handoff card (S4)

The card sits inside the reply of the bot that hands off (Q1-A, owner 2026-10-25 00:12). Top to
bottom:

1. Source avatar (20 px), **BA**, an arrow, target avatar, **Designer**, "Handoff" in
   `on-surface-muted`, and the pill **Waiting for you**.
2. The brief: the handoff `summary`, rendered as Markdown (raw HTML off). The app does not parse
   it (`conversation-rules.md` §5, D54). The bold labels on the boards (**Goal**, **Done**,
   **Assumed**, **Open**, **Ask**, **Suggested skills**) come from the bot's own text, which the
   `hand-off-work` skill asks for. When the text has other headings or none, the card shows
   the text as it is. Skill chips for suggested skills wait for the typed brief (D54).
3. **Files:** each file with "pinned at <commit>".
4. The buttons: × Reject, Request changes, **✓ Approve**.

**Target not a member** (S4d). Over the buttons: "Designer is not in this conversation. It
joins with the full history, because the files are the point." The primary button is
**+ Add Designer and start**, with a plus icon, the same sign as the add slot (owner,
2026-10-25 00:02, option B). It adds the bot as an active member with full history and starts
its run in one step (`conversation-rules.md` §5).

**Target is the owner** (`propose_handoff(to="human")`). The header is source avatar, **BA**, an
arrow, then **You**, "Handoff" and the pill **Waiting for you**. The brief and the files show as
above. The only button is **✓ Done** (primary). Done is the UI label for the normal approve
action (`POST /handoffs/{id}/decision` with `approve`); the handoff gets the normal `approved`
status, and no bot run starts. The folded line shows the pill **Done** in place of Approved:
"(BA) → You **Handoff** [Done] 11:31 · 1 file · Show". The stale check on Approve applies too.
No new API action or database status (owner, 2026-10-25 02:43).

**Stale** (Q2-A). Approve first checks the pinned files. If a file changed after the handoff,
nothing starts and the card turns stale:

- The pill becomes **Files changed** (`danger`).
- A `danger` line with the circle "!" icon: "Not started. BA changed stories/sign-in.md after the
  handoff. Ask BA to hand off again."
- No buttons, like every decided card. The card does not fold, so the reason stays visible.

The app does not watch files while the card waits; the check runs only on Approve (owner,
2026-10-25 00:12).

## 5. Memory lines (S5)

- When a mentioned bot saves, changes or forgets memory, a system line (§1) shows: a check icon,
  'BA remembered: "Prices are in USD and EUR." · Project memory' and the link **Undo**
  (UI-13.4). The line names the scope.
- With 2 or more bots, a "remember …" message with no @mention starts no run, so nothing is
  saved. The no-mention hint warns before Send (`composer.md` §2).
- When the owner mentions two bots with the same "remember", the first bot saves. The second
  bot's memory tool finds the same text in the same scope, saves nothing and returns "already
  saved", so the page shows one line (Q3-A, UI-13.16).
- **Remember offer.** When a bot only offers a memory item (D48), or an action run gets
  `memory_not_in_plan` for an item that is not on the plan (D56), a box under its reply shows
  it: 1 px dashed `outline-strong` border, radius 8 px, the text 'Save to project memory: "The
  sign-in flow asks for the email first."' and **Remember** (secondary, 28 px). The click is the
  owner's approval. After the click, the memory line above shows.
