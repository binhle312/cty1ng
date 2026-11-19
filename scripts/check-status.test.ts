import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ChangedFile,
  checkStatus,
  doneRows,
  mergedPrs,
  ownerMerges,
} from "./lib/check-status.ts";
import { mergeChanges, mergeFiles, readHistory } from "./lib/check-status-git.ts";

const LINK = "https://github.com/binhle312/cty1ng/pull";
const SINCE = "2026-10-30";

// One line of `git log --first-parent --format=%H%x09%cI%x09%s`.
function logLine(sha: string, line: { date: string; subject: string }): string {
  const { date, subject } = line;
  return `${sha}\t${date}T10:00:00+07:00\t${subject}`;
}

function merge(pr: number, date: string): string {
  return logLine(sha(pr), { date, subject: `Merge pull request #${pr} from owner/branch-${pr}` });
}

function sha(pr: number): string {
  return String(pr).padStart(40, "a");
}

function status(doneLines: string[]): string {
  return [
    "# Status",
    "",
    "## Slices",
    "",
    "## Done",
    "",
    "Each row has a date.",
    "",
    "| Date | What |",
    "| --- | --- |",
    ...doneLines,
    "",
  ].join("\n");
}

// A changed file of a merge; `texts` are its versions before and after the merge.
function changed(path: string, ...texts: string[]): ChangedFile {
  return { path, texts };
}

const OWNER_RULE = "---\nid: R-002\nowner-merges: true\n---\nRule: Merge at the bar.\n";
const PLAIN_RULE = "---\nid: R-002\n---\nRule: Merge at the bar.\n";
const RULE_PATH = ".agents/memories/long-term/rules/R-002-x.md";

