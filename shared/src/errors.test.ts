import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES, ERROR_STATUS } from "./errors.ts";

describe("error codes (api.md §1)", () => {
  it("has a status for every code and no extra", () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODES].sort());
  });

  it("parses the one error shape", () => {
    const body = { error: { code: "origin_rejected", message: "Origin not allowed." } };
    expect(ApiError.safeParse(body).success).toBe(true);
  });

  it("rejects an unknown code and unknown keys", () => {
    expect(ApiError.safeParse({ error: { code: "boom", message: "x" } }).success).toBe(false);
    const extra = { error: { code: "not_found", message: "x", stack: "at …" } };
    expect(ApiError.safeParse(extra).success).toBe(false);
  });
});
