// The merge check (`pnpm merge:check <PR>`): the list file, the pure classify step, the gh reader
// and the CLI end to end. All data is synthetic (principle-safe-test-data).
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CiCheck, type MergeInput, type PrFile, classify } from "./lib/merge-check.ts";
import { type Run, readPr } from "./lib/merge-check-gh.ts";
import { MERGE_LIST, listSentence, listedItem, matchesPath } from "./lib/merge-list.ts";

const HEAD = "1a2b3c4d5e6f708192a3b4c5d6e7f80912345678";
const MERGE_LINE = `gh pr merge 152 --merge --match-head-commit ${HEAD}`;
const GREEN: CiCheck[] = [{ name: "ci", state: "pass" }];
const RECORD = ['## Order 120 (2026-11-20 09:00)\nExact text: "you may merge each docs PR"\n'];
const RULE_PATH = ".agents/chief/memories/long-term/rules/R-040-docs-merges.md";

function ruleText(quote: string): string {
  return `---\nid: R-040\n---\nRule: Merge each docs PR.\nOwner said: "${quote}" (2026-11-20)\nHow to apply:\n`;
}

function file(path: string, extra: Partial<PrFile> = {}): PrFile {
  return { path, previousPath: undefined, status: "modified", ...extra };
}

function input(files: PrFile[], extra: Partial<MergeInput> = {}): MergeInput {
  return {
    number: 152,
    head: HEAD,
    files,
    checks: GREEN,
    record: RECORD,
    privateWords: ["zz-private-zz"],
    minQuoteWords: 4,
    ...extra,
  };
}

const memory = (path: string, headText = "# A note\n"): PrFile =>
  file(`.agents/chief/memories/long-term/${path}`, { headText, baseText: "# Old\n" });

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
      ".agents/chief/scripts/lib/merge-check-gh.ts",
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

  it.each(CASES)("lists a change of %s at %s", (text, path) => {
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
      "Question 3: no by path. Read the Not-checked items, then question 4.",
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
      "Question 3: yes. The owner merges it (AGENTS.md §7): no standing permission covers it.",
    ]);
  });

  it("lists a rename out of and into docs/decisions/ at both names", () => {
    const out = file("docs/old/D1.md", { status: "renamed", previousPath: "docs/decisions/D1.md" });
    const into = file("docs/decisions/D2.md", { status: "renamed", previousPath: "docs/x/D2.md" });
    expect(classify(input([out])).exit, "renamed out").toBe(1);
    expect(classify(input([into])).exit, "renamed in").toBe(1);
  });

  it("lists an added and a deleted migration", () => {
    const added = file("backend/migrations/0010_a.sql", { status: "added" });
    const removed = file("backend/migrations/0009_b.sql", { status: "removed" });
    expect(classify(input([added])).exit, "added").toBe(1);
    expect(classify(input([removed])).exit, "removed").toBe(1);
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

  it("does not list a description change", () => {
    const result = classify(input([changed({ description: "a" }, { description: "b" })]));
    expect(result.exit, "description").toBe(0);
  });

  it("lists a new and a deleted package.json with dependencies", () => {
    const added = file("tools/package.json", {
      status: "added",
      headText: pkg({ dependencies: { a: "1" } }),
    });
    const removed = file("tools/package.json", {
      status: "removed",
      baseText: pkg({ dependencies: { a: "1" } }),
    });
    expect(classify(input([added])).exit, "added package.json").toBe(1);
    expect(classify(input([removed])).exit, "removed package.json").toBe(1);
  });

  it("cannot check a package.json with no text or bad JSON", () => {
    const noText = file("backend/package.json", { baseText: pkg({}) });
    const bad = file("backend/package.json", { baseText: pkg({}), headText: "{" });
    expect(classify(input([noText])).exit, "no text").toBe(2);
    expect(classify(input([bad])).exit, "bad JSON").toBe(2);
  });
});

