import {
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  Settings,
  type SettingsPatch,
} from "@cty1ng/shared/settings";
import type { AppendEvent } from "../events/append-event.ts";
import type { Readers, SettingsReader, UnitOfWork } from "../ports/repositories.ts";

// The settings built so far (api.md §7, domain-model.md §10). A key with no row, or with a stored
// value that no longer fits its range, reads as its default.
export async function readSettings(reader: SettingsReader): Promise<Settings> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const parsed = SETTING_SCHEMAS[key].safeParse(await reader.get(key));
      return [key, parsed.success ? parsed.data : SETTING_DEFAULTS[key]] as const;
    }),
  );
  return Settings.parse(Object.fromEntries(entries));
}

export function createSettingsService(deps: {
  uow: UnitOfWork;
  readers: Readers;
  appendEvent: AppendEvent;
}) {
  return {
    get: () => readSettings(deps.readers.settings),

    // The route has checked each key against its range (`SettingsPatch`). One event per saved
    // PATCH, none for an empty one.
    update: (patch: SettingsPatch): Promise<Settings> =>
      deps.uow.run(async (tx) => {
        const keys = SETTING_KEYS.filter((key) => patch[key] !== undefined);
        for (const key of keys) await tx.settings.set(key, patch[key]);
        const settings = await readSettings(tx.settings);
        if (keys.length > 0) {
          await deps.appendEvent(tx, {
            event: { type: "settings.updated", data: { settings } },
            conversationId: null,
          });
        }
        return settings;
      }),
  };
}
