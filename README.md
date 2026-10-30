# cty1ng

A local-first application where I add skills, assign them to bots, create bots and tell them
what to do through a chat interface. Similar to GBots, but local and for one person.

In short: a local-first chat app where you work with AI role bots (BA, Designer, …). Bots have personas,
versioned skills and a shared file workspace per conversation; they discuss within a turn budget
you set and hand work to each other only with your approval.

> Status: see [docs/status.md](docs/status.md) for the current step, what is done and what is left.

## Quickstart

Needs Node 24.15 or a newer 24 (`.nvmrc`; jsdom 30 needs 24.15) and the pnpm version in `package.json` (`packageManager`). One
command starts the app; it installs the dependencies first when they are missing or out of
date:

```bash
nvm use                       # Node 24
npm install -g pnpm@12.16.1   # or let corepack pick it from package.json
make dev                      # open http://127.0.0.1:5173 (API on http://127.0.0.1:8000)
```

Other commands:

```bash
make start                    # the production build on http://127.0.0.1:8000 (pnpm start)
cp .env.example .env          # settings; provider API keys from M3
make seed                     # optional: BA and Designer bots with their skills (M1)
pnpm lint && pnpm typecheck && pnpm test && pnpm check:index && pnpm check:events
pnpm e2e                      # Playwright; first run: pnpm exec playwright install chromium
pnpm gen:api                  # regenerate the API client after an API change
```

The backend applies pending database migrations when it starts. Other database commands:
`pnpm --filter backend db:generate`, `db:migrate`, `pnpm db:check`. In development the API docs
are at http://127.0.0.1:8000/api/docs. The repository scripts (checks, `gen:api`, `start`) are
in `scripts/`.

Runs on `127.0.0.1` only. There is no login in phase 1; do not expose the port. The code
layout and the folder indexes are in [docs/architecture.md](docs/architecture.md) §4.

## Documentation

Start at [docs/README.md](docs/README.md). Coding agents start at [AGENTS.md](AGENTS.md).

| I want to… | Read |
| --- | --- |
| Understand the product | [docs/requirements/product-brief.md](docs/requirements/product-brief.md) |
| See detailed requirements | [docs/requirements/](docs/requirements/README.md) |
| Know where we are | [docs/status.md](docs/status.md) |
| Know why it is built this way | [docs/decisions/](docs/decisions/README.md) |
| Understand the code layout | [docs/architecture.md](docs/architecture.md) |
| Build the next slice | [docs/development-plan.md](docs/development-plan.md) and [docs/workflow.md](docs/workflow.md) |
