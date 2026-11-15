import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { TooltipProvider } from "../src/components/ui/tooltip.tsx";
import { createQueryClient } from "../src/lib/api/query-client.ts";
import { routeTree } from "../src/routes/route-tree.ts";
import { watchQueryClient } from "./fake-api.ts";

// The real app (routes, shell, providers) on an in-memory address, for component tests
// (frontend-conventions.md §1, "Real tests": mock only the network and the clock).
// `strict` wraps the app in `<StrictMode>`, as `main.tsx` does: in the development build, React
// mounts each page, runs its cleanups and mounts it again.
export async function renderApp(path = "/", { strict = false }: { strict?: boolean } = {}) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  // The app's query client (DQ-088). A failed request fails at once: the error state shows
  // without TanStack Query's retries.
  const queryClient = createQueryClient({ retry: false });
  watchQueryClient(queryClient);
  const app = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
  const view = render(strict ? <StrictMode>{app}</StrictMode> : app);
  await act(() => router.load());
  return { ...view, router, queryClient };
}
