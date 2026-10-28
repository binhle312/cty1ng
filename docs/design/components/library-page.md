# Library page

> **Status: agreed in the M6 UI design review, round 17 (2026-10-27):** boards L1–L8, L3b and
> L5b (step 1, 15:42); L2b, L9 and L9b (step 3, PR #41 review fixes). Previews:
> `../previews/command-dark/library-page.*` (L1–L9b), each a `.png` and a `.html`. Follows D52
> (with its 2026-10-25 amendment), D54, D60 and D61. The conversation parts (overlap notice,
> unsaved changes card, save card, plan card mark, copy card) are in `library-cards.md`.
> Standards it uses: `buttons.md`, `time-format.md`, `../ui-rules.md`. The labels and messages
> use Simplified Technical English.

The Library page shows the files of one place: a project Library or the Home Library (D52
amendment 2026-10-25). It works like a git UI: a file tree at the left, the file at the right, and
the history of every save. The UI never says "branch" or "commit" in a label (D52). A commit id
shows only in a tooltip and in the History tab facts.

## 1. Where it opens

- The **Library** row in bar 2 (`left-bar.md` §2 for a project, §3 for Home). The row is selected
  while the page is open. Bar 2 and the rail stay, because the place is still selected.
- A file link in a conversation (a plan card file row, an overlap notice, **View file**, **Show
  file**) opens the page on the Files tab with that file open. The page replaces the Files side
  panel of the old UI-3.16 (owner, 2026-10-27).
- **Open** in the toast after a copy (§7) opens the destination Library on the copied file.
- **Show file** on a copy card opens the pinned version of the file, not the newest one (§3.4).

## 2. Layout

The page fills the main area. Top to bottom:

1. **Page top** (padding 20 × 24 px): the title **Library** (20 px, weight 600), then one line in
   `on-surface-muted`, 12 px: "{place} · {n} files · Every bot in {place} reads these files and
   saves its work here." For Home: "Home · {n} files · Every bot in a Home conversation reads
   these files and saves its work here." (D52 privacy note). The buttons at the right, 30 px
   secondary, with icons: **+ Add from Home Library** (project only, §8) and **Open folder** (§9).
2. **Tabs** (the Skills page tab part, `skills-page.md` §2a): **Files**, **History**,
   **Unsaved changes**. Unsaved changes shows its count in a `danger` count pill when it is 1 or
   more; with 0 the tab has no count.
3. The tab content fills the rest of the page.

The page opens on the Files tab. It keeps the last tab and the last open file per place for the
session.

## 3. Files tab (L1)

Two columns:

| Part | Rule |
| --- | --- |
| Tree | 250 px, a 1 px `outline` line at the right. The search box (34 px, "Search files"; it filters by name), then the tree. Rows 28 px: fold arrow for a folder, folder or file icon in `on-surface-faint`, the name in 12.5 px, ellipsis at the end. Folders first, then files, each by name. The open file has `surface-raised` and weight 600. `.git` never shows. |
| Viewer | The rest. A head row: the path in mono 13 px, then a facts line (§3.1). At the right: the **Preview / Source** segmented control (Markdown only, 30 px), **View history** and **Copy to** (30 px secondary, with icons). Under the head, the content: Markdown rendered with raw HTML off (security rule 8); other text in mono; images and PDF in the viewer (UI-3.16); any other type: "This file type has no preview. Use Open folder to open it in another app." |

### 3.1 Facts line

The viewer reads these facts from `GET /libraries/{place}/files/detail` (`api.md` §5d).

12 px, `on-surface-muted`, with a 16 px avatar of who made the last save:

- A bot save: "Saved {time} by {bot} in {conversation}". The conversation is a link.
- An owner upload: "You uploaded it {time} in {conversation} · {size} · {width} × {height}" (L4).
- An owner edit: "You changed it {time} on your disk".
- A copy: "Copied {time} from {source place} · saved there {time} by {bot}", and under it in
  `on-surface-faint`, 11.5 px: "From {path} in {source place}. No bot started. Ask a bot in a
  {place} conversation to use it." (L6, D61).

{time} follows `time-format.md` §1: "12 min ago" under 1 day, else local ISO time.

### 3.2 attachments/ (L4)

A file in `attachments/` shows one more line under the facts, `on-surface-faint`, with a lock
icon: "Bots read files in attachments/, but they cannot change them." (D52). Preview / Source
does not show for an image.

### 3.3 The New tag (L1, L6)

A file that a copy added (D61) has the **New** pill in the tree. The **Library** row in bar 2 has
the same pill while one new file or more remains. Opening the file clears its tag. Opening the
page alone clears nothing (D61). The viewer sends `POST /libraries/{place}/seen` when the owner
opens the file; a prefetch or a refresh does not clear the tag. Other open tabs drop the tag on
the `library.seen` event.

### 3.4 An older version (L9, L9b)

**Show file** on a copy card (`library-cards.md` §5) opens the version that the card pinned
(D61). The facts line (§3.1) describes that version. Under it, one line in `surface-raised`,
12 px, with the info icon, starting with **Older version.**:

| Case | Text | Link |
| --- | --- | --- |
| The file changed after this version | "The newest version was saved {time}." | **Open newest version** |
| The file was moved after this version | "This file was moved to `{path}` {time}." | **Open newest version** (opens the new path) |
| The file was deleted after this version | "This file was deleted {time}." | none; the tree selects nothing |

When the pinned version is the newest, the line does not show. **Copy to** in this view copies
the version on screen.

## 4. History tab (L2)

Two columns:

| Part | Rule |
| --- | --- |
| Saves | 300 px. The search box ("Search files": only saves that changed a matching path). One row per save, newest first, the Skills History row part (`skills-page.md` §13): a 16 px avatar (a bot, or the owner avatar), the title, then the file count and the time. The selected row has `primary-tint` and a 3 px `primary` bar. A save with an overlap shows "overlap" in 11 px `on-surface-muted` at the right of the title, with a tooltip |
| Save | The rest. §4.1 |

Save titles (one row per commit on main):

| Save | Title |
| --- | --- |
| A run (D52) | "{bot} in {conversation}" (the merge commit "BA in Pricing: 2 files") |
| Owner edit on disk | "Owner edit" |
| Owner upload | "Owner upload in {conversation}" |
| Owner restore (D52) | "Owner restore" |
| A copy into this place (D61) | "Copied from {source place}" |
| The first commit | "Library made" |

**View history** in the Files tab opens this tab with the search box set to that file's path.

### 4.1 The changed files (GitHub "Files changed" style, owner 2026-10-27)

- The head: "{title}: {n} files" (15 px, weight 600), where {title} is the save title of the
  table above ("BA in Sign-in screens: 3 files", "Owner edit: 1 file", L2b), and, at the right,
  the links **Show all** and **Hide all** (12 px, `on-surface-muted`). Under it the facts, with
  the avatar of the save row: "Saved {time} · {source} · {commit} · {n} files · +{a} −{r}". The
  added count is `success`, the removed count is `danger`. {source} follows the save kind:

  | Save | {source} |
  | --- | --- |
  | A run | "run of {bot} in {conversation}" (the conversation is a link) |
  | Owner edit | "you changed it on your disk" |
  | Owner upload | "you uploaded it in {conversation}" |
  | Owner restore | "you restored the version from {conversation}" |
  | A copy | "copied from {source place}" |
  | The first commit | "the app made the Library" |
- Then one block per file. The block head is 38 px, `surface-container`, 1 px
  `outline-strong` border, radius 8 px: a fold arrow, the status word ("changed" in
  `on-surface-soft`, "new" in `success`, "deleted" in `danger`, "moved" in `on-surface-soft`),
  the path in mono, a note, then "+{a} −{r}" at the right. A click on the head shows or hides
  the diff under it. Amber is not used (C1).
- Notes: "also changed in {conversation} · both merged" (an overlap that git merged), "also
  changed in {conversation} · this version was saved" (an overlap on the same lines, D52), the pill
  **not in plan** (D52), "approved at save" (a delete or move outside the plan, `library-cards.md`
  §4).
- The diff is the agreed diff box (the skill draft card diff, `skill-draft-card.md`): `success`
  lines added, `danger` lines removed and struck, hunk lines in `on-surface-faint`. A binary
  file shows "Binary file · {old size} → {new size}" and no diff.
- When the save opens, every block is open, except deletes and blocks with more than
  `library_diff_open_max_lines` changed lines (setting, default 400). They start folded.

## 5. Unsaved changes tab (L3, L3b)

One line on top, 12 px `on-surface-muted`: "These runs stopped before they saved. Other
conversations do not see these files. Save uses the same rules as a normal save." Then one card
per run with unsaved changes (D52), newest first. The card is the same part as the unsaved
changes card in the conversation (`library-cards.md` §3), with a head that names the run:

- Head: 20 px avatar, the bot name (weight 600), the state ("failed" in `danger`, "stopped by
  you" in `on-surface-muted`, C2), "in {conversation} · {time}", and **Show** / **Hide** at the
  right.
- The file rows: the sign (~ changed, + new, − delete, → move) and the path. A delete or move that
  the plan did not list has the pill "delete · needs your OK" or "move · needs your OK" (D52).
- **Show** opens the diff of each file under its row (the §4.1 diff box). The page loads the diffs
  when the owner presses Show (`GET /runs/{id}/save/diff`), not when the tab opens.
- The tab lists only failed or stopped runs, and its count is the number of these runs. A run
  that finished but waits for a choice on a delete or move outside the plan is not here: its save
  card is in the conversation (`library-cards.md` §4).
- Foot: "Discarded on {date} if you do nothing." (`discard_on`: the run's end + `trash_days`, or the purge of its conversation or project if that comes first; `architecture.md` §6.1), then
  **Discard** (danger, 30 px) and **Save** (primary, 30 px). The label is "Save", not "Save to
  Library", because the page is the Library (W2).
- **Save** runs the normal save (merge, overlap rule, save queue). If the run has a delete or
  move outside the plan, Save first shows the save card of `library-cards.md` §4 in a dialog.
- **Discard** removes the card at once and shows the toast "{bot}'s changes are discarded." with
  **Undo** (B7, a permanent delete). The page sends the discard when the toast closes, as the
  Trash page does (D62).
- With no unsaved changes, the tab shows "No unsaved changes. When a run fails or stops after it
  wrote files, its changes wait here."

## 6. Copy to (L5, L5b)

**Copy to** in the viewer opens a dialog (500 px). It shows the rows of the copy card
(`library-cards.md` §5), because the owner's own Copy to has the same card (D61):

- Title **Copy to another place**.
- **Source** (this place), **File** (mono), **Version**: "saved {time} by {bot} in {conversation}",
  with the commit id in the tooltip. The version is pinned when the dialog opens (D61).
- **Destination:** one radio row per place, the Move dialog row part (`conversation-page.md`
  §2.1a): projects that are not in Trash and not this place, then **Home** ("The Home Library.
  Every bot in a Home conversation reads it."). The first row is selected.
- The line: "The app copies this version as one new file. No bot starts there. If the name is
  taken, the copy is {name}-from-{place-slug}.md." (D61; with a number when that name is taken
  too, `{name}-from-{place-slug}-2.md`).
- **Cancel** and **Copy to {place}** (primary 36). The label follows the selected place.
- After the copy: the toast "Copied to {place} ✨" with **Open** (no Undo, B7). Open goes to the
  destination Library on the new file.
- The owner's Copy to has no limit (D61).

## 7. In the destination (L6)

The copied file has the **New** tag (§3.3). Its facts line says where it came from (§3.1). No bot
starts (D61).

## 8. Add from Home Library (L7)

Project Library pages only. The button opens a dialog (600 px):

- Title **Add from Home Library**, then: "Tick the files. The app copies the version that each
  row shows into {project}. The originals stay in the Home Library."
- The search box and the Home Library tree with a box on each file. No box is ticked at first
  (owner, 2026-10-27). Each file row shows its pinned version at the right: "saved {time} by
  {bot} in {conversation}". `attachments/` is in the tree too.
- "If a name is taken, the copy gets the suffix -from-home, for example notes-from-home.md. No bot
  starts."
- Foot: "{k} of {n} ticked", **Cancel**, **Add {k} files** (primary 36, off with 0 ticked, B5
  tooltip "Tick at least one file.").
- The app copies the ticked files as one save "Copied from Home". The toast: "Added {k} files to
  {project} ✨". Each file gets the New tag.

## 9. Open folder

Opens the Library folder on the owner's computer in the system file manager (D52). The server
opens only the folder of this Library, never a path from the request. On a VPS (M9) the button
is not shown. The security rules are in `security.md` §2.15.

## 10. Home Library (L8)

The same page. Bar 2 shows Home with the **Library** row selected. The page top has no Add from
Home Library. The facts and the History tab name the Home conversations.

## Requirement changes (in this PR)

- UI-3.16: the Files side panel is replaced by the Library page (§1). The conversation has no
  file panel (D44: the right pane holds Flow or Memory).
- New setting `library_diff_open_max_lines` (default 400, 50–5,000): a file block with more
  changed lines starts folded in the History tab.
- API: `api.md` §5d (Library endpoints, the save state, `GET /runs/{id}/save/diff`,
  `GET /libraries/{place}/files/detail`, `POST /libraries/{place}/seen`) and the
  Move body `files: [{path, commit}]` (`api.md` §5).
