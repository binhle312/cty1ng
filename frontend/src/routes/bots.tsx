import { createRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageSkeleton } from "../features/placeholder/page-skeleton.tsx";
import { rootRoute } from "./root.tsx";

// `/bots`, `/bots/new` and `/bots/{slug}` (bot-page.md §1, create-bot-page.md §7). The pages
// belong to the whole app, so bar 2 is hidden. `new` is a page, so it is a reserved bot slug. The
// Bots page, the Create page and the bot page (the crop and colour cards) are lazy routes:
// bots.lazy.tsx.
export const botsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots",
  staticData: { hidesBarTwo: true },
  pendingComponent: PageSkeleton,
}).lazy(() => import("./bots.lazy.tsx").then((module) => module.BotsRoute));

// URL search params are `unknown` until a schema parses them (frontend-conventions.md §1); a
// bad value falls back instead of failing the page.
const CreateBotSearch = z.object({ from: z.string().optional().catch(undefined) });

export const createBotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots/new",
  staticData: { hidesBarTwo: true },
  validateSearch: CreateBotSearch,
  pendingComponent: PageSkeleton,
}).lazy(() => import("./bots.lazy.tsx").then((module) => module.CreateRoute));

// `?tab=profile` … (bot-page.md §1): a reload keeps the tab. Profile has no `tab`.
const BotSearch = z.object({
  tab: z.enum(["profile", "skills", "model", "activity", "usage"]).optional().catch(undefined),
});

export const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots/$slug",
  staticData: { hidesBarTwo: true },
  validateSearch: BotSearch,
  pendingComponent: PageSkeleton,
}).lazy(() => import("./bots.lazy.tsx").then((module) => module.BotRoute));
