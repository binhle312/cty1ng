# Porting guide: from the Discord prototype

The prototype (`discord-role-bots`) proved the core: an agent loop on Pydantic AI, a sandboxed
per-project workspace with git, durable jobs with leases, and approval handoffs. This guide
says what to bring over, what to change, and what to drop.

## 1. Where the prototype lives during the port

Copy the prototype into this repository as `reference/discord-role-bots/` in task M0, with a
`reference/README.md` saying:

> Read-only reference. Do not import from this folder. Port code into `backend/app/` following
> `docs/porting-guide.md`. This folder is deleted at the end of M6.

Why in the repo: agents can read it in the same session without extra setup, and the deletion
at M6 is a visible checkpoint that the port is complete.

## 2. Module map

| Prototype | New home | Action | Notes |
| --- | --- | --- | --- |
| `rolebots/workspace.py` | `app/workspace/workspace.py` | **Port as is** | Rename `for_channel` → `for_conversation`. Keep `resolve`, `check_writable`, `commit`, `changed_since`, the per-repo lock. Security-sensitive: owner reviews (M6). |
| `tests/test_workspace.py` | `tests/security/test_workspace.py` | **Port as is** | Must pass unchanged apart from renames. |
| `rolebots/agent.py` | `app/agent/` (`prompt.py`, `tools.py`, `runner.py`) | **Port and adapt** | Split instructions into the prompt builder (`conversation-rules.md` §4). Tools `list_files`, `read_file`, `write_file`, `view_file` unchanged. `load_skill` reads the **pinned version** and records `run_skills`. `propose_handoff` targets bots by name/slug (D18). Add streaming (`agent.run_stream` / `iter`) and the cancel check. |
| `rolebots/agent.py::decode_history`, `strip_binary` (in `attachments.py`) | `app/agent/history.py` | **Port as is** | Provider-neutral history; binaries replaced by placeholders. |
| `rolebots/attachments.py` | `app/services/attachments.py` | **Port and adapt** | Input is an HTTP upload instead of a Discord attachment. Keep `kind_of`, `safe_name`, limits, `build_prompt` for multimodal. |
| `rolebots/db.py` (raw aiosqlite) | `app/db/` (SQLAlchemy) + `app/worker/` | **Rewrite, keep the logic** | Keep the ideas: deduplicated events, one running job per session (now per conversation), lease + attempts, history appended once per successful run. Schema: `domain-model.md`. |
| `rolebots/orchestrator.py` | `app/services/handoffs.py` | **Port and adapt** | Same rules (owner only, pending only, stale if files changed). Ids are conversation/bot ids; "start next" queues a run with `triggered_by = handoff`. |
| `tests/test_orchestrator.py`, `test_db.py`, `test_agent.py`, `test_attachments.py` | matching folders | **Port the cases** | Rewrite fixtures for the new schema; keep every behaviour they assert. |
| `rolebots/botdef.py` (YAML bot folders) | `app/services/skills.py` (`SKILL.md` parsing for import/export) | **Partly** | `_split_frontmatter` and the `SKILL.md` format survive for import/export. Bot definitions move to the database. |
| `bots/ba/`, `bots/designer/` | `seed/` | **Convert to seed data** | A `make seed` command imports their skills (via import-from-folder) and creates the two bots, for demos and e2e tests. |
| `rolebots/service.py` | `app/services/messages.py`, `app/worker/` | **Rewrite** | Routing moves to `domain/` (`decide_runs`); the worker loop and failure posting keep their shape. |
| `rolebots/chat.py` (adapter protocol) | — | **Drop** | The web app is the only surface. If another chat platform comes back later, it would be an adapter that calls the same services as the HTTP API. |
| `rolebots/adapters/discord_adapter.py` | — | **Drop** | |
| `rolebots/config.py` | `app/settings.py` | **Rewrite** | pydantic-settings; variables in `architecture.md` §6. |
| `rolebots/main.py` | `app/main.py` | **Rewrite** | FastAPI app factory; starts the worker task on startup. |

## 3. Behaviour that must survive the port

These are lessons the prototype paid for; each needs a test in the new code.

1. A run's history is appended exactly once, only on success (no duplicate turns on retry).
2. A crashed run is retried after its lease expires; after `max_attempts` it fails visibly.
3. Images and PDFs are not resent to the model on every later turn (placeholders in history,
   `view_file` brings them back).
4. Handoff approval is pinned to a commit; changed files make it stale.
5. A daily handoff limit stops runaway loops and tells the owner.
6. Replies longer than `max_reply_chars` are truncated with a pointer to the files.
7. Bots never start another bot's work themselves; only an approval (or, now, the budgeted
   discussion) does.

## 4. Things the prototype did that we now do differently

| Prototype | Now | Why |
| --- | --- | --- |
| Bot = folder in git (`bot.yaml`, `persona.md`, `skills/`) | Bot and skills in the database, skills importable from folders | UI is the editor (D5) |
| Skills per bot, always latest | Shared skills, versioned, pinned per bot | D6 |
| Bots never talk to each other | Optional discussion with a server-enforced budget | D4 |
| History per (bot, channel, thread) | Shared transcript per conversation + per-bot tool history | All bots see one conversation; each keeps its own tool memory |
| One Discord thread per bot task | One conversation with many bots | The app's own UI |
| Owner identified by Discord user id | Single local owner (`"owner"`) | D1 |
