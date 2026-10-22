/**
 * The price port (D21). Types only: the genai-prices adapter with the models.yaml override
 * comes with usage tracking.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface PriceQuote {
  /** Null when no source knows the model. */
  usd: number | null;
  source: "override" | "feed" | "unknown";
}

export interface PriceSource {
  price(input: { modelId: string; usage: TokenUsage; at: Date }): Promise<PriceQuote>;
}
