import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addExcludeLines, memoryPaths, trackedPaths } from "./lib/check-memory-local.ts";
import {
  checkExclude,
  checkFormats,
  checkLinks,
  checkMemory,
  checkPrivacy,
  checkPrivateWords,
  checkQuotes,
  checkRequiredFiles,
  checkRules,
  checkRulesIndex,
  checkSchema,
  checkSizes,
  checkTracked,
  readSettings,
  rulesIndex,
} from "./lib/check-memory.ts";

// The chief memory (.agents/memories/README.md). Each test starts from a valid tree and breaks
// one thing. All values are synthetic (principle-safe-test-data): a private value is built from
// parts at run time.

const M = ".agents/memories";
const L = `${M}/long-term`;
const R = `${L}/rules`;
const R1 = `${R}/R-001-old-rule.md`;
const R2 = `${R}/R-002-new-rule.md`;

const SETTINGS: [string, string][] = [
  ["leader_cap", "2"],
  ["heavy_runs_at_once", "1"],
  ["checkpoint_left_percent", "40"],
  ["context_window_tokens", "1000000"],
  ["review_cap", "5"],
  ["promote_after_hours", "24"],
  ["drill_every_days", "7"],
  ["boot_max_kb", "48"],
  ["identity_max_lines", "80"],
  ["rule_max_lines", "30"],
  ["state_max_lines", "80"],
  ["lessons_max_lines", "200"],
  ["quote_max_words", "25"],
  ["heavy_commands", "pnpm test, pnpm e2e"],
  ["model_easy", "a small model"],
  ["model_medium", "a medium model"],
  ["model_hard", "a large model"],
  ["chief_model", "the model that the owner names"],
  ["owner_language", "simple English"],
  ["owner_pages", "one question per step"],
];

function settings(rows: [string, string][] = SETTINGS): string {
  return [
    "# Settings",
    "",
    "| Key | Value | Source |",
    "| --- | --- | --- |",
    ...rows.map(([key, value]) => `| \`${key}\` | ${value} | owner, 2026-11-13 |`),
    "",
  ].join("\n");
}

type Fields = Record<string, string>;

const R1_FIELDS: Fields = {
  id: "R-001",
  title: "The old rule.",
  status: "replaced",
  scope: "chief",
  said: "2026-11-13",
  orders: "[3]",
  ends: "never",
  supersedes: "[]",
  amends: "[]",
};
const R2_FIELDS: Fields = {
  id: "R-002",
  title: "The new rule.",
  status: "active",
  scope: "leaders",
  said: "2026-11-15",
  orders: "[54, 67]",
  ends: "until the M3 review",
  supersedes: "[R-001]",
  amends: "[]",
};
const BODY = [
  "Rule: Do one thing.",
  'Owner said: "do one thing at a time" (2026-11-15)',
  "How to apply: Do it.",
  "",
].join("\n");

function rule(fields: Fields, body = BODY): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
  return ["---", ...lines, "---", body].join("\n");
}

function tree(changes: Record<string, string | undefined> = {}): Map<string, string> {
  const files = new Map<string, string>([
    [`${M}/README.md`, "# Chief memory\n\nMemory schema: 1\n"],
    [`${L}/README.md`, "# long-term\n"],
    [`${L}/identity.md`, "# Identity\n"],
    [`${L}/settings.md`, settings()],
    [`${L}/environment.md`, "# Environment\n"],
    [`${L}/lessons.md`, "# Lessons\n\n- L-01 (2026-11-13): A trap. Fix: a fix.\n"],
    [
      `${L}/state.md`,
      "# State\n\nAs of: 2026-11-19\nMain: 934b6ad\nPromoted through: 2026-11-19\n",
    ],
    [`${L}/restore.md`, "# Restore\n"],
    [`${L}/restore-drill.md`, "# Restore drill\n"],
    [`${L}/log.md`, "# Log\n\n## [2026-11-19] migrate | the first content\n"],
    [R1, rule(R1_FIELDS)],
    [R2, rule(R2_FIELDS)],
    [`${M}/short-term/README.md`, "# short-term\n"],
  ]);
  files.set(`${R}/README.md`, rulesIndex(files));
  for (const [path, text] of Object.entries(changes)) {
    if (text === undefined) files.delete(path);
    else files.set(path, text);
  }
  return files;
}

const LIMITS = readSettings(settings()).limits;

