// `pnpm records:counts [--write]`: check the Audit row and the count cells of each `Ledger` row
// in docs/delivery-quality-register.md against the ledger rows. `--write` updates the cells
// before the check (docs/delivery-quality.md §7).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  ISSUE_FILES,
  type LedgerFile,
  checkCounts,
  formProblems,
  splitTables,
  strayLedgerFiles,
  writeCounts,
} from "./lib/records-counts.ts";
import { report } from "./lib/report.ts";

// The files with ledger rows and count tables. Add a new file here if it gets either.
const LEDGER_FILES = [...ISSUE_FILES, "docs/delivery-quality-register.md"];
const REQUIRED_SEARCH_FILES = ["docs/delivery-quality-prevention.md"];

const { values } = parseArgs({ options: { write: { type: "boolean", default: false } } });
const read = (path: string): LedgerFile => ({ path, text: readFileSync(path, "utf8") });
const files = LEDGER_FILES.map(read);
const docs = readdirSync("docs", { recursive: true, encoding: "utf8" })
  .filter((name) => name.endsWith(".md"))
  .map((name) => read(join("docs", name)));
const requiredSearchFiles = docs.filter((file) => REQUIRED_SEARCH_FILES.includes(file.path));
const missingSearchFiles = REQUIRED_SEARCH_FILES.filter(
  (path) => !requiredSearchFiles.some((file) => file.path === path),
);
const fileProblems = [
  ...strayLedgerFiles({ docs, list: LEDGER_FILES }),
  ...missingSearchFiles.map((path) => `${path}: required search file is missing.`),
  ...formProblems(requiredSearchFiles),
  ...splitTables(requiredSearchFiles),
];
// The "Same cause?" search (AGENTS.md §9) also reads docs/delivery-quality-prevention.md and the lessons.
const otherSearchFiles = [
  ...requiredSearchFiles,
  ...docs.filter((file) => /^docs\/lessons-learned\/[^/]+\.md$/.test(file.path)),
];

if (values.write && fileProblems.length === 0) {
  const written = writeCounts(files);
  for (const file of written.files) {
    const before = files.find((f) => f.path === file.path)?.text;
    if (before !== file.text) {
      writeFileSync(file.path, file.text);
      console.log(`records:counts: wrote ${file.path}`);
    }
  }
  // With a structure problem nothing is written, and the problems are the whole report.
  report(
    "records:counts",
    written.problems.length > 0 ? written.problems : checkCounts(written.files, otherSearchFiles),
  );
} else {
  report("records:counts", [...fileProblems, ...checkCounts(files, otherSearchFiles)]);
}
