import {
  ModelFileEntry,
  providerOf,
  ToolFileEntry,
  type CatalogModel,
  type CatalogTool,
  type UnavailableReason,
} from "@cty1ng/shared/catalog";

// The model catalog and the tool catalog (domain-model.md §4, §4.1). Pure: app/ reads the two
// YAML files and passes their parsed contents and which key variables are set; this file checks
// them and answers questions about them. A bad file stops the start with a clear message.

export interface Catalog {
  // In file order, then the fake models (FAKE_MODEL=1).
  readonly models: readonly CatalogModel[];
  readonly tools: readonly CatalogTool[];
  model(id: string): CatalogModel | undefined;
  tool(id: string): CatalogTool | undefined;
}

export class CatalogError extends Error {}

// The fake models (testing.md §2): run by the fake adapter, available with no key.
const FAKE_MODELS: readonly CatalogModel[] = [
  {
    id: "fake:scripted",
    label: "Fake scripted",
    provider: "fake",
    available: true,
    unavailable_reason: null,
    api_key_env: null,
    efforts: [],
    default_effort: null,
    multimodal: false,
    context_window: 200_000,
    provider_tools: [],
  },
  {
    id: "fake:effort",
    label: "Fake with effort",
    provider: "fake",
    available: true,
    unavailable_reason: null,
    api_key_env: null,
    efforts: ["low", "medium", "high"],
    default_effort: "medium",
    multimodal: true,
    context_window: 200_000,
    provider_tools: [],
  },
];

export function buildCatalog(input: {
  models: unknown;
  tools: unknown;
  fakeModel: boolean;
  // Whether the key variable is set and not empty.
  keySet: (envName: string) => boolean;
}): Catalog {
  const tools = parseList(input.tools, ToolFileEntry, "config/tools.yaml").map(toTool);
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  unique(
    tools.map((tool) => tool.id),
    "config/tools.yaml",
  );
  for (const tool of tools) {
    if ((tool.kind === "provider") !== (tool.provider !== null)) {
      throw new CatalogError(
        `config/tools.yaml: ${tool.id} needs a provider exactly when its kind is provider`,
      );
    }
    for (const need of tool.needs) {
      if (!toolById.has(need)) {
        throw new CatalogError(`config/tools.yaml: ${tool.id} needs ${need}, which is not listed`);
      }
    }
  }

  const fileModels = parseList(input.models, ModelFileEntry, "config/models.yaml");
  unique(
    fileModels.map((model) => model.id),
    "config/models.yaml",
  );
  const models = fileModels.map((entry): CatalogModel => {
    const provider = providerOf(entry.id);
    if (provider === "fake") {
      throw new CatalogError(`config/models.yaml: ${entry.id}: the fake provider is built in`);
    }
    const defaultEffort = entry.default_effort ?? null;
    if (
      entry.efforts.length > 0 &&
      (defaultEffort === null || !entry.efforts.includes(defaultEffort))
    ) {
      throw new CatalogError(
        `config/models.yaml: ${entry.id}: default_effort must be one of its efforts`,
      );
    }
    if (entry.efforts.length === 0 && defaultEffort !== null) {
      throw new CatalogError(`config/models.yaml: ${entry.id}: default_effort without efforts`);
    }
    for (const id of entry.provider_tools) {
      const tool = toolById.get(id);
      if (tool?.kind !== "provider" || tool.provider !== provider) {
        throw new CatalogError(
          `config/models.yaml: ${entry.id}: ${id} is not a ${provider} tool in config/tools.yaml`,
        );
      }
    }
    const available = input.keySet(entry.api_key_env);
    return {
      id: entry.id,
      label: entry.label,
      provider,
      available,
      unavailable_reason: available ? null : "no_api_key",
      api_key_env: entry.api_key_env,
      efforts: entry.efforts,
      default_effort: defaultEffort,
      multimodal: entry.multimodal,
      context_window: entry.context_window,
      provider_tools: entry.provider_tools,
    };
  });

  const all = input.fakeModel ? [...models, ...FAKE_MODELS] : models;
  const modelById = new Map(all.map((model) => [model.id, model]));
  return {
    models: all,
    tools,
    model: (id) => modelById.get(id),
    tool: (id) => toolById.get(id),
  };
}

// A bot can run when its model is in the catalog and the model's key is set (domain-model.md §2
// Availability). Computed, never stored.
export function modelAvailability(
  catalog: Catalog,
  modelId: string,
): { available: true; reason: null } | { available: false; reason: UnavailableReason } {
  const model = catalog.model(modelId);
  if (model === undefined) return { available: false, reason: "model_removed" };
  if (!model.available) return { available: false, reason: "no_api_key" };
  return { available: true, reason: null };
}

function toTool(entry: ToolFileEntry): CatalogTool {
  return {
    id: entry.id,
    label: entry.label,
    kind: entry.kind,
    provider: entry.provider ?? null,
    job: entry.job,
    added: entry.added,
    sends_data_out: entry.sends_data_out,
    web: entry.web,
    line: entry.line,
    off_line: entry.off_line ?? null,
    needs: entry.needs,
    switch: entry.switch,
  };
}

function parseList<T>(
  value: unknown,
  schema: {
    safeParse: (v: unknown) =>
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
        };
  },
  file: string,
): T[] {
  if (!Array.isArray(value)) throw new CatalogError(`${file} must be a list`);
  return value.map((item: unknown, index) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue === undefined ? "" : issue.path.map(String).join(".");
      throw new CatalogError(
        `${file}: entry ${String(index + 1)}${where === "" ? "" : ` (${where})`}: ${issue?.message ?? "invalid"}`,
      );
    }
    return parsed.data;
  });
}

function unique(ids: readonly string[], file: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new CatalogError(`${file}: ${id} is listed twice`);
    seen.add(id);
  }
}
