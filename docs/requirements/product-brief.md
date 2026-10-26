# Product brief

One page on why this product exists and what phase 1 must achieve. The detailed requirements
are the user stories in this folder ([README.md](README.md)).

## What we are building

A chat application where a human works with AI "role bots" (for example a Business Analyst and
a Designer). It is our own chat platform: no Discord, no Slack. Chat platforms are built for
people talking to people; this one is built for a person **and** their bots, so the person can
see what each bot is doing, how it works, and whether it is doing the work well. Phase 1 runs on
one machine for one human; later phases may run on a VPS for several humans.

Each bot has a persona, a model, and a set of skills (written playbooks). In a conversation the
human mentions bots to ask for work; bots reply, write files into the conversation's workspace,
and hand work to each other only through the human's approval.

## Problem

Confirmed by the owner (2026-10-21).

The prototype (`discord-role-bots`) proved that role bots with skills and a shared workspace
are useful, but it lives inside a third-party chat platform. Four problems follow, and phase 1
solves each:

1. **It depends on someone else's application.** The chat platform hosts the UI, the
   conversations and the files, and its rules decide what the app can do. Phase 1 runs entirely
   on the owner's machine: the UI, the data (`data/`) and the workspaces. The only outside
   services are the model providers it calls with the owner's API keys; changing provider is a
   configuration change (D35), not a migration.
2. **The work is invisible.** Chat platforms are designed for humans: a chat log shows
   messages, not who is working, who is waiting, which skill a bot used or how work moved
   between bots. The app adds an interactive view of
   the flow beside the conversation (Flow pane with Timeline and Board maps; D26, D27, D30), plus
   provenance and cost on every reply.
3. **It cannot be shaped to the owner's needs.** The platform fixes the layout, the commands and
   the look. Here the owner defines the bots, personas and versioned skills, sets the
   conversation rules (who replies, discussion budget), and picks the theme, mode and density.
4. **Choosing and assigning bots is scattered.** In the prototype, bots are folders in a repo and
   joining a conversation means platform commands. Here one place manages every bot and skill
   (Bots, Skill hub, Bot detail), and adding a bot to a conversation is a drag from the header.

Anything beyond these four is a later phase and goes through a new brief, not into this list.

## Who it is for

- **Phase 1:** one technical human (the owner) who designs bots and skills and uses them to
  produce documents and designs. There is no login; whoever opens `http://127.0.0.1:<port>` is
  the owner.
- **Later phases (with authentication, M9 and after):** other people use the same app. It ships
  a few default bots and skills to start from, but each user is encouraged to build their own
  bots with the skills that work best for them; the defaults are examples, not the product.

## Use cases and phases

| Bot | What it does for the owner | Phase | Needs first |
| --- | --- | --- | --- |
| **BA** | Sharpens an idea, writes user stories, interviews the owner when something is unclear, writes the documentation into the project's files | 1 | Projects and memory (D37, D38); writing into a real project folder is D23 (later) |
| **Designer** | Designs UI and UX with the owner: demos, mockups, iterations on the owner's feedback or on the BA's handed-off documents | 1 | Handoffs (M6) |
| **Researcher** | Follows a topic the owner sets, summarises what is new every day and reports back | Later | Scheduled bots and web access (new milestone) |
| **Reminder** | Keeps a to-do list and tells the owner what is due today and tomorrow | Later | Scheduled bots; an in-app task list only. Reading external calendars and task apps comes much later |
| **Trip planner** | Finds flights, buses, other transport and hotels and proposes options | Later | Web access and booking rules: search and propose only; never pays without explicit approval; never stores card details |

**Scheduled bots (later phases).** A bot can work on a schedule (daily summary, reminders) and
report in the way the owner instructs. By default it reports in the conversation where it was
given the order. Nothing runs while the laptop sleeps or the app is closed; that is acceptable.

## Goals (phase 1)

