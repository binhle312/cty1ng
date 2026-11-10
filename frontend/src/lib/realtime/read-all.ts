import type { Query, QueryClient } from "@tanstack/react-query";

const noAnswerYet = (query: Query) => query.state.data === undefined;

// Reads all data again, with reads that start now (realtime-events.md §3). The stream brings no
// event from before a `reset` or from before the `ready` of a new stream, so an answer from
// before that point can miss a change for good.
//
// `invalidateQueries()` alone is not enough. TanStack Query cuts a read that is on its way only
// when the query already has data; it reuses a first read that is on its way, and that read
// started before this call (`fetch` in query.js). So the first reads are cut here.
export function readAll(queryClient: QueryClient): void {
  // A query that a page shows: cut in the way the library cuts the others. Silent, so the code
  // that waits gets the answer of the new read, which `invalidateQueries()` starts below.
  void queryClient.cancelQueries(
    { type: "active", fetchStatus: "fetching", predicate: noAnswerYet },
    { silent: true, revert: false },
  );
  // A query that a page watches but has turned off, such as the query of a closed dialog. No new
  // read starts for it now, so it goes back to "no read", and it reads when it is turned on again.
  // A read with no observer stays: its caller waits for that read.
  void queryClient.cancelQueries(
    {
      type: "inactive",
      fetchStatus: "fetching",
      predicate: (query) => noAnswerYet(query) && query.getObserversCount() > 0,
    },
    { revert: true },
  );
  void queryClient.invalidateQueries();
}
