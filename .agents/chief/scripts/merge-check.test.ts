// The merge check (`pnpm merge:check <PR>`): the list file, the pure classify step and the CLI end
// to end (option A: one snapshot, the git diff at its commit ids, an allowlist for memory PRs;
// owner, 2026-11-20, orders 128 and 130). The snapshot reader and the diff reader have their own
// tests in lib/. All data is synthetic.
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CiCheck,
  type ContentRead,
  type MergeInput,
  type PrFile,
  type ReadResult,
  type Reader,
  classify,
  classifyWith,
  isControl,
  memoryTextProblems,
} from "./lib/merge-check.ts";
import { answer, greenNodes } from "./lib/merge-check-fixtures.ts";
import {
  CI_APP_ID,
  CI_WORKFLOW,
  MEMORY_PATH,
  MERGE_LIST,
  PACKAGE_FIELDS,
  REQUIRED_CHECKS,
  listSentence,
  listedItem,
  matchesPath,
} from "./lib/merge-list.ts";

const HEAD = "1a2b3c4d5e6f708192a3b4c5d6e7f80912345678";
const REPO = "owner-login/cty-test";
const MERGE_LINE = `gh pr merge https://github.com/${REPO}/pull/152 --merge --match-head-commit ${HEAD}`;
const ciRun = (name: string, extra: Partial<Extract<CiCheck, { kind: "run" }>> = {}): CiCheck => ({
  kind: "run",
  id: 1,
  name,
  state: "pass",
  appId: CI_APP_ID,
  workflowPath: CI_WORKFLOW,
  ...extra,
});
const GREEN: CiCheck[] = REQUIRED_CHECKS.map((name, i) => ciRun(name, { id: 100 + i }));
const RECORD = ['## Order 120 (2026-11-20 09:00)\nExact text: "you may merge each docs PR"\n'];
const RULES = ".agents/chief/memories/long-term/rules/";
const RULE_PATH = `${RULES}R-040-docs-merges.md`;

function ruleText(quote: string, rule = "Merge each docs PR."): string {
  return `---\nid: R-040\n---\nRule: ${rule}\nOwner said: "${quote}" (2026-11-20)\nHow to apply:\n`;
}
const permission = (text: string, field = "permission-rule: true"): string =>
  text.replace("id: R-040\n", `id: R-040\n${field}\n`);

function file(path: string, extra: Partial<PrFile> = {}): PrFile {
  return {
    path,
    status: "M",
    oldMode: "100644",
    newMode: "100644",
    liveChanged: false,
    supported: true,
    ...extra,
  };
}

function input(files: PrFile[], extra: Partial<MergeInput> = {}): MergeInput {
  return {
    repo: REPO,
    number: 152,
    state: "OPEN",
    head: HEAD,
    files,
    checks: GREEN,
    record: RECORD,
    privateWords: ["zz-private-zz"],
    minQuoteWords: 4,
    baseRef: "main",
    crossRepository: false,
    author: "owner-login",
    expectedAuthor: "owner-login",
    ...extra,
  };
}

const LT = ".agents/chief/memories/long-term/";
const NOTE = `${LT}notes.md`;
const TEXTS = { baseText: "# a\n", headText: "# b\n" };
const memory = (path: string, headText = "# A note\n"): PrFile =>
  file(`.agents/chief/memories/long-term/${path}`, { headText, baseText: "# Old\n" });
const added = (path: string, headText: string): PrFile =>
  file(path, { status: "A", oldMode: "000000", headText });
const deleted = (path: string, baseText: string): PrFile =>
  file(path, { status: "D", newMode: "000000", baseText });

describe("the list file", () => {
  // One case for each path rule of each item: [item text, a path that the rule matches].
  const CASES: [string, string][] = [
    ["`AGENTS.md`", "AGENTS.md"],
    ["`AGENTS.md`", "CLAUDE.md"],
    ["`docs/decisions/`", "docs/decisions/D60-x.md"],
    ["the public API shape", "frontend/src/lib/api/generated/client.ts"],
    ["security-sensitive code", "backend/src/adapters/workspace/resolve.ts"],
    ["security-sensitive code", "backend/src/adapters/http/app.ts"],
    ["security-sensitive code", "backend/src/adapters/log/logger.ts"],
    ["security-sensitive code", "backend/src/adapters/avatars/store.ts"],
    ["security-sensitive code", "backend/src/core/guard/sensitive-data.rules.ts"],
    ["security-sensitive code", "backend/src/app/config.ts"],
    ["security-sensitive code", "frontend/src/components/ui/markdown.tsx"],
    ["security-sensitive code", ".env.example"],
    ["security-sensitive code", ".github/workflows/ci.yml"],
    ["security-sensitive code", "backend/src/core/bots/bot.rules.ts"],
    ["security-sensitive code", "backend/src/core/skills/skill.rules.ts"],
    ["security-sensitive code", "backend/src/core/skills/skill-import.service.ts"],
    ["security-sensitive code", "backend/src/core/bots/avatars.service.ts"],
    ["security-sensitive code", "backend/src/app/compose.ts"],
    ["security-sensitive code", "backend/src/app/main.ts"],
    ["security-sensitive code", "frontend/vite.config.ts"],
    ["security-sensitive code", ".gitignore"],
    ["security-sensitive code", "backend/src/adapters/model/gemini.ts"],
    ["a migration", "backend/migrations/0009_x.sql"],
    ["a dependency", "pnpm-lock.yaml"],
    ["a dependency", "pnpm-workspace.yaml"],
    ["a dependency", ".npmrc"],
    ["the memory check", ".agents/chief/scripts/check-memory.ts"],
    ["the memory check", ".agents/chief/scripts/lib/check-memory-local.ts"],
    ["the memory check", ".agents/chief/scripts/lib/owner-quotes.ts"],
    ["the memory check", "scripts/lib/report.ts"],
    ["security-sensitive code", ".claude/settings.json"],
    ["security-sensitive code", "shared/src/catalog.ts"],
    ["security-sensitive code", "backend/src/core/ports/avatar-files.ts"],
    [
      "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
      ".agents/chief/scripts/lib/merge-list.ts",
    ],
    [
      "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
      ".agents/chief/scripts/merge-check.ts",
    ],
    [
      "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
      ".agents/chief/scripts/lib/merge-check-snapshot.ts",
    ],
    [
      "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
      "scripts/lib/check-status.ts",
    ],
    [
      "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
      "docs/workflows/merge-bar.md",
    ],
  ];

  it.each(CASES)("lists case %# as %s", (text, path) => {
    expect(listedItem(path)?.text, path).toBe(text);
  });

  it("has a case for each path rule of each item", () => {
    for (const item of MERGE_LIST) {
      for (const rule of item.paths) {
        const covered = CASES.some(([text, path]) => text === item.text && matchesPath(rule, path));
        expect(covered, `${item.text}: ${rule}`).toBe(true);
      }
    }
  });

  it("matches dotfiles", () => {
    expect(listedItem("backend/src/adapters/workspace/.env")?.text, "workspace/.env").toBe(
      "security-sensitive code",
    );
    expect(listedItem("docs/decisions/.x/a.md")?.text, "decisions/.x").toBe("`docs/decisions/`");
  });

  it("does not match a longer folder name or a file of the same name elsewhere", () => {
    for (const path of [
      "docs/decisions-old/x.md",
      "backend/src/adapters/workspaceX/a.ts",
      "docs/AGENTS.md",
      "frontend/src/components/ui/sub/markdown.tsx",
      "frontend/src/components/ui/markdown-icons/star.svg",
      "docs/status.md",
    ]) {
      expect(listedItem(path), path).toBeUndefined();
    }
  });

  it("joins the item texts as the AGENTS.md sentence does", () => {
    const three = ["`AGENTS.md`", "`docs/decisions/`", "a migration"];
    const items = MERGE_LIST.filter((item) => three.includes(item.text));
    expect(listSentence(items), "three items").toBe(
      "`AGENTS.md`, `docs/decisions/`, or a migration",
    );
  });
});

describe("classify: a code PR", () => {
  it("prints the merge line when no path is listed", () => {
    const result = classify(input([file("docs/status.md"), file("frontend/src/pages/home.tsx")]));
    expect(result.exit, "exit").toBe(0);
    expect(result.lines, "lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 2 files`,
      "Question 4: no by path. Read the Not-checked items. Question 5: merge only if a standing permission covers it, at the merge bar (R-002 path 2).",
      ...MERGE_LIST.filter((item) => item.notByPath !== undefined).map(
        (item) => `Not checked (${item.text}): ${item.notByPath ?? ""}`,
      ),
      MERGE_LINE,
    ]);
  });

  it("lists a security path and prints no merge line", () => {
    const result = classify(input([file("backend/src/adapters/workspace/resolve.ts")]));
    expect(result.exit, "exit").toBe(1);
    expect(result.lines, "lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 1 files`,
      "LISTED backend/src/adapters/workspace/resolve.ts: security-sensitive code",
      "Question 4: yes. No standing permission covers it (AGENTS.md §7): only the owner's own request (question 3, path 1) covers it.",
    ]);
  });

  it("lists a move out of and into docs/decisions/ as a delete and an add", () => {
    const out = [deleted("docs/decisions/D1.md", "x\n"), added("docs/old/D1.md", "x\n")];
    const into = [deleted("docs/x/D2.md", "x\n"), added("docs/decisions/D2.md", "x\n")];
    expect(classify(input(out)).exit, "moved out").toBe(1);
    expect(classify(input(into)).exit, "moved in").toBe(1);
  });

  it("lists an added and a deleted migration", () => {
    expect(classify(input([added("backend/migrations/0010_a.sql", "")])).exit, "added").toBe(1);
    expect(classify(input([deleted("backend/migrations/0009_b.sql", "")])).exit, "deleted").toBe(1);
  });
});

