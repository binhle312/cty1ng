# New project page

> **Status: fields, limits and copy agreed in the M0 UI design review (2026-10-22); the layout is
> still to confirm.** Preview: `../previews/command-dark/left-bar.png` (the New project card).
> Follows D45.

The rail's "+" opens a full page in the main area. Bar 2 is hidden while it is open.

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

## 2. Fields

| Field | Limit | Notes |
| --- | --- | --- |
| Name | as today (unique among projects) | Required |
| Goal | ≤ 500 chars, live counter | Stored in `projects.description`. Shown in bar 2's header; every bot reads it |
| Instructions | ≤ 3000 chars, live counter | Monospace Markdown box, like an `AGENTS.md`. Written by the owner; bots cannot edit it; every run reads it |
| Colour | the project colour set | Used for the rail tile |

Beside the form: a live preview of the bar 2 header (with the goal) and of the rail tile.

Buttons aligned right: **Cancel**, **Create project** (`primary`).

## 3. After Create

The project opens with an empty first chat. Bots are added in the chat, not on this page.

## Requirement changes (requirements PR)

- New column `projects.instructions_md TEXT NOT NULL DEFAULT ''`, ≤ 3000 chars. **Migration,
  needs approval.**
- Prompt order and budget for goal and instructions (D45).
- `POST /projects` and `PATCH /projects/{id}` take `description` (goal) and `instructions_md`.