function rulesWith(path: string, text: string): string[] {
  return checkRules(tree({ [path]: text }), LIMITS);
}

describe("the whole memory", () => {
  it("passes a valid tree", () => {
    const files = tree();
    const tracked = [`${M}/short-term/README.md`];
    expect(
      checkMemory({ files, exists: (path) => files.has(path), tracked }),
      "valid tree",
    ).toEqual([]);
  });
});

describe("checkSchema", () => {
  it("names a schema that is newer than the check", () => {
    expect(checkSchema("Memory schema: 2\n"), "schema 2").toEqual([
      `${M}/README.md: memory schema 2 is newer than this check (schema 1); update scripts/lib/check-memory.ts first`,
    ]);
  });

  it("names a README with no schema line", () => {
    expect(checkSchema("# Chief memory\n"), "no schema line").toEqual([
      `${M}/README.md: no "Memory schema: <n>" line`,
    ]);
  });
});

describe("checkRequiredFiles", () => {
  it("names a missing file", () => {
    expect(checkRequiredFiles(tree({ [`${L}/state.md`]: undefined })), "no state.md").toEqual([
      `${L}/state.md: the file is missing`,
    ]);
  });
});

describe("readSettings", () => {
  it("names a missing setting", () => {
    const rows = SETTINGS.filter(([key]) => key !== "leader_cap");
    expect(readSettings(settings(rows)).problems, "no leader_cap").toEqual([
      `${L}/settings.md: setting \`leader_cap\` is missing`,
    ]);
  });

  it("names an unknown setting", () => {
    const rows: [string, string][] = [...SETTINGS, ["colour", "blue"]];
    expect(readSettings(settings(rows)).problems, "unknown key").toEqual([
      `${L}/settings.md: setting \`colour\` is not a known key`,
    ]);
  });

  it("names a number setting that is not a whole number", () => {
    const rows = SETTINGS.map(([key, value]): [string, string] =>
      key === "leader_cap" ? [key, "two"] : [key, value],
    );
    expect(readSettings(settings(rows)).problems, "not a number").toEqual([
      `${L}/settings.md: setting \`leader_cap\` is "two"; it must be a whole number`,
    ]);
  });
});

describe("checkRules: fields", () => {
  it("names a file with no frontmatter", () => {
    expect(rulesWith(R2, BODY), "no frontmatter").toContain(
      `${R2}: no frontmatter; the file must start with a "---" line`,
    );
  });

  it("names a missing field", () => {
    const fields = Object.fromEntries(Object.entries(R2_FIELDS).filter(([key]) => key !== "scope"));
    expect(rulesWith(R2, rule(fields)), "no scope").toEqual([`${R2}: field \`scope\` is missing`]);
  });

  it("names an unknown field", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, colour: "blue" })), "unknown field").toEqual([
      `${R2}: field \`colour\` is not a rule field`,
    ]);
  });

  it("names a status that is not in the list", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, status: "open" })), "bad status").toEqual([
      `${R2}: field \`status\` is "open"; use one of active, replaced, ended, disputed`,
    ]);
  });

  it("names a scope that is not in the list", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, scope: "everyone" })), "bad scope").toEqual([
      `${R2}: field \`scope\` is "everyone"; use one of chief, leaders, all-agents`,
    ]);
  });

  it("names a said date that is not a date", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, said: "2026-13-01" })), "bad date").toEqual([
      `${R2}: field \`said\` is "2026-13-01"; it must be a date YYYY-MM-DD`,
    ]);
  });

  it("names an order that is not a whole number", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, orders: "[54, x]" })), "bad order").toEqual([
      `${R2}: field \`orders\` has "x"; each order is a whole number`,
    ]);
  });

  it("names an end that is not never, a date or until", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, ends: "soon" })), "bad end").toEqual([
      `${R2}: field \`ends\` is "soon"; use never, a date YYYY-MM-DD or "until <event>"`,
    ]);
  });

  it("names an id that is not R- and three digits", () => {
    const path = `${R}/R-1-new-rule.md`;
    const files = tree({ [R2]: undefined, [path]: rule({ ...R2_FIELDS, id: "R-1" }) });
    expect(checkRules(files, LIMITS), "bad id").toContain(
      `${path}: field \`id\` is "R-1"; it must be R- and three digits`,
    );
  });

  it("names a file name that does not start with its id", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, id: "R-003" })), "name and id differ").toContain(
      `${R2}: the file name must be "R-003-<words>.md"`,
    );
  });

  it("names two files with one id", () => {
    const copy = `${R}/R-002-copy.md`;
    const files = tree({ [copy]: rule(R2_FIELDS) });
    // The files are read in name order: the first one keeps the id.
    expect(checkRules(files, LIMITS), "duplicate id").toEqual([
      `${R2}: id R-002 is also the id of ${copy}`,
    ]);
  });
});

