import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import type { ImportFolder } from "../core/skills/skill-import.service.ts";

// Skill folders on disk for the CLI (api.md §2): `<folder>/<slug>/SKILL.md`. The same rules as
// the zip (security.md §2.4): only SKILL.md is opened, one over 1 MB is not read, and every other
// file is listed as skipped. Links are listed, never followed.
const MAX_SKILL_MD_BYTES = 1024 * 1024;

export function readSkillFolders(root: string): ImportFolder[] {
  const folders: ImportFolder[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const found: ImportFolder = { folder: entry.name, skillMd: "missing", skippedFiles: [] };
    for (const path of filesUnder(dir)) {
      const name = relative(dir, path);
      const stat = lstatSync(path);
      if (name !== "SKILL.md" || !stat.isFile()) {
        found.skippedFiles.push(name);
      } else if (stat.size > MAX_SKILL_MD_BYTES) {
        found.skillMd = "too_large";
      } else {
        found.skillMd = new Uint8Array(readFileSync(path));
      }
    }
    folders.push(found);
  }
  return folders;
}

function filesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files.sort();
}

export function isNewOrEmpty(root: string): boolean {
  return !existsSync(root) || readdirSync(root).length === 0;
}

// Writes the export into a folder that is new or empty; refuses any other.
export function writeSkillFolders(
  root: string,
  files: readonly { path: string; text: string }[],
): void {
  if (!isNewOrEmpty(root)) throw new Error(`${root} is not empty.`);
  mkdirSync(root, { recursive: true });
  for (const file of files) {
    const target = join(root, file.path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, file.text, { flag: "wx" });
  }
}
