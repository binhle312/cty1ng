# D52. Each run writes on its own branch and saves to the Library when it ends

Status: accepted (2026-10-23, owner). The owner gave the model ("like a git worktree: the
project is main, the conversation is a branch") and closed every open point in the review
thread. It amends D37 (workspace scope, moving a chat) and D23 (branch for an external folder).
It is built in M6.

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
- **File claims stop most overlaps.** The approved plan (D48) lists the files that the action run
  will write. When the action run starts, it claims those files in its Library. An action run
  that needs a file that another running action run claimed waits in the queue ("Waiting for
  Pricing chat"). When the first run saves (or is discarded), its claims end, and the waiting run
  starts from the new main. Runs with different files run at the same time.
- **Overlap rule (the fallback): git merge first, then last write wins, with a notice (owner,
  2026-10-23).** A bot can write a file that is not in its plan (owner, 2026-10-23); the save
  marks such a file "not in plan" in the chat and in the history. An **overlap** is a file
  that the run changed and that main also changed after the run started. Nothing waits:

  | Case | What the save does | Notice in the chat |
  | --- | --- | --- |
  | The changes are on different lines | Git's normal merge keeps both changes | "`glossary.md` also changed in Onboarding. Both changes were merged." with **View file** |
  | The changes are on the same lines | The run's version wins (last write wins) | "`glossary.md` also changed in Onboarding. This version was saved." with **Restore other version** |

  Restore saves the other version as a new commit "Owner restore", through the save queue. Git
  keeps every version, so nothing is lost. Binary files (images, PDFs) cannot merge by line, so
  they always use the second row.
- **Detection is built in full from the start.** Each overlap is recorded with the file, both
  runs and both commits. The rule that decides what an overlap does is one pure function in
  `core/` (`library-save.rules.ts`). A conflict card (nothing saved until the owner picks; the
  chat waits) can replace the notice later if the recorded overlaps show a need. That change
  adds a card and a waiting state, and it keeps the data model.
- **Failed or stopped run.** If the run wrote files, the app keeps its branch as **unsaved
  changes**. A card at the failed or stopped message says "BA stopped. 2 files are not saved."
  with Discard and Save to Library. Save to Library uses the same merge and the same overlap
  rule. If the owner does not choose, the app discards the branch after `trash_days` (D49,
  default 30), as Trash does (owner, 2026-10-23). The card shows the date: "Discarded on
  2026-11-22 if you do nothing".
- **Attachments.** An upload goes straight to main, in `attachments/<yyyy-mm-dd>-<chat-slug>/`,
  before the run starts, as one commit "Owner upload". It has no branch. Bots cannot write to
  `attachments/`. (The current spec calls this folder `inbox/<message_id>/`; the message keeps
  the link to its files in the database.)
- **Write rule (owner, 2026-10-23).** A bot writes only to the Library that its run saves to:
  the chat's Library outside a project, the project Library in a project. It can write any path
  in that Library except `attachments/` (read-only) and `.git`. Bots have no per-bot write folders (`write_paths` is
  removed by the Bots pages spec PR). `resolve()` keeps every path inside the run's worktree. The plan card (D48) lists
  the files before the owner approves, so the owner still sees each write in advance.
- **File structure follows git practice (owner, 2026-10-23).** Folders are by topic, not by
  author: git history already records which bot, chat and run wrote each line, so `out/<slug>/`
  is dropped. A new Library starts with three files, made by the app in its first commit:

  | File | Purpose |
  | --- | --- |
  | `README.md` | The Library index: one line per folder, what it holds. Bots read it first and update it in the same save when they add or rename a folder (as in this repository, `architecture.md` §4.2) |
  | `.gitignore` | Temporary and system files (`.DS_Store`, `~$*`, `*.tmp`) never get saved |
  | `.gitattributes` | Text files use LF line ends; images and PDFs are marked binary, so a diff never shows their bytes |

  Names are lower-case kebab-case (`user-stories.md`), with no spaces and no dates in the name;
  the history keeps the dates. Bots make folders only when needed. The project instructions
  (D45) can set the folders; then bots follow them. No Git LFS: one owner and small files do not
  need it, and the upload size limit (`security.md` §2.4) stays the guard.
- **The Library is a real folder (owner, 2026-10-23, from Cowork).** Main is a normal folder of
  plain files on disk. The Library page has "Open folder", so the owner can open it in Finder or
  any editor. The owner can change files there. Before an action run starts and before each
  save, the app checks main with `git status`. If the owner changed files, the app saves them
  first as one commit "Owner edit", through the save queue. So bots always see the owner's
  newest files, and nothing the owner wrote is lost. An owner edit to a file that a running run
  also changes is an overlap at that run's save: the run's version wins, with the notice. Files that match the D23
  deny-list (`.env*`, `*.pem`, `*.key`, `id_*`) stay hidden from bots.
- **A delete or a move always needs approval (owner, 2026-10-23, from Cowork).** This is true
  even inside an approved plan. A bot's delete or move does not change files at once. The run
  records it. At the save, a card lists each delete and move with Approve and Reject. Approve
  saves them with the rest of the run. Reject saves the rest of the run without them. D23
  already has this rule for an external folder; now every Library has it.
- **Moving a chat into a project (owner, 2026-10-23).** The move dialog has "Copy files to the
  project Library", checked by default. Copy saves the chat's files (not `attachments/`) to the
  project Library as one commit "Moved from <chat>", through the save queue. A file with the
  same name gets the `-from-<chat-slug>` suffix. Unchecked, nothing is copied. Either way, the
  chat's own Library stays as a read-only archive, readable from that chat. A chat cannot move
  while one of its runs is running or has unsaved changes.
- **A Library belongs to its owner and goes to Trash with it (owner, 2026-10-23).** A project
  Library goes to Trash with its project and comes back with it (D47). A chat outside a project
  takes its own Library to Trash and back. Deleting a chat inside a project leaves its files in
  the project Library, because they belong to the project; git history still shows which chat
  wrote them. Unsaved changes and the run worktrees go to Trash with their chat. The purge after
  `trash_days` (D49) deletes the Library folder.
- **The word "branch" is not in the UI.** D13 uses "branch" for edited messages. The UI says
  "Saved to Library", "unsaved changes" and "also changed in".

Example: The project "Clinic app" has two chats. Both plans list `requirements/glossary.md`.

| Time | What happens |
| --- | --- |
| 10:00 | In "Pricing", the owner approves BA's plan. The action run starts and claims `glossary.md` |
| 10:01 | In "Onboarding", the owner approves BA's plan. The run waits: "Waiting for Pricing chat" |
| 10:03 | The Pricing run ends. The save queue saves it. Main is `b2`. The claim ends |
| 10:03 | The Onboarding run starts from `b2`, so it sees the Pricing change. No overlap |

Fallback: if the Onboarding plan did not list `glossary.md` but BA wrote it anyway, both runs
start at 10:00 and 10:01. At 10:04 the Onboarding save finds that `glossary.md` changed on main
at 10:03. Its version is saved. The Onboarding chat shows the notice, and Designer's next run
starts at once. The owner reads both versions and presses Restore other version if the Pricing
text was better.

In a chat outside a project, runs are one at a time (D11) and nobody else writes to its
Library, so an overlap cannot happen there. The branch still gives the all-or-nothing save and
the unsaved changes after a failure.

Why:

- **Today (D37), runs write straight into the shared project workspace.** Two chats in a
  project can run at the same time, so a bot can read a file that another bot changes in the
  middle of its run. A failed or stopped run leaves half its files in the Library.
- **A branch per run makes each run all-or-nothing**, and it isolates runs like a database
  transaction with snapshot isolation: the run sees main as it was at its start, and an overlap
  is a write-write conflict at commit time.
- **One merge commit per run** gives a clear history in the Library ("BA in Pricing: 2 files"),
  and a later "Undo this run" is one revert.
- **The write rule needs this.** Without per-bot write folders, any bot in a project can change
  any project file. Two bots in two chats can change one file at the same time. The branch
  per run, file claims and git history make this safe: nothing is lost, and the owner sees
  each overlap.

Not chosen:

- **One run at a time per project** (D11 for the whole project). It is simpler and has no
  overlaps. But a long run in one chat would block every other chat in the project for
  minutes, and a failed run still needs a rollback of main. The owner works in several chats of
  one project at the same time. File claims block only the runs that need the same files.
- **A branch per chat, saved to the project only when the owner says so** (the middle level).
  Project files would be out of date in the other chats until the owner merges, and the owner
  would merge twice.
- **The owner approves each save.** D48 already asks for approval before the action run. A
  second approval after it doubles the work for no new safety: the owner can still revert.
- **A save queue with no file claims.** The queue sets the order of saves but still lets two
  runs start from the same main, so the second save overlaps.
- **A conflict card on each overlap** (nothing saved until the owner picks, the chat waits).
  Safest, but work stops while the owner is away, for a case that file claims make rare. It
  stays the next step if the recorded overlaps show a need.
- **Last write wins with no notice.** The owner might never know that a change was replaced.
- **Refuse writes outside the plan.** No overlaps at all, but each extra file (an index line, a
  link) would need a new plan and one more approval.
- **Whole-file compare only** (the later version always wins). It would throw away one chat's
  change even when the two chats changed different parts of the file.
- **Keep unsaved changes until the owner chooses.** The list would grow with no end. Trash
  already sets how long the owner has to decide, so the same setting applies.
- **Save unsaved changes automatically.** Half-done files would mix with good ones.

Consequences:

- **Workspace port (M6).** New operations: start a run branch, save a run (result: saved,
  saved with overlaps and their file list, or nothing to save), restore the other version of a
  file, and discard. `resolve()` (security rule 7) maps paths inside the run's worktree.
  The save queue (one per Library) replaces the per-repo lock for the whole run; file claims
  are rows in the database, taken in the same transaction that starts the action run. The port's contract
  suite gets tests for each result.
- **Disk layout** (`domain-model.md` §11): `data/libraries/<library-id>/` (main, checked out),
  `data/run-worktrees/<run-id>/` (deleted after the save). The app does not watch the folder;
  it checks `git status` only at run start and at save.
- **Crash safety.** Git and the database cannot share a transaction. The app records the save
  in a new table (for example `run_branches`: run, Library, base commit, head commit, state,
  merge commit, overlap files). The merge is idempotent: if main already holds the run's head
  commit, the app only finishes the database step. A check at start-up finishes any half-done
  save. This needs a migration, so the owner approves it in the M6 plan.
- **Events** (`realtime-events.md`): `library.saved` (with any overlaps), `library.unsaved`,
  `library.restored`, `library.discarded`. Each is written in the same transaction as the run's final state or the
  owner's choice. A Library page in another chat of the project refreshes from these events.
- **Run order (D11).** The next run in a chat starts only after the save of the run before it
  A handoff target therefore sees the files of the bot that handed
  off.
- **Flow view (M8).** The run's last step shows "Saved to Library" (with an overlap mark when
  there is one) or "Unsaved changes".
- **UI design (M6 Library round).** The overlap notice, the unsaved changes card, the delete and move approval card, the
  Library entry for chats outside a project (owner, 2026-10-23: the chat row's ⋯ menu gets
  "Library", which opens a floating card with the file tree on the left and the file content
  on the right, like a git UI; the project Library page reuses the same tree and viewer), and an
  "Unsaved changes" list on the Library page.
- **D37** changes from "conversations share one workspace" to "conversations share one main;
  each run writes on its own branch", and a move into a project can copy the chat's files. **D23** keeps its review branch; each run's branch saves
  into it, and the owner merges it in their own tools.
- **Documents to change when accepted:** `domain-model.md` §11 (folders, new table, invariants),
  `architecture.md` (workspace port, lock), `security.md` §2.3 (run worktree), `realtime-events.md`, `api.md`
  (resolve and discard endpoints), `conversation-rules.md` (run end), `tasks/M6-workspace-parity.md`.

Implemented in: `../tasks/M6-workspace-parity.md` (the brief and the documents listed above
change before the M6 plan starts).
