import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";

// A change the page shows before its request answers (pin.md §2: pin, unpin and reorder save at
// once; the sort of the others; bot-page.md §7: Remove). A server load of the same query that
// lands first, such as the refresh after another request, an event or focus, would show the old
// data again while the request is still on its way. So the change is put again over each server
// load until its request answers (lesson `check-every-order-before-the-push.md`).
//
// The caller ends the change at the answer, before the refresh after it: the server has the
// change then (or refused it), so that refresh shows the truth, also a newer change from another
// place. A change holds the whole value the owner wants now, made from the page with the older
// changes in it, so a newer change of the same kind replaces the older ones: an older request
// that answers last never puts its value back.

interface Held {
  kind: string;
  // The query the change writes, and the queries whose server loads put it again.
  target: string;
  after: ReadonlySet<string>;
  apply: () => void;
}

// The changes held by each query client, oldest first, for as long as the client lives.
const held = new WeakMap<QueryClient, { changes: Held[] }>();

function changesOf(queryClient: QueryClient): { changes: Held[] } {
  const known = held.get(queryClient);
  if (known !== undefined) return known;
  const store: { changes: Held[] } = { changes: [] };
  queryClient.getQueryCache().subscribe((event) => {
    // A write from a change itself is `manual` and does not start another round.
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (event.action.manual === true) return;
    for (const change of store.changes) {
      if (change.after.has(event.query.queryHash)) change.apply();
    }
  });
  held.set(queryClient, store);
  return store;
}

// Shows `change` on the query's data now and over every server load of it until the returned
// function is called, or until a newer change of the same `kind` on the same query starts.
// `alsoAfter` names other queries the change reads (the pinned order reads the sort shown): a
// server load of one of them puts the change again too.
export function showUntilAnswered<T>({
  queryClient,
  queryKey,
  kind,
  change,
  alsoAfter = [],
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  kind: string;
  change: (data: T) => T;
  alsoAfter?: readonly QueryKey[];
}): () => void {
  const target = hashKey(queryKey);
  const mine: Held = {
    kind,
    target,
    after: new Set([target, ...alsoAfter.map((key) => hashKey(key))]),
    apply: () => {
      queryClient.setQueryData<T>(queryKey, (old) => (old === undefined ? old : change(old)));
    },
  };
  mine.apply();
  const store = changesOf(queryClient);
  store.changes = [
    ...store.changes.filter((other) => other.kind !== kind || other.target !== target),
    mine,
  ];
  return () => {
    store.changes = store.changes.filter((other) => other !== mine);
  };
}