1. **Skill hub**: create, edit, clone, deprecate skills. Skills have an author and immutable
   versions.
2. **Bot management**: create, edit, clone, delete bots. Model and effort are fixed at creation.
3. **Bot detail**: assign and remove skills (each pinned to a version), upgrade skill versions,
   toggle "always load", change avatar, edit name and persona.
4. **Header**: every bot as a round avatar with a name tooltip, draggable into a conversation.
5. **Conversation rail**: round icons with title tooltips; "+" at the top creates a conversation.
6. **Conversation**: one or more bots per conversation, `@mention` limited to members, streaming
   replies, skill provenance chips, message editing with branches.
7. **Bot discussion**: optional, bounded by a turn budget the bots are told about.
8. **Parity with the Discord prototype**: a workspace with files (one per project, D37), attachments,
   approval handoffs.
9. **Statistics**: charts of usage by model, bot and skill (D24).
10. **Flow view**: an animated Timeline map beside the conversation (D26, D27); a Team map comes back when bots work together without the owner.
11. **Projects and memory** (D37, D38): conversations grouped into projects; bots
    remember how the owner likes them to work (bot memory) and facts about each project
    (project memory), or about a multi-bot conversation outside a project (conversation memory), visible
    and editable on a Memory page.
12. **Sensitive-data guard** (D39): likely secrets (passwords, API keys, card or
    passport numbers) are caught before they are sent to a model provider or saved to memory.
13. **Cost alerts** (D40): the owner is told at 75% and 90% of the daily cap; at the cap, bots
    stop.

## Success measures (phase 1)

Confirmed by the owner (2026-10-21).

- Journey J1 below works end to end on a fresh machine in under 10 minutes from clone.
- Every bot reply shows which skill versions it used and what it cost, from server records.
- No bot-to-bot exchange exceeds the turn budget; no handoff happens without the owner's approval.
- The owner can answer "where did the money go this week" from the statistics page alone.
- The owner uses the app for real work, instead of the prototype,
  for two consecutive weeks without falling back to the prototype.
- (Problem 1) With the network limited to the configured model providers,
  every journey in this brief still works: no other outside service is needed.
- (Problem 2) During a discussion between three bots, the owner can say
  from the Flow pane alone who is working, who is waiting, and what was handed to whom.
- (Problem 3) The owner changes a bot's behaviour by editing its persona or skills, or creates
  a variant by cloning it (for example with another model or effort, D7), without touching code.
- (Problem 4) Creating a bot, assigning two skills and adding it to a
  conversation takes under two minutes without reading documentation.

## Non-goals (phase 1)

