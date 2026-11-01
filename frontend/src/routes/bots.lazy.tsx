import { createLazyRoute } from "@tanstack/react-router";
import { CreateBotPage } from "../features/bots/create-bot-page.tsx";

// The Create bot page, in its own chunk (bots.tsx).
export const CreateRoute = createLazyRoute("/bots/new")({ component: CreateBotPage });
