import "./lib/zod-config.ts";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import "./lib/api/client.ts";
import { startRealtime } from "./lib/realtime/start.ts";
import { createAppRouter } from "./router.ts";
import { createThemeController, readAppearance } from "./themes/theme.ts";

const queryClient = new QueryClient();
const router = createAppRouter();

createThemeController(
  document.documentElement,
  window.matchMedia("(prefers-color-scheme: dark)"),
).apply(readAppearance());
startRealtime(queryClient);

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
