import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BreakList, type Claim, lineOf } from "./breaks.ts";
import { compileProblems, prProblems } from "./breaks-static.ts";

// The static rules of a break list (testing.md §5): what `pnpm check:breaks` refuses before it
// runs a test, and the compile check of each break that `pnpm check:breaks:static` adds.

const TEST = "app/a.test.ts";
const CODE = "app/a.ts";
const NEW_TEST = "app/b.test.ts";
const files: Record<string, string> = {
  [TEST]: [
    'it("adds", () => {',
    "  const x = add(1, 2);",
    "  expect(x).toBe(3);",
    "});",
    'it("adds again", () => {',
    "  expect(add(2, 2)).toBe(4);",
    "});",
    "",
  ].join("\n"),
  [CODE]: "export const add = (a, b) => a + b;\n",
  [NEW_TEST]: 'it("subtracts", () => {\n  expect(1 - 1).toBe(0);\n});\n',
};
const read = (path: string) => files[path] ?? null;

function claim(more: Partial<Claim> = {}): Claim {
  return {
    id: "C1",
    claim: "add adds",
    test: { kind: "vitest", file: TEST, name: "adds" },
    assertion: "expect(x).toBe(3);",
    breaks: [{ id: "C1-a", file: CODE, edits: [{ find: "a + b", replace: "a - b" }] }],
    ...more,
  };
}

function problems(at: {
  claims: Claim[];
  exempt?: BreakList["exempt"];
  changed?: Record<string, number[]>;
  newFiles?: string[];
  complete?: boolean;
  read?: (path: string) => string | null;
}): string[] {
  const list: BreakList = { claims: at.claims, exempt: at.exempt ?? [] };
  const changed = new Map(
    Object.entries(at.changed ?? {}).map(([file, lines]) => [file, new Set(lines)]),
  );
  return prProblems({
    list,
    claims: list.claims,
    complete: at.complete ?? true,
    changed,
    newFiles: at.newFiles ?? [],
    read: at.read ?? read,
  });
}

describe("prProblems", () => {
  it("accepts a list that links each changed test to a claim", () => {
    expect(problems({ claims: [claim()], changed: { [TEST]: [2], [CODE]: [1] } })).toEqual([]);
  });

  it("refuses an assertion that the test file has two times (DQ-517)", () => {
    const twice = (path: string) =>
      path === TEST
        ? `${files[TEST] ?? ""}it("adds once more", () => {\n  expect(x).toBe(3);\n});\n`
        : read(path);
    expect(problems({ claims: [claim()], read: twice })).toEqual([
      "C1: the assertion is found more than once",
    ]);
  });

  it("refuses a test that the PR changes when no claim and no exemption names it (DQ-515)", () => {
    expect(problems({ claims: [claim()], changed: { [TEST]: [6] } })).toEqual([
      `${TEST}:5: the test "adds again" has no claim`,
    ]);
  });

  it("refuses an assertion outside its named test (DQ-515)", () => {
    const other = claim({ test: { kind: "vitest", file: TEST, name: "adds again" } });
    expect(problems({ claims: [other] })).toEqual([
      "C1: the assertion is not inside the named test",
    ]);
  });

  it("counts each test of a new test file, and no test whose lines the PR did not touch", () => {
    expect(problems({ claims: [claim()], changed: { [TEST]: [2] }, newFiles: [NEW_TEST] })).toEqual(
      [`${NEW_TEST}:1: the test "subtracts" has no claim`],
    );
  });

  it("takes an exemption in place of a claim", () => {
    const exempt = [{ file: TEST, name: "adds again", reason: "test first, red run in the PR" }];
    expect(problems({ claims: [claim()], exempt, changed: { [TEST]: [6] } })).toEqual([]);
  });

  it("checks only the given claims and no coverage for a part of the list (`--only`)", () => {
    const list: BreakList = { claims: [claim(), claim({ id: "C2", breaks: [] })], exempt: [] };
    expect(
      prProblems({
        list,
        claims: list.claims.filter((one) => one.id === "C1"),
        complete: false,
        changed: new Map([[TEST, new Set([6])]]),
        newFiles: [],
        read,
      }),
    ).toEqual([]);
  });
});

