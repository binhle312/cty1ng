import { globSync } from "node:fs";
import { resolve } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Lints small snippets with the real eslint.config.js: the SQL rules (security.md §2.8) and
// the raw colour rules (design/themes.md §2). Type-aware rules are switched off here only, so
// snippets need not be files of a TypeScript project.
const eslint = new ESLint({
  cwd: resolve(import.meta.dirname, ".."),
  overrideConfig: tseslint.configs.disableTypeChecked,
});

async function messages(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? "?"}: ${m.message}`);
}

const DB_FILE = "backend/src/adapters/db/repo.ts";
const UI_FILE = "frontend/src/components/ui/button.tsx";

describe("SQL lint rules", () => {
  it.each([
    ["sql.raw()", "sql.raw(`DELETE FROM bots WHERE id = ${id}`);"],
    ["db.run with a string", 'db.run("DELETE FROM bots");'],
    ["db.execute with a template string", "db.execute(`SELECT * FROM bots WHERE id = '${id}'`);"],
    ["db.run with string concatenation", 'db.run("SELECT * FROM bots WHERE id = " + id);'],
    ["tx.all with a string", 'tx.all("SELECT * FROM bots");'],
    ["this.db.get with a string", 'repo.db.get("SELECT * FROM bots");'],
  ])("reject %s", async (_label, statement) => {
    const found = await messages(
      `declare const sql: any, db: any, tx: any, repo: any, id: string;\n${statement}\n`,
      DB_FILE,
    );
    expect(found.some((m) => m.startsWith("no-restricted-syntax"))).toBe(true);
  });

  it("allows the sql`` tagged template", async () => {
    const found = await messages(
      "declare const sql: any, db: any, id: string;\ndb.run(sql`SELECT ${id}`);\n",
      DB_FILE,
    );
    expect(found.filter((m) => m.startsWith("no-restricted-syntax"))).toEqual([]);
  });

  // Review of PR #46: the rule matched method names on any object.
  it.each([
    ["Map.get with a string key", 'new Map<string, number>().get("key");'],
    ["URLSearchParams.get", 'new URLSearchParams("a=1").get("a");'],
    ["a cache's run method", 'cache.run("job");'],
  ])("does not flag %s", async (_label, statement) => {
    const found = await messages(`declare const cache: any;\n${statement}\n`, DB_FILE);
    expect(found.filter((m) => m.startsWith("no-restricted-syntax"))).toEqual([]);
  });
});

// Item 74 of the P3 list: the forms that the first SQL rules did not see. Each case has its own
// assertion line, so a break of one selector fails only its own test (scripts/breaks/).
describe("SQL lint rules: the wider forms", () => {
  const isSqlRule = (m: string) => m.startsWith("no-restricted-syntax");

  it("rejects sql.raw() on a namespace import", async () => {
    const namespaceRaw = await messages(
      'import * as orm from "drizzle-orm";\ndeclare const id: string;\norm.sql.raw(id);\n',
      DB_FILE,
    );
    expect(namespaceRaw.some(isSqlRule)).toBe(true);
  });

  it("rejects an import of sql under another name", async () => {
    const renamedSql = await messages(
      'import { sql as s } from "drizzle-orm";\ndeclare const id: string;\ns.raw(id);\n',
      DB_FILE,
    );
    expect(renamedSql.some(isSqlRule)).toBe(true);
  });

  it("rejects db.run with a string in a variable", async () => {
    const variableArgument = await messages(
      "declare const db: any, query: string;\ndb.run(query);\n",
      DB_FILE,
    );
    expect(variableArgument.some(isSqlRule)).toBe(true);
  });

  it("rejects tx.all with the result of a call", async () => {
    const callArgument = await messages(
      "declare const tx: any, build: () => string;\ntx.all(build());\n",
      DB_FILE,
    );
    expect(callArgument.some(isSqlRule)).toBe(true);
  });

  it.each([
    [
      "the sql`` tagged template on this.db",
      "declare const sql: any, repo: any;\nrepo.db.get(sql`SELECT 1`);\n",
    ],
    [
      "a Map key from a template",
      "declare const k: string;\nnew Map<string, number>().get(`${k}:x`);\n",
    ],
    [
      "sql imported under its own name",
      'import { sql } from "drizzle-orm";\nexport const one = sql`SELECT 1`;\n',
    ],
    // Review round 1 of #120 (R1-3): the tagged template of a namespace import.
    [
      "db.run with orm.sql``",
      'import * as orm from "drizzle-orm";\ndeclare const db: any;\ndb.run(orm.sql`SELECT 1`);\n',
    ],
  ])("allows %s", async (_label, code) => {
    const found = await messages(code, DB_FILE);
    expect(found.filter(isSqlRule)).toEqual([]);
  });
});

describe("raw colour lint rules", () => {
  it.each([
    ["a hex colour", 'export const c = "#F5B544";'],
    ["an arbitrary Tailwind value", 'export const c = "rounded bg-[#0E0F11] p-2";'],
    ["an arbitrary size", "export const c = `h-[37px] ${'x'}`;"],
  ])("reject %s in components", async (_label, code) => {
    const found = await messages(code, UI_FILE);
    expect(found.some((m) => m.startsWith("no-restricted-syntax"))).toBe(true);
  });

  it("allows semantic token classes", async () => {
    expect(
      await messages('export const c = "bg-surface text-on-surface rounded-control";', UI_FILE),
    ).toEqual([]);
  });

  it("does not apply outside components and features", async () => {
    expect(await messages('export const c = "#F5B544";', "frontend/src/themes/command.ts")).toEqual(
      [],
    );
  });
});

// frontend-conventions.md §5 (DQ-088): the app's code makes no query client of its own, sets
// no `networkMode` on one read or save, and does not replace the defaults.
describe("query client lint rules", () => {
  const client =
    'import { QueryClient } from "@tanstack/react-query";\nexport const c = new QueryClient();\n';
  const mode =
    'import { useQuery } from "@tanstack/react-query";\nexport const useX = () => useQuery({ queryKey: ["x"], queryFn: () => 1, networkMode: "online" });\n';

  it.each([
    { label: "a new QueryClient in main.tsx", code: client, file: "frontend/src/main.tsx" },
    {
      label: "a new QueryClient in a feature",
      code: client,
      file: "frontend/src/features/bots/bot-page.tsx",
    },
    {
      label: "networkMode on one read in a feature",
      code: mode,
      file: "frontend/src/features/skills/skill-page.tsx",
    },
    { label: "networkMode in lib", code: mode, file: "frontend/src/lib/api/bots.ts" },
    {
      label: "a networkMode set by assignment",
      code: 'declare const o: { networkMode?: string };\no.networkMode = "online";\n',
      file: "frontend/src/features/bots/bot-list-store.ts",
    },
    {
      label: "setDefaultOptions in the bot list store",
      code: "declare const c: { setDefaultOptions(x: object): void };\nc.setDefaultOptions({});\n",
      file: "frontend/src/features/bots/bot-list-store.ts",
    },
  ])("reject $label", async ({ code, file }) => {
    const found = await messages(code, file);
    expect(found.some((m) => m.startsWith("no-restricted-syntax"))).toBe(true);
  });

  it.each([
    {
      label: "createQueryClient itself",
      code: client,
      file: "frontend/src/lib/api/query-client.ts",
    },
    {
      label: "a test that checks one store",
      code: client,
      file: "frontend/src/features/bots/bot-list-store.test.tsx",
    },
  ])("allows $label", async ({ code, file }) => {
    const found = await messages(code, file);
    expect(found.filter((m) => m.startsWith("no-restricted-syntax"))).toEqual([]);
  });
});

// time-format.md §1: a relative time updates while the page is visible, so a component asks
// useNow() (lib/now.ts) for the time and does not read the clock in a render.
describe("clock lint rule", () => {
  const isClockRule = (m: string) => m.includes("useNow");
  const now = "export const t = new Date();\n";

  it.each([
    { label: "a component", file: "frontend/src/components/ui/time-text.tsx" },
    { label: "a feature", file: "frontend/src/features/bots/bot-page-top.tsx" },
    { label: "the bot list store", file: "frontend/src/features/bots/bot-list-store.ts" },
  ])("rejects new Date() with no argument in $label", async ({ file }) => {
    const found = await messages(now, file);
    expect(found.filter(isClockRule), "messages about useNow").toHaveLength(1);
  });

  it.each([
    { label: "a date from a text", code: 'export const t = new Date("2026-11-15");\n' },
    { label: "a date from a number", code: "export const t = new Date(0);\n" },
  ])("allows $label in a feature", async ({ code }) => {
    const found = await messages(code, "frontend/src/features/bots/bot-page-top.tsx");
    expect(found.filter(isClockRule), "messages about useNow").toEqual([]);
  });

  it("allows new Date() in lib, where the clock is", async () => {
    const found = await messages(now, "frontend/src/lib/now.ts");
    expect(found.filter(isClockRule), "messages about useNow in lib").toEqual([]);
  });

  it("allows new Date() in a test", async () => {
    const found = await messages(now, "frontend/src/features/bots/bot-page.test.tsx");
    expect(found.filter(isClockRule), "messages about useNow in a test").toEqual([]);
  });

  // Not claimed: the rule does not see Date.now() (the plan of PR 17 says so).
  it("does not see Date.now()", async () => {
    const found = await messages(
      "export const t = Date.now();\n",
      "frontend/src/features/bots/bot-page-top.tsx",
    );
    expect(found.filter(isClockRule), "messages about useNow for Date.now()").toEqual([]);
  });
});

// For one file, the last block that sets `no-restricted-syntax` wins, so a block can drop the
// rules of an earlier one (review of `78d01fb`: `bot-list-store.ts` lost the query client rules).
// This reads the real config of each file.
describe("each file gets its rule sets", () => {
  const ROOT = resolve(import.meta.dirname, "..");
  const config = z.object({ rules: z.record(z.string(), z.array(z.unknown())) });
  const selectorsOf = async (file: string): Promise<string> => {
    const { rules } = config.parse(await eslint.calculateConfigForFile(file));
    return JSON.stringify(rules["no-restricted-syntax"] ?? []);
  };
  const files = globSync("frontend/src/**/*.{ts,tsx}", { cwd: ROOT }).filter(
    (file) => !file.includes("/lib/api/generated/"),
  );
  const isTest = (file: string) => /\.test\.tsx?$/.test(file);
  const inUi = (file: string) => /^frontend\/src\/(components|features)\//.test(file);

  it("finds the files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("gives the query client rules to every app file", async () => {
    const missing: string[] = [];
    for (const file of files.filter((f) => !isTest(f) && !f.endsWith("lib/api/query-client.ts"))) {
      const found = await selectorsOf(file);
      const imports = config.parse(await eslint.calculateConfigForFile(file)).rules[
        "@typescript-eslint/no-restricted-imports"
      ];
      // The selectors themselves, not words that the messages also contain.
      for (const part of [
        "NewExpression[callee.name='QueryClient']",
        "Property[key.name='networkMode']",
        "CallExpression[callee.property.name='setDefaultOptions']",
      ]) {
        if (!found.includes(part)) missing.push(`${file}: ${part}`);
      }
      if (!JSON.stringify(imports ?? []).includes("QueryClient")) missing.push(`${file}: import`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps the raw colour rules on every components and features file", async () => {
    const missing: string[] = [];
    for (const file of files.filter(inUi)) {
      if (!(await selectorsOf(file)).includes("No raw colours")) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it("keeps the clock rule on every components and features file", async () => {
    const missing: string[] = [];
    for (const file of files.filter((f) => inUi(f) && !isTest(f))) {
      if (!(await selectorsOf(file)).includes("useNow")) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it("keeps the bot list write rule on every app file but the store", async () => {
    const missing: string[] = [];
    for (const file of files.filter(
      (f) => !isTest(f) && !f.endsWith("features/bots/bot-list-store.ts"),
    )) {
      if (!(await selectorsOf(file)).includes("(listBots|getSettings)(QueryKey|Options)")) {
        missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });
});

// frontend-conventions.md §1: only the bot list store writes the bot list and the settings.
describe("bot list write rule", () => {
  const isBotListRule = (m: string) => m.includes("bot-list-store.ts");

  it.each([
    {
      label: "setQueriesData with the key in its filters",
      code: "declare const qc: any;\nqc.setQueriesData({ queryKey: listBotsQueryKey() }, []);\n",
      file: "frontend/src/features/bots/bot-page.tsx",
    },
    {
      label: "setQueryData with the key of the generated options",
      code: "declare const qc: any;\nqc.setQueryData(getSettingsOptions().queryKey, {});\n",
      file: "frontend/src/features/skills/skill-page.tsx",
    },
    {
      label: "setQueryData with a copy of the key",
      code: "declare const qc: any;\nqc.setQueryData([...listBotsQueryKey()], []);\n",
      file: "frontend/src/features/bots/bot-page.tsx",
    },
    {
      label: "a write in lib",
      code: "declare const qc: any;\nqc.setQueryData(listBotsQueryKey(), []);\n",
      file: "frontend/src/lib/realtime/reducer.ts",
    },
    {
      label: "a write in routes",
      code: "declare const qc: any;\nqc.setQueryData(listBotsQueryKey(), []);\n",
      file: "frontend/src/routes/bots.tsx",
    },
  ])("rejects $label", async ({ code, file }) => {
    const found = await messages(
      `declare const listBotsQueryKey: any, getSettingsOptions: any;\n${code}`,
      file,
    );
    expect(found.some(isBotListRule)).toBe(true);
  });

  // Review round 1 of #120 (R1-6): a write of another key whose updater reads the bot list.
  it("allows a write of another key that reads the bot list", async () => {
    const found = await messages(
      "declare const qc: any, listBotsQueryKey: any, getBotQueryKey: any;\nqc.setQueryData(getBotQueryKey(), () => qc.getQueryData(listBotsQueryKey()));\n",
      "frontend/src/features/skills/skill-page.tsx",
    );
    expect(found.filter(isBotListRule)).toEqual([]);
  });

  it("allows a read of the bot list", async () => {
    const found = await messages(
      "declare const qc: any, listBotsQueryKey: any;\nqc.getQueryData(listBotsQueryKey());\n",
      "frontend/src/features/bots/bot-page.tsx",
    );
    expect(found.filter(isBotListRule)).toEqual([]);
  });
});

describe("query client import rule", () => {
  it.each([
    {
      label: "an aliased import",
      code: 'import { QueryClient as QC } from "@tanstack/react-query";\nexport const c = new QC();\n',
    },
    {
      label: "a namespace import",
      code: 'import * as RQ from "@tanstack/react-query";\nexport const c = new RQ.QueryClient();\n',
    },
  ])("reject $label", async ({ code }) => {
    const found = await messages(code, "frontend/src/routes/route-tree.ts");
    expect(found.some((m) => m.startsWith("@typescript-eslint/no-restricted-imports"))).toBe(true);
  });

  it("allows a type import", async () => {
    const found = await messages(
      'import type { QueryClient } from "@tanstack/react-query";\nexport type C = QueryClient;\n',
      "frontend/src/lib/realtime/start.ts",
    );
    expect(found.filter((m) => m.includes("no-restricted-imports"))).toEqual([]);
  });
});
