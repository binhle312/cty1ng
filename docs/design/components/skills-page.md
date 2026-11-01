# Skills page

> **Status: agreed in the UI design review (2026-10-23)**, canvas round 8, boards W1–W4.
> Previews: `../previews/command-dark/skills-layout.*` (cards B–B3),
> `skills-editor.*` (C0–C6), `skills-lifecycle.*` (D1–D6) and `skills-delete.*` (D2a, D7–D8),
> each a `.png` and a `.html`. Buttons and check boxes follow `buttons.md`. Follows D5, D6, D14,
> D16, D39 and D49. The labels and messages use Simplified Technical English.
> **Changed in the M5c UI design review, round 16 (2026-10-27):** the page uses the bot page
> layout (owner, 03:36): a page top and the tabs **Skill**, **Bots** and **History** (§2, §2a,
> §13); **+ Create** in place of **+ New**; editing a skill draft (§17, D64).
> Preview: `../previews/command-dark/skills-page-tabs.*` (S1–S3) and `skill-draft-edit.*`
> (E1–E5). The round 8 previews still show the old header and the History panel; this file
> wins.

## 1. Where it opens

- From **Manage skills** in the user panel menu (`user-panel.md`).
- The page belongs to the whole app, not to a project. Bar 2 is hidden, and the rail stays.

**URLs (M1 spec gap pass, owner 2026-10-30).** A reload keeps the page, the tab and the compared
versions:

| URL | Opens |
| --- | --- |
| `/skills` | The skill changed last (the top of the list), or the empty state (§3) |
| `/skills/{slug}` | That skill, Skill tab. `?tab=bots` or `?tab=history`; History adds `&from=3&to=5` for a Compare pair |
| `/skills/new` | New skill (§4) |
| `/skills/new?from={skill version id}` | Clone of that version (§12) |
| `/skills/import` | The import page (§15), before a file is chosen |

The page loads the list with `include_deprecated=true` and finds the skill id from the slug in
it, so the URL of a deprecated skill works after a reload; **Show deprecated** only filters the
rows on screen. The API takes ids.
`new` and `import` are reserved slugs (`domain-model.md` §3.1). An unknown or trashed slug shows
the not-found state of the shell. A reload or a closed browser tab with unsaved changes asks the
browser's own "Leave site?" question; nothing else of an unsaved edit is kept.

## 2. Layout: list and skill page side by side (bot page layout)

- **List column**, 300 px, `surface-container`:
  - Title **Skills** and **+ Create** (`primary`, small).
  - Search box "Search skills" (name or slug).
  - The **Show deprecated** check box, then **Import** and **Export** as text buttons.
  - One row for each skill: the name, a version pill, the slug (`font-mono`), and "n bots",
    with "· m older" in `waiting` when bots use an older version. "Not used" when no bot uses
    it.
  - The order is the time of the last change, newest first. A new version, an import or a clone
    puts the skill at the top.
  - The selected row has `primary-tint` and a 3 px `primary` mark at its left edge. A skill
    with unsaved changes has a `primary` dot after its name.
  - The list has no row menu and no Clone. All actions are in the skill header.
- **Page top** (as `bot-page.md` §2): the name (22 px, weight 600) with its version pill, then
  the slug (mono) · "by {author}" · "used by n bots, m on an older version". When a skill draft
  for this skill waits, a third line: "Draft v4 from BA waits for you · in {conversation}", the
  first part a `primary` link to the card (`skill-draft-card.md` §6). On the right: **⋯** (§9).
- **Tabs** (as `bot-page.md` §3), each with an icon: **Skill**, **Bots** with the count and
  "↑m" in `primary` when m bots use an older version, **History** with the number of versions.
  The open tab has the 2 px `primary` underline.
- **Skill tab:** the editor, one column, 14 px between fields:
  1. **Name**, counter "n / {skill_name_max}" (default 64).
  2. **Description**, hint "Say when a bot must use this skill. Bots read it in every prompt,
     so keep it short.", counter "n / 1,024".
  3. **Body**, hint "The steps a bot follows for this task. Bots read it only when they load
     the skill.", counter "n / {skill_body_max}" (default 20,000). The tabs **Write** and **Preview** sit on top of the
     body box, with "Markdown" at the right of the tab bar. The open tab has a 2 px `primary`
     underline. The tab bar has the same border colour as the box.
