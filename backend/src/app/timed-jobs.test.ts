import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryLogger } from "../../test/helpers.ts";
import { startTimedJobs } from "./timed-jobs.ts";

afterEach(() => {
  vi.useRealTimers();
});

const HOUR = 3_600_000;

function start(
  options: {
    purgeDue?: () => Promise<number>;
    botsPurgeDue?: () => Promise<number>;
    cleanup?: () => Promise<number>;
    pruneDue?: () => Promise<number>;
    purgeIntervalHours?: number;
    eventPruneIntervalHours?: number;
  } = {},
) {
  const { log, lines } = memoryLogger();
  const purgeDue = vi.fn(options.purgeDue ?? (() => Promise.resolve(0)));
  const pruneDue = vi.fn(options.pruneDue ?? (() => Promise.resolve(0)));
  const botsPurgeDue = vi.fn(options.botsPurgeDue ?? (() => Promise.resolve(0)));
  const cleanup = vi.fn(options.cleanup ?? (() => Promise.resolve(0)));
  const stop = startTimedJobs({
    skills: { purgeDue },
    bots: { purgeDue: botsPurgeDue },
    avatars: { cleanup },
    eventPruning: { pruneDue },
    log,
    purgeIntervalHours: options.purgeIntervalHours ?? 24,
    eventPruneIntervalHours: options.eventPruneIntervalHours ?? 24,
  });
  return { purgeDue, botsPurgeDue, cleanup, pruneDue, stop, lines };
}

describe("startTimedJobs", () => {
  it("runs the Trash purge at start and every PURGE_INTERVAL_HOURS, until stopped", async () => {
    vi.useFakeTimers();
    const { purgeDue, stop } = start({ purgeIntervalHours: 2 });
    expect(purgeDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * HOUR - 1);
    expect(purgeDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(purgeDue).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(10 * HOUR);
    expect(purgeDue).toHaveBeenCalledTimes(2);
  });

  it("runs the event pruning at start and every EVENT_PRUNE_INTERVAL_HOURS, until stopped", async () => {
    vi.useFakeTimers();
    const { pruneDue, stop, lines } = start({
      pruneDue: () => Promise.resolve(4),
      purgeIntervalHours: 1,
      eventPruneIntervalHours: 3,
    });
    expect(pruneDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * HOUR - 1);
    expect(pruneDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pruneDue).toHaveBeenCalledTimes(2);
    expect(lines.filter((line) => line.includes("event prune"))).toHaveLength(2);
    stop();
    await vi.advanceTimersByTimeAsync(10 * HOUR);
    expect(pruneDue).toHaveBeenCalledTimes(2);
  });

  // Node runs a timer longer than 2^31 − 1 ms (about 24.8 days) after 1 ms instead.
  it.each([
    ["the event pruning", { eventPruneIntervalHours: 720 }, "pruneDue"],
    ["the Trash purge", { purgeIntervalHours: 720 }, "purgeDue"],
  ] as const)(
    "waits the whole interval for %s when it is longer than Node's timer limit",
    async (_, hours, job) => {
      vi.useFakeTimers();
      const jobs = start(hours);
      expect(jobs[job]).toHaveBeenCalledTimes(1);
      // First a short step, so the 1 ms timer fails here at once.
      await vi.advanceTimersByTimeAsync(10);
      expect(jobs[job]).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(720 * HOUR - 11);
      expect(jobs[job]).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(jobs[job]).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(720 * HOUR);
      expect(jobs[job]).toHaveBeenCalledTimes(3);
      jobs.stop();
      await vi.advanceTimersByTimeAsync(2 * 720 * HOUR);
      expect(jobs[job]).toHaveBeenCalledTimes(3);
    },
  );

  it("logs a failed purge and keeps the timer, and the pruning still runs", async () => {
    vi.useFakeTimers();
    const { purgeDue, pruneDue, stop, lines } = start({
      purgeDue: () => Promise.reject(new Error("database is locked")),
      purgeIntervalHours: 1,
      eventPruneIntervalHours: 1,
    });
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(purgeDue).toHaveBeenCalledTimes(2);
    expect(lines.filter((line) => line.includes("trash purge failed"))).toHaveLength(2);
    expect(pruneDue).toHaveBeenCalledTimes(2);
    stop();
  });

  // Review of PR #57: the three purge steps shared one try, so a skills purge that failed on
  // every run stopped the bots purge and the avatar cleanup for good.
  it("runs the bots purge and the avatar cleanup when the skills purge fails", async () => {
    vi.useFakeTimers();
    const { botsPurgeDue, cleanup, stop, lines } = start({
      purgeDue: () => Promise.reject(new Error("bad row")),
      botsPurgeDue: () => Promise.resolve(1),
      cleanup: () => Promise.reject(new Error("disk")),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(botsPurgeDue).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    const failed = lines.filter((line) => line.includes("trash purge failed"));
    expect(failed).toHaveLength(2);
    expect(failed[0]).toContain('"step":"skills"');
    expect(failed[1]).toContain('"step":"avatars"');
    expect(lines.some((line) => line.includes('"bots":1'))).toBe(true);
    stop();
  });

  it("logs a failed pruning and keeps the timer, and the purge still runs", async () => {
    vi.useFakeTimers();
    const { purgeDue, pruneDue, stop, lines } = start({
      pruneDue: () => Promise.reject(new Error("database is locked")),
      purgeIntervalHours: 1,
      eventPruneIntervalHours: 1,
    });
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(pruneDue).toHaveBeenCalledTimes(2);
    expect(lines.filter((line) => line.includes("event prune failed"))).toHaveLength(2);
    expect(purgeDue).toHaveBeenCalledTimes(2);
    stop();
  });
});
