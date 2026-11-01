import { describe, expect, it } from "vitest";
import { concurrencyLimit } from "./avatar-image.ts";

// security.md §2.4: a decode at the pixel limit holds about 100 MB, so uploads decode a few at
// a time.
describe("concurrencyLimit", () => {
  it("runs at most max jobs at once, and starts the next when one ends", async () => {
    const limit = concurrencyLimit(2);
    const started: number[] = [];
    const finish: (() => void)[] = [];
    const job = (n: number) => () =>
      new Promise<number>((resolve) => {
        started.push(n);
        finish[n] = () => {
          resolve(n);
        };
      });
    const runs = [1, 2, 3].map((n) => limit(job(n)));
    await Promise.resolve();
    expect(started).toEqual([1, 2]);
    finish[1]?.();
    expect(await runs[0]).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual([1, 2, 3]);
    finish[2]?.();
    finish[3]?.();
    expect(await Promise.all(runs)).toEqual([1, 2, 3]);
  });

  it("frees the slot when a job fails", async () => {
    const limit = concurrencyLimit(1);
    await expect(limit(() => Promise.reject(new Error("bad image")))).rejects.toThrow("bad image");
    expect(await limit(() => Promise.resolve("next"))).toBe("next");
  });
});