- **Save bar**, fixed at the bottom of the Skill tab (§5). The Bots and History tabs have no
  save bar.
- Only the field in focus gets a `primary` border. Changed fields get no other mark.

The Body opens in **Preview** when it has text. It opens in **Write** when it is empty (new
skill) or when it has an error (§6). Preview renders Markdown with raw HTML off (`security.md`).

The description and the body must not say the same thing. The description says *when* to use
the skill. The body says *how* to do the task.

## 2a. Bots tab (S2, UI-7.5a)

The skill side of the bot page Skills tab (`bot-page.md` §7), with the same row parts:

- The line "Changes save at once. Each bot uses them from its next run." and **+ Add**
  (secondary, 30 px) at the right.
- Columns **Bot**, **Version**, **Always load**, and ⋯. Each row: the avatar, the name and the
  model line; the version pill with "latest", or "Upgrade to v{N}" as a `primary` link that
  opens the upgrade dialog (`bot-page.md` §7 SK3); the Always load switch (D16); ⋯ with
  **Change version** and **Remove** (`danger` text), as on the bot page.
- **+ Add** opens the bot list (§7) with no box ticked; the bots that use the skill are not in
  it. The added bots get the latest version and Always load off. A ticked bot that leaves the
  list while the card is open (another tab added it, or it went to Trash) is not counted in
  "Add {n}" and is not sent.
- When the versions do not load, + Add, Upgrade (SK3) and Change version (SK4) say "The app
  could not load the versions." with **Try again** in place of "Loading the versions.", and
  their confirm button stays off.
- No bot uses it: "No bot uses this skill yet." and **+ Add**.
- No bot exists (M1): the same line, and **+ Add** is disabled with the tooltip "Create a bot
  first."

## 3. Empty state

Before the first skill: 📚 **No skills yet**, then "A skill tells a bot how to do one task, for
example "Write user stories". Write one here, or import SKILL.md folders." and the buttons
**Import** and **+ Create skill**.

## 4. New skill (C1)

- **+ Create** adds an item "New skill" with the pill "not saved" at the top of the list, and opens
  an empty editor with the header "New skill" and "A skill tells a bot how to do one task. You
  can assign it to bots after you save it."
- Only a new skill has the **Slug** field, under Name. Hint: "Made from the name. Fixed after
  you create it." Counter "n / 64". The slug follows the slug rule in `domain-model.md` §3.1
  (lowercase letters, digits, single hyphens inside, 1–64 characters) and is fixed after
  Create (D19). A slug that breaks the rule shows "Use lowercase letters, digits and single
  hyphens, not at the start or end."; `new` and `import` show "This slug is reserved. Type a
  different one."
- **Slug from the name:** while the owner has not edited the slug, the app makes it from the
  name: lowercase, accents removed, spaces and other characters become "-", no "-" at the start
  or end, no "--", cut to 64 characters (and no "-" at the cut). `đ` and `Đ` become `d`, as
  Unicode accent removal leaves them. Example: "Viết câu chuyện" → `viet-cau-chuyen`, "Đặt
  lịch" → `dat-lich`. A name with no Latin letters
  (for example Japanese) gives an empty slug, and the owner types one. After the owner edits
  the slug, the app stops.
- Placeholders are examples, in `on-surface-muted`:
  - Description: "Example: Use this skill when the owner asks for user stories. It writes each
    story in Given / When / Then."
  - Body: a short skill with `## Steps` (three numbered steps) and `## Format`.
- Every field is required. A field left empty shows "Type a name.", "Type a description." or
  "Type the steps."
- The save bar has **Cancel** and **Create**. Create stays disabled until every field has text
  and no field has an error. Create makes v1, then shows the assign card (§7.2).

## 5. Save bar

- No changes: "All changes are saved." and **Save as v{n+1}** (disabled).
- With changes: a `primary` dot, "{n} changes not saved", a one-line box "What changed? One
  line, optional" (the changelog, shown in History), **Discard** and **Save as v{n+1}**.
- Discard puts back the saved text.
- **A rename only** (M1 spec gap pass, owner 2026-10-30): the display name is not versioned
  (`domain-model.md` §3.1). When only the name changed, the button is **Save** (no version) and
  the changelog box is hidden. When the name and the description or the body changed, **Save as
  v{n+1}** saves both in one request, so a Save never half-succeeds (`api.md` §2).
