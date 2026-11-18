// ESLint for the whole workspace. Rules: docs/frontend-conventions.md §3 (TypeScript),
// docs/security.md §2.8 (SQL), docs/design/themes.md §2 rule 1 (no raw colours) and
// docs/frontend-conventions.md §5 (one query client).
// A new exception needs a comment that says why (frontend-conventions.md §3).
import js from "@eslint/js";
import drizzle from "eslint-plugin-drizzle";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// security.md §2.8: SQL is built only by Drizzle's query builder or its `sql` tagged template.
// What these rules do not see is in security.md §2.8 too.
const SQL_RULES = [
  {
    // `sql.raw` and `orm.sql.raw`. The next rule keeps the name `sql` for each named import.
    selector:
      "CallExpression[callee.property.name='raw']:matches([callee.object.name='sql'], [callee.object.property.name='sql'])",
    message: "sql.raw() does not bind values (security.md §2.8). Use the sql`` tagged template.",
  },
  {
    selector: "ImportSpecifier[imported.name='sql'][local.name!='sql']",
    message:
      "Import sql under its own name, so that the sql.raw() rule sees it (security.md §2.8).",
  },
  {
    // Only calls on the database handle: `db`/`tx`, bare or as a property (`this.db`), the same
    // names as the drizzle rules below. `map.get("key")` is not SQL. Any argument but a sql``
    // tagged template: a string, a template, a string in a variable, the result of a call.
    selector:
      "CallExpression:matches([callee.object.name=/^(db|tx)$/], [callee.object.property.name=/^(db|tx)$/])[callee.property.name=/^(run|execute|all|get|values)$/][arguments.length>0]:not([arguments.0.tag.name='sql'], [arguments.0.tag.property.name='sql'])",
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

// time-format.md §1: a relative time updates while the page is visible. A component that reads
// the clock with `new Date()` in a render shows a time that does not update; it asks `useNow()`
// (lib/now.ts). A date made from a value (`new Date(iso)`) is fine. `Date.now()` is not seen.
const CLOCK_RULES = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      "Use useNow() (lib/now.ts) for the time now: a time read in a render does not update (design/components/time-format.md §1).",
  },
];

// The bot list and the settings: only the bot list store writes them (frontend-conventions.md
// §1); a write from elsewhere is dropped by the next load or answer. The rule sees the key as the
// first argument of `setQueryData`/`setQueriesData` (also as a copy `[...key()]`), as the `queryKey`
// of its filters, or as `listBotsOptions().queryKey`; a key in a variable is not seen
// (frontend-conventions.md §1).
const BOT_LIST_KEY = "[callee.name=/^(listBots|getSettings)(QueryKey|Options)$/]";
const CACHE_WRITE = "CallExpression[callee.property.name=/^(setQueryData|setQueriesData)$/]";
const BOT_LIST_WRITE_RULES = [
  {
    selector: [
      `${CACHE_WRITE} > CallExpression.arguments:nth-child(1)${BOT_LIST_KEY}`,
      `${CACHE_WRITE} > MemberExpression.arguments:nth-child(1)[property.name='queryKey'] > CallExpression.object${BOT_LIST_KEY}`,
      `${CACHE_WRITE} > ArrayExpression.arguments:nth-child(1) > SpreadElement > CallExpression.argument${BOT_LIST_KEY}`,
      `${CACHE_WRITE} > ObjectExpression.arguments:nth-child(1) > Property[key.name='queryKey'] > CallExpression.value${BOT_LIST_KEY}`,
      `${CACHE_WRITE} > ObjectExpression.arguments:nth-child(1) > Property[key.name='queryKey'] > MemberExpression.value[property.name='queryKey'] > CallExpression.object${BOT_LIST_KEY}`,
    ].join(", "),
    message:
      "Write the bot list and the settings only through features/bots/bot-list-store.ts (frontend-conventions.md §1).",
  },
];

// frontend-conventions.md §5, "A browser that says it is offline" (DQ-088, owner 2026-11-08):
// every read and save uses the one default of `createQueryClient`. A second client or a
// `networkMode` on one call can pause again after an `offline` event.
const QUERY_CLIENT_RULES = [
  {
    selector: "NewExpression[callee.name='QueryClient']",
    message:
      "Make the query client with createQueryClient (lib/api/query-client.ts): its default runs reads and saves when the browser says it is offline (frontend-conventions.md §5).",
  },
  {
    selector:
      "Property[key.name='networkMode'], AssignmentExpression > MemberExpression.left[property.name='networkMode']",
    message:
      "Do not set networkMode on one read or save: the default of createQueryClient covers all of them (frontend-conventions.md §5).",
  },
  {
    // query-core 5.105 replaces the defaults here, so a call drops `networkMode: "always"`.
    selector: "CallExpression[callee.property.name='setDefaultOptions']",
    message:
      "Do not call setDefaultOptions: it replaces the defaults of createQueryClient (frontend-conventions.md §5).",
  },
];

