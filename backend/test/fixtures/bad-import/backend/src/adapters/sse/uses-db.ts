// Bad: one adapter imports another.
import { store } from "../db/store";
export const value = store;
