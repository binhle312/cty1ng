import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { TooltipProvider } from "../src/components/ui/tooltip.tsx";
import { routeTree } from "../src/routes/route-tree.ts";

// The real app (routes, shell, providers) on an in-memory address, for component tests
// (frontend-conventions.md §1, "Real tests": mock only the network and the clock).
export async function renderApp(path = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await act(() => router.load());
  return { ...view, router };
}
