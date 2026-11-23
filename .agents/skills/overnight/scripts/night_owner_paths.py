"""Repository paths that need the owner under AGENTS.md §7."""

OWNER_FILES = (
    "backend/src/adapters/http/app.ts",
    "backend/src/adapters/http/middleware.ts",
    "backend/src/adapters/http/routes/avatars.ts",
    "backend/src/adapters/http/routes/skills.ts",
    "backend/src/app/config.ts",
    "frontend/src/components/ui/markdown.tsx",
)

OWNER_TREES = (
    ".github/workflows/",
    "backend/src/adapters/avatars/",
    "backend/src/adapters/http/uploads/",
    "backend/src/adapters/workspace/",
    "backend/src/core/guard/",
    "docs/decisions/",
)

OWNER_NAMES = (
    "AGENTS.md",
    "bun.lock",
    "bun.lockb",
    "npm-shrinkwrap.json",
    "package-lock.json",
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
)

OWNER_DIRS = ("migration", "migrations")