function row(date: string, ...prs: number[]): string {
  return `| ${date} | ${prs.map((pr) => `[#${pr}](${LINK}/${pr})`).join(", ")} merged. |`;
}

describe("mergedPrs", () => {
  it("reads a merge commit subject as a merged PR", () => {
    expect(mergedPrs(merge(7, "2026-11-01")), "merge commit").toEqual([
      { pr: 7, date: "2026-11-01", sha: sha(7) },
    ]);
  });

  it("reads a squash merge subject as a merged PR", () => {
    const log = logLine("b".repeat(40), {
      date: "2026-10-29",
      subject: "Add the ERDs by domain (#9)",
    });
    expect(mergedPrs(log), "squash merge").toEqual([
      { pr: 9, date: "2026-10-29", sha: "b".repeat(40) },
    ]);
  });

  it("skips a commit that is not a PR merge", () => {
    const log = [
      logLine("c".repeat(40), { date: "2026-10-21", subject: "Initial commit" }),
      logLine("d".repeat(40), { date: "2026-11-02", subject: "Merge branch 'main' into x" }),
      logLine("e".repeat(40), { date: "2026-11-02", subject: "Fix #12 in the list" }),
    ].join("\n");
    expect(mergedPrs(log), "other commits").toEqual([]);
  });
});

describe("doneRows", () => {
  it("counts each link of a Done row with several links", () => {
    const md = status([row("2026-11-01", 7), row("2026-11-02", 8, 10)]);
    expect(doneRows(md).prs, "links of the Done rows").toEqual(new Set([7, 8, 10]));
  });

  it("does not count a link in a section after the Done table", () => {
    const md = `${status([])}\n## Notes\n\n| 2026-11-01 | [#7](${LINK}/7) merged. |\n`;
    expect(doneRows(md).prs, "links after Done").toEqual(new Set());
  });

  it("reports a broken Done row", () => {
    const md = status([`| [#7](${LINK}/7) merged. |`]);
    expect(doneRows(md).problems, "problems of a broken row").toEqual([
      `docs/status.md Done row is not "| YYYY-MM-DD | … |": | [#7](${LINK}/7) merged. |`,
    ]);
  });

  it("counts no link of a broken Done row", () => {
    const md = status([`| 18 Nov | [#7](${LINK}/7) merged. |`]);
    expect(doneRows(md).prs, "links of a broken row").toEqual(new Set());
  });

  it("reports a status file with no Done section", () => {
    expect(doneRows("# Status\n\n## Slices\n").problems, "no Done section").toEqual([
      "docs/status.md has no ## Done section",
    ]);
  });
});

describe("checkStatus", () => {
  it("gives the row to add for a merged PR with no Done row", () => {
    const merged = mergedPrs(merge(125, "2026-11-18"));
    expect(checkStatus({ merged, statusMd: status([]), since: SINCE }), "missing row").toEqual([
      `#125 (merged 2026-11-18, aaaaaaa) has no Done row in docs/status.md. Add: | 2026-11-18 | [#125](${LINK}/125) merged. |`,
    ]);
  });

  it("passes when the merged PR has a link in a Done row", () => {
    const merged = mergedPrs(merge(125, "2026-11-18"));
    const md = status([row("2026-11-18", 125)]);
    expect(checkStatus({ merged, statusMd: md, since: SINCE }), "row present").toEqual([]);
  });

  it("ignores a PR merged before the start date", () => {
    const merged = mergedPrs(merge(44, "2026-10-29"));
    expect(checkStatus({ merged, statusMd: status([]), since: SINCE }), "before start").toEqual([]);
  });

  it("counts a PR merged on the start date", () => {
    const merged = mergedPrs(merge(45, "2026-10-30"));
    const problems = checkStatus({ merged, statusMd: status([]), since: SINCE });
    const prs = problems.map((p) => p.split(" ")[0]);
    expect(prs, "on the start date").toEqual(["#45"]);
  });

  it("fails with the problem of a broken Done row", () => {
    const md = status([row("2026-11-18", 125), "| 18 Nov | x |"]);
    const merged = mergedPrs(merge(125, "2026-11-18"));
    expect(checkStatus({ merged, statusMd: md, since: SINCE }), "broken row").toEqual([
      'docs/status.md Done row is not "| YYYY-MM-DD | … |": | 18 Nov | x |',
    ]);
  });

  it("skips a memory promotion PR: each changed file is in long-term memory", () => {
    const merged = mergedPrs(merge(140, "2026-11-20"));
    const changedFiles = (): ChangedFile[] => [
      changed(".agents/memories/long-term/state.md", "# State\n"),
      changed(".agents/memories/long-term/rules/R-014-x.md", PLAIN_RULE, PLAIN_RULE),
    ];
    const problems = checkStatus({ merged, statusMd: status([]), since: SINCE, changedFiles });
    expect(problems, "promotion PR").toEqual([]);
  });

  it("does not skip a PR when a file has owner-merges before or after the merge", () => {
    const cases = [
      { when: "before and after the merge", texts: [OWNER_RULE, OWNER_RULE] },
      { when: "before the merge only: the PR removes it", texts: [OWNER_RULE, PLAIN_RULE] },
      { when: "after the merge only: the PR adds it", texts: [PLAIN_RULE, OWNER_RULE] },
      { when: "in a new file", texts: [OWNER_RULE] },
    ];
    const merged = mergedPrs(merge(140, "2026-11-20"));
    for (const { when, texts } of cases) {
      const changedFiles = (): ChangedFile[] => [
        changed(".agents/memories/long-term/state.md", "# State\n"),
        changed(RULE_PATH, ...texts),
      ];
      const problems = checkStatus({ merged, statusMd: status([]), since: SINCE, changedFiles });
      const prs = problems.map((p) => p.split(" ")[0]);
      expect(prs, `owner-merges ${when}`).toEqual(["#140"]);
    }
  });

  it("does not skip a PR with one changed file outside long-term memory", () => {
    const merged = mergedPrs(merge(140, "2026-11-20"));
    const changedFiles = (): ChangedFile[] => [
      changed(".agents/memories/long-term/state.md", "# State\n"),
      changed("docs/status.md"),
    ];
    const problems = checkStatus({ merged, statusMd: status([]), since: SINCE, changedFiles });
    const prs = problems.map((p) => p.split(" ")[0]);
    expect(prs, "one file outside long-term memory").toEqual(["#140"]);
  });
});

describe("ownerMerges", () => {
  it("reads the field in the frontmatter", () => {
    expect(ownerMerges(OWNER_RULE), "frontmatter").toBe(true);
  });

  it("does not read the field in the body or with another value", () => {
    expect(ownerMerges("---\nid: R-002\n---\nowner-merges: true\n"), "body").toBe(false);
    expect(ownerMerges("---\nowner-merges: false\n---\n"), "false").toBe(false);
    expect(ownerMerges("owner-merges: true\n"), "no frontmatter").toBe(false);
  });
});

describe("the files that the owner merges", () => {
  const folder = ".agents/memories/long-term";
  const rules = readdirSync(`${folder}/rules`);
  it("gives owner-merges: true to identity.md and each rule about merges", () => {
    const names = ["identity.md", "R-001", "R-002", "R-003", "R-004", "R-005", "R-007", "R-035"];
    for (const name of names) {
      const file = name.endsWith(".md")
        ? `${folder}/${name}`
        : `${folder}/rules/${rules.find((rule) => rule.startsWith(`${name}-`)) ?? name}`;
      expect(ownerMerges(readFileSync(file, "utf8")), file).toBe(true);
    }
  });
});

describe("readHistory", () => {
  let repo: string;
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.invalid",
  };
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "check-status-"));
    git("init", "-q", "-b", "main");
    git("commit", "-q", "--allow-empty", "-m", "Initial commit");
    // #1: a branch merged into main.
    git("checkout", "-q", "-b", "one");
    git("commit", "-q", "--allow-empty", "-m", "one");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "one", "-m", "Merge pull request #1 from owner/one");
    // #2 merges into the branch of #3, not into main; then #3 merges into main.
    git("checkout", "-q", "-b", "three");
    git("checkout", "-q", "-b", "two");
    git("commit", "-q", "--allow-empty", "-m", "two");
    git("checkout", "-q", "three");
    git("merge", "-q", "--no-ff", "two", "-m", "Merge pull request #2 from owner/two");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "three", "-m", "Merge pull request #3 from owner/three");
    // #4: the merge that a push to main checks; CI reads HEAD^1, the history before it.
    git("checkout", "-q", "-b", "four");
    git("commit", "-q", "--allow-empty", "-m", "four");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "four", "-m", "Merge pull request #4 from owner/four");
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("does not list a PR merged into another PR's branch", () => {
    const history = readHistory(repo, "HEAD");
    const prs = mergedPrs(history.log).map((m) => m.pr);
    expect(prs, "PRs on the first-parent line").toEqual([4, 3, 1]);
  });

  it("does not list the merge of HEAD when it reads HEAD^1", () => {
    const history = readHistory(repo, "HEAD^1");
    const prs = mergedPrs(history.log).map((m) => m.pr);
    expect(prs, "PRs before the merge of HEAD").toEqual([3, 1]);
  });

  it("reports a shallow clone", () => {
    const shallow = mkdtempSync(join(tmpdir(), "check-status-shallow-"));
    try {
      execFileSync("git", ["clone", "-q", "--depth", "1", `file://${repo}`, shallow], { env });
      expect(readHistory(shallow, "HEAD").problems, "shallow clone").toEqual([
        "the clone is shallow, so merges can be missing: fetch the whole history (fetch-depth: 0)",
      ]);
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
  });
});

