// `pnpm check:index`: folder indexes and docs metadata (architecture.md §4.2).
import { checkAll } from "./lib/check-index.ts";
import { report } from "./lib/report.ts";

report("check:index", checkAll(process.cwd()));