- Enter in the changelog box is the same as the Save button when it is enabled. There is no
  Ctrl+S. The Body box gets the Markdown keys of the composer in M3 (UI-3.14b).

## 6. Errors and warnings (C3)

Errors stop the save. Each error line starts with "!" in `danger`, and the counter of a field
over its limit turns `danger`.

| Case | Text |
| --- | --- |
| Slug exists | "This slug exists. Type a different one." |
| Description over the limit | "The description has 1,047 characters. The limit is 1,024. Make it shorter." |
| Name or body over the limit | The same pattern, with the limit `skill_name_max` or `skill_body_max` (defaults 64 and 20,000) |
| Text looks like a secret (D39) | "Line 5 looks like an API key. The app does not save secrets in skills. Remove the key." |

A body over `skill_body_warn_lines` lines (default 500) gets a warning only, in `waiting`: "The
body has 612 lines. Bots read the full body each time they load it. Try to keep it under 500
lines." (the example uses the default). The Agent Skills standard
recommends this length but does not require it.

## 7. Bot cards after a save

Both cards use the same bot list: one row for each bot with a check box, the bot avatar, the
name and, in C4, the version pill. A ticked row has a `primary` border. **Skip**, Esc or a click
outside the card closes it with no change. The line "A click outside this card is the same as
Skip." is at the bottom.

**No bot to list** (M1 spec gap pass, owner 2026-10-30): when no bot fits the card (in M1 no bots
exist; later, no bot uses an older version), the card does not open, and only a toast shows:
"Saved v{n} ✨" after a save, "Created {name} ✨" after Create.

### 7.1 Upgrade the bots (C4, UI-7.4)

- Title: "Saved v5 ✨ Also upgrade these bots to v5?"
- Text: "These bots use an older version. They keep it until you upgrade them. Tick the bots to
  move to v5."
- Every box starts ticked, so one click upgrades all bots (owner, 2026-10-23). Untick a bot to
  keep its version.
- Buttons: **Skip** and **Upgrade** (`primary`, default). Upgrade is disabled when no box is
  ticked. It moves the ticked bots in one transaction.

### 7.2 Assign a new skill (C4b)

- Title: "Created ✨ Add {skill} to bots?"
- Text: "Tick the bots that must use this skill. They get v1."
- No box starts ticked. **Skip** is the default. **Assign** (`primary`) is disabled until a box
  is ticked.

### 7.3 After an approved skill draft (D64)

The same two cards open in the centre of the conversation after the owner approves a skill
draft (`skill-draft-card.md` §4). Two differences: the new-skill card starts with the drafting
bot ticked and an **Always load** switch (off) on its row, and **Assign** is the default. The
upgrade card has a second group, **Does not have it**, with every other bot not in Trash, not
ticked, so the owner can give the new version to any bot (D65). Upgrading keeps each bot's
Always load; a newly assigned bot gets Always load off unless the owner turns it on.

## 8. A skill by another author (C5)

Phase 1 has one owner, so only tests see this state; the API rule (403) exists from M1 (D14).

- Every field is disabled (40% opacity, `cursor: not-allowed`), and the tabs still work.
- The save bar says "You cannot edit this skill. Only its author can change it." and has
  **Clone to edit** (`primary`), which works as Clone (§12).
- The ⋯ menu has only Clone and Export.

## 9. The ⋯ menu (D8)

| Skill | Items |
| --- | --- |
| Active | **Clone**, **Export** (a zip with this skill only), divider, **Deprecate** (`danger` text) |
| Deprecated | **Clone**, divider, **Delete skill** (`danger` text) |

Make active again and Remove from bots are only in the deprecated banner (§10.2), so no action
shows in two places. No label ends in "…" (`buttons.md`).

## 10. Deprecate

### 10.1 The dialog (D1, UI-7.6)

- Title: "Time for {skill} to rest? 🌙"
- Text: "The ticked bots stop using it. Untick a bot to let it keep the skill, and it works for
  that bot as before 💪", then the bot list (§7) with the version each bot uses.
- Every box starts ticked (owner, 2026-10-23).
- "😴 New bots cannot add it. The list hides it, and Export leaves it out." and "↩️ Changed your
  mind? Make it active again at any time."
