// `pnpm check:memory [--write] [--local [--fix]]`: the chief memory in `.agents/memories/` (its
// README is the schema). CI runs the plain form.
// --write  writes `long-term/rules/README.md` from the fields of the rule files first.
// --local  also checks this machine: the short-term lines in `.git/info/exclude` (`--fix` adds
//          them) and the words of `short-term/private-words.txt`. Run it before each push.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  MEMORY_DIR,
  RULES_INDEX,
  SHORT_TERM,
  checkExclude,
  checkMemory,
  checkPrivateWords,
  rulesIndex,
} from "./lib/check-memory.ts";
import { addExcludeLines, readIfExists } from "./lib/check-memory-local.ts";
import { report } from "./lib/report.ts";

const { values } = parseArgs({
  options: {
    write: { type: "boolean", default: false },
    local: { type: "boolean", default: false },
    fix: { type: "boolean", default: false },
  },
});

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" });
const lines = (text: string): string[] => text.split("\n").filter((line) => line !== "");

// Each memory file that git tracks or would track: a new file counts before `git add`, and the
// ignored short-term files never count.
const paths = lines(
  git("ls-files", "--cached", "--others", "--exclude-standard", "--", MEMORY_DIR),
);
const files = new Map<string, string>();
for (const path of paths) {
  // A tracked file that was deleted in the work tree is not part of the memory any more.
  const text = readIfExists(path);
  if (text !== undefined) files.set(path, text);
}

if (values.write) {
  const index = rulesIndex(files);
  writeFileSync(RULES_INDEX, index);
  files.set(RULES_INDEX, index);
}

const tracked = lines(git("ls-files", "--", SHORT_TERM));
const problems = checkMemory({ files, exists: (path) => existsSync(path), tracked });
const warnings: string[] = [];

if (values.local) {
  const exclude = join(git("rev-parse", "--git-common-dir").trim(), "info", "exclude");
  const text = values.fix ? addExcludeLines(exclude) : (readIfExists(exclude) ?? "");
  problems.push(...checkExclude(text));
  const wordsFile = `${SHORT_TERM}/private-words.txt`;
  const words = readIfExists(wordsFile);
  if (words === undefined) {
    warnings.push(`${wordsFile} does not exist, so no private word was checked`);
  } else {
    problems.push(...checkPrivateWords(files, lines(words)));
  }
}

report("check:memory", problems, warnings);