describe("classify: package.json", () => {
  const pkg = (fields: object): string => JSON.stringify({ name: "x", ...fields });
  const changed = (base: object, head: object): PrFile =>
    file("backend/package.json", { baseText: pkg(base), headText: pkg(head) });

  it("lists a change of each dependency field and of scripts", () => {
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
      "overrides",
      "pnpm",
      "packageManager",
      "scripts",
    ]) {
      const result = classify(input([changed({ [field]: { a: "1" } }, { [field]: { a: "2" } })]));
      expect(result.exit, field).toBe(1);
      expect(result.lines, field).toContain("LISTED backend/package.json: a dependency");
    }
  });

  // DQ-1023: a manifest that is added, deleted, retyped or moved is listed, whatever its fields.
  it("lists each added, deleted, retyped or moved package.json", () => {
    const deps = pkg({ dependencies: { a: "1" } });
    const cases: [string, PrFile[]][] = [
      ["added", [added("tools/package.json", deps)]],
      ["deleted", [deleted("tools/package.json", deps)]],
      [
        "retyped",
        [
          file("tools/package.json", {
            status: "T",
            newMode: "120000",
            baseText: deps,
            headText: "x",
          }),
        ],
      ],
      [
        "moved to another folder",
        [deleted("backend/package.json", deps), added("tools/other/package.json", deps)],
      ],
    ];
    for (const [name, files] of cases) {
      const result = classify(input(files));
      expect(result.exit, `manifest ${name}`).toBe(1);
      expect(result.lines.join("\n"), name).toContain(": a dependency");
    }
  });

  it("compares the dependency metadata fields too", () => {
    for (const field of [
      "peerDependenciesMeta",
      "dependenciesMeta",
      "bundledDependencies",
      "bundleDependencies",
    ]) {
      expect(PACKAGE_FIELDS, field).toContain(field);
    }
  });

  it("does not list a description change", () => {
    const result = classify(input([changed({ description: "a" }, { description: "b" })]));
    expect(result.exit, "description").toBe(0);
  });

  it("cannot check a changed package.json with no text or bad JSON", () => {
    const noText = file("backend/package.json", { baseText: pkg({}) });
    const bad = file("backend/package.json", { baseText: pkg({}), headText: "{" });
    expect(classify(input([noText])).exit, "no text").toBe(2);
    expect(classify(input([bad])).exit, "bad JSON").toBe(2);
  });
});

describe("classify: a memory PR (order 108)", () => {
  it("prints the merge line when the gates pass", () => {
    const result = classify(input([memory("lessons.md"), memory("identity.md")]));
    expect(result.exit, "exit").toBe(0);
    expect(result.lines, "lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 2 files`,
      "Memory PR: the chief merges it (owner, 2026-11-19, order 108).",
      "Not checked: read the whole diff for private facts.",
      MERGE_LINE,
    ]);
  });

  // The allowlist (option A, DQ-1021, DQ-1025): each status, mode and path of a memory file.
  it("passes only an added or changed .md file of long-term/", () => {
    const cases: [string, PrFile[], 0 | 1][] = [
      ["added .md", [added(`${LT}notes.md`, "# N\n")], 0],
      ["changed .md", [memory("lessons.md")], 0],
      ["deleted .md", [deleted(`${LT}lessons.md`, "# L\n")], 1],
      ["retyped", [file(`${LT}lessons.md`, { status: "T", newMode: "120000", ...TEXTS })], 1],
      [
        "retyped from a link to a file",
        [file(`${LT}lessons.md`, { status: "T", oldMode: "120000", ...TEXTS })],
        1,
      ],
      ["link", [file(`${LT}lessons.md`, { newMode: "120000", ...TEXTS })], 1],
      ["executable", [file(`${LT}lessons.md`, { newMode: "100755", ...TEXTS })], 1],
      ["a .txt file", [added(`${LT}notes.txt`, "# N\n")], 1],
      ["the memory README", [file(".agents/chief/memories/README.md", TEXTS)], 1],
      ["the short-term README", [file(".agents/chief/memories/short-term/README.md", TEXTS)], 1],
      [
        "a move inside long-term",
        [deleted(`${LT}lessons.md`, "# L\n"), added(`${LT}old/lessons.md`, "# L\n")],
        1,
      ],
    ];
    for (const [name, files, exit] of cases) {
      const result = classify(input(files));
      expect(result.exit, `allowlist ${name}`).toBe(exit);
      if (exit === 1) expect(result.lines.join("\n"), name).toContain("the owner merges it");
    }
  });

  // Plan delta r1 §2.1: the memory path grammar replaces the old pattern (deny by default).
  it("refuses a memory path outside the grammar", () => {
    for (const path of [`${LT}_x/y.md`, `${LT}a/.b.md`, `${LT}A/b.md`, `${LT}a//b.md`]) {
      const result = classify(input([added(path, "# N\n")]));
      expect(result.exit, `grammar ${path}`).toBe(1);
      expect(result.lines.join("\n"), `grammar line ${path}`).toContain("the owner merges it");
    }
  });

  // The second read of the plan: the audit command and prompt need the owner.
  it("refuses a change of the audit files restore.md and audit.md", () => {
    for (const name of ["restore.md", "audit.md"]) {
      const result = classify(input([memory(name)]));
      expect(result.exit, `audit file ${name}`).toBe(1);
      expect(result.lines.join("\n"), name).toContain("it holds the audit command or prompt");
    }
  });

  it("passes a rule whose quote is in the owner record", () => {
    const rule = added(RULE_PATH, ruleText("you may merge each docs PR"));
    expect(classify(input([rule])).exit, "quote in record").toBe(0);
  });

  it("refuses a rule whose quote is not in the owner record", () => {
    const result = classify(input([added(RULE_PATH, ruleText("you may merge each code PR"))]));
    expect(result.exit, "quote not in record").toBe(1);
    expect(result.lines.at(-1), "last line").toBe(
      `Memory PR: not mergeable: ${RULE_PATH}: the quote "you may merge each code PR" is not in the owner record; a rule counts only with the owner's own words (order 109)`,
    );
    const noQuote = ruleText("x").replace(/^Owner said:.*\n/m, "");
    expect(classify(input([added(RULE_PATH, noQuote)])).exit, "rule with no quote").toBe(1);
  });

  it("cannot check a rule change when the owner record is missing", () => {
    const rule = file(RULE_PATH, {
      baseText: ruleText("you may merge each docs PR"),
      headText: ruleText("you may merge each docs PR", "Merge each docs PR now."),
    });
    const result = classify(input([rule], { record: undefined }));
    expect(result.exit, "no record").toBe(2);
    expect(result.lines.at(-1), "last line").toBe(
      "Cannot check #152: no owner record (.agents/chief/memories/short-term/owner/*.md). Do not merge it.",
    );
  });

  // Owner order 130 (Q3 B): the owner merges each memory PR that adds, changes or deletes a rule
  // with permission-rule, whatever its quotes (DQ-1021, DQ-1024, DQ-1025).
  it("refuses each change of a permission rule, in each status", () => {
    const quoted = permission(ruleText("you may merge each docs PR"));
    const record = [...RECORD, 'Exact text: "you may merge each docs PR now"'];
    const cases: [string, PrFile[]][] = [
      ["added with a valid quote", [added(RULE_PATH, quoted)]],
      ["added with no quote", [added(RULE_PATH, quoted.replace(/^Owner said:.*\n/m, ""))]],
      [
        "added with a quote not in the record",
        [added(RULE_PATH, permission(ruleText("merge all of them now")))],
      ],
      [
        "changed with a new quote in the record",
        [
          file(RULE_PATH, {
            baseText: quoted,
            headText: permission(ruleText("you may merge each docs PR now", "Merge each PR.")),
          }),
        ],
      ],
      [
        "changed with an old quote and more white space",
        [
          file(RULE_PATH, {
            baseText: quoted,
            headText: permission(ruleText("you may merge  each docs PR", "Merge each PR.")),
          }),
        ],
      ],
      [
        "the field removed",
        [file(RULE_PATH, { baseText: quoted, headText: ruleText("you may merge each docs PR") })],
      ],
      [
        "another value",
        [
          added(
            RULE_PATH,
            permission(ruleText("you may merge each docs PR"), "permission-rule: yes"),
          ),
        ],
      ],
      ["deleted", [deleted(RULE_PATH, quoted)]],
      [
        "moved out of rules/ with the same text",
        [
          deleted(RULE_PATH, quoted),
          added(".agents/chief/memories/long-term/old/R-040-docs-merges.md", quoted),
        ],
      ],
    ];
    for (const [name, files] of cases) {
      const result = classify(input(files, { record }));
      expect(result.exit, `permission ${name}`).toBe(1);
      expect(result.lines.join("\n"), name).toContain("the owner merges");
      expect(result.lines.join("\n"), name).not.toContain("gh pr merge");
    }
  });

  // DQ-1031 (plan delta r1 §4): the owner record and the word list are read first, for each
  // memory PR.
  it("cannot check a memory PR with no owner record, also when no rule changes", () => {
    const note = classify(input([memory("lessons.md")], { record: undefined }));
    expect(note.exit, "note with no record").toBe(2);
    const marked = classify(
      input([added(RULE_PATH, permission(ruleText("you may merge each docs PR")))], {
        record: undefined,
      }),
    );
    expect(marked.exit, "marked rule with no record").toBe(2);
  });

  it("refuses a changed file with a private word", () => {
    const result = classify(input([memory("lessons.md", "# a zz-PRIVATE-zz note\n")]));
    expect(result.exit, "private word").toBe(1);
    expect(result.lines.at(-1), "last line").toBe(
      "Memory PR: not mergeable: .agents/chief/memories/long-term/lessons.md:1: a word of the private word list; remove it",
    );
  });

  it("cannot check when the private word list is missing", () => {
    const result = classify(input([memory("lessons.md")], { privateWords: undefined }));
    expect(result.exit, "no word list").toBe(2);
  });

  // The required-check identity (DQ-1000, DQ-1020): only a run of the CI workflow of GitHub
  // Actions counts, and no check of any kind may be pending or red.
  it("refuses when a CI check is pending, red, missing or from another source", () => {
    const without = (name: string): CiCheck[] =>
      GREEN.filter((check) => check.kind !== "run" || check.name !== name);
    const cases: [string, CiCheck[]][] = [
      ["pending", GREEN.map((check) => ({ ...check, state: "pending" as const }))],
      [
        "red",
        [
          ...GREEN,
          ciRun("Analyze (actions)", {
            state: "fail",
            workflowPath: ".github/workflows/codeql.yml",
          }),
        ],
      ],
      ["missing", []],
      ["one required check missing", without("check:memory")],
      ["a required check skipped", [...without("test"), ciRun("test", { state: "skipped" })]],
      [
        "only an unrelated check",
        [ciRun("Analyze (actions)", { workflowPath: ".github/workflows/codeql.yml" })],
      ],
      [
        "a status context named test",
        [...without("test"), { kind: "status", context: "test", state: "pass" }],
      ],
      ["another app named test", [...without("test"), ciRun("test", { appId: 1 })]],
      [
        "the CodeQL workflow named test",
        [...without("test"), ciRun("test", { workflowPath: ".github/workflows/codeql.yml" })],
      ],
      [
        "a green run and a red status of the same name",
        [...GREEN, { kind: "status", context: "test", state: "fail" }],
      ],
      [
        "a green run and a pending other-app run of the same name",
        [...GREEN, ciRun("test", { appId: 1, state: "pending" })],
      ],
      ["two runs of one job, one red", [...GREEN, ciRun("test", { id: 7, state: "fail" })]],
    ];
    for (const [name, checks] of cases) {
      const result = classify(input([memory("lessons.md")], { checks }));
      expect(result.exit, `ci ${name}`).toBe(1);
      expect(result.lines.join("\n"), name).not.toContain("gh pr merge");
    }
    const unrelated = [...GREEN, ciRun("CodeQL", { appId: 57789, workflowPath: null })];
    expect(classify(input([memory("lessons.md")], { checks: unrelated })).exit, "unrelated").toBe(
      0,
    );
  });

  it("refuses a tracked short-term file", () => {
    const result = classify(input([added(".agents/chief/memories/short-term/now.md", "x\n")]));
    expect(result.exit, "tracked short-term").toBe(1);
    expect(result.lines.at(-1), "short-term line").toBe(
      "Memory PR: not mergeable: .agents/chief/memories/short-term/now.md is a short-term file; git must not track it",
    );
  });

  it("cannot check a memory file with no text", () => {
    const result = classify(input([file(".agents/chief/memories/long-term/lessons.md")]));
    expect(result.exit, "memory no text").toBe(2);
  });
});

