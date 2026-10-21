# Porting guide: from the Discord prototype

The prototype (`discord-role-bots`, Python) proved the core: an agent loop, a sandboxed
per-project workspace with git, durable jobs with leases, and approval handoffs. The new app is
TypeScript (D34), so nothing is copied as code: each module is **translated**, keeping its
behaviour and its tests' cases. This guide says what to bring over, what to change, and what to
drop.

## 1. Where the prototype lives during the port

Copy the prototype into this repository as `reference/discord-role-bots/` in task M0, with a
`reference/README.md` saying:

> Read-only reference, in Python. Do not import from it or copy files into the app. Translate
> behaviour into `backend/src/` following `docs/porting-guide.md`. This folder is deleted at the
> end of M6.

Why in the repo: agents can read it in the same session without extra setup, and the deletion
at M6 is a visible checkpoint that the port is complete.

## 2. Module map

Actions: **Translate** = same design and behaviour in TypeScript; **Translate and adapt** = same
behaviour with the changes in the notes; **Rewrite** = new design, keep the listed ideas.

| Prototype | New home | Action | Notes |
| --- | --- | --- | --- |
| `rolebots/workspace.py` | `adapters/workspace/local-git/` (implements the workspace port) | **Translate** | Rename `for_channel` → `forConversation`. Keep `resolve`, `checkWritable`, `commit`, `changedSince`, the per-repo lock. Git runs as a child process (`execFile` with an argument array), never through a shell string. Security-sensitive: owner reviews (M6). |
| `tests/test_workspace.py` | `backend/test/contracts/workspace.contract.ts` + `backend/test/security/` | **Translate the cases** | Every case must pass, apart from renames. |
| `rolebots/agent.py` | `core/runs/` (`prompt.rules.ts`, `tools.service.ts`, `run.service.ts`) + `adapters/model/ai-sdk/` | **Translate and adapt** | Split instructions into the prompt builder (`conversation-rules.md` §4). Tools `list_files`, `read_file`, `write_file`, `view_file` keep their names and behaviour, defined with Zod input schemas. `load_skill` reads the **pinned version** and records `run_skills`. `propose_handoff` targets bots by name/slug (D18). Streaming through the AI SDK's `streamText`; Stop through an `AbortSignal`. |
| `rolebots/agent.py::decode_history`, `strip_binary` (in `attachments.py`) | `core/runs/history.rules.ts` | **Translate** | Provider-neutral history (AI SDK message format); binaries replaced by placeholders. |
| `rolebots/attachments.py` | `core/attachments/` | **Translate and adapt** | Input is an HTTP multipart upload. Keep `kindOf`, `safeName`, limits, and the multimodal prompt parts. |
| `rolebots/db.py` (raw aiosqlite) | `adapters/db/` (Drizzle) + `adapters/queue/in-process/` + `core/runs/` | **Rewrite, keep the logic** | Keep the ideas: deduplicated events, one running job per session (now per conversation), lease + attempts, history appended once per successful run. Schema: `domain-model.md`. |
| `rolebots/orchestrator.py` | `core/handoffs/` | **Translate and adapt** | Same rules (owner only, pending only, stale if files changed). Ids are conversation/bot ids; "start next" queues a run with `triggered_by = handoff`. |
| `tests/test_orchestrator.py`, `test_db.py`, `test_agent.py`, `test_attachments.py` | next to the new code, as `*.test.ts` | **Translate the cases** | Rewrite fixtures for the new schema; keep every behaviour they assert. |
| `rolebots/botdef.py` (YAML bot folders) | `core/skills/skill-md.rules.ts` (`SKILL.md` parsing for import/export) | **Partly** | The frontmatter split and the `SKILL.md` format survive for import/export. Bot definitions move to the database. |
| `bots/ba/`, `bots/designer/` | `seed/` | **Convert to seed data** | A `make seed` command imports their skills (via import-from-folder) and creates the two bots, for demos and e2e tests. These are Markdown and YAML, so they are copied, not translated. |
| `rolebots/service.py` | `core/messages/`, `core/runs/` | **Rewrite** | Routing moves to `decideRuns` (`*.rules.ts`); the worker loop and failure posting keep their shape. |
| `rolebots/chat.py` (adapter protocol) | — | **Drop** | The web app is the only surface. If another chat platform comes back later, it would be an adapter that calls the same services as the HTTP API (D35). |
| `rolebots/adapters/discord_adapter.py` | — | **Drop** | |
| `rolebots/config.py` | `app/config.ts` | **Rewrite** | Env parsed by a Zod schema; variables in `architecture.md` §8. |
| `rolebots/main.py` | `app/main.ts` | **Rewrite** | Composition root: builds adapters, starts the Hono server and the worker loop. |

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
