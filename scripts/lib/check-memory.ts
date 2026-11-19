// The checks behind `pnpm check:memory`: the chief memory in `.agents/memories/` (its README is the
// schema). Pure: the caller passes the text of each memory file (a map from the repository path to
// the text), the paths that git tracks, and the other inputs. Each function returns a list of
// problems; each problem names the file (and the line, where it helps) and what to do.

export const MEMORY_DIR = ".agents/memories";
export const LONG_TERM = `${MEMORY_DIR}/long-term`;
export const RULES_DIR = `${LONG_TERM}/rules`;
export const SHORT_TERM = `${MEMORY_DIR}/short-term`;
export const SETTINGS_FILE = `${LONG_TERM}/settings.md`;
export const RULES_INDEX = `${RULES_DIR}/README.md`;
// The schema that this check reads. A newer memory needs a newer check, so an old clone stops
// instead of reading new fields in the wrong way.
export const SCHEMA = 1;
// The same two lines are in .gitignore. `.git/info/exclude` holds them too, because an old
// branch has no such lines in its .gitignore, and `git add -A` there would stage private files.
export const EXCLUDE_LINES = [`/${SHORT_TERM}/*`, `!/${SHORT_TERM}/README.md`] as const;

export type MemoryFiles = ReadonlyMap<string, string>;
export type Limits = ReadonlyMap<string, number>;

const REQUIRED_FILES = [
  `${MEMORY_DIR}/README.md`,
  `${LONG_TERM}/README.md`,
  `${LONG_TERM}/identity.md`,
  SETTINGS_FILE,
  `${LONG_TERM}/environment.md`,
  `${LONG_TERM}/lessons.md`,
  `${LONG_TERM}/state.md`,
  `${LONG_TERM}/restore.md`,
  `${LONG_TERM}/restore-drill.md`,
  `${LONG_TERM}/log.md`,
  RULES_INDEX,
  `${SHORT_TERM}/README.md`,
];

// The settings that the chief's method reads (the memory contract). The values live in
// settings.md, with their source; the check knows only the keys and which keys are numbers.
const NUMBER_SETTINGS = [
  "leader_cap",
  "heavy_runs_at_once",
  "checkpoint_left_percent",
  "context_window_tokens",
  "review_cap",
  "promote_after_hours",
  "drill_every_days",
  "boot_max_kb",
  "identity_max_lines",
  "rule_max_lines",
  "state_max_lines",
  "lessons_max_lines",
  "quote_max_words",
] as const;
const TEXT_SETTINGS = [
  "heavy_commands",
  "model_easy",
  "model_medium",
  "model_hard",
  "chief_model",
  "owner_language",
  "owner_pages",
] as const;