| Not now | Why | When |
| --- | --- | --- |
| Multiple humans, login, permissions | No second user yet; auth is real work and real risk | VPS phase (M9) |
| VPS deployment | Local-first first | M9 |
| Local models (Ollama, llama.cpp) | Hosted APIs only; the model catalog makes it a config change later. An option to consider for privacy, not decided. Rough cost: about 0.6 GB of RAM or VRAM per billion parameters at 4-bit, and about 30B parameters (≈ 18–20 GB) as a realistic minimum for role-bot work | Later, owner decides |
| A coding IDE | Bots create and edit documents and prototypes (Markdown, mockups, plans). They never write or change code and never run tests, builds or commands on the owner's machine; implementation goes to a coding agent (Claude Code, Codex). The one exception: with the provider's Code execution tool on, a bot may run small scripts that analyse data in the provider's sandbox (D55) | Never |
| Scheduled and proactive bots | Needs a scheduler and delivery rules (Researcher, Reminder) | New milestone after phase 1 |
| Web access for bots | Provider web tools with their own security rules (D53; Researcher, Trip planner) | With the scheduled-bots milestone or later |
| Reading external apps (calendars, task managers, mail) | Inside the app only for now | Much later |
| A permanent activity log (who changed what, before and after, for every change) | One owner: conversation lines, memory item fields, run steps and git history cover tracing (D38) | M9, with multiple users |
| Payments and bookings | The trip planner proposes; a human pays. Never automatic, never stores card details | Later, if ever |
| A "lead" bot that routes un-mentioned messages | Hides who decided what; extra cost (D2) | Maybe never |
| Conversation search, archive, folders | Rail works for a few dozen conversations | Later |
| History summarisation | Old messages are trimmed instead (`../conversation-rules.md`). When it comes: show it as a state and a system line, and let the owner start it by hand (`../research/conversation-client-patterns.md` P10) | Later |
| Structured question cards from bots (choices instead of free text) | Handoff cards cover the formal step for now (research P11) | Later |
| Reply to a specific message | Mentions plus D31 cover it; needs a schema and API change (research P4) | After M5 |
| Bots working on another project folder on the machine (following its AGENTS.md and skills) | Needs a secrets deny-list, review branches and approval rules (D23) | Later milestone |
| Executable skills (scripts) | Would need a real sandbox | Later, if ever |
| Custom conversation icon upload | 10 presets cover it for now | Later |
| "Regenerate" a bot reply | Editing human messages covers the main need | Later |
| Files map in the Flow view; pixel-art Flow renderer | Timeline first (Team map parked, D26 amendment); renderer is swappable (D27) | Later |
| Branching the workspace with message branches | Complex; edits warn instead | Later, if needed |

## Trust failures we've seen

A living list: add a row whenever a bot does something that makes the owner trust it less, with
what the app does (or should do) about it. Rows lead to requirements or tests; nothing here is
closed for good.

| Failure | What the app does about it | Status |
| --- | --- | --- |
| A bot overwrites the owner's document | Bots write only in the Library of their run, never in `attachments/`, and only after the owner approves the plan (D48, D52); every change is a git commit in the workspace, so it can be seen and reverted (M6). Writing into a real project folder goes to a review branch (D23) | Covered in M6; D23 later |
| Bots argue in a loop | Discussion is off by default and bounded by a turn budget the bots are told about (D4); runs-per-hour cap; Stop button | Covered in M5 |
| A confident but wrong research summary | Not covered yet. Candidates: sources required in summaries, a "verify" step, the Researcher's skill telling it to mark uncertainty | Open, with the Researcher |

## User journeys

These are the end-to-end flows the app must support. The Playwright end-to-end test follows
journey 1 (see `../testing.md`).

**J1. First use.** Owner opens the app → creates a skill `write-user-stories` → creates bot
"BA" with a model and that skill → clicks "+" to create a conversation → drags BA from the header
into the conversation → chooses "Full history" → types "Write stories for a login page" → BA streams a
reply, shows the chip `write-user-stories v1`, and writes `user-stories/login.md`.

**J2. Team discussion.** Owner adds "Designer" to the same conversation → enables bot
discussion with limit 4 → asks "@BA @Designer agree on the login screens" → the bots exchange up
to 4 turns, each told how many remain → a system message says the limit is reached.

**J3. Handoff.** BA calls `propose_handoff(to=Designer, files=[...])` → an approval card appears
→ owner approves → Designer starts with those files.

**J4. Skill upgrade.** Owner edits `write-user-stories` → v2 is created → the save dialog offers
to upgrade BA (unchecked) → owner leaves it → BA still uses v1 → later, on BA's detail page,
owner sees "v1 → v2 available", reviews the diff, clicks Upgrade.

**J5. Model retired.** A provider retires BA's model → BA shows "model unavailable" → owner
clicks Clone on its banner → the create form opens prefilled → owner picks a new model
and saves → adds the new bot to the conversation.

**J6. Changed mind.** Owner edits an earlier message → a new branch starts there → bots reply
again → owner switches between ‹ 1/2 › and ‹ 2/2 ›.

## Glossary

Use these words, with these meanings, in code, database, API, UI and docs.

