import { createLazyRoute } from "@tanstack/react-router";
import { BotsPage } from "../features/bots/bots-page.tsx";
import { CreateBotPage } from "../features/bots/create-bot-page.tsx";

// The Bots page and the Create bot page, in their own chunk (bots.tsx).
export const BotsRoute = createLazyRoute("/bots")({ component: BotsPage });
export const CreateRoute = createLazyRoute("/bots/new")({ component: CreateBotPage });
