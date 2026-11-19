# Night card, read-back, /goal line, heartbeat

## 1. The card

`night.py new` writes the first part of `card.md` (the run id and the owner's exact words). You
fill the rest from this template. Keep each part short. Write each item by its name (a PR number,
a branch, a file), never by a class such as "the good PRs".

```markdown
# Night card <run id>

## Owner's words (exact)
<written by night.py new; later owner messages go in "Amendments">

## Goal
<the owner's exact goal words>
Done test: <one measurable end, for example "PR 1 and PR 3 merged, PR 2 has a fix commit">

## Times
Stop time: <YYYY-MM-DD HH:MM and zone, with its offset, for example +07:00>
Report ready by: <time>
Wake me if: <a list of events, or "never">

## Session goal and rehearsal
Session goal: <"set by the owner's /goal line" | "none in this harness. The heartbeat is the only wake source.">
Rehearsal: <"passed on <date>, recorded in <where>" | "owner override: <exact owner words>" | "none: no row for an action that cannot be undone">

## Permissions (each action that changes something outside my scratch files needs a row; an action with no row is not permitted)
| Id | Action | Items (by name) | Condition | Ends |
| --- | --- | --- | --- | --- |
| P1 | merge | PR 1, PR 3 | <the merge bar, in the owner's or the project's words> | at the close |

## Items (night.py reads this block at the go; one row for each item, exact names)
```night-items
PR 1 | commit | gh pr merge 1 -R org/app --squash --match-head-commit {head}
PR 3 | commit | gh pr merge 3 -R org/app --squash --match-head-commit {head}
PR 2 | no-commit | gh pr comment 2 -R org/app --body-file notes/pr2.md
PR 4 | owner
```

## Standing permissions in force (not night permissions)
<each one: where the project records it, its scope and its end. The night does not change them.>

## Stays for the owner
| Item | Decision or action | Exact command or question | Blocks |
| --- | --- | --- | --- |

## I will not
<the safety stops that matter tonight, one line each>

## Limits
<agents, heavy commands, spend, from the project or the owner>

## Work list
| Item | Next step | Needs from the owner | Frees |
| --- | --- | --- | --- |

## Go
<night.py go writes the time; copy its output line here>

## Amendments
<time from night.py, exact owner words, the one-line read-back>
<each row that you removed at night, with the id of its hold row; the card only gets smaller>
```

Rules for the items block:

- Write one block, and write it outside the owner's words. `night.py items --dir <night>` prints the rows that it reads. Run it before the read-back.
- A name is exact: night.py takes `PR 1` and refuses `#1`, `pr 1` or a link. Two repositories give two names, for example `org/one#3` and `org/two#3`.
- The third column is the exact command. A slot is a whole word: `{head}` (the full 40-character head) or `{run}` (a CI run id). There are no other slots.
- `commit`: an action on a commit (a merge, a tag, a release). Its command has `{head}` one time, after the head-match option that the documentation of the tool names, and no `--` word. With no such option, the item gets no `commit` row.
- `no-commit`: an action that acts on no commit. Its command has no `{head}` and no sha. `owner`: the item stays for the owner, has no command, and night.py refuses each action on it. Notes and `wait` rows can name each item.
- A `gh` command names `-R owner/repo`. A command has no shell syntax and no environment word before it: night.py refuses the row at the go.
- A night action that the card must foresee gets its own row, for example a rerun of a failed CI run: `CI 12 | no-commit | gh run rerun {run} --failed -R org/app`. A `{run}` row can rerun any run of that repository.
- After the go, only an owner order adds an item (`log amend --add-item`).

## 2. The read-back

Show it on one screen. Use the owner's words where you can. End with the `/goal` line.

```text
Night card <run id>. Please check it.

Goal: <goal>. Done test: <done test>.
Stop: <stop time>. Report ready by <time>. Wake you if: <list or "never">.

Items (from night.py items, each with its exact command):
- PR 1 commit: gh pr merge 1 -R org/app --squash --match-head-commit {head}
- PR 3 commit: gh pr merge 3 -R org/app --squash --match-head-commit {head}
- PR 2 no-commit: gh pr comment 2 -R org/app --body-file notes/pr2.md
- PR 4 owner

I may:
- P1: merge PR 1 and PR 3, if <condition>. Ends at the close.
Nothing else outside my scratch files.
Rehearsal: <passed on <date> | your override: "<words>" | none>.

Stays for you (do it now, or it waits until the morning):
- PR 4 needs your review choice. Command: <exact command>. It blocks PR 5.

I will not: <one line>.

To start, send this line exactly:
/goal <the line from section 3>
```

A plain "go" or "yes" is not the go. Show the `/goal` line again, and wait. If the harness has no
`/goal` command, say so in the read-back and on the card. Then end the read-back with "To start,
reply: go".

## 3. The /goal line

The session goal keeps the work going after a turn ends. A small model reads the conversation after
each turn. It does not run commands and does not read files. So the condition names output that you
print in the conversation. The condition can have up to 4,000 characters.

Template (replace each `<...>`):

```text
/goal Night <run id> is closed: the conversation shows the line "NIGHT CLOSED <run id>" from night.py close or night.py status. Close the night when each work-list item is done or waits for the owner on the checked morning report, or when a printed date shows <stop time> or later. Do only the actions that the night card at <card path> permits.
```

Rules for the line:

- The end is the close, never the goal outcome. A goal outcome that needs the owner can never be met at night, and the loop would push past a correct stop.
- Print the date (`date`) at each heartbeat. The evaluator knows the time only from the conversation.
- The goal gives no permission. The permission mode of the session stays the same.

## 4. The heartbeat prompt

Make it with the scheduled-task tool after the go. Example schedule for 30 minutes: `13,43 * * * *`.
Minutes away from :00 and :30 avoid early runs. The prompt:

```text
Night heartbeat for <run id>. This is a timer, not an owner message. Print the date. Run night.py status and night.py check --now for <night folder>, and log one alive line with the state. If the stop time has passed, close the night. If an item on the work list can move, continue it. If nothing is left that you may do, close the night early.
```

The one-time stop task, one minute after the stop time:

```text
Stop time for night <run id>. This is a timer, not an owner message. Start no new work. Close the night now (overnight skill, section 11).
```

A skill with the owner-only flag does not run from a scheduled prompt. So the prompts are plain text.
Delete both tasks at the close.
