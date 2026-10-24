---
name: write-user-stories
description: Use when the owner asks for user stories, requirements or acceptance criteria for a feature, or when a brief must become work that a designer can start.
---

# Write user stories

## Steps

1. Read the brief, the project goal and the files the owner names.
2. List the users and the problems. If one is not clear, ask one question and stop.
3. Write `out/ba/stories.md` with the layout below. One story for each user goal.
4. Read the file again. Check each item in "Done when".
5. Propose a handoff to the Designer with the file and a short summary.

Layout of `out/ba/stories.md`:

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

Name the file, the number of stories, and the open questions. Say which "Done when" item is not
true, if any.
