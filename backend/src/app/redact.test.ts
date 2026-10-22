import { describe, expect, it } from "vitest";
import { createRedactor, MARKERS } from "./redact";

const SECRET = "sk-fake-0123";
const { toLoggable } = createRedactor([SECRET]);

/** JSON text of the result, to check no secret survives anywhere, keys included. */
const text = (value: unknown): string => JSON.stringify(toLoggable(value));

describe("toLoggable: values become plain JSON data with secrets replaced", () => {
  it("scrubs strings at any depth up to the limit, and truncates beyond it", () => {
    let deep: Record<string, unknown> = { leaf: SECRET };
    for (let i = 0; i < 30; i += 1) deep = { next: deep };
    const out = text(deep);
    expect(out).not.toContain(SECRET);
    expect(out).toContain(MARKERS.truncated);
  });

  it("scrubs what toJSON() returns, and never calls it again later", () => {
    let calls = 0;
    const value = {
      toJSON: () => {
        calls += 1;
        return { generated: `token ${SECRET}` };
      },
    };
    const loggable = toLoggable(value);
    expect(JSON.stringify(loggable)).toBe('{"generated":"token [redacted]"}');
    expect(calls).toBe(1);
  });

  it("scrubs property names", () => {
    expect(text({ [`key-${SECRET}`]: 1 })).toBe('{"key-[redacted]":1}');
  });

  it("replaces values it cannot represent safely", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const throwing = Object.defineProperty({}, "boom", {
      enumerable: true,
      get() {
        throw new Error(SECRET);
      },
    });
    expect(toLoggable({ fn: () => SECRET, sym: Symbol(SECRET), big: 10n })).toEqual({
      fn: MARKERS.unsupported,
      sym: MARKERS.unsupported,
      big: "10",
    });
    expect(toLoggable(circular)).toEqual({ name: "loop", self: MARKERS.circular });
    expect(toLoggable(throwing)).toEqual({ boom: MARKERS.unreadable });
    const badToJson = {
      toJSON: () => {
        throw new Error(SECRET);
      },
    };
    expect(toLoggable(badToJson)).toBe(MARKERS.unreadable);
  });

  it("turns Map, Set and Date into JSON data", () => {
    expect(toLoggable(new Map([[SECRET, SECRET]]))).toEqual([["[redacted]", "[redacted]"]]);
    expect(toLoggable(new Set([SECRET]))).toEqual(["[redacted]"]);
    expect(toLoggable(new Date("2026-10-22T00:00:00.000Z"))).toBe("2026-10-22T00:00:00.000Z");
  });

  it("keeps a shared, non-circular object at both places", () => {
    const shared = { id: 1 };
    expect(toLoggable({ a: shared, b: shared })).toEqual({ a: { id: 1 }, b: { id: 1 } });
  });
});

describe("toLoggable: errors keep their diagnostic details, redacted", () => {
  it("keeps code, status, custom fields and the cause chain", () => {
    const { toLoggable: plain } = createRedactor([]);
    const root = Object.assign(new Error("disk full"), { code: "ENOSPC" });
    const error = Object.assign(new Error("write failed", { cause: root }), {
      code: "SQLITE_BUSY",
      status: 503,
    });
    expect(plain(error)).toMatchObject({
      type: "Error",
      message: "write failed",
      code: "SQLITE_BUSY",
      status: 503,
      cause: { type: "Error", message: "disk full", code: "ENOSPC" },
    });
    expect(plain(error)).toHaveProperty("stack", expect.stringContaining("write failed"));
  });

  it("redacts the name, message, stack, fields and cause", () => {
    const error = new Error(`bad key ${SECRET}`, { cause: new Error(`inner ${SECRET}`) });
    error.name = `Named${SECRET}`;
    Object.assign(error, { detail: { header: SECRET } });
    const out = text(error);
    expect(out).not.toContain(SECRET);
    expect(toLoggable(error)).toMatchObject({
      type: "Named[redacted]",
      message: "bad key [redacted]",
      detail: { header: "[redacted]" },
      cause: { message: "inner [redacted]" },
    });
  });

  it("keeps the errors of an AggregateError", () => {
    const error = new AggregateError([new Error(`one ${SECRET}`)], "many");
    expect(toLoggable(error)).toMatchObject({
      type: "AggregateError",
      errors: [{ message: "one [redacted]" }],
    });
  });

  it("a cause that loops back is cut, not followed forever", () => {
    const error = new Error("a");
    error.cause = error;
    expect(toLoggable(error)).toMatchObject({ message: "a", cause: MARKERS.circular });
  });
});
