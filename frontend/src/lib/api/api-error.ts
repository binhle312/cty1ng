import { ApiError } from "@cty1ng/shared/errors";

// The generated client throws the error body of a failed request (api.md §1). It is `unknown`
// until this parse (frontend-conventions.md §1); a network failure or another shape gives null.
export function readApiError(error: unknown): ApiError["error"] | null {
  const parsed = ApiError.safeParse(error);
  return parsed.success ? parsed.data.error : null;
}

// A line for the owner when no screen has its own text for the error.
export function apiErrorText(error: unknown): string {
  return readApiError(error)?.message ?? "The app could not reach the server. Try again.";
}
