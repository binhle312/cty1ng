// ESLint for the whole workspace. Rules: docs/frontend-conventions.md §3 (TypeScript),
// docs/security.md §2.8 (SQL) and docs/design/themes.md §2 rule 1 (no raw colours).
// A new exception needs a comment that says why (frontend-conventions.md §3).
import js from "@eslint/js";
import drizzle from "eslint-plugin-drizzle";
import globals from "globals";
import tseslint from "typescript-eslint";

// security.md §2.8: SQL is built only by Drizzle's query builder or its `sql` tagged template.
const SQL_RULES = [
  {
    selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
    message: "sql.raw() does not bind values (security.md §2.8). Use the sql`` tagged template.",
  },
  {
    // Only calls on the database handle: `db`/`tx`, bare or as a property (`this.db`), the same
    // names as the drizzle rules below. `map.get("key")` is not SQL.
    selector:
      "CallExpression:matches([callee.object.name=/^(db|tx)$/], [callee.object.property.name=/^(db|tx)$/])[callee.property.name=/^(run|execute|all|get|values)$/][arguments.0.type=/^(Literal|TemplateLiteral|BinaryExpression)$/]",
    message:
      "No SQL from a string (security.md §2.8). Use the query builder or the sql`` tagged template.",
  },
];

// themes.md §2 rule 1: components use semantic tokens only.
const RAW_COLOUR_RULES = [
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
    message: "No raw colours: use a semantic token (design/themes.md §2).",
  },
  {
    selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
    message: "No raw colours: use a semantic token (design/themes.md §2).",
  },
  {
    selector: "Literal[value=/(^|\\s)[\\w:-]+-\\[[^\\]]+\\]/]",
    message: "No arbitrary Tailwind values: use a semantic token (design/themes.md §2).",
  },
  {
    selector: "TemplateElement[value.raw=/(^|\\s)[\\w:-]+-\\[[^\\]]+\\]/]",
    message: "No arbitrary Tailwind values: use a semantic token (design/themes.md §2).",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "frontend/src/lib/api/generated/**",
      "docs/**",
      "mockups/**",
      ".agents/**",
      ".claude/**",
      ".impeccable/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
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
      "no-console": "error",
      "no-restricted-syntax": ["error", ...SQL_RULES],
      "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
      "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
    },
  },
  {
    files: ["frontend/src/components/**/*.{ts,tsx}", "frontend/src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...SQL_RULES, ...RAW_COLOUR_RULES],
    },
  },
  {
    // The repository scripts are command-line tools: they print their results.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