describe("classify: a memory PR (order 108)", () => {
  it("prints the merge line when the gates pass", () => {
    const result = classify(
      input([
        memory("lessons.md"),
        file(".agents/chief/memories/README.md", { headText: "# M\n" }),
      ]),
    );
    expect(result.exit, "exit").toBe(0);
    expect(result.lines, "lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 2 files`,
      "Memory PR: the chief merges it (owner, 2026-11-19, order 108).",
      "Not checked: read the whole diff for private facts.",
      MERGE_LINE,
    ]);
  });

  it("passes the memory README and identity.md as a memory PR", () => {
    for (const path of [
      ".agents/chief/memories/README.md",
      ".agents/chief/memories/long-term/identity.md",
    ]) {
      expect(classify(input([file(path, { headText: "# M\n" })])).exit, path).toBe(0);
    }
  });

  it("passes a rule whose quote is in the owner record", () => {
    const rule = file(RULE_PATH, {
      status: "added",
      headText: ruleText("you may merge each docs PR"),
    });
    expect(classify(input([rule])).exit, "quote in record").toBe(0);
  });

  it("refuses a rule whose quote is not in the owner record", () => {
    const rule = file(RULE_PATH, {
      status: "added",
      headText: ruleText("you may merge each code PR"),
    });
    const result = classify(input([rule]));
    expect(result.exit, "quote not in record").toBe(1);
    expect(result.lines.at(-1), "last line").toBe(
      `Memory PR: not mergeable: ${RULE_PATH}: the quote "you may merge each code PR" is not in the owner record; a rule counts only with the owner's own words (order 109)`,
    );
    expect(result.lines.join("\n"), "no merge line").not.toContain("gh pr merge");
  });

  it("cannot check a rule change when the owner record is missing", () => {
    const rule = file(RULE_PATH, { headText: ruleText("you may merge each docs PR") });
    const result = classify(input([rule], { record: undefined }));
    expect(result.exit, "no record").toBe(2);
    expect(result.lines.at(-1), "last line").toBe(
      "Cannot check #152: no owner record (.agents/chief/memories/short-term/owner/*.md). Do not merge it.",
    );
  });

  it("does not need the owner record when no rule file changes", () => {
    expect(classify(input([memory("lessons.md")], { record: undefined })).exit, "no rule").toBe(0);
  });

  it("refuses a changed file with a private word", () => {
    const result = classify(input([memory("lessons.md", "a zz-PRIVATE-zz note\n")]));
    expect(result.exit, "private word").toBe(1);
    expect(result.lines.at(-1), "last line").toBe(
      "Memory PR: not mergeable: .agents/chief/memories/long-term/lessons.md:1: a word of the private word list; remove it",
    );
  });

  it("cannot check when the private word list is missing", () => {
    const result = classify(input([memory("lessons.md")], { privateWords: undefined }));
    expect(result.exit, "no word list").toBe(2);
  });

  it("refuses when a CI check is pending, red or missing", () => {
    const cases: [string, CiCheck[]][] = [
      ["pending", [{ name: "ci", state: "pending" }]],
      ["red", [...GREEN, { name: "lint", state: "fail" }]],
      ["missing", []],
    ];
    for (const [name, checks] of cases) {
      const result = classify(input([memory("lessons.md")], { checks }));
      expect(result.exit, name).toBe(1);
      expect(result.lines.join("\n"), name).not.toContain("gh pr merge");
    }
  });

  it("refuses a tracked short-term file", () => {
    const result = classify(
      input([file(".agents/chief/memories/short-term/now.md", { headText: "x\n" })]),
    );
    expect(result.exit, "tracked short-term").toBe(1);
    expect(result.lines.at(-1), "last line").toBe(
      "Memory PR: not mergeable: .agents/chief/memories/short-term/now.md is a short-term file; git must not track it",
    );
  });

  it("cannot check a memory file with no text", () => {
    const result = classify(input([file(".agents/chief/memories/long-term/lessons.md")]));
    expect(result.exit, "memory no text").toBe(2);
  });
});

