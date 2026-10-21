# cty1ng

A local-first application where I add skills, assign them to bots, create bots and tell them
what to do through a chat interface. Similar to GBots, but local and for one person.

In short: a local-first chat app where you work with AI role bots (BA, Designer, …). Bots have personas,
versioned skills and a shared file workspace per conversation; they discuss within a turn budget
you set and hand work to each other only with your approval.

> Status: see [docs/status.md](docs/status.md) for the current step, what is done and what is left.

## Quickstart (after M0)

```bash
cp .env.example .env          # add at least one provider API key
make dev                      # http://127.0.0.1:5173
make seed                     # optional: BA and Designer bots with their skills
```

Runs on `127.0.0.1` only. There is no login in phase 1; do not expose the port.

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
