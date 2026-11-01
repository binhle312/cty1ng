import type { Catalog } from "../catalog/catalog.rules.ts";
import type { Readers } from "../ports/repositories.ts";

// GET /api/health (api.md §7, architecture.md §9). `worker` is `not_started` until the worker
// exists (M3); that is normal, not a failure.
export interface Health {
  db: "ok" | "error";
  worker: "ok" | "not_started" | "error";
  catalog: { models: number; available: number };
}

export function createHealthService(deps: { readers: Readers; catalog: Catalog }) {
  return async (): Promise<Health> => ({
    db: (await deps.readers.ping()) ? "ok" : "error",
    worker: "not_started",
    catalog: {
      models: deps.catalog.models.length,
      available: deps.catalog.models.filter((model) => model.available).length,
    },
  });
}
