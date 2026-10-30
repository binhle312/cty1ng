import type { Page } from "@playwright/test";

// Collects every CSP violation of a page (security.md §2.1): a library that adds an inline
// script or style shows up here.
export async function watchCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { __cspViolations: seen });
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  return () =>
    page.evaluate(() => {
      const value: unknown = Reflect.get(window, "__cspViolations");
      return Array.isArray(value) ? value.map(String) : [];
    });
}
