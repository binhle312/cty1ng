// Import rules of docs/architecture.md §4.1 (D35). `pnpm lint` runs them; a violation fails CI.
// Paths are relative to the repository root.

// Libraries that only adapters may import (D35: the core never imports what an adapter wraps).
// Each entry is a package name as a regular expression.
const ADAPTER_LIBRARIES = [
  "hono",
  "@hono/[^/]+",
  "drizzle-orm",
  "drizzle-kit",
  "better-sqlite3",
  "ai",
  "@ai-sdk/[^/]+",
  "pg-boss",
  "pino",
  "uuidv7",
  "typeid-js",
  "@pydantic/genai-prices",
  "sharp",
];
const ADAPTER_LIBRARY_PATH = `(^|/)node_modules/(${ADAPTER_LIBRARIES.join("|")})/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-not-to-adapters",
      comment: "core/ never imports an adapter (architecture.md §4.1)",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { path: "^backend/src/adapters/" },
    },
    {
      name: "core-not-to-app",
      comment: "core/ never imports app/ (the composition root)",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { path: "^backend/src/app/" },
    },
    {
      name: "core-not-to-adapter-libraries",
      comment: "core/ never imports a library that an adapter wraps (D35)",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { path: ADAPTER_LIBRARY_PATH },
    },
    {
      name: "core-not-to-fs-or-processes",
      comment: "core/ never touches files or processes directly; it goes through ports",
      severity: "error",
      from: { path: "^backend/src/core/" },
      to: { dependencyTypes: ["core"], path: "^(node:)?(fs|fs/promises|child_process)$" },
    },
    {
      name: "adapters-not-to-each-other",
      comment: "Adapters never import each other; app/ wires them (architecture.md §4.1)",
      severity: "error",
      from: { path: "^backend/src/adapters/([^/]+)/" },
      to: { path: "^backend/src/adapters/", pathNot: "^backend/src/adapters/$1/" },
    },
    {
      name: "adapters-not-to-app",
      comment: "Adapters never import app/",
      severity: "error",
      from: { path: "^backend/src/adapters/" },
      to: { path: "^backend/src/app/" },
    },
    {
      name: "rules-only-rules-and-shared",
      comment: "*.rules.ts imports only other *.rules.ts files and shared/ (pure functions)",
      severity: "error",
      from: { path: "\\.rules\\.ts$" },
      to: { pathNot: ["\\.rules\\.ts$", "^shared/"] },
    },
    {
      name: "frontend-not-to-backend",
      comment: "The frontend talks to the backend only over HTTP and SSE",
      severity: "error",
      from: { path: "^frontend/" },
      to: { path: "^backend/" },
    },
    {
      name: "backend-not-to-frontend",
      severity: "error",
      from: { path: "^backend/" },
      to: { path: "^frontend/" },
    },
    {
      name: "shared-not-to-packages",
      comment: "shared/ is imported by both sides and imports neither",
      severity: "error",
      from: { path: "^shared/" },
      to: { path: "^(backend|frontend)/" },
    },
    {
      name: "not-to-unresolvable",
      comment: "An import that cannot be resolved is a typo or a missing dependency",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|generated)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".d.ts"],
    },
  },
};
