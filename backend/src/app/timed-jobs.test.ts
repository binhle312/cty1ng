import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryLogger } from "../../test/helpers.ts";
import { startTimedJobs } from "./timed-jobs.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("startTimedJobs", () => {
  it("runs the Trash purge at start and every PURGE_INTERVAL_HOURS, until stopped", async () => {
    vi.useFakeTimers();
    const purgeDue = vi.fn(() => Promise.resolve(0));
    const stop = startTimedJobs({
      skills: { purgeDue },
      log: memoryLogger().log,
      purgeIntervalHours: 2,
    });
    expect(purgeDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * 3_600_000 - 1);
    expect(purgeDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(purgeDue).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(10 * 3_600_000);
    expect(purgeDue).toHaveBeenCalledTimes(2);
  });

  it("logs a failed run and keeps the timer", async () => {
    vi.useFakeTimers();
    const { log, lines } = memoryLogger();
    const purgeDue = vi.fn(() => Promise.reject(new Error("database is locked")));
    const stop = startTimedJobs({ skills: { purgeDue }, log, purgeIntervalHours: 1 });
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(purgeDue).toHaveBeenCalledTimes(2);
    expect(lines.filter((line) => line.includes("trash purge failed"))).toHaveLength(2);
    stop();
  });
});
