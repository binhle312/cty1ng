# M0: Skeleton

Checkpoint: **plan** and merge. Split into two parts by the owner (PR #10, `workflow.md` §8);
each part is its own brief, branch and PR.

## Goal

An empty but production-shaped app: backend and frontend start with one command, every check
in `AGENTS.md` §4 exists and passes in CI, the security middleware is in place, the event log
and SSE stream work end to end with a test event, and the app shell (header, rail, empty pages)
renders. Later slices only add features; they should never need to set up tooling.

## Parts

| Part | Brief | Delivers | Original acceptance criteria |
| --- | --- | --- | --- |
| M0a | [M0a-backend-skeleton.md](M0a-backend-skeleton.md) | Workspace and tooling, `shared/`, backend (ports, adapters, event log, SSE, security middleware, migration), contract suites, import and index checks, CI, `reference/` | 2, 3, 4, 6, 7, 8, 10, 11 |
| M0b | [M0b-frontend-shell.md](M0b-frontend-shell.md) | Frontend shell, Command theme, `Skeleton`, routes, `lib/realtime/`, `gen:api`, bundle budget, Playwright | 1, 5, 9, 10, 11 |

M0b starts after M0a is merged and after the owner approves its UI design.

## Owner answers to the plan (PR #10)

Recorded in the owning documents: `test.ping` (`realtime-events.md` §4), the `PENDING` event
list (`realtime-events.md` §4), the external theme script and the Command fallback
(`design/themes.md` §2), `APP_ENV`, `FAKE_MODEL` and `LOG_LEVEL` (`architecture.md` §8), the
health shape (`api.md` §7). Middleware order, the test endpoint's rules and the security review
workflow conditions are in the M0a brief.

## Open questions

- None.
