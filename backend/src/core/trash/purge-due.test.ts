import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manualClock, testBackend } from "../../../test/helpers.ts";
import { purgeDue, type PurgeKind } from "./purge-due.ts";

// The purge job's loop (architecture.md §6.1): one item per transaction, and one item that
// fails does not stop the others (P3 item 27).

const LONG_AGO = new Date("2020-01-01T00:00:00.000Z");

let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
const deps = () => ({ uow: backend.uow, readers: backend.readers, clock });
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({}, { clock });
});
afterEach(() => {
  backend.close();
});

// Three due items; the purge of each id in `failing` throws.
function kind(failing: readonly string[]) {
  const purged: string[] = [];
  const error = new Error("disk full");
  const items: PurgeKind<string> = {
    dueIds: () => Promise.resolve(["a", "b", "c"]),
    trashedAt: () => Promise.resolve(LONG_AGO),
    purge: (_tx, id) => {
      if (failing.includes(id)) return Promise.reject(error);
      purged.push(id);
      return Promise.resolve();
    },
  };
  return { items, purged, error };
}

describe("purgeDue", () => {
  it("purges the items after an item that fails", async () => {
    const { items, purged } = kind(["b"]);
    const result = await purgeDue(deps(), items);
    expect(purged).toEqual(["a", "c"]);
    expect(result.purged).toBe(2);
  });

  it("returns each failed item with its id and its error", async () => {
    const { items, error } = kind(["b"]);
    const result = await purgeDue(deps(), items);
    expect(result.failed).toEqual([{ id: "b", error }]);
  });
});
