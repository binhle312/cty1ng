import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli";

describe("cli", () => {
  // Test vector from the TypeID spec (jetify-com/typeid, spec/valid.yml).
  const SUFFIX = "01h455vb4pex5vsknk084sn02q";
  const UUID = "01890a5d-ac96-774b-bcce-b302099a8057";

  it("ids decode converts a TypeID to its UUID (D36)", () => {
    const output: unknown = JSON.parse(runCli(["ids", "decode", `bot_${SUFFIX}`], {}));
    expect(output).toEqual({ typeId: `bot_${SUFFIX}`, uuid: UUID });
  });

  it("ids decode lists a UUID under every prefix", () => {
    const output: unknown = JSON.parse(runCli(["ids", "decode", UUID], {}));
    expect(output).toMatchObject({ uuid: UUID });
    expect(output).toHaveProperty(
      "typeIds",
      expect.arrayContaining([`bot_${SUFFIX}`, `msg_${SUFFIX}`]),
    );
  });

  it("db migrate creates the database in DATA_DIR", () => {
    const dir = mkdtempSync(join(tmpdir(), "cty1ng-cli-"));
    try {
      expect(runCli(["db", "migrate"], { DATA_DIR: dir })).toContain("app.db");
      expect(existsSync(join(dir, "app.db"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the usage for an unknown command", () => {
    expect(() => runCli(["nope"], {})).toThrow("Usage:");
  });
});
