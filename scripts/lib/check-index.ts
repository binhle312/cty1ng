import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkDesignSnapshot } from "./check-design.ts";

// The checks behind `pnpm check:index` (architecture.md §4.2). Each function returns a list of
// problems; an empty list means the check passed. They read fixed metadata only, never prose.

// Folders marked † in architecture.md §4. A `*` matches each direct subfolder. An indexed
// folder that exists must have a README.md.
export const INDEXED_FOLDERS = [
  "shared",
  "backend",
  "backend/src/app",
  "backend/src/core/*",
  "backend/src/adapters/*",
  "backend/test/contracts",
  "frontend",
  "frontend/src/routes",
  "frontend/src/features/*",
  "frontend/src/lib",
  "frontend/src/lib/api",
  "frontend/src/lib/realtime",
  "frontend/src/themes",
] as const;

// Never listed in a folder table: the index itself, tests, generated code (architecture.md
// §4.2), and git-ignored build output.
const NOT_LISTED = new Set([
  "README.md",
  "generated",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);
const TEST_FILE = /\.(test|spec)\.tsx?$/;

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

// Expand the patterns above into the folders that exist under `root`.
export function indexedFolders(root: string, patterns: readonly string[]): string[] {
  const folders = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const parent = pattern.slice(0, -2);
      if (!isDirectory(join(root, parent))) continue;
      for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
        if (entry.isDirectory()) folders.add(`${parent}/${entry.name}`);
      }
    } else if (isDirectory(join(root, pattern))) {
      folders.add(pattern);
    }
  }
  return [...folders].sort();
}

// The names in the first column of the README's tables: `| \`name\` | … |`. A trailing `/`
// marks a folder. A name may be a nested path (`src/ids.ts`): it must exist, but nested
// entries are not required.
export function listedNames(readme: string): string[] {
  const names: string[] = [];
  for (const line of readme.split("\n")) {
    const match = /^\|\s*`([^`]+)`\s*\|/.exec(line);
    if (match?.[1] !== undefined) names.push(match[1].replace(/\/$/, ""));
  }
  return names;
}

export function checkFolderIndexes(
  root: string,
  patterns: readonly string[] = INDEXED_FOLDERS,
): string[] {
  const problems: string[] = [];
  for (const folder of indexedFolders(root, patterns)) {
    const readmePath = join(root, folder, "README.md");
    if (!existsSync(readmePath)) {
      problems.push(`${folder}/: indexed folder has no README.md`);
      continue;
    }
    const listed = listedNames(readFileSync(readmePath, "utf8"));
    const present = readdirSync(join(root, folder)).filter(
      (name) => !NOT_LISTED.has(name) && !TEST_FILE.test(name),
    );
    for (const name of present) {
      if (!listed.includes(name)) {
        problems.push(`${folder}/README.md: \`${name}\` is in the folder but not in the table`);
      }
    }
    for (const name of listed) {
      if (!existsSync(join(root, folder, name))) {
        problems.push(`${folder}/README.md: the table lists \`${name}\`, which does not exist`);
      }
    }
  }
  return problems;
}

function tableCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

// Every story id (`- **CV-8.**`) in docs/requirements/*.md is inside the range that
// requirements/README.md gives for its file, and the last id of the range exists.
export function checkStoryRanges(requirementsDir: string): string[] {
  const problems: string[] = [];
  const ranges = new Map<string, { prefix: string; low: number; high: number }>();
  for (const line of readFileSync(join(requirementsDir, "README.md"), "utf8").split("\n")) {
    const [fileCell, storiesCell] = tableCells(line);
    const file = /^\[[^\]]+\]\(([\w-]+\.md)\)$/.exec(fileCell ?? "")?.[1];
    const range = /\b([A-Z]+)-(\d+) to \1-(\d+)\b/.exec(storiesCell ?? "");
    if (file === undefined || range?.[1] === undefined) continue;
    ranges.set(file, { prefix: range[1], low: Number(range[2]), high: Number(range[3]) });
  }

  const files = readdirSync(requirementsDir).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  for (const file of files) {
    const text = readFileSync(join(requirementsDir, file), "utf8");
    const ids = [...text.matchAll(/^- \*\*([A-Z]+)-(\d+)\.\*\*/gm)].map((m) => ({
      prefix: m[1] ?? "",
      number: Number(m[2]),
    }));
    if (ids.length === 0) continue;
    const range = ranges.get(file);
    if (range === undefined) {
      problems.push(`requirements/${file}: has story ids but no range in requirements/README.md`);
      continue;
    }
    for (const id of ids) {
      const inRange =
        id.prefix === range.prefix && id.number >= range.low && id.number <= range.high;
      if (!inRange) {
        problems.push(
          `requirements/${file}: ${id.prefix}-${id.number} is outside ${range.prefix}-${range.low} to ${range.prefix}-${range.high}`,
        );
      }
    }
    const hasLast = ids.some((id) => id.prefix === range.prefix && id.number === range.high);
    if (!hasLast) {
      problems.push(
        `requirements/${file}: the last id of the range, ${range.prefix}-${range.high}, does not exist`,
      );
    }
  }
  return problems;
}