describe("mergeFiles", () => {
  it("lists the files that a merge commit changes against its first parent", () => {
    const repo = mkdtempSync(join(tmpdir(), "check-status-files-"));
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.invalid",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.invalid",
    };
    const git = (...args: string[]): string =>
      execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
    try {
      git("init", "-q", "-b", "main");
      git("commit", "-q", "--allow-empty", "-m", "Initial commit");
      git("checkout", "-q", "-b", "memory");
      execFileSync("mkdir", ["-p", join(repo, "a")]);
      execFileSync("touch", [join(repo, "a/one.md"), join(repo, "a/two.md")]);
      git("add", ".");
      git("commit", "-q", "-m", "two files");
      git("checkout", "-q", "main");
      git("merge", "-q", "--no-ff", "memory", "-m", "Merge pull request #5 from owner/memory");
      const sha = git("rev-parse", "HEAD").trim();
      expect(mergeFiles(repo, sha), "files of the merge").toEqual(["a/one.md", "a/two.md"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  // A merge of branch `memory` into main, after `change` ran on that branch (review round 1 of
  // #139, DQ-878).
  function filesOfMerge(change: (repo: string, git: (...args: string[]) => string) => void): {
    files: string[];
    changes: ChangedFile[];
  } {
    const repo = mkdtempSync(join(tmpdir(), "check-status-files-"));
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.invalid",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.invalid",
    };
    const git = (...args: string[]): string =>
      execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
    try {
      git("init", "-q", "-b", "main");
      execFileSync("mkdir", ["-p", join(repo, "docs"), join(repo, ".agents/memories/long-term")]);
      execFileSync("mkdir", ["-p", join(repo, ".agents/memories/long-term/rules")]);
      writeFileSync(join(repo, "docs/policy.md"), "A policy of the project.\n");
      writeFileSync(join(repo, RULE_PATH), OWNER_RULE);
      git("add", ".");
      git("commit", "-q", "-m", "Initial commit");
      git("checkout", "-q", "-b", "memory");
      change(repo, git);
      git("commit", "-q", "-m", "change");
      git("checkout", "-q", "main");
      git("merge", "-q", "--no-ff", "memory", "-m", "Merge pull request #6 from owner/memory");
      const sha = git("rev-parse", "HEAD").trim();
      return { files: mergeFiles(repo, sha), changes: mergeChanges(repo, sha) };
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }

  it("lists a file name with non-ASCII characters as it is", () => {
    const name = ".agents/memories/long-term/ghi-chú.md";
    const merge = filesOfMerge((repo, git) => {
      writeFileSync(join(repo, name), "x\n");
      git("add", ".");
    });
    expect(merge.files, "non-ASCII name").toEqual([name]);
  });

  it("lists both paths of a file that moves into long-term memory", () => {
    const merge = filesOfMerge((_repo, git) => {
      git("mv", "docs/policy.md", ".agents/memories/long-term/policy.md");
    });
    expect(merge.files, "both paths of a move").toEqual([
      ".agents/memories/long-term/policy.md",
      "docs/policy.md",
    ]);
  });

  it("gives the text of a long-term file before and after the merge", () => {
    const merge = filesOfMerge((repo, git) => {
      writeFileSync(join(repo, RULE_PATH), PLAIN_RULE);
      writeFileSync(join(repo, ".agents/memories/long-term/new.md"), "A new file.\n");
      writeFileSync(join(repo, "docs/policy.md"), "A new policy.\n");
      git("add", ".");
    });
    expect(merge.changes, "texts of the merge").toEqual([
      { path: ".agents/memories/long-term/new.md", texts: ["A new file.\n"] },
      { path: RULE_PATH, texts: [OWNER_RULE, PLAIN_RULE] },
      { path: "docs/policy.md", texts: [] },
    ]);
  });
});
