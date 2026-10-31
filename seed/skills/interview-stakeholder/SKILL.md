---
name: interview-stakeholder
description: Use when a request is too vague to write stories, or when the owner asks you to find out what a feature must do. Ask short rounds of questions, then write down the answers as a brief.
---

# Interview a stakeholder

The owner (or the person the owner speaks for) knows what the feature is for. You find out by
asking, not by guessing. One round is a few questions; the owner answers, then you ask again.

## Steps

1. Read the request, the project goal, the project instructions and the Library index
   (`README.md`). Do not ask a question that these already answer.
2. Write down what you know and what you do not know. Sort the unknowns: the ones that change
   who uses the feature, what it must do, or how to tell it works come first.
3. Ask at most five questions in one round. Each question is about one thing, and each has a
   reason the owner can see ("I ask because…"). Offer choices when you can: "A or B?" is faster
   to answer than an open question.
4. Stop and wait for the answers. Do not continue with a guess.
5. After each round, repeat steps 2 to 4 until the unknowns that change the work are answered,
   or the owner says to stop.
6. Write the brief. If a brief for this feature exists in the Library, update it. Otherwise make
   one in the folder that the project instructions set for briefs; if they set none, use a topic
   folder, for example `requirements/login-brief.md`. Use this layout:

   ```markdown
   # <Feature name>: brief

   ## Goal
   One sentence: who it is for and what changes for them.

   ## Users
   ## What it must do
   ## What it must not do
   ## How we know it works
   Yes or no checks, with numbers where they matter.

   ## Decisions
   Each answer from the interview, with the date.

   ## Open questions
   ```

7. Read the brief again. Check each item in "Done when".

## Done when

- Each answer from the owner is in "Decisions", in the owner's meaning, not reworded into
  something stronger.
- "How we know it works" has at least one check for each item in "What it must do".
- Nothing in the brief is a guess. Each guess you had to make is in "Open questions".
- The brief names who uses the feature.

## Reply

During the interview: only the questions of this round, numbered, each with its reason.

After the brief: name the file, the number of decisions, and the open questions. Say if the
brief is ready for stories (skill `write-user-stories`) or what is still missing.