describe("checkRules: links between rules", () => {
  it("names a supersedes target that does not exist", () => {
    const fields = { ...R2_FIELDS, supersedes: "[R-001, R-009]" };
    expect(rulesWith(R2, rule(fields)), "missing target").toEqual([
      `${R2}: \`supersedes\` names R-009, which does not exist`,
    ]);
  });

  it("names a loop of supersedes and amends", () => {
    const files = tree({ [R1]: rule({ ...R1_FIELDS, amends: "[R-002]" }) });
    expect(checkRules(files, LIMITS), "loop").toEqual([
      `${R1}: \`supersedes\` and \`amends\` make a loop: R-001 -> R-002 -> R-001`,
    ]);
  });

  it("passes the field owner-merges: true", () => {
    const fields = { ...R2_FIELDS, "owner-merges": "true" };
    expect(rulesWith(R2, rule(fields)), "owner-merges").toEqual([]);
  });

  it("names an owner-merges value that is not true", () => {
    const fields = { ...R2_FIELDS, "owner-merges": "yes" };
    expect(rulesWith(R2, rule(fields)), "owner-merges: yes").toEqual([
      `${R2}: field \`owner-merges\` is "yes"; write true, or leave the field out`,
    ]);
  });

  it("names a rule that changes a rule with owner-merges and has no field", () => {
    const files = tree({ [R1]: rule({ ...R1_FIELDS, "owner-merges": "true" }) });
    expect(checkRules(files, LIMITS), "a new rule without the field").toEqual([
      `${R2}: it changes R-001, which has \`owner-merges: true\`, so it needs the field too`,
    ]);
  });

  it("passes a rule that changes a rule with owner-merges and has the field too", () => {
    const files = tree({
      [R1]: rule({ ...R1_FIELDS, "owner-merges": "true" }),
      [R2]: rule({ ...R2_FIELDS, "owner-merges": "true" }),
    });
    expect(checkRules(files, LIMITS), "both rules have the field").toEqual([]);
  });

  it("names a superseded rule that is still active", () => {
    expect(rulesWith(R1, rule({ ...R1_FIELDS, status: "active" })), "active").toEqual([
      `${R1}: R-002 supersedes R-001, so its status must be replaced, not active`,
    ]);
  });

  it("names a replaced rule that no rule supersedes", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, supersedes: "[]" })), "no successor").toEqual([
      `${R1}: the status is replaced, but no rule supersedes R-001`,
    ]);
  });
});

describe("checkRules: body", () => {
  it("names a rule with no Rule line", () => {
    const body = BODY.replace("Rule: Do one thing.\n", "");
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "no Rule line").toEqual([
      `${R2}: no "Rule:" line`,
    ]);
  });

  it("names a rule with no Owner said line", () => {
    const body = BODY.replace(/^Owner said:.*\n/m, "");
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "no Owner said line").toEqual([
      `${R2}: no "Owner said:" line`,
    ]);
  });

  it("names a quote over the word limit", () => {
    const quote = Array.from({ length: 26 }, () => "word").join(" ");
    const body = BODY.replace("do one thing at a time", quote);
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "long quote").toEqual([
      `${R2}: an "Owner said:" quote has 26 words; the limit is 25 (setting quote_max_words)`,
    ]);
  });

  it("counts the quotes of one Owner said line together", () => {
    const half = Array.from({ length: 13 }, () => "word").join(" ");
    const body = BODY.replace('"do one thing at a time"', `"${half}" and "${half}"`);
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "two quotes on one line").toEqual([
      `${R2}: an "Owner said:" quote has 26 words; the limit is 25 (setting quote_max_words)`,
    ]);
  });

  it("names a rule id with RegExp characters, with no exception", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, id: "R-(1" })), "id R-(1").toEqual([
      `${R2}: field \`id\` is "R-(1"; it must be R- and three digits`,
      `${R2}: the file name must be "R-(1-<words>.md"`,
    ]);
  });

  it("names a quote with no date", () => {
    const body = BODY.replace(" (2026-11-15)", "");
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "no date").toEqual([
      `${R2}: an "Owner said:" line has no date (YYYY-MM-DD)`,
    ]);
  });

  it("names an Owner said line with no quote", () => {
    const body = BODY.replace('"do one thing at a time"', "do one thing");
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "no quote").toEqual([
      `${R2}: an "Owner said:" line has no quote in double quotes`,
    ]);
  });

  it("names a rule over the line limit", () => {
    const body = `${BODY}${"More.\n".repeat(30)}`;
    expect(rulesWith(R2, rule(R2_FIELDS, body)), "long rule").toEqual([
      `${R2}: 44 lines; the limit is 30 (setting rule_max_lines)`,
    ]);
  });
});

