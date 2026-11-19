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
Stop time: <YYYY-MM-DD HH:MM and zone>
Report ready by: <time>
Wake me if: <a list of events, or "never">

## Session goal and rehearsal
Session goal: <"set by the owner's /goal line" | "none in this harness. The heartbeat is the only wake source.">
Rehearsal: <"passed on <date>, recorded in <where>" | "owner override: <exact owner words>" | "none: no row for an action that cannot be undone">

## Permissions (each action that changes something outside my scratch files needs a row; an action with no row is not permitted)
| Id | Action | Items (by name) | Condition | Ends |
| --- | --- | --- | --- | --- |
| P1 | merge | PR 1, PR 3 | <the merge bar, in the owner's or the project's words> | at the close |

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

## 2. The read-back

Show it on one screen. Use the owner's words where you can. End with the `/goal` line.

```text
Night card <run id>. Please check it.

Goal: <goal>. Done test: <done test>.
Stop: <stop time>. Report ready by <time>. Wake you if: <list or "never">.

I may:
- P1: merge PR 1 and PR 3, if <condition>. Ends at the close.
Nothing else outside my scratch files.
Rehearsal: <passed on <date> | your override: "<words>" | none>.

Stays for you (do it now, or it waits until the morning):
- PR 4 changes an agent instruction file. Command: <exact command>. It blocks PR 5.

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
/goal Night <run id> is closed: the conversation shows the line "NIGHT CLOSED <run id>" from night.py close. Close the night when each work-list item is done or waits for the owner on the checked morning report, or when a printed date shows <stop time> or later. Do only the actions that the night card at <card path> permits.
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
