# New project page

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.2, layout A. Preview:
> `../previews/command-dark/new-project.png` (and `.html`). Follows D45. The labels and error
> messages use Simplified Technical English.

The rail's "+" opens a full page in the main area. Bar 2 is hidden while the page is open.

## 1. Header

One of seven greetings, picked at random **once per page open** (not on every render). The tab
title and the page's accessible name stay **"New project"**.

| # | Title | Subtitle |
| --- | --- | --- |
| 1 | A new home for big ideas 🏡 | Its chats share one memory and one Library. |
| 2 | Let's build something 🛠️ | Give your team a goal and some ground rules. |
| 3 | New mission, who dis? 🚀 | Name it, aim it, and the bots will follow. |
| 4 | Gather the team 🧩 | One goal, one memory, one Library for every chat inside. |
| 5 | Plant a project 🌱 | Start small. It grows as your bots work. |
| 6 | Clean slate ✨ | What are we making this time? |
| 7 | Where should we start? 🗺️ | Set the goal, and your bots will help find the way. |

## 2. Layout (A: two columns)

- **Left:** the form, at most 620 px wide: header, Name, Goal, Instructions, Colour, then the
  buttons. The page starts with the focus in Name.
- **Right:** a 260 px preview column, "Preview of bar 2". It stays in place while the owner
  types. It shows bar 2 as it looks after Create, with the approved parts (`left-bar.md` §2): the
  header (tile, name, "1 chat · 0 bots · 0 files", goal), the Board row ("Later", no counts),
  Memory 0, Library 0, and Chats with + and the empty first chat. Under it: the rail tile, and the
  line "Bar 2 does not show the instructions. Every bot in this project reads them."
- **Buttons**, aligned right under a divider: **Cancel**, **Create project** (`primary`). The app
  turns off Create project until Name has text and no field has an error.

## 3. Fields

| Field | Limit | Label hint | Placeholder |
| --- | --- | --- | --- |
| Name | unique among projects | none | Project name |
| Goal | ≤ 500 chars, live counter | Bar 2 shows it. Every bot reads it. | What is the goal of this project? Example: Plan the pricing page for the March launch. |
| Instructions | ≤ 3000 chars, live counter; optional | Optional · Markdown, as in an AGENTS.md file | `# Rules for every bot in this project` / `- How must bots write?` / `- Where do bots put files?` / `- What must bots ask you before they act?` |
| Colour | the project colour set | none | The first colour is selected |

- The goal is `projects.description`. The instructions are `projects.instructions_md`. Only the
  owner edits them. Bots cannot edit them (D45).
- Instructions is a monospace box with **Write** and **Preview** tabs. Preview renders the
  Markdown with raw HTML off (`../../security.md`).
- Empty page: placeholders in `on-surface-muted`; the preview shows a grey "New project" tile and
  "Your goal shows here."

## 4. Errors

An error shows under its field, in `danger`, when the owner leaves the field and again on Create.
The field border turns `danger`. Each message says what is wrong, then what to do.

| Case | When | Message |
| --- | --- | --- |
| Name is empty | on Create | Type a name for the project. |
| Name exists | on leave and on Create | A project with the name "{name}" exists. Type a different name. |
| Goal is too long | live; the counter turns `danger` | The goal has {n} characters. The limit is 500. Make the goal shorter. |
| Instructions are too long | live; the counter turns `danger` | The instructions have {n} characters. The limit is 3000. Make them shorter. |
| Sensitive data (D39) in Goal or Instructions | on Create | Line {n} looks like an API key. The app does not save secrets. Remove the key, and put it in an environment variable. |

- The sensitive-data message names the kind of data and the line. It never shows the secret.
- If the save fails for another reason, the page keeps all text and shows a toast: "The app could
  not create the project. Try again." The page never shows internal error text.

## 5. Leave with unsaved text

Cancel, Esc, or a click on the rail or Home asks first, but only if a field has text. On an empty
page, Cancel goes back at once. The dialog has a joyful tone (owner, 2026-10-22):

- Title: **Leave before you create it? 👀**
- Text: "The app has not saved your name, goal and instructions yet. Stay and finish, or let them
  go."
- Buttons: **Stay and finish** (`primary`, default, Enter) and **Let it go** (`danger` text).

## 6. After Create

The project opens with an empty first chat. The owner adds bots in the chat, not on this page.

## Requirement changes (requirements PR)

- New column `projects.instructions_md TEXT NOT NULL DEFAULT ''`, ≤ 3000 chars. **Migration,
  needs approval.**
- Prompt order and budget for goal and instructions (D45).
- `POST /projects` and `PATCH /projects/{id}` take `description` (goal) and `instructions_md`.
