import { createLazyRoute } from "@tanstack/react-router";
import { BotPage } from "../features/bots/bot-page.tsx";
import { BotsPage } from "../features/bots/bots-page.tsx";
import { CreateBotPage } from "../features/bots/create-bot-page.tsx";

// The Bots page, the Create bot page and the bot page, in their own chunk (bots.tsx).
export const BotsRoute = createLazyRoute("/bots")({ component: BotsPage });
export const CreateRoute = createLazyRoute("/bots/new")({ component: CreateBotPage });
export const BotRoute = createLazyRoute("/bots/$slug")({ component: BotPage });
