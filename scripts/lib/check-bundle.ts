import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { z } from "zod";

// The bundle budget of frontend-conventions.md §4, measured on a production build: the
// first-load JavaScript of the app shell (the entry chunks and everything they import
// statically) must stay at or under the budget, gzipped. A lazy chunk over its limit is a
// warning. 1 KB = 1000 bytes, as Vite reports sizes.
export const FIRST_LOAD_BUDGET_KB = 250;
export const LAZY_CHUNK_WARNING_KB = 300;

const Manifest = z.record(
  z.string(),
  z.object({
    file: z.string(),
    isEntry: z.boolean().optional(),
    imports: z.array(z.string()).optional(),
  }),
);
type Manifest = z.infer<typeof Manifest>;

export interface BundleResult {
  firstLoadKb: number;
  problems: string[];
  warnings: string[];
}

function gzipKb(path: string): number {
  return gzipSync(readFileSync(path), { level: 9 }).length / 1000;
}

function firstLoadKeys(manifest: Manifest): Set<string> {
  const seen = new Set<string>();
  const visit = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key]?.imports ?? []) visit(next);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry === true) visit(key);
  return seen;
}

export function checkBundle(
  distDir: string,
  budgets = { firstLoadKb: FIRST_LOAD_BUDGET_KB, lazyChunkKb: LAZY_CHUNK_WARNING_KB },
): BundleResult {
  const raw: unknown = JSON.parse(readFileSync(join(distDir, ".vite/manifest.json"), "utf8"));
  const manifest = Manifest.parse(raw);
  const firstLoad = firstLoadKeys(manifest);

  let firstLoadKb = 0;
  const warnings: string[] = [];
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.file.endsWith(".js")) continue;
    const size = gzipKb(join(distDir, chunk.file));
    if (firstLoad.has(key)) {
      firstLoadKb += size;
    } else if (size > budgets.lazyChunkKb) {
      warnings.push(
        `lazy chunk ${chunk.file} is ${size.toFixed(1)} KB gzipped (warning above ${budgets.lazyChunkKb} KB)`,
      );
    }
  }

  const problems =
    firstLoadKb > budgets.firstLoadKb
      ? [
          `first-load JavaScript is ${firstLoadKb.toFixed(1)} KB gzipped, over the ${budgets.firstLoadKb} KB budget (frontend-conventions.md §4)`,
        ]
      : [];
  return { firstLoadKb, problems, warnings };
}
