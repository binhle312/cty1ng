# D38. Bot memory and project memory

Status: proposed (2026-10-21), from the owner's product-brief interview. It replaces the
per-conversation `memory/<bot-slug>.md` file. D19 still decides slugs; only that file path is
dropped.
Decision: Bots remember things across conversations in two scopes. The scope is set by where
the conversation is, not chosen by the bot.

| | Bot memory | Project memory |
| --- | --- | --- |
| Learned in | 1:1 conversations with that bot, outside any project | Conversations inside a project (any number of bots) |
| About | How the owner likes this bot to work ("stories in Gherkin", "ask before assuming a platform") | Facts about the work ("target users are clinic staff", "login uses magic links") |
| Read by | That bot, everywhere, including inside projects | Every bot in that project's conversations; never outside the project |
| Written by | That bot | Any bot in the project |

- **Writing.** Bots save memories directly through tools (`remember`, `update_memory`,
  `forget`); there is no approval queue. Each save shows in the chat as a system line
  "Remembered: …" with Undo, so nothing is saved silently. The owner can edit or delete any item
  on the Memory page.
- **Version history is a setting.**
  - **Per bot:** "Keep memory history" is off when a bot is created. When the owner turns it on,
    each of that bot's memory items keeps its last **5** versions by default, adjustable from 1
    to 20.
  - **Off:** only the current text is kept, except that Undo on the "Remembered" line can always
    revert the latest change.
  - **Lowering the number** deletes the oldest versions beyond it, after a confirmation.
  - **Multi-user:** it is a per-user, per-bot setting. In phase 1 there is one user, so it
    lives on the bot. With users (M9), each user's bots carry their own value.
  - **Project memory:** the same setting exists per project, also off when the project is
    created and 5 when turned on. Owner to confirm.
  - **Using history:** the owner restores a version from the Memory page. A bot can review,
    restore or roll back its memories when the owner asks it to (`restore_memory`).
- **In the prompt.** Bot memory comes after the persona, then project memory, before skills
  (`conversation-rules.md` §4). Memory has its own limits instead of sharing the history budget:
  at most 500 characters per item and 100 items per scope. A bot that hits the limit must update
  or forget an item before saving another.
- **Safety.** Memory text passes the sensitive-data guard (D39) with no override: secrets are
  never saved to memory. Memory is data, not instructions from the owner. A project's memory is
  never shown to a bot outside that project.
- **Outside both scopes.** In a conversation with several bots that is not in a project, bots
  read their bot memory but cannot save. Owner to confirm.

Why: The owner wants a bot to keep their preferences across chats, and project facts to be
shared by the team on that project without leaking elsewhere. Saving directly, with a visible
line and Undo, keeps the flow fast while meeting the rule that AI-written knowledge never
becomes permanent silently.
Rejected:
- **Approve every memory before it is saved:** too slow in practice. Visible saves with Undo
  and a full Memory page give the same control.
- **A librarian bot as the only writer of project memory** (considered and deferred,
  2026-10-21): a single gatekeeper adds a hop to every save, becomes a bottleneck and a single
  point of error, and the owner already sees every save. If duplicates or contradictions show up
  in the trust-failures log (`../requirements/product-brief.md`), add a periodic **curator** that
  merges duplicates and flags contradictions for the owner, rather than a single-writer
  gatekeeper.
- **Per-conversation memory file** (the old design): it did not follow the bot or the project.
- **One global memory for all bots:** a Designer's preferences would leak into the BA.
- **Versions of the whole memory as one snapshot:** restoring one wrong item would also undo
  good ones. Versions are kept per item.
- **A fixed number of versions for everyone:** the owner wants it to be a setting (off by
  default, 5 when on).
Consequences: New tables `projects`, `memory_items`, `memory_item_versions`, and new columns
`bots.memory_history_versions` and `projects.memory_history_versions` (NULL = off)
(`domain-model.md` §14). New events `memory.saved`, `memory.updated`, `memory.deleted`. The
workspace no longer has a `memory/` folder (`domain-model.md` §11, `security.md` §2.3,
`conversation-rules.md` §4).
Implemented in: `../requirements/projects-and-memory.md`, `../domain-model.md` §14 (proposed),
`../conversation-rules.md` §4.
