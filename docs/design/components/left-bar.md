# Left bar

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas rounds 6.0 and 6.1.
> Previews: `../previews/command-dark/left-bar-rail.png` (rail) and
> `../previews/command-dark/left-bar.png` (inner bar, Memory pane, New project page), each with a
> `.html`. The Library page content is **not designed yet**.

The left bar is two bars side by side: the **rail** (projects) and **bar 2** (what is inside the
selected project, or Home). The floating user panel (`user-panel.md` §4) sits over the bottom of
both. Both lists scroll under it.

## 1. Rail (round 6.0)

Top to bottom:

1. **Home** tile. Selected: `primary-tint` fill, `primary` icon, no border.
2. A divider.
3. **New project**: a dashed rounded-square tile with "+", always shown (also when there are no
   projects). It opens the New project page (`new-project-page.md`).
4. **Pinned projects**, in the owner's order, each with a pin mark at the **top-right** of the tile.
5. A short divider (only when something is pinned).
6. **Other projects**, by creation time, newest first.

No tools on the rail (bots, skills, statistics, settings live in the user panel menu). Unread and
waiting signals on a project tile stay as in the earlier rounds. Every badge sits at the
**top-right** of the tile.

### 1.1 Pin and unpin

- Hover an unpinned project: a faded pin badge appears at the top-right. Hovering the badge makes
  it solid `primary` with the tooltip "Pin to top". Click pins it.
- The first pin goes to the top; each later pin goes below the earlier ones.
- Hover a pinned project: an unpin badge. Click returns the project to its creation-time place.

### 1.2 Reorder pinned projects

- Drag a pinned project: its slot becomes a dashed gap and a `primary` drop line shows where it
  lands. Only inside the pinned group. Esc cancels.
- A drag that starts on a pinned project reorders; a drag that starts anywhere else scrolls.
- Keyboard alternative (nice to have): right-click or Shift+F10 opens a menu with Move up, Move
  down, Unpin, Project settings.

### 1.3 Scroll

Mouse wheel or drag, a fade at the cut edge, and ˄/˅ buttons on hover (as the top header). The
list ends **24 px above** the floating user panel so the last tile is never under it. Pinned
projects scroll with the list (they are not sticky).

## 2. Bar 2 in a project (round 6.1)

Top to bottom:

1. **Project header**: 32 px project tile, name, ⋯ menu. Under it a stats line
   "4 chats · 3 bots · 12 files" in `on-surface-muted`, then the **goal** (`projects.description`) in
   `on-surface-muted`, clamped to 3 lines; hover shows the full text.
2. **Board** row, shown as "Later" until slice M8c (§5).
3. **Memory** row with its item count; a `primary` dot when a bot saved something new since the owner
   last looked. Opens the Memory pane (`memory-pane.md`).
4. **Library** row with its file count. Opens the Library page in the main area (the project's
   workspace files).
5. **Chats** section label with a "+" icon button aligned right (tooltip "New chat"). Then the
   chats, newest activity first. No folding, no separate 1:1 and group sections, no Bots section
   (bots show in the top header).

Chat row menu: Rename, Move to project, Move out of project, Delete.

## 3. Bar 2 on Home

- Title **"Home Sweet Home"**, subtitle "N bots · N skills" (skills = distinct skills used by the
  owner's bots).
- One Memory row (bot and conversation memory outside projects). No Library row.
- One chat list, newest activity first.
- **First run** (no bots): subtitle "No bots yet", a dashed button "+ Hey, let's chat 👋" in the
  same style as the rail's New project tile, and the line "Bigger work? Start a project with + on
  the left."

## 4. Hiding bar 2

Bar 2 can be hidden from the ⋯ menu or with Ctrl+B. Hidden, only the rail shows and the user panel
collapses to the avatar (`user-panel.md` §4). Bar 2 is also hidden on the New project page.

## 5. Project Board (later, slice M8c)

A read-only project-wide Board (chats as frames, live bot states, shared files, waiting handoffs),
after M8b. Hooks that earlier slices add so it fits without breaking anything:

- M5b: the conversation API object carries `project_id`; moving a chat emits
  `conversation.updated`; index `conversations(project_id)`.
- M8: the flow store keeps `conversation_id` on every run, step and handoff; selectors do not
  assume one conversation.
- M8c: `GET /projects/{id}/board` is built from tables, never from the event log (events are pruned
  after 30 days); live updates come from `/api/stream` filtered by the project's conversations.

## Requirement changes (requirements PR)

- `projects.pinned_position INTEGER NULL` (NULL = not pinned) and endpoints to pin, unpin and
  reorder. **Migration, needs approval.**
- `projects.description` becomes the goal, ≤ 500 chars (was "one line").
- New token `primary-tint` in `../themes.md` §3 (Command dark #3A2E12; Material value set in T2).
- Glossary: **Library** = the project's workspace files, as shown in the UI.
- App shell: the two bars, Ctrl+B, the Home and first-run states.
- Spec gaps found: the Flow pane has no first-load or "load earlier" endpoint; `StepKind` in
  `../../flow-view.md` lacks the D38 memory kinds and the D41 `propose_skill` kind.
