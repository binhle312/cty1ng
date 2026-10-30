import type { ModelUsage } from "./model.ts";

// The price port (D21, architecture.md §2). Types only: the adapter comes with cost tracking,
// which may change this interface with the owner's review.
export interface Price {
  usd: number;
  source: "feed" | "override";
}

export interface Prices {
  // Null when the model has no known price (D42 amendment: refused under a cap).
  price(modelId: string, usage: ModelUsage): Price | null;
}
