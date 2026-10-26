# D61. Projects are closed: files cross between places only by an approved copy

Status: accepted (2026-10-26, owner). From the round 12 thread: the owner set the isolation rule
(02:44), the copy flow (03:10) and three clarifications (03:15), then approved the whole set
(03:16). It amends D38 (no move out of a project), D47 (keep a conversation) and D52 (moving a
conversation into a project).
Amends: D38, D47, D52

Decision:

- **A project is closed.** A bot in Project A cannot read, search, change or get the files or
  the project memory of Project B. A bot in a project cannot read the Home Library. A Home bot
  cannot read a project Library. Each run sees only the Library of its own place (D52).
- **A project conversation stays in its project.** There is no move from a project to Home, and
  no move between projects. Only a Home conversation can move into a project. The reason: the
  history of a project conversation holds project facts, and a move would show them to other
  bots.
- **A move into a project (amends D52).** The move dialog lists the files that the
  conversation's runs saved to the Home Library. Each file has a box, and all boxes are ticked.
  The app copies the ticked files to the project Library as one save. The originals stay in the
  Home Library. After the move, the conversation uses the project Library. It does not take its
  old Library with it.
  - **Pinned versions (owner, 2026-10-26).** Each file row shows and pins the **newest saved
    version in the Home Library when the dialog opens** ("saved 03:08 by BA", commit id in the
    tooltip). The move copies that version, as Copy to does. If another conversation made that
    save, the row says so: "saved 03:20 by Designer in "Trip ideas"" (the wording of the D52
    plan-card guard). If a newer version is saved while the dialog is open, the row says "A newer
    version was saved at 03:25", and Move still copies the pinned version.
    Example: "Ideas" saves `notes.md` at 03:08, then "Trip ideas" changes it at 03:20. When
    "Ideas" moves into a project, the row shows "saved 03:20 by Designer in "Trip ideas"", and
    the 03:20 version is copied. Not chosen: copy the moving conversation's own last version,
    because the project would get an old file without the later edits.
  - **When a move is possible (owner, 2026-10-26).** Move to project is unavailable while the
    conversation has a queued or running run, a save in progress, or unsaved changes. The
    server checks these conditions again before it commits the move, because a run can start
    after the dialog opens. If one is true, the move fails and nothing changes.
  - **Two slices (owner, 2026-10-26).** M5b builds the move itself: `project_id`, the project's
    memory and instructions from then on, and the check for a queued or running run. M6 adds
    the file step (ticked boxes, pinned versions, the copy save) and the check for a save in
    progress or unsaved changes, because Libraries and saves start in M6.
- **Copy to.** A file goes from one place to another only as a copy that the owner approves:
  - The owner presses **Copy to** on a file in a Library page, and picks Home or a project.
  - A bot proposes a copy with the tool `propose_copy` (file and destination). The bot sees the
    names of the places, never their files.
  - **Add from Home Library** on a project Library page is the same copy, from Home into this
    project.
- **The approval card.** A bot proposal shows a card in its conversation:

  ```
  ┌ Copy to another place ───────────────────────────┐
  │ Source:       Project A                           │
  │ File:         handoff.md                          │
  │ Version:      saved 03:08 by BA                   │
  │ Destination:  Project B                           │
  │ [Show file]                                       │
  │                              [× Reject] [✓ Approve]│
  └───────────────────────────────────────────────────┘
  ```

  **Show file** opens the content of the pinned version. The tooltip on the version shows the
  commit id. The owner's own Copy to has the same card.
- **Only a saved version is copied.** A bot can propose during its run. The card then waits
  until the run saves, and it pins the version of that save. If the run fails or the owner
  discards its changes, the proposal ends as "Cancelled: the run did not save". If the file
  changes again before the owner approves, the card says "A newer version was saved at 03:20".
  Approve still copies the pinned version.
- **The app copies, not a bot.** After Approve, the app copies the exact version into the
  destination Library as one commit "Copied from Project A". It records the source place, path,
  commit and the approval. A file with the same name gets the suffix `-from-<place-slug>`.
- **No bot starts.** The copy only adds the file. In the destination, the file and the Library
  row show a **New** tag. Opening the file clears its tag. The Library row clears its tag when no
  new file remains. Opening the Library page alone clears nothing. The owner asks a bot there to
  work on the file.
- **Limit.** `copy_proposals_max_per_conversation_24h` (setting, default 5) counts the bot
  proposals of one conversation in a rolling 24-hour period: pending, approved, rejected and
  cancelled. A blocked attempt does not count, and the bot gets the tool error
  `{error: "limit_reached"}`. The owner's own Copy to has no limit (the D58 rule).
- **Keep a conversation (amends D47).** Before a project delete, the owner cannot move one
  conversation out. The Delete project dialog tip becomes: "To keep something from this
  project, ask a bot to write it to a file, then use Copy to."
- **Not now.** The app does not search Libraries for the bot automatically. Bots open the
  Library `README.md` index first, as D52 says. A search index waits until a Library is big.
- **A Coordinator later.** If a coordinator bot comes later (D58: only when real use shows a
  need), it routes copy proposals and sends notices. It never reads a Library, never copies
  bytes and never starts a run.

The flow:

```
 PROJECT A                      APP                         PROJECT B
 BA writes handoff.md
 BA proposes Copy to B ──────▶ waits for the save
                               card: pinned version
 owner: [✓ Approve] ─────────▶ copies that version ──────▶ handoff.md  [New]
                               records the source           no bot starts
                                                            owner asks Designer
```

Example: In "Login app", BA writes `auth-handoff.md` and proposes a copy to "Travel app". The
run saves at 03:08, and the card shows "Version: saved 03:08 by BA". The owner opens the file,
then presses Approve. "Travel app" gets `auth-handoff.md` with a New tag. Nothing runs there.
Later the owner asks Designer in "Travel app" to use it.

Why: Projects are separate work, and the owner wants no information to leak between them. A
copy that the owner approves moves only the knowledge that the owner picks. The app does the
copy because a copy is fixed work: it needs no model, and it works when the destination bot
cannot run.

Not chosen:

- **Move a conversation out of a project, or between projects (D47 tip).** The whole history
  goes with it, and other bots can read the project facts in it.
- **A bot copies the file by itself.** Then a bot in one project writes into another project
  without the owner.
- **A coordinator that reads every Library.** It becomes the weakest point for security.
- **Copy the newest version at approval.** The owner could approve a file that changed after
  they read it.

Consequences: `domain-model.md` gets the isolation rule as an invariant and the new setting.
The M6 brief gets the copy table (`library_copies`: source and destination Library, path,
commit, conversation, run, status, decision time), the New state per destination file, the
`propose_copy` tool, the card and the API endpoints; the schema design goes into the M6
initial schema. The M6 Library round designs Copy to, Add from Home Library, the card and the
New tag. `requirements/settings.md` UI-9.7 and the conversation menu drop "Move out of project".

Implemented in: `../domain-model.md` §5 and invariants, `../requirements/settings.md` UI-9.7,
`../design/components/conversation-page.md` §2.1, `../design/components/project-settings-page.md`
§6, `../tasks/M6-workspace-parity.md`.
