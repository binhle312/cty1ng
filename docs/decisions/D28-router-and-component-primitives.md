# D28. TanStack Router and shadcn/ui on Base UI

Status: accepted (2026-10-21). Adds to D10 (which named no router and assumed Radix).
Amends: D10
Decision: The frontend uses TanStack Router for routing, and shadcn/ui initialised on Base UI
(`shadcn init` default since July 2026) instead of Radix. If the owner picks a UI concept built
on another component library (`../design/concepts.md`), that choice replaces this one through a
new decision before M0.
Why: TanStack Router is built for client-side apps: typed links and validated, typed search
params, which the time range picker keeps in the URL (UI-11). Base UI is now shadcn's default
and is maintained by the MUI team; starting on it avoids a later Radix to Base UI migration
(`asChild` becomes `render`, plus behaviour differences).
Rejected: React Router 7 (larger ecosystem, but its strengths are server rendering and its
search params are untyped strings); Radix (still supported, but no longer the default, so new
examples and blocks target Base UI first).
Consequences: Agents must use Base UI's `render` prop, not Radix's `asChild`; examples copied
from older shadcn posts need adapting. Route definitions live in `frontend/src/routes/`.
Implemented in: `../architecture.md` §4, `../tasks/M0-skeleton.md`, `../requirements/README.md`.
