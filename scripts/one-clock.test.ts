import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// DQ-537. `design/components/time-format.md` §1 says that the frontend keeps one timer for all
// relative times. The timer belongs to a clock, so the app must make one clock: `createClock` is
// used in `lib/now.ts` for the declaration and for `appClock`, and nowhere else in the app's code.
// Tests make their own clocks (`now.test.ts`) and are not checked.
//
// The check sees the name `createClock`, not only a call. An alias (`import { createClock as c }`)
// or a re-export is a way to call the function, and a check on calls alone passes both. The name
// as a string (`n["createClock"]`, `Reflect.get(n, "createClock")`) counts too.

const ROOT = resolve(import.meta.dirname, "..");
const NOW_FILE = "frontend/src/lib/now.ts";
const CLOCK_NAME = "createClock";
const APP_CLOCK = "appClock";

interface ClockUses {
  // `path:line` of each use that the rule forbids.
  forbidden: string[];
  // The calls that the rule allows: the value of `appClock` in `lib/now.ts`.
  allowedCalls: number;
}

// A name is a use when it is an identifier (a declaration, a call, an import, an alias, a property,
// an export) or a string with that text (a key, an argument, a name in a specifier). A comment is
// not code and is not read.
function isClockName(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === CLOCK_NAME;
  return ts.isStringLiteralLike(node) && node.text === CLOCK_NAME;
}

// `lib/now.ts` owns two uses: the declaration, and the call that is the value of `appClock`.
function isDeclaration(node: ts.Node): boolean {
  return (
    ts.isIdentifier(node) && ts.isFunctionDeclaration(node.parent) && node.parent.name === node
  );
}
// The call must be the value of a top-level `const appClock`: a clock made in a function would be
// made again at each call.
function isAppClockCall(node: ts.Node): boolean {
  const call = node.parent;
  if (!ts.isCallExpression(call) || call.expression !== node) return false;
  const declaration = call.parent;
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== call) return false;
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== APP_CLOCK) return false;
  const list = declaration.parent;
  return (
    (list.flags & ts.NodeFlags.Const) !== 0 &&
    ts.isVariableStatement(list.parent) &&
    ts.isSourceFile(list.parent.parent)
  );
}

