# Project settings page

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.3, boards V1 and V3.
> Previews: `../previews/command-dark/project-settings.png` (cards S1–S3, S5, S6) and
> `../previews/command-dark/delete-project.png` (cards S7, S8), each with a `.html`. The memory
> check card and the plan card are in `memory-pane.md` §4 and `plan-card.md`. Follows D37, D43,
> D45 and D47. The labels and messages use Simplified Technical English.

## 1. Where it opens

- From the ⋯ menu in the bar 2 header (`left-bar.md` §2), item **Project settings**. The ⋯ button
  stays in its open state while the page is open.
- From the menu of the project tile on the rail (`left-bar.md` §1.2).
- The page opens in the main area. Bar 2 stays, because the project is still selected. Bar 2 is
  the preview: it changes after the save. The page has no preview column.

## 2. Layout

One column, at most 620 px wide, with 20 px between fields. Top to bottom:

1. **Header:** "Project settings", then "Every conversation in {project} uses these settings. Bots read
   the changes on their next run."
2. **Name, Goal, Instructions, Colour:** the same fields, limits, hints, placeholders and error
   messages as the New project page (`new-project-page.md` §3, §4). The Goal hint is "It shows
   under the project name. Every bot reads it."
3. Under Instructions, the **memory check line** (§4).
4. **Memory history** section: a divider with 40 px of space above it, the title, "Applies to
   project memory only.", then the toggle "Keep earlier versions of each memory item" with "You
   can restore an earlier version from the Memory page." and a versions menu (1–20, default 5,
   UI-13.9). Lower numbers ask for confirmation first (UI-13.9).
5. **Delete project** section, 32 px below Memory history, with 28 px of padding inside, a
   `danger` border at low opacity and a `danger` tint. Title **"Done with this project? 📦"**,
   text "The project goes to Trash with its conversations, memory and Library. You can restore it for 30
   days." Button **Delete project** (`danger` outline).
6. **Save bar**, fixed at the bottom of the main area (§3).

## 3. Saving

- With no changes, the save bar shows "All changes are saved." and a **Save changes** button that
  is off.
- When a field changes, the field gets a 3 px `primary` mark at its left edge. The save bar comes
  up with a `primary` dot, "{n} changes not saved", **Discard** and **Save changes**
  (`primary`).
- Save changes stays off while a field has an error.
- After a save, a toast says "Saved ✨ Every bot uses the new rules on its next run."
- If the save fails, the page keeps all text and shows the toast "The app could not save the
  changes. Try again." The page never shows internal error text.
- If another tab saved the project first (`row_version`), the page shows "This project changed in
  another tab. Reload the page to see the new version." The text in the fields stays until the
  owner reloads.

## 4. The memory check line (D43)

The line under Instructions has these states:

| State | Text |
| --- | --- |
| No check yet, or no conflicts | ✓ "Memory check: no conflicts with project memory · {time}" |
| Instructions changed, not saved | i "When you save, the app compares project memory with the new instructions." |
| Check runs | spinner, "The app compares project memory with the new instructions…" |
| Items disagree | "{n} memory items disagree with the new instructions." and the link **Review in Memory**, which opens the Memory pane with the check card (`memory-pane.md` §4) |
| Check failed | `danger`, "Memory check failed. {cause}. The instructions are saved." and **Check again**. Example cause: "The daily cap stopped it" |

- The save completes first, and the new instructions apply at once. The check runs after it, as
  a normal run with cost tracking and the daily caps. The owner can leave the page.
- A new save of the instructions replaces a check that has not started.

## 5. Leave with unsaved changes

Discard, Esc, or a click on another conversation, project or page asks first, but only if something
changed.

- Title: **Leave without saving? 👀**
- Text: "You changed the goal and the instructions. The app has not saved them yet. Stay and save,
  or let them go." The text names the changed fields.
- Buttons: **Stay on this page** (`primary`, default, Enter) and **Let them go** (`danger` text).

## 6. Delete project (D47)

**Delete project** opens a dialog:

- Title: **Delete {project}? 🧹**
- "Everything in the project goes to Trash:", then the real counts: 💬 "{n} conversations, with all their
  messages and runs", 🧠 "{n} memory items", 📚 "{n} Library files".
- ↩️ "You can restore the project from Trash for 30 days, with all of it. You cannot restore one
  conversation alone. After 30 days, the app deletes it."
- 💡 "To keep a conversation, move it out of the project first."
- Buttons: **Cancel** (default, with the focus ring, so Enter does not delete) and **Delete
  project** (`danger` fill). The owner does not type the name, because the delete can be undone
  for 30 days.

After Delete:

- Runs in the project stop first. Then the project, its conversations, memory and Library go to Trash
  as one item.
- Home opens. The project tile and its conversations are gone from the rail and bar 2.
- A toast says "{project} and its {n} conversations are in Trash." The word **Trash** is a link to the
  Trash page. The toast has no Undo, because Trash is not permanent (D49, `buttons.md` §6).
- The owner restores the project from Trash. A restore brings back the project with
  all its conversations, memory and Library, as they were. The Trash page is **not designed yet**.

## Requirement changes (requirements PR)

- UI-13.3 changes: delete sends the project and all its conversations, memory and Library to Trash (D47).
  It replaces "its conversations move out of the project" from D37.
- A Trash page: list, restore, delete now, 30-day limit. To design.
- `domain-model.md` §11, §14: a deleted project keeps its workspace in `data/trash/`; its
  conversations and memory items get the same `deleted_at` and a link to the project delete, so a
  restore brings back exactly that set.
- API: `PATCH /projects/{id}` with `row_version`; delete and restore endpoints; the check run
  status. The M5b brief defines them (D43 contract status).