const DECISION_ID = /\bD\d{2}\b/g;

// The decisions index (decisions/README.md) agrees with the metadata lines of the decisions:
// - every decision file has exactly one index row, and every row links to a file that exists;
// - every `Amends:` and `Supersedes:` line names decisions that exist;
// - the "Changed by" column lists exactly the entries whose metadata line names the decision.
//   It may also name a decision next to "(amendment <date>)" when the decision file has an
//   "Amended <date>" line: a dated amendment that the owner approved can come from another
//   decision without that decision amending this one (D19 is the first case).
export function checkDecisions(decisionsDir: string): string[] {
  const problems: string[] = [];
  const files = new Map<string, string>();
  for (const name of readdirSync(decisionsDir)) {
    const id = /^(D\d{2})-.+\.md$/.exec(name)?.[1];
    if (id !== undefined) files.set(id, name);
  }

  const changedBy = new Map<string, Set<string>>();
  for (const [id, name] of files) {
    const text = readFileSync(join(decisionsDir, name), "utf8");
    for (const match of text.matchAll(/^(Amends|Supersedes): (.+)$/gm)) {
      for (const target of (match[2] ?? "").split(", ").map((value) => value.trim())) {
        if (!files.has(target)) {
          problems.push(
            `decisions/${name}: \`${match[1]}:\` names ${target}, which does not exist`,
          );
        }
        const set = changedBy.get(target) ?? new Set<string>();
        set.add(id);
        changedBy.set(target, set);
      }
    }
  }

  const rows = new Map<string, { link: string; changedByCell: string }[]>();
  for (const line of readFileSync(join(decisionsDir, "README.md"), "utf8").split("\n")) {
    const cells = tableCells(line);
    const id = /^D(\d+)$/.exec(cells[0] ?? "")?.[1];
    const link = /\]\(([^)]+)\)/.exec(cells[1] ?? "")?.[1];
    if (id === undefined || link === undefined) continue;
    const key = `D${id.padStart(2, "0")}`;
    const list = rows.get(key) ?? [];
    list.push({ link, changedByCell: cells[3] ?? "" });
    rows.set(key, list);
  }

  for (const [id, name] of files) {
    const count = rows.get(id)?.length ?? 0;
    if (count !== 1)
      problems.push(`decisions/README.md: ${id} has ${count} index rows, expected 1 (${name})`);
  }
  for (const [id, list] of rows) {
    for (const row of list) {
      if (!existsSync(join(decisionsDir, row.link))) {
        problems.push(
          `decisions/README.md: the ${id} row links to ${row.link}, which does not exist`,
        );
      }
    }
    const row = list[0];
    const name = files.get(id);
    if (row === undefined || name === undefined) continue;
    const listed = new Set(row.changedByCell.match(DECISION_ID) ?? []);
    const expected = changedBy.get(id) ?? new Set<string>();
    for (const target of expected) {
      if (!listed.has(target)) {
        problems.push(
          `decisions/README.md: ${id} "Changed by" misses ${target}, whose metadata line names ${id}`,
        );
      }
    }
    const amendmentDate = /\(amendment (\d{4}-\d{2}-\d{2})\)/.exec(row.changedByCell)?.[1];
    const text = readFileSync(join(decisionsDir, name), "utf8");
    const datedAmendment = amendmentDate !== undefined && text.includes(`Amended ${amendmentDate}`);
    for (const target of listed) {
      if (!expected.has(target) && !datedAmendment) {
        problems.push(
          `decisions/README.md: ${id} "Changed by" lists ${target}, but ${target} has no \`Amends:\` or \`Supersedes:\` line naming ${id} and no dated amendment backs it`,
        );
      }
    }
  }
  return problems;
}

export function checkAll(root: string): string[] {
  return [
    ...checkFolderIndexes(root),
    ...checkStoryRanges(join(root, "docs/requirements")),
    ...checkDecisions(join(root, "docs/decisions")),
    ...checkDesignSnapshot(root),
  ].map((problem) => problem.replaceAll(`${root}/`, ""));
}
