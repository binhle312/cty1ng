import type { QueryClient } from "@tanstack/react-query";

// Reads all data again, with reads that start now (realtime-events.md §3). The stream brings no
// event from before a `reset` or from before the `ready` of a new stream, so an answer from
// before that point can miss a change for good.
//
// `invalidateQueries()` alone is not enough. TanStack Query cuts a read that is on its way only
// when the query already has data; it reuses a first read that is on its way, and that read
// started before this call (`fetch` in query.js). So the first reads are cut here, in the way
// the library cuts the others: silent, so the code that waits gets the answer of the new read.
// Only active queries: `invalidateQueries()` starts a new read for those only.
export function readAll(queryClient: QueryClient): void {
  void queryClient.cancelQueries(
    {
      type: "active",
      fetchStatus: "fetching",
      predicate: (query) => query.state.data === undefined,
    },
    { silent: true, revert: false },
  );
  void queryClient.invalidateQueries();
}
