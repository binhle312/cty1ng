import {
  botFieldProblem,
  botNameKey,
  type BotLimits,
  type BotTextField,
} from "@cty1ng/shared/bots";
import type { CatalogModel, CatalogTool, Effort } from "@cty1ng/shared/catalog";
import { BOT_VALUE_RANGES, HISTORY_STEP_PCT } from "@cty1ng/shared/settings";
import { effectiveToolSettings, offeredTools } from "@cty1ng/shared/tool-settings";
import type { CreateBotData } from "../../lib/api/generated/types.gen.ts";

export type CreateBotBody = CreateBotData["body"];

// The rules of the Create bot page without React (create-bot-page.md, UI-5): the form, the
// problems of each step, the Tools list and the body that Create sends. The limits and defaults
// come from the settings (UI-5.8).

export const STEPS = ["basics", "persona", "skills", "model"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABELS: Record<Step, string> = {
  basics: "Basics",
  persona: "Persona",
  skills: "Skills",
  model: "Model",
};

export interface FormPin {
  skill_id: string;
  // Omitted in the body: the latest version. A Clone sends the copied version.
  skill_version_id: string | null;
  always_load: boolean;
}

export interface CreateForm {
  name: string;
  description: string;
  persona_md: string;
  avatar_style: "flat" | "upload";
  avatar_colour: string;
  // The uploaded image, after the crop card's Use.
  avatar: { id: string; url: string } | null;
  pins: FormPin[];
  // Null until the owner picks one (CL2: a Clone whose model is gone starts empty).
  model_id: string | null;
  effort: Effort | null;
  // The owner's switches by tool id. The list shows the effective values for the chosen model.
  tool_choices: Record<string, boolean>;
  history_share_pct: number;
  request_limit: number;
  max_reply_chars: number;
  cloned_from_bot_id: string | null;
}

export interface FormSettings {
  limits: BotLimits;
  historyMin: number;
  historyMax: number;
  defaultHistory: number;
  defaultRequestLimit: number;
  defaultMaxReplyChars: number;
}

export function emptyForm(colour: string, settings: FormSettings): CreateForm {
  return {
    name: "",
    description: "",
    persona_md: "",
    avatar_style: "flat",
    avatar_colour: colour,
    avatar: null,
    pins: [],
    model_id: null,
    effort: null,
    tool_choices: {},
    history_share_pct: settings.defaultHistory,
    request_limit: settings.defaultRequestLimit,
    max_reply_chars: settings.defaultMaxReplyChars,
    cloned_from_bot_id: null,
  };
}

// "With input" for the leave question (E6): anything the owner typed or picked. The colour the
// page picked and the defaults do not count.
export function hasInput(form: CreateForm, start: CreateForm): boolean {
  return JSON.stringify(form) !== JSON.stringify(start);
}

// --- problems ---------------------------------------------------------------------------

// A problem under a field: the field key and the message. The keys are the API fields, so a
// server error lands in the same place (E3).
export type Problems = Partial<Record<string, string>>;

export const FIELD_STEP: Record<string, Step> = {
  name: "basics",
  description: "basics",
  avatar_style: "basics",
  avatar_colour: "basics",
  avatar_id: "basics",
  persona_md: "persona",
  pins: "skills",
  model_id: "model",
  effort: "model",
  tool_settings: "model",
  history_share_pct: "model",
  request_limit: "model",
  max_reply_chars: "model",
};

// The step of an API field: `pins[2]` is on Skills, `tool_settings.web_fetch` on Model.
export function stepOfField(field: string): Step {
  const head = field.split(/[.[]/)[0] ?? field;
  return FIELD_STEP[head] ?? "basics";
}

export interface FormContext {
  settings: FormSettings;
  models: readonly CatalogModel[];
  // The names of the bots the page has, for the taken-name hint (E1). Trash is not in it.
  botNames: readonly string[];
  // Skill ids that are not in the skill list (in Trash), and the deprecated ones.
  missingSkillIds: ReadonlySet<string>;
}

export function nameTaken(name: string, botNames: readonly string[]): boolean {
  const key = botNameKey(name);
  return key !== "" && botNames.some((other) => botNameKey(other) === key);
}

function textProblem(field: BotTextField, form: CreateForm, ctx: FormContext): string | null {
  return botFieldProblem(field, form[field], ctx.settings.limits);
}

function rangeProblem(value: number, min: number, max: number, step = 1): string | null {
  if (!Number.isInteger(value) || value < min || value > max || value % step !== 0) {
    const steps = step === 1 ? "" : `, in steps of ${String(step)}`;
    return `Use a whole number from ${String(min)} to ${String(max)}${steps}.`;
  }
  return null;
}

// The problems of one step, from the page's own checks. The server checks again on Create.
export function stepProblems(step: Step, form: CreateForm, ctx: FormContext): Problems {
  const out: Problems = {};
  const put = (field: string, problem: string | null) => {
    if (problem !== null) out[field] = problem;
  };
  switch (step) {
    case "basics":
      put("name", textProblem("name", form, ctx));
      if (out.name === undefined && nameTaken(form.name, ctx.botNames)) {
        out.name = `${form.name.trim()} is taken by another bot. Pick another name.`;
      }
      put("description", textProblem("description", form, ctx));
      if (form.avatar_style === "upload" && form.avatar === null) {
        out.avatar_id = "Upload an image, or pick Flat.";
      }
      break;
    case "persona":
      put("persona_md", textProblem("persona_md", form, ctx));
      break;
    case "skills":
      form.pins.forEach((pin, i) => {
        if (ctx.missingSkillIds.has(pin.skill_id)) {
          out[`pins[${String(i)}]`] =
            "This skill is in Trash. Untick it, or restore the skill first.";
        }
      });
      break;
    case "model": {
      const model = ctx.models.find((m) => m.id === form.model_id);
      if (form.model_id === null) out.model_id = "Pick a model.";
      else if (model === undefined) {
        out.model_id = `${form.model_id} is no longer offered. Pick another model.`;
      } else if (!model.available) {
        out.model_id = `API key not set: ${model.api_key_env ?? "its key"}. Set it and restart the app, or pick another model.`;
      } else if (
        model.efforts.length > 0 &&
        (form.effort === null || !model.efforts.includes(form.effort))
      ) {
        out.effort = "Pick an effort.";
      }
      const s = ctx.settings;
      put(
        "history_share_pct",
        rangeProblem(form.history_share_pct, s.historyMin, s.historyMax, HISTORY_STEP_PCT),
      );
      const req = BOT_VALUE_RANGES.request_limit;
      put("request_limit", rangeProblem(form.request_limit, req.min, req.max));
      const reply = BOT_VALUE_RANGES.max_reply_chars;
      put("max_reply_chars", rangeProblem(form.max_reply_chars, reply.min, reply.max));
      break;
    }
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
  return out;
}

export function hasProblems(problems: Problems): boolean {
  return Object.values(problems).some((problem) => problem !== undefined);
}

// --- model and tools ------------------------------------------------------------------

// A model change sets its default effort (UI-5.1). A Clone keeps its effort when the model takes it.
export function withModel(form: CreateForm, model: CatalogModel): CreateForm {
  const effort =
    model.efforts.length === 0
      ? null
      : form.effort !== null && model.efforts.includes(form.effort) && form.model_id === model.id
        ? form.effort
        : (model.default_effort ?? model.efforts[0] ?? null);
  return { ...form, model_id: model.id, effort };
}

// Before a model is picked, the list shows only the internal tools (create-bot-page.md §3).
const NO_MODEL: Pick<CatalogModel, "provider_tools" | "multimodal"> = {
  provider_tools: [],
  multimodal: true,
};

export function effectiveTools(
  form: Pick<CreateForm, "tool_choices">,
  tools: readonly CatalogTool[],
  model: Pick<CatalogModel, "provider_tools" | "multimodal"> | undefined,
): Record<string, boolean> {
  return effectiveToolSettings(form.tool_choices, tools, model ?? NO_MODEL);
}

// The info line after a model change (§3.0): the tools that were on and are now off, because
// the new model does not have them or does not read images.
export function toolsTurnedOff(
  form: Pick<CreateForm, "tool_choices">,
  tools: readonly CatalogTool[],
  before: Pick<CatalogModel, "provider_tools" | "multimodal"> | undefined,
  after: Pick<CatalogModel, "provider_tools" | "multimodal"> | undefined,
): string[] {
  const was = effectiveTools(form, tools, before);
  const now = effectiveTools(form, tools, after);
  return tools.filter((tool) => was[tool.id] === true && now[tool.id] !== true).map((t) => t.label);
}

// One row of the Tools list: a tool, or a job that an internal and a provider tool both do
// (§3.1), shown as one row with Off · Internal · {Provider}.
export type ToolRow =
  | { kind: "single"; tool: CatalogTool }
  | { kind: "pair"; job: string; internal: CatalogTool; provider: CatalogTool };

// Order (§3): internal only, then the pairs, then provider only; inside each group by the date
// the tool joined the catalog, oldest first (the catalog order breaks ties).
export function toolRows(
  tools: readonly CatalogTool[],
  model: Pick<CatalogModel, "provider_tools"> | undefined,
): ToolRow[] {
  const offered = offeredTools(tools, model ?? { provider_tools: [] });
  const byAdded = (a: CatalogTool, b: CatalogTool) =>
    a.added < b.added ? -1 : a.added > b.added ? 1 : 0;
  const internal = offered.filter((t) => t.kind === "internal").sort(byAdded);
  const provider = offered.filter((t) => t.kind === "provider").sort(byAdded);
  const pairs: ToolRow[] = [];
  const paired = new Set<string>();
  for (const tool of internal) {
    const twin = provider.find((p) => p.job === tool.job);
    if (twin === undefined) continue;
    pairs.push({ kind: "pair", job: tool.job, internal: tool, provider: twin });
    paired.add(tool.id).add(twin.id);
  }
  const single = (t: CatalogTool): ToolRow => ({ kind: "single", tool: t });
  return [
    ...internal.filter((t) => !paired.has(t.id)).map(single),
    ...pairs,
    ...provider.filter((t) => !paired.has(t.id)).map(single),
  ];
}

// The switch of a pair row: only one of the two can be on (D55).
export function withPairChoice(
  form: CreateForm,
  row: Extract<ToolRow, { kind: "pair" }>,
  choice: "off" | "internal" | "provider",
): CreateForm {
  return {
    ...form,
    tool_choices: {
      ...form.tool_choices,
      [row.internal.id]: choice === "internal",
      [row.provider.id]: choice === "provider",
    },
  };
}

// --- the body -------------------------------------------------------------------------

// What Create sends (api.md §4). The tool switches are the effective ones for the model.
export function createBody(
  form: CreateForm,
  tools: readonly CatalogTool[],
  models: readonly CatalogModel[],
): CreateBotBody {
  const model = models.find((m) => m.id === form.model_id);
  return {
    name: form.name,
    description: form.description,
    persona_md: form.persona_md,
    avatar_style: form.avatar_style,
    avatar_colour: form.avatar_colour,
    ...(form.avatar_style === "upload" && form.avatar !== null
      ? { avatar_id: form.avatar.id }
      : {}),
    model_id: form.model_id ?? "",
    effort: form.effort,
    history_share_pct: form.history_share_pct,
    request_limit: form.request_limit,
    max_reply_chars: form.max_reply_chars,
    tool_settings: effectiveTools(form, tools, model),
    pins: form.pins.map((pin) => ({
      skill_id: pin.skill_id,
      ...(pin.skill_version_id === null ? {} : { skill_version_id: pin.skill_version_id }),
      always_load: pin.always_load,
    })),
    ...(form.cloned_from_bot_id === null ? {} : { cloned_from_bot_id: form.cloned_from_bot_id }),
  };
}

// The history label (D32): "≈ 400k tokens of 1M. 600k are left for work."
export function historyLabel(pct: number, contextWindow: number | undefined): string | null {
  if (contextWindow === undefined) return null;
  const history = Math.round((contextWindow * pct) / 100);
  return `≈ ${tokens(history)} tokens of ${tokens(contextWindow)}. ${tokens(contextWindow - history)} are left for work.`;
}

function tokens(n: number): string {
  if (n >= 1_000_000) {
    return `${String(Number((n / 1_000_000).toFixed(1)))}M`;
  }
  if (n >= 1_000) return `${String(Math.round(n / 1_000))}k`;
  return String(n);
}
