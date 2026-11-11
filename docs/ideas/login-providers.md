# Idea: bots that run on a CLI login, not an API key

Status: idea, saved by the owner on 2026-11-11. Not a decision. Not in scope for M0–M3.

The owner wants this feature strongly (2026-11-11: "I deeply want to have this feature"). The
owner set the start on the same day: build it after M3 is finished. The slice has a row in
[../development-plan.md](../development-plan.md). The steps in §8 still apply before code starts.

## 1. Summary

Today a bot calls a model provider with an API key from an environment variable. The idea: a bot
can also run on a tool that the owner already pays for with a subscription. The tool is on the
owner's machine, and the owner is logged in to it. The app sends each model request to the tool,
and the tool uses its own login. The app needs no API key for that bot.

Candidates: GitHub Copilot, Claude Code, Codex. A "login provider" in this note is a model
provider of this type.

This idea is different from [desktop-app-and-cli-agents.md](desktop-app-and-cli-agents.md). That
idea sends code work to a coding agent, and the agent is separate from the role bots. This idea
keeps the role bots as they are and changes only where their model requests go.

## 2. What each tool gives

Checked on 2026-11-11. Tools and rules in this area change fast: check each row again when the
slice starts.

| Tool | How a program calls it | Use of the login | Is this use permitted? |
| --- | --- | --- | --- |
| GitHub Copilot | The Copilot SDK (official, generally available since June 2026). It starts the Copilot CLI. | The SDK uses the Copilot login on the machine. Each prompt counts against the Copilot allowance. | Yes. GitHub made the SDK for apps that use a Copilot subscription. |
| Claude Code | `claude -p`, or the Claude Agent SDK (TypeScript). | If no API key is set, the tool uses the `/login` credentials or a token from `claude setup-token`. Usage counts against the plan limits. | Not clear. The docs tell developers of products to use API keys. They forbid a product that sends requests through plan credentials "on behalf of their users". They state no rule for a personal tool with one user. |
| Codex | `codex exec`, or the Codex SDK. | `codex exec` uses the saved ChatGPT login. Usage counts against the plan, then against credits. | Not verified. The OpenAI rule was not found. |

Community packages put these tools behind the Vercel AI SDK (`ai-sdk-provider-claude-code`, and
equivalent packages for Codex CLI and Gemini CLI). They are not official. Each package is a new
dependency and needs the owner's approval (`AGENTS.md` §7).

Sources:

- Claude Code: `code.claude.com/docs/en/authentication.md`, `.../legal-and-compliance.md`,
  `.../agent-sdk/overview.md`, `.../agent-sdk/typescript.md`, `.../agent-sdk/cost-tracking.md`, and
  the support article "Use the Claude Agent SDK with your Claude plan".
- Codex: `developers.openai.com/codex/auth` and the help article "Using Codex with your ChatGPT
  plan".
- Copilot: the GitHub changelog of 2026-06-02, the `github/copilot-sdk` repository, and the docs
  page "Usage and billing metrics - Copilot SDK".

## 3. How the idea fits the current spec

