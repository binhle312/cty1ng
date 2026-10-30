// `pnpm check:events`: the event table in the docs matches shared/ (realtime-events.md §4).
import { readFileSync } from "node:fs";
import { EVENT_TYPES } from "@cty1ng/shared/events";
import { PENDING, checkEvents, documentedTypes } from "./lib/check-events.ts";
import { report } from "./lib/report.ts";

const doc = readFileSync("docs/realtime-events.md", "utf8");
report("check:events", checkEvents(documentedTypes(doc), EVENT_TYPES, PENDING));
