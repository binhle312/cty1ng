# Discord role bots

AI teammates in Discord. Each role (BA, Designer) is its own bot account with its own persona,
skills and model. You @mention a bot in a project channel, it opens a thread, interviews you,
writes files into that project's workspace, and asks for your approval before work moves on.

Design doc: https://claude.ai/code/artifact/99ce6bff-361a-4687-b91c-6b671acd5d2d

## How it works

```
#project-a  ──@BA write login stories──▶  gateway (one client per bot)
                                             │ event + job (deduplicated)
                                             ▼
                                           SQLite: sessions, events, jobs, handoffs, history
                                             │ worker claims job (lease)
                                             ▼
                          agent loop (Pydantic AI, any provider) ── tools ──▶ data/workspaces/<channel_id>/  (git repo)
                                             │
                    reply in thread + [Approve] [Request changes] [Reject]
                                             │ Approve (owner only, pinned to commit)
                                             ▼
                                Designer opens its own thread and starts
```

| Module | Responsibility |
| --- | --- |
| `rolebots/workspace.py` | Per-channel folder and git repo. The isolation boundary: every path goes through `resolve()`. |
| `rolebots/db.py` | Durable state. Deduplicated events, one running job per session, leases, history. |
| `rolebots/agent.py` | One agent definition, our own file and skill tools, `propose_handoff`. |
| `rolebots/orchestrator.py` | Approve / request changes / reject rules, starting the next bot. |
| `rolebots/discord_app.py` | Discord clients, message routing, worker loop, buttons. |
| `bots/<role>/` | A role: `bot.yaml`, `persona.md`, `skills/*/SKILL.md`. |

### Isolation rules

- Conversation history is keyed by (bot, channel, thread).
- Each project channel has its own workspace and git repo. File tools cannot leave it
  (`..`, absolute paths, symlinks and `.git` are refused; see `tests/test_workspace.py`).
- Each role can write only to its own folders (`docs/` for BA, `design/` for Designer) plus
  `memory/<role>.md`.

### Choosing a model per bot

Set `model:` in `bots/<role>/bot.yaml` to `<provider>:<model name>`, for example
`anthropic:claude-sonnet-5-5` or `deepseek:deepseek-chat`, and set that provider's API key
in `.env`. History is stored in a provider-neutral format, so a bot can change model between
runs. Changing model in the middle of a long thread works but quality can shift; a new thread
is the safe option.

### Attaching files

Attach files to the message where you mention a bot (or reply in its thread). They are saved to
`inbox/<message_id>/` in that project's workspace, committed, and listed in the bot's prompt.

| Type | Extensions | How the bot uses it |
| --- | --- | --- |
| Text | .md .txt .csv .json .yaml .html .css .js .ts .py .sql .xml .svg | `read_file` |
| Image | .png .jpg .jpeg .webp .gif | Shown to the model in that run; `view_file` to look again |
| PDF | .pdf | Same as images |

Limits: 10 files per message, 10 MB each; other types are skipped with a note. Bots can read
`inbox/` but not write to it. Images and PDFs reach the model only if `multimodal: true` in its
`bot.yaml`; set it to `false` for text-only models such as `deepseek:deepseek-chat`, and the bot
will ask you to describe the file instead. Stored history keeps a placeholder instead of the
bytes, so an image is not resent (and paid for) on every later turn.

## Setup

1. **Create two Discord applications** at https://discord.com/developers/applications, named
   `BA` and `Designer`. For each one:
   - Bot tab: copy the token; turn on **Message Content Intent**.
   - OAuth2 → URL Generator: scope `bot`; permissions Send Messages, Send Messages in Threads,
     Create Public Threads, Read Message History, Add Reactions, Attach Files. Open the URL and
     add the bot to your server.
2. **Configure**
   ```bash
   python -m venv .venv && . .venv/bin/activate
   pip install -e ".[dev]"
   cp .env.example .env   # fill in OWNER_USER_ID, both tokens, and your model provider key
   ```
3. **Run**
   ```bash
   rolebots
   ```
4. In Discord, create a text channel named `project-<something>` and type
   `@BA I need a login page for our admin tool`.

## Tests

```bash
pytest
```

The tests use a scripted fake model, so they need no API key or Discord. They cover workspace
isolation, write scopes, deduplication, per-session ordering, lease expiry, retries, handoff
approval rules, and the agent's tool behaviour. The Discord layer (`discord_app.py`) is not
covered by tests; check it by hand in a test server.

## Known limits (MVP)

- If the process dies after posting a reply but before marking the job done, the retry can post
  that reply again. History and handoffs stay consistent.
- One owner per deployment. Anyone else's messages and clicks are ignored.
- File tools handle text files up to 200 KB. No shell, no web access.
- SQLite, one process. Moving to Postgres means changing `claim_next_job` to
  `SELECT ... FOR UPDATE SKIP LOCKED`.

## Next milestone: group threads

Tag two or more bots in one message and they collaborate in one shared thread:

- A deterministic facilitator runs turn-taking; each bot turn ends with `next: <role> | owner | done`.
- Bots read the shared thread transcript; the first bot tagged is the lead.
- `escalate_to_owner(question, options)` @mentions the owner with buttons and pauses the thread.
- An owner message pauses the bots and goes to the bot mentioned, or the lead.
- After 6 bot turns without the owner, the owner is @mentioned. Scope changes and edits to
  approved files always escalate.
- Write scopes and Approve buttons stay as they are.

## Adding a role

Create `bots/<role>/` with `bot.yaml`, `persona.md` and `skills/`, add its token variable to
`.env`, and list it in another bot's `handoff_to`. No code changes should be needed.