| Term | Meaning |
| --- | --- |
| **Owner** | The human using the app. In phase 1 there is exactly one. |
| **Bot** | An AI participant with a name, slug, persona, avatar, model, effort and skills. |
| **Slug** | A bot's or skill's URL- and path-safe identifier (`ba`, `write-user-stories`). Fixed at creation. |
| **Persona** | Markdown describing who the bot is and how it works. Editable. |
| **Skill** | A named, versioned Markdown playbook (`SKILL.md` format) a bot can load. |
| **Skill version** | An immutable release of a skill: v1, v2, … |
| **Pin** | The skill version a bot uses (`bot_skills.skill_version_id`). Changes only by upgrade or downgrade. |
| **Always load** | Per pin flag: the skill body is in the bot's prompt on every run instead of loaded on demand. |
| **Author** | The user who created a skill. Only the author can create new versions or deprecate it. |
| **Deprecated** | A skill hidden from new assignment; pinned bots keep working. Replaces delete. |
| **Skill draft** | A skill or skill version a bot proposed when the owner asked. Nothing changes until the owner approves it; the owner is then its author (D41). |
| **Model catalog** | `config/models.yaml`: the models a bot can be created with. |
| **Effort** | A model's reasoning-effort setting, if the model has one. |
| **Unavailable bot** | A bot whose model is not in the catalog or has no API key. Cannot run. |
| **Conversation** | A thread of messages between one human and zero or more bots. Its files are in the Library of its place (D52). The UI, code, database and API always say "conversation", never "chat" (owner, 2026-10-23). |
| **Member** | A bot in a conversation (`conversation_bots`): `pending_history`, `active` or `removed`. |
| **History choice** | What a newly added bot may read: full history, or from the point it joined. |
| **Message** | One entry in a conversation, by a human, a bot, or the system. |
| **Branch** | A path through the message tree. Editing a human message creates a sibling and a new branch. |
| **Active path** | The branch currently shown and given to bots, ending at `active_leaf_message_id`. |
| **Run** | One execution of a bot answering one trigger message. Produces one bot message. |
| **Bot turn** | A run triggered by another bot's message (not by the human). |
| **Turn budget** | The maximum bot turns between two human messages in a conversation. |
| **Event** | A persisted, sequence-numbered record of something visible changing. The UI is built from events. |
| **Workspace** | The folder and git repo where bots read and write files: one per project, shared by its conversations, and one Home Library for all conversations outside projects (D52 amendment 2026-10-25). |
| **Handoff** | A bot's request that the owner approve files and pass them to another bot or to the owner. |
| **Team directory** | The list of other bots (name, slug, one-line description) in every prompt, so a bot knows whom to mention or hand off to. |
| **Estimated cost** | Tokens × catalog prices at the time of the run. An estimate, not an invoice. |
| **Daily cap** | Owner-level limit on today's estimated spend; alerts at 75% and 90%, and new runs are refused once reached (D40). |
| **Project** | A named group of conversations with a shared project memory (and, later, an attached folder, D23). A conversation may sit outside any project (D37). |
| **Bot memory** | What a bot has learned about how the owner likes it to work, from 1:1 conversations outside projects. Used by that bot everywhere (D38). |
| **Library** | The project's workspace files as the UI names them: a row in the left bar that opens the files page (`../design/components/left-bar.md`). |
| **Project memory** | Facts about the work, learned in a project's conversations and shared by every bot in that project, never outside it (D38). |
| **Conversation memory** | Facts learned in a multi-bot conversation outside any project, shared by the bots in that conversation only; offered for merging into a project when the conversation moves into one (D38). |
| **Memory item** | One remembered statement. Earlier versions are kept when memory history is on: off by default for a bot, on for a project or conversation, 5 versions when on (D38). |
| **Provenance** | The skills (and versions) a run loaded, shown as chips on the bot message. |
