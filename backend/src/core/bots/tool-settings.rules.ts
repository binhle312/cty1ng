import type { CatalogModel, CatalogTool } from "@cty1ng/shared/catalog";

// A bot's tool switches (domain-model.md §2 "Tool settings" and "Effective tool settings", §4.1,
// D55). The stored JSON can miss a tool (added to the catalog later) or name one the model lost,
// so every read goes through `effectiveToolSettings`, and every write is checked by
// `toolSettingsProblem` and then stored as its effective result. Pure.

export type ToolSettings = Readonly<Record<string, boolean>>;

// The tools a model offers: every internal tool, and the provider tools it lists.
export function offeredTools(
  tools: readonly CatalogTool[],
  model: Pick<CatalogModel, "provider_tools">,
): CatalogTool[] {
  return tools.filter((tool) => tool.kind === "internal" || model.provider_tools.includes(tool.id));
}

// Steps 1–6 of "Effective tool settings". Returns a value for each offered tool and nothing else.
export function effectiveToolSettings(
  stored: ToolSettings,
  tools: readonly CatalogTool[],
  model: Pick<CatalogModel, "provider_tools" | "multimodal">,
): Record<string, boolean> {
  const offered = offeredTools(tools, model);
  const result: Record<string, boolean> = {};
  const storedOn = new Set<string>();
  for (const tool of offered) {
    // (1) the stored value; (2) else the default: internal on, provider off.
    const value = Object.hasOwn(stored, tool.id)
      ? stored[tool.id] === true
      : tool.kind === "internal";
    if (Object.hasOwn(stored, tool.id) && stored[tool.id] === true) storedOn.add(tool.id);
    // (2a) a gated tool is off, whatever is stored.
    result[tool.id] = tool.switch === "open" && value;
  }
  // (3) the tools the model does not offer are not in `offered`; View images needs a model that
  // reads images.
  if (!model.multimodal && Object.hasOwn(result, "view_images")) result.view_images = false;
  // (4) a tool whose needed tool is off is off.
  applyNeeds(result, offered);
  // (5) one tool per job: a stored choice wins over a default, then catalog order.
  const byJob = new Map<string, CatalogTool[]>();
  for (const tool of offered) {
    if (result[tool.id] !== true) continue;
    byJob.set(tool.job, [...(byJob.get(tool.job) ?? []), tool]);
  }
  for (const onTools of byJob.values()) {
    if (onTools.length < 2) continue;
    const keep = onTools.find((tool) => storedOn.has(tool.id)) ?? onTools[0];
    for (const tool of onTools) if (tool !== keep) result[tool.id] = false;
  }
  // (6) the needs check again, for a tool whose needed tool step 5 turned off.
  applyNeeds(result, offered);
  return result;
}

function applyNeeds(result: Record<string, boolean>, offered: readonly CatalogTool[]): void {
  // Repeat until nothing changes, so a chain of needs settles.
  let changed = true;
  while (changed) {
    changed = false;
    for (const tool of offered) {
      if (result[tool.id] !== true) continue;
      if (tool.needs.some((need) => result[need] !== true)) {
        result[tool.id] = false;
        changed = true;
      }
    }
  }
}

export interface ToolSettingsProblem {
  code: "tool_not_available" | "tool_job_conflict" | "validation_error";
  field: string;
  message: string;
}

// The checks on a POST or PATCH body (domain-model.md §2): a tool turned on that the model does
// not offer, or whose switch is `later` or `locked` → tool_not_available; two tools of one job on
// → tool_job_conflict; a tool on while a tool it needs is off → validation_error. A tool turned
// off that the model does not offer is ignored (the Clone page may still send it).
export function toolSettingsProblem(
  body: ToolSettings,
  base: ToolSettings,
  tools: readonly CatalogTool[],
  model: Pick<CatalogModel, "provider_tools" | "multimodal" | "label">,
): ToolSettingsProblem | null {
  const offered = new Map(offeredTools(tools, model).map((tool) => [tool.id, tool]));
  const turnedOn = Object.keys(body).filter((id) => body[id] === true);
  for (const id of turnedOn) {
    const tool = offered.get(id);
    if (tool === undefined) {
      return {
        code: "tool_not_available",
        field: `tool_settings.${id}`,
        message: `${model.label} has no ${tools.find((t) => t.id === id)?.label ?? id} tool. Turn it off.`,
      };
    }
    if (tool.switch !== "open") {
      return {
        code: "tool_not_available",
        field: `tool_settings.${id}`,
        message:
          tool.switch === "locked"
            ? `${tool.label} needs a decision before a bot can use it.`
            : `${tool.label} comes in a later milestone.`,
      };
    }
    if (id === "view_images" && !model.multimodal) {
      return {
        code: "tool_not_available",
        field: "tool_settings.view_images",
        message: `${model.label} does not read images, so View images stays off.`,
      };
    }
  }
  const jobs = new Map<string, string>();
  for (const id of turnedOn) {
    const tool = offered.get(id);
    if (tool === undefined) continue;
    const other = jobs.get(tool.job);
    if (other !== undefined) {
      return {
        code: "tool_job_conflict",
        field: `tool_settings.${id}`,
        message: `${offered.get(other)?.label ?? other} and ${tool.label} do the same job. Turn one off.`,
      };
    }
    jobs.set(tool.job, id);
  }
  // A PATCH sends only the switches it changes, so a tool it turns on must not share a job with
  // a tool that stays on in the saved settings; else step 5 would drop one and still answer 200.
  const merged = { ...base, ...body };
  for (const id of turnedOn) {
    const tool = offered.get(id);
    if (tool === undefined) continue;
    for (const other of offered.values()) {
      if (other.id === id || other.job !== tool.job || other.switch !== "open") continue;
      if (merged[other.id] !== true) continue;
      return {
        code: "tool_job_conflict",
        field: `tool_settings.${id}`,
        message: `${other.label} and ${tool.label} do the same job. Turn one off.`,
      };
    }
  }
  const effective = effectiveToolSettings(merged, tools, model);
  for (const id of turnedOn) {
    const tool = offered.get(id);
    const missing = tool?.needs.find((need) => effective[need] !== true);
    if (tool !== undefined && missing !== undefined) {
      return {
        code: "validation_error",
        field: `tool_settings.${id}`,
        message: `${tool.label} needs ${offered.get(missing)?.label ?? missing}. Turn that on first.`,
      };
    }
  }
  return null;
}
