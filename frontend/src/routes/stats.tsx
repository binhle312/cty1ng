import { createRoute } from "@tanstack/react-router";
import { PageSkeleton } from "../features/placeholder/page-skeleton.tsx";
import { rootRoute } from "./root.tsx";

// `/stats`. Statistics carries the chart library from M7, so it is a lazy route
// (frontend-conventions.md §4): stats.lazy.tsx.
export const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  pendingComponent: PageSkeleton,
}).lazy(() => import("./stats.lazy.tsx").then((module) => module.Route));
