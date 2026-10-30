import { createRoute } from "@tanstack/react-router";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/settings` (settings-page.md). The gear in the user panel stays lit here.
export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => <PlaceholderPage title="Settings" line={emptyIn("M5")} />,
});
