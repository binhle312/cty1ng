import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addExcludeLines, memoryPaths, trackedPaths } from "./lib/check-memory-local.ts";
import {
  checkExclude,
  checkFormats,
  checkLinks,
  checkMemory,
  checkMergeList,
  checkPermissionList,
  checkPrivacy,
  checkPrivateWords,
  checkQuotes,
  checkRequiredFiles,
  checkRuleQuotes,
  checkRules,
  checkRulesIndex,
  checkSchema,
  checkSizes,
  checkTracked,
  frontmatter,
  readSettings,
  rulesIndex,
} from "./lib/check-memory.ts";
import { MERGE_LIST, listSentence } from "./lib/merge-list.ts";

// The chief memory (.agents/chief/memories/README.md). Each test starts from a valid tree and breaks
// one thing. All values are synthetic (principle-safe-test-data): a private value is built from
// parts at run time.

const M = ".agents/chief/memories";
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
  ["merge_main_bonus", "3"],
  ["promote_after_hours", "24"],
  ["drill_every_days", "7"],
  ["boot_max_kb", "48"],
  ["identity_max_lines", "80"],
  ["rule_max_lines", "30"],
  ["state_max_lines", "80"],
  ["lessons_max_lines", "200"],
  ["quote_max_words", "25"],
  ["quote_min_words", "4"],
  ["audit_timeout_minutes", "30"],
  ["heavy_commands", "pnpm test, pnpm e2e"],
  ["model_easy", "a small model"],
  ["model_medium", "a medium model"],
  ["model_hard", "a large model"],
  ["chief_model", "the model that the owner names"],
  ["owner_language", "simple English"],
  ["owner_pages", "one question per step"],
  ["audit_times", "on the owner's request"],
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
  "check-first": "false",
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
  "check-first": "false",
};
const BODY = [
  "Rule: Do one thing.",
  'Owner said: "do one thing at a time" (2026-11-15)',
  "How to apply:",
  "No gate: a format.",
  "Do it.",
  "",
].join("\n");

// A rule with conditions: its "How to apply" starts with the "Check first:" line.
const CHECK_BODY = [
  "Rule: Do one thing, only when the owner asks for it.",
  'Owner said: "do one thing at a time" (2026-11-15)',
  "How to apply:",
  "Check first: does the owner ask for it? If not, do nothing.",
  "- Do it.",
  "",
].join("\n");
const CHECKED = { "permission-rule": "true", "check-first": "true" };

// The list of AGENTS.md §7 (the PRs that no standing permission covers), and a rule that copies it.
const LIST = "`AGENTS.md`, a migration, or a rule about merges";
const SHORT = "`AGENTS.md`, or a rule about merges";
function agentsText(items: string): string {
  return `# AGENTS.md\n\nMerge a PR only when the owner asks. No permission covers a PR that changes ${items}. The merge needs no line.\n`;
}
function listBody(ruleList: string, step: string | undefined): string {
  return [
    `Rule: Merge a PR that a permission covers. No permission covers a PR that changes ${ruleList}: only the owner's request covers it.`,
    'Owner said: "merge the good PRs" (2026-11-15)',
    "How to apply:",
    "Check first: these questions, in this order.",
    "1. Does the owner ask for this PR? Then merge it.",
    ...(step === undefined ? [] : [step]),
    "3. Does a permission cover the PR? Then merge it.",
    "- Then verify the merge.",
    "",
  ].join("\n");
}
function listStep(items: string): string {
  return `2. Does the PR change ${items}? Then no permission covers it. Stop.`;
}

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
    [`${L}/audit.md`, "# Memory audit\n"],
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
    const list = listSentence();
    const files = tree({
      [R2]: rule({ ...R2_FIELDS, ...CHECKED }, listBody(list, listStep(list))),
    });
    const tracked = [`${M}/short-term/README.md`];
    const agents = agentsText(list);
    expect(
      checkMemory({ files, exists: (path) => files.has(path), tracked, agents }),
      "valid tree",
    ).toEqual([]);
  });
});

