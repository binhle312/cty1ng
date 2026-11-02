import type { Effort, UnavailableReason } from "@cty1ng/shared/catalog";
import { formatTime } from "../../lib/time-format.ts";
import type { BotRow } from "./bot-queries.ts";

// The words a bot shows in lists, cards and the header (bots-page.md §2, §4; bot-status.md;
// app-shell.md UI-2.3).

// The Effort menu labels (M2 plan, decision 4).
export const EFFORT_LABELS: Record<Effort, string> = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

export function cannotRunText(reason: UnavailableReason): string {
  switch (reason) {
    case "no_api_key":
      return "Cannot run: no API key";
    case "model_removed":
      return "Cannot run: model removed";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

// The header tooltip reason (UI-2.3).
export function unavailableText(reason: UnavailableReason): string {
  switch (reason) {
    case "no_api_key":
      return "API key not set";
    case "model_removed":
      return "Model removed from catalog";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export type HealthLine = { level: "danger" | "attention"; text: string };

// The one health line, the first that applies (bots-page.md §4). M2 has no runs, so the server
// never sends the run lines yet; M3 adds their counts to the API ("{n} of the last {m} runs
// failed") and their full words here.
export function healthLine(health: BotRow["health"]): HealthLine | null {
  if (health === null) return null;
  if (health.level === "cannot_run") {
    return { level: "danger", text: cannotRunText(health.reason) };
  }
  const reason = health.reason;
  switch (reason) {
    case "deprecated_skill":
      return { level: "attention", text: "Uses a deprecated skill" };
    case "failed_runs":
      return { level: "attention", text: "Recent runs failed" };
    case "limit_stops":
      return { level: "attention", text: "Runs stopped at the request limit this week" };
    case "history_cut":
      return { level: "attention", text: "Last run cut history to fit the context" };
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

// The status line (bot-status.md §2). M2 has no runs: always Idle.
export function statusText(bot: Pick<BotRow, "last_activity_at">, now: Date): string {
  return bot.last_activity_at === null
    ? "Idle · no activity yet"
    : `Idle · last active ${formatTime(bot.last_activity_at, now)}`;
}

// "Claude Sonnet 5.5 · High": the model and the effort of a bot (bots-page.md §2). A model
// that left the catalog has no label, so its id shows instead.
export function modelLine(bot: Pick<BotRow, "model_label" | "model_id" | "effort">): string {
  const model = bot.model_label ?? bot.model_id;
  return bot.effort === null ? model : `${model} · ${EFFORT_LABELS[bot.effort]}`;
}

function plural(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

export function countText(n: number, noun: "skill" | "project" | "conversation"): string {
  return plural(n, noun, `${noun}s`);
}

// The search of the Bots page (bots-page.md §7): name, slug, description and model label.
export function matchesSearch(bot: BotRow, text: string): boolean {
  const needle = text.trim().toLocaleLowerCase();
  if (needle === "") return true;
  return [bot.name, bot.slug, bot.description, bot.model_label ?? bot.model_id].some((field) =>
    field.toLocaleLowerCase().includes(needle),
  );
}