describe("compileProblems", () => {
  let root = "";
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const readRoot = (path: string) => {
    try {
      return readFileSync(join(root, path), "utf8");
    } catch {
      return null;
    }
  };
  const breakOf = ({
    file,
    find,
    replace,
  }: {
    file: string;
    find: string;
    replace: string;
  }): Claim => claim({ breaks: [{ id: "C1-a", file, edits: [{ find, replace }] }] });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "breaks-static-"));
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          noUnusedLocals: true,
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          types: [],
        },
        include: ["app/**/*.ts"],
      }),
    );
    write("app/a.ts", "export const add = (a: number, b: number): number => a + b;\n");
    write("app/data.json", '{ "a": 1 }\n');
    write("other/c.ts", "export const c = 1;\n");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("accepts a break that compiles, also with a variable that it leaves unused", () => {
    const claims = [
      breakOf({
        file: "app/a.ts",
        find: "=> a + b;",
        replace: "=> { const left = a; return b; };",
      }),
    ];
    expect(compileProblems({ claims, root, read: readRoot })).toEqual([]);
  });

  it("gives the TypeScript error of a break that does not compile (DQ-439, DQ-448)", () => {
    const claims = [breakOf({ file: "app/a.ts", find: "a + b", replace: "a.size" })];
    const found = compileProblems({ claims, root, read: readRoot });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^C1-a: the break does not compile: app\/a\.ts:1 TS2339 /);
  });

  it("refuses a break of a TypeScript file that no project compiles", () => {
    const claims = [breakOf({ file: "other/c.ts", find: "1", replace: "2" })];
    expect(compileProblems({ claims, root, read: readRoot })).toEqual([
      "C1-a: no TypeScript project compiles other/c.ts",
    ]);
  });

  it("does not compile a break of a file that is not TypeScript", () => {
    const claims = [breakOf({ file: "app/data.json", find: "1", replace: "2" })];
    expect(compileProblems({ claims, root, read: readRoot })).toEqual([]);
  });

  it("compiles a broken file in each project of its package, also when only the second one reads it", () => {
    const options = { strict: true, noEmit: true, target: "ES2022", types: [] };
    write(
      "tsconfig.json",
      JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.one.json" }, { path: "./tsconfig.two.json" }],
      }),
    );
    write("tsconfig.one.json", JSON.stringify({ compilerOptions: options, include: ["app/a.ts"] }));
    write(
      "tsconfig.two.json",
      JSON.stringify({ compilerOptions: options, include: ["other/c.ts"] }),
    );
    const claims = [breakOf({ file: "other/c.ts", find: "1", replace: "2" })];
    const second = compileProblems({ claims, root, read: readRoot });
    expect(second).toEqual([]);
  });

  it("puts back the text of a broken file before the next break", () => {
    write("app/b.ts", 'import { add } from "./a";\nexport const two = add(1, 1);\n');
    const rename = breakOf({
      file: "app/a.ts",
      find: "export const add",
      replace: "export const plus",
    });
    const call: Claim = {
      ...claim({ id: "C2" }),
      breaks: [
        { id: "C2-a", file: "app/b.ts", edits: [{ find: "add(1, 1)", replace: "add(1, 2)" }] },
      ],
    };
    const restored = compileProblems({ claims: [rename, call], root, read: readRoot });
    expect(restored).toEqual([]);
  });

  it("reads the packages that pnpm links, with no false errors on code that the break keeps", () => {
    // A small copy of the layout of pnpm. The real case: without the real path of each link,
    // `frontend/src/features/skills/skill-page.tsx:76` gets TS7006, because the query library
    // that a linked package imports does not resolve. Here `a` is a link into the store, and
    // `b`, which `a` imports, is found only from the real folder of `a`. If `b` does not
    // resolve, `each` is `any`, and the kept code gets the same false error. The real frontend
    // made this test take about 4 s alone, and over 20 s in the full suite.
    const store = "node_modules/.pnpm";
    const pack = (name: string, types: string) => {
      const folder = `${store}/${name}@1.0.0/node_modules/${name}`;
      write(
        `${folder}/package.json`,
        JSON.stringify({ name, version: "1.0.0", types: "index.d.ts" }),
      );
      write(`${folder}/index.d.ts`, types);
    };
    pack("a", 'export { each } from "b";\n');
    pack("b", "export declare function each(f: (item: { size: number }) => void): void;\n");
    const linkOfB = join(root, `${store}/a@1.0.0/node_modules/b`);
    symlinkSync("../../b@1.0.0/node_modules/b", linkOfB, "dir");
    symlinkSync(".pnpm/a@1.0.0/node_modules/a", join(root, "node_modules/a"), "dir");
    const kept = "each((item) => item.size);";
    write("app/use.ts", `import { each } from "a";\n${kept}\n`);
    // The edit must apply, or the break is not compiled at all (DQ-613).
    expect(lineOf(readRoot("app/use.ts") ?? "", kept)).toBe(2);
    const claims = [breakOf({ file: "app/use.ts", find: kept, replace: kept })];
    expect(compileProblems({ claims, root, read: readRoot })).toEqual([]);
    // The layout needs `b`: without its link, the same break gets the false error.
    rmSync(linkOfB);
    expect(compileProblems({ claims, root, read: readRoot })).toEqual([
      "C1-a: the break does not compile: app/use.ts:2 TS7006 Parameter 'item' implicitly has an 'any' type.",
    ]);
  });
});
