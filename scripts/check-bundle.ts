// `pnpm check:bundle [dist]`: the first-load bundle budget (frontend-conventions.md §4).
// Run it after the production build; the default folder is frontend/dist.
import { checkBundle } from "./lib/check-bundle.ts";
import { report } from "./lib/report.ts";

const result = checkBundle(process.argv[2] ?? "frontend/dist");
console.log(`first-load JavaScript: ${result.firstLoadKb.toFixed(1)} KB gzipped`);
report("check:bundle", result.problems, result.warnings);
