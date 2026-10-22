# cty1ng

A local-first application where I add skills, assign them to bots, create bots and tell them
what to do through a chat interface. Similar to GBots, but local and for one person.

In short: a local-first chat app where you work with AI role bots (BA, Designer, …). Bots have personas,
versioned skills and a shared file workspace per conversation; they discuss within a turn budget
you set and hand work to each other only with your approval.

> Status: see [docs/status.md](docs/status.md) for the current step, what is done and what is left.

## Quickstart

Needs Node 24 (`.nvmrc`) and pnpm through corepack.

```bash
nvm use                       # Node 24; pnpm refuses other versions (engineStrict)
corepack enable               # pnpm at the version pinned in package.json
pnpm install
cp .env.example .env          # provider keys are only needed from M3 on
make dev                      # backend on http://127.0.0.1:8000 (the frontend comes with M0b)
curl -H "Host: 127.0.0.1:8000" http://127.0.0.1:8000/api/health
```

Every check that CI runs is listed in [AGENTS.md](AGENTS.md) §4. `make seed` is a stub until
M1/M2.

Runs on `127.0.0.1` only. There is no login in phase 1; do not expose the port.

Code indexes: [shared/](shared/README.md), [backend/](backend/README.md); each code folder has
its own `README.md` table (`docs/architecture.md` §4.2).

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
