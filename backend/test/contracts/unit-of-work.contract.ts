import { expect } from "vitest";
import type { EventLogReader, UnitOfWork } from "../../src/core/ports/repositories";
import { defineContract } from "./runner";

export interface UnitOfWorkSubject {
  uow: UnitOfWork;
  /** Reads outside any unit of work: committed rows only. */
  committed: EventLogReader;
}

const at = new Date("2026-10-22T00:00:00.000Z");

async function appendPing(uow: UnitOfWork, note: string): Promise<number> {
  return uow.run((tx) =>
    tx.events.append({ type: "test.ping", conversationId: null, payload: { note }, createdAt: at }),
  );
}

/**
 * architecture.md §2 (unit of work) and the §11 cases that M0's tables allow. The races fire
 * from one process; an adapter that serialises in process (SQLite) passes them without lock
 * contention, so they do not prove cross-process behaviour (README.md, "Limits").
 */
export const unitOfWorkContract = defineContract<UnitOfWorkSubject>("unit of work", {
  "commit writes the change and its event together": async ({ uow, committed }) => {
    const seq = await uow.run(async (tx) => {
      await tx.settings.put("bot_turn_limit", 5);
      return tx.events.append({
        type: "test.ping",
        conversationId: null,
        payload: { note: "with change" },
        createdAt: at,
      });
    });
    expect(await uow.run((tx) => tx.settings.get("bot_turn_limit"))).toBe(5);
    const [event] = await committed.listAfter({ afterSeq: seq - 1, limit: 10 });
    expect(event).toMatchObject({ seq, type: "test.ping", payload: { note: "with change" } });
    expect(event?.createdAt.toISOString()).toBe(at.toISOString());
  },

  "a rolled-back transaction leaves no event and no change": async ({ uow, committed }) => {
    const before = await committed.bounds();
    await expect(
      uow.run(async (tx) => {
        await tx.settings.put("bot_chat_enabled", true);
        await tx.events.append({
          type: "test.ping",
          conversationId: null,
          payload: { note: "rolled back" },
          createdAt: at,
        });
        throw new Error("business rule failed");
      }),
    ).rejects.toThrow("business rule failed");
    expect(await committed.bounds()).toEqual(before);
    expect(await uow.run((tx) => tx.settings.get("bot_chat_enabled"))).toBeUndefined();
  },

  "events are invisible outside the transaction until it commits": async ({ uow, committed }) => {
    const before = await committed.bounds();
    const seen = await uow.run(async (tx) => {
      await tx.events.append({
        type: "test.ping",
        conversationId: null,
        payload: { note: "pending" },
        createdAt: at,
      });
      return committed.bounds();
    });
    expect(seen).toEqual(before);
    expect((await committed.bounds()).maxSeq).toBeGreaterThan(before.maxSeq ?? 0);
  },

  "two transactions racing a compare-and-set on one row: exactly one wins": async ({
    uow,
    committed,
  }) => {
    await uow.run((tx) => tx.settings.put("race", "v0"));
    const before = (await committed.bounds()).maxSeq ?? 0;
    // Every contender read "v0" earlier (two tabs, two workers) and writes only if it is still
    // "v0"; the loser learns from the result, not from a read-then-check (architecture.md §11).
    const contenders = Array.from({ length: 10 }, (_, i) => `v${i + 1}`);
    const results = await Promise.all(
      contenders.map((next) =>
        uow.run(async (tx) => {
          const won = await tx.settings.compareAndSet({ key: "race", expected: "v0", next });
          if (won) {
            await tx.events.append({
              type: "test.ping",
              conversationId: null,
              payload: { note: next },
              createdAt: at,
            });
          }
          return won;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = contenders[results.indexOf(true)];
    expect(await uow.run((tx) => tx.settings.get("race"))).toBe(winner);
    const events = await committed.listAfter({ afterSeq: before, limit: 100 });
    expect(events.map((event) => event.payload)).toEqual([{ note: winner }]);
  },

  "seq is strictly increasing under parallel appends": async ({ uow, committed }) => {
    const seqs = await Promise.all(Array.from({ length: 50 }, (_, i) => appendPing(uow, `n${i}`)));
    expect(new Set(seqs).size).toBe(50);
    const sorted = [...seqs].sort((a, b) => a - b);
    const stored = await committed.listAfter({ afterSeq: (sorted[0] ?? 1) - 1, limit: 100 });
    const storedSeqs = stored.map((event) => event.seq);
    expect(storedSeqs).toEqual(sorted);
    for (let i = 1; i < storedSeqs.length; i += 1) {
      expect(storedSeqs[i]).toBeGreaterThan(storedSeqs[i - 1] ?? Infinity);
    }
  },

  "units of work do not nest": async ({ uow }) => {
    await expect(uow.run(() => uow.run(async () => 1))).rejects.toThrow("do not nest");
  },

  "a failed transaction does not block the next one": async ({ uow, committed }) => {
    await expect(
      uow.run(async () => {
        throw new Error("first fails");
      }),
    ).rejects.toThrow("first fails");
    const seq = await appendPing(uow, "after failure");
    expect((await committed.bounds()).maxSeq).toBe(seq);
  },
});
