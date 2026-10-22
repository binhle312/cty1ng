import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../src/adapters/db/connection";
import { createEventLogReader } from "../../src/adapters/db/events-repository";
import { createUnitOfWork } from "../../src/adapters/db/unit-of-work";
import { MIGRATIONS_FOLDER } from "../../src/app/compose";
import { runContract } from "./runner";
import { unitOfWorkContract } from "./unit-of-work.contract";

runContract(unitOfWorkContract, "Drizzle on SQLite (adapters/db)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cty1ng-uow-"));
  const connections = openDatabase({
    file: join(dir, "app.db"),
    migrationsFolder: MIGRATIONS_FOLDER,
  });
  return {
    subject: {
      uow: createUnitOfWork({ connections, onCommit: () => undefined }),
      committed: createEventLogReader(connections.read.db),
    },
    teardown() {
      connections.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
});
