# D35. Ports and adapters at the edges, not "switch anything"

Status: proposed (2026-10-21). Asked for by the owner: the code must not be glued to one stack,
so parts can be swapped.
Decision: The core (domain rules and services) is plain TypeScript. It owns an interface (a
"port") for each external dependency, and each library sits behind an adapter that implements
that port. Only the edges are swappable; the language, UI library and shared schema are not.

- **The core imports nothing from** Hono, Drizzle, pg-boss, the AI SDK or React. It imports
  Zod, which is the shared contract, not a vendor (see the "Not abstracted" list).
- **Ports owned by the core:**

  | Port | First adapter | Likely swap |
  | --- | --- | --- |
  | Realtime transport (D9, `../realtime-events.md` §1a) | SSE | WebSocket |
  | Persistence: one repository per aggregate, plus a unit of work | Drizzle on SQLite | Drizzle on Postgres, another ORM |
  | Job queue | In-process runner | pg-boss |
  | Model provider | Vercel AI SDK; the fake model in tests | Direct vendor SDKs, Mastra |
  | Price source (D21) | genai-prices + `config/models.yaml` override | Another price feed |
  | File storage (behind `Workspace.resolve()`) | Local disk | Object storage on a VPS |
  | Clock and id generation | System clock, UUIDv7 | Fixed values in tests |

- **The unit of work is part of the persistence port.** A state change and its event commit in
  one transaction (architecture rule 3), so a service runs both inside one
  `uow.run(tx => …)`. Without it, swapping the database would break that guarantee silently.
- **Adapters live in their own folders** (`backend/src/adapters/<port>/<impl>/`). Hono
  handlers stay thin: parse with Zod, call a service, map the result to a response.
- **Enforced in CI**, not by review:
  - Import-boundary rules (dependency-cruiser, chosen in M0) fail the build when the core
    imports an adapter or a vendor package.
  - Each port has one contract test suite, and every adapter must pass it. The SSE transport
    and the fake model already work this way.

Not abstracted, and why: wrapping these would cost more than a rewrite on the day we change
them, and the wrapper would leak their shape anyway.

- **TypeScript.** It's the language of both halves (D34).
- **React on the frontend.** Components, hooks and TanStack Query are the app. The API client
  and the stream transport are still behind interfaces, so the server side can change without
  touching it.
- **Zod.** It's the contract shared by frontend, backend and the OpenAPI schema (D33). An
  abstraction would mean a second schema language.
- **The SQL dialect beyond what Drizzle covers for SQLite and Postgres.** No generic SQL
  layer; a third database would be its own migration.

Why: the parts most likely to change over the product's life are the transport, the database
engine, the queue, the model vendors and storage when it moves to a VPS. Ports there keep each
change to one adapter and its contract tests. "Switch anything" (abstracting the framework,
language and UI library too) gives the lowest common denominator of every option and doubles
the code, for swaps that would realistically be rewrites anyway.
Rejected:
- **No boundaries.** Calling Drizzle and the AI SDK straight from routes is faster to start, but
  every swap then touches the whole codebase.
- **Full hexagonal with generic repositories and a DI container.** Ceremony a single-owner app
  does not need. Plain constructor arguments are enough.
Consequences:
- M0 sets up the folder layout, the dependency-cruiser config and the first contract suites.
- `../architecture.md` and AGENTS.md §5 change when the docs switch to TypeScript (D34), and
  the owner approves that change.
- Hono's built-in middleware (CORS, `secureHeaders`, `bodyLimit`) stays in the HTTP adapter.
  Moving off Hono means re-wiring that middleware, which is accepted.
Implemented in: pending (`../architecture.md` with the D34 docs switch).
