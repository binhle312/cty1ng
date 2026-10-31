import type { Logger } from "../adapters/log/pino-logger.ts";
import { OWNER_ID } from "../core/owner.ts";
import type { SkillsService } from "../core/skills/skills.service.ts";

// The timed jobs (architecture.md §6.1). M1 has one: the Trash purge, at start and then every
// PURGE_INTERVAL_HOURS. A failed run is logged; the next run tries again. Returns a stop function.
export function startTimedJobs(deps: {
  skills: Pick<SkillsService, "purgeDue">;
  log: Logger;
  purgeIntervalHours: number;
}): () => void {
  const purge = async (): Promise<void> => {
    try {
      const purged = await deps.skills.purgeDue(OWNER_ID);
      if (purged > 0) deps.log.info({ purged }, "trash purge");
    } catch (error) {
      deps.log.error({ err: error }, "trash purge failed");
    }
  };
  void purge();
  const timer = setInterval(() => void purge(), deps.purgeIntervalHours * 3_600_000);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
