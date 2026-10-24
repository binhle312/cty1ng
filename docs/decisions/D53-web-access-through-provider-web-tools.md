# D53. Bots read the web only through the provider's web tools, with rules for runs that read it

Status: accepted (2026-10-23, owner). The owner asked for a sandbox per project, then said the
goal is safety from malformed data and prompt injection when a bot reads the web. The owner
chose provider web tools and the rules below instead of a sandbox for now. The default values
are checked in the plan of the milestone that builds this. It amends D38 (memory saves) for runs
that read the web.
Amends: D38

Decision:

- **Provider web tools only.** A bot reads the web only through the web tools that the model
  provider runs on its own servers (for example Anthropic web search and web fetch, OpenAI web
  search, Gemini Google Search grounding), through the model provider port (D35). The provider
  fetches and parses each page; the app gets text and source URLs only. The app never downloads
  or parses a web page itself.
  Raw content that a provider returns (for example a fetched PDF as base64, or encrypted search
  content) is an opaque block: the app passes it back to the provider as the API requires, and
  never decodes, parses, renders or saves it as a file. The app keeps the reply text and the
  citation links.
- **Off by default, per bot.** Web access is a bot setting, off by default. The owner turns it
  on for bots that need it (Researcher, Trip planner). The model catalog (`config/models.yaml`)
  marks which models have a web tool; a bot whose model has none cannot turn web access on. The
  app adds the web tool to a request only for a bot with web access on. An API key alone gives
  no web access.
- **A run that read the web** is a run in which a web tool returned a result. The app records
  this on the run and lists the source URLs as run steps. These rules apply to it:

  | Rule | What it stops |
  | --- | --- |
  | 1. Fetch only URLs that came from a search result or from the owner's messages, never a URL that the model writes. Where a provider cannot enforce this, that provider gets web search only | Data theft through a URL that the model builds (`evil.com/?data=<notes>`) |
  | 2. Memory saves only as items in the approved plan (D48) or as a **Remember** button that the owner clicks. No save on the bot's own initiative with "Remembered" + Undo (D38) | An injected instruction that stays in every later run |
  | 3. Writes stay behind their approvals: the plan card (D48), the run branch (D52), skill drafts (D41), handoff cards | Changes the owner did not see |
  | 4. Web text goes into the prompt inside clear fences with its URL, marked as untrusted data | Some injections. This helps, but is not a guarantee |
  | 5. Source links render with the rules in `security.md` §2.2: no external images, safe link schemes only | Data theft through an image URL |

- **Settings with defaults** (`settings` table, AGENTS.md §10):

  | Setting | Default | Use |
  | --- | --- | --- |
  | `web_searches_per_run` | 5 | Upper limit of web searches in one run |
  | `web_fetches_per_run` | 5 | Upper limit of page fetches in one run |
  | `web_fetch_max_tokens` | 10,000 | Upper limit of text from one page |
  | `web_allowed_domains` | empty (all) | If not empty, only these domains |
  | `web_blocked_domains` | empty | Domains that are never searched or fetched |

- **Cost.** Search and fetch fees count in token and cost tracking (D21) and in the daily caps
  (D20, D42). The price source has a search price per provider.

Why: A sandbox stops malformed data (a crafted page or PDF that attacks a parser), but not
prompt injection, because the injected text reaches the model in any case. Provider web tools
remove the parser from our machine with no new process to run. Prompt injection is stopped by
limiting what a bot can do after it reads the web: no channel to send data out, no silent
memory, and the owner approves every change.

Rejected:

- **A sandbox per project (container or microVM).** Bots run no code, and file access already
  goes through `resolve()` per Library (D52). Two to four weeks of work for a small gain.
- **Our own fetch and parse in a sandboxed worker (for example Microsoft MXC with bubblewrap)**,
  for now. It is the next step if a provider we need has no web tool. It needs a new decision.
- **Web access for every bot.** Every bot would then read hostile pages; most bots do not need it.

Consequences:

- The "Scheduled bots and web access" milestone brief builds this. Its plan has a migration for
  the bot setting and the run flag (owner approval, AGENTS.md §7) and a UI design round for the
  setting.
- `security.md` §2.14 lists the controls; §2.3 points to it.
- The app container is parked until M9; the M9 brief adds its hardening (non-root user,
  read-only image, outbound traffic only to the model providers).

Implemented in: `../security.md` §2.14; the "Scheduled bots and web access" milestone brief
(not written).
