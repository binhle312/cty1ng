---
name: design-ui-prototype
description: Use when stories are ready and a screen must be designed, or when the owner asks for a mockup or prototype of a page. Make one HTML file per screen, with every state the stories name.
---

# Design a UI prototype

A prototype shows how a screen looks and behaves before anyone builds it. It is one HTML file
that opens in a browser with no build step. It is a proposal: the owner approves it.

## Steps

1. Read the stories file and the Library index (`README.md`). Read the design rules or the
   design system of the project if the project instructions name one. Use its colours, type and
   spacing; do not invent new ones.
2. List the screens. For each screen, list the states that the stories name: empty, loading,
   error, success, and any other.
3. Choose the file for each screen. If a prototype for this screen exists, update it. Otherwise
   make one in the folder that the project instructions set for designs; if they set none, use
   `design/`, for example `design/login.html`. Add a line for each new file to `README.md`.
4. Build the screen in one HTML file: inline CSS, no external scripts, no tracking, sample data
   that looks real but is not about real people. Show each state, with a small switch at the top
   of the page to move between them.
5. Make it usable without a mouse: each control has a label, the tab order follows the page,
   and the focus is visible. Text has enough contrast on its background.
6. Write a short note at the top of the file (an HTML comment) that lists the stories it covers,
   by id (S1, S2…).
7. Open the file again and check each item in "Done when".

## Done when

- Each story in the stories file is covered by a screen, or listed as not covered with a reason.
- Each screen shows every state its stories name.
- The file opens in a browser with no network access.
- Each control can be reached and used with the keyboard.
- No colour, font or spacing value comes from outside the project's design rules, when the
  project has them.

## Reply

Name each file and the stories it covers. List the states shown per screen. Name each story
that is not covered and why. Ask the owner the questions that the design raised.
