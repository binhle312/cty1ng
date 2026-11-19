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

// The files with ledger rows. A move of rows to a new file adds the file here; the check fails
// until it does.
const LEDGER_FILES = ["docs/delivery-quality.md", "docs/delivery-quality-archive.md"];

const { values } = parseArgs({ options: { write: { type: "boolean", default: false } } });
const read = (path: string): LedgerFile => ({ path, text: readFileSync(path, "utf8") });
const files = LEDGER_FILES.map(read);
const docs = readdirSync("docs", { recursive: true, encoding: "utf8" })
  .filter((name) => name.endsWith(".md"))
  .map((name) => read(join("docs", name)));
const stray = strayLedgerFiles({ docs, list: LEDGER_FILES });
// The other places that the "Same cause?" search of a row reads (AGENTS.md §9: the lessons).
const lessons = docs.filter((file) => /^docs\/lessons-learned\/[^/]+\.md$/.test(file.path));

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
    written.problems.length > 0 ? written.problems : checkCounts(written.files, lessons),
  );
} else {
  report("records:counts", [...stray, ...checkCounts(files, lessons)]);
}
