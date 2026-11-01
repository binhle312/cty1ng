import { z } from "zod";

// The model catalog and the tool catalog (domain-model.md §4, §4.1). `config/models.yaml` and
// `config/tools.yaml` are parsed with the file schemas; `GET /models` and `GET /tools` return
// the API shapes. Key values never appear here, only the name of the variable that holds one.

// Every effort level a provider offers today, in order from least to most thinking. A model
// lists the ones it takes (M2 plan, P1 and P8; decision 4).
export const EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
export const Effort = z.enum(EFFORT_LEVELS);
export type Effort = z.infer<typeof Effort>;

// Key variables end in `_API_KEY`, so log redaction finds every one (security.md §2.6).
const KeyEnvName = z.string().regex(/^[A-Z][A-Z0-9_]*_API_KEY$/);
const ModelIdPattern = /^[a-z0-9-]+:[A-Za-z0-9._-]+$/;
const ToolIdPattern = /^[a-z][a-z0-9_]*$/;

const Price = z.number().nonnegative();
export const PriceOverride = z
  .object({ input: Price, output: Price, cache_read: Price, cache_write: Price })
  .strict();

// One entry of config/models.yaml.
export const ModelFileEntry = z
  .object({
    id: z.string().regex(ModelIdPattern),
    label: z.string().min(1),
    api_key_env: KeyEnvName,
    efforts: z.array(Effort),
    default_effort: Effort.nullable().optional(),
    multimodal: z.boolean(),
    context_window: z.number().int().positive(),
    provider_tools: z.array(z.string().regex(ToolIdPattern)),
    price_override_per_mtok: PriceOverride.nullable().optional(),
  })
  .strict();
export type ModelFileEntry = z.infer<typeof ModelFileEntry>;

export const TOOL_KINDS = ["internal", "provider"] as const;
// The gate on the owner's switch (domain-model.md §4.1): open = the choice is saved; later and
// locked = forced off.
export const TOOL_SWITCHES = ["open", "later", "locked"] as const;
export type ToolSwitch = (typeof TOOL_SWITCHES)[number];

// One entry of config/tools.yaml.
export const ToolFileEntry = z
  .object({
    id: z.string().regex(ToolIdPattern),
    label: z.string().min(1),
    kind: z.enum(TOOL_KINDS),
    provider: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    job: z.string().regex(ToolIdPattern),
    added: z.iso.date(),
    sends_data_out: z.boolean(),
    web: z.boolean(),
    line: z.string().min(1),
    off_line: z.string().min(1).optional(),
    needs: z.array(z.string().regex(ToolIdPattern)).default([]),
    switch: z.enum(TOOL_SWITCHES),
  })
  .strict();
export type ToolFileEntry = z.infer<typeof ToolFileEntry>;

// Why a model cannot run (bots.md UI-4.6, app-shell.md UI-2.3).
export const UNAVAILABLE_REASONS = ["no_api_key", "model_removed"] as const;
export const UnavailableReason = z.enum(UNAVAILABLE_REASONS);
export type UnavailableReason = z.infer<typeof UnavailableReason>;

// `GET /models`.
export const CatalogModel = z
  .object({
    id: z.string(),
    label: z.string(),
    provider: z.string(),
    available: z.boolean(),
    // Set when `available` is false; a catalog model can only miss its key.
    unavailable_reason: z.literal("no_api_key").nullable(),
    // The variable name for "API key not set: {ENV_NAME}"; null for the fake models.
    api_key_env: z.string().nullable(),
    efforts: z.array(Effort),
    default_effort: Effort.nullable(),
    multimodal: z.boolean(),
    context_window: z.number().int().positive(),
    provider_tools: z.array(z.string()),
  })
  .strict();
export type CatalogModel = z.infer<typeof CatalogModel>;

// `GET /tools`.
export const CatalogTool = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(TOOL_KINDS),
    provider: z.string().nullable(),
    job: z.string(),
    added: z.string(),
    sends_data_out: z.boolean(),
    web: z.boolean(),
    line: z.string(),
    off_line: z.string().nullable(),
    needs: z.array(z.string()),
    switch: z.enum(TOOL_SWITCHES),
  })
  .strict();
export type CatalogTool = z.infer<typeof CatalogTool>;

export function providerOf(modelId: string): string {
  return modelId.slice(0, modelId.indexOf(":"));
}
