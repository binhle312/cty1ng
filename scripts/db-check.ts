// `pnpm db:check` (or `pnpm --filter backend db:check`): the Drizzle schema and the committed migrations agree
// (testing.md §4). Two checks:
// 1. drizzle-kit generates into a copy of migrations/; a new file means the schema has changes
//    that no migration holds.
// 2. The SQL of the migrations builds the schema that schema.ts builds: the committed migrations
//    run in one database in memory, and a migration that drizzle-kit writes from schema.ts into an
//    empty folder runs in another (./lib/db-schema.ts compares them). So a hand edit of a committed
//    migration fails. A data statement that changes no schema is not seen.
// drizzle-kit needs a relative `out`, so the copies are in a temporary folder inside backend/.
// node:sqlite is part of Node; the backend's SQLite library does not resolve from scripts/.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { readSchema, schemaDifferences } from "./lib/db-schema.ts";

const backend = resolve(import.meta.dirname, "../backend");
// A test points this at a copy (scripts/db-check.test.ts).
const source = process.env.DB_CHECK_MIGRATIONS ?? join(backend, "migrations");

const Journal = z.object({ entries: z.array(z.object({ tag: z.string() })) });

// The statements of each migration in the order of its journal, as drizzle's migrator reads them.
function statementsOf(folder: string): string[] {
  const journal = Journal.parse(
    JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")),
  );
  return journal.entries.flatMap(({ tag }) =>
    readFileSync(join(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint"),
  );
}

function schemaBuiltBy(folder: string) {
  const db = new DatabaseSync(":memory:");
  try {
    for (const statement of statementsOf(folder)) db.exec(statement);
    return readSchema(db);
  } finally {
    db.close();
  }
}

function generate(options: { temp: string; out: string }) {
  const config = join(options.temp, `${options.out}.config.ts`);
  writeFileSync(
    config,
    `export default ${JSON.stringify({
      dialect: "sqlite",
      schema: "./src/adapters/db/schema.ts",
      out: `./${basename(options.temp)}/${options.out}`,
    })};\n`,
  );
  return spawnSync(
    join(backend, "node_modules/.bin/drizzle-kit"),
    ["generate", "--config", config],
    { cwd: backend, encoding: "utf8" },
  );
}

function check(temp: string): number {
  cpSync(source, join(temp, "migrations"), { recursive: true });
  const before = readdirSync(join(temp, "migrations")).length;
  const run = generate({ temp, out: "migrations" });
  if (run.status !== 0) {
    console.error(run.stdout, run.stderr);
    return 1;
  }
  if (readdirSync(join(temp, "migrations")).length !== before) {
    console.error(
      "db:check: the schema has changes that no migration holds. Run `pnpm --filter backend db:generate`.",
    );
    return 1;
  }
  const fresh = generate({ temp, out: "fresh" });
  if (fresh.status !== 0) {
    console.error(fresh.stdout, fresh.stderr);
    return 1;
  }
  const differences = schemaDifferences({
    migrations: schemaBuiltBy(source),
    schema: schemaBuiltBy(join(temp, "fresh")),
  });
  if (differences.length > 0) {
    console.error(
      "db:check: the migration SQL does not build the schema of schema.ts. Was a migration edited by hand?",
    );
    for (const line of differences) console.error(`  ${line}`);
    return 1;
  }
  console.log("db:check: schema and migrations agree");
  return 0;
}

const temp = mkdtempSync(join(backend, ".db-check-"));
try {
  process.exitCode = check(temp);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
