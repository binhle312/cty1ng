import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { Effort } from "@cty1ng/shared/catalog";

// Catalog effort → each provider's request option (domain-model.md §4). One row per provider;
// a new provider adds a row here and a test (M2 plan, #57: OpenAI and DeepSeek come later). The
// stored effort is always sent, never left out, because the default differs per model.
//
// Checked 2026-11-01 (M2 plan, P1 and P8):
// - Anthropic: `output_config.effort`, set by `providerOptions.anthropic.effort`. Do not also set
//   the AI SDK's top-level `reasoning`: the SDK ignores it when `effort` is set.
// - Google: `providerOptions.google.thinkingConfig.thinkingLevel`. Thinking cannot be turned off
//   on Gemini 3 and newer; `minimal` is the least. The top-level `reasoning` maps to `minimal`
//   for some models that do not take it, so it is never used.

type AnthropicEffort = NonNullable<AnthropicLanguageModelOptions["effort"]>;
type GoogleThinkingLevel = NonNullable<
  NonNullable<GoogleLanguageModelOptions["thinkingConfig"]>["thinkingLevel"]
>;

const ANTHROPIC_EFFORTS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const satisfies readonly AnthropicEffort[];
const GOOGLE_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high",
] as const satisfies readonly GoogleThinkingLevel[];

// One row per provider: the levels it takes, and the options for one of them (null when it
// does not take that level).
const PROVIDERS = {
  anthropic: {
    efforts: ANTHROPIC_EFFORTS,
    options: (effort: Effort) => {
      const level = ANTHROPIC_EFFORTS.find((known) => known === effort);
      return level === undefined
        ? null
        : { anthropic: { effort: level } satisfies AnthropicLanguageModelOptions };
    },
  },
  google: {
    efforts: GOOGLE_LEVELS,
    options: (effort: Effort) => {
      const level = GOOGLE_LEVELS.find((known) => known === effort);
      return level === undefined
        ? null
        : {
            google: {
              thinkingConfig: { thinkingLevel: level },
            } satisfies GoogleLanguageModelOptions,
          };
    },
  },
} as const;

export type ModelProvider = keyof typeof PROVIDERS;

export function isModelProvider(provider: string): provider is ModelProvider {
  return Object.hasOwn(PROVIDERS, provider);
}

// The efforts this adapter can send for a provider ([] for one it does not know); the catalog
// check at start uses it.
export function effortsOf(provider: string): readonly Effort[] {
  return isModelProvider(provider) ? PROVIDERS[provider].efforts : [];
}

// The `providerOptions` for one request. `null` effort (a model with no efforts) sends nothing.
// Throws on an effort the provider does not take: the catalog check at start prevents it.
export function effortOptions(
  provider: ModelProvider,
  effort: Effort | null,
): Record<string, Record<string, unknown>> {
  if (effort === null) return {};
  const options = PROVIDERS[provider].options(effort);
  if (options === null) throw new Error(`${provider} has no effort ${effort}`);
  return options;
}
