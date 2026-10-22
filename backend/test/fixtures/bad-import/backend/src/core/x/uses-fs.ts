// Bad: core imports node:fs.
import { readFileSync } from "node:fs";
export const read = readFileSync;
