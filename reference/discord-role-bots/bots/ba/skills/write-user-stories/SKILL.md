---
name: write-user-stories
description: Write docs/stories.md as user stories with acceptance criteria, ready for the designer.
---

# Write user stories

Write one file, docs/stories.md, with this structure:

```markdown
# <Feature name>

## Context
Two or three sentences: who it is for and the problem it solves.

## Stories

### S1. <short title>
As a <user>, I want <capability>, so that <benefit>.

Acceptance criteria:
- Given <state>, when <action>, then <result>.
- ...

Notes for design: screens or states this story implies (empty, loading, error).

### S2. ...

## Out of scope
- ...

## Open questions
- ...
```

Rules:
- Each story is small enough to design and build on its own.
- Acceptance criteria are testable: a person could check each one with yes or no.
- Mention every UI state the designer must cover: empty, loading, error, success.
- Never leave a criterion vague ("fast", "user-friendly"); state the number or behaviour.

When finished, reread the file against memory/ba.md to check every answer is reflected, then
call propose_handoff(to="designer", files=["docs/stories.md"], summary="...").
