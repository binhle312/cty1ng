import { createRootRoute, Outlet } from "@tanstack/react-router";
import { NotFoundPage } from "../features/placeholder/not-found-page.tsx";
import { AppShell } from "../features/shell/app-shell.tsx";

// Every page renders inside the shell.
export const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFoundPage,
});
