import { describe, expect, it } from "vitest";
import { parseFrame } from "./sse.ts";

// The frame is outside data until the shared schema parses it (frontend-conventions.md §1).
describe("parseFrame", () => {
  it("reads a persisted event with its seq from the SSE id", () => {
    expect(parseFrame("test.ping", "7", '{"note":"hi"}')).toEqual({
      type: "test.ping",
      seq: 7,
      data: { note: "hi" },
    });
  });

  it("reads a control event without a seq", () => {
    expect(parseFrame("ready", "42", '{"max_seq":42}')).toEqual({
      type: "ready",
      data: { max_seq: 42 },
    });
  });

  it.each([
    ["data that is not JSON", "test.ping", "7", "{"],
    ["a missing seq", "test.ping", "", '{"note":"hi"}'],
    ["a field the schema does not know", "test.ping", "7", '{"note":"hi","x":1}'],
    ["a wrong field type", "ready", "1", '{"max_seq":"1"}'],
  ] as const)("drops %s", (_label, type, id, data) => {
    expect(parseFrame(type, id, data)).toBeNull();
  });
});
