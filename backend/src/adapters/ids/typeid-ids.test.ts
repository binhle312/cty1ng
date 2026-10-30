import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { BotId } from "@cty1ng/shared/ids";
import { describe, expect, it } from "vitest";
import { typeIdIds, typeIdToUuid, uuidToTypeId } from "./typeid-ids.ts";

// D22, D36: new ids are UUIDv7 values written as TypeIDs.
describe("typeIdIds", () => {
  it("makes a TypeID with the prefix whose UUID is version 7", () => {
    const id = typeIdIds.newId("bot");
    expect(BotId.safeParse(id).success).toBe(true);
    expect(typeIdToUuid(id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("makes ids that sort by creation time", () => {
    const ids = Array.from({ length: 20 }, () => typeIdIds.newId("msg"));
    expect([...ids].sort()).toEqual(ids);
  });

  it("converts both ways", () => {
    const id = typeIdIds.newId("conv");
    expect(uuidToTypeId("conv", typeIdToUuid(id))).toBe(id);
  });
});

describe("cli ids decode", () => {
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [resolve(import.meta.dirname, "../../app/cli.ts"), ...args], {
      encoding: "utf8",
    });

  it("prints the UUID of a TypeID, and the TypeID of a UUID with a prefix", () => {
    const id = typeIdIds.newId("bot");
    const uuid = cli("ids", "decode", id).stdout.trim();
    expect(uuid).toBe(typeIdToUuid(id));
    expect(cli("ids", "decode", uuid, "bot").stdout.trim()).toBe(id);
  });

  it("fails on a value that is not an id, and prints usage for an unknown command", () => {
    expect(cli("ids", "decode", "nope_123").status).toBe(1);
    const usage = cli("frobnicate");
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain("Usage:");
  });
});
