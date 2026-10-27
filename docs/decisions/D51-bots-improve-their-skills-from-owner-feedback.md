# D51. Bots improve their skills from the owner's feedback, and the owner approves each change

Status: accepted (2026-10-23, owner). The owner asked for this feature and made it required,
not optional. The owner accepted it with one rule: nothing is hard-coded, so every number below
is a setting. Amended the same day by the owner: a change note is neutral, not bad, because
iterative work such as design review needs many rounds. Amended on 2026-10-24 by the owner,
from the pstack review and sketches: a blind probe, per-run choices (signals and number of
tasks), an "Improve" item in the bot's ⋯ menu, and the draft card in the bot's 1:1
conversation. Amended on 2026-10-27 by the owner, from the review thread "Explain our eval and
guardrail features": fixed test cases for each skill. It uses D6 (pinned versions), D41 (skill drafts), D48 (plan card) and D39 (guard).
The idea comes from google-research/harness2 (propose, probe, compose), adapted to one owner
and few tasks.

Decision:

- **What changes.** Only skills. An improvement is a new version of a skill (D6), or a new
  skill. Persona, memory, tools and model do not change. Persona has no versions, so a bad
  change could not be undone with one click.
- **The grader is the owner.** harness2 scores many benchmark tasks with graders. This app has
  no graders and few tasks. The owner's feedback is the score. The app records these signals:

  | Signal | Source | Meaning |
  | --- | --- | --- |
  | Rating and note on a bot reply | New: up or down, optional note (UI-3.27) | Good or bad answer, and why |
  | Plan approved as its first version | D48 | Good plan |
  | Each Request changes note | D48 | Neutral, with a note: Improve reads it to find patterns. Each note is one signal, but never a bad one |
  | Plan approved after one or more change requests | D48 | Neutral: not a signal |
  | Plan rejected | D48 | Bad: wrong task or wrong approach |
  | Skill draft rejected | D41 | Bad: wrong procedure |

  These are not signals:
  - An edit of an owner message (D13). The owner can edit for many reasons, so the meaning is
    not clear.
  - A normal message that the owner sends while a plan waits. D48 treats it as a change
    request, but Improve uses it only as context, because it can be a new idea and not a
    complaint.
- **Only the owner marks a mistake.** Bad answer, Reject and a rejected skill draft are the only
  bad signals. A change request can mean "you got it wrong" or "let's refine", and the app
  cannot tell them apart. Example: four rounds of "try a warmer colour" on a Designer plan are
  normal design work, so they never make Designer look bad.
- **Which skill a signal is about.** The app links each signal to its run, and the run to the
  skill versions it used (`run_skills`, D15). A signal on a run that used no skill counts for
  the bot, and can lead to a new skill.
- **When the app offers it.** The app shows "Improve <bot>" on the bot page and on the skill
  row when one skill version has enough new signals. The default is **3 or more** new signals,
  from **2 or more** conversations, with **1 or more** bad. One odd note never starts a
  change, and neutral notes alone never start one. The three numbers are settings (`improve_min_signals`,
  `improve_min_conversations`, `improve_min_bad_signals`), not constants. The app never starts
  an Improve run by itself, because it costs money.
- **Improve at any time (owner, 2026-10-24).** The bot's ⋯ menu always has **Improve**, also
  below the offer threshold, for example after one bad answer. The threshold decides only when
  the app offers the button; it never blocks the owner.
- **Pick the signals for this run (owner, 2026-10-24).** Improve (the button or the menu item)
  first opens a dialog: the skill version, and its new signals, all ticked, each with its note
  and conversation. The owner can untick a signal, or press "Add older signals" to add signals
  that an earlier draft used. The dialog shows the count and the estimated cost; **Draft vN**
  starts the run. The run reads only the ticked signals. The settings do not change.
- **Propose.** The owner presses Draft vN. The app opens the owner's 1:1 conversation with that
  bot (it makes it if it does not exist yet), adds the line "You started Improve for <skill vN>
  with <n> signals", and starts an Improve run for that bot there. The draft card appears in
  that 1:1 conversation, so every skill change of a bot stays in one place and no project
  conversation is interrupted. While the card waits, the conversation shows "Waiting for you"
  and the bot page shows "Draft vN waiting" with Open. The run
  has read-only tools. It reads the skill version and the signals (notes, the plan or reply,
  and the owner's message before it). It gives a skill draft (D41 card, diff against the
  current version) with a list of the signals it used, each with a link. The draft can add,
  change, merge or delete rules. Skills that only grow get worse, so the card shows the change
  in length (for example "1,840 → 1,610 characters"). The draft passes the
  guard (D39). The run uses the bot's model and counts against the daily caps (D20, D42).
