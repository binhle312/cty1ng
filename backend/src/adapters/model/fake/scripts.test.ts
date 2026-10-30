import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFakeScripts, parseFakeScript } from "./scripts.ts";

// testing.md §2: the fake model's script format.
describe("fake model scripts", () => {
  it("loads the fixture folder, keyed by file name", () => {
    const scripts = loadFakeScripts(
      resolve(import.meta.dirname, "../../../../test/fixtures/fake-scripts"),
    );
    const example = scripts.get("example");
    expect(example?.ba).toHaveLength(2);
    expect(example?._titles?.[0]).toEqual({
      when_contains: "login",
      title: "Login page user stories",
      delay_ms: 500,
    });
  });

  it.each([
    ["an unknown turn field", "ba:\n  - replies: hi\n"],
    ["a key that is not a bot slug", "Bad_Slug:\n  - reply: hi\n"],
    [
      "a tool call with two tools",
      "ba:\n  - tool_calls:\n      - { read_file: {path: a}, write_file: {path: b} }\n",
    ],
    ["a bad force", "ba:\n  - tool_calls:\n      - read_file: {path: a, force: maybe}\n"],
    ["a title turn with both title and fail", "_titles:\n  - { title: x, fail: error }\n"],
    ["a title turn with neither", "_titles:\n  - { delay_ms: 5 }\n"],
    ["an unknown fail", "_titles:\n  - { fail: sometimes }\n"],
  ])("rejects %s", (_label, yaml) => {
    expect(() => parseFakeScript(yaml, "bad.yaml")).toThrow(/^bad\.yaml/);
  });
});
