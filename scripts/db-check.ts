/**
 * Fails when the Drizzle schema has changes that no committed migration covers
 * (testing.md §4, `db:check`). Runs `drizzle-kit generate` against a copy of the migrations
 * folder and checks that it writes nothing new. `drizzle-kit check` (run first by the
 * package script) checks that the migrations themselves are consistent.
 * Run from `backend/`.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Relative on purpose: drizzle-kit prefixes `--out` with "./", which breaks absolute paths.
const copy = "node_modules/.cache/db-check";
const sqlFiles = (): string[] => readdirSync(copy).filter((name) => name.endsWith(".sql"));

rmSync(copy, { recursive: true, force: true });
try {
  cpSync("migrations", copy, { recursive: true });
  const before = sqlFiles().length;
  const output = execFileSync(
    "pnpm",
    [
      "exec",
      "drizzle-kit",
      "generate",
      "--dialect",
      "sqlite",
      "--schema",
      "./src/adapters/db/schema.ts",
      "--out",
      copy,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  // drizzle-kit can exit 0 after an error, so require its "nothing to do" answer explicitly.
  const unchanged = sqlFiles().length === before && /No schema changes/i.test(output);
  if (!unchanged || !existsSync(join(copy, "meta/_journal.json"))) {
    process.stderr.write(
      "db:check: the schema has changes without a migration (or drizzle-kit failed). " +
        "Run `pnpm --filter @cty1ng/backend db:generate`.\n" +
        output,
    );
    process.exit(1);
  }
  process.stdout.write("db:check: schema and migrations agree\n");
} finally {
  rmSync(copy, { recursive: true, force: true });
}
