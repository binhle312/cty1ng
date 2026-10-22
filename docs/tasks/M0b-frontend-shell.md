# M0b: Frontend shell, themes and the generated client

Part of M0 ([M0-skeleton.md](M0-skeleton.md)), split per `workflow.md` §8. Checkpoint: **UI
design** (the owner reviews it separately; no UI code before approval) and merge. Starts after
M0a is merged.

## Goal

The app shell (header, rail, empty pages) renders in the Command theme, the frontend talks to
the backend only through a generated client, and the bundle budget and end-to-end checks run
in CI.

## Read first

`AGENTS.md`; `M0-skeleton.md`; `M0a-backend-skeleton.md` (what already exists);
`docs/realtime-events.md` §1a, §3; `docs/frontend-conventions.md`;
`docs/requirements/app-shell.md` (layout only); `docs/design/screens.md` §1 (sketch, not final);
`docs/design/themes.md` §2, §3, §5 (D30); decisions D28, D30, D33.

## In scope

- `frontend/` package: Vite + React + TS strict, Tailwind, shadcn/ui on Base UI (D28), TanStack
  Query, TanStack Router with empty pages (Conversation, Bots, Bot detail, Create bot, Skills,
  Skill editor, Settings), app shell with header and rail placeholders, `lib/realtime/` with the
  SSE connection and the reducer skeleton. A shared `Skeleton` component (theme tokens, 200 ms
  delay, reduced-motion aware) used by the empty pages' loading state (`requirements/README.md`).
- The frontend transport interface and SSE implementation (`realtime-events.md` §1a).
- Theme layer (D30): semantic tokens as CSS variables, `frontend/src/themes/` with the
  **Command** theme in light and dark, the `data-theme`/`data-mode` attributes with the blocking
  `/theme-init.js` script (`design/themes.md` §2), and the lint rule against raw colours.
- Lazy route setup and the first-load bundle budget check in CI (`frontend-conventions.md` §4);
  the empty pages that later hold Statistics, Flow and the skill editor are lazy routes already.
- `tsconfig` and ESLint settings from `frontend-conventions.md` §3 for `frontend/`.
- API client generation (`pnpm gen:api`) from `/api/openapi.json` into
  `frontend/src/lib/api/generated/`, with a CI freshness check. Generator:
  `@hey-api/openapi-ts`, pinned to an exact version (0.x), with its TanStack Query plugin (emits
  TanStack Query **options**, `useQuery(getFooOptions())`) and Zod plugin, on the same Zod major
  as `shared/`. Record why it beat Orval in `frontend/src/lib/api/README.md`.
- `pnpm e2e` (Playwright, fake model), including a run against the production build under the
  real CSP; `make dev` extended to start both servers.

Notes from the owner on the shell (PR #10), applied once the UI design is approved: the "+"
button is `aria-disabled="true"`, not `disabled`, so its tooltip still shows on hover and focus;
the placeholder texts ("This page arrives in M<n>", "Comes with conversations (M3)") are each
replaced by the slice that builds that page.

## Out of scope

Real pages; the Appearance settings UI; the Get started checklist (needs `/api/setup`).

## Acceptance criteria

Numbers are the original M0 numbers.

1. `make dev` starts both servers; the browser shows the shell with the "+" button in the rail
   and an empty header.
5. `pnpm gen:api` produces a client; CI fails if it is stale.
9. The bundle budget check runs in CI and fails a build that exceeds it (shown with a test
   fixture).
10. All CI gates run and pass on the PR.
11. `docs/` is unchanged except where this slice had to correct something (listed in the PR).

## Tests

A Vitest test for the stream reducer applying an event idempotently; a Playwright smoke test
that loads the shell; the theme checks from `design/themes.md` §5 scaled to the shell (token
contrast, axe in light and dark, a shell screenshot per mode, the leak test).

## Needs human review

The UI design (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).
