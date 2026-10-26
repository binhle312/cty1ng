# Conversation page

> **Status: agreed in the M3 UI design review, round 10 (2026-10-24 and 2026-10-25)**, steps 1–3,
> 5 and 6. Previews in `../previews/command-dark/`: `conversation-page.*` (layout C1),
> `conversation-header.*` (H2), `conversation-skills.*` (K1), `conversation-reactions.*`,
> `conversation-live.*` (L1–L4), `conversation-stop.*` (P1), `conversation-errors.*` (E1–E4),
> `message-parts.*` (T1–T6). The composer is in `composer.md`; system lines and cards are in
> `conversation-cards.md`. Labels use Simplified Technical English.
> **Round 12 (M4, 2026-10-25):** the conversation menu, the members picker and Remove rules, the
> drag states, the discussion popover (M5) and the Delete dialog (§2.1–§2.4). Previews:
> `conversation-menu.*`, `conversation-members.*`, `conversation-drag.*`,
> `conversation-delete.*`. There is no conversation settings page.

The conversation page is the page content area of the shell (`left-bar.md`, `top-header.md`,
`user-panel.md`). Requirements: `../../requirements/conversation.md` (UI-3). Rules:
`../../conversation-rules.md`.

The previews show some options that the owner did not choose (H1, P0, P2). The agreed card of
each board is the one with the "Approved" label. The layout board (`conversation-page.*`) was
drawn before the header changes; the header in `conversation-header.*` (H2) wins.

## 1. Layout (C1)

| Part | Rule |
| --- | --- |
| Reading column | One centred column, at most 760 px wide, with 16 px side padding. Messages, cards and the composer use the same column |
| Space between messages | 20 px |
| Owner message | At the right. Text in a box: fill `surface-bubble` (new token, see §9), radius 12 12 4 12 px (the small corner points to the owner), padding 8 × 11 px, at most 78 % of the column. The time (11 px, `on-surface-muted`) is above the box at the right |
| Bot reply | Full column width, no box. Avatar 28 px at the left. The name line: name (13 px, weight 600), then model and effort as plain text ("Claude Sonnet · High", 11 px, `on-surface-muted`, effort with a capital letter, the same text as the Create bot preview card), then the time. The text comes from `Message.run` (`api.md` §8): the model and effort of that run, not the bot's current settings The text starts under the name, indented to the name |
| Mention | A token "@BA" in the bot colour on a dark tint of the bot colour, radius 4 px |
| Deleted bot | Avatar and name in grey, tooltip "Deleted bot" (UI-3.2) |

The owner has no avatar in the column: the right side says who wrote it. Small grey text on the
page (times, hints, placeholders) always uses `on-surface-muted`, never a darker grey: it must
pass the 4.5:1 contrast test (`../themes.md` §5) (T1).

## 2. Header (H2)

The round 6.1 conversation header, height 52 px, `outline` line under it:

1. Left: the conversation icon and the title. A click on the title renames it (UI-3.15).
2. Right, in this order: the **add slot**, the member avatars, **Flow**, and **⋯**.

| Part | Rule |
| --- | --- |
| Add slot (+) | A 24 px circle, dashed slot standard (`dashed-slot.md`): rest = dashed `outline-strong`, a "+" in `on-surface-muted`. It is **always first**, before the member avatars, also when the conversation has no bots. A click opens the picker of bots that are not members (not deleted, available), in header order (§2.2). While a bot is dragged from the top header, the slot is active (dashed `primary`, `primary-tint` fill). A drop on the slot or on the conversation area adds the bot (`top-header.md` row 8). Tooltip and `aria-label` "Add bot" |
| Member avatars | 24 px, 4 px apart, in join order. State badges follow `bot-status.md` and scale with the avatar (a 16 px badge at 36 px is 44 %, so about 11 px at 24 px). A pending member is grey until the owner chooses its history (`conversation-cards.md` §2) |
| Members menu | A click on any member avatar opens one menu with a row per member: avatar, name, model · effort (11 px, `on-surface-muted`) under the name, and **Remove** at the right of the row. The menu has no "Add bot" item: a bot is added only with the add slot, a drag or **Add here** on the bot card. Remove rules in §2.2 |
| Flow | The agreed Flow button (round 6.1), 28 px |
| ⋯ | The conversation menu (§2.1), the same menu as ⋯ on the bar 2 row |

The header has no Stop button (Stop is in the composer, `composer.md` §4) and no settings gear:
there is no conversation settings page. The discussion status comes with slice M5 (§2.4).

### 2.1 Conversation menu and Delete (UI-9.7, UI-1.6, D60)

