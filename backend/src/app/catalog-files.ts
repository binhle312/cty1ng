import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { buildCatalog, CatalogError, type Catalog } from "../core/catalog/catalog.rules.ts";
import type { Config } from "./config.ts";

// Reads config/models.yaml and config/tools.yaml once at start (domain-model.md §4, §4.1) and
// builds the catalog. A missing or bad file stops the start with the file and entry named.
export function loadCatalog(
  config: Pick<Config, "modelsFile" | "toolsFile" | "fakeModel" | "keysSet">,
): Catalog {
  return buildCatalog({
    models: parse(readFileSync(config.modelsFile, "utf8")),
    tools: parse(readFileSync(config.toolsFile, "utf8")),
    fakeModel: config.fakeModel,
    keySet: (name) => config.keysSet.has(name),
  });
}

// Every catalog model must be one the model adapter can run, with efforts it can send. Checked
// at start, so a typo in models.yaml never waits until the first run.
export function checkCatalogProviders(
  catalog: Catalog,
  adapter: {
    isProvider: (provider: string) => boolean;
    efforts: (provider: string) => readonly string[];
  },
): void {
  for (const model of catalog.models) {
    if (model.provider === "fake") continue;
    if (!adapter.isProvider(model.provider)) {
      throw new CatalogError(
        `config/models.yaml: ${model.id}: the app has no adapter for ${model.provider} yet`,
      );
    }
    const known = adapter.efforts(model.provider);
    for (const effort of model.efforts) {
      if (!known.includes(effort)) {
        throw new CatalogError(
          `config/models.yaml: ${model.id}: ${model.provider} takes no effort ${effort}`,
        );
      }
    }
  }
}