describe("rulesIndex", () => {
  it("lists the active rules first, then the others with their successor", () => {
    const index = rulesIndex(tree());
    expect(index, "active row").toContain(
      "| `R-002-new-rule.md` | The new rule. | leaders | until the M3 review | |",
    );
    expect(index, "replaced row").toContain(
      "| `R-001-old-rule.md` | The old rule. | replaced | R-002 |",
    );
    expect(index.indexOf("R-002-new-rule.md"), "active first").toBeLessThan(
      index.indexOf("R-001-old-rule.md"),
    );
  });

  it("names a hand change of the index", () => {
    const files = tree();
    const index = files.get(`${R}/README.md`) ?? "";
    files.set(`${R}/README.md`, index.replace("The new rule.", "A changed rule."));
    expect(checkRulesIndex(files), "changed index").toEqual([
      `${R}/README.md: it is not the generated index; run pnpm check:memory --write`,
    ]);
  });
});

describe("checkFormats", () => {
  it("names a state file with no Main line", () => {
    const state = "# State\n\nAs of: 2026-11-19\nPromoted through: 2026-11-19\n";
    expect(checkFormats(tree({ [`${L}/state.md`]: state })), "no Main").toEqual([
      `${L}/state.md: no "Main: <commit>" line`,
    ]);
  });

  it("names a lesson line with no id", () => {
    const lessons = "# Lessons\n\n- A trap with no id.\n";
    expect(checkFormats(tree({ [`${L}/lessons.md`]: lessons })), "bad lesson").toEqual([
      `${L}/lessons.md:3: a lesson line must start with "- L-<n> (YYYY-MM-DD): "`,
    ]);
  });

  it("names two lessons with one id", () => {
    const lessons =
      "# Lessons\n\n- L-01 (2026-11-13): A. Fix: B.\n- L-01 (2026-11-14): C. Fix: D.\n";
    expect(checkFormats(tree({ [`${L}/lessons.md`]: lessons })), "duplicate lesson").toEqual([
      `${L}/lessons.md:4: lesson id L-01 is used two times`,
    ]);
  });

  it("names a log heading in the wrong form", () => {
    const log = "# Log\n\n## 2026-11-19 promote\n";
    expect(checkFormats(tree({ [`${L}/log.md`]: log })), "bad log").toEqual([
      `${L}/log.md:3: a log heading must be "## [YYYY-MM-DD] promote|lint|restore|migrate | <text>"`,
    ]);
  });
});

