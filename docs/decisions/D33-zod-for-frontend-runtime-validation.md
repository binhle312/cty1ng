# D33. Zod for runtime validation in the frontend

Status: proposed (2026-10-21). Needs the owner's approval as a new dependency (`AGENTS.md` §7).
Decision: The frontend validates every value that does not come through the generated REST
client (SSE payloads, `localStorage`, URL params, forms) with Zod, and infers TypeScript types
from the schemas. The OpenAPI client generator chosen in M0 must also emit Zod schemas for
API types, so there is one schema system.
Why: SSE events and stored settings arrive as untyped JSON; without a schema library each would
need a hand-written guard that can drift from its type. Zod is the common choice with
shadcn/ui forms and with OpenAPI generators, so it adds one library, not several.
Rejected: hand-written type guards (drift, easy to write a guard that lies); Valibot (smaller,
but less support in the generators and form tooling we use); no runtime validation (a bad
event would corrupt the cache silently).
Consequences: Branded ids and the event union are defined as Zod schemas
(`frontend-conventions.md`). M0 checks which generator supports both TanStack Query hooks and
Zod output, and records the choice in its PR.
Implemented in: `../frontend-conventions.md`.
