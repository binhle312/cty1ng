# .agents/chief

The chief's own folder: its memory and its scripts (owner, 2026-11-19, order 123). It belongs to
the chief only (orders 115 to 117): other agents do not read it, except a file that the chief's
brief names, as data (`AGENTS.md` §3).

| File | What it is for |
| --- | --- |
| `memories/` | The chief memory: `long-term/` in git, `short-term/` on this computer only (its own index) |
| `scripts/` | The chief's scripts: `pnpm check:memory` and `pnpm merge:check` (its own index) |

Start here: `memories/README.md`. Do not: put a project script here; those go in `../../scripts/`.
