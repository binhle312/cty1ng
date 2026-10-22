# Shortcuts for the commands in AGENTS.md §4.
.PHONY: dev test lint seed

# Backend on 127.0.0.1:8000. M0b adds the frontend on 127.0.0.1:5173.
dev:
	pnpm --filter @cty1ng/backend dev

test:
	pnpm test

lint:
	pnpm lint

# Stub until the skill import (M1) and bots (M2) exist (porting-guide.md §2).
seed:
	@echo "make seed: nothing to seed yet; the BA and Designer examples arrive with M1 and M2."
