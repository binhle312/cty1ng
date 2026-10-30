import { join } from "node:path";
import { ConversationId } from "@cty1ng/shared/ids";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TypeID, typeid } from "typeid-js";
import { tempDir } from "../../../test/helpers.ts";
import { openWriter } from "./client.ts";
import { events } from "./schema.ts";
import { MIGRATIONS_FOLDER, migrate } from "./migrate.ts";
import { sqliteReaders, sqliteUnitOfWork } from "./unit-of-work.ts";

// The TypeID column (D36): a TypeID in the code, a UUID in the database. UTC timestamps as
// ISO-8601 text with Z (domain-model.md §1).
let dir: ReturnType<typeof tempDir>;
let writer: Database.Database;
beforeEach(() => {
  dir = tempDir("columns");
  writer = openWriter(join(dir.path, "app.db"));
  migrate(writer, MIGRATIONS_FOLDER);
});
afterEach(() => {
  writer.close();
  dir.remove();
});

describe("TypeID and timestamp columns", () => {
  it("stores the UUID and reads back the TypeID", async () => {
    const id = ConversationId.parse(typeid("conv").toString());
    const uow = sqliteUnitOfWork(writer, () => undefined);
    const createdAt = new Date("2026-10-30T12:34:56.789Z");
    await uow.run((tx) =>
      tx.events.append({ type: "test.ping", conversationId: id, payload: {}, createdAt }),
    );

    const raw = writer
      .prepare<[], { conversation_id: string; created_at: string }>(
        "SELECT conversation_id, created_at FROM events",
      )
      .get();
    expect(raw?.conversation_id).toBe(TypeID.fromString(id).toUUID());
    expect(raw?.created_at).toBe("2026-10-30T12:34:56.789Z");
    const [row] = await sqliteReaders(writer).events.after(0, 1);
    expect(row?.conversationId).toBe(id);
    expect(row?.createdAt).toEqual(createdAt);
  });

  it("refuses an id with the wrong prefix or a malformed id", () => {
    expect(() => events.conversationId.mapToDriverValue(typeid("bot").toString())).toThrow();
    expect(() => events.conversationId.mapToDriverValue("conv_not-a-typeid")).toThrow();
  });
});
