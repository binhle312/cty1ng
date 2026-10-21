# D25. One Grafana-style time range picker

Status: accepted (2026-10-21)
Decision: Every time range selection uses one shared component that follows Grafana's time
picker: quick ranges with search, absolute From/To accepting Grafana date math (`now-30d`,
`now/d`), a calendar for picking a day range, recently used ranges, a refresh button with
auto-refresh interval, shift back/forward, zoom out, a timezone footer, and the
unresolved range kept in the URL. The frontend resolves expressions to absolute instants; the
backend only sees ISO timestamps, a timezone and a bucket size.
Why: The owner works in Grafana daily, so the interaction is already familiar; one component
means one set of tests and consistent behaviour across pages.
Rejected: Simple 7/30/90-day buttons (no custom ranges, no live relative ranges); embedding
Grafana's own component (`@grafana/ui` is heavy, couples us to Grafana, and Grafana's code is
AGPL — we copy behaviour, not code).
Implemented in: `../requirements/time-range-picker.md`, `../api.md` §7, `../domain-model.md` §13.1.