describe("checkSchema", () => {
  it("names a schema that is newer than the check", () => {
    expect(checkSchema("Memory schema: 2\n"), "schema 2").toEqual([
      `${M}/README.md: memory schema 2 is newer than this check (schema 1); update .agents/chief/scripts/lib/check-memory.ts first`,
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

  it("names a missing audit prompt", () => {
    expect(checkRequiredFiles(tree({ [`${L}/audit.md`]: undefined })), "no audit.md").toEqual([
      `${L}/audit.md: the file is missing`,
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

  it("names each missing setting for the memory audit, quote check, and review cap bonus", () => {
    for (const key of [
      "quote_min_words",
      "audit_times",
      "audit_timeout_minutes",
      "merge_main_bonus",
    ]) {
      const rows = SETTINGS.filter(([name]) => name !== key);
      expect(readSettings(settings(rows)).problems, key).toEqual([
        `${L}/settings.md: setting \`${key}\` is missing`,
      ]);
    }
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

  it("names merge_main_bonus when it is not a whole number", () => {
    const rows = SETTINGS.map(([key, value]): [string, string] =>
      key === "merge_main_bonus" ? [key, "3.5"] : [key, value],
    );
    expect(readSettings(settings(rows)).problems, "fractional bonus").toEqual([
      `${L}/settings.md: setting \`merge_main_bonus\` is "3.5"; it must be a whole number`,
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

  it("passes the field permission-rule: true", () => {
    const fields = { ...R2_FIELDS, ...CHECKED };
    expect(rulesWith(R2, rule(fields, CHECK_BODY)), "permission-rule").toEqual([]);
  });

  it("names the old field owner-merges as not a rule field", () => {
    const fields = { ...R2_FIELDS, "owner-merges": "true" };
    expect(rulesWith(R2, rule(fields)), "owner-merges").toEqual([
      `${R2}: field \`owner-merges\` is not a rule field`,
    ]);
  });

  it("names a permission-rule value that is not true", () => {
    const fields = { ...R2_FIELDS, "permission-rule": "yes" };
    expect(rulesWith(R2, rule(fields)), "permission-rule: yes").toEqual([
      `${R2}: field \`permission-rule\` is "yes"; write true, or leave the field out`,
    ]);
  });

  it("names a rule that changes a rule with permission-rule and has no field", () => {
    const files = tree({ [R1]: rule({ ...R1_FIELDS, "permission-rule": "true" }) });
    expect(checkRules(files, LIMITS), "a new rule without the field").toEqual([
      `${R2}: it changes R-001, which has \`permission-rule: true\`, so it needs the field too`,
    ]);
  });

  it("passes a rule that changes a rule with permission-rule and has the field too", () => {
    const files = tree({
      [R1]: rule({ ...R1_FIELDS, "permission-rule": "true" }),
      [R2]: rule({ ...R2_FIELDS, ...CHECKED }, CHECK_BODY),
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

describe("checkRules: check first", () => {
  it("names a rule with no check-first field", () => {
    const fields = Object.fromEntries(
      Object.entries(R2_FIELDS).filter(([key]) => key !== "check-first"),
    );
    expect(rulesWith(R2, rule(fields)), "no check-first").toEqual([
      `${R2}: field \`check-first\` is missing`,
    ]);
  });

  it("names a check-first value that is not true or false", () => {
    expect(rulesWith(R2, rule({ ...R2_FIELDS, "check-first": "yes" })), "yes").toEqual([
      `${R2}: field \`check-first\` is "yes"; write true or false`,
    ]);
  });

  it("passes check-first: true with the Check first line", () => {
    const fields = { ...R2_FIELDS, "check-first": "true" };
    expect(rulesWith(R2, rule(fields, CHECK_BODY)), "the form").toEqual([]);
  });

  it("names check-first: true with no Check first line as the first line of How to apply", () => {
    const fields = { ...R2_FIELDS, "check-first": "true" };
    const later = CHECK_BODY.replace(
      "How to apply:\nCheck first: does the owner ask for it? If not, do nothing.\n- Do it.",
      "How to apply:\n- Do it.\nCheck first: does the owner ask for it? If not, do nothing.",
    );
    const inline = CHECK_BODY.replace("How to apply:\nCheck first:", "How to apply: Check first:");
    for (const [name, body] of [
      ["no line", BODY.replace("No gate: a format.\n", "")],
      ["a later line", later],
      ["on the How to apply line", inline],
    ] as const) {
      expect(rulesWith(R2, rule(fields, body)), name).toEqual([
        `${R2}: \`check-first\` is true, so the line after "How to apply:" must start with "Check first:"`,
      ]);
    }
  });

  it("names two Check first lines", () => {
    const fields = { ...R2_FIELDS, "check-first": "true" };
    const body = CHECK_BODY.replace("- Do it.", "- Do it.\nCheck first: again.");
    expect(rulesWith(R2, rule(fields, body)), "two lines").toEqual([
      `${R2}: "Check first:" is in 2 lines; write it one time`,
    ]);
  });

  it("names check-first: false with a Check first line", () => {
    expect(rulesWith(R2, rule(R2_FIELDS, CHECK_BODY)), "false with a line").toEqual([
      `${R2}: \`check-first\` is false, but a line has "Check first:"; set true, or remove the line`,
    ]);
  });

  it("names an active permission-rule rule with check-first: false", () => {
    const fields = { ...R2_FIELDS, "permission-rule": "true" };
    expect(rulesWith(R2, rule(fields)), "permission-rule, check-first false").toEqual([
      `${R2}: it has \`permission-rule: true\`, so \`check-first\` must be true`,
    ]);
  });

  it("names an active check-first: false rule whose How to apply does not start with No gate", () => {
    const inline = BODY.replace(
      "How to apply:\nNo gate: a format.\nDo it.",
      "How to apply: Do it.",
    );
    const kind = BODY.replace("No gate: a format.", "No gate: a habit.");
    const later = BODY.replace("No gate: a format.\nDo it.", "Do it.\nNo gate: a format.");
    for (const [name, body] of [
      ["on the How to apply line", inline],
      ["a kind that is not in the list", kind],
      ["a later line", later],
    ] as const) {
      expect(rulesWith(R2, rule(R2_FIELDS, body)), name).toEqual([
        `${R2}: \`check-first\` is false, so the line after "How to apply:" must be "No gate: <a format | a pre-step of your own work | a trigger | a fact>."`,
      ]);
    }
  });

  it("passes each kind of No gate line", () => {
    for (const kind of ["a format", "a pre-step of your own work", "a trigger", "a fact"]) {
      const body = BODY.replace("No gate: a format.", `No gate: ${kind}.`);
      expect(rulesWith(R2, rule(R2_FIELDS, body)), kind).toEqual([]);
    }
  });

  it("names a No gate line in a check-first: true rule", () => {
    const fields = { ...R2_FIELDS, "check-first": "true" };
    const body = CHECK_BODY.replace("- Do it.", "- Do it.\nNo gate: a fact.");
    expect(rulesWith(R2, rule(fields, body)), "true with No gate").toEqual([
      `${R2}: \`check-first\` is true, but a line has "No gate:"; remove it`,
    ]);
  });

  it("asks no No gate line of a rule that is not active", () => {
    const body = BODY.replace("How to apply:\nNo gate: a format.\nDo it.", "How to apply: Do it.");
    expect(rulesWith(R1, rule(R1_FIELDS, body)), "replaced, no No gate").toEqual([]);
  });

  it("names two How to apply lines", () => {
    const fields = { ...R2_FIELDS, "check-first": "true" };
    const body = CHECK_BODY.replace("- Do it.", "- Do it.\nHow to apply: more steps.");
    expect(rulesWith(R2, rule(fields, body)), "two blocks").toEqual([
      `${R2}: "How to apply:" is in 2 lines; write one block`,
    ]);
  });

  it("passes a replaced permission-rule rule with check-first: false", () => {
    const files = tree({
      [R1]: rule({ ...R1_FIELDS, "permission-rule": "true" }),
      [R2]: rule({ ...R2_FIELDS, ...CHECKED }, CHECK_BODY),
    });
    expect(checkRules(files, LIMITS), "replaced owner rule").toEqual([]);
  });
});

describe("checkPermissionList", () => {
  const files = (text: string): Map<string, string> =>
    tree({ [R2]: rule({ ...R2_FIELDS, ...CHECKED }, text) });
  const same = files(listBody(LIST, listStep(LIST)));
  const noStep = `${R2}: the Rule sentence lists the PRs that no permission covers, so a Check first step must ask "Does the PR change <that list>?"`;

  it("passes when AGENTS.md, the Rule sentence and the Check first step list the same items", () => {
    expect(checkPermissionList(same, agentsText(LIST)), "same").toEqual([]);
  });

  it("names a Check first step whose list is not the list of the Rule sentence", () => {
    const text = files(listBody(LIST, listStep(SHORT)));
    expect(checkPermissionList(text, agentsText(LIST)), "step").toEqual([
      `${R2}: the Check first step lists "${SHORT}", but the Rule sentence lists "${LIST}"`,
    ]);
  });

  it("reads the list step only in the Check first block", () => {
    const fence = ["```text", listStep(LIST), "```"].join("\n");
    const before = listBody(LIST, listStep(SHORT)).replace(
      "How to apply:",
      `${fence}\nHow to apply:`,
    );
    expect(checkPermissionList(files(before), agentsText(LIST)), "a code block before").toEqual([
      `${R2}: the Check first step lists "${SHORT}", but the Rule sentence lists "${LIST}"`,
    ]);
  });

  it("does not read a list step after the Check first block", () => {
    const later = listBody(LIST, undefined).replace(
      "- Then verify the merge.",
      `- Then verify the merge.\n${listStep(LIST)}`,
    );
    for (const [name, text] of [
      ["no step", listBody(LIST, undefined)],
      ["a step after the block", later],
    ] as const) {
      expect(checkPermissionList(files(text), agentsText(LIST)), name).toEqual([noStep]);
    }
  });

  it("names a list step that does not say that no permission covers the PR", () => {
    const step = `2. Does the PR change ${LIST}? Then merge it.`;
    const problems = checkPermissionList(files(listBody(LIST, step)), agentsText(LIST));
    expect(problems, "consequence").toEqual([
      `${R2}: the Check first step that asks the list must go on with "Then no permission covers it"`,
    ]);
  });

  it("names a Rule sentence whose list is not the list of AGENTS.md", () => {
    const text = files(listBody(SHORT, listStep(SHORT)));
    expect(checkPermissionList(text, agentsText(LIST)), "agents").toEqual([
      `${R2}: the Rule sentence lists "${SHORT}", but AGENTS.md §7 lists "${LIST}"`,
    ]);
  });

  it("names an AGENTS.md with no list sentence", () => {
    for (const [name, text] of [
      ["no sentence", "# AGENTS.md\n"],
      ["no file", undefined],
    ] as const) {
      expect(checkPermissionList(same, text), name).toEqual([
        `AGENTS.md: no sentence "No permission covers a PR that changes …", so the rules cannot be compared with it`,
      ]);
    }
  });

  it("names a memory where no active permission-rule rule copies the list", () => {
    const old = rule({ ...R1_FIELDS, "permission-rule": "true" }, listBody(LIST, listStep(LIST)));
    const noOwner = rule({ ...R2_FIELDS, "check-first": "true" }, listBody(LIST, listStep(LIST)));
    const plain = rule({ ...R2_FIELDS, ...CHECKED }, CHECK_BODY);
    for (const [name, changes] of [
      ["the list is gone from the rules", { [R2]: plain }],
      ["only a replaced rule has it", { [R1]: old, [R2]: plain }],
      ["only a rule with no permission-rule has it", { [R2]: noOwner }],
    ] as const) {
      expect(checkPermissionList(tree(changes), agentsText(LIST)), name).toEqual([
        `${R}: no active rule with \`permission-rule: true\` copies the list of AGENTS.md §7`,
      ]);
    }
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
      `${R2}: 47 lines; the limit is 30 (setting rule_max_lines)`,
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
    const files = tree({ [`${L}/restore.md`]: "# Restore\n\n[x](../../../../../AGENTS.md)\n" });
    const exists = (path: string): boolean => path === "AGENTS.md" || files.has(path);
    expect(checkLinks(files, exists), "link outside the repository").toEqual([
      `${L}/restore.md: the link "../../../../../AGENTS.md" goes outside the repository`,
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

describe("checkMergeList (AGENTS.md against the list file)", () => {
  it("passes an AGENTS.md sentence with the words of the list file", () => {
    expect(checkMergeList(agentsText(listSentence())), "same list").toEqual([]);
  });

  it("names an AGENTS.md sentence with an item that is not in the list file", () => {
    const short = listSentence(MERGE_LIST.filter((item) => item.text !== "a migration"));
    expect(checkMergeList(agentsText(short)), "missing item").toEqual([
      `AGENTS.md: §7 lists "${short}", but the list file (.agents/chief/scripts/lib/merge-list.ts) gives "${listSentence()}"`,
    ]);
  });
});

describe("checkRuleQuotes (--local: the owner record, order 109)", () => {
  const record = ['Order 54: "do one thing at a time"\n'];
  it("passes rules whose quotes are in the owner record", () => {
    expect(checkRuleQuotes({ files: tree(), record, limits: LIMITS }), "in record").toEqual({
      problems: [],
      warnings: [],
    });
  });

  it("names a rule whose quote is not in the owner record", () => {
    const body = BODY.replace("do one thing at a time", "do two things at a time");
    const result = checkRuleQuotes({
      files: tree({ [R2]: rule(R2_FIELDS, body) }),
      record,
      limits: LIMITS,
    });
    expect(result.problems, "not in record").toEqual([
      `${R2}: the quote "do two things at a time" is not in the owner record; a rule counts only with the owner's own words (order 109)`,
    ]);
  });

  it("warns, and checks no quote, when the owner record is missing", () => {
    expect(
      checkRuleQuotes({ files: tree(), record: undefined, limits: LIMITS }),
      "no record",
    ).toEqual({
      problems: [],
      warnings: [
        ".agents/chief/memories/short-term/owner has no .md file, so no owner quote was checked",
      ],
    });
  });
});

describe("the CLI without --local", () => {
  it("says that it does not check the owner quotes", () => {
    const args = ["--import", "tsx", ".agents/chief/scripts/check-memory.ts"];
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    expect(result.stderr, "warning").toContain(
      "warning: not checked here: the owner quotes (only --local can read the owner record)",
    );
  });
});

describe("the rules about merges, approvals or permissions", () => {
  const folder = ".agents/chief/memories/long-term/rules";
  const rules = readdirSync(folder);
  it("gives permission-rule: true to each of them", () => {
    for (const id of ["R-001", "R-002", "R-003", "R-004", "R-005", "R-007", "R-035", "R-036"]) {
      const name = rules.find((file) => file.startsWith(`${id}-`)) ?? id;
      const text = readFileSync(`${folder}/${name}`, "utf8");
      const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
      expect(/^permission-rule: true$/m.test(front), name).toBe(true);
    }
  });
});

describe("the memory audit on request (order 179)", () => {
  it("names the tool and write limits in the audit start block", () => {
    const restore = readFileSync(".agents/chief/memories/long-term/restore.md", "utf8");
    const start = /^## Audit start\n[\s\S]*?^```\w*\n([\s\S]*?)^```/m.exec(restore)?.[1] ?? "";
    expect(start, "restricted mode").toContain("--restricted");
    expect(start, "tool and write limits").toContain(
      '--tools "Read,Grep,Glob,Write" --allowedTools "Read" "Grep" "Glob" "Write($A/**)" --',
    );
    expect(start, "input and report guard").toContain(
      ': "${A:?}" "${R:?}" && test -s "$R-input.txt" && test ! -e "$R-report.md" &&',
    );
    expect(start, "no permission bypass").not.toContain("--dangerously");
    expect(start, "Bash tool").not.toContain("Bash");
  });

  it("names the main commit range in the audit input block", () => {
    const restore = readFileSync(".agents/chief/memories/long-term/restore.md", "utf8");
    const input = /^## Audit input\n[\s\S]*?^```\w*\n([\s\S]*?)^```/m.exec(restore)?.[1] ?? "";
    expect(input, "main commit").toContain("git rev-parse origin/main");
    expect(input, "main header").toContain("printf 'Main: %s\\n'");
    expect(input, "ancestor check").toContain("--is-ancestor");
    expect(input, "net change range").toContain('git diff "$previous_main" "$main"');
    expect(input, "report end line").toContain("End of report.");
    expect(input, "partial input file").toContain("-input.part");
    expect(input, "memory check exit code").toContain("check:memory exit");
    expect(input, "no time window").not.toContain("--since");
  });

  it("includes the net change since the last complete matching report", () => {
    const restore = readFileSync(`${L}/restore.md`, "utf8");
    const input = /^## Audit input\n[\s\S]*?^```\w*\n([\s\S]*?)^```/m.exec(restore)?.[1] ?? "";
    const repo = mkdtempSync(join(tmpdir(), "check-audit-input-"));
    const bin = join(repo, "bin");
    const env = {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      GIT_ALLOW_PROTOCOL: "file",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const git = (...args: string[]): string =>
      execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
    try {
      mkdirSync(bin);
      writeFileSync(join(bin, "pnpm"), "#!/bin/sh\nprintf 'memory problem\\n'\nexit 1\n", {
        mode: 0o700,
      });
      writeFileSync(join(bin, "gh"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      git("init", "-q", "-b", "main");
      git("config", "user.name", "Audit Test");
      git("config", "user.email", "audit@example.test");
      git("remote", "add", "origin", ".");
      mkdirSync(join(repo, L), { recursive: true });
      const rule = join(repo, L, "rule.md");
      writeFileSync(rule, "Old rule.\n");
      git("add", L);
      git("commit", "-qm", "Initial rule");
      const previous = git("rev-parse", "HEAD").trim();
      writeFileSync(rule, "New rule.\n");
      git("commit", "-qam", "Change rule");
      const main = git("rev-parse", "HEAD").trim();

      const audits = join(repo, M, "short-term/audits");
      mkdirSync(audits, { recursive: true });
      for (const day of ["01", "02", "03"]) {
        const stem = join(audits, `2000-01-${day}-0000`);
        const reportMain = day === "01" ? previous : main;
        const inputMain = day === "02" ? main : previous;
        const footer = day === "02" ? "" : "End of report.\n";
        writeFileSync(`${stem}-input.txt`, `Main: ${inputMain}\n`);
        writeFileSync(`${stem}-report.md`, `Main: ${reportMain}\n${footer}`);
      }

      const run = spawnSync("sh", ["-c", `${input}\nstatus=$?\nprintf '%s' "$R"\nexit "$status"`], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
      expect(run.status, run.stderr).toBe(0);
      const evidence = readFileSync(join(repo, `${run.stdout}-input.txt`), "utf8");
      expect(evidence, "net rule change").toContain("-Old rule.\n+New rule.");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("the restore guide names the owner trigger, lack of a cron line, and the input file", () => {
    const restore = readFileSync(".agents/chief/memories/long-term/restore.md", "utf8");
    expect(restore, "owner trigger").toContain(
      "The memory audit runs only when the owner asks (rule R-037).",
    );
    expect(restore, "audit input").toContain("It writes `$R-input.txt` in `short-term/audits/`.");
    expect(restore, "no cron line").toContain("There is no cron line");
  });

  it("the checklist calls for one report file and says the auditor has no command tool", () => {
    const checklist = readFileSync(".agents/chief/memories/long-term/audit.md", "utf8");
    expect(checklist, "no command tool").toContain("The auditor has no command tool.");
    expect(checklist, "report only").toMatch(/Write only\s+one report file\./);
    expect(checklist, "copy the main line first").toContain(
      "Copy the `Main:` line from the input file to the first line of the report.",
    );
    expect(checklist, "open issues heading").toContain('Never start with "no findings".');
    expect(checklist, "finish the report").toContain("End of report.");
  });
});

// Plan delta r2 §3 (DQ-1041): "key: value" with a space after the colon; the key and the value
// stay two capture groups.
describe("frontmatter", () => {
  it("gives a line with no space after the colon as a bad line, and keeps key and value", () => {
    expect(frontmatter("---\ntitle:x\n---\n")?.bad, "no space").toEqual(["title:x"]);
    const parsed = frontmatter("---\ntitle: x\n---\n");
    expect([...(parsed?.fields ?? new Map<string, string>())], "key and value").toEqual([
      ["title", "x"],
    ]);
  });
});