describe("checkPrivacy", () => {
  function found(text: string): string[] {
    return checkPrivacy(tree({ [`${L}/environment.md`]: `# Environment\n\n${text}\n` }));
  }
  const where = `${L}/environment.md:3`;

  it("passes public facts", () => {
    expect(found("Use 127.0.0.1, commit 934b6ad, PR #139 and DQ-876."), "public").toEqual([]);
  });

  it("finds a Linux home folder path", () => {
    expect(found(["See /", "home", "/someone/notes."].join("")), "home path").toEqual([
      `${where}: a home folder path; the memory is public, so remove it`,
    ]);
  });

  it("finds a macOS home folder path", () => {
    expect(found(["See /", "Users", "/someone/notes."].join("")), "Users path").toEqual([
      `${where}: a home folder path; the memory is public, so remove it`,
    ]);
  });

  it("finds a path from the home folder", () => {
    expect(found(["See ", "~", "/.claude/notes."].join("")), "tilde path").toEqual([
      `${where}: a home folder path; the memory is public, so remove it`,
    ]);
  });

  it("finds an email address", () => {
    expect(found(["Mail person", "@", "example.test now."].join("")), "email").toEqual([
      `${where}: an email address; the memory is public, so remove it`,
    ]);
  });

  it("finds a uuid", () => {
    const uuid = ["0123abcd", "4567", "89ab", "cdef", "0123456789ab"].join("-");
    expect(found(`It is ${uuid}.`), "uuid").toEqual([
      `${where}: a uuid; the memory is public, so remove it`,
    ]);
  });

  it("finds a job id", () => {
    expect(found(["It ran as job", " ", "abcdef12."].join("")), "job id").toEqual([
      `${where}: a session, job, agent or ref id; the memory is public, so remove it`,
    ]);
  });

  it("finds an sk- key", () => {
    expect(found(["Key sk", "-", "a".repeat(24), "."].join("")), "sk- key").toEqual([
      `${where}: a key or a token; the memory is public, so remove it`,
    ]);
  });

  it("finds a ghp_ token", () => {
    expect(found(["Token ghp", "_", "b".repeat(30), "."].join("")), "ghp_ token").toEqual([
      `${where}: a key or a token; the memory is public, so remove it`,
    ]);
  });

  it("finds a github_pat_ token", () => {
    expect(
      found(["Token github_pat", "_", "c".repeat(30), "."].join("")),
      "github_pat_ token",
    ).toEqual([`${where}: a key or a token; the memory is public, so remove it`]);
  });

  it("finds an AKIA key", () => {
    expect(found(["Key AKIA", "D".repeat(16), "."].join("")), "AKIA key").toEqual([
      `${where}: a key or a token; the memory is public, so remove it`,
    ]);
  });

  it("finds an xox token", () => {
    expect(found(["Token xoxb", "-", "1".repeat(12), "."].join("")), "xox token").toEqual([
      `${where}: a key or a token; the memory is public, so remove it`,
    ]);
  });

  it("finds a private key block", () => {
    expect(found(["-----", "BEGIN PRIVATE KEY", "-----"].join("")), "private key").toEqual([
      `${where}: a key or a token; the memory is public, so remove it`,
    ]);
  });

  it("finds an IP address", () => {
    expect(found(`Host ${["10", "1", "2", "3"].join(".")}.`), "IP").toEqual([
      `${where}: an IP address; the memory is public, so remove it`,
    ]);
  });

  it("finds a claude attach id", () => {
    expect(found(["Run claude attach", " ", "abc123."].join("")), "attach id").toEqual([
      `${where}: a claude attach id; the memory is public, so remove it`,
    ]);
  });

  it("finds a path into tmp/", () => {
    expect(found(["Read `tmp", "/worktrees/README.md`."].join("")), "tmp path").toEqual([
      `${where}: a path into tmp/, which is on one machine only; remove it`,
    ]);
  });

  // The forms below came from review round 1 of #139 (DQ-879).
  const ID = "a session, job, agent or ref id; the memory is public, so remove it";
  const KEY = "a key or a token; the memory is public, so remove it";
  const TMP = "a path into tmp/, which is on one machine only; remove it";
  const lines = (count: number, kind: string): string[] =>
    Array.from({ length: count }, (_, k) => `${L}/environment.md:${k + 3}: ${kind}`);

  it("finds a base62 session id", () => {
    const problems = found(["Resume session", "_", "01WaaXyZ9kLm."].join(""));
    expect(problems, "base62 session id").toEqual([`${where}: ${ID}`]);
  });

  it("finds a session link of the web app", () => {
    const link = ["Trailer: https://claude.ai/code/session", "_", "01WaaXyZ9kLm"].join("");
    expect(found(link), "session link").toEqual([`${where}: ${ID}`]);
  });

  it("finds a job id that is not hex", () => {
    expect(found(["The job", "-id: b8f3k2."].join("")), "non-hex job id").toEqual([
      `${where}: ${ID}`,
    ]);
  });

  it("finds an agent id", () => {
    expect(found(["Ask agent", " a1b2c3d4e5."].join("")), "agent id").toEqual([`${where}: ${ID}`]);
  });

  it("finds a session id after the word id", () => {
    const problems = found(["The session", " id: abcdef12."].join(""));
    expect(problems, "session id after id").toEqual([`${where}: ${ID}`]);
  });

  it("finds a Google API key", () => {
    expect(found(["Key AI", "za", "Q".repeat(35), "."].join("")), "Google key").toEqual([
      `${where}: ${KEY}`,
    ]);
  });

  it("finds the other GitHub token kinds", () => {
    const tokens = ["gho", "ghs", "ghu", "ghr"].map((kind) => `${kind}_${"e".repeat(30)}`);
    expect(found(tokens.join("\n")), "GitHub token kinds").toEqual(lines(4, KEY));
  });

  it("finds a JWT", () => {
    const part = "f".repeat(12);
    const jwt = ["ey", "J", part, ".", part, ".", part].join("");
    expect(found(`Token ${jwt}.`), "JWT").toEqual([`${where}: ${KEY}`]);
  });

  it("finds tmp paths in other forms", () => {
    const paths = ["See ./tmp/x.md.", 'See "tmp/x.md".', "See project/tmp/owner/x.html."];
    expect(found(paths.join("\n")), "tmp path forms").toEqual(lines(3, TMP));
  });

  it("finds the root home and a backslash home path", () => {
    const paths = [
      ["See /", "root", "/notes."].join(""),
      ["See \\", "home", "\\user\\x."].join(""),
    ];
    expect(found(paths.join("\n")), "home path forms").toEqual(
      lines(2, "a home folder path; the memory is public, so remove it"),
    );
  });

  it("finds an IPv6 address", () => {
    const short = ["2001", "db8", "", "8a2e", "370", "7334"].join(":");
    const full = ["2001", "0db8", "85a3", "0000", "0000", "8a2e", "0370", "7334"].join(":");
    expect(found(`Host ${short}.\nHost ${full}.`), "IPv6").toEqual(
      lines(2, "an IP address; the memory is public, so remove it"),
    );
  });

  it("passes the words session, job and agent in plain text", () => {
    const text = "Resume the newest session id. Each job folder goes. An agent id is private.";
    expect(found(text), "plain words").toEqual([]);
  });
});