- **Probe (optional, paid).** On the draft card, "Test on past tasks" replays earlier tasks of
  the signals: once with the current version and once with the draft, with read-only
  tools and no file writes. First a small step sets the number of tasks for this probe: it
  starts at `improve_probe_tasks` (default 3), the owner can change it from 1 to the number of
  eligible tasks (the skill's saved test cases plus the tasks behind the signals, amendment
  2026-10-27), at most `improve_probe_tasks_max` (default 10), and the estimated cost updates
  with it. With no eligible task, "Test on past tasks" is off. The app reserves the cost as D46 does, so a probe never passes the cap.
  The replayed messages pass the guard (D39) again. No model judges the answers in this
  version: the owner judges.
- **The probe is blind (owner, 2026-10-24).** The owner sees one task at a time, with
  "Answer A" and "Answer B". The app hides which version made each answer and puts the two
  versions in a random order for each task. The answers show no marks that tell the versions
  apart. The owner picks **A is better**, **No difference** or **B is better**, with an optional
  note. After the last task, the app shows which letter was which version and the score ("v4
  won 2 of 3, 1 tie"), and the draft card shows the same line. The probe picks are evidence
  on the card only; they are not signals and never count toward the offer threshold.
  Reason: the owner asked for the draft, so a visible label pulls the owner toward the new
  version. Limit: the blind step hides labels and order, not content. If the new version adds
  a visible rule (for example a failure case in each story), the owner can still guess it, so
  the score is evidence, not proof.
- **Test cases (owner, 2026-10-27).** The probe replays only the tasks behind the new signals.
  So a task that a skill did well before can break with a new version, and the owner does not
  see it. To stop this, each skill keeps a small set of fixed tasks:
  - **Save.** Each probe task has **Save as test case**, before and after the reveal. A test
    case belongs to the skill, not to one version. It stores a copy of the task (the owner's
    message that started the task, as text), the place of the task (its project, or Home), the
    run it came from, and an optional note from the owner: "A good answer has …" (Markdown,
    at most 2,000 characters, passes the guard, D39).
  - **Only the message is saved.** The Save step says: "Only this message is saved. Earlier
    messages and attachments are not replayed." A task such as "Update the design from my
    last notes" needs its earlier messages, so it makes a weak test case. Self-contained tasks
    make good ones.
  - **Why a copy.** The source conversation can go to Trash and be purged (D60). The test case
    keeps its own text, so it stays usable.
  - **Limit.** At most `skill_test_cases_max` test cases for each skill (default 5). At the
    limit, the button is disabled with the tooltip "5 of 5 test cases saved. Remove one on the
    skill page".
  - **The probe uses them first.** The task count step lists every eligible task: the saved
    test cases first, then the tasks of the signals. The app ticks them in this order until the
    count reaches `improve_probe_tasks_max`; the rest stay unticked. The owner can tick or
    untick any task, and can never tick more than `improve_probe_tasks_max`. The app never
    deletes a test case to make room. Example: 5 saved test cases, 4 signal tasks and
    `improve_probe_tasks_max` = 6 give the 5 test cases and the first signal task ticked.
    A skill with saved test cases and no new signal can still run a probe. Each test case runs once with the current version and once
    with the draft, blind, as above. The "A good answer has …" note shows to the owner after
    the pick, not before, so it does not change the pick.
  - **The owner still judges.** No model judges a test case. Picks on test cases are evidence
    on the draft card, as other probe picks are. They are not signals.
  - **Two scores, not one.** One total can hide a regression: a draft that wins 4 signal tasks
    and loses 1 saved test case looks good overall. So the reveal and the draft card show one
    line for each group: "Saved test cases: v4 lost 1 of 5, 4 ties" and "Signal tasks: v4 won
    4 of 4". A group with no task shows no line.
  - **The Library can change.** A replay reads the current Library of its place, with
    read-only tools. Files can be different from the day the test case was saved. The card
    shows the saved date of each test case. This is an accepted limit.
  - **Place gone.** When the project of a test case is in Trash, the probe skips the test case
    and shows "Project in Trash". When the project is purged, its test cases are deleted.
  - **Remove.** The skill page lists the test cases with Remove. Remove is a permanent delete
    with the Undo toast (D62). When the skill goes to Trash or is purged (D49), its test cases
    go with it.
  - **Settings.** The Skill improvement page gets the row "Test cases, most"
    (`skill_test_cases_max`, `../design/components/settings-page.md` §4.10).
  - The M5d UI design round designs the button, the list, the task count step and the new
    Settings row.
- **Compose.** The owner approves the draft as in D41. The owner is the author (D14), and the
  bot uses the new version. To roll back, the owner picks the old version on the bot page
  (D6). The signals that the draft used are marked as used, so they do not count again.
- **How to check the cause.** A bad answer can come from the skill or from memory. The owner
  checks this with the tools that exist, and the app builds nothing new for it:

  | Test | How | Why it works |
  | --- | --- | --- |
  | Same skills, no memory | Start a new conversation with the bot and turn on "Don't use memory" (UI-9.6) | The bot reads no memory. If the answer is good now, memory caused it |
  | Other skill version, same memory | Clone the bot, pin the other version, and give the same task in the same project | Both bots read the same project memory. A clone starts with empty bot memory, but in a project, project memory comes first (D43) |
- **Lessons.** harness2 also keeps a library of lessons. Here, facts go to memory (D38) and
  procedures go to skills. The app does not add a third store.

Example: In three conversations, the owner rates a BA reply down with the note "No acceptance
criteria", and asks for changes on one plan with "Use Given/When/Then". All three runs used
`write-user-stories` v2. The bot page shows "Improve BA (3 signals)". The owner presses it, keeps
all three signals ticked and presses Draft v3. The app opens the owner's 1:1 conversation with
BA, and BA drafts v3 there: it adds "Write acceptance criteria as Given/When/Then" and links
the three signals. The owner presses "Test on past tasks", lowers the count from 3 to 2
(estimate $0.06), and compares Answer A and Answer B for each task without labels. The reveal
says "v3 won 2 of 2". The owner approves. BA uses v3 from the next run.

Why: The owner wants bots that get better over many tasks. Memory (D38) and skill drafts (D41)
already improve a bot, but only when the owner sees a pattern and asks. Improve finds the
pattern in the owner's feedback. The owner still approves each change, so D6 stays true: a
bot's behaviour changes only when the owner decides.

Not chosen:

- **The app adopts a change by itself** when the bot thinks the new version is better.
  harness2 composes without ground truth, from many runs. With tens of tasks, a bot that
  judges its own answers gives mostly noise, and the change would break D6.
- **A model judges the probe.** It adds cost and the same bias. It can come later, as one more
  view for the owner, never as the decision.
- **Improve persona or memory too.** Persona has no versions, and memory already has its own
  save flow (D38).
- **Use edits as a signal.** The meaning is not clear (see above).
- **Build it before M5c.** It needs the skill draft card (M5c) and the plan card (D48). A
  temporary card would be work that M5c replaces.

Consequences:

- Slice **M5d** (after M5c): the Improve run, the signal count, the "Improve <bot>" button and
  the "Improve" menu item, the signal dialog, the draft card in the 1:1 conversation with its
  "Draft vN waiting" link, the evidence list on the draft card, and the blind probe with its
  task count step, and the test cases (amendment 2026-10-27). M5d needs a brief and a UI
  design round.
- Signals must exist before M5d, or Improve has nothing to read. So:
  - M3 adds the reply rating (`reply_feedback`, UI-3.27 and UI-3.28, `PUT` and `DELETE`
    `/messages/{id}/feedback`, event `message.feedback`).
  - The slice that builds the plan card (D48) stores, for each plan version, its run id, its
    outcome (approved, changes requested, rejected, superseded by a normal message) and the
    owner's note.
  - `skill_drafts` already stores `rejected` (D41).
- New TypeID prefix: `fb` (`reply_feedback`). M5d adds the tables for Improve runs and probes,
  and `skill_test_cases` (TypeID prefix `stest`, `../domain-model.md` §15).
- New settings, with their defaults: `improve_min_signals = 3`,
  `improve_min_conversations = 2`, `improve_min_bad_signals = 1`, `improve_probe_tasks = 3`,
  `improve_probe_tasks_max = 10`, `skill_test_cases_max = 5` (`../domain-model.md` §10). M5d adds them to the Settings page.
- Costs: one Improve run per Draft vN, and two runs per probe task (6 with the default; the owner
  sets the count for each probe). Both count against the caps.

Implemented in: `../domain-model.md` §15, `../requirements/conversation.md` UI-3.27 and
UI-3.28, `../api.md` §5, `../realtime-events.md` §4, `../tasks/M3-chat-one-bot.md`,
`../development-plan.md` (M5d).
