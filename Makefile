# Shortcuts for the pnpm scripts (AGENTS.md §4). Run from the repository root. `make dev` and
# `make start` work on a fresh clone: they install the dependencies first when needed.
.PHONY: dev start test lint e2e seed install

# pnpm writes this file on every install; it is older than the lockfile when an install is due.
DEPS := node_modules/.modules.yaml

$(DEPS): pnpm-lock.yaml package.json shared/package.json backend/package.json frontend/package.json
	pnpm install --frozen-lockfile
	@touch $@

install: $(DEPS)

# Backend on http://127.0.0.1:8000, frontend on http://127.0.0.1:5173 (open this one).
dev: $(DEPS)
	pnpm dev

# The production build on http://127.0.0.1:8000.
start: $(DEPS)
	pnpm start

test: $(DEPS)
	pnpm test

lint: $(DEPS)
	pnpm lint

e2e: $(DEPS)
	pnpm e2e

# Imports the example skills in seed/ through the import service, then creates the example bots
# (seed/README.md). A second run changes nothing.
seed: $(DEPS)
	pnpm --filter backend cli skills import $(CURDIR)/seed/skills --apply
	pnpm --filter backend cli bots seed $(CURDIR)/seed/bots.yaml
