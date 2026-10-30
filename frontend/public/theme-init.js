// No-flash theme (design/themes.md §2 rule 5): sets data-theme, data-mode and data-density on
// <html> before the first paint. No imports, and everything is in try/catch, so broken storage
// never blocks the page. src/themes/theme.ts reads the same key with a Zod schema; keep the
// two in step. M0 ships Command dark only, so every mode shows dark (owner, 2026-10-30).
(function () {
  var theme = "command";
  var density = "default";
  try {
    var saved = JSON.parse(window.localStorage.getItem("cty1ng.appearance") || "null");
    if (saved && saved.density === "compact") density = "compact";
  } catch {
    // Keep the defaults.
  }
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-mode", "dark");
  root.setAttribute("data-density", density);
})();
