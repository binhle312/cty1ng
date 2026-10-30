// The model catalog (architecture.md §3). M0 has only the fake model switch (testing.md §2):
// with FAKE_MODEL=1 the catalog lists `fake:scripted`, available with no key. The real catalog
// from config/models.yaml comes with the first model slice.
export interface CatalogEntry {
  id: string;
  provider: string;
  available: boolean;
}

export function buildCatalog(options: { fakeModel: boolean }): CatalogEntry[] {
  return options.fakeModel ? [{ id: "fake:scripted", provider: "fake", available: true }] : [];
}
