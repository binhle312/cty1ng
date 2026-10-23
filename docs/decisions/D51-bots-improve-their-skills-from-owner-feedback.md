# D51. Bots improve their skills from the owner's feedback, and the owner approves each change

Status: proposed (2026-10-23). The owner asked for this feature and made it required, not
optional. It uses D6 (pinned versions), D41 (skill drafts), D48 (plan card) and D39 (guard).
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
  | Plan approved as first version | D48 | Good plan |
  | Request changes, with the note | D48 | What was wrong |
  | Plan rejected | D48 | Wrong task or wrong approach |
  | Skill draft rejected | D41 | Wrong procedure |

  An edit of an owner message (D13) is not a signal. The owner can edit for many reasons, so
  the meaning is not clear.
- **Which skill a signal is about.** The app links each signal to its run, and the run to the
  skill versions it used (`run_skills`, D15). A signal on a run that used no skill counts for
  the bot, and can lead to a new skill.
- **When the app offers it.** The app shows "Improve <bot>" on the bot page and on the skill
  row when one skill version has **3 or more** new signals, from **2 or more**
  conversations, and at least one is negative. One odd note never starts a change. The app
  never starts an Improve run by itself, because it costs money.
- **Propose.** The owner presses Improve. The app starts an Improve run for that bot. The run
  has read-only tools. It reads the skill version and the signals (notes, the plan or reply,
  and the owner's message before it). It gives a skill draft (D41 card, diff against the
  current version) with a list of the signals it used, each with a link. The draft passes the
  guard (D39). The run uses the bot's model and counts against the daily caps (D20, D42).
- **Probe (optional, paid).** On the draft card, "Test on past tasks" replays 2 or 3 earlier
  tasks of the signals: once with the current version and once with the draft, with read-only
  tools and no file writes. The owner sees the two answers side by side. The app shows the
  estimated cost first and reserves it as D46 does, so a probe never passes the cap. The
  replayed messages pass the guard (D39) again. No model judges the answers in this version:
  the owner judges.
- **Compose.** The owner approves the draft as in D41. The owner is the author (D14), and the
  bot uses the new version. To roll back, the owner picks the old version on the bot page
  (D6). The signals that the draft used are marked as used, so they do not count again.
- **Lessons.** harness2 also keeps a library of lessons. Here, facts go to memory (D38) and
  procedures go to skills. The app does not add a third store.

Example: In three chats, the owner rates a BA reply down with the note "No acceptance
criteria", and asks for changes on one plan with "Use Given/When/Then". All three runs used
`write-user-stories` v2. The bot page shows "Improve BA (3 signals)". The owner presses it. BA
drafts v3, which adds "Write acceptance criteria as Given/When/Then", and links the three
signals. The owner presses "Test on past tasks" (estimate $0.06) and compares two old answers
with two new ones. The owner approves. BA uses v3 from the next run.

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

- Slice **M5d** (after M5c): the Improve run, the signal count, the "Improve <bot>" entry, the
  evidence list on the draft card, and the probe. M5d needs a brief and a UI design round.
- Signals must exist before M5d, or Improve has nothing to read. So:
  - M3 adds the reply rating (`reply_feedback`, UI-3.27 and UI-3.28, `PUT` and `DELETE`
    `/messages/{id}/feedback`, event `message.feedback`).
  - The slice that builds the plan card (D48) stores, for each plan version, its run id, its
    outcome (approved, changes requested, rejected) and the owner's note.
  - `skill_drafts` already stores `rejected` (D41).
- New TypeID prefix: `fb` (`reply_feedback`). M5d adds the tables for Improve runs and probes.
- Costs: one Improve run per press, and 4 to 6 runs per probe. Both count against the caps.

Implemented in: `../domain-model.md` §15, `../requirements/conversation.md` UI-3.27 and
UI-3.28, `../api.md` §5, `../realtime-events.md` §4, `../tasks/M3-chat-one-bot.md`,
`../development-plan.md` (M5d).
