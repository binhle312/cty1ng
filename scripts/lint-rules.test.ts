import { resolve } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

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
