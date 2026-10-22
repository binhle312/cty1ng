/**
 * `pnpm check:index` (architecture.md §4.2): every indexed folder has a README.md whose table
 * lists each of its files and subfolders, and lists nothing that does not exist. Tests,
 * README.md itself and `generated/` are not listed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Folders marked † in architecture.md §4; `*` matches one path segment. */
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

const NOT_LISTED = [/^README\.md$/, /\.test\.tsx?$/, /^generated\/$/];

export interface IndexInput {
  /** Repository-relative paths of every file (forward slashes). */
  files: readonly string[];
  readFile(path: string): string | undefined;
  folders?: readonly string[];
}

export function checkIndexes(input: IndexInput): string[] {
  const errors: string[] = [];
  for (const folder of matchFolders(input.files, input.folders ?? INDEXED_FOLDERS)) {
    const readme = input.readFile(`${folder}/README.md`);
    if (readme === undefined) {
      errors.push(`${folder}/: missing README.md index`);
      continue;
    }
    const actual = children(input.files, folder).filter(
      (name) => !NOT_LISTED.some((pattern) => pattern.test(name)),
    );
    const listed = listedNames(readme);
    const listedSet = new Set(listed.map(normalise));
    const actualSet = new Set(actual.map(normalise));
    for (const name of actual) {
      if (!listedSet.has(normalise(name)))
        errors.push(`${folder}/README.md: does not list ${name}`);
    }
    for (const name of listed) {
      if (!actualSet.has(normalise(name))) {
        errors.push(`${folder}/README.md: lists ${name}, which does not exist`);
      }
    }
  }
  return errors;
}

/** The immediate children of a folder: files as `name`, subfolders as `name/`. */
function children(files: readonly string[], folder: string): string[] {
  const names = new Set<string>();
  for (const file of files) {
    if (!file.startsWith(`${folder}/`)) continue;
    const rest = file.slice(folder.length + 1);
    const slash = rest.indexOf("/");
    names.add(slash === -1 ? rest : `${rest.slice(0, slash)}/`);
  }
  return [...names].sort();
}

function matchFolders(files: readonly string[], patterns: readonly string[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i += 1) folders.add(parts.slice(0, i).join("/"));
  }
  const matched = [...folders].filter((folder) =>
    patterns.some((pattern) => {
      const want = pattern.split("/");
      const have = folder.split("/");
      return (
        want.length === have.length && want.every((part, i) => part === "*" || part === have[i])
      );
    }),
  );
  return matched.sort();
}

/** First cell of each table row, without backticks; header and separator rows skipped. */
export function listedNames(readme: string): string[] {
  const names: string[] = [];
  for (const line of readme.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cell = line.split("|")[1]?.trim() ?? "";
    if (cell === "" || /^-+$/.test(cell.replace(/:/g, "")) || cell === "File") continue;
    const ticked = /`([^`]+)`/.exec(cell);
    names.push(ticked?.[1] ?? cell);
  }
  return names;
}

function normalise(name: string): string {
  return name.replace(/\/$/, "");
}

function gitFiles(root: string): string[] {
  const output = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  return output.split("\n").filter((file) => file !== "" && existsSync(join(root, file)));
}

if (import.meta.main) {
  const root = process.cwd();
  const errors = checkIndexes({
    files: gitFiles(root),
    readFile: (path) =>
      existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined,
  });
  if (errors.length > 0) {
    process.stderr.write(
      `check:index failed (architecture.md §4.2):\n${errors.map((e) => `  ${e}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check:index: every indexed folder lists its files\n");
}
