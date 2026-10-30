import { describe, expect, it } from "vitest";
import { EVENT_TYPES, StreamEvent } from "./stream-event.ts";

describe("StreamEvent", () => {
  it("lists every type of the union", () => {
    expect(EVENT_TYPES).toEqual(["ready", "reset", "test.ping"]);
  });

  it("parses a persisted event with its seq", () => {
    const parsed = StreamEvent.parse({ type: "test.ping", seq: 812, data: { note: "hi" } });
    expect(parsed).toEqual({ type: "test.ping", seq: 812, data: { note: "hi" } });
  });

  it.each([
    ["an unknown type", { type: "nope", data: {} }],
    ["a persisted event without seq", { type: "test.ping", data: { note: "hi" } }],
    ["seq 0", { type: "test.ping", seq: 0, data: { note: "hi" } }],
    ["an unknown data key", { type: "ready", data: { max_seq: 1, extra: true } }],
    ["a negative max_seq", { type: "ready", data: { max_seq: -1 } }],
  ])("rejects %s", (_label, value) => {
    expect(StreamEvent.safeParse(value).success).toBe(false);
  });
});