// Plan delta r1 §2.2: each base and head text of each changed memory file has one supported form.
// A text in another form stops the chief (exit 1). Each case has the bad text on one side only.
describe("classify: the memory text form", () => {
  const FM_GOOD = "---\ntitle: a\n---\n# A\n";
  const sides = (name: string, texts: { bad: string; good: string }): [string, PrFile[]][] => [
    [`${name} in the base`, [file(NOTE, { baseText: texts.bad, headText: texts.good })]],
    [`${name} in the head`, [file(NOTE, { baseText: texts.good, headText: texts.bad })]],
  ];
  const stops = (files: PrFile[]): string => {
    const result = classify(input(files));
    return `${String(result.exit)} ${result.lines.join("\n")}`;
  };

  it("stops for a text that is not UTF-8, on each side", () => {
    const cases: [string, PrFile[]][] = [
      ["base", [file(NOTE, { textUnsupported: true, headText: "# N\n" })]],
      ["head", [file(NOTE, { textUnsupported: true, baseText: "# O\n" })]],
    ];
    for (const [name, files] of cases) {
      expect(stops(files), `utf-8 ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });

  it("stops for a character outside the allowed classes: CR, U+2028, a vertical tab, a BOM", () => {
    const cases: [string, PrFile[]][] = [
      ...sides("CRLF", { bad: "# A note\r\nline\r\n", good: "# Good\n" }),
      ["U+2028", [file(NOTE, { baseText: "# O\n", headText: "# A\u2028B\n" })]],
      ["vertical tab", [file(NOTE, { baseText: "# O\n", headText: "# A\vB\n" })]],
      ["BOM in the middle", [file(NOTE, { baseText: "# O\n", headText: "# A\ufeffB\n" })]],
      ["leading BOM", [file(NOTE, { baseText: "# O\n", headText: "\ufeff# A\n" })]],
      [
        "CRLF front matter with the permission field (DQ-1032)",
        [
          added(
            RULE_PATH,
            permission(ruleText("you may merge each docs PR")).replace(/\n/g, "\r\n"),
          ),
        ],
      ],
    ];
    for (const [name, files] of cases) {
      expect(stops(files), `class ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });

  it("stops for a text that does not open with front matter or a heading", () => {
    const cases: [string, PrFile[]][] = [
      ...sides("a blank first line", { bad: "\n# A\n", good: "# Good\n" }),
      ...sides("--- with a space", { bad: "--- \ntitle: a\n---\n# A\n", good: "# Good\n" }),
      ["plain text", [file(NOTE, { baseText: "# O\n", headText: "x\n" })]],
    ];
    for (const [name, files] of cases) {
      expect(stops(files), `opening ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });

  it("stops for front matter with a repeated key, on each side", () => {
    const repeated = { bad: "---\ntitle: a\ntitle: b\n---\n# A\n", good: FM_GOOD };
    for (const [name, files] of sides("a repeated key", repeated)) {
      expect(stops(files), `repeated ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });

  it("stops for front matter with a bad line or a bad closing line", () => {
    const cases: [string, PrFile[]][] = [
      ["a capital letter", [added(NOTE, "---\nTitle: a\n---\n# A\n")]],
      ["a line that is not a field", [added(NOTE, "---\nid: x\nnot a field\n---\n# N\n")]],
      ["text after the closing line", [added(NOTE, "---\ntitle: a\n--- x\n# A\n")]],
      ["no closing line", [added(NOTE, "---\ntitle: a\n# A\n")]],
    ];
    for (const [name, files] of cases) {
      expect(stops(files), `front matter ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });

  it("stops for a front-matter key that is not in the list", () => {
    for (const key of ["zzz: x", "owner-merges: true"]) {
      for (const [name, files] of sides(key, { bad: `---\n${key}\n---\n# A\n`, good: FM_GOOD })) {
        expect(stops(files), `key ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
      }
    }
  });

  it("stops for the permission field in the body, in any case", () => {
    for (const text of [
      "# A\nPermission-Rule: true\n",
      "# A\n permission-rule :yes\n",
      "---\ntitle: a\n---\npermission-rule: true\n",
    ]) {
      expect(stops([added(NOTE, text)]), `body ${JSON.stringify(text)}`).toMatch(
        /^1 [\s\S]*the chief stops/,
      );
    }
  });

  it("passes each tracked long-term file, and its path matches the grammar", () => {
    const paths = execFileSync("git", ["ls-files", "-z", LT], { encoding: "utf8" })
      .split("\0")
      .filter((path) => path !== "");
    expect(paths.length, "long-term files").toBeGreaterThan(40);
    for (const path of paths) {
      expect(memoryTextProblems(readFileSync(path, "utf8")), `form of ${path}`).toEqual([]);
      expect(MEMORY_PATH.test(path), `grammar of ${path}`).toBe(true);
    }
  });
});

// Plan delta r2 §3 (DQ-1041): a front-matter line is "key: value" with a space after the colon.
// C1 A (the chief, 2026-11-20): `permission-rule:true` is a bad line too, so the chief stops.
describe("classify: the key separator", () => {
  const stops = (files: PrFile[]): string => {
    const result = classify(input(files));
    return `${String(result.exit)} ${result.lines.join("\n")}`;
  };
  it("stops for a front-matter line with no space after the colon, on each side", () => {
    const good = "---\ntitle: a\n---\n# A\n";
    const cases: [string, PrFile[]][] = [
      [
        "no space in the base",
        [file(NOTE, { baseText: "---\ntitle:Example\n---\n# A\n", headText: good })],
      ],
      [
        "no space in the head",
        [file(NOTE, { baseText: good, headText: "---\ntitle:Example\n---\n# A\n" })],
      ],
      [
        "a tab in the head",
        [file(NOTE, { baseText: good, headText: "---\ntitle:\tx\n---\n# A\n" })],
      ],
    ];
    for (const [name, files] of cases) {
      expect(stops(files), `separator ${name}`).toMatch(/^1 [\s\S]*the chief stops/);
    }
  });
  it("stops for permission-rule:true with no space, not the owner path", () => {
    const marker = stops([
      file(RULE_PATH, {
        baseText: ruleText("you may merge each docs PR"),
        headText: permission(ruleText("you may merge each docs PR"), "permission-rule:true"),
      }),
    ]);
    expect(marker, "permission-rule:true").toMatch(/^1 [\s\S]*the chief stops/);
    expect(marker, "permission-rule:true is not an owner case").not.toContain("the owner merges");
  });
});

// Plan delta r2 §2: the judgment reads a text only after the records and the CI facts decide
// nothing, and reads each needed side of each file one time.
describe("classify with a reader", () => {
  const BLOB_A = "a".repeat(40);
  const BLOB_B = "b".repeat(40);
  const counting = (
    texts: Record<string, ReadResult>,
  ): { reader: Reader; reads: ContentRead[] } => {
    const reads: ContentRead[] = [];
    const reader: Reader = (read) => {
      reads.push(read);
      return (
        texts[`${read.side} ${read.path}`] ?? { kind: "failed", reason: `no ${read.side} text` }
      );
    };
    return { reader, reads };
  };
  const text = (value: string): ReadResult => ({ kind: "text", text: value });
  const changed = (path: string): PrFile => file(path, { oldBlob: BLOB_A, newBlob: BLOB_B });

  it("reads each side of a changed note one time, also when two files share a blob id", () => {
    const one = counting({ [`base ${NOTE}`]: text("# Old\n"), [`head ${NOTE}`]: text("# New\n") });
    const result = classifyWith(input([changed(NOTE)]), one.reader);
    expect(result.exit, "one note exit").toBe(0);
    const sides = one.reads.map((read) => `${read.side} ${read.blob}`).join(" ");
    expect(sides, "one read for each side").toBe(`base ${BLOB_A} head ${BLOB_B}`);
    const SECOND = `${LT}second.md`;
    const two = counting({
      [`base ${NOTE}`]: text("# Old\n"),
      [`head ${NOTE}`]: text("# New\n"),
      [`base ${SECOND}`]: text("# Old\n"),
      [`head ${SECOND}`]: text("# New\n"),
    });
    classifyWith(input([changed(NOTE), changed(SECOND)]), two.reader);
    expect(two.reads.length, "one read for each side of each file").toBe(4);
  });

  it("the record step reads no text when a path, a status or a mode decides", () => {
    const gitlink = file(`${LT}sub`, {
      status: "A",
      oldMode: "000000",
      newMode: "160000",
      newBlob: BLOB_B,
    });
    const gone = file(`${LT}old.md`, { status: "D", newMode: "000000", oldBlob: BLOB_A });
    const cases: [string, PrFile[], RegExp][] = [
      ["a gitlink next to a note", [changed(NOTE), gitlink], /^1 [\s\S]*the owner merges it/],
      ["a deleted note next to a note", [changed(NOTE), gone], /^1 [\s\S]*the owner merges it/],
      [
        "an unsupported manifest path",
        [file("x\\xff/package.json", { supported: false })],
        /^1 [\s\S]*The chief stops/,
      ],
      [
        "a listed path and a changed manifest",
        [file("AGENTS.md"), changed("package.json")],
        /^1 [\s\S]*LISTED AGENTS\.md/,
      ],
    ];
    for (const [name, files, want] of cases) {
      const { reader, reads } = counting({});
      const result = classifyWith(input(files), reader);
      const said = `${String(result.exit)} ${result.lines.join("\n")} reads ${String(reads.length)}`;
      expect(said, `record ${name}`).toMatch(new RegExp(`${want.source}[\\s\\S]* reads 0$`));
    }
  });

  it("the record step reads no text when CI decides", () => {
    const red = GREEN.map((check, i) => (i === 0 ? { ...check, state: "fail" as const } : check));
    const pending = GREEN.map((check, i) =>
      i === 0 ? { ...check, state: "pending" as const } : check,
    );
    for (const [name, checks] of [
      ["red", red],
      ["pending", pending],
    ] as const) {
      for (const [kind, files] of [
        ["memory", [changed(NOTE)]],
        ["manifest", [changed("package.json")]],
      ] as const) {
        const { reader, reads } = counting({});
        const result = classifyWith(input([...files], { checks }), reader);
        const said = `${String(result.exit)} ${result.lines.join("\n")} reads ${String(reads.length)}`;
        expect(said, `record ${kind} ${name}`).toMatch(/^1 [\s\S]*CI check[\s\S]* reads 0$/);
      }
    }
  });

  it("stops the chief for a memory text that is not UTF-8, on each side alone", () => {
    const cases: [string, Record<string, ReadResult>][] = [
      ["base", { [`base ${NOTE}`]: { kind: "unsupported" }, [`head ${NOTE}`]: text("# New\n") }],
      ["head", { [`base ${NOTE}`]: text("# Old\n"), [`head ${NOTE}`]: { kind: "unsupported" } }],
    ];
    for (const [side, texts] of cases) {
      const result = classifyWith(input([changed(NOTE)]), counting(texts).reader);
      const said = `${String(result.exit)} ${result.lines.join("\n")}`;
      const pattern = new RegExp(`^1 [\\s\\S]*the chief stops: the ${side} text is not UTF-8`);
      expect(said, `unsupported ${side}`).toMatch(pattern);
    }
  });

  it("cannot check when the reader fails, for a note and for a manifest", () => {
    for (const path of [NOTE, "package.json"]) {
      const result = classifyWith(input([changed(path)]), counting({}).reader);
      const said = `${String(result.exit)} ${result.lines.join("\n")}`;
      expect(said, `failed ${path}`).toMatch(/^2 Cannot check #152: no base text/);
    }
  });
});

describe("classify: the PR itself", () => {
  it("gives no chief merge to a PR from a fork, by another author or for another base", () => {
    const cases: [string, Partial<MergeInput>, string][] = [
      ["fork", { crossRepository: true }, "No chief merge: the PR comes from a fork."],
      [
        "author",
        { author: "someone-else" },
        "No chief merge: the PR author someone-else is not the repository owner.",
      ],
      ["base", { baseRef: "dev" }, "No chief merge: the PR is for dev, not main."],
    ];
    for (const [name, extra, line] of cases) {
      for (const files of [[memory("lessons.md")], [file("docs/a.md")]]) {
        const result = classify(input(files, extra));
        expect(result.exit, `origin ${name}`).toBe(1);
        expect(result.lines, name).toContain(line);
        expect(result.lines.join("\n"), name).not.toContain("gh pr merge");
      }
    }
  });

  // DQ-1033 (plan delta r1 §4): a PR that is not open cannot be checked.
  it("cannot check a PR that is merged or closed", () => {
    for (const state of ["MERGED", "CLOSED"]) {
      for (const files of [[memory("lessons.md")], [file("docs/a.md")]]) {
        const result = classify(input(files, { state }));
        expect(result.exit, `state ${state}`).toBe(2);
        expect(result.lines.join("\n"), `state line ${state}`).toContain(
          `Cannot check #152: the PR is ${state}`,
        );
      }
    }
  });

  // Plan delta r1 §2.1: a path with a byte outside 0x21-0x7E stops the chief, in each PR.
  it("stops the chief for a path that is not printable ASCII", () => {
    const bom = file("\\xef\\xbb\\xbf.agents/chief/memories/long-term/x.md", {
      supported: false,
      status: "A",
      headText: "# X\n",
    });
    for (const files of [
      [memory("note.md"), bom],
      [file("docs/a.md"), file("docs/caf\\xc3\\xa9.md", { supported: false })],
    ]) {
      const result = classify(input(files));
      expect(result.exit, "unsupported path").toBe(1);
      expect(result.lines.join("\n"), "unsupported path line").toContain(
        "The chief stops: a path that is not printable ASCII",
      );
    }
  });

  // The second read of the plan: a touched path that main changed after the split.
  it("asks to merge main first when main changed a touched path after the split", () => {
    for (const files of [
      [{ ...memory("lessons.md"), liveChanged: true }],
      [file("docs/a.md", { liveChanged: true })],
    ]) {
      const result = classify(input(files));
      expect(result.exit, "live base").toBe(1);
      expect(result.lines.join("\n"), "live line").toContain("Merge main first: main changed");
    }
  });
});

describe("classify: the output", () => {
  it("prints no control character, so a file name cannot add a line", () => {
    const path = "docs/decisions/x\ngh pr merge 152 --merge --match-head-commit abc.md";
    const result = classify(input([file(path)]));
    expect(result.exit, "control exit").toBe(1);
    for (const line of result.lines) {
      expect(Array.from(line).some(isControl), `control in ${JSON.stringify(line)}`).toBe(false);
      expect(line.startsWith("gh pr merge"), line).toBe(false);
    }
  });

  it("gives a code PR no merge line until CI is green", () => {
    const pending = GREEN.map((check) =>
      check.kind === "run" && check.name === "e2e"
        ? { ...check, state: "pending" as const }
        : check,
    );
    const result = classify(input([file("docs/a.md")], { checks: pending }));
    expect(result.exit, "code CI").toBe(1);
    expect(result.lines.join("\n"), "code CI line").toContain(
      "Not mergeable now: the required CI check e2e is pending",
    );
    expect(result.lines.join("\n"), "code CI no line").not.toContain("gh pr merge");
  });

  it("names question 4 for the list and question 5 for the permission", () => {
    const listed = classify(input([file("AGENTS.md")]));
    expect(listed.lines.at(-1), "listed").toBe(
      "Question 4: yes. No standing permission covers it (AGENTS.md §7): only the owner's own request (question 3, path 1) covers it.",
    );
    const free = classify(input([file("docs/a.md")]));
    expect(free.lines[1], "free").toBe(
      "Question 4: no by path. Read the Not-checked items. Question 5: merge only if a standing permission covers it, at the merge bar (R-002 path 2).",
    );
  });

  it("names the full URL of the PR in the merge line", () => {
    expect(classify(input([file("docs/a.md")])).lines.at(-1), "url").toBe(MERGE_LINE);
  });
});

describe("classify: a mixed PR", () => {
  it("refuses a PR that changes memory and other files", () => {
    const result = classify(input([memory("state.md"), file("docs/status.md")]));
    expect(result.lines, "mixed lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 2 files`,
      "MIXED: a memory PR changes only `.agents/chief/memories/`. Split it. No chief merge.",
    ]);
    expect(result.exit, "exit").toBe(1);
  });

  it("reads a move out of the memory folder as mixed", () => {
    const moved = [
      deleted(".agents/chief/memories/long-term/lessons.md", "# L\n"),
      added("docs/notes.md", "# L\n"),
    ];
    expect(classify(input(moved)).lines.at(-1), "moved out").toContain("MIXED");
  });
});

// The CLI end to end: a temporary origin with real commits, a clone whose origin URL names a
// GitHub repository (git rewrites it to the local origin), and a fake gh that answers the GraphQL
// query from files. The first and the second answer can differ, to model a change during the run.
describe("the merge-check CLI", () => {
  let root: string;
  let repo: string;
  let bin: string;
  // The start check accepts only the clone of the repository (plan delta r1 §3).
  const ORIGIN_URL = "https://github.com/binhle312/cty1ng.git";
  let realGit = "";
  // No global git config of the machine that runs the tests: the start check reads each setting.
  const env = (): NodeJS.ProcessEnv => ({
    ...process.env,
    HOME: join(root, "home"),
    XDG_CONFIG_HOME: join(root, "home"),
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.invalid",
  });
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, env: env(), encoding: "utf8" }).trim();
  // The chief's scripts and the values that the CLI reads, as on main.
  const COPIED = [
    "package.json",
    ".agents/chief/scripts",
    ".agents/chief/memories/long-term/settings.md",
  ];
  const cliIn = (where: { cwd: string; extra?: NodeJS.ProcessEnv }, ...args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", ".agents/chief/scripts/merge-check.ts", ...args],
      { cwd: where.cwd, env: { ...env(), ...where.extra }, encoding: "utf8" },
    );
  const cli = (...args: string[]) => cliIn({ cwd: repo }, ...args);
  const mergeLine = (head: string): string =>
    `gh pr merge https://github.com/binhle312/cty1ng/pull/152 --merge --match-head-commit ${head}`;
  // The number of gh calls since the last fakeGh().
  const ghCalls = (): number =>
    existsSync(join(root, "calls"))
      ? readFileSync(join(root, "calls"), "utf8").split("\n").length - 1
      : 0;

  // The fake gh: the first call gives answer-1.json, each later call answer-2.json if it exists.
  function fakeGh(first: string, second?: string): void {
    writeFileSync(join(root, "answer-1.json"), first);
    rmSync(join(root, "answer-2.json"), { force: true });
    rmSync(join(root, "calls"), { force: true });
    if (second !== undefined) writeFileSync(join(root, "answer-2.json"), second);
    writeFileSync(
      join(bin, "gh"),
      [
        "#!/bin/sh",
        `echo gh >> "${root}/order.log"`,
        // DQ-1052: each call counts on entry, also a call with other arguments.
        `echo x >> "${root}/calls"`,
        'case "$*" in',
        '  "api --hostname github.com graphql "*) ;;',
        "  *) exit 1 ;;",
        "esac",
        `if [ "$(wc -l < "${root}/calls")" -gt 1 ] && [ -f "${root}/answer-2.json" ]; then`,
        `  cat "${root}/answer-2.json"`,
        "else",
        `  cat "${root}/answer-1.json"`,
        "fi",
        "",
      ].join("\n"),
    );
    chmodSync(join(bin, "gh"), 0o755);
  }

  // A PR commit on top of main with only these files, pushed to the PR ref; the clone stays on
  // main.
  function prCommit(files: Record<string, string>, from = "main"): string {
    git("checkout", "-q", "-B", "pr", from);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    }
    git("add", "--", ...Object.keys(files));
    git("commit", "-q", "-m", "pr");
    const head = git("rev-parse", "HEAD");
    git("push", "-q", "-f", "origin", "HEAD:refs/pull/152/head");
    git("checkout", "-q", "main");
    return head;
  }
  const tip = (): string => git("rev-parse", "HEAD");
  const pushMain = (): void => {
    git("push", "-q", "origin", "HEAD:main");
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "merge-check-"));
    repo = join(root, "repo");
    bin = join(root, "bin");
    mkdirSync(bin);
    mkdirSync(join(root, "home"));
    realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    const origin = join(root, "origin.git");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
    execFileSync("git", ["clone", "-q", origin, repo], { env: env() });
    git("config", `url.${origin}.insteadOf`, ORIGIN_URL);
    git("config", "remote.origin.url", ORIGIN_URL);
    for (const path of COPIED) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      cpSync(path, join(repo, path), { recursive: true });
    }
    mkdirSync(join(repo, "docs"));
    writeFileSync(join(repo, "docs/a.md"), "a\n");
    execFileSync("ln", ["-s", join(process.cwd(), "node_modules"), join(repo, "node_modules")]);
    writeFileSync(join(repo, ".gitignore"), "node_modules\n.agents/chief/memories/short-term/\n");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    pushMain();
    mkdirSync(join(repo, ".agents/chief/memories/short-term/owner"), { recursive: true });
    writeFileSync(
      join(repo, ".agents/chief/memories/short-term/private-words.txt"),
      "zz-private-zz\n",
    );
    writeFileSync(
      join(repo, ".agents/chief/memories/short-term/owner/orders.md"),
      '## Order 120 (2026-11-20 09:00)\nExact text: "you may merge each docs PR"\n',
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 with the full-URL merge line for a PR with no listed path", () => {
    const head = prCommit({ "docs/a.md": "b\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(result.stdout, `docs line ${result.stderr}`).toContain(mergeLine(head));
    expect(result.status, "exit").toBe(0);
  });

  it("exits 1 for a listed path", () => {
    const head = prCommit({ "AGENTS.md": "x\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(result.stdout, `listed line ${result.stderr}`).toContain(
      "LISTED AGENTS.md: `AGENTS.md`",
    );
    expect(result.status, "exit").toBe(1);
  });

  it("reads the texts of a memory PR from git and gives the merge line", () => {
    const head = prCommit({ ".agents/chief/memories/long-term/notes.md": "# Notes\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(result.stdout, `memory header ${result.stderr}`).toContain(
      "Memory PR: the chief merges it",
    );
    expect(result.stdout, "memory line").toContain(mergeLine(head));
    expect(result.status, "exit").toBe(0);
  });

  it("exits 1 for a memory PR that adds a permission rule (order 130)", () => {
    const rule = `---\nid: R-040\npermission-rule: true\n---\nRule: Merge each docs PR.\nOwner said: "you may merge each docs PR" (2026-11-20)\n`;
    const head = prCommit({ ".agents/chief/memories/long-term/rules/R-040-docs.md": rule });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(result.stdout, `permission ${result.stderr}`).toContain("the owner merges");
    expect(result.stdout, "no line").not.toContain("gh pr merge");
    expect(result.status, "exit").toBe(1);
  });

  it("exits 2 on a bad argument", () => {
    const result = cli("15x");
    expect(result.stdout, "bad argument").toContain(
      "Cannot check #15x: the argument is not a PR number",
    );
    expect(result.status, "exit").toBe(2);
  });

  it("exits 2 when the local list, settings or an untracked script differs from the base tip", () => {
    const head = prCommit({ "docs/a.md": "c\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const list = join(repo, ".agents/chief/scripts/lib/merge-list.ts");
    writeFileSync(list, `${readFileSync(list, "utf8")}// a local change\n`);
    const listed = cli("152");
    git("checkout", "--", ".agents/chief/scripts/lib/merge-list.ts");
    const settings = join(repo, ".agents/chief/memories/long-term/settings.md");
    writeFileSync(settings, `${readFileSync(settings, "utf8")}\n`);
    const changed = cli("152");
    git("checkout", "--", ".agents/chief/memories/long-term/settings.md");
    const extra = join(repo, ".agents/chief/scripts/lib/extra.ts");
    writeFileSync(extra, "export const x = 1;\n");
    const untracked = cli("152");
    rmSync(extra);
    for (const [name, result] of [
      ["list", listed],
      ["settings", changed],
      ["untracked", untracked],
    ] as const) {
      expect(result.stdout, name).toContain("differs from the base tip of the PR");
      expect(result.status, `${name} base exit`).toBe(2);
    }
  });

  // Race: main moves (here, the list file) after this checkout and before snapshot 1.
  it("exits 2 when main moved past this checkout before the snapshot", () => {
    const old = tip();
    const list = join(repo, ".agents/chief/scripts/lib/merge-list.ts");
    writeFileSync(list, `${readFileSync(list, "utf8")}// main moves\n`);
    git("commit", "-q", "-am", "main moves");
    pushMain();
    const moved = tip();
    git("reset", "-q", "--hard", old);
    const head = prCommit({ "docs/a.md": "d\n" }, old);
    fakeGh(answer({ head, baseTip: moved }));
    const result = cli("152");
    git("reset", "-q", "--hard", moved);
    expect(result.stdout, "moved main").toContain("differs from the base tip of the PR");
    expect(result.status, "exit").toBe(2);
  });

  // The second plan read: a rule gains permission-rule on main after the split, and the PR
  // changes its Rule sentence. The merge-base and head texts both lack the field.
  it("exits 1 when main changed a touched path after the split", () => {
    const path = ".agents/chief/memories/long-term/rules/R-041-docs.md";
    const text = (field: string, rule: string): string =>
      `---\nid: R-041\n${field}---\nRule: ${rule}\nOwner said: "you may merge each docs PR" (2026-11-20)\n`;
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text("", "Merge each docs PR."));
    git("add", "--", path);
    git("commit", "-q", "-m", "a rule");
    pushMain();
    const split = tip();
    const head = prCommit({ [path]: text("", "Merge each PR.") }, split);
    writeFileSync(join(repo, path), text("permission-rule: true\n", "Merge each docs PR."));
    git("commit", "-q", "-am", "main makes it a permission rule");
    pushMain();
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(result.stdout, `live line ${result.stderr}`).toContain(
      `Merge main first: main changed ${path}`,
    );
    expect(result.status, "live exit").toBe(1);
  });

  // Race: the PR is merged, gets a new head, or CI reruns between the two snapshots.
  it("exits 2 when the second snapshot differs from the first", () => {
    const head = prCommit({ "docs/a.md": "e\n" });
    const baseTip = tip();
    const rerun = greenNodes().map((node, i) => (i === 0 ? { ...node, databaseId: 9999 } : node));
    const running = greenNodes().map((node, i) =>
      i === 0 ? { ...node, status: "IN_PROGRESS", conclusion: null } : node,
    );
    const cases: [string, string][] = [
      ["merged", answer({ head, baseTip, state: "MERGED" })],
      ["new head", answer({ head: "c".repeat(40), baseTip })],
      ["rerun", answer({ head, baseTip, nodes: rerun })],
      ["base tip moves", answer({ head, baseTip: "d".repeat(40) })],
      ["check runs again", answer({ head, baseTip, nodes: running })],
    ];
    for (const [name, second] of cases) {
      fakeGh(answer({ head, baseTip }), second);
      const result = cli("152");
      expect(result.stdout, name).toContain("the PR changed during the check");
      expect(result.status, `${name} race exit`).toBe(2);
    }
  });

  // Plan delta r1 §3: the start check runs before snapshot 1, so a failed fact gives no gh call.
  it("exits 2 with no gh call for an origin that is not the repository", () => {
    const head = prCommit({ "docs/a.md": "s1\n" });
    const results: [string, ReturnType<typeof cli>, number][] = [];
    for (const url of [
      "https://github.com/someone/cty1ng.git",
      "ssh://git@example.org/binhle312/cty1ng.git",
    ]) {
      git("config", "remote.origin.url", url);
      fakeGh(answer({ head, baseTip: tip() }));
      results.push([url, cli("152"), ghCalls()]);
    }
    git("config", "remote.origin.url", ORIGIN_URL);
    for (const [url, result, calls] of results) {
      expect(
        `${String(result.status)} ${result.stdout} calls ${String(calls)}`,
        `origin ${url}`,
      ).toMatch(/^2 [\s\S]*the origin remote is not[\s\S]* calls 0$/);
    }
  });

  it("exits 2 with no gh call for a shallow clone or a grafts file", () => {
    const head = prCommit({ "docs/a.md": "s2\n" });
    const origin = join(root, "origin.git");
    const shallow = join(root, "shallow");
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${origin}`, shallow], {
      env: env(),
    });
    execFileSync("git", ["-C", shallow, "config", "remote.origin.url", ORIGIN_URL]);
    execFileSync("git", ["-C", shallow, "config", `url.${origin}.insteadOf`, ORIGIN_URL]);
    execFileSync("ln", ["-s", join(process.cwd(), "node_modules"), join(shallow, "node_modules")]);
    fakeGh(answer({ head, baseTip: tip() }));
    const shallowRun = cliIn({ cwd: shallow }, "152");
    const shallowCalls = ghCalls();
    rmSync(shallow, { recursive: true, force: true });
    const grafts = join(repo, git("rev-parse", "--git-path", "info/grafts"));
    mkdirSync(dirname(grafts), { recursive: true });
    writeFileSync(grafts, `${tip()}\n`);
    fakeGh(answer({ head, baseTip: tip() }));
    const graftsRun = cli("152");
    const graftsCalls = ghCalls();
    rmSync(grafts);
    for (const [name, result, calls] of [
      ["shallow", shallowRun, shallowCalls],
      ["grafts", graftsRun, graftsCalls],
    ] as const) {
      expect(
        `${String(result.status)} ${result.stdout} calls ${String(calls)}`,
        `history ${name}`,
      ).toMatch(/^2 [\s\S]*the full history[\s\S]* calls 0$/);
    }
  });

  // DQ-1029: diff.ignoreSubmodules hid a gitlink, so a PR with a gitlink read as a memory PR.
  it("exits 2 with no gh call for a git setting that can change the diff", () => {
    git("checkout", "-q", "-B", "pr", "main");
    mkdirSync(join(repo, ".agents/chief/memories/long-term"), { recursive: true });
    writeFileSync(join(repo, ".agents/chief/memories/long-term/link-note.md"), "# Note\n");
    git("add", ".agents/chief/memories/long-term/link-note.md");
    git("update-index", "--add", "--cacheinfo", `160000,${tip()},lib`);
    git("commit", "-q", "-m", "pr with a gitlink");
    const head = git("rev-parse", "HEAD");
    git("push", "-q", "-f", "origin", "HEAD:refs/pull/152/head");
    git("checkout", "-q", "main");
    const results: [string, ReturnType<typeof cli>, number][] = [];
    for (const [key, value] of [
      ["diff.ignoreSubmodules", "all"],
      ["diff.zzz", "1"],
    ] as const) {
      git("config", key, value);
      fakeGh(answer({ head, baseTip: tip() }));
      results.push([key.toLowerCase(), cli("152"), ghCalls()]);
      git("config", "--unset", key);
    }
    for (const [key, result, calls] of results) {
      const want = new RegExp(
        `^2 [\\s\\S]*the git setting ${key.replace(".", "\\.")}[\\s\\S]* calls 0$`,
      );
      expect(
        `${String(result.status)} ${result.stdout} calls ${String(calls)}`,
        `setting ${key}`,
      ).toMatch(want);
    }
  });

  // G2: the policy files are compared by blob id and executable bit, not by git diff, so
  // core.fileMode and core.autocrlf do not hide a change.
  it("exits 2 for a policy file that differs only by its executable bit or its line ends", () => {
    const head = prCommit({ "docs/a.md": "s4\n" });
    const LIST = ".agents/chief/scripts/lib/merge-list.ts";
    const list = join(repo, LIST);
    git("config", "core.fileMode", "false");
    chmodSync(list, 0o755);
    fakeGh(answer({ head, baseTip: tip() }));
    const mode = cli("152");
    chmodSync(list, 0o644);
    git("config", "--unset", "core.fileMode");
    const text = readFileSync(list, "utf8");
    git("config", "core.autocrlf", "true");
    writeFileSync(list, text.replace(/\n/g, "\r\n"));
    fakeGh(answer({ head, baseTip: tip() }));
    const crlf = cli("152");
    git("config", "--unset", "core.autocrlf");
    writeFileSync(list, text);
    for (const [name, result] of [
      ["mode", mode],
      ["crlf", crlf],
    ] as const) {
      expect(`${String(result.status)} ${result.stdout}`, `policy ${name}`).toMatch(
        /^2 [\s\S]*differs from the base tip of the PR/,
      );
    }
  });

  it("exits 2 with no gh call when git cannot read the settings", () => {
    const head = prCommit({ "docs/a.md": "s5\n" });
    writeFileSync(
      join(bin, "git"),
      `#!/bin/sh\ncase "$*" in *"config --list"*) exit 1 ;; esac\nexec "${realGit}" "$@"\n`,
    );
    chmodSync(join(bin, "git"), 0o755);
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    const calls = ghCalls();
    rmSync(join(bin, "git"));
    expect(
      `${String(result.status)} ${result.stdout} calls ${String(calls)}`,
      "unread setting",
    ).toMatch(/^2 [\s\S]*git could not read[\s\S]* calls 0$/);
  });

  // Plan delta r1 §3: the runner removes each inherited GIT_ variable.
  it("does not pass a GIT_DIR of the parent environment to git", () => {
    const head = prCommit({ "docs/a.md": "s6\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const extra = { GIT_DIR: join(root, "nothing"), GIT_ZZZ: "1" };
    const result = cliIn({ cwd: repo, extra }, "152");
    expect(result.stdout, `git dir ${result.stderr}`).toContain(mergeLine(head));
  });

  it("exits 2 when the base tip has no list file", () => {
    git("rm", "-q", "--cached", ".agents/chief/scripts/lib/merge-list.ts");
    git("commit", "-q", "-m", "drop the list");
    pushMain();
    const head = prCommit({ "docs/a.md": "f\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    git("add", ".agents/chief/scripts/lib/merge-list.ts");
    git("commit", "-q", "-m", "list back");
    pushMain();
    expect(result.stdout, "no list").toContain("the base tip has no list file");
    expect(result.status, "no list exit").toBe(2);
  });

  // Plan delta r2: a git wrapper and the fake gh write one ordered log of the calls of a run.
  const logged = (...args: string[]) => {
    const log = join(root, "order.log");
    rmSync(log, { force: true });
    const logbin = join(root, "logbin");
    mkdirSync(logbin, { recursive: true });
    writeFileSync(
      join(logbin, "git"),
      `#!/bin/sh\necho "git $*" >> "${log}"\nexec "${realGit}" "$@"\n`,
    );
    chmodSync(join(logbin, "git"), 0o755);
    const result = cliIn(
      { cwd: repo, extra: { PATH: `${logbin}:${bin}:${process.env.PATH ?? ""}` } },
      ...args,
    );
    const lines = existsSync(log)
      ? readFileSync(log, "utf8")
          .split("\n")
          .filter((l) => l !== "")
      : [];
    const reads = lines.filter((line) => line.startsWith("git cat-file blob")).length;
    return {
      result,
      lines,
      reads,
      said: `${String(result.status)} ${result.stdout} reads ${String(reads)}`,
    };
  };
  // A PR commit with written, removed, raw-named and gitlink paths.
  function prChange(change: {
    write?: Record<string, string>;
    remove?: string[];
    raw?: [Buffer, Buffer][];
    links?: string[];
  }): string {
    git("checkout", "-q", "-B", "pr", "main");
    for (const [path, text] of Object.entries(change.write ?? {})) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
      git("add", "--", path);
    }
    for (const [name, bytes] of change.raw ?? []) {
      const full = Buffer.concat([Buffer.from(`${repo}/`), name]);
      mkdirSync(full.subarray(0, full.lastIndexOf(0x2f)), { recursive: true });
      writeFileSync(full, bytes);
    }
    if ((change.raw ?? []).length > 0) git("add", "-A");
    for (const path of change.remove ?? []) git("rm", "-q", "--", path);
    for (const path of change.links ?? []) {
      git("update-index", "--add", "--cacheinfo", `160000,${tip()},${path}`);
    }
    git("commit", "-q", "-m", "pr change");
    const head = git("rev-parse", "HEAD");
    git("push", "-q", "-f", "origin", "HEAD:refs/pull/152/head");
    git("checkout", "-q", "-f", "main");
    git("clean", "-q", "-fd", "--", "x*");
    return head;
  }
  const KEPT = ".agents/chief/memories/long-term/kept.md";
  const keptOnMain = (): void => {
    if (existsSync(join(repo, KEPT))) return;
    writeFileSync(join(repo, KEPT), "# Kept\n");
    git("add", "--", KEPT);
    git("commit", "-q", "-m", "a kept note");
    pushMain();
  };
  let manifests = 0;
  // The root package.json with a new description line (not a field of PACKAGE_FIELDS).
  const manifest = (bom = ""): string => {
    manifests += 1;
    const text = readFileSync(join(repo, "package.json"), "utf8");
    return `${bom}${text.replace(/^\{/, `{\n  "description": "pr ${String(manifests)}",`)}`;
  };
  const RED_NODES = () =>
    greenNodes().map((node, i) => (i === 0 ? { ...node, conclusion: "FAILURE" } : node));
  const PENDING_NODES = () =>
    greenNodes().map((node, i) =>
      i === 0 ? { ...node, status: "IN_PROGRESS", conclusion: null } : node,
    );

  // Plan delta r2 §7, valid control: one content read for an added note, two for a changed one.
  it("reads each needed text one time on a passing memory PR", () => {
    keptOnMain();
    const addedHead = prChange({ write: { ".agents/chief/memories/long-term/new.md": "# New\n" } });
    fakeGh(answer({ head: addedHead, baseTip: tip() }));
    const add = logged("152");
    const changedHead = prChange({ write: { [KEPT]: "# Kept two\n" } });
    fakeGh(answer({ head: changedHead, baseTip: tip() }));
    const change = logged("152");
    expect(add.said, "added note").toMatch(/^0 [\s\S]*gh pr merge[\s\S]* reads 1$/);
    expect(change.said, "changed note").toMatch(/^0 [\s\S]*gh pr merge[\s\S]* reads 2$/);
  });

  // DQ-1045: a path, a status or a mode decides before any blob read.
  it("reads no text when a path, a status or a mode decides", () => {
    keptOnMain();
    const note = { ".agents/chief/memories/long-term/n.md": "# N\n" };
    const cases: [string, string, RegExp][] = [
      [
        "a gitlink under long-term",
        prChange({ write: note, links: [".agents/chief/memories/long-term/sub"] }),
        /^1 [\s\S]*the owner merges it/,
      ],
      [
        "a deleted note next to a note",
        prChange({ write: note, remove: [KEPT] }),
        /^1 [\s\S]*the owner merges it/,
      ],
      [
        "an unsupported manifest path",
        prChange({
          raw: [
            [
              Buffer.from([0x78, 0xff, 0x2f, ...Buffer.from("package.json")]),
              Buffer.from([0x7b, 0xff, 0x7d]),
            ],
          ],
        }),
        /^1 [\s\S]*The chief stops: a path that is not printable ASCII/,
      ],
      [
        "a listed path and a changed manifest",
        prChange({ write: { "AGENTS.md": "x\n", "package.json": manifest() } }),
        /^1 [\s\S]*LISTED AGENTS\.md/,
      ],
    ];
    const results = cases.map(([name, head, want]) => {
      fakeGh(answer({ head, baseTip: tip() }));
      return [name, logged("152").said, want] as const;
    });
    for (const [name, said, want] of results) {
      expect(said, name).toMatch(new RegExp(`${want.source}[\\s\\S]* reads 0$`));
    }
  });

  // DQ-1045 (grill r2, point 2): the CI facts decide before any blob read.
  it("reads no text when CI decides, for a memory PR and for a changed manifest", () => {
    const memoryHead = prChange({ write: { ".agents/chief/memories/long-term/ci.md": "# CI\n" } });
    const codeHead = prChange({ write: { "package.json": manifest() } });
    const results: [string, string][] = [];
    for (const [name, nodes] of [
      ["red", RED_NODES()],
      ["pending", PENDING_NODES()],
    ] as const) {
      for (const [kind, head] of [
        ["memory", memoryHead],
        ["manifest", codeHead],
      ] as const) {
        fakeGh(answer({ head, baseTip: tip(), nodes }));
        results.push([`${kind} ${name}`, logged("152").said]);
      }
    }
    for (const [name, said] of results) {
      expect(said, name).toMatch(/^1 [\s\S]*CI check[\s\S]* reads 0$/);
    }
  });

  // DQ-1047: a manifest keeps the decode of d748524 (a leading BOM is removed).
  it("passes a manifest with a BOM and a description change", () => {
    const head = prChange({ write: { "package.json": manifest("\ufeff") } });
    fakeGh(answer({ head, baseTip: tip() }));
    const run = logged("152");
    expect(run.said, "bom manifest").toMatch(/^0 [\s\S]*gh pr merge/);
  });

  // Grill r2, point 2: all git work, the content reads too, comes before snapshot 2, and a
  // decisive record result waits for the compare.
  it("reads each text before the second snapshot, and holds a record result until the compare", () => {
    keptOnMain();
    const memoryHead = prChange({ write: { [KEPT]: "# Kept order\n" } });
    const codeHead = prChange({ write: { "package.json": manifest() } });
    const orders: [string, string[]][] = [];
    for (const [kind, head] of [
      ["memory", memoryHead],
      ["manifest", codeHead],
    ] as const) {
      fakeGh(answer({ head, baseTip: tip() }));
      orders.push([kind, logged("152").lines]);
    }
    for (const [kind, lines] of orders) {
      const lastRead = lines.map((line) => line.startsWith("git cat-file blob")).lastIndexOf(true);
      const secondGh = lines.indexOf("gh", lines.indexOf("gh") + 1);
      expect(`${kind} read ${String(lastRead)} gh ${String(secondGh)}`, `order ${kind}`).toMatch(
        /^\w+ read \d+ gh \d+$/,
      );
      expect(lastRead < secondGh, `${kind} reads first`).toBe(true);
    }
    const goneHead = prChange({ remove: [KEPT] });
    const rerun = greenNodes().map((node, i) => (i === 0 ? { ...node, databaseId: 9998 } : node));
    fakeGh(
      answer({ head: goneHead, baseTip: tip() }),
      answer({ head: goneHead, baseTip: tip(), nodes: rerun }),
    );
    const held = logged("152");
    expect(held.said, "held result").toMatch(/^2 [\s\S]*the PR changed during the check/);
    expect(held.result.stdout, "no held line").not.toContain("a memory PR may only add or change");
  });

  // DQ-1043 and grill 2 point 1: one origin value, read as bytes, printable ASCII, no trim.
  it("exits 2 with no gh call for an origin with more or less than one exact value", () => {
    const head = prCommit({ "docs/a.md": "o2\n" });
    const cases: [string, string[], string][] = [
      ["two values", [ORIGIN_URL, "https://github.com/binhle312/cty1ng"], "has 2 URLs"],
      ["two equal values", [ORIGIN_URL, ORIGIN_URL], "has 2 URLs"],
      ["a value and an empty value", [ORIGIN_URL, ""], "has 2 URLs"],
      ["a trailing space", [`${ORIGIN_URL} `], "not printable ASCII"],
      ["a BOM", [`\ufeff${ORIGIN_URL}`], "not printable ASCII"],
    ];
    const results: [string, string, string][] = [];
    for (const [name, values, want] of cases) {
      git("config", "--unset-all", "remote.origin.url");
      for (const value of values) git("config", "--add", "remote.origin.url", value);
      fakeGh(answer({ head, baseTip: tip() }));
      const result = cli("152");
      results.push([
        name,
        `${String(result.status)} ${result.stdout} calls ${String(ghCalls())}`,
        want,
      ]);
    }
    git("config", "--unset-all", "remote.origin.url");
    git("config", "remote.origin.url", ORIGIN_URL);
    for (const [name, said, want] of results) {
      expect(said, `origin ${name}`).toMatch(new RegExp(`^2 [\\s\\S]*${want}[\\s\\S]* calls 0$`));
    }
  });

  // DQ-1042 and DQ-1044: the policy walk keeps each name as bytes and stops on a read error.
  it("exits 2 for a policy file name that is not printable ASCII, or a folder it cannot read", () => {
    expect(process.getuid?.(), "the test does not run as root").not.toBe(0);
    const head = prCommit({ "docs/a.md": "p2\n" });
    const lib = join(repo, ".agents/chief/scripts/lib");
    const results: [string, string, RegExp][] = [];
    const run = (name: string, want: RegExp): void => {
      fakeGh(answer({ head, baseTip: tip() }));
      const result = cli("152");
      results.push([name, `${String(result.status)} ${result.stdout}${result.stderr}`, want]);
    };
    const raw = Buffer.concat([Buffer.from(`${lib}/x`), Buffer.from([0xff]), Buffer.from(".ts")]);
    writeFileSync(raw, "export {};\n");
    run("a name with the byte ff", /^2 [\s\S]*cannot keep exactly/);
    rmSync(raw);
    writeFileSync(join(lib, "x y.ts"), "export {};\n");
    run("a name with a space", /^2 [\s\S]*(cannot keep exactly|differs from the base tip)/);
    rmSync(join(lib, "x y.ts"));
    mkdirSync(join(lib, "locked"));
    chmodSync(join(lib, "locked"), 0o000);
    run("a folder it cannot read", /^2 Cannot check #152: [\s\S]*could not read/);
    chmodSync(join(lib, "locked"), 0o755);
    rmSync(join(lib, "locked"), { recursive: true });
    writeFileSync(join(lib, "locked.ts"), "export {};\n");
    chmodSync(join(lib, "locked.ts"), 0o000);
    run("a file it cannot read", /^2 /);
    chmodSync(join(lib, "locked.ts"), 0o644);
    rmSync(join(lib, "locked.ts"));
    for (const [name, said, pattern] of results) expect(said, `walk ${name}`).toMatch(pattern);
  });

  // DQ-1052: the fake gh counts each call on entry, also a call with other arguments.
  it("counts each gh call, also one with other arguments", () => {
    fakeGh(answer());
    spawnSync(join(bin, "gh"), ["auth", "status"], { encoding: "utf8" });
    expect(ghCalls(), "a call with other arguments").toBe(1);
    const head = prCommit({ "docs/a.md": "g2\n" });
    fakeGh(answer({ head, baseTip: tip() }));
    const result = cli("152");
    expect(
      `${String(result.status)} calls ${String(ghCalls())}`,
      "two calls on a passing run",
    ).toBe("0 calls 2");
  });
});

describe("the workflow copy of the security paths", () => {
  // Each path of the filter of .github/workflows/security-review.yml, as a path rule.
  function workflowPaths(text: string): string[] {
    const block = /\n {4}paths:\n((?: {6}(?:#.*|- .*)\n)+)/.exec(text)?.[1] ?? "";
    return [...block.matchAll(/- "([^"]+)"/g)].map((match) =>
      (match[1] ?? "").replace(/\*\*$/, ""),
    );
  }

  it("has each path of the workflow filter in the security item", () => {
    const paths = workflowPaths(readFileSync(".github/workflows/security-review.yml", "utf8"));
    const security = MERGE_LIST.find((item) => item.text === "security-sensitive code");
    expect(paths.length, "workflow paths").toBeGreaterThan(5);
    for (const path of paths) expect(security?.paths, path).toContain(path);
  });
});

describe("the required CI checks", () => {
  // The job names of .github/workflows/ci.yml: the gate matrix and each other job's name.
  function ciNames(text: string): string[] {
    const matrix = /gate:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? "";
    const gates = matrix
      .split(",")
      .map((name) => name.trim().replace(/^"|"$/g, ""))
      .filter((name) => name !== "");
    const jobs = [...text.matchAll(/^ {4}name: (?!\$\{\{)(.+)$/gm)].map((match) =>
      (match[1] ?? "").trim(),
    );
    return [...gates, ...jobs].sort();
  }

  it("are the job names of the CI workflow", () => {
    const names = ciNames(readFileSync(".github/workflows/ci.yml", "utf8"));
    expect(names.length, "ci names").toBeGreaterThan(10);
    expect([...REQUIRED_CHECKS].sort(), "required").toEqual(names);
  });
});

describe("the code that the checks run", () => {
  // Each relative import of a file, as a repository path, and of those files in turn.
  function imports(start: string): string[] {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const path = queue.pop() ?? "";
      if (seen.has(path)) continue;
      seen.add(path);
      for (const match of readFileSync(path, "utf8").matchAll(/from "(\.{1,2}\/[^"]+)"/g)) {
        queue.push(join(dirname(path), match[1] ?? ""));
      }
    }
    return [...seen];
  }

  it("lists each file that check:memory and merge:check run", () => {
    const paths = [
      ...imports(".agents/chief/scripts/check-memory.ts"),
      ...imports(".agents/chief/scripts/merge-check.ts"),
    ];
    expect(paths, "report.ts").toContain("scripts/lib/report.ts");
    for (const path of paths) expect(listedItem(path), path).toBeDefined();
  });
});
