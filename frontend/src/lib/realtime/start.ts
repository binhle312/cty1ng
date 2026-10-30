import type { QueryClient } from "@tanstack/react-query";
import { createEventReducer } from "./reducer.ts";
import { connectSse } from "./sse.ts";
import type { Connect } from "./transport.ts";

// Opens the app's one stream at start and feeds the reducer. Returns a function that closes it.
export function startRealtime(queryClient: QueryClient, connect: Connect = connectSse) {
  const reducer = createEventReducer(queryClient);
  return connect({
    afterSeq: null,
    onEvent: (event) => {
      reducer.apply(event);
    },
    onStatus: () => {
      // Live indicators never outlive the stream (realtime-events.md §3). M0 has none; M3
      // clears its "typing" and "working" states here when the status is not "open".
    },
  });
}