describe("checkSizes", () => {
  it("names a file over its line limit", () => {
    const identity = `# Identity\n${"A line.\n".repeat(80)}`;
    expect(checkSizes(tree({ [`${L}/identity.md`]: identity }), LIMITS), "identity").toEqual([
      `${L}/identity.md: 81 lines; the limit is 80 (setting identity_max_lines)`,
    ]);
  });

  it("names a boot set over its size limit", () => {
    const environment = `# Environment\n${"x".repeat(50 * 1024)}\n`;
    expect(checkSizes(tree({ [`${L}/environment.md`]: environment }), LIMITS), "boot").toEqual([
      expect.stringMatching(/^the boot set is 5\d KB; the limit is 48 KB \(setting boot_max_kb\)/),
    ]);
  });
});

describe("checkLinks", () => {
  it("names a link to a file that does not exist", () => {
    const files = tree({
      [`${L}/restore.md`]: "# Restore\n\nSee [the rules](rules/R-009-x.md).\n",
    });
    expect(
      checkLinks(files, (path) => files.has(path)),
      "dead link",
    ).toEqual([
      `${L}/restore.md: the link "rules/R-009-x.md" goes to ${R}/R-009-x.md, which does not exist`,
    ]);
  });

  it("names a link that goes outside the repository", () => {
    const files = tree({ [`${L}/restore.md`]: "# Restore\n\n[x](../../../../AGENTS.md)\n" });
    const exists = (path: string): boolean => path === "AGENTS.md" || files.has(path);
    expect(checkLinks(files, exists), "link outside the repository").toEqual([
      `${L}/restore.md: the link "../../../../AGENTS.md" goes outside the repository`,
    ]);
  });

  it("passes web links, anchors and links with an anchor", () => {
    const text =
      "# Restore\n\n[a](https://example.test) [b](#top) [c](rules/R-002-new-rule.md#x)\n";
    const files = tree({ [`${L}/restore.md`]: text });
    expect(
      checkLinks(files, (path) => files.has(path)),
      "good links",
    ).toEqual([]);
  });
});

