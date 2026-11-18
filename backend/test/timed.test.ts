import { afterEach, describe, expect, it, vi } from "vitest";
import { fastestRun, fastestRunAsync, MAX_RUNS } from "./timed.ts";

// `performance.now` is replaced by a list of times: each run of `work` reads it twice (start and
// end), so the pair `[0, 100]` is a run of 100 ms. The string form `"now"` is on purpose: the lint
// rule for timed tests reads the property form (docs/testing.md §3, "Timed tests").
function runsOf(...durations: number[]): void {
  const times = durations.flatMap((duration, index) => [index * 1_000, index * 1_000 + duration]);
  const spy = vi.spyOn(performance, "now");
  for (const time of times) spy.mockReturnValueOnce(time);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fastestRun", () => {
  it("runs up to 3 times", () => {
    expect(MAX_RUNS).toBe(3);
  });

  it("stops at the first run under the limit", () => {
    runsOf(10);
    const work = vi.fn();
    expect(fastestRun(work, 50)).toBe(10);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("stops at the first run under the limit, after a slow run", () => {
    runsOf(100, 10);
    const work = vi.fn();
    expect(fastestRun(work, 50)).toBe(10);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("runs 3 times when each run is over the limit, and returns the fastest", () => {
    runsOf(100, 10, 40);
    const work = vi.fn();
    expect(fastestRun(work, 5)).toBe(10);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("never starts a fourth run", () => {
    runsOf(100, 90, 80, 1);
    const work = vi.fn();
    expect(fastestRun(work, 5)).toBe(80);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("does not retry an error: the test ends at once", () => {
    const work = vi.fn(() => {
      throw new Error("wrong result");
    });
    expect(() => fastestRun(work, 50)).toThrow("wrong result");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("fastestRunAsync", () => {
  it("stops at the first run under the limit", async () => {
    runsOf(10);
    const work = vi.fn(() => Promise.resolve());
    expect(await fastestRunAsync(work, 50)).toBe(10);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("runs 3 times when each run is over the limit, and returns the fastest", async () => {
    runsOf(100, 10, 40);
    const work = vi.fn(() => Promise.resolve());
    expect(await fastestRunAsync(work, 5)).toBe(10);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("stops at the first run under the limit, after a slow run", async () => {
    runsOf(100, 10);
    const work = vi.fn(() => Promise.resolve());
    expect(await fastestRunAsync(work, 50)).toBe(10);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("never starts a fourth run", async () => {
    runsOf(100, 90, 80, 1);
    const work = vi.fn(() => Promise.resolve());
    expect(await fastestRunAsync(work, 5)).toBe(80);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("does not retry a rejection: the test ends at once", async () => {
    const work = vi.fn(() => Promise.reject(new Error("wrong result")));
    await expect(fastestRunAsync(work, 50)).rejects.toThrow("wrong result");
    expect(work).toHaveBeenCalledTimes(1);
  });
});
