import { createRoute } from "@tanstack/react-router";
import { PageSkeleton } from "../features/placeholder/page-skeleton.tsx";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/skills` and `/skills/{slug}`. The skill editor is heavy, so its page is a lazy route
// (frontend-conventions.md §4): skill.lazy.tsx.
export const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: () => <PlaceholderPage title="Skills" line={emptyIn("M1")} />,
});

export const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/$slug",
  pendingComponent: PageSkeleton,
}).lazy(() => import("./skill.lazy.tsx").then((module) => module.Route));
