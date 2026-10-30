# cty1ng

A local-first application where I add skills, assign them to bots, create bots and tell them
what to do through a chat interface. Similar to GBots, but local and for one person.

In short: a local-first chat app where you work with AI role bots (BA, Designer, …). Bots have personas,
versioned skills and a shared file workspace per conversation; they discuss within a turn budget
you set and hand work to each other only with your approval.

> Status: see [docs/status.md](docs/status.md) for the current step, what is done and what is left.

## Quickstart

Needs Node 24 (`.nvmrc`) and the pnpm version in `package.json` (`packageManager`).

```bash
nvm use                       # Node 24
npm install -g pnpm@12.16.1   # or let corepack pick it from package.json
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm check:index && pnpm check:events
```

Run the app (the backend since M0b; the frontend comes with M0c):

```bash
cp .env.example .env          # provider API keys from M3
make dev                      # backend on http://127.0.0.1:8000 (frontend on :5173 from M0c)
curl http://127.0.0.1:8000/api/health
make seed                     # optional: BA and Designer bots with their skills (M1)
```

The backend applies pending database migrations when it starts. Other database commands:
`pnpm --filter backend db:generate`, `db:migrate`, `db:check`.

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
