import { botFieldProblem, type BotHealth, type BotTextField } from "@cty1ng/shared/bots";

// The header order is shared with the pages, which order a pin change before the server answers.
export { orderBots, type OrderInput } from "@cty1ng/shared/bots";
import type { CatalogModel, Effort, UnavailableReason } from "@cty1ng/shared/catalog";
import type { ErrorCode } from "@cty1ng/shared/errors";
import { BOT_VALUE_RANGES, HISTORY_STEP_PCT, type Settings } from "@cty1ng/shared/settings";
import { firstSensitive, sensitiveLabel } from "../guard/sensitive-data.rules.ts";

// Pure bot rules (domain-model.md §2, bots.md UI-4.5, UI-4.6): field checks, the effort, the
// Advanced values, the order and the health line. Pure: no database, no clock.

export interface BotProblem {
  code: ErrorCode;
  field: string;
  message: string;
}

// The D39 guard on one text field (security.md §2.13). The name is checked as it is stored.
export function botGuardProblem(field: BotTextField, value: string): BotProblem | null {
  const match = firstSensitive(value);
  if (match === null) return null;
  const where =
    field === "persona_md" ? `Line ${String(match.line)} of the persona` : `The ${field}`;
  return {
    code: "sensitive_data",
    field,
    message: `${where} looks like ${sensitiveLabel(match.kind)}. The app does not save secrets in bots. Remove it.`,
  };
}

// The size and format limits of one text field (domain-model.md §10).
export function botLimitProblem(
  field: BotTextField,
  value: string,
  settings: Settings,
): BotProblem | null {
  const message = botFieldProblem(field, value, {
    nameMax: settings.bot_name_max,
    descriptionMax: settings.bot_description_max,
    personaMax: settings.bot_persona_max,
  });
  return message === null ? null : { code: "validation_error", field, message };
}

// Both checks on one text field, the guard first, as in the create order (M2 plan §4).
export function botTextProblem(
  field: BotTextField,
  value: string,
  settings: Settings,
): BotProblem | null {
  return botGuardProblem(field, value) ?? botLimitProblem(field, value, settings);
}

// The effort of a new bot: the one sent, else the model's default. A model with no efforts takes
// none (D7, decision 4).
export function resolveEffort(
  model: Pick<CatalogModel, "label" | "efforts" | "default_effort">,
  sent: Effort | null | undefined,
): { effort: Effort | null } | BotProblem {
  if (model.efforts.length === 0) {
    if (sent === undefined || sent === null) return { effort: null };
    return {
      code: "effort_not_supported",
      field: "effort",
      message: `${model.label} has no effort setting. Leave Effort empty.`,
    };
  }
  const effort = sent ?? model.default_effort ?? model.efforts[0] ?? null;
  if (effort !== null && model.efforts.includes(effort)) return { effort };
  return {
    code: "effort_not_supported",
    field: "effort",
    message: `${model.label} has no effort ${String(sent)}. Pick one of the list.`,
  };
}

export type AdvancedField = "history_share_pct" | "request_limit" | "max_reply_chars";

// One Advanced value against its range (domain-model.md §10). The history share moves in steps
// of 5 between two settings; the other two have fixed ranges.
export function advancedProblem(
  field: AdvancedField,
  value: number,
  settings: Settings,
): BotProblem | null {
  const range =
    field === "history_share_pct"
      ? { min: settings.bot_history_min_pct, max: settings.bot_history_max_pct }
      : BOT_VALUE_RANGES[field];
  const stepOk = field !== "history_share_pct" || value % HISTORY_STEP_PCT === 0;
  if (Number.isInteger(value) && value >= range.min && value <= range.max && stepOk) return null;
  const step = field === "history_share_pct" ? `, in steps of ${String(HISTORY_STEP_PCT)}` : "";
  return {
    code: "validation_error",
    field,
    message: `Use a whole number from ${String(range.min)} to ${String(range.max)}${step}.`,
  };
}

// The one health line, the first that applies (bots.md UI-4.6). M2 has no runs, so the run
// lines come with M3.
export function botHealth(
  availability: { available: boolean; reason: UnavailableReason | null },
  pins: readonly { deprecated: boolean }[],
): BotHealth | null {
  if (!availability.available && availability.reason !== null) {
    return { level: "cannot_run", reason: availability.reason };
  }
  if (pins.some((pin) => pin.deprecated)) {
    return { level: "needs_attention", reason: "deprecated_skill" };
  }
  return null;
}