| Spec item | Fit | Note |
| --- | --- | --- |
| D35 ports and adapters | Good | A login provider is one more adapter behind the model port (`backend/src/core/ports/model.ts`). `core/` does not change. The adapter must pass the contract suite of the port. |
| D7 model and effort fixed at bot creation | Good | A login provider has its own model ids in the catalog. A bot does not move from an API key provider to a login provider: the owner makes a new bot or a clone. |
| D39 sensitive-data guard | Good | The guard runs before the request reaches the model port, so it stays in front of a login provider too. |
| Fake model in tests (`AGENTS.md` §8) | Good | Tests never start the real tool. The contract suite needs a fake for the tool process. |
| `AGENTS.md` §5 rule 7 and `security.md` §2.3 (bot tools) | **Tension** | Each tool is an agent: it has its own system prompt, its own file tools, its own shell tool and its own loop. A role bot must use only the tools of this app, through the workspace port. The adapter must turn off every built-in tool and give the tool no file access. On 2026-11-11 the Claude Agent SDK docs showed how to replace the system prompt and how to supply our tools. They did not show a way to turn off all built-in tools or to run with no file access. |
| Product brief non-goal "A coding IDE" (Never) | **Tension** | Bots never run commands on the owner's machine. That stays true only if the shell tool of the CLI is off, and a test proves it. |
| `security.md` §1 threat model | **Tension** | Today the app starts no other program. A login provider starts a CLI process on the owner's machine for each request. That is a new threat class. It needs a new section and an owner review. |
| D21 token and cost tracking, D20 and D42 daily caps | **Tension** | A login has no price for each token. The Claude Agent SDK gives token counts and a cost that is "an estimate, not a billing statement". The owner must decide what a cap means for a login provider. |
| D32 history budget | Check | The budget comes from the context window of the model. The tool can also shorten the history in its own loop. Only one of the two must do this work. |
| D53 and D55 provider tools | Check | Web search and the other provider tools work differently inside each tool, or not at all. Each login provider needs its own `provider_tools` list in the catalog. |
| D63 model requests that are not runs | Check | Tidy memory and the memory check are small requests. A CLI process for each small request can be slow. Measure it. |
| `AGENTS.md` §5 rule 6 and `security.md` §2.6 (secrets) | Check | The app must not read, copy, store or log the credentials of the CLI. The app only starts the tool. |
| Effort mapping (`adapters/model/ai-sdk/effort.ts`) | Check | Each tool has its own effort option. Each login provider needs its own mapping and test. |

## 4. Other limits to know

- **Shared limits.** The bots use the same plan limits that the owner uses for the tool in daily
  work. A long bot session can block the owner's own Claude Code or Codex session, and the other
  way round.
- **Rate limit errors.** A plan limit ends with "try again at a time", not with a cost. The app
  needs a clear state for a bot that waits for the limit to reset.
- **One user only.** The Claude rule forbids a product that uses plan credentials for its users.
  If the app gets a second user or moves to a VPS, a Claude login provider is not permitted
  without Anthropic's approval.
- **Speed.** A CLI process for each request starts more slowly than an HTTP request.

## 5. A simpler path to check first

The Anthropic support article has a note dated 2026-10-07: Max, Ultra and Team plans get monthly
API credits, used with an API key from a linked Claude Console organization. The note names the
Agent SDK and `claude -p`. It is not verified that these credits also pay for direct API requests
from this app. If they do, the plan pays for the bots through the API key path, and nothing in
the design changes. OpenAI has a page "API credits for ChatGPT subscribers"; its conditions are
not checked.

## 6. Proposed order

The owner decided step 1 (2026-11-11). Steps 2 to 5 are a proposal for the slice plan.

1. Finish M3: the first model adapter and one bot that chats.
2. Check the simpler path in §5.
3. Do a spike with Copilot, because its rule is clear: one request through the SDK, with every
   built-in tool off and only one tool of this app supplied. The spike answers the two "Tension"
   rows about tools.
4. If the spike passes, write the decision and the slice brief.
5. Claude Code and Codex come after that, each when its rule for a personal tool is clear.

## 7. Open questions for the owner

- Which tool comes first: Copilot (rule is clear), or Claude Code (the owner's plan)?
- Does a login provider count toward the daily caps (D20, D42)? If yes, in tokens or in an
  estimated cost?
- Is a personal tool with one user enough for the Claude rule, or does the owner ask Anthropic
  first?
- Does the slice come before M4, or between two later slices? The owner decided only "after M3".

## 8. What must happen before work starts

1. M3 is done.
2. A spike proves that the tool can run with no built-in tools and no file access.
3. A new decision (next free number at that time) for login providers: the adapter, the catalog
   entries, the cap rule.
4. `security.md`: a new section for a provider that starts a CLI process, with owner review.
5. The owner approves each new dependency.
6. A slice brief in `tasks/` and a row in `development-plan.md`.