- Buttons: **Cancel** (default) and **Deprecate and remove from {n} bots** (`danger`). With no
  box ticked, the label is **Deprecate**.
- No Undo toast: Deprecate is not permanent.

### 10.2 A deprecated skill (D2)

- Hidden from the list until **Show deprecated** is ticked (D2a). Then it is in the same order
  as the other skills, with the name in `on-surface-muted` and a **Deprecated** pill. The tick
  is kept for this browser only.
- The header shows the Deprecated pill after the version pill.
- A banner under the header (`waiting` tint and border), with three rows on the left and the
  buttons on the right:
  1. **Deprecated {time}** — under one day: "5 min ago", "3 h ago"; from one day: the exact
     local time in ISO format, "2026-10-21 14:05". A hover shows the full ISO time with the
     UTC offset.
  2. "{n} bots still use it." or "No bot uses it."
  3. "New bots cannot add it."
  - Buttons: **Remove from bots** and **Make active again** (`primary`). **Remove from bots** is
    hidden when no bot uses the skill.
- The editor is read-only. The save bar says "Deprecated skills are read-only. Make it active
  again to edit it."
- Bots that still use it show the Deprecated pill on their pages (M2).

### 10.3 Remove from bots (D2b)

The same bot list. Title "Remove {skill} from bots? 🧹", text "Tick the bots that must stop
using it. They stop on their next run. A run that works now keeps it to the end." Every box
starts ticked. Buttons: **Skip** and **Remove from {n} bots** (`danger`), disabled with no tick.

## 11. Delete (D7, D49)

- **Delete skill** is only in the ⋯ menu of a deprecated skill. An active skill must be
  deprecated first. Delete works also while bots use the skill.
- The dialog (D7b): title "Delete {skill}? 🧹", text "The skill goes to Trash. After 30 days,
  the app deletes it permanently. These bots stop using it now:", then the bots as a list with
  no check boxes. Removing the skill from every bot is a required step. Buttons: **Cancel**
  (default) and **Delete skill** (`danger` fill). "30" is the Trash setting (D49).
- After Delete (D7c): the app removes the skill from the bots, and the skill leaves the list.
  The toast says "{skill} is in Trash." The word **Trash** is a link to the Trash page. No
  Undo: moving to Trash is not permanent (D49). Until the Trash page exists (M5b), **Trash** is
  plain text, not a link, and the dialog lists no bots in M1.
- Trash keeps the list of bots that used the skill. A restore suggests to assign it again to
  those bots that are still active, never to bots in Trash. The Trash page round (M5b) draws
  this card.

## 12. Clone (D5, D14)

- **Clone** in the ⋯ menu saves nothing yet. It opens the New skill editor with the header "New
  skill · copy of {skill} v{n}" and "You are the author of the copy. Later changes to the
  original do not change it."
- The fields hold the text of the version on screen. The name gets " (copy)" and the slug gets
  "-copy". The owner can change every field. When the copy's slug is taken, the app tries
  "-copy-2", "-copy-3" and so on. The name and the slug are cut so they stay within their
  limits; the slug is cut before its suffix, so the suffix stays.
- **Create** makes the copy at v1, with the owner as author, and then shows the assign card
  (§7.2). Cancel or leave, and nothing is saved, so no unwanted copies stay in the list.

## 13. History tab (S3, UI-7.5, UI-7.14)

The History tab replaces the round 8 floating panel (round 16).

- At the left, 300 px: versions newest first, each with the version pill, the changelog line,
  who and when, "latest" on the newest, and "{n} bots" that use it. A version that came from a
  skill draft says "You · drafted by BA", with BA as a link to the card's message (D41).
- At the right: the diff from the selected version to the latest, read-only: "v3 → v4 ·
  Read-only", "Description: no change" or the description diff, then the body diff (added lines
  in `success`, removed lines in `danger` with a strike, unchanged lines folded as "{n} lines
  with no change · Show"). **Restore v{k}** (secondary) makes a new version with the old text.
- **Compare** under the list picks any two versions.

## 14. Leave with unsaved changes (C6)

A click on another skill, the rail or + Create asks first, but only if something changed.
Title **Leave without saving? 👀**, text "You changed the description and the body of {skill}.
The app has not saved them yet. Stay and save, or let them go." The text names the changed
fields. Buttons: **Let them go** (`danger`) and **Stay on this skill** (`primary`, default).

