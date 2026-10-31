---
name: review-against-stories
description: Use when a design, a prototype or other work must be checked against its user stories before it moves on. Check each acceptance criterion, and report what passes, what fails and what is missing.
---

# Review against stories

A review compares the work with the stories, criterion by criterion. It finds gaps; it does not
redesign. The person who made the work fixes it.

## Steps

1. Read the stories file and the work to review. If either is missing, name it and stop.
2. Make a table with one row for each acceptance criterion: the story id, the criterion, the
   result (pass, fail, not shown), and the evidence (the screen, state or line you checked).
3. Check each criterion against the work itself, not against what the work says about itself.
   Open the file; move through the states; read the text.
4. Check the UI states that each story names: empty, loading, error, success. A missing state
   is a fail.
5. List what the work does that no story asks for. It is not wrong, but the owner decides.
6. Write the review. If a review file for this work exists, update it. Otherwise make one next
   to the work, named `<work>-review.md`, for example `design/login-review.md`. Add a line for a
   new file to `README.md`.
7. Read the review again. Check each item in "Done when".

## Done when

- Each acceptance criterion of each story has a row with a result and evidence.
- Each fail names what is wrong and where, so the maker can fix it without a question.
- Nothing is marked pass without evidence.
- Extra work that no story asks for is listed for the owner.

## Reply

Give the counts: pass, fail, not shown. List each fail in one line. Name the review file. Say
if the work can move on, or what must be fixed first and by which role.