describe("classify: a mixed PR", () => {
  it("refuses a PR that changes memory and other files", () => {
    const result = classify(input([memory("state.md"), file("docs/status.md")]));
    expect(result.exit, "exit").toBe(1);
    expect(result.lines, "mixed lines").toEqual([
      `merge:check #152, head ${HEAD.slice(0, 7)}, 2 files`,
      "MIXED: a memory PR changes only `.agents/chief/memories/`. Split it. No chief merge.",
    ]);
  });

  it("reads a rename out of the memory folder as mixed", () => {
    const moved = file("docs/notes.md", {
      status: "renamed",
      previousPath: ".agents/chief/memories/long-term/lessons.md",
    });
    expect(classify(input([moved])).exit, "renamed out").toBe(1);
    expect(classify(input([moved])).lines.at(-1), "renamed out").toContain("MIXED");
  });
});

describe("classify: cannot check", () => {
  it("cannot check 3,000 files or more", () => {
    const files = Array.from({ length: 3000 }, (_, i) => file(`docs/f${i}.md`));
    const result = classify(input(files));
    expect(result.exit, "3000 files").toBe(2);
    expect(result.lines.at(-1), "last line").toBe(
      "Cannot check #152: 3000 files; the GitHub API gives 3,000 at most. Treat it as listed: the owner merges it.",
    );
  });
});

// A fake gh: each call returns the answer for its first matching key.
function fakeRun(answers: Record<string, { status?: number; stdout: string }>): Run {
  return (args) => {
    const call = args.join(" ");
    for (const [key, answer] of Object.entries(answers)) {
      if (call.includes(key)) return { status: answer.status ?? 0, stdout: answer.stdout };
    }
    return { status: 1, stdout: "" };
  };
}

