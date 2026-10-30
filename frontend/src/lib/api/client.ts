import { client } from "./generated/client.gen.ts";

// The generated client (AGENTS.md §5 rule 4) calls relative URLs: Vite forwards `/api/*` to
// the backend in development, and the backend serves the app itself in a production build
// (M0c plan, decisions A and B). Every response is checked by the generated Zod schemas.
client.setConfig({ baseUrl: "" });

export { client };
