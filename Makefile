# Shortcuts for the pnpm scripts (AGENTS.md §4). Run from the repository root.
.PHONY: dev test lint seed

# Starts every package that has a dev script: the backend (M0b) and the frontend (M0c).
dev:
	pnpm -r --parallel --if-present dev

test:
	pnpm test

lint:
	pnpm lint

# Imports the example skills and bots in seed/ (seed/README.md). Built in M1.
seed:
	@echo "make seed: not built yet (slice M1)"
