// The tool settings rules live in `shared/` because the Create page and the bot page apply the
// same steps before they send a body (create-bot-page.md §3.0). The server checks with them.
export * from "@cty1ng/shared/tool-settings";
