import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
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
      const skillMd = name === "SKILL.md" ? readSkillMd(path) : "skipped";
      if (skillMd === "skipped") found.skippedFiles.push(name);
      else found.skillMd = skillMd;
    }
    folders.push(found);
  }
  return folders;
}

// Opens the file once and checks and reads that open file, so it cannot change between the
// check and the read. A link (O_NOFOLLOW) or anything that is not a regular file is skipped;
// O_NONBLOCK keeps a named pipe from blocking the open. The read stops one byte past the limit,
// so a file that grows after the check is still too large.
function readSkillMd(path: string): Uint8Array | "too_large" | "skipped" {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    return "skipped";
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return "skipped";
    if (stat.size > MAX_SKILL_MD_BYTES) return "too_large";
    const buffer = Buffer.alloc(MAX_SKILL_MD_BYTES + 1);
    let length = 0;
    for (;;) {
      const read = readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      if (length > MAX_SKILL_MD_BYTES) return "too_large";
    }
    return new Uint8Array(buffer.subarray(0, length));
  } finally {
    closeSync(fd);
  }
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