- Items: **Rename**, **Memory** (opens the Memory pane, D44), **Move to project** (only in a
  Home conversation; a project conversation has no move item, D61), a divider, then **Delete** in
  `danger` text. ⋯ on the bar 2
  row (it shows on hover or focus) and ⋯ in the header open the same menu.
- **Delete** opens a dialog (the Delete project dialog pattern, `project-settings-page.md` §6):
  - Title: **Delete {title}? 🧹**
  - "The conversation goes to Trash with:", then the real counts: 💬 "{n} messages and {n}
    runs", 🧠 "{n} conversation memory items" (only when the conversation has conversation
    memory).
  - 📁 "Its files stay in the {project} Library." (Home: "the Home Library"; D52 amendment
    2026-10-25).
  - Only while a bot is queued or running: ⏹ "{bot} is running. The run stops first."
  - Only in a project: 📂 "A restore puts it back in {project}."
  - ↩️ "You can restore it from Trash for 30 days. After 30 days, the app deletes it." (the
    number is `trash_days`).
  - Buttons: **Cancel** (default, with the focus ring) and **Delete** (`danger` fill). The owner
    does not type the name.
- After Delete: runs stop first, then the conversation goes to Trash. The newest other
  conversation in the same place (the project or Home) opens; with none, the empty state shows.
  A toast says "{title} is in Trash." The word **Trash** is a link to the Trash page. No Undo
  (`buttons.md` §6).

### 2.2 Add and remove members (UI-3.15, conversation-rules §3)

- **Picker** (a click on the add slot): one row per bot that can run and is not a member, in
  header order: avatar, name, model · effort under the name. Unavailable bots are not listed.
  A click on a row adds the bot: it shows grey in the header and the join card asks what it can
  read (`conversation-cards.md` §2).
- **No bot left:** the picker says "Every bot that can run is in this conversation." and has
  **+ Create** (secondary, 30 px), which opens the create bot page.
- **Remove:** no dialog and no Undo. The bot leaves at once, its avatar goes from the header, and
  the system line "{bot} left" shows. Adding it again asks for its history again.
- **Remove while working:** while that bot is queued or running, Remove is off (40 % opacity)
  with the tooltip "{bot} is working. Wait until it is done, or press Stop."

### 2.3 Drag a bot from the top header (UI-2.4, UI-2.5)

- A bot that can join: the conversation area becomes an active dashed slot (dashed `primary`,
  `primary-tint` fill) with "+ Drop to add {bot} to this conversation", and the add slot is
  active too. A drop on either adds the bot, and the join card shows.
- A bot that is already a member, or cannot run: no slot. A tooltip at the pointer says why:
  "Already here", or "{bot} cannot run: API key not set" (the UI-2.3 reason).
- Keyboard and touch: **Add here** on the bot card (`bot-card.md` §1).

### 2.4 Discussion status and settings (M5, UI-9.3)

- The status is a small pill after the title: "Discussion: on · 3/5 used" or "Discussion: off".
- A click opens a popover: title "Bot discussion", the choice "Use global (off)" / On / Off and
  **Turn limit** ("Use global (5)" or 1–20), then "A change saves at once and applies from the
  next bot message." There is no Save button.

## 3. Under a bot reply

### 3.1 Skill chips (K1)

- Chips list `skills_used` as `<slug> v<version>`, mono font 10.5 px, `surface-container` fill,
  `outline` border, pill shape. An always-load skill adds " · always" (UI-3.6).
- Order: skills the bot loaded for this task first, always-load skills last.
- Only the first 3 chips show. Then a dashed chip "+N more" (dashed `outline-strong`,
  `on-surface-muted`). A click on it shows all chips on more lines and "Show less".
- A click on a chip opens that exact version in a side sheet (UI-3.6). No chips when no skill was
  used.

### 3.2 Good answer and Bad answer

- Two 26 px icon buttons with no border: thumbs up and thumbs down line icons in
  `on-surface-muted`, at the right end of the chip row.
- They show on hover or focus of a complete reply. A selected one stays visible.
- `aria-label` "Good answer" and "Bad answer". Tooltip: "Your ratings help <bot> improve its
  skills" (UI-3.28). The rest of the behaviour is UI-3.27.

### 3.3 Usage tooltip (T2)

The time of a bot reply can take focus. On hover or focus it gets a dotted underline, and a
tooltip shows "Usage of this reply", then "Input 12,400 tokens · Output 1,850 · Cache read 9,000",
then "Estimated cost $0.04" (UI-3.6b, D21).

## 4. Status reactions (only while a run waits)

The owner chose (2026-10-24 16:09) to show reactions only while a run is queued. The reply shows
every later state (§5, §6).

