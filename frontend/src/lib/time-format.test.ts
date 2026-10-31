import { describe, expect, it } from "vitest";
import { formatFullTime, formatTime } from "./time-format.ts";

// time-format.md §1 (ui-rules T1, T3). Local time is UTC in this file, so the results do not
// depend on the machine's zone (Node reads TZ again when it changes).
process.env.TZ = "UTC";

describe("formatTime", () => {
  const now = new Date("2026-10-31T12:00:00Z");

  it("says x ago under one day", () => {
    expect(formatTime("2026-10-31T11:59:30Z", now)).toBe("just now");
    expect(formatTime("2026-10-31T11:55:00Z", now)).toBe("5 min ago");
    expect(formatTime("2026-10-31T09:00:00Z", now)).toBe("3 h ago");
    expect(formatTime("2026-10-30T12:00:01Z", now)).toBe("23 h ago");
  });

  it("gives the local time in ISO order from one day, on a 24-hour clock", () => {
    expect(formatTime("2026-10-30T12:00:00Z", now)).toBe("2026-10-30 12:00");
    expect(formatTime("2026-10-21T09:05:00Z", now)).toBe("2026-10-21 09:05");
  });

  it("gives the full time with the UTC offset for the tooltip", () => {
    expect(formatFullTime("2026-10-21T14:05:09Z")).toBe("2026-10-21 14:05:09 +00:00");
  });
});