describe("checkQuotes", () => {
  it("names a long quote in identity.md, lessons.md and state.md", () => {
    const long = `"${Array.from({ length: 26 }, () => "word").join(" ")}"`;
    const files = tree({
      [`${L}/identity.md`]: `# Identity\n\n- The owner said ${long}.\n`,
      [`${L}/lessons.md`]: `# Lessons\n\n- L-01 (2026-11-13): A trap ${long}. Fix: a fix.\n`,
      [`${L}/state.md`]: `# State\n\nAs of: 2026-11-19\nMain: 934b6ad\nPromoted through: 2026-11-19\n${long}\n`,
    });
    const limit = "a quote has 26 words; the limit is 25 (setting quote_max_words)";
    expect(checkQuotes(files, LIMITS), "long quotes").toEqual([
      `${L}/identity.md:3: ${limit}`,
      `${L}/lessons.md:3: ${limit}`,
      `${L}/state.md:6: ${limit}`,
    ]);
  });

  it("passes short quotes", () => {
    const files = tree({ [`${L}/identity.md`]: '# Identity\n\n- Call them "the owner".\n' });
    expect(checkQuotes(files, LIMITS), "short quote").toEqual([]);
  });
});

describe("memoryPaths and trackedPaths (git file lists)", () => {
  it("reads non-ASCII file names from git", () => {
    const repo = mkdtempSync(join(tmpdir(), "check-memory-git-"));
    const git = (...args: string[]): string =>
      execFileSync("git", args, { cwd: repo, encoding: "utf8" });
    try {
      git("init", "-q");
      const name = "ghi-chú.md";
      mkdirSync(join(repo, L), { recursive: true });
      mkdirSync(join(repo, `${M}/short-term`), { recursive: true });
      writeFileSync(join(repo, L, name), "x\n");
      writeFileSync(join(repo, M, "short-term", name), "x\n");
      git("add", "--", `${M}/short-term/${name}`);
      const paths = { memory: memoryPaths(repo), tracked: trackedPaths(repo) };
      expect(paths, "non-ASCII names").toEqual({
        memory: [`${L}/${name}`, `${M}/short-term/${name}`],
        tracked: [`${M}/short-term/${name}`],
      });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("checkTracked", () => {
  it("names a short-term file that git tracks", () => {
    const tracked = [`${M}/short-term/README.md`, `${M}/short-term/now.md`];
    expect(checkTracked(tracked), "tracked short-term file").toEqual([
      `${M}/short-term/now.md: git tracks a short-term file; it is private: run git rm --cached on it`,
    ]);
  });
});

describe("checkExclude", () => {
  it("names a missing ignore line", () => {
    const problems = checkExclude("# git ls-files --others --exclude-from=.git/info/exclude\n");
    expect(problems, "both lines missing").toEqual([
      `.git/info/exclude: no line "/${M}/short-term/*"; run pnpm check:memory --local --fix`,
      `.git/info/exclude: no line "!/${M}/short-term/README.md"; run pnpm check:memory --local --fix`,
    ]);
  });
});

describe("addExcludeLines (--local --fix)", () => {
  // Each test works in its own temporary folder; .git/info/ can be missing in a fresh clone.
  function inTempFolder(test: (folder: string) => void): void {
    const folder = mkdtempSync(join(tmpdir(), "check-memory-"));
    try {
      test(folder);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it("creates a missing exclude file with the two lines", () => {
    inTempFolder((folder) => {
      const path = join(folder, "info", "exclude");
      addExcludeLines(path);
      expect(checkExclude(readFileSync(path, "utf8")), "new file").toEqual([]);
    });
  });

  it("adds nothing on a second run", () => {
    inTempFolder((folder) => {
      const path = join(folder, "info", "exclude");
      const first = addExcludeLines(path);
      addExcludeLines(path);
      expect(readFileSync(path, "utf8"), "file after the second run").toBe(first);
    });
  });

  it("keeps the old text of the file", () => {
    inTempFolder((folder) => {
      const path = join(folder, "exclude");
      writeFileSync(path, "# local");
      addExcludeLines(path);
      expect(readFileSync(path, "utf8").startsWith("# local\n"), "old text first").toBe(true);
    });
  });

  it("adds only the missing line", () => {
    inTempFolder((folder) => {
      const path = join(folder, "exclude");
      writeFileSync(path, `/${M}/short-term/*\n`);
      const copies = addExcludeLines(path)
        .split("\n")
        .filter((line) => line === `/${M}/short-term/*`);
      expect(copies, "one copy").toHaveLength(1);
    });
  });
});

describe("checkPrivateWords", () => {
  it("finds a word of the private word list in any case", () => {
    const files = tree({ [`${L}/identity.md`]: "# Identity\n\nThe owner is Zorblat.\n" });
    expect(checkPrivateWords(files, ["zorblat"]), "private word").toEqual([
      `${L}/identity.md:3: a word of the private word list; remove it`,
    ]);
  });
});
