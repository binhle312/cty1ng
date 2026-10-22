import type { ModelCatalogEntry } from "../ports/model";
import type { DatabaseProbe } from "../ports/repositories";

export interface Health {
  db: "ok" | "error";
  /** `not_started` until the worker exists (M3, api.md §7). */
  worker: "ok" | "not_started";
  catalog: { models: number; available: number };
}

export function createHealthService(deps: {
  db: DatabaseProbe;
  catalog: readonly ModelCatalogEntry[];
}) {
  return {
    async check(): Promise<Health> {
      let db: Health["db"] = "ok";
      try {
        await deps.db.ping();
      } catch {
        db = "error";
      }
      return {
        db,
        worker: "not_started",
        catalog: {
          models: deps.catalog.length,
          available: deps.catalog.filter((entry) => entry.available).length,
        },
      };
    },
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
