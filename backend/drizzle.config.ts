import { defineConfig } from "drizzle-kit";

// drizzle-kit writes SQL migrations from the schema (architecture.md §10 guardrail 3). The app
// applies them with its own runner (src/adapters/db/migrate.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/adapters/db/schema.ts",
  out: "./migrations",
});
