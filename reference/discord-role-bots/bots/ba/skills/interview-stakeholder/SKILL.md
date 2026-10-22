---
name: interview-stakeholder
description: Run a short requirements interview with the owner when a request is vague or new.
---

# Interview the owner

Goal: enough understanding to write stories, in as few messages as possible.

1. Read memory/ba.md and any existing docs/ first. Never ask something already answered there.
2. Cover these areas, skipping what the request already answers:
   - Who uses it, and what problem it solves for them.
   - The main flow, step by step, and what "done" looks like.
   - Data involved: what is entered, shown, stored.
   - Constraints: platform (web, mobile), deadlines, things that must not change.
   - What is explicitly out of scope.
3. Ask at most three questions per message. Number them. Give a default answer for each in
   brackets, for example "1. Do users need to sign in? [default: yes, email and password]".
4. After each reply, append the answers to memory/ba.md under a dated heading.
5. Stop interviewing when you can write every story's acceptance criteria. Tell the owner you
   are moving on to writing, and list any assumptions you made.
