import { ESLint } from "eslint";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
// Never written to disk; eslint.config.js allows it as a default-project file.
const FILE = join(ROOT, "scripts/lint-sample.ts");

// One instance for every case: the first lint builds the TypeScript program, which is slow.
const eslint = new ESLint({ cwd: ROOT });
beforeAll(async () => {
  await eslint.lintText("export {};", { filePath: FILE });
}, 120_000);

async function ruleIds(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: FILE });
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

const PRELUDE = `
declare const db: { run(q: unknown): void; update(t: unknown): { set(v: unknown): { run(): void } }; delete(t: unknown): { run(): void } };
declare const sql: { raw(s: string): unknown };
declare const input: string;
declare const table: unknown;
`;

describe("SQL lint rules (security.md §2.8)", () => {
  it.each([
    ["sql.raw()", "sql.raw(input);", "no-restricted-syntax"],
    ["a string literal to db.run", 'db.run("DELETE FROM bots");', "no-restricted-syntax"],
    [
      "a template string to db.run",
      "db.run(`SELECT * FROM t WHERE x = ${input}`);",
      "no-restricted-syntax",
    ],
    ["string concatenation to db.run", 'db.run("SELECT " + input);', "no-restricted-syntax"],
    [
      "update without where",
      "db.update(table).set({}).run();",
      "drizzle/enforce-update-with-where",
    ],
    ["delete without where", "db.delete(table).run();", "drizzle/enforce-delete-with-where"],
  ])("rejects %s", async (_label, code, rule) => {
    expect(await ruleIds(`${PRELUDE}${code}`)).toContain(rule);
  });

  it("allows RegExp#exec and AsyncLocalStorage#run", async () => {
    const code = `declare const input: string;
declare const store: { run(value: boolean, fn: () => void): void };
/x/.exec(input);
store.run(true, () => undefined);`;
    expect(await ruleIds(code)).toEqual([]);
  });
});

describe("TypeScript lint rules (frontend-conventions.md §3)", () => {
  it.each([
    ["any", "export const x: any = 1;", "@typescript-eslint/no-explicit-any"],
    [
      "a type assertion",
      "export const x = (1 as unknown) as string;",
      "@typescript-eslint/consistent-type-assertions",
    ],
    [
      "a non-null assertion",
      "declare const m: Map<string, string>; export const x = m.get('a')!;",
      "@typescript-eslint/no-non-null-assertion",
    ],
    ["console", "console.log('x');", "no-console"],
  ])("rejects %s", async (_label, code, rule) => {
    expect(await ruleIds(code)).toContain(rule);
  });
});
