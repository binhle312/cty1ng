import { botRoute, botsRoute, createBotRoute } from "./bots.tsx";
import { conversationRoute } from "./conversation.tsx";
import { homeRoute } from "./home.tsx";
import { rootRoute } from "./root.tsx";
import { settingsRoute } from "./settings.tsx";
import {
  importSkillsRoute,
  newSkillRoute,
  skillRoute,
  skillsIndexRoute,
  skillsRoute,
} from "./skills.tsx";
import { statsRoute } from "./stats.tsx";

// Every page of the app (M0c plan, decision G).
export const routeTree = rootRoute.addChildren([
  homeRoute,
  conversationRoute,
  botsRoute,
  createBotRoute,
  botRoute,
  skillsRoute.addChildren([skillsIndexRoute, newSkillRoute, importSkillsRoute, skillRoute]),
  statsRoute,
  settingsRoute,
]);
