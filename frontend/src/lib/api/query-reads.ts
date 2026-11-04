import {
  CancelledError,
  type InvalidateQueryFilters,
  type QueryClient,
} from "@tanstack/react-query";

// A read or a refresh that waits for a list, while live events start newer loads of that list.
// TanStack Query (5.105, query.ts): a load that a newer load cuts short gives its promise to the
// newer load, once. If that load is cut too, the waiting `query()` fails with a `CancelledError`,
// and the waiting `invalidateQueries()` ends with the old list still in place. Neither says what
// the server has. Use these two when the code goes on to act on the answer
// (frontend-conventions.md §5). A refresh before a page opens stays plain: a page that looks for
// its item shows its skeleton while the list loads, and it must open even if live events keep the
// list loading.

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
// counts as ended (DQ-019 in docs/delivery-quality.md).
export async function refreshQueries(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
): Promise<void> {
  await queryClient.invalidateQueries(filters);
  await loadsEnded(queryClient, filters);
}