function clockNameUses(path: string, text: string): ClockUses {
  const result: ClockUses = { forbidden: [], allowedCalls: 0 };
  if (isTest(path)) return result;
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const visit = (node: ts.Node): void => {
    if (isClockName(node)) {
      if (path === NOW_FILE && isDeclaration(node)) {
        // The declaration is allowed and is not a call.
      } else if (path === NOW_FILE && isAppClockCall(node)) {
        result.allowedCalls += 1;
      } else {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        result.forbidden.push(`${path}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

describe("the checker for the one clock", () => {
  // Each case is a file that the app could get. The text of `now.ts` is the real shape.
  it.each([
    {
      label: "a second call in lib/now.ts",
      path: NOW_FILE,
      text: `export function createClock() { return 1; }\nexport const appClock = createClock();\nexport const other = createClock();\n`,
      lines: [3],
    },
    {
      label: "a call in lib/now.ts under another value name",
      path: NOW_FILE,
      text: `export function createClock() { return 1; }\nexport const appClock2 = createClock();\n`,
      lines: [2],
    },
    {
      label: "a call in a feature",
      path: "frontend/src/features/bots/bot-page.tsx",
      text: `import { createClock } from "../../lib/now.ts";\nexport const c = createClock();\n`,
      lines: [1, 2],
    },
    {
      label: "an aliased import",
      path: "frontend/src/lib/other.ts",
      text: `import { createClock as make } from "./now.ts";\nexport const c = make();\n`,
      lines: [1],
    },
    {
      label: "a property of a namespace import",
      path: "frontend/src/lib/other.ts",
      text: `import * as now from "./now.ts";\nexport const c = now.createClock();\n`,
      lines: [2],
    },
    {
      label: "a string key of a namespace import",
      path: "frontend/src/lib/other.ts",
      text: `import * as now from "./now.ts";\nexport const c = now["createClock"]();\n`,
      lines: [2],
    },
    {
      label: "a call under the name appClock inside a function in lib/now.ts",
      path: NOW_FILE,
      text: `export function createClock() { return 1; }\nexport function useNow() {\n  const appClock = createClock();\n  return appClock;\n}\n`,
      lines: [3],
    },
    {
      label: "a string key in a destructuring",
      path: "frontend/src/lib/other.ts",
      text: `import * as now from "./now.ts";\nexport const { "createClock": make } = now;\n`,
      lines: [2],
    },
    {
      label: "a computed key in a destructuring",
      path: "frontend/src/lib/other.ts",
      text: `import * as now from "./now.ts";\nexport const { ["createClock"]: make } = now;\n`,
      lines: [2],
    },
    {
      label: "a string name read with Reflect.get",
      path: "frontend/src/lib/other.ts",
      text: `import * as now from "./now.ts";\nexport const make = Reflect.get(now, "createClock");\n`,
      lines: [2],
    },
    {
      label: "a string name in an import specifier",
      path: "frontend/src/lib/other.ts",
      text: `import { "createClock" as make } from "./now.ts";\nexport const c = make();\n`,
      lines: [1],
    },
    {
      label: "a re-export",
      path: "frontend/src/lib/index.ts",
      text: `export { createClock } from "./now.ts";\n`,
      lines: [1],
    },
    {
      label: "the appClock call in another file than lib/now.ts",
      path: "frontend/src/lib/other.ts",
      text: `import { createClock } from "./now.ts";\nexport const appClock = createClock();\n`,
      lines: [1, 2],
    },
  ])("rejects $label", ({ path, text, lines }) => {
    expect(clockNameUses(path, text).forbidden, "forbidden uses").toEqual(
      lines.map((line) => `${path}:${line}`),
    );
  });

  it("allows the real shape of lib/now.ts", () => {
    const text = `export function createClock() { return 1; }\nexport const appClock = createClock();\n`;
    expect(clockNameUses(NOW_FILE, text).forbidden, "forbidden uses").toEqual([]);
  });

  it("counts the appClock call of lib/now.ts as the one allowed call", () => {
    const text = `export function createClock() { return 1; }\nexport const appClock = createClock({ tickMs: 1 });\n`;
    expect(clockNameUses(NOW_FILE, text).allowedCalls, "allowed calls").toBe(1);
  });

  it.each([
    { label: "a .test.ts file", path: "frontend/src/lib/other.test.ts" },
    { label: "a .test.tsx file", path: "frontend/src/features/bots/other.test.tsx" },
  ])("allows a call in $label", ({ path }) => {
    const text = `import { createClock } from "../now.ts";\nexport const c = createClock();\n`;
    expect(clockNameUses(path, text).forbidden, "forbidden uses").toEqual([]);
  });

  it("allows a comment that names createClock", () => {
    const text = `// createClock makes a clock.\n/* createClock */\nexport const x = 1;\n`;
    expect(clockNameUses("frontend/src/lib/other.ts", text).forbidden, "forbidden uses").toEqual(
      [],
    );
  });
});

describe("the app's code", () => {
  const files = globSync("frontend/src/**/*.{ts,tsx}", { cwd: ROOT }).filter(
    (file) => !file.includes("/lib/api/generated/") && !isTest(file),
  );
  const uses = files.map((file) => clockNameUses(file, readFileSync(resolve(ROOT, file), "utf8")));

  // Guard: a wrong glob would read nothing and pass. The app has far more than 100 such files.
  it("finds the files", () => {
    expect(files.length, "files read").toBeGreaterThan(100);
  });

  // Guard: a renamed `appClock` would leave no allowed call and pass the next test as well.
  it("has the appClock call in lib/now.ts", () => {
    expect(
      uses.reduce((sum, use) => sum + use.allowedCalls, 0),
      "allowed calls",
    ).toBe(1);
  });

  it("makes one clock", () => {
    expect(
      uses.flatMap((use) => use.forbidden),
      `uses of ${CLOCK_NAME} that ${APP_CLOCK} in ${NOW_FILE} does not own`,
    ).toEqual([]);
  });
});
