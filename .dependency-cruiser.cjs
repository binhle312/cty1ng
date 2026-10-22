/**
 * Import rules (architecture.md §4.1, D35). Run by `pnpm lint`; a violation fails CI.
 * `scripts/import-rules.test.ts` proves each rule fires on a fixture with bad imports.
 */
const path = require("node:path");

/** Libraries that sit behind an adapter, matched on their resolved node_modules path. */
const VENDORS_BEHIND_ADAPTERS_PATH =
  "node_modules/(hono|@hono/[^/]+|drizzle-orm|drizzle-kit|better-sqlite3|ai|@ai-sdk/[^/]+|pg-boss|pino|typeid-js|uuidv7|yaml)/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-imports-no-adapter",
      comment: "core/ never imports an adapter; app/ wires them (D35).",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { path: "^backend/src/(adapters|app)/" },
    },
    {
      name: "core-imports-no-vendor",
      comment: "core/ never imports a library that an adapter wraps (D35).",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { path: VENDORS_BEHIND_ADAPTERS_PATH },
    },
    {
      name: "core-imports-no-fs-or-processes",
      comment: "core/ never touches the disk or runs processes; the workspace port does.",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { dependencyTypes: ["core"], path: "^(node:)?(fs|fs/promises|child_process)$" },
    },
    {
      name: "adapters-import-no-other-adapter",
      comment: "Adapters never import each other; if two cooperate, app/ wires them.",
      severity: "error",
      from: { path: "^backend/src/adapters/([^/]+)/" },
      to: { path: "^backend/src/adapters/", pathNot: "^backend/src/adapters/$1/" },
    },
    {
      name: "adapters-import-no-app",
      severity: "error",
      from: { path: "^backend/src/adapters/" },
      to: { path: "^backend/src/app/" },
    },
    {
      name: "rules-are-pure",
      comment: "*.rules.ts imports only other *.rules.ts files and shared/ (AGENTS.md §5 rule 1).",
      severity: "error",
      from: { path: "\\.rules\\.ts$" },
      to: {
        pathNot: ["\\.rules\\.ts$", "^shared/", "node_modules/zod/"],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "shared-imports-nothing-local",
      comment: "shared/ is imported by both sides and imports neither.",
      severity: "error",
      from: { path: "^shared/" },
      to: { path: "^(backend|frontend)/" },
    },
    {
      name: "frontend-imports-no-backend",
      comment: "The frontend talks to the backend only through lib/api/generated/.",
      severity: "error",
      from: { path: "^frontend/" },
      to: { path: "^backend/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|reference|dist)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: path.join(__dirname, "tsconfig.base.json") },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