// An aliased or namespace import of QueryClient would pass the `new QueryClient` selector.
const QUERY_CLIENT_IMPORT_RULE = {
  paths: [
    {
      name: "@tanstack/react-query",
      importNames: ["QueryClient"],
      allowTypeImports: true,
      message:
        "Make the query client with createQueryClient (lib/api/query-client.ts); import QueryClient only as a type (frontend-conventions.md §5).",
    },
  ],
};

// docs/testing.md §3, "Timed tests" (owner, 2026-11-18, q5 Q5 A): a test times work only with the
// helper of backend/test/timed.ts. One run timed with `performance.now` fails on a busy machine
// with nothing wrong. The rule reads the form `performance.now` only; it does not see another clock
// or an alias of `performance` (docs/plans/p3-timed-tests.md, "Not claimed"). It is another rule
// from `no-restricted-syntax`, so the "last block wins" note below does not apply to it.
const TIMED_BACKEND = [
  {
    object: "performance",
    property: "now",
    message:
      "Time work with fastestRun of backend/test/timed.ts, not one run with performance.now: one slow run on a busy machine fails the test (docs/testing.md §3, Timed tests).",
  },
];
const TIMED_OTHER = [
  {
    object: "performance",
    property: "now",
    message:
      "Timed tests use the helper of docs/testing.md; add a helper for this package first (docs/testing.md §3, Timed tests).",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      // Playwright writes its HTML report here on CI and in a local run with `CI=1`.
      "**/playwright-report/**",
      "frontend/src/lib/api/generated/**",
      "docs/**",
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
    // Plain scripts that run in the browser (the no-flash theme script).
    files: ["frontend/public/**/*.js"],
    languageOptions: { globals: globals.browser, sourceType: "script" },
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
      // frontend-conventions.md §1, "Object arguments". The calls that broke it before this rule
      // are listed in eslint-suppressions.json; fixing one and running
      // `eslint . --prune-suppressions` takes it off the list.
      "@typescript-eslint/max-params": ["error", { max: 2 }],
      "no-restricted-syntax": ["error", ...SQL_RULES],
      "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
      "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
  },
  // For one file, the last block that sets `no-restricted-syntax` wins, so each block below lists
  // every rule set that its files need. `scripts/lint-rules.test.ts` checks each file.
  {
    // Tests that check the library or one store make their own client; the app's code does not.
    // The store gets its rules from the blocks of features below, without the bot list rule.
    files: ["frontend/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "frontend/src/lib/api/query-client.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SQL_RULES,
        ...QUERY_CLIENT_RULES,
        ...BOT_LIST_WRITE_RULES,
      ],
      "@typescript-eslint/no-restricted-imports": ["error", QUERY_CLIENT_IMPORT_RULE],
    },
  },
  {
    files: ["frontend/src/lib/api/query-client.ts"],
    rules: { "no-restricted-syntax": ["error", ...SQL_RULES, ...BOT_LIST_WRITE_RULES] },
  },
  {
    files: [
      "frontend/src/components/**/*.test.{ts,tsx}",
      "frontend/src/features/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...SQL_RULES, ...RAW_COLOUR_RULES],
    },
  },
  {
    files: ["frontend/src/components/**/*.{ts,tsx}", "frontend/src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SQL_RULES,
        ...RAW_COLOUR_RULES,
        ...QUERY_CLIENT_RULES,
        ...CLOCK_RULES,
      ],
    },
  },
  {
    files: ["frontend/src/components/**/*.{ts,tsx}", "frontend/src/features/**/*.{ts,tsx}"],
    // Tests set the cache up before the store exists; the store itself writes it.
    ignores: ["**/*.test.{ts,tsx}", "frontend/src/features/bots/bot-list-store.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SQL_RULES,
        ...RAW_COLOUR_RULES,
        ...BOT_LIST_WRITE_RULES,
        ...QUERY_CLIENT_RULES,
        ...CLOCK_RULES,
      ],
    },
  },
  {
    files: ["backend/src/**/*.test.ts", "backend/test/**/*.ts", "scripts/**/*.test.ts"],
    ignores: ["backend/test/timed.ts"],
    rules: { "no-restricted-properties": ["error", ...TIMED_BACKEND] },
  },
  {
    // The frontend and shared packages may not import backend/, so they have no helper yet. A
    // test there that needs a timer adds one first; the rule has no exception for them.
    files: [
      "frontend/**/*.{test,spec}.{ts,tsx}",
      "frontend/test/**/*.{ts,tsx}",
      "shared/**/*.test.ts",
    ],
    rules: { "no-restricted-properties": ["error", ...TIMED_OTHER] },
  },
  {
    // The repository scripts are command-line tools: they print their results.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
