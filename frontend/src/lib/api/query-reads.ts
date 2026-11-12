import {
  CancelledError,
  type InvalidateQueryFilters,
  type QueryClient,
} from "@tanstack/react-query";

// A read or a refresh that waits for a list, while live events start newer loads of that list.
// TanStack Query (5.105.3 and later, query.ts): a load that a newer load cuts short gives its
// promise to the newer load, at each cut. So a waiting `query()` and a waiting
// `invalidateQueries()` follow the newer loads, and end with the newest list. Two cuts do not
// hand over, and these two helpers are for them:
// - `cancelQueries()` gives the old list back to the code that waits. If a new load starts after
//   it, a waiting `invalidateQueries()` has ended before the new list (`refreshQueries`).
// - A query that leaves the cache during a read fails the waiting `query()` with a
//   `CancelledError` (`readNewest`).
// Use the helpers when the code goes on to act on the answer (frontend-conventions.md §5). A
// Create that moves to its new page waits with a plain `invalidateQueries()`: the page finds its
// item in the list, so Create moves after the newest list came (owner, 2026-11-12).

// The answer of the newest load: a cut read reads again, and joins the load on its way. A load
// that fails still fails. A read cut by a `CancelledError` reads again until the cuts stop. One case
// has no error, so it gets the old list: this read started the load, and the last observer of the
// query left while the load was on its way (query.ts, "revert"; DQ-018 in docs/delivery-quality.md).
export async function readNewest<T>(read: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof CancelledError)) throw error;
    }
  }
}

function loadsEnded(queryClient: QueryClient, filters: InvalidateQueryFilters): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (queryClient.isFetching(filters) > 0) return;
      stop();
      resolve();
    };
    const stop = queryClient.getQueryCache().subscribe(check);
    check();
  });
}

// Marks the queries stale, and ends when no load of them is on its way. A failed load ends it too:
// the list stays as it was, and the caller goes on as after any failed refresh. A load that paused
// counts as ended (DQ-019 in docs/delivery-quality.md). The second step also waits for a read of
// a list that is turned off, until that read ends or `readAll` cuts it; no new list comes then.
export async function refreshQueries(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
): Promise<void> {
  await queryClient.invalidateQueries(filters);
  await loadsEnded(queryClient, filters);
}
