import { createRoute, z } from "@hono/zod-openapi";
import {
  Bot,
  BotDetail,
  CloneTemplate,
  CreateBotBody,
  PatchBotBody,
  PinnedOrderBody,
  SetPinBody,
} from "@cty1ng/shared/bots";
import { BotId, SkillId } from "@cty1ng/shared/ids";
import type { BotsService } from "../../../core/bots/bots.service.ts";
import { OWNER_ID } from "../../../core/owner.ts";
import { createRouter } from "../router.ts";

// Bots (api.md §4). Every operation id has "Bot" in it: the frontend's event reducer finds the
// cached bot queries by it. Phase 1 has one owner, so the actor is always OWNER_ID.

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const IdParam = z.object({ id: BotId });
const PinParam = z.object({ id: BotId, skill_id: SkillId });
// A route that takes no query string still refuses one (security.md §2.9).
const NoQuery = z.object({}).strict();
// The page makes one key per create attempt and keeps it for its retries (bots.md UI-5.6).
const IdempotencyHeader = z.object({ "idempotency-key": z.uuid() });

const routes = {
  listBots: createRoute({
    method: "get",
    path: "/bots",
    operationId: "listBots",
    request: { query: NoQuery },
    responses: { 200: json(z.array(Bot), "The bots not in Trash, in header order") },
  }),
  // Registered before `/bots/{id}`, so "pins" is never read as an id.
  setPinnedBots: createRoute({
    method: "put",
    path: "/bots/pins",
    operationId: "setPinnedBots",
    request: { query: NoQuery, body: jsonBody(PinnedOrderBody) },
    responses: {
      200: json(z.object({ pinned_bot_ids: z.array(BotId) }).strict(), "The pinned list"),
    },
  }),
  createBot: createRoute({
    method: "post",
    path: "/bots",
    operationId: "createBot",
    request: { query: NoQuery, headers: IdempotencyHeader, body: jsonBody(CreateBotBody) },
    responses: {
      200: json(Bot, "A repeat of a create that committed: the first bot"),
      201: json(Bot, "The new bot"),
    },
  }),
  getBot: createRoute({
    method: "get",
    path: "/bots/{id}",
    operationId: "getBot",
    request: { params: IdParam, query: NoQuery },
    responses: { 200: json(BotDetail, "The bot and the conversations it is in") },
  }),
  updateBot: createRoute({
    method: "patch",
    path: "/bots/{id}",
    operationId: "updateBot",
    request: { params: IdParam, query: NoQuery, body: jsonBody(PatchBotBody) },
    responses: { 200: json(Bot, "The saved bot") },
  }),
  deleteBot: createRoute({
    method: "delete",
    path: "/bots/{id}",
    operationId: "deleteBot",
    request: { params: IdParam, query: NoQuery },
    responses: { 200: json(Bot, "The bot, now in Trash") },
  }),
  getBotCloneTemplate: createRoute({
    method: "get",
    path: "/bots/{id}/clone-template",
    operationId: "getBotCloneTemplate",
    request: { params: IdParam, query: NoQuery },
    responses: { 200: json(CloneTemplate, "A prefilled create body, without a colour") },
  }),
  setBotSkill: createRoute({
    method: "put",
    path: "/bots/{id}/skills/{skill_id}",
    operationId: "setBotSkill",
    request: { params: PinParam, query: NoQuery, body: jsonBody(SetPinBody) },
    responses: { 200: json(Bot, "The bot with the pin") },
  }),
  removeBotSkill: createRoute({
    method: "delete",
    path: "/bots/{id}/skills/{skill_id}",
    operationId: "removeBotSkill",
    request: { params: PinParam, query: NoQuery },
    responses: { 204: { description: "The pin is gone" } },
  }),
};

export function botRoutes(bots: BotsService) {
  return createRouter()
    .openapi(routes.listBots, async (c) => c.json(await bots.list(), 200))
    .openapi(routes.setPinnedBots, async (c) => {
      const body = c.req.valid("json");
      const pinned = await bots.setPinned(body.bot_ids, body.expected_bot_ids);
      return c.json({ pinned_bot_ids: pinned }, 200);
    })
    .openapi(routes.createBot, async (c) => {
      const key = c.req.valid("header")["idempotency-key"];
      const result = await bots.create(c.req.valid("json"), key, OWNER_ID);
      return result.created ? c.json(result.bot, 201) : c.json(result.bot, 200);
    })
    .openapi(routes.getBot, async (c) => c.json(await bots.get(c.req.valid("param").id), 200))
    .openapi(routes.updateBot, async (c) =>
      c.json(await bots.update(c.req.valid("param").id, c.req.valid("json")), 200),
    )
    .openapi(routes.deleteBot, async (c) => c.json(await bots.trash(c.req.valid("param").id), 200))
    .openapi(routes.getBotCloneTemplate, async (c) =>
      c.json(await bots.cloneTemplate(c.req.valid("param").id), 200),
    )
    .openapi(routes.setBotSkill, async (c) => {
      const { id, skill_id } = c.req.valid("param");
      return c.json(await bots.setPin(id, skill_id, c.req.valid("json")), 200);
    })
    .openapi(routes.removeBotSkill, async (c) => {
      const { id, skill_id } = c.req.valid("param");
      await bots.removePin(id, skill_id);
      return c.body(null, 204);
    });
}
