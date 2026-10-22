import { join } from "node:path";
import { openDatabase } from "../adapters/db/connection";
import { decodeId } from "../adapters/db/typeid";
import { MIGRATIONS_FOLDER } from "./compose";
import { parseConfig } from "./config";

const USAGE = `Usage:
  pnpm --filter @cty1ng/backend cli ids decode <typeid|uuid>   convert an id both ways (D36)
  pnpm --filter @cty1ng/backend cli db migrate                 apply migrations to DATA_DIR/app.db`;

/** Runs one CLI command and returns its output; throws with a message on bad input. */
export function runCli(args: readonly string[], env: Record<string, string | undefined>): string {
  const [group, command, value] = args;
  if (group === "ids" && command === "decode" && value !== undefined) {
    return JSON.stringify(decodeId(value), null, 2);
  }
  if (group === "db" && command === "migrate") {
    const result = parseConfig(env);
    if (!result.ok) throw new Error(result.message);
    const file = join(result.config.dataDir, "app.db");
    openDatabase({ file, migrationsFolder: MIGRATIONS_FOLDER }).close();
    return `migrated ${file}`;
  }
  throw new Error(USAGE);
}

if (import.meta.main) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2), process.env)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
