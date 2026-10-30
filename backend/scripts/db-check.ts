// `pnpm --filter backend db:check`: the Drizzle schema and the committed migrations agree
// (testing.md §4). drizzle-kit generates into a copy of migrations/; a new file means the
// schema has changes that no migration holds. drizzle-kit needs a relative `out`, so the copy
// is a temporary folder inside backend/.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const backend = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(backend, ".db-check-"));
try {
  cpSync(join(backend, "migrations"), join(temp, "migrations"), { recursive: true });
  const before = readdirSync(join(temp, "migrations")).length;
  const config = join(temp, "drizzle.config.ts");
  writeFileSync(
    config,
    `export default ${JSON.stringify({
      dialect: "sqlite",
      schema: "./src/adapters/db/schema.ts",
      out: `./${basename(temp)}/migrations`,
    })};\n`,
  );
  const run = spawnSync(
    join(backend, "node_modules/.bin/drizzle-kit"),
    ["generate", "--config", config],
    {
      cwd: backend,
      encoding: "utf8",
    },
  );
  const after = readdirSync(join(temp, "migrations")).length;
  if (run.status !== 0) {
    console.error(run.stdout, run.stderr);
    process.exitCode = 1;
  } else if (after !== before) {
    console.error(
      "db:check: the schema has changes that no migration holds. Run `pnpm --filter backend db:generate`.",
    );
    process.exitCode = 1;
  } else {
    console.log("db:check: schema and migrations agree");
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
