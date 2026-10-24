---
name: write-user-stories
description: Use when the owner asks for user stories, requirements or acceptance criteria for a feature, or when a brief must become work that a designer can start.
---

# Write user stories

## Steps

1. Read the brief, the project goal, the project instructions and the files the owner names.
2. List the users and the problems. If one is not clear, ask one question and stop.
3. Choose the file:
   - Always read the Library index (`README.md`) first. If a stories file for this feature
     exists, update it. Do not make a second file for the same feature.
   - If no such file exists, make a new one. Put it in the folder that the project instructions
     set for stories; if they set none, use a topic folder. Use a kebab-case name for the
     feature and no date, for example `requirements/login-stories.md`. Add a line for a new
     folder to `README.md`.
4. Write the stories with the layout below. One story for each user goal.
5. Read the file again. Check each item in "Done when". Fix each item that is not true.
6. If all items are true, propose a handoff to the Designer with the file (skill
   `hand-off-work`). If an item stays false and you cannot fix it, name the blocker and ask
   the owner. Do not hand off, with one exception: hand off work with a gap when the owner asks
   for it, or when the next task is about that gap. Then list the gap under "Open questions".

Layout of the stories file:

```markdown
# <Feature name>

## Context
Two or three sentences: who it is for and the problem it solves.

## Stories

### S1. <short title>
As a <user>, I want <capability>, so that <benefit>.

Acceptance criteria:
- Given <state>, when <action>, then <result>.

Notes for design: the screens and states this story needs (empty, loading, error, success).

## Out of scope
## Open questions
```

## Done when

- Each user goal in the brief has a story.
- Each acceptance criterion is a yes or no check. No vague words ("fast", "easy"): give the
  number or the behaviour.
- Each story names its UI states: empty, loading, error, success.
- Each story has at least one failure case.
- Open questions are listed, not guessed.

## Reply

Name the file, the number of stories, and the open questions. Say whether you proposed a
handoff. If a "Done when" item is not true, name it. Then say either that you did not hand off
and why (the blocker), or that you handed off with this gap and why (the owner asked, or the
next task is about it).
