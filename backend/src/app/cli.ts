import { typeIdToUuid, uuidToTypeId } from "../adapters/ids/typeid-ids.ts";
import { ConfigError, loadConfig } from "./config.ts";

// Small owner commands (architecture.md §4): `pnpm --filter backend cli <command>`.
const USAGE = `Usage:
  cli ids decode <typeid>          the UUID stored in the database (D36)
  cli ids decode <uuid> <prefix>   the TypeID shown everywhere else
  cli db migrate                   apply pending migrations (the same runner as at start)`;

async function run(args: readonly string[]): Promise<number> {
  const [group, command, ...rest] = args;
  if (group === "ids" && command === "decode" && rest.length >= 1 && rest.length <= 2) {
    const [value = "", prefix] = rest;
    try {
      process.stdout.write(
        `${prefix === undefined ? typeIdToUuid(value) : uuidToTypeId(prefix, value)}\n`,
      );
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "Not an id"}\n`);
      return 1;
    }
  }
  if (group === "db" && command === "migrate" && rest.length === 0) {
    try {
      // Loaded only here, so `ids decode` starts fast.
      const { openDatabase } = await import("./database.ts");
      const { writer, applied } = openDatabase(loadConfig(process.env));
      writer.close();
      process.stdout.write(`${applied} migration(s) applied\n`);
      return 0;
    } catch (error) {
      process.stderr.write(
        `Migration failed: ${error instanceof ConfigError || error instanceof Error ? error.message : "unknown error"}\n`,
      );
      return 1;
    }
  }
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

process.exitCode = await run(process.argv.slice(2));
