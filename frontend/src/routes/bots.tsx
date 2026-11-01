import { createRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BotsPage } from "../features/bots/bots-page.tsx";
import { PageSkeleton } from "../features/placeholder/page-skeleton.tsx";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/bots`, `/bots/new` and `/bots/{slug}` (bot-page.md §1, create-bot-page.md §7). The pages
// belong to the whole app, so bar 2 is hidden. `new` is a page, so it is a reserved bot slug. The
// Create page is heavy (the crop and colour cards), so it is a lazy route: bots.lazy.tsx.
export const botsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots",
  staticData: { hidesBarTwo: true },
  component: BotsPage,
});

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

// `?tab=profile` … (bot-page.md §1): a reload keeps the tab. The bot page comes in M2c; Create
// already opens it on Profile.
const BotSearch = z.object({
  tab: z.enum(["profile", "skills", "model", "activity", "usage"]).optional().catch(undefined),
});

export const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bots/$slug",
  staticData: { hidesBarTwo: true },
  validateSearch: BotSearch,
  component: () => <PlaceholderPage title="Bot" line={emptyIn("M2c")} />,
});
