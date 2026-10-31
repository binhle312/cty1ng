import { createRoute } from "@hono/zod-openapi";
import { Settings, SettingsPatch } from "@cty1ng/shared/settings";
import type { createSettingsService } from "../../../core/settings/settings.service.ts";
import { createRouter } from "../router.ts";

// GET and PATCH /settings (api.md §7) for the keys built so far (shared/src/settings.ts). A value
// out of its range, or an unknown key, is a 422 with the key as `field`. Every operation id has
// "Settings" in it (the frontend's event reducer finds the cached queries by it).

const getRoute = createRoute({
  method: "get",
  path: "/settings",
  operationId: "getSettings",
  responses: {
    200: {
      description: "Every built setting, with its default when it was never saved",
      content: { "application/json": { schema: Settings } },
    },
  },
});

const patchRoute = createRoute({
  method: "patch",
  path: "/settings",
  operationId: "updateSettings",
  request: {
    body: { required: true, content: { "application/json": { schema: SettingsPatch } } },
  },
  responses: {
    200: {
      description: "The saved settings",
      content: { "application/json": { schema: Settings } },
    },
  },
});

export function settingsRoutes(settings: ReturnType<typeof createSettingsService>) {
  return createRouter()
    .openapi(getRoute, async (c) => c.json(await settings.get(), 200))
    .openapi(patchRoute, async (c) => c.json(await settings.update(c.req.valid("json")), 200));
}
