/**
 * The model port (architecture.md §2). M0 has only the catalog entry the fake model adds;
 * streaming replies with tools and usage per request come with the agent in M3.
 */
export interface ModelCatalogEntry {
  /** `<provider>:<model>`, for example `fake:scripted`. */
  id: string;
  label: string;
  /** True when the provider's key is set (or no key is needed). */
  available: boolean;
  efforts: readonly string[];
}

export interface ModelProvider {
  readonly catalog: readonly ModelCatalogEntry[];
}