const VIEW = JSON.stringify({
  headRefOid: HEAD,
  baseRefOid: "b".repeat(40),
  changedFiles: 2,
  statusCheckRollup: [
    { __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
    { __typename: "StatusContext", context: "other", state: "PENDING" },
  ],
});
const FILES = [
  JSON.stringify({ filename: "docs/a.md", status: "modified" }),
  JSON.stringify({
    filename: "pkg/package.json",
    status: "renamed",
    previous_filename: "old/package.json",
  }),
].join("\n");
const content = (text: string): string =>
  JSON.stringify({ encoding: "base64", content: Buffer.from(text).toString("base64") });

describe("readPr", () => {
  it("reads the head, the files, the checks and the texts at the old name of a rename", () => {
    const calls: string[] = [];
    const answers = fakeRun({
      "pr view 152": { stdout: VIEW },
      "pulls/152/files": { stdout: FILES },
      [`contents/old/package.json?ref=${"b".repeat(40)}`]: { stdout: content('{"a":1}') },
      [`contents/pkg/package.json?ref=${HEAD}`]: { stdout: content('{"a":2}') },
    });
    const run: Run = (args) => {
      calls.push(args.join(" "));
      return answers(args);
    };
    const result = readPr(152, run);
    expect(result, "result").toEqual({
      ok: true,
      head: HEAD,
      checks: [
        { name: "ci", state: "pass" },
        { name: "other", state: "pending" },
      ],
      files: [
        { path: "docs/a.md", previousPath: undefined, status: "modified" },
        {
          path: "pkg/package.json",
          previousPath: "old/package.json",
          status: "renamed",
          baseText: '{"a":1}',
          headText: '{"a":2}',
        },
      ],
    });
  });

  it("cannot check on a gh error, bad JSON, a count mismatch or a contents answer with no text", () => {
    const cases: [string, Record<string, { status?: number; stdout: string }>][] = [
      ["gh error", { "pr view": { status: 1, stdout: "" } }],
      ["bad JSON", { "pr view": { stdout: "{" } }],
      [
        "count mismatch",
        { "pr view": { stdout: VIEW }, "pulls/152/files": { stdout: FILES.split("\n")[0] ?? "" } },
      ],
      [
        "no text",
        {
          "pr view": { stdout: VIEW },
          "pulls/152/files": { stdout: FILES },
          contents: { stdout: JSON.stringify({ encoding: "none", content: "" }) },
        },
      ],
    ];
    for (const [name, answers] of cases) {
      const result = readPr(152, fakeRun(answers));
      expect(result.ok, name).toBe(false);
    }
  });
});

describe("the merge-check CLI", () => {
  let root: string;
  let repo: string;
  let bin: string;
  const env = (): NodeJS.ProcessEnv => ({
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.invalid",
  });
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, env: env(), encoding: "utf8" });
  // The chief's scripts and the values that the CLI reads, as on main.
  const COPIED = [
    "package.json",
    ".agents/chief/scripts",
    ".agents/chief/memories/long-term/settings.md",
  ];
  const cli = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", ".agents/chief/scripts/merge-check.ts", ...args],
      {
        cwd: repo,
        env: env(),
        encoding: "utf8",
      },
    );
  // The fake gh answers from files in the test folder.
  function fakeGh(files: string): void {
    writeFileSync(join(root, "view.json"), VIEW.replace('"changedFiles":2', '"changedFiles":1'));
    writeFileSync(join(root, "files.jsonl"), files);
    writeFileSync(
      join(bin, "gh"),
      [
        "#!/bin/sh",
        'case "$*" in',
        `  *"pr view"*) cat "${root}/view.json" ;;`,
        `  *"/files"*) cat "${root}/files.jsonl" ;;`,
        "  *) exit 1 ;;",
        "esac",
        "",
      ].join("\n"),
    );
    chmodSync(join(bin, "gh"), 0o755);
  }

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "merge-check-"));
    repo = join(root, "repo");
    bin = join(root, "bin");
    mkdirSync(bin);
    execFileSync("git", ["init", "--bare", "-b", "main", join(root, "origin.git")]);
    execFileSync("git", ["clone", join(root, "origin.git"), repo], { env: env() });
    for (const path of COPIED) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      cpSync(path, join(repo, path), { recursive: true });
    }
    execFileSync("ln", ["-s", join(process.cwd(), "node_modules"), join(repo, "node_modules")]);
    writeFileSync(join(repo, ".gitignore"), "node_modules\n");
    git("add", "-A");
    git("commit", "-m", "base");
    git("push", "origin", "HEAD:main");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exits 0 with the merge line for a PR with no listed path", () => {
    fakeGh(JSON.stringify({ filename: "docs/a.md", status: "modified" }));
    const result = cli("152");
    expect(result.stdout, result.stderr).toContain(MERGE_LINE);
    expect(result.status, "exit").toBe(0);
  });

  it("exits 1 for a listed path", () => {
    fakeGh(JSON.stringify({ filename: "AGENTS.md", status: "modified" }));
    const result = cli("152");
    expect(result.stdout, result.stderr).toContain("LISTED AGENTS.md: `AGENTS.md`");
    expect(result.status, "exit").toBe(1);
  });

  it("exits 2 on a bad argument", () => {
    const result = cli("15x");
    expect(result.stdout, "bad argument").toContain(
      "Cannot check #15x: the argument is not a PR number",
    );
    expect(result.status, "exit").toBe(2);
  });

  it("exits 2 when the local list differs from origin/main", () => {
    fakeGh(JSON.stringify({ filename: "docs/a.md", status: "modified" }));
    const list = join(repo, ".agents/chief/scripts/lib/merge-list.ts");
    writeFileSync(list, `${readFileSync(list, "utf8")}// a local change\n`);
    const result = cli("152");
    git("checkout", "--", ".agents/chief/scripts/lib/merge-list.ts");
    expect(result.stdout, "differs").toContain("Run merge:check from a checkout of main");
    expect(result.status, "exit").toBe(2);
  });

  it("exits 2 when the base has no list file", () => {
    fakeGh(JSON.stringify({ filename: "docs/a.md", status: "modified" }));
    git("rm", "-q", "--cached", ".agents/chief/scripts/lib/merge-list.ts");
    git("commit", "-q", "-m", "drop the list");
    git("push", "-q", "origin", "HEAD:main");
    const result = cli("152");
    git("add", ".agents/chief/scripts/lib/merge-list.ts");
    git("commit", "-q", "-m", "list back");
    git("push", "-q", "origin", "HEAD:main");
    expect(result.stdout, "no list").toContain("the base (origin/main) has no list file");
    expect(result.status, "exit").toBe(2);
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
