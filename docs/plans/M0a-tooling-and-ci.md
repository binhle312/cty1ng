# M0a plan: Tooling and CI

> **Record, not spec.** Copied from [#46, first comment](https://github.com/binhle312/cty1ng/pull/46#issuecomment-6518525122) and the [owner's decision](https://github.com/binhle312/cty1ng/pull/46#issuecomment-6519027623) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** the plan has no approval line. The owner's decision of 2026-10-30 is at the end. #46 merged on 2026-10-30.

Brief: `docs/tasks/M0-skeleton.md` (§Parts, row M0a). Checkpoint: **plan**. I build nothing until the owner approves this.

## 1. What M0a adds

```text
.nvmrc (24)  package.json  pnpm-workspace.yaml  pnpm-lock.yaml  Makefile
tsconfig.base.json  eslint.config.js  .prettierrc  .prettierignore  .dependency-cruiser.cjs
scripts/
├── check-index.ts      # folder indexes + docs metadata (architecture.md §4.2)
├── check-events.ts     # realtime-events.md §4 table = shared/ types + PENDING
├── check-bundle.ts     # first-load JS budget from a Vite manifest (frontend-conventions.md §4)
├── *.test.ts           # one test file per script
└── fixtures/           # bad import, unlisted file, oversized build, ...
shared/ †
├── README.md
└── src/
    ├── events/         # envelope {seq, type, data}; ready, reset, test.ping
    ├── ids.ts          # one branded Zod schema per TypeID prefix (D36)
    └── errors.ts       # error codes of api.md §1 as a Zod enum
.github/
├── workflows/ci.yml, security-review.yml   (+ codeql.yml gets javascript-typescript)
├── dependabot.yml      # npm + github-actions, weekly
└── pull_request_template.md   # workflow.md §6
README.md               # quickstart updated
```

## 2. Root commands after M0a

| Command | M0a | Comes in |
| --- | --- | --- |
| `pnpm install`, `lint`, `typecheck`, `test`, `check:index` | yes | |
| `check:events`, `check:bundle` | yes (CI runs them) | `check:bundle` runs on the real build in M0c |
| `db:generate`, `db:migrate`, `db:check` | | M0b |
| `gen:api`, `e2e`, `make dev` (both servers) | | M0c (`make dev` runs what exists until then) |

`make seed` is a stub that prints "comes in M1".

## 3. Rules set up now

- **TypeScript** (`frontend-conventions.md` §3): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- **ESLint**, type-aware: the §3 table (`no-explicit-any`, no type assertions, exhaustive switch, no `!`, `no-unsafe-*`, `no-console`).
- **SQL** (`security.md` §2.8): ban `sql.raw()` and string-argument `db.run`/`db.execute`; `eslint-plugin-drizzle` requires `where` on `update`/`delete`.
- **Raw colours** (`themes.md` §2 rule 1): hex colours and arbitrary Tailwind values fail in `frontend/src/components/` and `frontend/src/features/`. A fixture proves it now.
- **Import rules** (`architecture.md` §4.1) in dependency-cruiser: core → adapter, adapter → adapter, rules → anything but rules/shared, core → vendor packages (`hono`, `drizzle-orm`, `ai`, `better-sqlite3`, `node:fs`, `node:child_process`, …), frontend → backend.
- **Prettier** check.

## 4. The docs checks in `check:index` (one finding)

The checks of `architecture.md` §4.2 run on today's docs with one failure:

- **D19**: its "Changed by" cell says `D38, D52 (amendment 2026-10-27)`. D38 and D52 have no `Amends: D19` line; the cell refers to the dated amendment inside D19.

**Proposal:** an id in "Changed by" passes if an `Amends:`/`Supersedes:` line names it, **or** if the cell has `(amendment <date>)` and the decision file has an `Amended <date>` line. No docs change needed. (Alternative: add `Amends: D19` to D38 and D52. That edits accepted decisions, so I don't recommend it.)

## 5. CI (`.github/workflows/ci.yml`)

One job per gate, on every PR and on `main`: install (Node 24, pnpm installed with npm, `--frozen-lockfile`), lint, typecheck, test, `check:index`, `check:events`, `pnpm audit --audit-level high` (one retry if the advisory endpoint does not answer). M0b and M0c add `db:check`, the client freshness check, the build with `check:bundle`, and Playwright.

`security-review.yml`: `anthropics/claude-code-security-review` on PRs that touch the `AGENTS.md` §7 paths, only from the owner's branches (`security.md` §2.11).

## 6. New dependencies (owner approval)

Exact versions are pinned when installed. pnpm `12.16.1` in `packageManager`.

| Package | Where | For |
| --- | --- | --- |
| `typescript`, `@types/node` | root dev | types |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | root dev | lint |
| `eslint-plugin-drizzle` | root dev | SQL rules |
| `prettier` | root dev | format |
| `dependency-cruiser` | root dev | import rules |
| `vitest` | root dev | tests |
| `tsx` | root dev | run the `scripts/*.ts` |
| `zod` | `shared` | schemas (D33) |

TypeID checks in `shared/` are a Zod regex per prefix, so `typeid-js` (conversion to UUID) comes with the ids adapter in M0b and the frontend does not ship it.

## 7. Tests (acceptance criteria of M0a)

| AC | Test |
| --- | --- |
| 6 | `scripts/import-rules.test.ts`: depcruise on fixtures; core → adapter, adapter → adapter, rules → port and frontend → backend each fail; a clean fixture passes |
| 7 | `scripts/check-index.test.ts`: an unlisted file fails, a listed missing file fails, an unlisted subfolder fails; docs fixtures: a story id out of range, a missing last id, `Amends:` naming a missing decision, a "Changed by" mismatch, a decision with no row, a row linking a missing file, and the dated-amendment case of §4 passing |
| 9 (fixture) | `scripts/check-bundle.test.ts`: an oversized fixture build fails at 250 KB gzip; a lazy chunk over 300 KB warns |
| 10 | CI green on this PR |
| also | `check-events.test.ts` (missing type, overlap with `PENDING` both fail); `shared` id tests (wrong prefix, bad length, valid id); the SQL and raw-colour lint fixtures fail |

## 8. Risks and owner actions

- **Owner action:** add the `ANTHROPIC_API_KEY` repository secret, or the security review job is skipped.
- **Owner action:** check that GitHub secret scanning and push protection are on (`security.md` §2.11).
- Node 24 is used through nvm locally; CI uses `actions/setup-node` with `.nvmrc`.
- No UI in M0a, so no UI design checkpoint.

## 9. Follow-ups (not in M0a)

- M0b plan: backend core (port interfaces, migration, security middleware, `host_rejected` error code).
- M0c plan: frontend shell with its UI design section.

---

**Owner decision (2026-10-30):** no `ANTHROPIC_API_KEY` secret for now. `security-review.yml` is added as planned, but it skips with a notice when the secret is missing (option 1). Guards: `pull_request` trigger only (never `pull_request_target`), runs only on the owner's own branches, action pinned to a commit SHA, permissions `contents: read` and `pull-requests: write`. Add the key before M0b, whose security middleware is the first code it should review.
