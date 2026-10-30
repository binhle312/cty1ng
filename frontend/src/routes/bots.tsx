import { createRoute } from "@tanstack/react-router";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/bots`, `/bots/new` and `/bots/{slug}` (bot-page.md). `new` is a page, so M2 reserves it as
// a bot slug.
export const botsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots",
  component: () => <PlaceholderPage title="Bots" line={emptyIn("M2")} />,
});

export const createBotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots/new",
  component: () => <PlaceholderPage title="Create bot" line={emptyIn("M2")} />,
});

export const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots/$slug",
  component: () => <PlaceholderPage title="Bot" line={emptyIn("M2")} />,
});
