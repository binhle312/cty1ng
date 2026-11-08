import { type DefaultOptions, QueryClient } from "@tanstack/react-query";

// The one query client of the app, also for the tests that render it (`test/render-app.tsx`).
// Reads and saves run when the browser says that it is offline (DQ-088): the app runs on
// 127.0.0.1, so the backend still answers. TanStack Query's default pauses them until the
// browser is online again, and a page then stays loading.
export function createQueryClient(queries: DefaultOptions["queries"] = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // "always" turns the refetch on reconnect off unless it is set, so set it: nothing changes
      // while the browser is online.
      queries: { networkMode: "always", refetchOnReconnect: true, ...queries },
      mutations: { networkMode: "always" },
    },
  });
}
