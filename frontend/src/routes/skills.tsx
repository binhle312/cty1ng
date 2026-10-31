import { createRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageSkeleton } from "../features/placeholder/page-skeleton.tsx";
import { rootRoute } from "./root.tsx";

// The Skills page (skills-page.md §1): `/skills`, `/skills/new`, `/skills/import` and
// `/skills/{slug}`. The page belongs to the whole app, so bar 2 is hidden. The skill editor is
// heavy, so every part of the page is in one lazy chunk (frontend-conventions.md §4):
// skills.lazy.tsx. `new` and `import` are reserved slugs, so they never name a skill.
export const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills",
  staticData: { hidesBarTwo: true },
  pendingComponent: PageSkeleton,
}).lazy(() => import("./skills.lazy.tsx").then((module) => module.LayoutRoute));

export const skillsIndexRoute = createRoute({
  getParentRoute: () => skillsRoute,
  path: "/",
}).lazy(() => import("./skills.lazy.tsx").then((module) => module.IndexRoute));

// URL search params are `unknown` until a schema parses them (frontend-conventions.md §1); a
// bad value falls back instead of failing the page.
const NewSkillSearch = z.object({ from: z.string().optional().catch(undefined) });

export const newSkillRoute = createRoute({
  getParentRoute: () => skillsRoute,
  path: "/new",
  validateSearch: NewSkillSearch,
}).lazy(() => import("./skills.lazy.tsx").then((module) => module.NewRoute));

export const importSkillsRoute = createRoute({
  getParentRoute: () => skillsRoute,
  path: "/import",
}).lazy(() => import("./skills.lazy.tsx").then((module) => module.ImportRoute));

// `?tab=bots`, `?tab=history&from=3&to=5` (skills-page.md §1): a reload keeps the tab and the
// compared versions.
const Version = z.coerce.number().int().positive().optional().catch(undefined);
const SkillSearch = z.object({
  tab: z.enum(["skill", "bots", "history"]).optional().catch(undefined),
  from: Version,
  to: Version,
});
export type SkillSearch = z.infer<typeof SkillSearch>;
export type SkillTab = NonNullable<SkillSearch["tab"]>;

export const skillRoute = createRoute({
  getParentRoute: () => skillsRoute,
  path: "/$slug",
  validateSearch: SkillSearch,
}).lazy(() => import("./skills.lazy.tsx").then((module) => module.SkillRoute));
