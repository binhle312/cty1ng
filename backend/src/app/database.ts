import { mkdirSync } from "node:fs";
import { openWriter } from "../adapters/db/client.ts";
import { MIGRATIONS_FOLDER, migrate } from "../adapters/db/migrate.ts";
import type { Config } from "./config.ts";

// Opens the database and applies pending migrations; used at start and by `db migrate`.
export function openDatabase(config: Config) {
  mkdirSync(config.dataDir, { recursive: true });
  const writer = openWriter(config.databaseFile);
  try {
    const applied = migrate(writer, MIGRATIONS_FOLDER);
    return { writer, applied };
  } catch (error) {
    writer.close();
    throw error;
  }
}
