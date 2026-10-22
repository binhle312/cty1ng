// @ts-check
import js from "@eslint/js";
import drizzle from "eslint-plugin-drizzle";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Lint rules from docs/frontend-conventions.md §3 (TypeScript) and docs/security.md §2.8 (SQL).
 * A new exception needs a comment saying why (frontend-conventions.md §3).
 */

/** security.md §2.8: no `sql.raw()`, no string SQL passed to run/execute/exec. */
const SQL_RULES = [
  {
    selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
    message: "sql.raw() is banned; use the sql`` template, which binds values (security.md §2.8).",
  },
  ...[
    "[arguments.0.type='Literal'][arguments.0.raw=/^[\"']/]",
    "[arguments.0.type=/^(TemplateLiteral|BinaryExpression|Identifier)$/]",
  ].map((argument) => ({
    // `run`/`execute`/`exec` on a database handle; RegExp#exec on a regex literal is fine.
    selector: `CallExpression[callee.property.name=/^(run|execute|exec)$/]:not([callee.object.regex])${argument}`,
    message:
      "String SQL is banned outside reviewed, commented exceptions; use Drizzle's query builder (security.md §2.8).",
  })),
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "reference/**",
      ".agents/**",
      ".claude/**",
      "docs/**",
      "backend/migrations/**",
      "backend/test/fixtures/**",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          // `lint-sample.ts` never exists on disk: scripts/eslint-rules.test.ts lints text as it.
          allowDefaultProject: ["*.js", "*.cjs", "vitest.config.ts", "scripts/lint-sample.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { drizzle },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      // Ports are async (Postgres later) while better-sqlite3 is synchronous, so many adapter
      // methods are async without awaiting anything; that is intended.
      "@typescript-eslint/require-await": "off",
      // Style only; `() => void f()` style arrows are clear enough.
      "@typescript-eslint/no-confusing-void-expression": "off",
      "no-restricted-syntax": ["error", ...SQL_RULES],
      "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
      "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
    },
  },
  {
    files: ["**/*.js", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
