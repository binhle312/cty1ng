# D60. Deleted conversations go to Trash and can be restored

Status: proposed (2026-10-25). From the M4 UI design review, round 12, step 5: the owner chose
"Trash, like projects" for a deleted conversation. The details below wait for the owner's
review. It replaces the rule that a deleted conversation's workspace moves to `data/trash/` and
the owner recovers it by hand. It follows the D52 amendment of 2026-10-25: a conversation has no
Library of its own.

Decision:

- **Delete a conversation.** Delete in the conversation menu (the bar 2 row ⋯ or the header ⋯)
  opens a dialog with the real counts: messages and runs, and conversation memory items.
  If a bot is queued or running, a line says that the run stops first. **Cancel** is the
  default. **Delete** (danger fill) moves the conversation to Trash (`conversations.deleted_at`).
  The owner does not type the name, because the delete can be undone.
- **What goes with it.** Its messages, runs, members, conversation memory (D38) and unsaved
  changes (D52) go to Trash as one item. Its saved files stay in the Library of its place
  (project or Home), because they belong to the place (D52 amendment 2026-10-25). The dialog
  says so: "Its files stay in the {project} Library." or "Its files stay in the Home Library."
- **After the delete.** The conversation leaves bar 2. The newest other conversation in the same
  place (the project or Home) opens. With none, the empty state shows (UI-1.10). A toast says
  "{title} is in Trash." with Trash as a link. It has no Undo (D49 Undo rule).
- **Trash days.** Trash keeps the conversation for `trash_days` (D49, default 30), the same
  setting as projects, skills and bots. Then the app purges it.
- **Restore.** A restore brings back the conversation as it was: messages, branches, runs,
  members, conversation memory and unsaved changes. A conversation of a project goes back into that
  project.
- **Restore while the project is in Trash (owner, 2026-10-26).** The conversation shows as its
  own row. **Restore** is off (40 % opacity, the C0 rule) with the tooltip "Restore {project}
  first", and the row has a link to the project's Trash row. The page shows no error message.
  The server also refuses such a restore with 409 `project_in_trash` and changes nothing,
  because a disabled button does not stop an API call.
- **Projects.** A project delete (D47) moves only the conversations that were not in Trash. A
  conversation that was already in Trash stays its own Trash item: restoring the project does
  not bring it back. When the project is purged, its conversations in Trash are purged with it.
  - **Own deadline (owner, 2026-10-26).** A conversation keeps its own `deleted_at` and Trash
    deadline. A project delete or restore does not change them. The conversation was deleted
    first, so it expires first; only **Delete now** on the project purges it earlier, with the
    project.
  - **Own Trash item, same owner (owner, 2026-10-26).** A separate Trash item still belongs to
    its project. A restore always puts it back into that project, never into Home or another
    project (D61).
- **Purge: empty records, not deletes (owner, 2026-10-26).** Runs, skill drafts, feedback and
  memory items in other scopes point to the conversation's messages, so the purge keeps the
  rows that others point to and clears what a person can read. It acts only on data that the
  **conversation owns**. Data of another scope that only refers to it stays:

  | Data | Owner | Purge |
  | --- | --- | --- |
  | Messages, cards, handoffs, skill drafts, run steps, run errors, plan notes, feedback notes | Conversation | Clear the content; keep ids, links, statuses and times |
  | Run history, events, search entries, members, unsaved changes | Conversation | Delete the row |
  | Conversation memory | Conversation | Delete |
  | Bot or project memory learned there | Bot or project (D38) | Keep |
  | Skill versions approved from a draft | The owner's skill (D41) | Keep |
  | Saved files in the Library | The place (D52) | Keep |
  | Runs, model requests, run slots, ratings | Statistics, daily cap, D51 | Keep |

  - **A policy for every column.** A table can hold data that must stay and content that must
    go (`runs`: keep `status` and `estimated_cost_usd`, clear `error`). So each covered table
    lists every column, of every type (BLOB too: `run_history.messages_json`), as keep or
    clear, or the table deletes the row. A delete can have a row condition (`memory_items`:
    only `scope = 'conversation'`). The policy is in `domain-model.md` §16.
  - **Covered is decided by a rule.** A table with a foreign key to `conversations`, `messages`,
    `runs` or a table that the purge clears or deletes must be covered.
  - **No wildcard.** A covered table names each column; "every other column keep" is not a
    policy. The schema test fails CI when a table has no entry, or when a covered table's
    policy column names are not exactly its schema columns.
  - The conversation row keeps its id and `purged_at`, and its title becomes "Deleted
    conversation".

  ```
  BEFORE PURGE                         AFTER PURGE
  messages  id, tree, text, cards      messages  id, tree, ""        ← links still valid
  runs      trigger → message          runs      trigger → message   ← unchanged
  run_steps target / detail            run_steps kind, status        ← one row per call kept
  run_history provider messages        (deleted)                     ← tool results, file text
  feedback  rating + note              feedback  rating              ← D51 signal kept
  events, search, members              (deleted)
  ```

  Bot and project memory that a bot learned in the conversation stays. Its source link still
  works, and the source shows "Deleted conversation".

Example: The owner deletes "Sign-in screens" in Login app while Designer is running. The run
stops, the conversation goes to Trash and "Stories review" opens. Five days later the owner
restores it from Trash. It is back in Login app with its 24 messages and memory. Its 4 files
stayed in the Login app Library the whole time.

Why: Projects (D47), skills (D49) and bots (D50) already go to Trash. A conversation was the only
item that the owner could not restore in the app. One rule for every delete is easier to learn,
and a conversation holds work that is slow to rebuild after a mistake.

Rejected:

- **Recover by hand from `data/trash/`.** The owner must find a folder on disk, and the messages
  and memory do not come back.
- **Hard delete.** Statistics and the daily cap lose the cost of its runs.
- **Type the name to confirm.** The delete can be undone for `trash_days`, so a typed name only
  slows the owner down (as for projects, D47).

Consequences: `domain-model.md` §5 adds `conversations.purged_at` and replaces the "recover by
hand" line. `api.md` needs a restore endpoint for conversations (with the Trash page round,
M5b). The Trash page design (M5b) shows conversations. Delete, Restore, the purge job and the
schema (`deleted_at`, `purged_at`) come together in slice M5b, so a delete can always be undone
(owner, 2026-10-26). The purge schema test starts in M4.

Implemented in: `../domain-model.md` §5, §16, `../api.md` §5, `../requirements/app-shell.md` UI-1.6,
`../design/components/conversation-page.md` §2.1.
