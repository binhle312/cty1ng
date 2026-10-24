# D55. Provider tools first, one switch per tool, and one tool per job

Status: proposed (2026-10-24). From the M2 Bots UI design review, round 9 (Create step 4,
CS4b and CS4c, approved by the owner on 2026-10-24). The design is agreed; the rules below, and
the two conflicts at the end, wait for the owner's approval. It extends D53 and touches the
product brief non-goal "A coding IDE".

Decision:

- **Provider tools first (owner, 2026-10-24).** During development, when the model provider
  already has a tool for a job, the app uses the provider's tool and does not build its own yet.
  The app builds an internal tool only when no provider has one, or when the provider tool fails
  a need (for example D53 rule 1 for web fetch).
- **One switch per tool, per bot.** Each bot stores a switch for every tool its model can use
  (`bots.tool_settings`). Internal tools (Files, View images, Skills, Hand off, Memory) are on by
  default. Provider tools are off by default. The owner sets them on the Create page and on the
  bot page. A switch is a bot setting, not a run setting, so it applies to the next run.
- **Tool catalog.** `config/tools.yaml` lists every tool with its kind (internal or provider), its
  provider, its **job** name, the date it was added, and flags (`sends_data_out`, `web`). Each
  model in `config/models.yaml` lists its `provider_tools`. The UI builds the Tools list from
  these two files (`../domain-model.md` §4, §4.1).
- **One tool per job (owner, 2026-10-24, option 2).** When an internal tool and a provider tool do
  the same job, the catalog gives both the same job name. The bot has one choice for the job:
  Off, Internal or the provider. Only one is on, so a run never gets two tools for one job. The
  API rejects a body with both on (422 `tool_job_conflict`).
- **Dependencies.** A tool can need another tool (View images and Hand off need Files). Turning
  Files off turns them off too.

Conflicts that need the owner (recommendation first):

1. **Code execution** (for example Anthropic code execution) runs code in the provider's sandbox,
   not on the owner's machine. The product brief says bots "never run tests, builds or commands".
   **Recommended:** allow it as a provider tool, off by default, with the amber ⚠ (files and text
   it works on go to the provider's sandbox), and change the non-goal to "bots never run code on
   the owner's machine". The milestone that builds it checks the provider's sandbox rules (network
   access, file retention) and records them. *Alternative:* do not offer it; the row is not shown.
2. **MCP connector** calls outside services, so it is a channel that can send conversation data
   out of the app. D53 depends on "no channel to send data out" for runs that read the web.
   **Recommended:** list it, but keep the switch locked ("Needs a decision") until a later decision
   defines MCP servers in Settings and its rules. That decision must say what happens in a run that
   read the web (for example: no MCP calls after a web result). *Alternative:* allow it now, off by
   default, never in the same bot as a web tool.

Why: Provider tools give us web search, fetch, code and more with no code of ours to build or
secure (D53 removed the parser from our machine for the same reason). Per-tool switches let the
owner give each bot only what it needs, which also limits what an injected instruction can do.
One tool per job keeps runs predictable and stops a bot from calling two tools for one task.

Rejected:

- **Internal tools only, provider tools hidden.** We would build and secure tools that providers
  already run well.
- **All tools always on.** Every bot would get tools that can send data out or cost money.
- **Both tools of a pair on, and the model chooses (option 1), or compare them by ratings.** Two
  tools for one job make runs hard to compare and to debug. A comparison by ratings may come later
  as its own decision.

Consequences: `domain-model.md` §2 adds `bots.tool_settings`; §4 adds `provider_tools` per model
and §4.1 the tool catalog. `api.md` adds `GET /tools` and `tool_settings` in bot bodies. A
migration is needed (owner approval, AGENTS.md §7). In M2 the provider tool rows show "later
milestone" and stay off; the milestone that builds them (with D53) makes the switches work.
`conversation-rules.md` §4: the run gets only the tools that are on.

Implemented in: `../design/components/create-bot-page.md` §3, `../requirements/bots.md` UI-5.5,
`../domain-model.md` §2, §4.1, `../api.md` §3, §4.