- A message that starts runs shows one reaction per **queued** bot, under the message at the
  right: a 24 px pill (`surface-container` fill, `outline` border) with the bot avatar (16 px)
  and a clock line icon in `on-surface-muted`.
- Hover or focus shows "Designer: queued 10:07:12" and a × that cancels that queued run
  (UI-3.21).
- When the run starts, its reaction goes away. When all runs have started, the message has no
  reaction.
- A run refused by a limit has no reaction: a system line says why (`conversation-cards.md` §1).
- A change of reactions is announced to screen readers.

## 5. Live states (L1–L4)

| State | When | Look |
| --- | --- | --- |
| **typing** (L1) | `message.delta` events arrive; it ends 10 s after the last delta | The name line says "typing" (`on-surface-muted`). A text cursor in the bot colour ends the text. One line under the text: "1:42 · last step 0:03 ago" (time since the run started, time since the last progress) |
| **working** (L2) | No delta, for example during a long tool call | The name line says "working". The line under the text: a small spinner in the bot colour, the latest `run.step` label in plain words ("Loading skill design-ui-prototype"), then "· 1:42 · last step 0:12 ago". Never a raw tool name or its arguments |
| **queued** (L3) | A run waits for another run (D11) | The clock reaction (§4). Under the composer: "Queued: Designer" (`composer.md` §3) |
| **nobody mentioned** (L4) | A message in a conversation with 2 or more bots has no mention, so no run starts | One muted line under the message: "Nobody mentioned · no bot replies" |

The running bot's avatar has the spinner badge (`bot-status.md`) in the reply and in the header.
The live text sits in a polite live region.

## 6. Error states (E1–E3)

| State | Look |
| --- | --- |
| **Failed** (E1) | The reply keeps the text it has. A line under it in `danger`: a circle "!" icon, "Failed · <reason>", and **Retry** (secondary, 28 px), which queues the run again. The reason is plain words, never the raw error: "The model provider did not answer in time.", "used all 30 model requests in this run", "the model provider refused the request", "the history did not fit". The avatar has the red "!" badge in the reply and in the header until the next run starts |
| **Stopped** (E2) | The text so far stays. A muted line with the square icon: "Stopped by you at 1:12 · the text so far is kept". Not red, because the owner stopped it. No Retry: the owner mentions the bot again |
| **Not sent** (E3) | The owner box fades (60 % opacity) and gets a 1 px `danger` outline. Under it, in `danger`: "Not sent · Retry · Delete" (text links; Delete is local only). A later unsent message says "Not sent · waits for the message above · Delete", and Retry on the first one sends both, in order (UI-3.20). Under the composer: "No connection to the app server. Your messages are kept here until they are sent." |

A run refused by a limit (E4) is a system line, in `conversation-cards.md` §1.

## 7. Owner message tools (T3, T4)

- **Edit** (T3): a 26 px pencil icon button **under** the owner box, at the far right (the same
  place as Good and Bad under a reply). It shows on hover or focus. While a run is queued or
  running, it is off (40 %) with the tooltip "Edit is off while a bot works. Stop it, or wait."
- A click opens the edit in place, with no dialog: the box becomes a text box with a 1 px
  `primary` border and the focus in it. Under it: an info icon and "Saving starts a new branch.
  Files the bots changed are not rolled back.", then **Cancel** (secondary) and **Save**
  (primary, far right). Esc cancels. The keys are the composer keys (`composer.md` §1).
- **Branch switcher** (T4): a message with other versions shows "‹ 2 / 3 ›" under it, left of
  Edit. It is always visible, not only on hover. The arrows change the branch shown below the
  message (UI-3.9).

## 8. New messages and Markdown (T5, T6)

- **New divider** (T5): a 1 px `primary` line with the word "New" in `primary`,
  above the first message after `last_read_seq`. It stays until the owner leaves the
  conversation (UI-3.10). `primary` is used because the divider is a marker, not a bot state
  (owner, 2026-10-24 16:50).
- **New messages pill**: when the owner has scrolled up and messages arrive, a pill "2 new
  messages" with a down arrow floats above the composer. A click scrolls to the end.
- **Markdown** (T6), always with raw HTML off (`../../security.md`):
  - Headings are small (14 px, weight 600). Paragraphs 13 px.
  - Tables: thin `outline` lines, header row in `on-surface-muted`.
  - Code blocks: `surface-container` fill, a language label at the top left and **Copy** at the
    top right. Inline code uses the mono font.
  - A workspace file path is a link that opens the file viewer (UI-3.16).

## 9. New token

The owner box needs a fill one step lighter than `surface-raised`. This spec names it
`surface-bubble`. Its value per theme goes into `../themes.md` §3 in a later PR (that file is
in an open PR now). Until then, the Command dark value is the one in the preview.