## 15. Import (D3, D4, UI-7.7)

- **Import** asks for a zip and opens the import page in the editor area: "Import skills",
  "{file} · {n} folders. The app changes nothing until you apply." and **Choose another file**.
- The app matches each folder to a skill by its slug. One zip can hold new skills and new
  versions of skills that the owner has. The table has four groups, each with a count:
  1. **New skills** — pill New, "{name} · becomes v1".
  2. **New versions of your skills** — pill Changed, "v4 → v5 · body changed", with **Show
     changes** / **Hide changes** for the diff.
  3. **No change** — pill Unchanged, "Same as v3".
  4. **Skipped** — pill Invalid with the reason (for example "The folder name has "_". Use
     lowercase letters, digits and hyphens."), or Conflict ("{author} made this skill. Only the
     author can add a version.", "Deprecated. Make it active again to import.", "This skill is
     in Trash.").
- Each row of groups 1 and 2 has a check box, and every box starts ticked. Rows of groups 3 and 4
  have a disabled box. The save bar says "{k} of {n} picked. Rows with a problem are skipped."
  and has **Cancel** and **Apply {k} changes**.
- A folder can hold other files, such as `scripts/extract.py`. The app imports only `SKILL.md`
  and names the skipped files in the row, in `waiting`: "Only SKILL.md is imported. 2 files are
  skipped: … Bots cannot run scripts." (`security.md` §2.4).
- "Import never changes the version that a bot uses. Skills that are not in the file stay as
  they are."
- A new skill gets its slug as its name ("becomes v1 · named {slug}"); the owner renames it
  later. Import never renames an existing skill. Each new version has the changelog "Imported
  from {file}" (`domain-model.md` §3.5).
- After Apply: toast "Imported 4 changes ✨ 2 new skills, 2 new versions." The new and changed
  skills move to the top of the list. If a skill changed after the preview, the app applies
  nothing and shows "A skill changed after the preview. The app applied nothing. Preview again."
  with **Preview again** (409).

## 16. Export (D6, UI-7.8)

- **Export** opens a card "Export skills 📦": "Tick the skills to put in the zip. Each one goes
  in with its latest version.", a **Select all** check box with "{k} of {n}", and one row for
  each active skill (name, slug, version). Every box starts ticked. Deprecated skills are not
  in the list.
- Buttons: **Cancel** and **Export {k} skills** (`primary`, default). A click outside is the
  same as Cancel.
- The download is one zip named `<n>-skills-<UTC timestamp>.zip`, with the timestamp in ISO 8601
  basic format and no ":", for example `6-skills-20261023T035956Z.zip`. It holds
  `<slug>/SKILL.md` for each ticked skill. The toast says "Exported 6 skills to {file}."

## 17. Edit a skill draft (E1–E5, D41, D64)

**Edit** on a skill draft card (`skill-draft-card.md` §3) opens the draft on this page:

- A new skill shows as a list item with the pill "not saved"; a new version selects the skill.
- The page top says "New skill. You are the author when you approve it." (or the skill's line),
  and "{bot} drafted this skill in {conversation}. Approve saves v{N}. Cancel goes
  back to the conversation and changes nothing."
- Only the Skill tab works. Bots and History are at 40 % with the tooltip "Approve the draft
  first."
- The save bar: "No changes to the draft." or "{n} changes not saved", the changelog box with
  the bot's line, **Cancel** and **✓ Approve as v{N}** (primary). Approve checks like Save
  (§6), goes back to the conversation and opens the float card (§7, D64).
- The slug of a new skill can be changed here. A taken slug shows the §6 error.

## Requirement changes (this PR)

- `skill-hub.md` UI-7.1 to UI-7.8 and SK-3 follow this file. Round 16: UI-7.2, UI-7.5, UI-7.5a
  and UI-7.12 to UI-7.14 follow this file and `skill-draft-card.md`.
- Limits (`security.md` §2.5, `domain-model.md` §3.1, §10): description 1,024 characters and
  the slug rule are fixed, as in the Agent Skills standard; the name, the body and the line
  warning are the settings `skill_name_max`, `skill_body_max` and `skill_body_warn_lines`
  (defaults 64, 20,000 and 500). The editor reads them from `GET /settings`, so its counters,
  errors and warning always match the server.
- API (`api.md` §2): import apply takes the picked folders, export takes the picked skills,
  `POST /skills/{id}/trash`, and the restore endpoint (D49).
- M1 spec gap pass (owner, 2026-10-30): URLs (§1), the slug rule and `đ` (§4), a rename only and
  the changelog Enter key (§5), no card without bots (§7), the M1 states of the Bots tab, the
  banner and the delete toast (§2a, §10.2, §11), the Clone slug suffix (§12), import names and
  the deprecated conflict (§15).

## Texts added in the M1b build (2026-10-31, reviewed by the owner in the M1b PR)

The spec did not name these; the build uses them. The owner approved them on 2026-10-31, with
the changes marked "owner, 2026-10-31".

- A rename only: the toast "Saved ✨" (no version number).
- A save that the server refuses as stale (409 `stale_write`): the page loads the newest
  version at once, keeps the edit, and shows the conflict below (owner, 2026-10-31: a stale
  save offers a recovery that keeps the draft, not only "reload").
- The skill changes in another tab while this tab has unsaved changes (review of #54): the
  edit stays, Save is off, and the save bar says "This skill changed in another place. Your
  changes are kept here. Copy what you need, then Discard to load the new text." Discard loads
  the newest saved text. An editor with no changes takes the new text at once.
- A list or skill that does not load: "The app could not load the skills." and **Try again**,
  never Page not found. A failed background refresh keeps the list and the editor on the data
  they have, with the unsaved text (second review of #54).
- Text typed while a Save is pending stays as a change after the Save: only the text the
  request sent counts as saved.
- A Clone whose source does not load: "The app could not load the skill to copy." and **Try
  again**; Page not found only when the version does not exist (third review of #54).
- While Create is pending, the fields are read-only: the page leaves after Create, so text
  typed meanwhile would be lost. **Cancel** is off too, with the tooltip "Creating the skill."
  If the owner leaves another way, a Create that ends later shows its toast and does not move
  the page (fourth review of #54). A settings change does not reset an open Clone.
- The limits did not load (owner, 2026-10-31): the defaults can differ from the owner's saved
  limits, so no limit applies until they load. The name and body counters show only the
  length, and Save and Create stay off ("Loading the limits." / "The limits did not load.").
  A failed load shows "The app could not load the limits for skills, so Save is off. Your
  changes are kept." (Create: "…so Create is off. Your text is kept.") with **Try again**. The
  owner can go on editing; Try again keeps the draft. A Clone waits only for the first answer.
- A copy's slug and skills in Trash: the list does not show skills in Trash, but they keep
  their slugs (D49). When Create finds the proposed copy slug taken, the app tries the next
  suffix (`-copy-2`, `-copy-3` …) until one is free. Only a confirmed 409 `slug_taken` leads
  to a new try, never a timeout or another failure. A slug the owner typed shows the error
  instead (owner, 2026-10-31: approved for M1; the server checks uniqueness, so listing Trash
  slugs would still leave a race. If many collisions make it slow, the server picks the
  suffix).
- The skill is deprecated in another place while this tab has unsaved changes: the text stays,
  leaving asks first, and the save bar says "This skill was deprecated. Your changes are still
  here, but you cannot save them. Copy what you need before you leave." (owner, 2026-10-31).
- Read-only fields (a deprecated skill, another author's skill, a pending Create) are real
  read-only controls, not disabled ones: they take focus, so the owner can select and copy the
  text from the keyboard (owner, 2026-10-31).
- Why a button is off (`ui-rules.md` B5): "No changes to save.", "Fill in every field.", "Fix
  the errors first.", "Tick a skill to export.", "Tick a row to apply."
- Deprecate in M1 (no bots): "No bot uses it." in place of the bot list.
- History: v1 with no changelog says "First version", a later version "No note". A skill with
  one version: "This skill has one version. Each save adds a version here." The latest version
  picked: "Pick an older version to see what changed." **Compare** turns the version rows into
  check boxes with "Tick two versions." and becomes **Stop comparing**.
- Import: before a file is chosen, "Choose a zip of SKILL.md folders. The app changes nothing
  until you apply." and **Choose a file**; an empty group says "None."; an expired preview (409
  `preview_expired`): "The preview is too old. The app applied nothing. Preview again."
