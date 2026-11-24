// `pnpm records:counts [--write]`: the Audit row of docs/delivery-quality.md §2 and the count cells
// of each `Ledger` register row are what the ledger rows give (plans/p3-records-counts.md). With no
// flag it checks (CI runs it); `--write` writes the cells, then checks.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  type LedgerFile,
  checkCounts,
  strayLedgerFiles,
  writeCounts,
} from "./lib/records-counts.ts";
import { report } from "./lib/report.ts";

// The files with ledger rows and count tables. Add a new file here if it gets either.
const LEDGER_FILES = [
  "docs/delivery-quality.md",
  "docs/delivery-quality-archive.md",
  "docs/delivery-quality-register.md",
];

const { values } = parseArgs({ options: { write: { type: "boolean", default: false } } });
const read = (path: string): LedgerFile => ({ path, text: readFileSync(path, "utf8") });
const files = LEDGER_FILES.map(read);
const docs = readdirSync("docs", { recursive: true, encoding: "utf8" })
  .filter((name) => name.endsWith(".md"))
  .map((name) => read(join("docs", name)));
const stray = strayLedgerFiles({ docs, list: LEDGER_FILES });
// The "Same cause?" search also reads the prevention actions and the lessons (AGENTS.md §9).
const otherSearchFiles = docs.filter(
  (file) =>
    file.path === "docs/delivery-quality-prevention.md" ||
    /^docs\/lessons-learned\/[^/]+\.md$/.test(file.path),
);

if (values.write && stray.length === 0) {
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
  report("records:counts", [...stray, ...checkCounts(files, otherSearchFiles)]);
}
