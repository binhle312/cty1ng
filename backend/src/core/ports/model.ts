// The model provider port (architecture.md §2). Types only: the AI SDK adapter comes with the
// first model slice (M3), which may change this interface with the owner's review. M0 has only
// the fake model switch and its script loader (testing.md §2).
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type ModelChunk =
  | { kind: "text"; text: string }
  | { kind: "tool_call"; id: string; name: string; input: unknown }
  | { kind: "finish"; usage: ModelUsage };

export interface ModelRequest {
  modelId: string;
  effort: string | null;
  system: string;
  messages: readonly unknown[];
  tools: readonly { name: string; description: string; inputSchema: unknown }[];
}

export interface Model {
  stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<ModelChunk>;
}
