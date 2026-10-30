import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewEvent, Readers, UnitOfWork } from "../../src/core/ports/repositories.ts";
import { sleep } from "../helpers.ts";

// The unit-of-work contract (architecture.md §2, §11; M0 AC8). Every persistence adapter runs
// it.
export interface UnitOfWorkFixture {
  uow: UnitOfWork;
  readers: Readers;
  // A compare-and-set in its own transaction on a second connection, as another process (or
  // another pool connection) would run it.
  otherSetIf(key: string, expected: unknown, next: unknown): Promise<boolean>;
  close(): void | Promise<void>;
}

const event = (note: string): NewEvent => ({
  type: "test.ping",
  conversationId: null,
  payload: { note },
  createdAt: new Date("2026-10-30T12:00:00.000Z"),
});

export function unitOfWorkContract(
  name: string,
  setup: () => UnitOfWorkFixture | Promise<UnitOfWorkFixture>,
) {
  describe(`unit-of-work contract: ${name}`, () => {
    let f: UnitOfWorkFixture;
    beforeEach(async () => {
      f = await setup();
    });
    afterEach(async () => {
      await f.close();
    });

    it("commits the work and returns its result", async () => {
      const seq = await f.uow.run(async (tx) => {
        await tx.settings.set("display_name", "Binh");
        return tx.events.append(event("a"));
      });
      expect(seq).toBe(1);
      expect(await f.readers.settings.get("display_name")).toBe("Binh");
      expect(await f.readers.events.after(0, 10)).toMatchObject([
        { seq: 1, type: "test.ping", conversationId: null, payload: { note: "a" } },
      ]);
    });

    it("leaves no event and no setting when the work throws, and rethrows the error", async () => {
      const failure = new Error("boom");
      await expect(
        f.uow.run(async (tx) => {
          await tx.events.append(event("lost"));
          await tx.settings.set("display_name", "lost");
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(await f.readers.events.after(0, 10)).toEqual([]);
      expect(await f.readers.events.bounds()).toEqual({ oldest: null, newest: null });
      expect(await f.readers.settings.get("display_name")).toBeUndefined();
    });

    it("lets a transaction read its own writes; other readers see only committed data", async () => {
      await f.uow.run(async (tx) => {
        await tx.events.append(event("mine"));
        expect(await tx.events.after(0, 10)).toHaveLength(1);
        expect(await f.readers.events.after(0, 10)).toEqual([]);
      });
      expect(await f.readers.events.after(0, 10)).toHaveLength(1);
    });

    it("runs afterCommit callbacks once, after the commit, and never after a rollback", async () => {
      const calls: string[] = [];
      await f.uow.run(async (tx) => {
        tx.afterCommit(() => calls.push("committed"));
        await tx.events.append(event("a"));
        calls.push("work done");
      });
      await f.uow
        .run((tx) => {
          tx.afterCommit(() => calls.push("rolled back"));
          return Promise.reject(new Error("no"));
        })
        .catch(() => undefined);
      expect(calls).toEqual(["work done", "committed"]);
    });

    it("still reports a commit when an afterCommit callback throws", async () => {
      const seq = await f.uow.run(async (tx) => {
        tx.afterCommit(() => {
          throw new Error("callback failed");
        });
        return tx.events.append(event("kept"));
      });
      expect(seq).toBe(1);
      expect(await f.readers.events.after(0, 10)).toHaveLength(1);
    });

    it("lets exactly one of two racing compare-and-sets win (§11)", async () => {
      await f.uow.run((tx) => tx.settings.set("owner_lock", "free"));
      const race = (uow: UnitOfWork, winner: string) =>
        uow.run(async (tx) => {
          const seen = await tx.settings.get("owner_lock");
          await sleep(10); // both have read before either writes, if the adapter allowed it
          return seen === "free" && (await tx.settings.setIf("owner_lock", "free", winner));
        });
      const results = await Promise.all([race(f.uow, "first"), race(f.uow, "second")]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(["first", "second"]).toContain(await f.readers.settings.get("owner_lock"));
    });

    it("lets exactly one compare-and-set win across two connections", async () => {
      await f.uow.run((tx) => tx.settings.set("owner_lock", "free"));
      const results = await Promise.all([
        f.uow.run((tx) => tx.settings.setIf("owner_lock", "free", "this")),
        f.otherSetIf("owner_lock", "free", "other"),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("treats `expected: undefined` as 'no row yet' in compare-and-set", async () => {
      expect(await f.uow.run((tx) => tx.settings.setIf("new_key", undefined, 1))).toBe(true);
      expect(await f.uow.run((tx) => tx.settings.setIf("new_key", undefined, 2))).toBe(false);
      expect(await f.readers.settings.get("new_key")).toBe(1);
    });

    it("gives strictly increasing seqs under parallel appends", async () => {
      const seqs = await Promise.all(
        Array.from({ length: 50 }, (_, i) => f.uow.run((tx) => tx.events.append(event(`p${i}`)))),
      );
      expect(new Set(seqs).size).toBe(50);
      const stored = (await f.readers.events.after(0, 100)).map((row) => row.seq);
      expect(stored).toHaveLength(50);
      expect(stored).toEqual([...stored].sort((a, b) => a - b));
      expect(stored.every((seq, i) => i === 0 || seq > (stored[i - 1] ?? 0))).toBe(true);
    });

    it("does not let a second transaction run inside one that is waiting", async () => {
      // A waits (an await inside the work), then rolls back. B starts while A waits. If B ran on
      // A's open transaction, A's rollback would take B's event with it.
      let release = (): void => undefined;
      const a = f.uow
        .run(async (tx) => {
          await tx.events.append(event("a"));
          await new Promise<void>((resolve) => (release = resolve));
          throw new Error("A rolls back");
        })
        .catch(() => "rolled back");
      await sleep(10);
      const b = f.uow.run((tx) => tx.events.append(event("b")));
      await sleep(20);
      release();
      expect(await a).toBe("rolled back");
      await b;
      const kept = await f.readers.events.after(0, 10);
      expect(kept.map((row) => row.payload)).toEqual([{ note: "b" }]);
    });

    it("pages events with after(seq, limit)", async () => {
      for (const note of ["a", "b", "c", "d"])
        await f.uow.run((tx) => tx.events.append(event(note)));
      expect((await f.readers.events.after(1, 2)).map((row) => row.seq)).toEqual([2, 3]);
      expect(await f.readers.events.bounds()).toEqual({ oldest: 1, newest: 4 });
    });
  });
}
