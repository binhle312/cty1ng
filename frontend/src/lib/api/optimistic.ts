import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";

// A change the page shows before its request answers (pin.md §2: pin, unpin and reorder save at
// once; the sort of the others; bot-page.md §7: Remove). A server load of the same query that
// lands first, such as the refresh after another request, an event or focus, would show the old
// data again while the request is still on its way. So the change is put again over each server
// load until its request answers (lesson `check-every-order-before-the-push.md`).
//
// The caller ends the change at the answer, before the refresh after it: the server has the
// change then (or refused it), so that refresh shows the truth, also a newer change from another
// place. A refused change also takes itself back at once (`undo`), because that refresh can fail
// too, and a failed refresh keeps the last data.
//
// A change holds the whole value the owner wants now, made from the page with the older changes
// in it, so only the newest change of a kind shows over a load. The older ones still wait: each
// change's undo goes back only to the value of the change before it. So when the newest one is
// refused, the page goes back to the one before it, which shows over loads again while it waits.
// When an older one is refused, the next newer one takes its undo, so the undo always goes back
// to a value the server has. A saved change ends the older ones too: the server has a newer
// value, so an older request that answers last never puts its value back.

interface Held {
  kind: string;
  // The query the change writes, and the queries whose server loads put it again.
  target: string;
  after: ReadonlySet<string>;
  apply: () => void;
  // Takes the change back; a newer change takes it over when this one is refused first.
  undo: () => void;
}

// The changes held by each query client, oldest first, for as long as the client lives.
const held = new WeakMap<QueryClient, { changes: Held[] }>();

const sameKind = (a: Held, b: Held) => a.kind === b.kind && a.target === b.target;

// The newest change of each kind: the one that shows.
function newest(changes: readonly Held[]): Held[] {
  return changes.filter(
    (change, i) => !changes.slice(i + 1).some((other) => sameKind(other, change)),
  );
}

function changesOf(queryClient: QueryClient): { changes: Held[] } {
  const known = held.get(queryClient);
  if (known !== undefined) return known;
  const store: { changes: Held[] } = { changes: [] };
  queryClient.getQueryCache().subscribe((event) => {
    // A write from a change itself is `manual` and does not start another round.
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (event.action.manual === true) return;
    // The changes of the loaded query go back first, so a change that only reads it (the pinned
    // order reads the sort) reads the value on its way, not the one the load brought.
    const loaded = event.query.queryHash;
    const shown = newest(store.changes);
    for (const change of shown) if (change.target === loaded) change.apply();
    for (const change of shown) {
      if (change.target !== loaded && change.after.has(loaded)) change.apply();
    }
  });
  held.set(queryClient, store);
  return store;
}

// What the caller does with a change at its answer.
export interface HeldChange {
  // The server took it: stop putting it again, and end the older changes of the same kind.
  answered: () => void;
  // The server refused it: stop, and go back to the value before it, unless a newer change of
  // the same kind still waits (that one then goes back past this one).
  refused: () => void;
}

// Shows `change` on the query's data now and over every server load of it until its answer, or
// while a newer change of the same `kind` on the same query waits. `undo` takes it back from
// the data the page shows. `alsoAfter` names other queries the change reads (the pinned order
// reads the sort shown): a server load of one of them puts the change again too.
export function showUntilAnswered<T>({
  queryClient,
  queryKey,
  kind,
  change,
  undo,
  alsoAfter = [],
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  kind: string;
  change: (data: T) => T;
  undo: (data: T) => T;
  alsoAfter?: readonly QueryKey[];
}): HeldChange {
  const target = hashKey(queryKey);
  const write = (to: (data: T) => T) => () => {
    queryClient.setQueryData<T>(queryKey, (old) => (old === undefined ? old : to(old)));
  };
  const mine: Held = {
    kind,
    target,
    after: new Set([target, ...alsoAfter.map((key) => hashKey(key))]),
    apply: write(change),
    undo: write(undo),
  };
  mine.apply();
  const store = changesOf(queryClient);
  store.changes = [...store.changes, mine];
  // The changes of this kind, oldest first, and where this one is among them.
  const chain = () => {
    const changes = store.changes.filter((other) => sameKind(other, mine));
    return { changes, at: changes.indexOf(mine) };
  };
  return {
    answered: () => {
      const { changes, at } = chain();
      if (at === -1) return;
      const ended = new Set(changes.slice(0, at + 1));
      store.changes = store.changes.filter((other) => !ended.has(other));
    },
    refused: () => {
      const { changes, at } = chain();
      if (at === -1) return;
      store.changes = store.changes.filter((other) => other !== mine);
      const next = changes[at + 1];
      if (next === undefined) mine.undo();
      else next.undo = mine.undo;
    },
  };
}
