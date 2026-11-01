import { createRoute, z } from "@hono/zod-openapi";
import { CatalogModel, CatalogTool } from "@cty1ng/shared/catalog";
import type { Catalog } from "../../../core/catalog/catalog.rules.ts";
import { createRouter } from "../router.ts";

// GET /models and GET /tools (api.md §3): the catalog as loaded at start. Never key values,
// only the name of the variable that holds one.

const NoQuery = z.object({}).strict();

const listModels = createRoute({
  method: "get",
  path: "/models",
  operationId: "listModels",
  request: { query: NoQuery },
  responses: {
    200: {
      description: "Every catalog model in catalog order, with `available`",
      content: { "application/json": { schema: z.array(CatalogModel) } },
    },
  },
});

const listTools = createRoute({
  method: "get",
  path: "/tools",
  operationId: "listTools",
  request: { query: NoQuery },
  responses: {
    200: {
      description: "The tool catalog (domain-model.md §4.1)",
      content: { "application/json": { schema: z.array(CatalogTool) } },
    },
  },
});

export function catalogRoutes(catalog: Catalog) {
  return createRouter()
    .openapi(listModels, (c) => c.json([...catalog.models], 200))
    .openapi(listTools, (c) => c.json([...catalog.tools], 200));
}
