# D52. Each run writes on its own branch and saves to the Library when it ends

Status: proposed (2026-10-23). The owner gave the model ("like a git worktree: the project is
main, the conversation is a branch"). The owner agreed to three changes in the Bots pages
review: no middle level, a conflict card, and unsaved changes for a failed or stopped run.
The owner then set the write rule: a bot writes only to the Library of its chat. When accepted, it amends D37 (workspace scope) and D23 (branch
for an external folder), and it is built in M6.

Decision:

- **Where "main" is.** Each Library is a git repo with one `main` branch. The Library that a
  run saves to is set by where the conversation is, like memory (D38):

  | Conversation | Main (where the files are saved) |
  | --- | --- |
  | In a project | The project Library, shared by all its chats |
  | Outside a project, 1:1 with a bot | That chat's Library. The owner has one 1:1 per bot, so this is the bot's own Library |
  | Outside a project, several bots | That chat's Library |
  | With an external folder (D23, later) | The review branch `bots/<conversation-slug>`. The app never saves to the owner's own branch |

- **Each action run gets its own branch.** When an action run starts (D48), the app makes a git
  worktree on the branch `runs/<run-id>` from the newest commit of main. The bot reads and
  writes only in that worktree. Each write is a commit on the run's branch, as today. Other
  chats do not see these files until the run ends.
- **A planning run has no branch.** It is read-only (D48), so it reads main.
- **At the end of a run, the app saves the run to main.** If the run is done, the app merges its
  branch into main as one merge commit: "BA in Pricing: 2 files". Then the app deletes the
  worktree. The reply and the Library change appear together, in one event transaction.
- **No middle level.** A project chat has no branch of its own. Each run saves straight to the
  project Library. (A chat branch that every run merges into at once would always equal main.)
- **Save queue (owner, 2026-10-23).** Each Library has one save queue. Saves to main happen one
  at a time, in the order the runs end. A queue only sets the order of saves. It cannot stop two
  runs from changing the same file, so the app also uses file claims.
- **File claims stop most conflicts.** The approved plan (D48) lists the files that the action run
  will write. When the action run starts, it claims those files in its Library. An action run
  that needs a file that another running action run claimed waits in the queue ("Waiting for
  Pricing chat"). When the first run saves (or is discarded), its claims end, and the waiting run
  starts from the new main. Runs with different files run at the same time.
- **Conflict rule (the fallback).** A bot can still write a file that is not in its plan, so a
  conflict stays possible. A conflict is a file that the run changed and that main also changed after
  the run started. The app compares whole files, not lines. On a conflict, the app saves
  nothing from that run (all files or none), keeps the branch, and shows a conflict card in the
  chat:

  | Button | What happens |
  | --- | --- |
  | Use this chat's version | The run's files replace the Library files |
  | Keep Library version | The run's changes to the conflict files are dropped; its other files are saved |
  | Keep both (primary) | The run's version is saved as a copy next to the file, for example `stories (Pricing).md` |

  Until the owner chooses, the chat shows "Waiting for you", and the next queued runs of that
  chat wait. Other chats continue.
- **Failed or stopped run.** If the run wrote files, the app keeps its branch as **unsaved
  changes**. A card at the failed or stopped message says "BA stopped. 2 files are not saved."
  with Discard and Save to Library. Save to Library uses the same merge and the same conflict
  rule. The branch stays until the owner chooses. Nothing deletes it automatically.
- **Attachments.** An upload goes straight to main, in `inbox/<message_id>/`, before the run
  starts. It has no branch. Bots cannot write to `inbox/`.
- **Write rule (owner, 2026-10-23).** A bot writes only to the Library that its run saves to:
  the chat's Library outside a project, the project Library in a project. It can write any path
  in that Library except `inbox/` (read-only) and `.git`. Bots have no per-bot write folders (`write_paths` is
  removed by the Bots pages spec PR). `resolve()` keeps every path inside the run's worktree. The plan card (D48) lists
  the files before the owner approves, so the owner still sees each write in advance. The
  default place for new files stays `out/<slug>/`, as a prompt hint, not a permission.
- **The word "branch" is not in the UI.** D13 uses "branch" for edited messages. The UI says
  "Saved to Library", "unsaved changes" and "conflict".

Example: The project "Clinic app" has two chats. Both plans list `out/ba/glossary.md`.

| Time | What happens |
| --- | --- |
| 10:00 | In "Pricing", the owner approves BA's plan. The action run starts and claims `glossary.md` |
| 10:01 | In "Onboarding", the owner approves BA's plan. The run waits: "Waiting for Pricing chat" |
| 10:03 | The Pricing run ends. The save queue saves it. Main is `b2`. The claim ends |
| 10:03 | The Onboarding run starts from `b2`, so it sees the Pricing change. No conflict |

Fallback: if the Onboarding plan did not list `glossary.md` but BA wrote it anyway, both runs
start at 10:00 and 10:01. At 10:04 the second save finds that `glossary.md` changed on main.
The chat shows the conflict card and "Waiting for you". The owner presses Keep both, and main
gets `out/ba/glossary (Onboarding).md`.

In a chat outside a project, runs are one at a time (D11) and nobody else writes to its
Library, so a conflict cannot happen there. The branch still gives the all-or-nothing save and
the unsaved changes after a failure.

Why:

- **Today (D37), runs write straight into the shared project workspace.** Two chats in a
  project can run at the same time, so a bot can read a file that another bot changes in the
  middle of its run. A failed or stopped run leaves half its files in the Library.
- **A branch per run makes each run all-or-nothing**, and it isolates runs like a database
  transaction with snapshot isolation: the run sees main as it was at its start, and a conflict
  is a write-write conflict at commit time.
- **One merge commit per run** gives a clear history in the Library ("BA in Pricing: 2 files"),
  and a later "Undo this run" is one revert.
- **The write rule needs this.** Without per-bot write folders, any bot in a project can change
  any project file. Two bots in two chats can change one file at the same time. The branch
  per run and the conflict card make this safe: nothing is lost, and the owner picks.

Not chosen:

- **One run at a time per project** (D11 for the whole project). It is simpler and has no
  conflicts. But a long run in one chat would block every other chat in the project for
  minutes, and a failed run still needs a rollback of main. The owner works in several chats of
  one project at the same time. File claims block only the runs that need the same files.
- **A branch per chat, saved to the project only when the owner says so** (the middle level).
  Project files would be out of date in the other chats until the owner merges, and the owner
  would merge twice.
- **The owner approves each save.** D48 already asks for approval before the action run. A
  second approval after it doubles the work for no new safety: the owner can still revert.
- **A save queue with no file claims.** The queue sets the order of saves but still lets two
  runs start from the same main, so the second save conflicts.
- **Line-level merge** (git's normal merge). Two bots that change different lines of one
  document can give a merged text that reads wrong, and the owner does not see it. Whole-file
  compare is easier to explain and to test.
- **Delete unsaved changes after `trash_days`.** It would delete work that the owner did not
  see. Disk use is small, and one owner can clear the list.

Consequences:

- **Workspace port (M6).** New operations: start a run branch, save a run (result: saved,
  conflict with a file list, or nothing to save), resolve a conflict with one of the three
  choices, and discard. `resolve()` (security rule 7) maps paths inside the run's worktree.
  The save queue (one per Library) replaces the per-repo lock for the whole run; file claims
  are rows in the database, taken in the same transaction that starts the action run. The port's contract
  suite gets tests for each result.
- **Crash safety.** Git and the database cannot share a transaction. The app records the save
  in a new table (for example `run_branches`: run, Library, base commit, head commit, state,
  merge commit, conflict files). The merge is idempotent: if main already holds the run's head
  commit, the app only finishes the database step. A check at start-up finishes any half-done
  save. This needs a migration, so the owner approves it in the M6 plan.
- **Events** (`realtime-events.md`): `library.saved`, `library.conflict`, `library.unsaved`,
  `library.resolved`. Each is written in the same transaction as the run's final state or the
  owner's choice. A Library page in another chat of the project refreshes from these events.
- **Run order (D11).** The next run in a chat starts only after the save of the run before it
  (or after the conflict card). A handoff target therefore sees the files of the bot that handed
  off.
- **Flow view (M8).** The run's last step shows "Saved to Library", "Conflict" or "Unsaved
  changes".
- **UI design (M6 Library round).** The conflict card, the unsaved changes card, a Library
  entry for chats outside a project (the left bar has no Library row there today), and an
  "Unsaved changes" list on the Library page.
- **D37** changes from "conversations share one workspace" to "conversations share one main;
  each run writes on its own branch". **D23** keeps its review branch; each run's branch saves
  into it, and the owner merges it in their own tools.
- **Documents to change when accepted:** `domain-model.md` §11 (folders, new table, invariants),
  `architecture.md` (workspace port, lock), `security.md` §2.3 (run worktree), `realtime-events.md`, `api.md`
  (resolve and discard endpoints), `conversation-rules.md` (run end), `tasks/M6-workspace-parity.md`.

Implemented in: `../tasks/M6-workspace-parity.md` (when accepted).
