import { createRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/`: Home. From M3 it opens the last conversation or the Get started checklist (UI-1.7, UI-1.10).
export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <PlaceholderPage title="Home" line="No conversations yet. They come in slice M3." />
  ),
});