const RULE_FIELDS = [
  "id",
  "title",
  "status",
  "scope",
  "said",
  "orders",
  "ends",
  "supersedes",
  "amends",
  "check-first",
] as const;
// `check-first: true` marks a rule with conditions: the first line of its "How to apply" is
// "Check first:", and it names each condition before the steps (owner, 2026-11-19, drill-139 Q1 A).
const CHECK_FIRST = "check-first";
const CHECK_FIRST_LINE = "Check first:";
const HOW_TO_APPLY = "How to apply:";
// The sentence of `AGENTS.md` §7 that lists the PRs no standing permission covers. A rule that
// copies the list copies it word for word, and asks it again as a Check first step.
const NO_PERMISSION = /No permission covers a PR that changes (.+?)(?::|\.(?= [A-Z]|\s*$))/m;
const LIST_STEP = /^\d+\. Does the PR change (.+?)\? /m;
// `owner-merges: true` marks a rule about merges, approvals or permissions: a PR that changes it is
// not a promotion PR, and the owner merges it (`isPromotion` of `check-status.ts`).
const OWNER_MERGES = "owner-merges";
const RULE_FIELD_SET = new Set<string>([...RULE_FIELDS, OWNER_MERGES]);
const STATUSES = ["active", "replaced", "ended", "disputed"];
const SCOPES = ["chief", "leaders", "all-agents"];
const RULE_ID = /^R-\d{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function lineCount(text: string): number {
  if (text === "") return 0;
  const lines = text.split("\n").length;
  return text.endsWith("\n") ? lines - 1 : lines;
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

// A field value goes into a RegExp as plain text: "R-(1" must give a problem, not an exception.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function checkSchema(readme: string | undefined): string[] {
  const path = `${MEMORY_DIR}/README.md`;
  const match = /^Memory schema: (\d+)$/m.exec(readme ?? "");
  if (match?.[1] === undefined) return [`${path}: no "Memory schema: <n>" line`];
  const schema = Number(match[1]);
  if (schema > SCHEMA) {
    return [
      `${path}: memory schema ${schema} is newer than this check (schema ${SCHEMA}); update scripts/lib/check-memory.ts first`,
    ];
  }
  return [];
}

export function checkRequiredFiles(files: MemoryFiles): string[] {
  return REQUIRED_FILES.filter((path) => !files.has(path)).map(
    (path) => `${path}: the file is missing`,
  );
}

// The table rows `| \`key\` | value | source |` of settings.md.
export function readSettings(text: string | undefined): { limits: Limits; problems: string[] } {
  const values = new Map<string, string>();
  for (const line of (text ?? "").split("\n")) {
    const match = /^\|\s*`([a-z_]+)`\s*\|\s*(.*?)\s*\|/.exec(line);
    if (match?.[1] !== undefined) values.set(match[1], match[2] ?? "");
  }
  const known = new Set<string>([...NUMBER_SETTINGS, ...TEXT_SETTINGS]);
  const numbers = new Set<string>(NUMBER_SETTINGS);
  const problems: string[] = [];
  const limits = new Map<string, number>();
  for (const key of [...NUMBER_SETTINGS, ...TEXT_SETTINGS]) {
    if (!values.has(key)) problems.push(`${SETTINGS_FILE}: setting \`${key}\` is missing`);
  }
  for (const [key, value] of values) {
    if (!known.has(key)) {
      problems.push(`${SETTINGS_FILE}: setting \`${key}\` is not a known key`);
    } else if (numbers.has(key)) {
      if (/^\d+$/.test(value)) limits.set(key, Number(value));
      else
        problems.push(
          `${SETTINGS_FILE}: setting \`${key}\` is "${value}"; it must be a whole number`,
        );
    }
  }
  return { limits, problems };
}

type Rule = {
  path: string;
  fields: Map<string, string>;
  body: string;
  id: string | undefined;
  status: string | undefined;
  supersedes: string[];
  amends: string[];
};

function listOf(value: string | undefined): string[] | undefined {
  const match = /^\[(.*)\]$/.exec(value ?? "");
  if (match?.[1] === undefined) return undefined;
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function parseRule(file: { path: string; text: string }, problems: string[]): Rule | undefined {
  const { path, text } = file;
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (match === null) {
    problems.push(`${path}: no frontmatter; the file must start with a "---" line`);
    return undefined;
  }
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split("\n")) {
    const field = /^([a-z-]+): ?(.*)$/.exec(line);
    if (field?.[1] === undefined) {
      problems.push(`${path}: the frontmatter line "${line}" is not "key: value"`);
      continue;
    }
    fields.set(field[1], (field[2] ?? "").trim());
  }
  const supersedes = listOf(fields.get("supersedes")) ?? [];
  const amends = listOf(fields.get("amends")) ?? [];
  return {
    path,
    fields,
    body: match[2] ?? "",
    id: fields.get("id"),
    status: fields.get("status"),
    supersedes,
    amends,
  };
}

function fieldProblems(rule: Rule): string[] {
  const { path, fields } = rule;
  const problems: string[] = [];
  for (const key of RULE_FIELDS) {
    if (!fields.has(key)) problems.push(`${path}: field \`${key}\` is missing`);
  }
  for (const key of fields.keys()) {
    if (!RULE_FIELD_SET.has(key)) problems.push(`${path}: field \`${key}\` is not a rule field`);
  }
  const id = fields.get("id");
  if (id !== undefined) {
    if (!RULE_ID.test(id)) {
      problems.push(`${path}: field \`id\` is "${id}"; it must be R- and three digits`);
    }
    if (!new RegExp(`^${escapeRegExp(id)}-[a-z0-9-]+\\.md$`).test(baseName(path))) {
      problems.push(`${path}: the file name must be "${id}-<words>.md"`);
    }
  }
  const ownerMerges = fields.get(OWNER_MERGES);
  if (ownerMerges !== undefined && ownerMerges !== "true") {
    problems.push(
      `${path}: field \`${OWNER_MERGES}\` is "${ownerMerges}"; write true, or leave the field out`,
    );
  }
  const checkFirst = fields.get(CHECK_FIRST);
  if (checkFirst !== undefined && checkFirst !== "true" && checkFirst !== "false") {
    problems.push(`${path}: field \`${CHECK_FIRST}\` is "${checkFirst}"; write true or false`);
  }
  const title = fields.get("title");
  if (title !== undefined && (title === "" || title.includes("|"))) {
    problems.push(`${path}: field \`title\` must be one sentence with no "|"`);
  }
  const status = fields.get("status");
  if (status !== undefined && !STATUSES.includes(status)) {
    problems.push(`${path}: field \`status\` is "${status}"; use one of ${STATUSES.join(", ")}`);
  }
  const scope = fields.get("scope");
  if (scope !== undefined && !SCOPES.includes(scope)) {
    problems.push(`${path}: field \`scope\` is "${scope}"; use one of ${SCOPES.join(", ")}`);
  }
  const said = fields.get("said");
  if (said !== undefined && !isDate(said)) {
    problems.push(`${path}: field \`said\` is "${said}"; it must be a date YYYY-MM-DD`);
  }
  const ordersText = fields.get("orders");
  if (ordersText !== undefined) {
    const orders = listOf(ordersText);
    if (orders === undefined) problems.push(`${path}: field \`orders\` must be a list, [1, 2]`);
    for (const order of orders ?? []) {
      if (!/^[1-9]\d*$/.test(order))
        problems.push(`${path}: field \`orders\` has "${order}"; each order is a whole number`);
    }
  }
  const ends = fields.get("ends");
  if (ends !== undefined && ends !== "never" && !isDate(ends) && !/^until \S/.test(ends)) {
    problems.push(
      `${path}: field \`ends\` is "${ends}"; use never, a date YYYY-MM-DD or "until <event>"`,
    );
  }
  for (const key of ["supersedes", "amends"] as const) {
    const value = fields.get(key);
    if (value === undefined) continue;
    const list = listOf(value);
    if (list === undefined) problems.push(`${path}: field \`${key}\` must be a list, [R-001]`);
    for (const target of list ?? []) {
      if (!RULE_ID.test(target))
        problems.push(`${path}: field \`${key}\` has "${target}"; each item is a rule id`);
    }
  }
  return problems;
}

function bodyProblems(rule: Rule, limits: Limits): string[] {
  const { path, body } = rule;
  const problems: string[] = [];
  if (!/^Rule: \S/m.test(body)) problems.push(`${path}: no "Rule:" line`);
  const saidLines = body.split("\n").filter((line) => line.startsWith("Owner said:"));
  if (saidLines.length === 0) problems.push(`${path}: no "Owner said:" line`);
  const maxWords = limits.get("quote_max_words");
  for (const line of saidLines) {
    const quotes = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");
    if (quotes.length === 0) {
      problems.push(`${path}: an "Owner said:" line has no quote in double quotes`);
      continue;
    }
    if (!/\(\d{4}-\d{2}-\d{2}\)/.test(line)) {
      problems.push(`${path}: an "Owner said:" line has no date (YYYY-MM-DD)`);
    }
    // The quotes of one line count together: two short quotes make one long quote.
    const words = countWords(quotes.join(" "));
    if (maxWords !== undefined && words > maxWords) {
      problems.push(
        `${path}: an "Owner said:" quote has ${words} words; the limit is ${maxWords} (setting quote_max_words)`,
      );
    }
  }
  return problems;
}

function checkFirstProblems(rule: Rule): string[] {
  const { path, fields, body } = rule;
  const lines = body.split("\n");
  const marked = lines.filter((line) => line.includes(CHECK_FIRST_LINE)).length;
  const value = fields.get(CHECK_FIRST);
  if (rule.status === "active" && fields.get(OWNER_MERGES) === "true" && value !== "true") {
    return [`${path}: it has \`${OWNER_MERGES}: true\`, so \`${CHECK_FIRST}\` must be true`];
  }
  if (value === "false" && marked > 0) {
    return [
      `${path}: \`${CHECK_FIRST}\` is false, but a line has "${CHECK_FIRST_LINE}"; set true, or remove the line`,
    ];
  }
  if (value !== "true") return [];
  const at = lines.indexOf(HOW_TO_APPLY);
  if (at === -1 || !(lines[at + 1] ?? "").startsWith(`${CHECK_FIRST_LINE} `)) {
    return [
      `${path}: \`${CHECK_FIRST}\` is true, so the line after "${HOW_TO_APPLY}" must start with "${CHECK_FIRST_LINE}"`,
    ];
  }
  if (marked > 1)
    return [`${path}: "${CHECK_FIRST_LINE}" is in ${marked} lines; write it one time`];
  return [];
}

function ruleFiles(files: MemoryFiles): [string, string][] {
  return [...files]
    .filter(([path]) => dirOf(path) === RULES_DIR && baseName(path) !== "README.md")
    .sort(([a], [b]) => a.localeCompare(b));
}

function parseRules(files: MemoryFiles, problems: string[]): Rule[] {
  const rules: Rule[] = [];
  for (const [path, text] of ruleFiles(files)) {
    const rule = parseRule({ path, text }, problems);
    if (rule !== undefined) rules.push(rule);
  }
  return rules;
}

// The loop of `supersedes` and `amends` that starts at `start`, as a list of ids, or undefined.
function loopFrom(start: string, next: ReadonlyMap<string, string[]>): string[] | undefined {
  const walk = (id: string, path: string[]): string[] | undefined => {
    for (const target of next.get(id) ?? []) {
      if (target === start) return [...path, target];
      if (path.includes(target)) continue;
      const found = walk(target, [...path, target]);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(start, [start]);
}

function linkProblems(rules: readonly Rule[]): string[] {
  const problems: string[] = [];
  const byId = new Map<string, Rule>();
  for (const rule of rules) {
    if (rule.id === undefined) continue;
    const other = byId.get(rule.id);
    if (other !== undefined) {
      problems.push(`${rule.path}: id ${rule.id} is also the id of ${other.path}`);
      continue;
    }
    byId.set(rule.id, rule);
  }
  const supersededBy = new Map<string, string>();
  const next = new Map<string, string[]>();
  for (const rule of byId.values()) {
    for (const [key, targets] of [
      ["supersedes", rule.supersedes],
      ["amends", rule.amends],
    ] as const) {
      for (const target of targets) {
        if (!byId.has(target))
          problems.push(`${rule.path}: \`${key}\` names ${target}, which does not exist`);
      }
    }
    for (const target of rule.supersedes) supersededBy.set(target, rule.id ?? "");
    next.set(rule.id ?? "", [...rule.supersedes, ...rule.amends]);
  }
  // A rule that replaces or amends a rule of the owner's merges is one too: without the field, a
  // promotion PR could change that rule through a new file.
  for (const rule of byId.values()) {
    if (rule.fields.has(OWNER_MERGES)) continue;
    for (const target of [...rule.supersedes, ...rule.amends]) {
      if (byId.get(target)?.fields.has(OWNER_MERGES) === true) {
        problems.push(
          `${rule.path}: it changes ${target}, which has \`${OWNER_MERGES}: true\`, so it needs the field too`,
        );
      }
    }
  }
  const reported = new Set<string>();
  for (const rule of byId.values()) {
    const id = rule.id ?? "";
    if (reported.has(id)) continue;
    const loop = loopFrom(id, next);
    if (loop !== undefined) {
      for (const member of loop) reported.add(member);
      problems.push(
        `${rule.path}: \`supersedes\` and \`amends\` make a loop: ${loop.join(" -> ")}`,
      );
    }
  }
  for (const rule of byId.values()) {
    const successor = supersededBy.get(rule.id ?? "");
    if (successor !== undefined && rule.status !== "replaced") {
      problems.push(
        `${rule.path}: ${successor} supersedes ${rule.id}, so its status must be replaced, not ${rule.status}`,
      );
    }
    if (successor === undefined && rule.status === "replaced") {
      problems.push(`${rule.path}: the status is replaced, but no rule supersedes ${rule.id}`);
    }
  }
  return problems;
}

export function checkRules(files: MemoryFiles, limits: Limits): string[] {
  const problems: string[] = [];
  const rules = parseRules(files, problems);
  const maxLines = limits.get("rule_max_lines");
  for (const rule of rules) {
    problems.push(
      ...fieldProblems(rule),
      ...bodyProblems(rule, limits),
      ...checkFirstProblems(rule),
    );
    const lines = lineCount(files.get(rule.path) ?? "");
    if (maxLines !== undefined && lines > maxLines) {
      problems.push(
        `${rule.path}: ${lines} lines; the limit is ${maxLines} (setting rule_max_lines)`,
      );
    }
  }
  problems.push(...linkProblems(rules));
  return problems;
}

// An active rule that copies the list of `AGENTS.md` §7 (the PRs that no standing permission
// covers) keeps it word for word, and its Check first step asks the same list. `agents` is the
// text of AGENTS.md.
export function checkPermissionList(files: MemoryFiles, agents: string | undefined): string[] {
  const problems: string[] = [];
  const agentsList = NO_PERMISSION.exec(agents ?? "")?.[1];
  for (const rule of parseRules(files, [])) {
    if (rule.status !== "active") continue;
    const sentence = rule.body.split("\n").find((line) => line.startsWith("Rule: ")) ?? "";
    const ruleList = NO_PERMISSION.exec(sentence)?.[1];
    if (ruleList === undefined) continue;
    const stepList = LIST_STEP.exec(rule.body)?.[1];
    if (stepList === undefined) {
      problems.push(
        `${rule.path}: the Rule sentence lists the PRs that no permission covers, so a Check first step must ask "Does the PR change <that list>?"`,
      );
    } else if (stepList !== ruleList) {
      problems.push(
        `${rule.path}: the Check first step lists "${stepList}", but the Rule sentence lists "${ruleList}"`,
      );
    }
    if (agentsList === undefined) {
      problems.push(
        `AGENTS.md: no sentence "No permission covers a PR that changes …", so ${rule.path} cannot be compared with it`,
      );
    } else if (agentsList !== ruleList) {
      problems.push(
        `${rule.path}: the Rule sentence lists "${ruleList}", but AGENTS.md §7 lists "${agentsList}"`,
      );
    }
  }
  return problems;
}

// The text of rules/README.md, made from the fields of the rule files. check:index reads its
// first column like any folder index.
export function rulesIndex(files: MemoryFiles): string {
  const rules = parseRules(files, []);
  const changedBy = new Map<string, string[]>();
  const replacedBy = new Map<string, string[]>();
  for (const rule of rules) {
    for (const target of rule.amends)
      changedBy.set(target, [...(changedBy.get(target) ?? []), rule.id ?? ""]);
    for (const target of rule.supersedes)
      replacedBy.set(target, [...(replacedBy.get(target) ?? []), rule.id ?? ""]);
  }
  const cell = (rule: Rule, key: string): string => rule.fields.get(key) ?? "";
  // An empty cell is "| |", as in the other tables of the repository.
  const row = (cells: string[]): string =>
    `|${cells.map((value) => (value === "" ? " " : ` ${value} `)).join("|")}|`;
  const active = rules.filter((rule) => rule.status === "active");
  const other = rules.filter((rule) => rule.status !== "active");
  return [
    "# long-term/rules",
    "",
    "The owner's standing rules: one rule in each file, with fixed fields",
    '(`.agents/memories/README.md`, "Rule files"). `pnpm check:memory --write` makes this index',
    "from those fields; do not edit it by hand. At the start, read each active rule in full: its",
    "conditions are in the file, not in this table.",
    "",
    "## Active",
    "",
    "| File | Rule | Scope | Ends | Changed by |",
    "| --- | --- | --- | --- | --- |",
    ...active.map((rule) =>
      row([
        `\`${baseName(rule.path)}\``,
        cell(rule, "title"),
        cell(rule, "scope"),
        cell(rule, "ends"),
        (changedBy.get(rule.id ?? "") ?? []).join(", "),
      ]),
    ),
    "",
    "## Not active",
    "",
    "| File | Rule | Status | Replaced by |",
    "| --- | --- | --- | --- |",
    ...other.map((rule) =>
      row([
        `\`${baseName(rule.path)}\``,
        cell(rule, "title"),
        cell(rule, "status"),
        (replacedBy.get(rule.id ?? "") ?? []).join(", "),
      ]),
    ),
    "",
  ].join("\n");
}

export function checkRulesIndex(files: MemoryFiles): string[] {
  if (files.get(RULES_INDEX) === rulesIndex(files)) return [];
  return [`${RULES_INDEX}: it is not the generated index; run pnpm check:memory --write`];
}

export function checkFormats(files: MemoryFiles): string[] {
  const problems: string[] = [];
  const statePath = `${LONG_TERM}/state.md`;
  const state = files.get(statePath);
  if (state !== undefined) {
    const lines: [RegExp, string][] = [
      [/^As of: \d{4}-\d{2}-\d{2}$/m, '"As of: YYYY-MM-DD"'],
      [/^Main: [0-9a-f]{7,40}$/m, '"Main: <commit>"'],
      [/^Promoted through: \d{4}-\d{2}-\d{2}$/m, '"Promoted through: YYYY-MM-DD"'],
    ];
    for (const [pattern, name] of lines) {
      if (!pattern.test(state)) problems.push(`${statePath}: no ${name} line`);
    }
  }
  const lessonsPath = `${LONG_TERM}/lessons.md`;
  const seen = new Set<string>();
  (files.get(lessonsPath) ?? "").split("\n").forEach((line, index) => {
    if (!line.startsWith("- ")) return;
    const match = /^- (L-\d+) \(\d{4}-\d{2}-\d{2}\): \S/.exec(line);
    if (match?.[1] === undefined) {
      problems.push(
        `${lessonsPath}:${index + 1}: a lesson line must start with "- L-<n> (YYYY-MM-DD): "`,
      );
      return;
    }
    if (seen.has(match[1]))
      problems.push(`${lessonsPath}:${index + 1}: lesson id ${match[1]} is used two times`);
    seen.add(match[1]);
  });
  const logPath = `${LONG_TERM}/log.md`;
  (files.get(logPath) ?? "").split("\n").forEach((line, index) => {
    if (!line.startsWith("## ")) return;
    if (!/^## \[\d{4}-\d{2}-\d{2}\] (promote|lint|restore|migrate) \| \S/.test(line)) {
      problems.push(
        `${logPath}:${index + 1}: a log heading must be "## [YYYY-MM-DD] promote|lint|restore|migrate | <text>"`,
      );
    }
  });
  return problems;
}

// What must never be in a tracked memory file: the repository is public (README, "Privacy").
// No allowlist: rephrase the text. The problem names the kind and the line, not the value, so
// that the CI log does not repeat it.
const PUBLIC = "the memory is public, so remove it";
const PRIVATE_PATTERNS: [RegExp, string][] = [
  [
    /\/home\/[A-Za-z0-9._-]|\/Users\/[A-Za-z0-9._-]|\/root\/|\\home\\[A-Za-z0-9._-]|[A-Za-z]:\\Users\\|~\/|\$HOME\b/,
    `a home folder path; ${PUBLIC}`,
  ],
  [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
    `an email address; ${PUBLIC}`,
  ],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, `a uuid; ${PUBLIC}`],
  // An id after the word: hex, or letters and digits with at least one digit ("job-id: b8f3k2",
  // "agent a1b2c3d4e5", "session id: abcdef12").
  [
    /\b(job|bg|session|agent|ref)([\s_-]?id)?[\s`'"([:=#-]{1,3}((?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,}|[0-9a-f]{6,})\b/i,
    `a session, job, agent or ref id; ${PUBLIC}`,
  ],
  // A base62 session id, also inside a link of the web app ("session_01Waa...").
  [/\bsession_[A-Za-z0-9]{8,}/, `a session, job, agent or ref id; ${PUBLIC}`],
  [/\bsk-[A-Za-z0-9_-]{16,}/, `a key or a token; ${PUBLIC}`],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, `a key or a token; ${PUBLIC}`],
  [/\bAIza[0-9A-Za-z_-]{35}/, `a key or a token; ${PUBLIC}`],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, `a key or a token; ${PUBLIC}`],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, `a key or a token; ${PUBLIC}`],
  [/\bAKIA[0-9A-Z]{16}\b/, `a key or a token; ${PUBLIC}`],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, `a key or a token; ${PUBLIC}`],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, `a key or a token; ${PUBLIC}`],
  [/\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)(\d{1,3}\.){3}\d{1,3}\b/, `an IP address; ${PUBLIC}`],
  // IPv6: the full form, or a short form with "::" after at least one group ("::1" is local).
  [
    /\b([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b|\b([0-9a-f]{1,4}:){1,6}:([0-9a-f]{1,4}\b)?/i,
    `an IP address; ${PUBLIC}`,
  ],
  [/claude attach [0-9a-f]{4,}/, `a claude attach id; ${PUBLIC}`],
  [
    /(^|[\s`("'/=:])tmp\/[A-Za-z0-9._-]/,
    "a path into tmp/, which is on one machine only; remove it",
  ],
];

export function checkPrivacy(files: MemoryFiles): string[] {
  const problems: string[] = [];
  for (const [path, text] of files) {
    text.split("\n").forEach((line, index) => {
      for (const [pattern, kind] of PRIVATE_PATTERNS) {
        if (pattern.test(line)) problems.push(`${path}:${index + 1}: ${kind}`);
      }
    });
  }
  return problems;
}

// The files outside rules/ that can hold the owner's words. Each quote in double quotes has the
// limit of a rule quote. Other files quote commands and prompts, which are not the owner's words.
const QUOTE_FILES = ["identity.md", "lessons.md", "state.md"].map((name) => `${LONG_TERM}/${name}`);

export function checkQuotes(files: MemoryFiles, limits: Limits): string[] {
  const maxWords = limits.get("quote_max_words");
  if (maxWords === undefined) return [];
  const problems: string[] = [];
  for (const path of QUOTE_FILES) {
    (files.get(path) ?? "").split("\n").forEach((line, index) => {
      for (const match of line.matchAll(/"([^"]*)"/g)) {
        const words = countWords(match[1] ?? "");
        if (words > maxWords) {
          problems.push(
            `${path}:${index + 1}: a quote has ${words} words; the limit is ${maxWords} (setting quote_max_words)`,
          );
        }
      }
    });
  }
  return problems;
}

// The files that a chief reads at each start (README, "Read order"): their total size has a
// limit, so the start stays cheap.
function bootSet(files: MemoryFiles): string[] {
  const fixed = [
    `${MEMORY_DIR}/README.md`,
    `${LONG_TERM}/README.md`,
    `${LONG_TERM}/identity.md`,
    SETTINGS_FILE,
    `${LONG_TERM}/environment.md`,
    `${LONG_TERM}/lessons.md`,
    `${LONG_TERM}/state.md`,
    RULES_INDEX,
  ];
  const active = parseRules(files, [])
    .filter((rule) => rule.status === "active")
    .map((rule) => rule.path);
  return [...fixed, ...active].filter((path) => files.has(path));
}

export function checkSizes(files: MemoryFiles, limits: Limits): string[] {
  const problems: string[] = [];
  const caps: [string, string][] = [
    [`${LONG_TERM}/identity.md`, "identity_max_lines"],
    [`${LONG_TERM}/state.md`, "state_max_lines"],
    [`${LONG_TERM}/lessons.md`, "lessons_max_lines"],
  ];
  for (const [path, key] of caps) {
    const limit = limits.get(key);
    const text = files.get(path);
    if (limit === undefined || text === undefined) continue;
    const lines = lineCount(text);
    if (lines > limit)
      problems.push(`${path}: ${lines} lines; the limit is ${limit} (setting ${key})`);
  }
  const maxKb = limits.get("boot_max_kb");
  if (maxKb !== undefined) {
    const bytes = bootSet(files).reduce(
      (sum, path) => sum + Buffer.byteLength(files.get(path) ?? "", "utf8"),
      0,
    );
    const kb = Math.ceil(bytes / 1024);
    if (kb > maxKb) {
      problems.push(
        `the boot set is ${kb} KB; the limit is ${maxKb} KB (setting boot_max_kb): make the start files shorter`,
      );
    }
  }
  return problems;
}

// Each relative Markdown link of a memory file goes to a path that exists.
export function checkLinks(files: MemoryFiles, exists: (path: string) => boolean): string[] {
  const problems: string[] = [];
  for (const [path, text] of files) {
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = match[1] ?? "";
      if (/^[a-z]+:/i.test(link) || link.startsWith("#")) continue;
      const target = resolve(dirOf(path), link.split("#")[0] ?? "");
      if (target === undefined) {
        problems.push(`${path}: the link "${link}" goes outside the repository`);
      } else if (!exists(target)) {
        problems.push(`${path}: the link "${link}" goes to ${target}, which does not exist`);
      }
    }
  }
  return problems;
}

// The repository path of a link, or undefined when a ".." goes above the repository root.
function resolve(dir: string, link: string): string | undefined {
  const parts = link.startsWith("/") ? [] : dir.split("/");
  for (const part of link.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") parts.push(part);
    else if (parts.pop() === undefined) return undefined;
  }
  return parts.join("/");
}

// `tracked`: the output of `git ls-files` under short-term/. Only its README is in git.
export function checkTracked(tracked: readonly string[]): string[] {
  return tracked
    .filter((path) => path.startsWith(`${SHORT_TERM}/`) && path !== `${SHORT_TERM}/README.md`)
    .map(
      (path) => `${path}: git tracks a short-term file; it is private: run git rm --cached on it`,
    );
}

export function checkExclude(exclude: string): string[] {
  const lines = new Set(exclude.split("\n").map((line) => line.trim()));
  return EXCLUDE_LINES.filter((line) => !lines.has(line)).map(
    (line) => `.git/info/exclude: no line "${line}"; run pnpm check:memory --local --fix`,
  );
}

// `words`: the lines of short-term/private-words.txt (names that the public repository must not
// hold). The problem does not repeat the word.
export function checkPrivateWords(files: MemoryFiles, words: readonly string[]): string[] {
  const list = words.map((word) => word.trim().toLowerCase()).filter((word) => word !== "");
  if (list.length === 0) return [];
  const problems: string[] = [];
  for (const [path, text] of files) {
    text.split("\n").forEach((line, index) => {
      const lower = line.toLowerCase();
      if (list.some((word) => lower.includes(word))) {
        problems.push(`${path}:${index + 1}: a word of the private word list; remove it`);
      }
    });
  }
  return problems;
}

// All the checks that CI runs. `files` holds each memory file that git tracks or would track
// (short-term files are ignored, so they are not in it); `tracked` is `git ls-files` of
// short-term/.
export function checkMemory(input: {
  files: MemoryFiles;
  exists: (path: string) => boolean;
  tracked: readonly string[];
  agents: string | undefined;
}): string[] {
  const { files, exists, tracked, agents } = input;
  const settings = readSettings(files.get(SETTINGS_FILE));
  return [
    ...checkSchema(files.get(`${MEMORY_DIR}/README.md`)),
    ...checkRequiredFiles(files),
    ...settings.problems,
    ...checkRules(files, settings.limits),
    ...checkPermissionList(files, agents),
    ...checkRulesIndex(files),
    ...checkFormats(files),
    ...checkPrivacy(files),
    ...checkQuotes(files, settings.limits),
    ...checkSizes(files, settings.limits),
    ...checkLinks(files, exists),
    ...checkTracked(tracked),
  ];
}
